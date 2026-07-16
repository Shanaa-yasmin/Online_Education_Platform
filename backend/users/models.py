from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.validators import RegexValidator
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    username_validator = RegexValidator(
        regex=r'^[a-zA-Z0-9._]+\Z',
        message=_(
            "Enter a valid username. This value may contain only letters, "
            "numbers, and . or _ characters."
        ),
        code="invalid_username",
    )

    username = models.CharField(
        _("username"),
        max_length=150,
        unique=True,
        help_text=_(
            "Required. 150 characters or fewer. Letters, numbers and . or _ only."
        ),
        validators=[username_validator],
        error_messages={
            "unique": _("A user with that username already exists."),
        },
    )

    class Role(models.TextChoices):
        STUDENT = 'STUDENT', 'Student'
        MENTOR = 'MENTOR', 'Mentor'
        ADMIN = 'ADMIN', 'Admin'

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.STUDENT
    )
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    profile_complete = models.BooleanField(default=False)

    # Make email unique and required, username remains the login key for now, 
    # but we will support email login as well.
    REQUIRED_FIELDS = ['email', 'role']

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT

    @property
    def is_mentor(self):
        return self.role == self.Role.MENTOR

    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN or self.is_superuser


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True, default='')
    
    # Additional contact info
    phone_number = models.CharField(max_length=20, blank=True, default='')
    website = models.URLField(blank=True, default='')
    location = models.CharField(max_length=150, blank=True, default='')

    # Student specific fields
    date_of_birth = models.DateField(null=True, blank=True)
    education_level = models.CharField(max_length=50, blank=True, default='')
    areas_of_interest = models.JSONField(default=list)

    # Mentor specific fields
    title = models.CharField(max_length=100, blank=True, default='')
    skills = models.CharField(max_length=255, blank=True, default='')
    years_of_experience = models.PositiveIntegerField(default=0)
    areas_of_expertise = models.JSONField(default=list)
    resume = models.FileField(upload_to='resumes/', null=True, blank=True)
    is_approved = models.BooleanField(default=False)  # Admins approve Mentors
    is_suspended = models.BooleanField(default=False)  # Admins can suspend users

    def __str__(self):
        return f"{self.user.username}'s Profile ({self.user.role})"


# Django signals to auto-create Profile when a User is registered
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
