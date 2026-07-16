from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from django.core.cache import cache
from rest_framework.response import Response

from rest_framework.generics import get_object_or_404
from django.db.models import Q, Avg, Count, Sum
from django.utils import timezone


from .models import (
    Course, Module, Lesson,
    QuizQuestion, QuizAttempt, QuizAnswer,
    Review, ReviewReport
)
from .serializers import (
    CourseSerializer,
    CourseListSerializer,
    ModuleSerializer,
    LessonSerializer,
    QuizQuestionSerializer,
    QuizAnswerInputSerializer,
    QuizAttemptSerializer,

    ReviewSerializer, ReviewReportSerializer
)

from .permissions import IsCourseMentorOrAdmin, IsAdminOrStaff

from .admin_reports_views import ADMIN_REPORTS_BASE_KEY
from payments.dashboard_service import ADMIN_DASHBOARD_CACHE_KEY
from . import quiz_service


class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Course creation, listing, updates, and moderation approvals.
    """
    queryset = Course.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def get_queryset(self):
        user = self.request.user
        queryset = Course.objects.all().select_related('mentor')

        # Prefetch complete nested curriculum only for detail operations
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = queryset.prefetch_related(
                'modules__lessons__quiz_questions__options'
            )

        # Admins see all courses
        if user.is_staff or user.role == 'ADMIN':
            return queryset.order_by('-created_at')

        # Mentors see approved/published courses OR their own created courses
        if user.role == 'MENTOR':
            if self.request.query_params.get('created_by_me') == 'true':
                return queryset.filter(mentor=user).order_by('-created_at')
            return queryset.filter(
                Q(mentor=user) | Q(is_approved=True, is_published=True)
            ).distinct().order_by('-created_at')

        # Students see only approved & published courses
        return queryset.filter(is_approved=True, is_published=True).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return CourseListSerializer
        return CourseSerializer

    def perform_create(self, serializer):
        # Enforce that only mentors or admins can create courses
        user = self.request.user
        if not (user.role == 'MENTOR' or user.is_staff or user.role == 'ADMIN'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only mentors or administrators can create courses.")
        serializer.save(mentor=user)

    def perform_update(self, serializer):
        old_title = serializer.instance.title
        old_desc = serializer.instance.description
        instance = serializer.save()

        # If title or description changed, notify all enrolled students
        if old_title != instance.title or old_desc != instance.description:
            from payments.models import Enrollment
            from notifications.models import Notification
            # Don't notify students of courses that have been soft-deleted
            enrollments = Enrollment.objects.filter(course=instance, is_active=True, course__is_deleted=False)
            for enroll in enrollments:
                Notification.objects.create(
                    recipient=enroll.student,
                    sender=instance.mentor,
                    title="Course Updated",
                    message=f"The course '{instance.title}' has been updated with new content.",
                    notification_type=Notification.NotificationType.COURSE_UPDATED,
                    related_object_id=instance.id,
                    related_object_type="Course"
                )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminOrStaff])
    def approve(self, request, pk=None):
        """
        Action for Admins to approve a course.
        """
        course = self.get_object()
        course.is_approved = True
        course.is_submitted_for_review = False
        course.is_rejected = False
        course.save()

        # Invalidate admin caches so the pending queues and stats reflect this
        # action immediately rather than waiting for TTL expiry.
        cache.delete(ADMIN_DASHBOARD_CACHE_KEY)
        cache.delete(ADMIN_REPORTS_BASE_KEY)

        from notifications.models import Notification
        Notification.objects.create(
            recipient=course.mentor,
            title="Course Approved",
            message=f"Your course '{course.title}' has been successfully approved.",
            notification_type=Notification.NotificationType.COURSE_APPROVED,
            related_object_id=course.id,
            related_object_type="Course"
        )

        return Response({
            "detail": f"Course '{course.title}' has been successfully approved.",
            "is_approved": True
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminOrStaff])
    def reject(self, request, pk=None):
        """
        Action for Admins to reject / unapprove a course.
        """
        course = self.get_object()
        course.is_approved = False
        course.is_published = False
        course.is_submitted_for_review = False
        course.is_rejected = True
        course.save()

        # Invalidate admin caches — rejected course must leave the pending queue
        # immediately on the admin dashboard and reports pages.
        cache.delete(ADMIN_DASHBOARD_CACHE_KEY)
        cache.delete(ADMIN_REPORTS_BASE_KEY)

        from notifications.models import Notification
        Notification.objects.create(
            recipient=course.mentor,
            title="Course Rejected",
            message=f"Your course '{course.title}' has been rejected by moderation.",
            notification_type=Notification.NotificationType.COURSE_REJECTED,
            related_object_id=course.id,
            related_object_type="Course"
        )

        return Response({
            "detail": f"Course '{course.title}' has been rejected.",
            "is_approved": False,
            "is_published": False
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsCourseMentorOrAdmin])
    def publish(self, request, pk=None):
        """
        Action for Mentors to publish a course.
        """
        course = self.get_object()
        if not course.is_approved:
            return Response(
                {"detail": "Course must be approved by an admin before it can be published."},
                status=status.HTTP_400_BAD_REQUEST
            )
        course.is_published = True
        course.save()

        detail_msg = f"Course '{course.title}' has been published."
        if not course.is_approved:
            detail_msg += " Note: It will not appear in the public catalog until approved by an administrator."

        return Response({
            "detail": detail_msg,
            "is_published": True,
            "is_approved": course.is_approved
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsCourseMentorOrAdmin])
    def unpublish(self, request, pk=None):
        """
        Action for Mentors to unpublish a course.
        """
        course = self.get_object()
        course.is_published = False
        course.save()
        return Response({
            "detail": f"Course '{course.title}' has been unpublished.",
            "is_published": False
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        course = self.get_object()
        course.is_deleted = True
        course.deleted_at = timezone.now()
        course.is_published = False   # pull it from the public catalog immediately
        course.save()
        return Response(
            {"detail": f"Course '{course.title}' has been deleted."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsCourseMentorOrAdmin])
    def submit_for_review(self, request, pk=None):
        course = self.get_object()
        if course.mentor != request.user:
            return Response({"detail": "Only the course mentor can submit this course for review."},
                             status=status.HTTP_403_FORBIDDEN)
        if course.is_published:
            return Response({"detail": "This course is already published."},
                             status=status.HTTP_400_BAD_REQUEST)

        course.is_submitted_for_review = True
        course.is_rejected = False
        course.save()

        from django.contrib.auth import get_user_model
        from notifications.models import Notification
        User = get_user_model()
        admins = User.objects.filter(Q(is_staff=True) | Q(role='ADMIN'))
        for admin in admins:
            Notification.objects.create(
                recipient=admin,
                sender=request.user,
                title="Course Pending Approval",
                message=f"'{course.title}' by {request.user.username} was submitted for review.",
                notification_type=Notification.NotificationType.COURSE_PENDING_APPROVAL,
                related_object_id=course.id,
                related_object_type="Course"
            )

        return Response({"detail": f"'{course.title}' submitted for review.",
                          "status": course.status}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        """
        GET: Returns structured review data with distribution, average, user_review, and paginated results.
        POST: Creates a new review or updates the existing one (create-or-update).
        """
        course = self.get_object()

        if request.method == 'POST':
            # Create-or-update logic
            existing_review = Review.objects.filter(student=request.user, course=course).first()

            if existing_review:
                # Update existing review
                serializer = ReviewSerializer(
                    existing_review,
                    data=request.data,
                    partial=True,
                    context={'request': request, 'view': self}
                )
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_200_OK)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Create new review
                serializer = ReviewSerializer(data=request.data, context={'request': request, 'view': self})
                if serializer.is_valid():
                    serializer.save(student=request.user, course=course)
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── GET method ────────────────────────────────────────────────
        reviews_qs = course.reviews.filter(is_flagged=False).select_related('student').order_by('-created_at')


        # Rating distribution (5 → 1)
        distribution_raw = reviews_qs.values('rating').annotate(count=Count('id'))
        distribution = {str(i): 0 for i in range(1, 6)}
        for row in distribution_raw:
            distribution[str(row['rating'])] = row['count']

        # Current user's review (if authenticated)
        user_review = None
        if request.user and request.user.is_authenticated:
            user_review_obj = reviews_qs.filter(student=request.user).first()
            if user_review_obj:
                user_review = ReviewSerializer(user_review_obj, context={'request': request, 'view': self}).data

        # All reviews
        serializer = ReviewSerializer(reviews_qs, many=True, context={'request': request, 'view': self})

        return Response({
            'average_rating': float(course.rating_average),
            'total_reviews': course.total_reviews,
            'distribution': distribution,
            'user_review': user_review,
            'results': serializer.data,
        })


class ReviewViewSet(viewsets.GenericViewSet):
    """
    Standalone ViewSet for PATCH and DELETE on individual reviews.
    - PATCH: Only the review author can update.
    - DELETE: The review author OR an admin can delete.
    """
    queryset = Review.objects.select_related('student', 'course')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def partial_update(self, request, pk=None):
        review = self.get_object()
        if review.student != request.user:
            return Response(
                {"detail": "You can only edit your own review."},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = self.get_serializer(review, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        review = self.get_object()
        is_owner = review.student == request.user
        is_admin = request.user.is_staff or request.user.role == 'ADMIN'
        if not (is_owner or is_admin):
            return Response(
                {"detail": "You do not have permission to delete this review."},
                status=status.HTTP_403_FORBIDDEN
            )
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def report(self, request, pk=None):
        review = self.get_object()
        
        # Enforce that only students can report reviews
        if request.user.role != 'STUDENT':
            return Response(
                {"detail": "Only students can report reviews."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce that only enrolled students can report reviews
        from payments.models import Enrollment
        if not Enrollment.objects.filter(student=request.user, course=review.course, course__is_deleted=False).exists():
            return Response(
                {"detail": "You must be enrolled in this course to report its reviews."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Prevent self reporting
        if review.student == request.user:
            return Response(
                {"detail": "You cannot report your own review."},
                status=status.HTTP_400_BAD_REQUEST
            )

            
        # Check duplicate
        if ReviewReport.objects.filter(review=review, reported_by=request.user).exists():
            return Response(
                {"detail": "You have already reported this review."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        serializer = ReviewReportSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(review=review, reported_by=request.user)
            
            # Check Threshold for Admin notification (notifies on 1+ reports for immediate action)
            report_count = review.reports.count()
            if report_count >= 1:
                _notify_admins_of_reported_review(review, report_count)

                
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class ModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Module CRUD.
    """
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def perform_create(self, serializer):
        # Validate that the mentor creating the module owns the course
        course = serializer.validated_data.get('course')
        if course.mentor != self.request.user and not (self.request.user.is_staff or self.request.user.role == 'ADMIN'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to add modules to this course.")
        serializer.save()


class LessonViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Lesson CRUD.
    """
    queryset = Lesson.objects.all()
    serializer_class = LessonSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def perform_create(self, serializer):
        # Validate that the mentor creating the lesson owns the parent module's course
        module = serializer.validated_data.get('module')
        if module.course.mentor != self.request.user and not (self.request.user.is_staff or self.request.user.role == 'ADMIN'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to add lessons to this course module.")
        serializer.save()


class QuizQuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for QuizQuestion CRUD (authoring side — mentors/admins only,
    enforced via IsCourseMentorOrAdmin + perform_create below).
    """
    queryset = QuizQuestion.objects.prefetch_related('options').all()
    serializer_class = QuizQuestionSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def perform_create(self, serializer):
        # Validate that the mentor creating the quiz question owns the parent lesson's course
        lesson = serializer.validated_data.get('lesson')
        if lesson.module.course.mentor != self.request.user and not (self.request.user.is_staff or self.request.user.role == 'ADMIN'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to add quiz questions to this lesson.")
        serializer.save()


class QuizAttemptViewSet(viewsets.GenericViewSet):
    """
    Student-facing quiz-taking flow, decoupled from question authoring:

      POST /api/quiz/lessons/{lesson_pk}/start/    -> start (or resume) an attempt
      POST /api/quiz/attempts/{attempt_pk}/submit/ -> submit answers, get a graded result
      GET  /api/quiz/lessons/{lesson_pk}/history/   -> the current student's past attempts

    Business logic (grading, enrollment checks, attempt lifecycle) lives in
    quiz_service.py; this viewset only handles request/response plumbing.
    """
    queryset = QuizAttempt.objects.select_related('student', 'lesson').prefetch_related(
        'answers__question__options', 'answers__selected_options'
    )
    serializer_class = QuizAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='lessons/(?P<lesson_pk>[^/.]+)/start')
    def start(self, request, lesson_pk=None):
        lesson = quiz_service.get_quiz_lesson(lesson_pk)
        quiz_service.check_enrollment(request.user, lesson)

        try:
            attempt = quiz_service.start_attempt(request.user, lesson)
        except quiz_service.QuizStateError as exc:
            return Response({"detail": str(exc)}, status=exc.status_code)

        questions = QuizQuestionSerializer(
            lesson.quiz_questions.all(), many=True, context={'request': request}
        ).data

        return Response({
            "attempt_id": attempt.id,
            "attempt_number": attempt.attempt_number,
            "time_limit_minutes": lesson.quiz_time_limit_minutes,
            "started_at": attempt.started_at,
            "questions": questions,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        attempt = self.get_object()

        input_serializer = QuizAnswerInputSerializer(data=request.data.get('answers', []), many=True)
        input_serializer.is_valid(raise_exception=True)

        try:
            attempt, time_expired = quiz_service.submit_attempt(
                attempt, request.user, input_serializer.validated_data
            )
        except quiz_service.QuizPermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except quiz_service.QuizStateError as exc:
            return Response({"detail": exc.message}, status=exc.status_code)

        response_data = QuizAttemptSerializer(attempt, context={'request': request}).data
        if time_expired:
            response_data['warning'] = "This attempt was submitted after the time limit had elapsed."

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='lessons/(?P<lesson_pk>[^/.]+)/history')
    def history(self, request, lesson_pk=None):
        lesson = quiz_service.get_quiz_lesson(lesson_pk)
        attempts = quiz_service.get_history(lesson, request.user)
        serializer = QuizAttemptSerializer(attempts, many=True, context={'request': request})
        return Response(serializer.data)


def _notify_admins_of_reported_review(review, report_count):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    from notifications.models import Notification
    from notifications.serializers import NotificationSerializer
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    import threading
    import logging
    logger = logging.getLogger(__name__)

    def notify():
        try:
            admins = User.objects.filter(role='ADMIN', is_active=True)

            notifications = [
                Notification(
                    recipient=admin,
                    sender=review.student,
                    title="⚠️ Review Flagged",
                    message=f"Review by {review.student.username} for course '{review.course.title}' has received {report_count} reports.",
                    notification_type=Notification.NotificationType.REVIEW_REPORTED,
                    related_object_id=review.id,
                    related_object_type="review"
                )
                for admin in admins
            ]
            created = Notification.objects.bulk_create(notifications)
            
            # WebSocket pushes
            channel_layer = get_channel_layer()
            if channel_layer:
                for notif in created:
                    group_name = f"user_{notif.recipient_id}"
                    serializer = NotificationSerializer(notif)
                    try:
                        async_to_sync(channel_layer.group_send)(
                            group_name,
                            {
                                "type": "send_notification",
                                "payload": serializer.data
                            }
                        )
                    except Exception as ws_err:
                        logger.error(f"[WS ERROR] Failed to send WS notification: {ws_err}")
        except Exception as e:
            logger.error(f"Error in notifying admins of reported review: {e}")
            
    threading.Thread(target=notify, daemon=True).start()



class AdminReviewReportViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrStaff]
    serializer_class = ReviewReportSerializer

    def get_queryset(self):
        queryset = ReviewReport.objects.select_related(
            'review', 'review__student', 'review__course', 'reported_by', 'reviewed_by'
        ).annotate(
            review_report_count=Count('review__reports')
        ).order_by('-review_report_count', '-created_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        return queryset

    def partial_update(self, request, pk=None):
        report = self.get_object()
        action_val = request.data.get('action')

        if action_val not in ['dismiss', 'remove_review']:
            return Response(
                {"detail": "Invalid action. Must be 'dismiss' or 'remove_review'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if action_val == 'dismiss':
            report.status = ReviewReport.StatusChoices.DISMISSED
        elif action_val == 'remove_review':
            report.status = ReviewReport.StatusChoices.REVIEWED
            # Hide the review!
            review = report.review
            review.is_flagged = True
            review.save()

        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save()

        # Update other reports for the same review to keep status synced!
        if action_val == 'remove_review':
            ReviewReport.objects.filter(review=report.review, status=ReviewReport.StatusChoices.PENDING).update(
                status=ReviewReport.StatusChoices.REVIEWED,
                reviewed_by=request.user,
                reviewed_at=timezone.now()
            )
        elif action_val == 'dismiss':
            ReviewReport.objects.filter(review=report.review, status=ReviewReport.StatusChoices.PENDING).update(
                status=ReviewReport.StatusChoices.DISMISSED,
                reviewed_by=request.user,
                reviewed_at=timezone.now()
            )

        # Force recalculation of serializer to include updated fields
        serializer = self.get_serializer(report)
        return Response(serializer.data)