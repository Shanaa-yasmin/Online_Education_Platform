from django.contrib import admin
from .models import (
    Course, Module, Lesson,
    QuizQuestion, QuizOption, QuizAttempt, QuizAnswer,
    Review, ReviewReport,
)


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
    fields = ['question_text', 'question_type', 'difficulty', 'points', 'order']
    show_change_link = True


class QuizOptionInline(admin.TabularInline):
    model = QuizOption
    extra = 2
    fields = ['text', 'is_correct', 'order']


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
    list_display = ('title', 'module', 'content_type', 'order', 'max_quiz_attempts', 'passing_score_percent')
    list_filter = ('content_type', 'module__course')
    search_fields = ('title', 'body_text', 'module__title', 'module__course__title')
    inlines = [QuizQuestionInline]


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text', 'lesson', 'question_type', 'difficulty', 'points')
    list_filter = ('question_type', 'difficulty', 'lesson__module__course')
    search_fields = ('question_text', 'options__text')
    inlines = [QuizOptionInline]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ('student', 'lesson', 'status', 'score_percent', 'passed', 'attempt_number', 'started_at')
    list_filter = ('status', 'passed', 'lesson__module__course')
    search_fields = ('student__username', 'lesson__title')
    readonly_fields = [f.name for f in QuizAttempt._meta.fields]

    def has_add_permission(self, request):
        # Attempts are only ever created via the quiz-taking API, never manually.
        return False


@admin.register(QuizAnswer)
class QuizAnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question', 'is_correct', 'points_awarded')
    list_filter = ('is_correct',)

    def has_add_permission(self, request):
        return False


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('course', 'student', 'rating', 'is_flagged', 'created_at')
    list_filter = ('rating', 'is_flagged')
    search_fields = ('comment', 'course__title', 'student__username')


@admin.register(ReviewReport)
class ReviewReportAdmin(admin.ModelAdmin):
    list_display = ('review', 'reported_by', 'reason', 'status', 'created_at', 'reviewed_by')
    list_filter = ('status', 'reason', 'created_at')
    search_fields = ('review__comment', 'reported_by__username', 'details')
    raw_id_fields = ('review', 'reported_by', 'reviewed_by')