from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import LessonProgress, CourseProgress
from courses.serializers import UserMiniSerializer, CourseListSerializer

User = get_user_model()


class LessonProgressSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)

    class Meta:
        model  = LessonProgress
        fields = [
            'id', 'student', 'course', 'lesson', 'completed', 'is_completed',
            'completion_percentage', 'video_position_seconds',
            'started_at', 'completed_at', 'last_accessed'
        ]
        read_only_fields = ['id', 'student', 'started_at', 'completed_at', 'last_accessed']


class CourseProgressSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)
    course_details = CourseListSerializer(source='course', read_only=True)

    class Meta:
        model = CourseProgress
        fields = [
            'id', 'student', 'course', 'course_details', 'completed_lessons',
            'total_lessons', 'completion_percentage', 'completed',
            'certificate_eligible', 'updated_at'
        ]
        read_only_fields = [
            'id', 'student', 'completed_lessons', 'total_lessons',
            'completion_percentage', 'completed', 'certificate_eligible', 'updated_at'
        ]
