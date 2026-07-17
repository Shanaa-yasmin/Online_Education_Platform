from django.db import models
from django.conf import settings
from courses.models import Course
from django.core.files.storage import default_storage 
from payments.models import Enrollment


def get_certificate_storage():
    if getattr(settings, 'USE_CLOUDINARY', False):
        from cloudinary_storage.storage import RawMediaCloudinaryStorage
        return RawMediaCloudinaryStorage()
    return default_storage

class Certificate(models.Model):
    """Completion certificate issued when a student finishes 100% of a course."""
    enrollment = models.OneToOneField(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='certificate'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='certificates'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='certificates')
    certificate_code = models.CharField(max_length=100, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    pdf_file  = models.FileField(
        upload_to='certificates/',
        storage=get_certificate_storage,
        null=True,
        blank=True
    )

    class Meta:
        unique_together = ('student', 'course')

    def __str__(self):
        return f"Certificate {self.certificate_code} — {self.student.username} / {self.course.title}"
