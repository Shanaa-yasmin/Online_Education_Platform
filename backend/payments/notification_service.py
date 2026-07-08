"""
payments/notification_service.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Notification helpers for payment / enrollment / refund events.
Centralizes the "notify student + mentor + admins" pattern that used to
be duplicated across the ViewSets and webhook handlers.
"""

import logging

from django.contrib.auth import get_user_model

from notifications.models import Notification

logger = logging.getLogger(__name__)

User = get_user_model()


def notify_admins(title, message, sender=None, notification_type=Notification.NotificationType.SYSTEM,
                   related_object_id=None, related_object_type=None):
    """Send a notification to every admin/staff user."""
    admins = User.objects.filter(is_staff=True) | User.objects.filter(role='ADMIN')
    admins = admins.distinct()
    for admin in admins:
        Notification.objects.create(
            recipient=admin,
            sender=sender,
            title=title,
            message=message,
            notification_type=notification_type,
            related_object_id=related_object_id,
            related_object_type=related_object_type,
        )


def notify_payment_success(payment):
    """Notify the student, the course mentor, and all admins of a successful payment."""
    enrollment = payment.enrollment
    course = enrollment.course
    student = enrollment.student

    Notification.objects.create(
        recipient=student,
        sender=course.mentor,
        title="Payment Successful",
        message=f"Your payment for '{course.title}' was successful. You're enrolled!",
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )

    Notification.objects.create(
        recipient=course.mentor,
        sender=student,
        title="New Course Sale",
        message=f"{student.username} just purchased '{course.title}' for ${payment.amount}.",
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )

    notify_admins(
        title="New Course Sale",
        message=f"{student.username} purchased '{course.title}' (mentor: {course.mentor.username}) for ${payment.amount}.",
        sender=student,
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        related_object_id=course.id,
        related_object_type="Course",
    )


def notify_refund_processed(payment, refunded_by=None):
    """Notify the student, the course mentor, and all admins that a payment was refunded."""
    enrollment = payment.enrollment
    course = enrollment.course
    student = enrollment.student

    Notification.objects.create(
        recipient=student,
        sender=refunded_by or course.mentor,
        title="Refund Processed",
        message=f"Your payment for '{course.title}' has been refunded. Access has been revoked.",
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )

    Notification.objects.create(
        recipient=course.mentor,
        sender=refunded_by,
        title="Course Sale Refunded",
        message=f"A payment from {student.username} for '{course.title}' was refunded (${payment.amount}).",
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )

    notify_admins(
        title="Course Sale Refunded",
        message=f"Payment from {student.username} for '{course.title}' (mentor: {course.mentor.username}) was refunded (${payment.amount}).",
        sender=refunded_by,
        notification_type=Notification.NotificationType.REFUND_PROCESSED,
        related_object_id=course.id,
        related_object_type="Course",
    )


def notify_free_enrollment(user, course):
    """Notify the student, course mentor, and admins of a new free-course enrollment."""
    Notification.objects.create(
        recipient=user,
        sender=course.mentor,
        title="Enrollment Confirmed",
        message=f"You have successfully enrolled in '{course.title}'.",
        notification_type=Notification.NotificationType.ENROLLMENT,
        related_object_id=course.id,
        related_object_type="Course",
    )

    Notification.objects.create(
        recipient=course.mentor,
        sender=user,
        title="New Student Enrolled",
        message=f"{user.username} enrolled in '{course.title}' (free course).",
        notification_type=Notification.NotificationType.ENROLLMENT,
        related_object_id=course.id,
        related_object_type="Course",
    )

    notify_admins(
        title="New Student Enrolled",
        message=f"{user.username} enrolled in '{course.title}' (mentor: {course.mentor.username}).",
        sender=user,
        notification_type=Notification.NotificationType.ENROLLMENT,
        related_object_id=course.id,
        related_object_type="Course",
    )
