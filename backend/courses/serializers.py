from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Course, Module, Lesson,
    QuizQuestion, QuizOption, QuizAttempt, QuizAnswer,
    Review, ReviewReport
)

User = get_user_model()


class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']


# ─────────────────────────── Quiz authoring ───────────────────────────

class QuizOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizOption
        fields = ['id', 'text', 'is_correct', 'order']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # `show_correct_answers` is injected by QuizQuestionSerializer based on
        # whether the requester is the course mentor/an admin.
        if not self.context.get('show_correct_answers'):
            ret.pop('is_correct', None)
        return ret


class QuizQuestionSerializer(serializers.ModelSerializer):
    options = QuizOptionSerializer(many=True, required=False)

    class Meta:
        model = QuizQuestion
        fields = [
            'id', 'lesson', 'question_type', 'question_text', 'explanation',
            'difficulty', 'points', 'order', 'correct_text_answer', 'case_sensitive', 'options'
        ]

    def _is_privileged(self, request, instance):
        if not (request and request.user and request.user.is_authenticated):
            return False
        user = request.user
        course = instance.lesson.module.course
        return (course.mentor == user) or user.is_staff or user.role == 'ADMIN'

    def to_representation(self, instance):
        request = self.context.get('request')
        is_privileged = self._is_privileged(request, instance)

        # Feed into nested QuizOptionSerializer instances via context
        self.context['show_correct_answers'] = is_privileged
        ret = super().to_representation(instance)

        # Students/anonymous users never see the answer key or the explanation
        # up front — explanation is only released once they've submitted an
        # answer (see QuizAnswerResultSerializer).
        if not is_privileged:
            ret.pop('correct_text_answer', None)
            ret.pop('case_sensitive', None)
            ret.pop('explanation', None)

        return ret

    def validate(self, attrs):
        qtype = attrs.get('question_type', getattr(self.instance, 'question_type', None))
        options = attrs.get('options')

        if qtype == QuizQuestion.QuestionType.FILL_BLANK:
            has_existing_answer = self.instance and self.instance.correct_text_answer
            if not attrs.get('correct_text_answer') and not has_existing_answer:
                raise serializers.ValidationError(
                    {"correct_text_answer": "Required for fill-in-the-blank questions."}
                )
        elif options is not None:
            correct_count = sum(1 for o in options if o.get('is_correct'))
            if len(options) < 2:
                raise serializers.ValidationError({"options": "Provide at least 2 options."})
            if correct_count == 0:
                raise serializers.ValidationError({"options": "At least one option must be marked correct."})
            if qtype == QuizQuestion.QuestionType.SINGLE_CHOICE and correct_count > 1:
                raise serializers.ValidationError(
                    {"options": "Single choice questions must have exactly one correct option."}
                )
            if qtype == QuizQuestion.QuestionType.TRUE_FALSE and len(options) != 2:
                raise serializers.ValidationError(
                    {"options": "True/False questions must have exactly 2 options."}
                )
        return attrs

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])
        question = QuizQuestion.objects.create(**validated_data)
        self._save_options(question, options_data)
        return question

    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if options_data is not None:
            instance.options.all().delete()
            self._save_options(instance, options_data)
        return instance

    @staticmethod
    def _save_options(question, options_data):
        for i, opt in enumerate(options_data):
            QuizOption.objects.create(
                question=question,
                order=opt.get('order', i),
                text=opt['text'],
                is_correct=opt.get('is_correct', False),
            )


# ─────────────────────────── Lesson / Module ───────────────────────────

class LessonSerializer(serializers.ModelSerializer):
    quiz_questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = [
            'id', 'module', 'title', 'content_type', 'video_url', 'file_attachment',
            'body_text', 'order', 'quiz_questions',
            'max_quiz_attempts', 'passing_score_percent', 'quiz_time_limit_minutes',
        ]

    def validate(self, attrs):
        content_type = attrs.get('content_type')
        # Validate that appropriate content fields are provided for the content type
        if content_type == Lesson.ContentType.VIDEO and not attrs.get('video_url') and not self.instance:
            raise serializers.ValidationError({"video_url": "Video URL is required for Video lessons."})
        if content_type == Lesson.ContentType.PDF and not attrs.get('file_attachment') and not self.instance:
            raise serializers.ValidationError({"file_attachment": "File attachment is required for PDF lessons."})
        if content_type == Lesson.ContentType.DOCUMENT and not attrs.get('body_text') and not self.instance:
            raise serializers.ValidationError({"body_text": "Body text is required for Rich Text Document lessons."})
        return attrs


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'course', 'title', 'order', 'lessons']


# ─────────────────────────── Course ───────────────────────────

class CourseListSerializer(serializers.ModelSerializer):
    mentor = UserMiniSerializer(read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'mentor', 'price',
            'level', 'language', 'duration_hours', 'category', 'thumbnail',
            'is_approved', 'is_published', 'rating_average', 'total_reviews'
        ]


