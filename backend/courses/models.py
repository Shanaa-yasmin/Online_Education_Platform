from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify
from PIL import Image

class Course(models.Model):
    class Level(models.TextChoices):
        BEGINNER = 'BEGINNER', 'Beginner'
        INTERMEDIATE = 'INTERMEDIATE', 'Intermediate'
        ADVANCED = 'ADVANCED', 'Advanced'

    # Fixed thumbnail ratio — 16:9, matches catalog/mentor card display
    THUMBNAIL_SIZE = (800, 450)

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField()
    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_courses',
        limit_choices_to={'role': 'MENTOR'}
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    level = models.CharField(max_length=15, choices=Level.choices, default=Level.BEGINNER)
    language = models.CharField(max_length=50, default='English')
    duration_hours = models.PositiveIntegerField(default=0)
    category = models.CharField(max_length=100, default='Development')
    thumbnail = models.ImageField(upload_to='thumbnails/', null=True, blank=True)

    is_approved = models.BooleanField(default=False)
    is_published = models.BooleanField(default=False)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_submitted_for_review = models.BooleanField(default=False)
    is_rejected = models.BooleanField(default=False)

    @property
    def status(self):
        if self.is_published:
            return 'PUBLISHED'
        if self.is_approved:
            return 'APPROVED'
        if self.is_rejected:
            return 'REJECTED'
        if self.is_submitted_for_review:
            return 'PENDING_APPROVAL'
        return 'DRAFT'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Track the thumbnail's original filename so we only reprocess
        # the image when a *new* file has actually been uploaded.
        self._original_thumbnail_name = self.thumbnail.name if self.thumbnail else None

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)
            slug = base_slug
            counter = 1
            while Course.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug

        is_new = self.pk is None
        thumbnail_changed = bool(self.thumbnail) and (
            is_new or self.thumbnail.name != self._original_thumbnail_name
        )

        super().save(*args, **kwargs)

        if thumbnail_changed:   
            self._process_thumbnail()
            self._original_thumbnail_name = self.thumbnail.name

    def _process_thumbnail(self):
        """Center-crop + resize the uploaded thumbnail to a fixed 16:9 ratio."""
        try:
            img = Image.open(self.thumbnail.path)
        except Exception:
            return  # corrupt/unreadable file — leave as-is, don't crash the save

        img = img.convert('RGB')
        target_w, target_h = self.THUMBNAIL_SIZE
        target_ratio = target_w / target_h

        src_w, src_h = img.size
        src_ratio = src_w / src_h

        # Center-crop to match the target ratio before resizing,
        # so no stretching/squashing occurs.
        if src_ratio > target_ratio:
            new_w = round(target_ratio * src_h)
            left = (src_w - new_w) // 2
            img = img.crop((left, 0, left + new_w, src_h))
        else:
            new_h = round(src_w / target_ratio)
            top = (src_h - new_h) // 2
            img = img.crop((0, top, src_w, top + new_h))

        img = img.resize(self.THUMBNAIL_SIZE, Image.LANCZOS)
        img.save(self.thumbnail.path, quality=85, optimize=True)


class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class Lesson(models.Model):
    class ContentType(models.TextChoices):
        VIDEO = 'VIDEO', 'Video'
        PDF = 'PDF', 'PDF Document'
        DOCUMENT = 'DOCUMENT', 'Rich Text Document'
        QUIZ = 'QUIZ', 'Quiz'

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=15, choices=ContentType.choices)

    video_url = models.CharField(max_length=500, blank=True, null=True)
    file_attachment = models.FileField(upload_to='lessons/', blank=True, null=True)
    body_text = models.TextField(blank=True, null=True)

    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.module.title} - {self.title}"


class QuizQuestion(models.Model):
    class CorrectOptionChoices(models.TextChoices):
        A = 'A', 'Option A'
        B = 'B', 'Option B'
        C = 'C', 'Option C'
        D = 'D', 'Option D'

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='quiz_questions',
        limit_choices_to={'content_type': 'QUIZ'}
    )
    question_text = models.TextField()
    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)
    correct_option = models.CharField(max_length=1, choices=CorrectOptionChoices.choices)

    def __str__(self):
        return f"Question in {self.lesson.title}: {self.question_text[:30]}"


class Review(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='reviews')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField()
    is_flagged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('course', 'student')

    def __str__(self):
        return f"Review by {self.student.username} for {self.course.title}"


from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Avg, Count

@receiver([post_save, post_delete], sender=Review)
def update_course_rating_stats(sender, instance, **kwargs):
    course = instance.course
    stats = course.reviews.aggregate(avg=Avg('rating'), total=Count('id'))
    course.rating_average = round(stats['avg'], 2) if stats['avg'] is not None else 0.00
    course.total_reviews = stats['total']
    course.save(update_fields=['rating_average', 'total_reviews'])