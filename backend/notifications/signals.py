from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Notification
from .serializers import NotificationSerializer

# Import external models safely
from payments.models import Payment, Enrollment
from courses.models import Lesson
from chat.models import ChatMessage

@receiver(post_save, sender=Notification)
def send_realtime_and_email_notification(sender, instance, created, **kwargs):
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

    # 2. Dispatch mock email
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


# ── Payment/Enrollment Signals ───────────────────────────────────────────────
@receiver(post_save, sender=Payment)
def handle_payment_status_notifications(sender, instance, created, **kwargs):
    # Only notify on status changes
    if instance.status == Payment.StatusChoices.COMPLETED:
        # Enforce unique notification checks to avoid duplication
        # Notify Student
        student_msg = f"You have successfully enrolled in '{instance.enrollment.course.title}'. Start learning today!"
        if not Notification.objects.filter(recipient=instance.student, message=student_msg).exists():
            Notification.objects.create(
                recipient=instance.student,
                title="Enrollment Confirmed",
                message=student_msg,
                notification_type=Notification.NotificationType.ENROLLMENT
            )

        # Notify Mentor
        mentor_msg = f"Student {instance.student.username} has enrolled in your course '{instance.enrollment.course.title}'."
        mentor = instance.enrollment.course.mentor
        if not Notification.objects.filter(recipient=mentor, message=mentor_msg).exists():
            Notification.objects.create(
                recipient=mentor,
                title="New Student Enrolled",
                message=mentor_msg,
                notification_type=Notification.NotificationType.ENROLLMENT
            )

    elif instance.status == Payment.StatusChoices.REFUNDED:
        refund_msg = f"Your payment of ${instance.amount} for course '{instance.enrollment.course.title}' has been refunded."
        if not Notification.objects.filter(recipient=instance.student, message=refund_msg).exists():
            Notification.objects.create(
                recipient=instance.student,
                title="Payment Refunded",
                message=refund_msg,
                notification_type=Notification.NotificationType.REFUND
            )


# ── Lesson Creation Signal ───────────────────────────────────────────────────
@receiver(post_save, sender=Lesson)
def notify_students_new_lesson(sender, instance, created, **kwargs):
    if created:
        course = instance.module.course
        enrollments = Enrollment.objects.filter(course=course, is_active=True)
        for enrollment in enrollments:
            lesson_msg = f"A new lesson '{instance.title}' has been added to the course '{course.title}'."
            Notification.objects.create(
                recipient=enrollment.student,
                title="New Lesson Added",
                message=lesson_msg,
                notification_type=Notification.NotificationType.LESSON_ADDED
            )


# ── Q&A Replies Signal ───────────────────────────────────────────────────────
@receiver(post_save, sender=ChatMessage)
def notify_qna_reply(sender, instance, created, **kwargs):
    if created and instance.parent:
        parent_sender = instance.parent.sender
        if parent_sender != instance.sender:
            reply_msg = f"{instance.sender.username} replied to your question in '{instance.room.course.title}': {instance.message_text[:60]}..."
            Notification.objects.create(
                recipient=parent_sender,
                title="New Q&A Reply",
                message=reply_msg,
                notification_type=Notification.NotificationType.QNA_REPLY
            )