class CourseSerializer(serializers.ModelSerializer):
    mentor = UserMiniSerializer(read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'mentor', 'price',
            'level', 'language', 'duration_hours', 'category', 'thumbnail',
            'is_approved', 'is_published','is_submitted_for_review', 'is_rejected', 'created_at', 'updated_at',
            'modules', 'rating_average', 'total_reviews'
        ]
        read_only_fields = ['is_approved']

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be a negative value.")
        return value


class CourseSearchSerializer(serializers.ModelSerializer):
    mentor = UserMiniSerializer(read_only=True)
    avg_rating = serializers.FloatField(read_only=True)
    enrollment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'mentor', 'price',
            'level', 'language', 'duration_hours', 'thumbnail',
            'is_approved', 'is_published', 'created_at', 'updated_at',
            'avg_rating', 'enrollment_count'
        ]


# ─────────────────────────── Reviews ───────────────────────────

class ReviewSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)
    is_owner = serializers.SerializerMethodField()
    has_reported = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'course', 'student', 'rating', 'comment', 'created_at', 'updated_at', 'is_owner', 'has_reported']
        read_only_fields = ['id', 'course', 'student', 'created_at', 'updated_at']

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.student_id == request.user.id
        return False

    def get_has_reported(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.reports.filter(reported_by=request.user).exists()
        return False

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Authentication credentials were not provided.")

        user = request.user

        # Skip enrollment/role checks on PATCH (partial update of existing review)
        if self.instance is not None:
            return attrs

        # Fetch course from view context URL pk parameters
        view = self.context.get('view')
        if view and 'pk' in view.kwargs:
            try:
                course = Course.objects.get(pk=view.kwargs['pk'])
            except Course.DoesNotExist:
                raise serializers.ValidationError("Course not found.")
        else:
            course = attrs.get('course')

        if not course:
            raise serializers.ValidationError("Course is required.")

        # 1. Enforce that only students can post reviews
        if user.role != 'STUDENT':
            raise serializers.ValidationError("Only students can write reviews.")

        # 2. Enforce that only enrolled students can post reviews
        from payments.models import Enrollment
        # Ensure reviews can't be posted for soft-deleted courses
        if not Enrollment.objects.filter(student=user, course=course, course__is_deleted=False).exists():
            raise serializers.ValidationError("You must be enrolled in the course to write a review.")

        # 3. Skip duplicate check — the reviews action handles create-or-update logic
        return attrs


# ─────────────────────────── Quiz taking / scoring ───────────────────────────

class QuizAnswerInputSerializer(serializers.Serializer):
    """Parses a single answer within a quiz submission payload (not a ModelSerializer)."""
    question_id = serializers.IntegerField()
    selected_option_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    text_answer = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)


class QuizAnswerResultSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source='question.id')
    question_text = serializers.CharField(source='question.question_text')
    question_type = serializers.CharField(source='question.question_type')
    selected_option_ids = serializers.PrimaryKeyRelatedField(
        source='selected_options', many=True, read_only=True
    )
    correct_option_ids = serializers.SerializerMethodField()
    explanation = serializers.CharField(source='question.explanation')

    class Meta:
        model = QuizAnswer
        fields = [
            'question_id', 'question_text', 'question_type',
            'selected_option_ids', 'text_answer', 'is_correct', 'points_awarded',
            'correct_option_ids', 'explanation',
        ]

    def get_correct_option_ids(self, obj):
        return list(obj.question.options.filter(is_correct=True).values_list('id', flat=True))


class QuizAttemptSerializer(serializers.ModelSerializer):
    answers = QuizAnswerResultSerializer(many=True, read_only=True)
    student = UserMiniSerializer(read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            'id', 'lesson', 'student', 'status', 'started_at', 'submitted_at',
            'score_points', 'total_points', 'score_percent', 'passed',
            'attempt_number', 'answers',
        ]
        read_only_fields = fields


class ReviewReportSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(source='reported_by.username', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    review_comment = serializers.CharField(source='review.comment', read_only=True)
    review_rating = serializers.IntegerField(source='review.rating', read_only=True)
    review_student_name = serializers.CharField(source='review.student.username', read_only=True)
    course_title = serializers.CharField(source='review.course.title', read_only=True)

    class Meta:
        model = ReviewReport
        fields = [
            'id', 'review', 'reported_by', 'reported_by_name', 'reason', 
            'details', 'status', 'created_at', 'reviewed_by', 
            'reviewed_by_name', 'reviewed_at', 'review_comment',
            'review_rating', 'review_student_name', 'course_title'
        ]
        read_only_fields = [
            'id', 'reported_by', 'status', 'created_at', 
            'reviewed_by', 'reviewed_at'
        ]