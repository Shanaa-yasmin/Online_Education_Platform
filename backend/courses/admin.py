from django.contrib import admin
from .models import Course, Module, Lesson, QuizQuestion, Review

class LessonInline(admin.StackedInline):
    model = Lesson
    extra = 1
    show_change_link = True

class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1
    show_change_link = True

class QuizQuestionInline(admin.TabularInline):
    model = QuizQuestion
    extra = 1

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'mentor', 'price', 'level', 'is_approved', 'is_published', 'created_at')
    list_filter = ('is_approved', 'is_published', 'level', 'language')
    search_fields = ('title', 'description', 'mentor__username', 'mentor__email')
    inlines = [ModuleInline]
    actions = ['approve_courses', 'unapprove_courses']

    @admin.action(description='Approve selected courses')
    def approve_courses(self, request, queryset):
        updated = queryset.update(is_approved=True)
        self.message_user(request, f"Successfully approved {updated} course(s).")

    @admin.action(description='Revoke approval for selected courses')
    def unapprove_courses(self, request, queryset):
        updated = queryset.update(is_approved=False, is_published=False)
        self.message_user(request, f"Successfully revoked approval and unpublished {updated} course(s).")


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order')
    list_filter = ('course',)
    search_fields = ('title', 'course__title')
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'content_type', 'order')
    list_filter = ('content_type', 'module__course')
    search_fields = ('title', 'body_text', 'module__title', 'module__course__title')
    inlines = [QuizQuestionInline]


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text', 'lesson', 'correct_option')
    list_filter = ('lesson__module__course',)
    search_fields = ('question_text', 'option_a', 'option_b', 'option_c', 'option_d')


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('course', 'student', 'rating', 'is_flagged', 'created_at')
    list_filter = ('rating', 'is_flagged')
    search_fields = ('comment', 'course__title', 'student__username')
