from django.contrib import admin
from .models import LessonProgress, CourseProgress


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display  = ('student', 'lesson', 'is_completed', 'completed_at')
    list_filter   = ('is_completed', 'lesson__module__course')
    search_fields = ('student__username', 'lesson__title')
    readonly_fields = ('completed_at',)


@admin.register(CourseProgress)
class CourseProgressAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'completion_percentage', 'completed', 'updated_at')
    list_filter = ('completed', 'course')
    search_fields = ('student__username', 'course__title')
    readonly_fields = ('updated_at',)
