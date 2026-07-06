from django.db import models
from django.conf import settings
from courses.models import Course


class Enrollment(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments',
        limit_choices_to={'role': 'STUDENT'}
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    # True = Active, False = Revoked (refunded, disputed, or payment pending)
    is_active = models.BooleanField(default=True)
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('student', 'course')

    def __str__(self):
        status = "Active" if self.is_active else "Revoked"
        return f"{self.student.username} enrolled in {self.course.title} ({status})"


class Payment(models.Model):
    class GatewayChoices(models.TextChoices):
        STRIPE = 'STRIPE', 'Stripe'
        PAYPAL = 'PAYPAL', 'PayPal'

    class StatusChoices(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED    = 'FAILED',    'Failed'
        REFUNDED  = 'REFUNDED',  'Refunded'
        DISPUTED  = 'DISPUTED',  'Disputed'   # NEW — chargeback / dispute opened

    enrollment    = models.ForeignKey(Enrollment, on_delete=models.CASCADE, related_name='payments')
    student       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    gateway       = models.CharField(max_length=10, choices=GatewayChoices.choices)
    transaction_id = models.CharField(max_length=255, unique=True)
    amount        = models.DecimalField(max_digits=10, decimal_places=2)
    status        = models.CharField(
        max_length=15, choices=StatusChoices.choices, default=StatusChoices.PENDING
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    refunded_at   = models.DateTimeField(null=True, blank=True)
    disputed_at   = models.DateTimeField(null=True, blank=True)
    dispute_detail = models.TextField(blank=True, default='')   # JSON / text log from gateway

    def __str__(self):
        return f"Payment {self.transaction_id} - {self.status} (${self.amount})"