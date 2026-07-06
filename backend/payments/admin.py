from django.contrib import admin
from .models import Enrollment, Payment


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display  = ('student', 'course', 'progress_percent', 'is_active', 'enrolled_at')
    list_filter   = ('is_active', 'course')
    search_fields = ('student__username', 'student__email', 'course__title')
    readonly_fields = ('enrolled_at',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ('transaction_id', 'student', 'amount', 'gateway', 'status', 'created_at')
    list_filter   = ('status', 'gateway')
    search_fields = ('transaction_id', 'student__username', 'student__email')
    readonly_fields = ('created_at',)
    # Expose dispute tracking in detail view
    fieldsets = (
        (None, {
            'fields': (
                'enrollment', 'student', 'gateway', 'transaction_id',
                'amount', 'status', 'created_at',
            )
        }),
        ('Refund', {
            'fields': ('refunded_at',),
            'classes': ('collapse',),
        }),
        ('Dispute', {
            'fields': ('disputed_at', 'dispute_detail'),
            'classes': ('collapse',),
        }),
    )