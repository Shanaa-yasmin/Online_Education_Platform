from django.db import models
from django.conf import settings
from courses.models import Course

class ChatRoom(models.Model):
    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name='chat_room')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Chat Room for {self.course.title}"


class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_messages'
    )
    # Self-reference field to support threaded replies
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    message_text = models.TextField()
    is_flagged_abuse = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)  # Admin/Mentor can hide inappropriate messages
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        snippet = self.message_text[:30]
        return f"{self.sender.username}: {snippet}"
