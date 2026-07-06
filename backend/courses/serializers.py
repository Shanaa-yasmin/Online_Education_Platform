from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Course, Module, Lesson, QuizQuestion, Review

User = get_user_model()

class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']


class QuizQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = ['id', 'lesson', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        
        # Hide correct option if user is student or unauthenticated
        if request and request.user:
            user = request.user
            course = instance.lesson.module.course
            is_course_mentor = (course.mentor == user)
            is_admin = (user.is_staff or user.role == 'ADMIN')
            
            if not (is_course_mentor or is_admin):
                ret.pop('correct_option', None)
        else:
            ret.pop('correct_option', None)
            
        return ret


class LessonSerializer(serializers.ModelSerializer):
    quiz_questions = QuizQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = ['id', 'module', 'title', 'content_type', 'video_url', 'file_attachment', 'body_text', 'order', 'quiz_questions']

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
            'is_approved', 'is_published', 'created_at', 'updated_at',
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


class ReviewSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'course', 'student', 'rating', 'comment', 'created_at', 'updated_at', 'is_owner']
        read_only_fields = ['id', 'course', 'student', 'created_at', 'updated_at']

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.student_id == request.user.id
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
        if not Enrollment.objects.filter(student=user, course=course).exists():
            raise serializers.ValidationError("You must be enrolled in the course to write a review.")

        # 3. Skip duplicate check — the reviews action handles create-or-update logic
        return attrs
