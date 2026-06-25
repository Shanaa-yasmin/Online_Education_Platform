from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatMessage

User = get_user_model()

class ChatUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'role', 'email']

class ChatMessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        source='parent',
        queryset=ChatMessage.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'room',
            'sender',
            'parent_id',
            'message_text',
            'is_flagged_abuse',
            'is_hidden',
            'created_at'
        ]
        read_only_fields = ['id', 'room', 'sender', 'is_flagged_abuse', 'is_hidden', 'created_at']
