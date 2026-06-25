import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from courses.models import Course
from payments.models import Enrollment
from .models import ChatRoom, ChatMessage
from .serializers import ChatMessageSerializer

logger = logging.getLogger(__name__)
User = get_user_model()

class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    Consumer handling real-time WebSockets messages inside a Course Q&A Chat Room.
    Uses JWT authentication token and verifies course access before connection is accepted.
    """
    async def connect(self):
        self.course_id = self.scope['url_route']['kwargs']['course_id']
        self.room_group_name = f"chat_{self.course_id}"
        self.user = self.scope.get('user')

        # 1. Reject anonymous connections
        if not self.user or self.user.is_anonymous:
            logger.warning("[Chat WS] Anonymous user connection rejected.")
            await self.close(code=4003)
            return

        # 2. Access control check
        has_access = await self._check_access()
        if not has_access:
            logger.warning("[Chat WS] Access denied for user %s to course %s", self.user.username, self.course_id)
            await self.close(code=4003)
            return

        # 3. Join the course chat room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        logger.info("[Chat WS] User %s connected to chat_%s", self.user.username, self.course_id)

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            logger.info("[Chat WS] User %s disconnected from chat_%s", self.user.username, self.course_id)

    async def receive_json(self, content):
        action = content.get('action')

        if action == 'send_message':
            text = content.get('message_text')
            parent_id = content.get('parent_id')
            if not text or not text.strip():
                return
            
            msg = await self._save_message(text, parent_id)
            if msg:
                # Broadcast the newly saved message details to the group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': msg
                    }
                )

        elif action == 'flag_message':
            msg_id = content.get('message_id')
            if not msg_id:
                return

            success = await self._flag_message_db(msg_id)
            if success:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'flag_message',
                        'message_id': msg_id
                    }
                )

        elif action == 'hide_message':
            msg_id = content.get('message_id')
            is_hidden = content.get('is_hidden', True)
            if not msg_id:
                return

            # Check if user is Mentor of the course or Admin
            can_moderate = await self._check_moderator_access()
            if not can_moderate:
                return

            success = await self._hide_message_db(msg_id, is_hidden)
            if success:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'hide_message',
                        'message_id': msg_id,
                        'is_hidden': is_hidden
                    }
                )

        elif action == 'delete_message':
            msg_id = content.get('message_id')
            if not msg_id:
                return

            # Check if user can delete (is sender, or mentor, or admin)
            can_delete = await self._check_delete_permission(msg_id)
            if not can_delete:
                return

            success = await self._delete_message_db(msg_id)
            if success:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'delete_message',
                        'message_id': msg_id
                    }
                )

    # ── Group broadcast handlers (forward events to WebSocket clients) ──

    async def chat_message(self, event):
        # Filter hidden/moderated message payload for normal students
        message_data = event['message']
        if message_data.get('is_hidden') and self.user.role == 'STUDENT' and not (self.user.is_staff or self.user.is_superuser):
            return
        await self.send_json(event)

    async def flag_message(self, event):
        await self.send_json(event)

    async def hide_message(self, event):
        await self.send_json(event)

    async def delete_message(self, event):
        await self.send_json(event)

    # ── DB interaction helpers (using database_sync_to_async) ──────────

    @database_sync_to_async
    def _check_access(self):
        try:
            course = Course.objects.get(pk=self.course_id)
        except Course.DoesNotExist:
            return False

        if self.user.is_staff or self.user.role == 'ADMIN':
            return True
        elif self.user.role == 'MENTOR':
            return course.mentor == self.user
        elif self.user.role == 'STUDENT':
            return Enrollment.objects.filter(student=self.user, course=course, is_active=True).exists()
        return False

    @database_sync_to_async
    def _check_moderator_access(self):
        try:
            course = Course.objects.get(pk=self.course_id)
            return self.user.is_staff or self.user.role == 'ADMIN' or course.mentor == self.user
        except Course.DoesNotExist:
            return False

    @database_sync_to_async
    def _check_delete_permission(self, msg_id):
        try:
            msg = ChatMessage.objects.get(pk=msg_id)
            course = msg.room.course
            is_sender = msg.sender == self.user
            is_moderator = self.user.is_staff or self.user.role == 'ADMIN' or course.mentor == self.user
            return is_sender or is_moderator
        except ChatMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def _save_message(self, text, parent_id):
        try:
            course = Course.objects.get(pk=self.course_id)
            room, _ = ChatRoom.objects.get_or_create(course=course)
            
            parent = None
            if parent_id:
                try:
                    parent = ChatMessage.objects.get(pk=parent_id, room=room)
                except ChatMessage.DoesNotExist:
                    pass

            msg = ChatMessage.objects.create(
                room=room,
                sender=self.user,
                parent=parent,
                message_text=text
            )
            return ChatMessageSerializer(msg).data
        except Exception as exc:
            logger.error("Failed to save WebSocket chat message: %s", exc)
            return None

    @database_sync_to_async
    def _flag_message_db(self, msg_id):
        try:
            msg = ChatMessage.objects.get(pk=msg_id)
            msg.is_flagged_abuse = True
            msg.save(update_fields=['is_flagged_abuse'])
            return True
        except ChatMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def _hide_message_db(self, msg_id, is_hidden):
        try:
            msg = ChatMessage.objects.get(pk=msg_id)
            msg.is_hidden = is_hidden
            msg.save(update_fields=['is_hidden'])
            return True
        except ChatMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def _delete_message_db(self, msg_id):
        try:
            msg = ChatMessage.objects.get(pk=msg_id)
            msg.delete()
            return True
        except ChatMessage.DoesNotExist:
            return False
