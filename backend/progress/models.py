from django.db import models
from django.conf import settings
from django.utils import timezone
from courses.models import Course, Lesson


class LessonProgress(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='lesson_progresses'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lesson_progresses', null=True, blank=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progresses')
    completed = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    video_position_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_accessed = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('student', 'lesson')

    def __str__(self):
        status = "Completed" if self.completed else "In Progress"
        return f"{self.student.username} - {self.lesson.title} ({status})"

    def save(self, *args, **kwargs):
        if not self.course and self.lesson:
            self.course = self.lesson.module.course
        if self.completed != self.is_completed:
            self.is_completed = self.completed
        super().save(*args, **kwargs)


class CourseProgress(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='course_progresses'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='progresses')
    completed_lessons = models.PositiveIntegerField(default=0)
    total_lessons = models.PositiveIntegerField(default=0)
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    completed = models.BooleanField(default=False)
    certificate_eligible = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'course')

    def __str__(self):
        return f"{self.student.username} - {self.course.title} ({self.completion_percentage}%)"


# Signals for automatic progress recalculation
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)

def recalculate_course_progress(student, course):
    total_lessons = Lesson.objects.filter(module__course=course).count()
    completed_lessons = LessonProgress.objects.filter(
        student=student,
        lesson__module__course=course,
        completed=True
    ).count()

    completion_percentage = 0.00
    if total_lessons > 0:
        completion_percentage = round((completed_lessons / total_lessons) * 100, 2)

    completed = (completion_percentage >= 100.00)
    certificate_eligible = completed

    course_progress, created = CourseProgress.objects.get_or_create(
        student=student,
        course=course,
        defaults={
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'completion_percentage': completion_percentage,
            'completed': completed,
            'certificate_eligible': certificate_eligible
        }
    )

    if not created:
        course_progress.total_lessons = total_lessons
        course_progress.completed_lessons = completed_lessons
        course_progress.completion_percentage = completion_percentage
        course_progress.completed = completed
        course_progress.certificate_eligible = certificate_eligible
        course_progress.save()

    # Also sync to the Enrollment.progress_percent
    from payments.models import Enrollment
    enrollment = Enrollment.objects.filter(student=student, course=course).first()
    if enrollment:
        enrollment.progress_percent = completion_percentage
        enrollment.save(update_fields=['progress_percent'])

        if completed:
            # Generate certificate if not already issued
            from certificates.utils import generate_certificate_pdf
            try:
                generate_certificate_pdf(enrollment)
            except Exception as exc:
                logger.error(
                    "[Certificate] Auto-generation error for enrollment %s: %s",
                    enrollment.id, exc,
                )

            # Generate notification
            from notifications.models import Notification
            msg = f"Congratulations! You have completed '{course.title}' and earned a certificate."
            if not Notification.objects.filter(recipient=student, message=msg).exists():
                Notification.objects.create(
                    recipient=student,
                    title="Course Completed",
                    message=msg,
                    notification_type=Notification.NotificationType.CERTIFICATE_GENERATED,
                    related_object_id=course.id,
                    related_object_type="Course"
                )

@receiver(post_save, sender=LessonProgress)
def update_course_progress_on_lesson_save(sender, instance, **kwargs):
    recalculate_course_progress(instance.student, instance.course or instance.lesson.module.course)
