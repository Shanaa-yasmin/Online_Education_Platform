from django.contrib import admin
from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display  = ('certificate_code', 'student', 'course', 'issued_at')
    list_filter   = ('course',)
    search_fields = ('certificate_code', 'student__username', 'course__title')
    readonly_fields = ('certificate_code', 'issued_at')
