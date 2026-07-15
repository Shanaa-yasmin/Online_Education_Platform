from django.db import models
from django.conf import settings

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ENROLLMENT = 'ENROLLMENT', 'Enrollment'
        COURSE_APPROVED = 'COURSE_APPROVED', 'Course Approved'
        COURSE_REJECTED = 'COURSE_REJECTED', 'Course Rejected'
        MENTOR_APPROVED = 'MENTOR_APPROVED', 'Mentor Approved'
        COURSE_PENDING_APPROVAL = 'COURSE_PENDING_APPROVAL', 'Course Pending Approval'
        NEW_QUESTION = 'NEW_QUESTION', 'New Question'
        QUESTION_REPLY = 'QUESTION_REPLY', 'Question Reply'
        NEW_REVIEW = 'NEW_REVIEW', 'New Review'
        PAYMENT_SUCCESS = 'PAYMENT_SUCCESS', 'Payment Successful'
        REFUND_PROCESSED = 'REFUND_PROCESSED', 'Refund Processed'
        CERTIFICATE_GENERATED = 'CERTIFICATE_GENERATED', 'Certificate Generated'
        LESSON_ADDED = 'LESSON_ADDED', 'New Lesson Added'
        COURSE_UPDATED = 'COURSE_UPDATED', 'Course Updated'
        SYSTEM = 'SYSTEM', 'System'
        REFUND = 'REFUND', 'Refund Event'
        ANNOUNCEMENT = 'ANNOUNCEMENT', 'Mentor Announcement'
        NEW_ANNOUNCEMENT = 'NEW_ANNOUNCEMENT', 'New Announcement'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_notifications',
        null=True,
        blank=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object_type = models.CharField(max_length=100, null=True, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title} (Read: {self.is_read})"

    # Notification types that always email, no opt-out. High-stakes /
    # transactional in nature: money, credentials, approval decisions.
    TRANSACTIONAL_TYPES = {
        NotificationType.PAYMENT_SUCCESS,
        NotificationType.REFUND_PROCESSED,
        NotificationType.REFUND,
        NotificationType.CERTIFICATE_GENERATED,
        NotificationType.COURSE_APPROVED,
        NotificationType.COURSE_REJECTED,
        NotificationType.MENTOR_APPROVED,
        NotificationType.COURSE_PENDING_APPROVAL,
    }

    @property
    def should_email(self):
        """
        Decide whether this Notification instance should trigger an email.
        Only TRANSACTIONAL_TYPES are emailed.
        """
        return self.notification_type in self.TRANSACTIONAL_TYPES