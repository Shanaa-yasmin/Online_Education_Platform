from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Notification
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

