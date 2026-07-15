from django.contrib import admin
from .models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_by', 'course', 'is_pinned', 'is_deleted', 'created_at']
    list_filter = ['is_pinned', 'is_deleted', 'created_at']
    search_fields = ['title', 'content', 'created_by__username']
    readonly_fields = ['created_at', 'deleted_at']
    raw_id_fields = ['created_by', 'course']

    def get_queryset(self, request):
        # Show all objects including soft-deleted in admin
        return Announcement.all_objects.all()
