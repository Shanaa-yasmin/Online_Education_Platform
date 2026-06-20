from django.contrib import admin
from .models import Enrollment, Payment, LessonProgress, Certificate


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'progress_percent', 'is_active', 'enrolled_at')
    list_filter = ('is_active', 'course')
    search_fields = ('student__username', 'student__email', 'course__title')
    readonly_fields = ('enrolled_at',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'student', 'amount', 'gateway', 'status', 'created_at')
    list_filter = ('status', 'gateway')
    search_fields = ('transaction_id', 'student__username', 'student__email')
    readonly_fields = ('created_at',)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('student', 'lesson', 'is_completed', 'completed_at')
    list_filter = ('is_completed', 'lesson__module__course')
    search_fields = ('student__username', 'lesson__title')
    readonly_fields = ('completed_at',)


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('certificate_code', 'student', 'course', 'issued_at')
    list_filter = ('course',)
    search_fields = ('certificate_code', 'student__username', 'course__title')
    readonly_fields = ('certificate_code', 'issued_at')
