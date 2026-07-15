from django.db import models
from django.conf import settings
from django.utils import timezone
from courses.models import Course

class AnnouncementQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(is_deleted=False)

class AnnouncementManager(models.Manager):
    def get_queryset(self):
        return AnnouncementQuerySet(self.model, using=self._db).filter(is_deleted=False)

class Announcement(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcements'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='announcements',
        null=True,
        blank=True
    )
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = AnnouncementManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def __str__(self):
        return f"{self.title} (by {self.created_by.username})"
