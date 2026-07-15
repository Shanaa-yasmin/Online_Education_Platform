import threading
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.db import models
from django.contrib.auth import get_user_model
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Announcement
from .serializers import AnnouncementSerializer
from payments.models import Enrollment
from courses.models import Course
from notifications.models import Notification
from notifications.serializers import NotificationSerializer

User = get_user_model()

class IsAdminOrMentor(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ['ADMIN', 'MENTOR']

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.role == 'ADMIN':
            return True
        return request.user.role == 'MENTOR' and obj.created_by == request.user

def _fan_out_notifications_async(announcement_id):
    """
    Background worker thread to:
    1. Bulk create Notification records in the DB
    2. Broadcast WebSocket notifications to recipients
    """
    try:
        announcement = Announcement.objects.select_related('course', 'created_by').get(id=announcement_id)
        
        # 1. Gather recipient User IDs
        if announcement.course:
            # Course-scoped: notify active enrolled students except the creator
            recipient_ids = list(
                Enrollment.objects.filter(
                    course=announcement.course,
                    is_active=True
                ).exclude(student=announcement.created_by)
                .values_list('student_id', flat=True)
            )
            title = f"📢 New announcement in {announcement.course.title}"
        else:
            # Global announcement: notify all active users except the creator
            recipient_ids = list(
                User.objects.filter(is_active=True)
                .exclude(id=announcement.created_by.id)
                .values_list('id', flat=True)
            )
            title = f"📢 New announcement: {announcement.title}"

        if not recipient_ids:
            return

        # 2. Bulk create Notification objects
        notifications = [
            Notification(
                recipient_id=r_id,
                sender=announcement.created_by,
                title=title,
                message=announcement.title,
                notification_type=Notification.NotificationType.NEW_ANNOUNCEMENT,
                related_object_id=announcement.id,
                related_object_type="announcement"
            )
            for r_id in recipient_ids
        ]
        
        created_notifications = Notification.objects.bulk_create(notifications)

        # 3. Broadcast live via WebSockets
        channel_layer = get_channel_layer()
        if channel_layer:
            for notif in created_notifications:
                group_name = f"user_{notif.recipient_id}"
                serializer = NotificationSerializer(notif)
                try:
                    async_to_sync(channel_layer.group_send)(
                        group_name,
                        {
                            "type": "send_notification",
                            "payload": serializer.data
                        }
                    )
                except Exception as ws_err:
                    print(f"[WS ERROR] Failed to send WS notification for user {notif.recipient_id}: {ws_err}")
                    
    except Exception as err:
        print(f"[FANOUT ERROR] Failed fanning out notifications for announcement {announcement_id}: {err}")
    finally:
        connection.close()

class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrMentor]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Announcement.objects.all()
        
        if user.role == 'MENTOR':
            # Mentors see their own courses' announcements, global ones, or any they created
            mentor_course_ids = Course.objects.filter(mentor=user).values_list('id', flat=True)
            return Announcement.objects.filter(
                models.Q(course_id__in=mentor_course_ids) |
                models.Q(course__isnull=True) |
                models.Q(created_by=user)
            ).distinct()

        if user.role == 'STUDENT':
            # Students see announcements for courses they are enrolled in + global ones
            enrolled_course_ids = Enrollment.objects.filter(student=user, is_active=True).values_list('course_id', flat=True)
            return Announcement.objects.filter(
                models.Q(course_id__in=enrolled_course_ids) |
                models.Q(course__isnull=True)
            ).distinct()

        return Announcement.objects.none()

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        # Fan out notifications on background thread to avoid blocking API response
        threading.Thread(
            target=_fan_out_notifications_async,
            args=(announcement.id,),
            daemon=True
        ).start()

    def perform_destroy(self, instance):
        instance.soft_delete()
