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
    rating_average = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'mentor', 'price', 
            'level', 'language', 'duration_hours', 'thumbnail', 
            'is_approved', 'is_published', 'rating_average'
        ]

    def get_rating_average(self, obj):
        reviews = obj.reviews.all()
        if reviews.exists():
            return round(sum(r.rating for r in reviews) / reviews.count(), 2)
        return 0.0


class CourseSerializer(serializers.ModelSerializer):
    mentor = UserMiniSerializer(read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)
    rating_average = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'mentor', 'price', 
            'level', 'language', 'duration_hours', 'thumbnail', 
            'is_approved', 'is_published', 'created_at', 'updated_at',
            'modules', 'rating_average'
        ]
        read_only_fields = ['is_approved']

    def get_rating_average(self, obj):
        reviews = obj.reviews.all()
        if reviews.exists():
            return round(sum(r.rating for r in reviews) / reviews.count(), 2)
        return 0.0

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
