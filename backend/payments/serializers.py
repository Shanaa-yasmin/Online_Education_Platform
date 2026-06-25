from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Enrollment, LessonProgress, Payment
from courses.models import Course, Lesson
from courses.serializers import UserMiniSerializer, CourseListSerializer

User = get_user_model()


class EnrollmentSerializer(serializers.ModelSerializer):
    student       = UserMiniSerializer(read_only=True)
    course_details = CourseListSerializer(source='course', read_only=True)

    class Meta:
        model  = Enrollment
        fields = [
            'id', 'student', 'course', 'course_details',
            'enrolled_at', 'is_active', 'progress_percent',
        ]
        read_only_fields = ['id', 'student', 'enrolled_at', 'progress_percent']


class LessonProgressSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)

    class Meta:
        model  = LessonProgress
        fields = ['id', 'student', 'lesson', 'is_completed', 'completed_at']
        read_only_fields = ['id', 'student', 'completed_at']


class PaymentSerializer(serializers.ModelSerializer):
    student      = UserMiniSerializer(read_only=True)
    course_title = serializers.CharField(source='enrollment.course.title', read_only=True)
    course_id    = serializers.IntegerField(source='enrollment.course.id', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'student', 'course_title', 'course_id', 'gateway',
            'transaction_id', 'amount', 'status', 'created_at',
            'refunded_at', 'disputed_at', 'dispute_detail',
        ]
        read_only_fields = [
            'id', 'student', 'course_title', 'course_id', 'gateway',
            'transaction_id', 'amount', 'status', 'created_at',
            'refunded_at', 'disputed_at', 'dispute_detail',
        ]