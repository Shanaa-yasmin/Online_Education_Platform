from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from PIL import Image
import io

class CourseQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(is_deleted=False)

class CourseManager(models.Manager):
    def get_queryset(self):
        return CourseQuerySet(self.model, using=self._db).filter(is_deleted=False)

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

    is_approved = models.BooleanField(default=False, db_index=True)
    is_published = models.BooleanField(default=False, db_index=True)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_submitted_for_review = models.BooleanField(default=False)
    is_rejected = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = CourseManager()          # default — excludes deleted
    all_objects = models.Manager()     # explicit escape hatch when you need deleted rows too

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

        if thumbnail_changed:
            self._process_thumbnail()

        super().save(*args, **kwargs)
        self._original_thumbnail_name = self.thumbnail.name if self.thumbnail else None

    def _process_thumbnail(self):
        """Center-crop + resize the uploaded thumbnail to a fixed 16:9 ratio in-memory.

        Modifies the file object before it is uploaded to the storage backend (Cloudinary or local).
        """
        if not self.thumbnail:
            return
        try:
            import os
            from django.core.files.uploadedfile import InMemoryUploadedFile
            
            with self.thumbnail.open('rb') as f:
                img = Image.open(f)
                img.load()  # force decode before the file handle closes
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

        # Write processed image back to memory
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)

        filename = self.thumbnail.name
        if not filename.lower().endswith(('.jpg', '.jpeg')):
            filename = os.path.splitext(filename)[0] + '.jpg'

        # Wrap in Django InMemoryUploadedFile and assign to self.thumbnail
        self.thumbnail = InMemoryUploadedFile(
            file=buffer,
            field_name='thumbnail',
            name=filename,
            content_type='image/jpeg',
            size=buffer.getbuffer().nbytes,
            charset=None
        )


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

    # ── Quiz-level settings (only meaningful when content_type == QUIZ) ──
    max_quiz_attempts = models.PositiveIntegerField(
        default=0, help_text="Maximum submitted attempts allowed. 0 = unlimited."
    )
    passing_score_percent = models.PositiveIntegerField(
        default=70, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    quiz_time_limit_minutes = models.PositiveIntegerField(
        default=0, help_text="Time allowed per attempt, in minutes. 0 = no limit."
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.module.title} - {self.title}"


class QuizQuestion(models.Model):
    class QuestionType(models.TextChoices):
        SINGLE_CHOICE = 'SINGLE_CHOICE', 'Single Choice'
        MULTIPLE_CHOICE = 'MULTIPLE_CHOICE', 'Multiple Choice'
        TRUE_FALSE = 'TRUE_FALSE', 'True / False'
        FILL_BLANK = 'FILL_BLANK', 'Fill in the Blank'

    class Difficulty(models.TextChoices):
        EASY = 'EASY', 'Easy'
        MEDIUM = 'MEDIUM', 'Medium'
        HARD = 'HARD', 'Hard'

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='quiz_questions',
        limit_choices_to={'content_type': 'QUIZ'}
    )
    question_type = models.CharField(
        max_length=20, choices=QuestionType.choices, default=QuestionType.SINGLE_CHOICE
    )
    question_text = models.TextField()
    explanation = models.TextField(
        blank=True, null=True,
        help_text="Shown to the student after they answer, regardless of correctness."
    )
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    points = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)

    # Only used when question_type == FILL_BLANK
    correct_text_answer = models.CharField(max_length=255, blank=True, null=True)
    case_sensitive = models.BooleanField(default=False)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"[{self.get_question_type_display()}] {self.question_text[:40]}"

    def clean(self):
        if self.question_type == self.QuestionType.FILL_BLANK and not self.correct_text_answer:
            raise ValidationError({"correct_text_answer": "Required for fill-in-the-blank questions."})

    def check_text_answer(self, submitted_text):
        """Used for FILL_BLANK grading."""
        if submitted_text is None:
            return False
        correct = self.correct_text_answer or ''
        submitted = submitted_text
        if not self.case_sensitive:
            correct = correct.strip().lower()
            submitted = submitted.strip().lower()
        else:
            correct = correct.strip()
            submitted = submitted.strip()
        return correct == submitted


class QuizOption(models.Model):
    """
    Replaces the old fixed option_a..option_d columns. A variable number of
    options per question is what makes multi-select and true/false possible,
    and lets mentors add/remove options freely.
    """
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.text} ({'correct' if self.is_correct else 'incorrect'})"


class QuizAttempt(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SUBMITTED = 'SUBMITTED', 'Submitted'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quiz_attempts'
    )
    lesson = models.ForeignKey(
        Lesson, on_delete=models.CASCADE, related_name='quiz_attempts',
        limit_choices_to={'content_type': 'QUIZ'}
    )
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    score_points = models.PositiveIntegerField(default=0)
    total_points = models.PositiveIntegerField(default=0)
    score_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    passed = models.BooleanField(default=False)
    attempt_number = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['lesson', 'student', 'status']),
        ]

    def __str__(self):
        return f"Attempt #{self.attempt_number} by {self.student.username} on {self.lesson.title}"


class QuizAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name='student_answers')

    # Used for SINGLE_CHOICE / MULTIPLE_CHOICE / TRUE_FALSE
    selected_options = models.ManyToManyField(QuizOption, blank=True, related_name='selected_in_answers')
    # Used for FILL_BLANK
    text_answer = models.CharField(max_length=255, blank=True, null=True)

    is_correct = models.BooleanField(default=False)
    points_awarded = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('attempt', 'question')

    def __str__(self):
        return f"Answer to Q{self.question_id} in attempt {self.attempt_id}"


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
    stats = course.reviews.filter(is_flagged=False).aggregate(avg=Avg('rating'), total=Count('id'))
    course.rating_average = round(stats['avg'], 2) if stats['avg'] is not None else 0.00
    course.total_reviews = stats['total']
    course.save(update_fields=['rating_average', 'total_reviews'])


class ReviewReport(models.Model):
    class ReasonChoices(models.TextChoices):
        SPAM = 'SPAM', 'Spam'
        HARASSMENT = 'HARASSMENT', 'Harassment'
        OFFENSIVE_LANGUAGE = 'OFFENSIVE_LANGUAGE', 'Offensive Language'
        FAKE_REVIEW = 'FAKE_REVIEW', 'Fake Review'
        OTHER = 'OTHER', 'Other'

    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        REVIEWED = 'REVIEWED', 'Reviewed'
        DISMISSED = 'DISMISSED', 'Dismissed'

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reported_reviews')
    reason = models.CharField(max_length=30, choices=ReasonChoices.choices, default=ReasonChoices.SPAM)
    details = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='actioned_reports',
        null=True,
        blank=True
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('review', 'reported_by')
        ordering = ['-created_at']

    def __str__(self):
        return f"Report on Review {self.review_id} by {self.reported_by.username} ({self.status})"