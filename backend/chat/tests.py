"""
Tests for Phase 6 — Real-time Q&A Chat
Covers:
  - ChatRoom auto-creation
  - ChatMessage REST API (history retrieval, role-based visibility)
  - WebSocket consumer: connect, send, flag, hide, delete
"""

import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer
from asgiref.sync import sync_to_async
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from core.asgi import application
from courses.models import Course
from payments.models import Enrollment
from chat.models import ChatRoom, ChatMessage
from chat.serializers import ChatMessageSerializer

User = get_user_model()


# ─── Helpers ────────────────────────────────────────────────────────────────

def make_user(username, role='STUDENT', is_staff=False):
    u = User.objects.create_user(
        username=username,
        email=f'{username}@example.com',
        password='pass12345',
        role=role,
    )
    u.is_staff = is_staff
    u.save()
    return u


def make_course(mentor, title='Test Course'):
    return Course.objects.create(
        title=title,
        description='A test course',
        mentor=mentor,
        price=0,
        is_published=True,
    )


def enroll(student, course):
    return Enrollment.objects.create(
        student=student,
        course=course,
        is_active=True,
    )


def jwt_token(user):
    return str(AccessToken.for_user(user))


# ─── REST API Tests ──────────────────────────────────────────────────────────

class ChatMessageAPITest(TestCase):
    def setUp(self):
        self.mentor  = make_user('mentor1', role='MENTOR')
        self.student = make_user('student1', role='STUDENT')
        self.other   = make_user('other1', role='STUDENT')
        self.admin   = make_user('admin1', role='ADMIN', is_staff=True)
        self.course  = make_course(self.mentor)
        enroll(self.student, self.course)
        self.room, _ = ChatRoom.objects.get_or_create(course=self.course)
        self.client  = APIClient()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _url(self):
        return f'/api/chat/messages/course/{self.course.pk}/'

    # ── Access control ──────────────────────────────────────────────

    def test_enrolled_student_can_list(self):
        self._auth(self.student)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)

    def test_unenrolled_student_is_denied(self):
        self._auth(self.other)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 403)

    def test_mentor_can_list(self):
        self._auth(self.mentor)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)

    def test_admin_can_list(self):
        self._auth(self.admin)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)

    def test_unauthenticated_is_denied(self):
        res = self.client.get(self._url())
        self.assertIn(res.status_code, [401, 403])

    # ── Hidden message visibility ────────────────────────────────────

    def test_hidden_messages_invisible_to_students(self):
        ChatMessage.objects.create(
            room=self.room, sender=self.mentor,
            message_text='Hidden msg', is_hidden=True
        )
        self._auth(self.student)
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        texts = [m['message_text'] for m in res.json()]
        self.assertNotIn('Hidden msg', texts)

    def test_hidden_messages_visible_to_mentor(self):
        ChatMessage.objects.create(
            room=self.room, sender=self.student,
            message_text='Moderated text', is_hidden=True
        )
        self._auth(self.mentor)
        res = self.client.get(self._url())
        texts = [m['message_text'] for m in res.json()]
        self.assertIn('Moderated text', texts)

    # ── Serializer field completeness ────────────────────────────────

    def test_response_contains_expected_fields(self):
        ChatMessage.objects.create(
            room=self.room, sender=self.student, message_text='Hello'
        )
        self._auth(self.student)
        res = self.client.get(self._url())
        first = res.json()[0]
        for field in ['id', 'sender', 'message_text', 'created_at', 'is_flagged_abuse', 'is_hidden', 'parent_id']:
            self.assertIn(field, first)

    def test_messages_ordered_chronologically(self):
        for i in range(3):
            ChatMessage.objects.create(
                room=self.room, sender=self.student, message_text=f'msg{i}'
            )
        self._auth(self.student)
        res = self.client.get(self._url())
        texts = [m['message_text'] for m in res.json()]
        self.assertEqual(texts, ['msg0', 'msg1', 'msg2'])


# ─── WebSocket Consumer Tests ────────────────────────────────────────────────

