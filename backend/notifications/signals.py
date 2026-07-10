import threading

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer


def _send_email_async(subject, body, recipient_list):
    """
    Runs the actual send_mail call on a background thread so a slow SMTP
    call never adds latency to the request that triggered the notification
    (e.g. a payment completing, a lesson being saved).
    """
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=None,  # Uses DEFAULT_FROM_EMAIL from settings
            recipient_list=recipient_list,
            fail_silently=True
        )
    except Exception as e:
        print(f"Error sending email: {e}")

# Import external models safely
from payments.models import Payment, Enrollment
from certificates.models import Certificate
from courses.models import Lesson, Review
from chat.models import ChatMessage

@receiver(post_save, sender=Notification)
def send_realtime_and_email_notification(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if not created:
        return

    # 1. Send live WebSocket event via channels channel layer
    channel_layer = get_channel_layer()
    if channel_layer:
        group_name = f"user_{instance.recipient.id}"
        serializer = NotificationSerializer(instance)
        
        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "send_notification",
                    "payload": serializer.data
                }
            )
        except Exception as ws_err:
            print(f"WebSocket send error: {ws_err}")

    # 2. Email — only for transactional types, or social types the
    # recipient has explicitly opted into. See NotificationPreference.should_email.
    if NotificationPreference.should_email(instance):
        subject = f"[EduPath] {instance.title}"
        body = (
            f"Hello {instance.recipient.username},\n\n"
            f"You have received a new notification on EduPath:\n\n"
            f"Type: {instance.get_notification_type_display()}\n"
            f"Message: {instance.message}\n\n"
            f"Log in to the platform to view your notifications.\n\n"
            f"Best regards,\nThe EduPath Team"
        )
        recipient_list = [instance.recipient.email]

        threading.Thread(
            target=_send_email_async,
            args=(subject, body, recipient_list),
            daemon=True
        ).start()


# ── Payment/Enrollment Signals ───────────────────────────────────────────────
@receiver(post_save, sender=Payment)
def handle_payment_status_notifications(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    course = instance.enrollment.course
    # Only notify on status changes
    if instance.status == Payment.StatusChoices.COMPLETED:
        # Notify Student: Payment Success
        student_msg = f"Your payment of ${instance.amount} for '{course.title}' was successful."
        if not Notification.objects.filter(recipient=instance.student, message=student_msg).exists():
            Notification.objects.create(
                recipient=instance.student,
                title="Payment Successful",
                message=student_msg,
                notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
                related_object_id=course.id,
                related_object_type="Course"
            )

        # Notify Mentor: Enrollment
        mentor_msg = f"{instance.student.username} enrolled in your {course.title} course."
        mentor = course.mentor
        if not Notification.objects.filter(recipient=mentor, message=mentor_msg).exists():
            Notification.objects.create(
                recipient=mentor,
                sender=instance.student,
                title="New Enrollment",
                message=mentor_msg,
                notification_type=Notification.NotificationType.ENROLLMENT,
                related_object_id=course.id,
                related_object_type="Course"
            )

    elif instance.status == Payment.StatusChoices.REFUNDED:
        # Notify Student: Refund Processed
        refund_msg = f"Your payment of ${instance.amount} for course '{course.title}' has been refunded."
        if not Notification.objects.filter(recipient=instance.student, message=refund_msg).exists():
            Notification.objects.create(
                recipient=instance.student,
                title="Refund Processed",
                message=refund_msg,
                notification_type=Notification.NotificationType.REFUND_PROCESSED,
                related_object_id=course.id,
                related_object_type="Course"
            )


# ── Lesson Creation Signal ───────────────────────────────────────────────────
@receiver(post_save, sender=Lesson)
def notify_students_new_lesson(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created:
        course = instance.module.course
        # Only notify active enrollments for non-deleted courses
        enrollments = Enrollment.objects.filter(course=course, is_active=True, course__is_deleted=False)
        for enrollment in enrollments:
            lesson_msg = f"A new lesson '{instance.title}' has been added to the course '{course.title}'."
            Notification.objects.create(
                recipient=enrollment.student,
                sender=course.mentor,
                title="New Lesson Added",
                message=lesson_msg,
                notification_type=Notification.NotificationType.LESSON_ADDED,
                related_object_id=course.id,
                related_object_type="Course"
            )


# ── Q&A Replies Signal ───────────────────────────────────────────────────────
@receiver(post_save, sender=ChatMessage)
def notify_qna_reply(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created and instance.parent:
        parent_sender = instance.parent.sender
        if parent_sender != instance.sender:
            reply_msg = f"{instance.sender.username} replied to your question in '{instance.room.course.title}': {instance.message_text[:60]}..."
            Notification.objects.create(
                recipient=parent_sender,
                sender=instance.sender,
                title="New Q&A Reply",
                message=reply_msg,
                notification_type=Notification.NotificationType.QUESTION_REPLY,
                related_object_id=instance.room.course.id,
                related_object_type="Course"
            )


# ── Certificate Generation Signal ─────────────────────────────────────────────
@receiver(post_save, sender=Certificate)
def notify_certificate_generated(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created:
        Notification.objects.create(
            recipient=instance.student,
            title="Certificate Generated",
            message=f"Congratulations! You have completed '{instance.course.title}' and earned a certificate.",
            notification_type=Notification.NotificationType.CERTIFICATE_GENERATED,
            related_object_id=instance.course.id,
            related_object_type="Course"
        )


# ── Review Creation Signal ───────────────────────────────────────────────────
@receiver(post_save, sender=Review)
def notify_mentor_new_review(sender, instance, created, **kwargs):
    if kwargs.get('raw'):
        return
    if created:
        course = instance.course
        Notification.objects.create(
            recipient=course.mentor,
            sender=instance.student,
            title="Student Left Review",
            message=f"{instance.student.username} left a {instance.rating}-star review for your course '{course.title}'.",
            notification_type=Notification.NotificationType.NEW_REVIEW,
            related_object_id=course.id,
            related_object_type="Course"
        )