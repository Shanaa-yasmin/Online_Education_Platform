from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import OrderingFilter
from rest_framework.generics import get_object_or_404
from django.db.models import Q, Avg, Count, Min, Max, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Course, Module, Lesson,
    QuizQuestion, QuizAttempt, QuizAnswer,
    Review
)
from .serializers import (
    CourseSerializer,
    CourseListSerializer,
    ModuleSerializer,
    LessonSerializer,
    QuizQuestionSerializer,
    QuizAnswerInputSerializer,
    QuizAttemptSerializer,
    CourseSearchSerializer,
    ReviewSerializer
)
from .permissions import IsCourseMentorOrAdmin, IsAdminOrStaff
from .filters import CourseFilter


class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Course creation, listing, updates, and moderation approvals.
    """
    queryset = Course.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def get_queryset(self):
        user = self.request.user

        # Admins see all courses
        if user.is_staff or user.role == 'ADMIN':
            return Course.objects.all().order_by('-created_at')

        # Mentors see approved/published courses OR their own created courses
        if user.role == 'MENTOR':
            return Course.objects.filter(
                Q(mentor=user) | Q(is_approved=True, is_published=True)
            ).distinct().order_by('-created_at')

        # Students see only approved & published courses
        return Course.objects.filter(is_approved=True, is_published=True).order_by('-created_at')

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
            enrollments = Enrollment.objects.filter(course=instance, is_active=True)
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
        reviews_qs = course.reviews.select_related('student').order_by('-created_at')

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

    Grading supports SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE (all matched
    against QuizOption.is_correct) and FILL_BLANK (matched via
    QuizQuestion.check_text_answer). Each question is worth `points`
    weight, and the attempt is scored as a percentage of total points.
    """
    queryset = QuizAttempt.objects.select_related('student', 'lesson').prefetch_related(
        'answers__question__options', 'answers__selected_options'
    )
    serializer_class = QuizAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _get_quiz_lesson(lesson_pk):
        return get_object_or_404(Lesson, pk=lesson_pk, content_type=Lesson.ContentType.QUIZ)

    def _check_enrollment(self, request, lesson):
        # Admins/mentors can preview; only enrolled students are graded/tracked.
        user = request.user
        if user.is_staff or user.role == 'ADMIN' or lesson.module.course.mentor == user:
            return
        from payments.models import Enrollment
        if not Enrollment.objects.filter(student=user, course=lesson.module.course).exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be enrolled in this course to take the quiz.")

    @action(detail=False, methods=['post'], url_path='lessons/(?P<lesson_pk>[^/.]+)/start')
    def start(self, request, lesson_pk=None):
        lesson = self._get_quiz_lesson(lesson_pk)
        self._check_enrollment(request, lesson)
        student = request.user

        submitted_count = QuizAttempt.objects.filter(
            lesson=lesson, student=student, status=QuizAttempt.Status.SUBMITTED
        ).count()
        if lesson.max_quiz_attempts and submitted_count >= lesson.max_quiz_attempts:
            return Response(
                {"detail": f"You have used all {lesson.max_quiz_attempts} allowed attempts for this quiz."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resume an in-progress attempt rather than creating duplicates
        attempt = QuizAttempt.objects.filter(
            lesson=lesson, student=student, status=QuizAttempt.Status.IN_PROGRESS
        ).first()

        if not attempt:
            total_points = lesson.quiz_questions.aggregate(total=Sum('points'))['total'] or 0
            attempt = QuizAttempt.objects.create(
                lesson=lesson,
                student=student,
                total_points=total_points,
                attempt_number=submitted_count + 1,
            )

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
        if attempt.student != request.user:
            return Response({"detail": "This is not your quiz attempt."}, status=status.HTTP_403_FORBIDDEN)
        if attempt.status == QuizAttempt.Status.SUBMITTED:
            return Response({"detail": "This attempt has already been submitted."},
                             status=status.HTTP_400_BAD_REQUEST)

        lesson = attempt.lesson
        time_expired = False
        if lesson.quiz_time_limit_minutes:
            elapsed_minutes = (timezone.now() - attempt.started_at).total_seconds() / 60
            time_expired = elapsed_minutes > lesson.quiz_time_limit_minutes

        input_serializer = QuizAnswerInputSerializer(data=request.data.get('answers', []), many=True)
        input_serializer.is_valid(raise_exception=True)

        questions_by_id = {q.id: q for q in lesson.quiz_questions.prefetch_related('options').all()}
        score_points = 0

        for ans in input_serializer.validated_data:
            question = questions_by_id.get(ans['question_id'])
            if not question:
                continue  # ignore answers for questions that aren't part of this lesson

            selected_ids = ans.get('selected_option_ids') or []

            if question.question_type == QuizQuestion.QuestionType.FILL_BLANK:
                is_correct = question.check_text_answer(ans.get('text_answer'))
            else:
                correct_ids = set(question.options.filter(is_correct=True).values_list('id', flat=True))
                is_correct = len(correct_ids) > 0 and set(selected_ids) == correct_ids

            points_awarded = question.points if is_correct else 0
            score_points += points_awarded

            answer, _ = QuizAnswer.objects.update_or_create(
                attempt=attempt,
                question=question,
                defaults={
                    'text_answer': ans.get('text_answer'),
                    'is_correct': is_correct,
                    'points_awarded': points_awarded,
                }
            )
            answer.selected_options.set(selected_ids)

        attempt.score_points = score_points
        attempt.score_percent = (
            round((score_points / attempt.total_points) * 100, 2) if attempt.total_points else 0.00
        )
        attempt.passed = attempt.score_percent >= lesson.passing_score_percent
        attempt.status = QuizAttempt.Status.SUBMITTED
        attempt.submitted_at = timezone.now()
        attempt.save()

        try:
            from notifications.models import Notification
            Notification.objects.create(
                recipient=attempt.student,
                title="Quiz Submitted",
                message=(
                    f"You scored {attempt.score_percent}% on '{lesson.title}'. "
                    f"{'Passed!' if attempt.passed else 'Try again to pass.'}"
                ),
                notification_type=getattr(Notification.NotificationType, 'QUIZ_RESULT', 'COURSE_UPDATED'),
                related_object_id=attempt.id,
                related_object_type="QuizAttempt"
            )
        except Exception:
            # Notification delivery should never block the graded result from returning.
            pass

        response_data = QuizAttemptSerializer(attempt, context={'request': request}).data
        if time_expired:
            response_data['warning'] = "This attempt was submitted after the time limit had elapsed."

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='lessons/(?P<lesson_pk>[^/.]+)/history')
    def history(self, request, lesson_pk=None):
        lesson = self._get_quiz_lesson(lesson_pk)
        attempts = QuizAttempt.objects.filter(
            lesson=lesson, student=request.user
        ).order_by('-started_at')
        serializer = QuizAttemptSerializer(attempts, many=True, context={'request': request})
        return Response(serializer.data)


class CourseSearchView(generics.ListAPIView):
    """
    API endpoint for public course search and faceted filtering.
    """
    serializer_class = CourseSearchSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = CourseFilter
    ordering_fields = ['price', 'created_at', 'avg_rating']
    ordering = ['-created_at']

    def get_queryset(self):
        # We only want published and approved courses for the public catalog search.
        # Annotate them with avg_rating and enrollment_count so the serializer and filter can use it.
        return Course.objects.filter(is_approved=True, is_published=True).annotate(
            avg_rating=Coalesce(Avg('reviews__rating'), 0.0),
            enrollment_count=Count('enrollments', distinct=True)
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Calculate facets based on all approved & published courses (the entire search space context)
        base_queryset = Course.objects.filter(is_approved=True, is_published=True)

        levels = list(base_queryset.values_list('level', flat=True).distinct())
        languages = list(base_queryset.values_list('language', flat=True).distinct())
        languages = [lang for lang in languages if lang]  # Clean empty values

        prices = base_queryset.aggregate(min_p=Min('price'), max_p=Max('price'))
        price_range = {
            'min': float(prices['min_p']) if prices['min_p'] is not None else 0.0,
            'max': float(prices['max_p']) if prices['max_p'] is not None else 1000.0
        }

        facets = {
            'levels': levels,
            'languages': languages,
            'price_range': price_range
        }

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['facets'] = facets
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data,
            'facets': facets
        })


class CourseAutocompleteView(generics.GenericAPIView):
    """
    Lightweight autocomplete endpoint for course title suggestions.
    GET /api/courses/autocomplete/?q=<query>
    - Minimum 2 characters required
    - Returns up to 8 approved & published courses
    - Uses .values() for minimal DB overhead
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip()

        if len(q) < 2:
            return Response([])

        suggestions = (
            Course.objects.filter(
                is_approved=True,
                is_published=True,
                title__icontains=q
            )
            .only('id', 'title', 'slug')
            .values('id', 'title', 'slug')
            .order_by('title')[:8]
        )

        return Response(list(suggestions))