class ChatConsumerTest(TestCase):
    def setUp(self):
        self.mentor  = make_user('ws_mentor', role='MENTOR')
        self.student = make_user('ws_student', role='STUDENT')
        self.other   = make_user('ws_other', role='STUDENT')
        self.course  = make_course(self.mentor)
        enroll(self.student, self.course)

    def _ws_url(self, user):
        token = jwt_token(user)
        return f'/ws/course/{self.course.pk}/qa/?token={token}'

    async def _connect(self, user):
        comm = WebsocketCommunicator(application, self._ws_url(user))
        connected, _ = await comm.connect()
        return comm, connected

    # ── Connection acceptance ────────────────────────────────────────

    async def test_enrolled_student_can_connect(self):
        comm, connected = await self._connect(self.student)
        self.assertTrue(connected)
        await comm.disconnect()

    async def test_mentor_can_connect(self):
        comm, connected = await self._connect(self.mentor)
        self.assertTrue(connected)
        await comm.disconnect()

    async def test_unenrolled_student_is_rejected(self):
        comm = WebsocketCommunicator(application, self._ws_url(self.other))
        connected, code = await comm.connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4003)

    async def test_invalid_token_is_rejected(self):
        comm = WebsocketCommunicator(
            application, f'/ws/course/{self.course.pk}/qa/?token=bad.token.here'
        )
        connected, code = await comm.connect()
        self.assertFalse(connected)

    # ── send_message ────────────────────────────────────────────────

    async def test_send_message_broadcast(self):
        sender_comm, _ = await self._connect(self.student)
        recv_comm,   _ = await self._connect(self.mentor)

        await sender_comm.send_json_to({
            'action': 'send_message',
            'message_text': 'WS hello!',
            'parent_id': None,
        })

        # Both participants receive the event
        for comm in (sender_comm, recv_comm):
            data = await comm.receive_json_from(timeout=5)
            self.assertEqual(data['type'], 'chat_message')
            self.assertEqual(data['message']['message_text'], 'WS hello!')

        await sender_comm.disconnect()
        await recv_comm.disconnect()

    async def test_empty_message_is_not_broadcast(self):
        comm, _ = await self._connect(self.student)
        await comm.send_json_to({'action': 'send_message', 'message_text': '   '})
        self.assertTrue(await comm.receive_nothing(timeout=1))
        await comm.disconnect()

    async def test_message_persisted_to_db(self):
        comm, _ = await self._connect(self.student)
        await comm.send_json_to({
            'action': 'send_message',
            'message_text': 'Persisted?',
            'parent_id': None,
        })
        await comm.receive_json_from(timeout=5)  # consume broadcast
        count = await sync_to_async(ChatMessage.objects.filter(message_text='Persisted?').count)()
        self.assertEqual(count, 1)
        await comm.disconnect()

    # ── flag_message ────────────────────────────────────────────────

    async def test_flag_message(self):
        room, _ = await sync_to_async(ChatRoom.objects.get_or_create)(course=self.course)
        msg = await sync_to_async(ChatMessage.objects.create)(
            room=room, sender=self.mentor, message_text='Flag me'
        )

        comm, _ = await self._connect(self.student)
        await comm.send_json_to({'action': 'flag_message', 'message_id': msg.pk})

        data = await comm.receive_json_from(timeout=5)
        self.assertEqual(data['type'], 'flag_message')
        self.assertEqual(data['message_id'], msg.pk)

        await sync_to_async(msg.refresh_from_db)()
        self.assertTrue(msg.is_flagged_abuse)
        await comm.disconnect()

    # ── hide_message ────────────────────────────────────────────────

    async def test_mentor_can_hide_message(self):
        room, _ = await sync_to_async(ChatRoom.objects.get_or_create)(course=self.course)
        msg = await sync_to_async(ChatMessage.objects.create)(
            room=room, sender=self.student, message_text='Hide me'
        )

        comm, _ = await self._connect(self.mentor)
        await comm.send_json_to({
            'action': 'hide_message', 'message_id': msg.pk, 'is_hidden': True
        })

        data = await comm.receive_json_from(timeout=5)
        self.assertEqual(data['type'], 'hide_message')
        self.assertTrue(data['is_hidden'])

        await sync_to_async(msg.refresh_from_db)()
        self.assertTrue(msg.is_hidden)
        await comm.disconnect()

    async def test_student_cannot_hide_message(self):
        room, _ = await sync_to_async(ChatRoom.objects.get_or_create)(course=self.course)
        msg = await sync_to_async(ChatMessage.objects.create)(
            room=room, sender=self.mentor, message_text='Cannot hide'
        )

        comm, _ = await self._connect(self.student)
        await comm.send_json_to({
            'action': 'hide_message', 'message_id': msg.pk, 'is_hidden': True
        })
        # No broadcast should be received — student lacks permission
        self.assertTrue(await comm.receive_nothing(timeout=1))

        await sync_to_async(msg.refresh_from_db)()
        self.assertFalse(msg.is_hidden)
        await comm.disconnect()

    # ── delete_message ───────────────────────────────────────────────

    async def test_sender_can_delete_own_message(self):
        room, _ = await sync_to_async(ChatRoom.objects.get_or_create)(course=self.course)
        msg = await sync_to_async(ChatMessage.objects.create)(
            room=room, sender=self.student, message_text='Delete me'
        )

        comm, _ = await self._connect(self.student)
        await comm.send_json_to({'action': 'delete_message', 'message_id': msg.pk})

        data = await comm.receive_json_from(timeout=5)
        self.assertEqual(data['type'], 'delete_message')
        self.assertEqual(data['message_id'], msg.pk)

        exists = await sync_to_async(ChatMessage.objects.filter(pk=msg.pk).exists)()
        self.assertFalse(exists)
        await comm.disconnect()

    async def test_mentor_can_delete_any_message(self):
        room, _ = await sync_to_async(ChatRoom.objects.get_or_create)(course=self.course)
        msg = await sync_to_async(ChatMessage.objects.create)(
            room=room, sender=self.student, message_text='Mentor deletes this'
        )

        comm, _ = await self._connect(self.mentor)
        await comm.send_json_to({'action': 'delete_message', 'message_id': msg.pk})

        data = await comm.receive_json_from(timeout=5)
        self.assertEqual(data['type'], 'delete_message')

        exists = await sync_to_async(ChatMessage.objects.filter(pk=msg.pk).exists)()
        self.assertFalse(exists)
        await comm.disconnect()
