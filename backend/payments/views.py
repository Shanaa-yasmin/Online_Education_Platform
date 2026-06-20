from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from .models import Enrollment, LessonProgress
from .serializers import EnrollmentSerializer, LessonProgressSerializer
from courses.models import Course, Lesson


class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for student course enrollments.
    Supports listing, creating (enrolling), and checking enrollment status.
    """
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'ADMIN':
            return Enrollment.objects.all()
        if user.role == 'MENTOR':
            return Enrollment.objects.filter(course__mentor=user)
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

        if not (course.is_approved and course.is_published):
            raise PermissionDenied("This course is not currently available for enrollment.")

        if Enrollment.objects.filter(student=user, course=course).exists():
            raise ValidationError({"detail": "You are already enrolled in this course."})

        transaction_id = self.request.data.get('transaction_id')
        if float(course.price) > 0:
            if not transaction_id:
                raise ValidationError({"detail": "Payment is required for this paid course. Please complete checkout."})

        # Create enrollment
        enrollment = serializer.save(student=user, course=course, is_active=True)

        # Record payment for paid courses
        if float(course.price) > 0 and transaction_id:
            from .models import Payment
            Payment.objects.create(
                enrollment=enrollment,
                student=user,
                gateway=Payment.GatewayChoices.STRIPE,
                transaction_id=transaction_id,
                amount=course.price,
                status=Payment.StatusChoices.COMPLETED
            )

    @action(detail=False, methods=['get'])
    def check(self, request):
        """
        GET /api/payments/enrollments/check/?course_id=<id>
        Returns enrollment status, progress, completed lesson IDs, and certificate URL.
        """
        course_id = request.query_params.get('course_id')
        if not course_id:
            return Response({"detail": "course_id parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            enrollment = Enrollment.objects.get(student=request.user, course_id=course_id)

            # List of completed lesson IDs for this course
            completed_lesson_ids = list(
                LessonProgress.objects.filter(
                    student=request.user,
                    lesson__module__course_id=course_id,
                    is_completed=True
                ).values_list('lesson_id', flat=True)
            )

            # Certificate URL if available
            certificate_url = None
            try:
                cert = enrollment.certificate
                if cert and cert.pdf_file:
                    certificate_url = request.build_absolute_uri(cert.pdf_file.url)
            except Exception:
                pass

            return Response({
                "enrolled": True,
                "is_active": enrollment.is_active,
                "progress_percent": enrollment.progress_percent,
                "completed_lessons": completed_lesson_ids,
                "certificate_url": certificate_url,
            })
        except Enrollment.DoesNotExist:
            return Response({
                "enrolled": False,
                "is_active": False,
                "progress_percent": 0.00,
                "completed_lessons": [],
                "certificate_url": None,
            })


class LessonProgressViewSet(viewsets.GenericViewSet):
    """
    ViewSet for tracking individual lesson completion.
    POST /api/payments/progress/lessons/<lesson_id>/complete/
    """
    queryset = LessonProgress.objects.all()
    serializer_class = LessonProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='lessons/(?P<lesson_id>[^/.]+)/complete')
    def complete(self, request, lesson_id=None):
        student = request.user
        if student.role != 'STUDENT':
            raise PermissionDenied("Only students can mark lessons as complete.")

        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            return Response({"detail": "Lesson not found."}, status=status.HTTP_404_NOT_FOUND)

        course = lesson.module.course

        # Verify active enrollment
        try:
            enrollment = Enrollment.objects.get(student=student, course=course, is_active=True)
        except Enrollment.DoesNotExist:
            raise PermissionDenied("You must be enrolled in this course to mark progress.")

        # Upsert lesson progress
        progress, created = LessonProgress.objects.get_or_create(
            student=student,
            lesson=lesson,
            defaults={"is_completed": True, "completed_at": timezone.now()}
        )
        if not created and not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()

        # Recalculate course progress %
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

        enrollment.progress_percent = progress_percent
        enrollment.save()

        # ── Certificate generation on 100% completion ──
        certificate_url = None
        if progress_percent >= 100.00:
            from .utils import generate_certificate_pdf
            try:
                cert = generate_certificate_pdf(enrollment)
                if cert and cert.pdf_file:
                    certificate_url = request.build_absolute_uri(cert.pdf_file.url)
            except Exception as e:
                # Log but don't crash the response
                print(f"[Certificate] Generation error for enrollment {enrollment.id}: {e}")

        return Response({
            "detail": f"Lesson '{lesson.title}' marked as complete.",
            "is_completed": True,
            "progress_percent": progress_percent,
            "certificate_url": certificate_url,
        }, status=status.HTTP_200_OK)
