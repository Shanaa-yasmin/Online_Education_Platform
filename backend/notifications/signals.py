import threading
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)


def _send_email_async(subject, body, recipient_list, is_priority=False):
    """
    Runs the actual send_mail call on a background thread so a slow SMTP
    call never adds latency to the request that triggered the notification.
    Includes robust SSL fallback handling for Python SSL certificate environments.
    """
    try:
        from django.conf import settings
        logger.info(f"[EMAIL DEBUG] Using DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
        logger.info(f"[EMAIL QUEUE] Attempting to send email to {recipient_list} (Subject: {subject})")
        
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=None,  # Uses DEFAULT_FROM_EMAIL from settings
                recipient_list=recipient_list,
                fail_silently=False
            )
        except Exception as smtp_err:
            logger.warning(f"[EMAIL WARN] Standard send_mail failed: {smtp_err}. Retrying with SSL context fallback...")
            if getattr(settings, 'EMAIL_HOST', None):
                import ssl, smtplib
                from email.message import EmailMessage
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                
                for recipient in recipient_list:
                    msg = EmailMessage()
                    msg['Subject'] = subject
                    msg['From'] = settings.DEFAULT_FROM_EMAIL
                    msg['To'] = recipient
                    msg.set_content(body)
                    
                    use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
                    port = getattr(settings, 'EMAIL_PORT', 465)
                    host = settings.EMAIL_HOST
                    
                    if use_ssl or port == 465:
                        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as server:
                            if settings.EMAIL_HOST_USER:
                                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                            server.send_message(msg)
                    else:
                        with smtplib.SMTP(host, port, timeout=15) as server:
                            if getattr(settings, 'EMAIL_USE_TLS', False):
                                server.starttls(context=ctx)
                            if settings.EMAIL_HOST_USER:
                                server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
                            server.send_message(msg)
            else:
                raise smtp_err

        logger.info(f"[EMAIL SUCCESS] Email successfully sent to {recipient_list}")
    except Exception as e:
        logger.error(f"[EMAIL FAILED] Error sending email to {recipient_list}: {e}")
    finally:
        connection.close()

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
            logger.error(f"WebSocket send error: {ws_err}")

    # 2. Email — only for transactional types.
    if instance.should_email:
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
        is_priority = True

        logger.info(f"[NOTIFICATION] should_email=True for {instance.notification_type}, starting email thread.")
        threading.Thread(
            target=_send_email_async,
            args=(subject, body, recipient_list, is_priority),
            daemon=True
        ).start()
    else:
        logger.info(f"[NOTIFICATION] should_email=False for {instance.notification_type}. Skipping email.")


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
        enrollments = Enrollment.objects.filter(course=course, is_active=True, course__is_deleted=False).select_related('student')
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