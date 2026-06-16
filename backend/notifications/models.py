from django.db import models
from django.conf import settings

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ENROLLMENT = 'ENROLLMENT', 'Enrollment Event'
        LESSON_ADDED = 'LESSON_ADDED', 'New Lesson Added'
        QNA_REPLY = 'QNA_REPLY', 'Q&A Reply'
        REFUND = 'REFUND', 'Refund Event'
        ANNOUNCEMENT = 'ANNOUNCEMENT', 'Mentor Announcement'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.ANNOUNCEMENT
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title} (Read: {self.is_read})"
