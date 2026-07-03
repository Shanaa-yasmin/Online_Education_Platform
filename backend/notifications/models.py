from django.db import models
from django.conf import settings

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ENROLLMENT = 'ENROLLMENT', 'Enrollment'
        COURSE_APPROVED = 'COURSE_APPROVED', 'Course Approved'
        COURSE_REJECTED = 'COURSE_REJECTED', 'Course Rejected'
        MENTOR_APPROVED = 'MENTOR_APPROVED', 'Mentor Approved'
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
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title} (Read: {self.is_read})"


class NotificationPreference(models.Model):
    """
    Per-user opt-in controls for *social/activity* email notifications.
    Transactional notifications (payments, refunds, certificates, approval
    decisions) always email regardless of these settings.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    email_new_lesson = models.BooleanField(default=False)
    email_new_review = models.BooleanField(default=False)
    email_qna_reply = models.BooleanField(default=False)
    email_enrollment = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Notification preferences for {self.user.username}"

    # Maps a "social" notification type to the preference field that gates
    # its email. Types not listed here are never emailed automatically.
    SOCIAL_TYPE_PREF_FIELDS = {
        Notification.NotificationType.LESSON_ADDED: 'email_new_lesson',
        Notification.NotificationType.NEW_REVIEW: 'email_new_review',
        Notification.NotificationType.QUESTION_REPLY: 'email_qna_reply',
        Notification.NotificationType.ENROLLMENT: 'email_enrollment',
    }

    # Notification types that always email, no opt-out. High-stakes /
    # transactional in nature: money, credentials, approval decisions.
    TRANSACTIONAL_TYPES = {
        Notification.NotificationType.PAYMENT_SUCCESS,
        Notification.NotificationType.REFUND_PROCESSED,
        Notification.NotificationType.REFUND,
        Notification.NotificationType.CERTIFICATE_GENERATED,
        Notification.NotificationType.COURSE_APPROVED,
        Notification.NotificationType.COURSE_REJECTED,
        Notification.NotificationType.MENTOR_APPROVED,
    }

    @classmethod
    def should_email(cls, notification):
        """
        Decide whether a given Notification instance should trigger an email.
        Transactional types: always yes. Social types: only if the recipient
        has opted in via their preference field. Anything unmapped (SYSTEM,
        ANNOUNCEMENT, etc.): no email by default.
        """
        ntype = notification.notification_type

        if ntype in cls.TRANSACTIONAL_TYPES:
            return True

        pref_field = cls.SOCIAL_TYPE_PREF_FIELDS.get(ntype)
        if not pref_field:
            return False

        prefs = getattr(notification.recipient, 'notification_preferences', None)
        if prefs is None:
            return False

        return getattr(prefs, pref_field, False)