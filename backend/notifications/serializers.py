from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Notification, NotificationPreference

User = get_user_model()

class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'title', 'message', 
            'notification_type', 'is_read', 'created_at', 
            'related_object_id', 'related_object_type'
        ]
        read_only_fields = [
            'id', 'recipient', 'sender', 'title', 'message', 
            'notification_type', 'created_at', 
            'related_object_id', 'related_object_type'
        ]


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    Lets a user control which *social/activity* notification types also
    send an email. Transactional notifications (payments, refunds,
    certificates, approval decisions) are not represented here — they
    always email and are not user-configurable.
    """
    class Meta:
        model = NotificationPreference
        fields = [
            'email_new_lesson', 'email_new_review',
            'email_qna_reply', 'email_enrollment', 'updated_at'
        ]
        read_only_fields = ['updated_at']