from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify

class Course(models.Model):
    class Level(models.TextChoices):
        BEGINNER = 'BEGINNER', 'Beginner'
        INTERMEDIATE = 'INTERMEDIATE', 'Intermediate'
        ADVANCED = 'ADVANCED', 'Advanced'

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
    duration_hours = models.PositiveIntegerField(default=0)  # Total course duration estimate
    thumbnail = models.ImageField(upload_to='thumbnails/', null=True, blank=True)
    
    # Moderation & Publishing workflow
    is_approved = models.BooleanField(default=False)  # Controlled by Admin
    is_published = models.BooleanField(default=False)  # Controlled by Mentor
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        super().save(*args, **kwargs)


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
    
    # Fields for different content types
    video_url = models.CharField(max_length=500, blank=True, null=True)  # Secure stream URL
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
    is_flagged = models.BooleanField(default=False)  # Admin content moderation flag
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Constraint to ensure a student writes only one review per course
        unique_together = ('course', 'student')

    def __str__(self):
        return f"Review by {self.student.username} for {self.course.title}"
