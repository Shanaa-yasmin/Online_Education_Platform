from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.db.models import Q

from .models import Enrollment, LessonProgress
from .serializers import EnrollmentSerializer, LessonProgressSerializer
from courses.models import Course, Lesson

class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for student course enrollments.
    """
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'ADMIN':
            return Enrollment.objects.all()
        if user.role == 'MENTOR':
            # Mentors can see enrollments in their courses
            return Enrollment.objects.filter(course__mentor=user)
        # Students see their own enrollments
        return Enrollment.objects.filter(student=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != 'STUDENT':
            raise PermissionDenied("Only students can enroll in courses.")

        course_id = self.request.data.get('course')
        try:
            course = Course.objects.get(pk=course_id)
        except Course.DoesNotExist:
            raise ValidationError({"course": "Invalid course ID."})

        # Ensure course is approved & published
        if not (course.is_approved and course.is_published):
            raise PermissionDenied("This course is not currently available for enrollment.")

        # Check unique constraint manually to return a nice message
        if Enrollment.objects.filter(student=user, course=course).exists():
            raise ValidationError({"detail": "You are already enrolled in this course."})

        serializer.save(student=user, course=course, is_active=True)

    @action(detail=False, methods=['get'])
    def check(self, request):
        """
        Action to check if logged in user is enrolled in a specific course.
        Query param: ?course_id=<id>
        """
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response({"detail": "course_id parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            enrollment = Enrollment.objects.get(student=request.user, course_id=course_id)
            return Response({
                "enrolled": True,
                "is_active": enrollment.is_active,
                "progress_percent": enrollment.progress_percent
            })
        except Enrollment.DoesNotExist:
            return Response({
                "enrolled": False,
                "is_active": False,
                "progress_percent": 0.00
            })


class LessonProgressViewSet(viewsets.GenericViewSet):
    """
    ViewSet for tracking lesson completion progress.
    """
    queryset = LessonProgress.objects.all()
    serializer_class = LessonProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='lessons/(?P<lesson_id>[^/.]+)/complete')
    def complete(self, request, lesson_id=None):
        """
        Endpoint to mark a lesson as complete: /api/progress/lessons/<lesson_id>/complete/
        """
        student = request.user
        if student.role != 'STUDENT':
            raise PermissionDenied("Only students can mark lessons as complete.")

        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        course = lesson.module.course

        # Verify enrollment
        try:
            enrollment = Enrollment.objects.get(student=student, course=course, is_active=True)
        except Enrollment.DoesNotExist:
            raise PermissionDenied("You must be enrolled in this course to mark progress.")

        # Get or create progress entry
        progress, created = LessonProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={"is_completed": True, "completed_at": timezone.now()}
        )

        if not created and not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()

        # Recalculate total course progress
        total_lessons = Lesson.objects.filter(module__course=course).count()
        if total_lessons > 0:
            completed_count = LessonProgress.objects.filter(
                student=student,
                lesson__module__course=course,
                is_completed=True
            ).count()
            progress_percent = round((completed_count / total_lessons) * 100, 2)
        else:
            progress_percent = 0.00

        # Save to enrollment
        enrollment.progress_percent = progress_percent
        enrollment.save()

        return Response({
            "detail": f"Lesson '{lesson.title}' marked as complete.",
            "is_completed": True,
            "progress_percent": progress_percent
        }, status=status.HTTP_200_OK)
