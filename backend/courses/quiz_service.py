"""
Service layer for the student-facing quiz-taking flow.

This module holds the business logic that used to live directly on
QuizAttemptViewSet (start / submit / history / enrollment checks), so the
viewset can stay thin and the grading/enrollment rules can be reused or
tested independently of DRF request/response plumbing.

Grading supports SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE (all matched
against QuizOption.is_correct) and FILL_BLANK (matched via
QuizQuestion.check_text_answer). Each question is worth `points` weight,
and the attempt is scored as a percentage of total points.
"""
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404

from .models import Lesson, QuizAttempt, QuizAnswer, QuizQuestion


class QuizPermissionError(PermissionDenied):
    """Raised when a student attempts an action they're not allowed to."""
    pass


class QuizStateError(Exception):
    """Raised for invalid quiz-attempt state transitions (e.g. re-submitting)."""

    def __init__(self, message, status_code=400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def get_quiz_lesson(lesson_pk):
    """Fetch a Lesson that is configured as a quiz, or 404."""
    return get_object_or_404(Lesson, pk=lesson_pk, content_type=Lesson.ContentType.QUIZ)


def check_enrollment(user, lesson):
    """
    Admins/mentors can preview a quiz without being enrolled; only enrolled
    students are graded/tracked. Raises QuizPermissionError otherwise.
    """
    if user.is_staff or user.role == 'ADMIN' or lesson.module.course.mentor == user:
        return

    from payments.models import Enrollment
    # Enrollment check must ensure the course isn't soft-deleted
    is_enrolled = Enrollment.objects.filter(
        student=user, course=lesson.module.course, course__is_deleted=False
    ).exists()
    if not is_enrolled:
        raise QuizPermissionError("You must be enrolled in this course to take the quiz.")


def start_attempt(user, lesson):
    """
    Start a new quiz attempt for the user, or resume an in-progress one.
    Raises QuizStateError if the max attempt count has been reached.
    Returns the QuizAttempt instance.
    """
    submitted_count = QuizAttempt.objects.filter(
        lesson=lesson, student=user, status=QuizAttempt.Status.SUBMITTED
    ).count()

    if lesson.max_quiz_attempts and submitted_count >= lesson.max_quiz_attempts:
        raise QuizStateError(
            f"You have used all {lesson.max_quiz_attempts} allowed attempts for this quiz."
        )

    attempt = QuizAttempt.objects.filter(
        lesson=lesson, student=user, status=QuizAttempt.Status.IN_PROGRESS
    ).first()

    if not attempt:
        total_points = lesson.quiz_questions.aggregate(total=Sum('points'))['total'] or 0
        attempt = QuizAttempt.objects.create(
            lesson=lesson,
            student=user,
            total_points=total_points,
            attempt_number=submitted_count + 1,
        )

    return attempt


def _grade_answer(question, ans):
    """Return (is_correct, points_awarded, selected_ids) for a single answer."""
    selected_ids = ans.get('selected_option_ids') or []

    if question.question_type == QuizQuestion.QuestionType.FILL_BLANK:
        is_correct = question.check_text_answer(ans.get('text_answer'))
    else:
        correct_ids = set(question.options.filter(is_correct=True).values_list('id', flat=True))
        is_correct = len(correct_ids) > 0 and set(selected_ids) == correct_ids

    points_awarded = question.points if is_correct else 0
    return is_correct, points_awarded, selected_ids


def submit_attempt(attempt, user, validated_answers):
    """
    Grade and finalize a quiz attempt.

    `validated_answers` is the already-validated data from
    QuizAnswerInputSerializer (a list of dicts with question_id,
    selected_option_ids, text_answer).

    Raises QuizPermissionError / QuizStateError on invalid access or state.
    Returns (attempt, time_expired: bool).
    """
    if attempt.student != user:
        raise QuizPermissionError("This is not your quiz attempt.")
    if attempt.status == QuizAttempt.Status.SUBMITTED:
        raise QuizStateError("This attempt has already been submitted.")

    lesson = attempt.lesson
    time_expired = False
    if lesson.quiz_time_limit_minutes:
        elapsed_minutes = (timezone.now() - attempt.started_at).total_seconds() / 60
        time_expired = elapsed_minutes > lesson.quiz_time_limit_minutes

    questions_by_id = {q.id: q for q in lesson.quiz_questions.prefetch_related('options').all()}
    score_points = 0

    for ans in validated_answers:
        question = questions_by_id.get(ans['question_id'])
        if not question:
            continue  # ignore answers for questions that aren't part of this lesson

        is_correct, points_awarded, selected_ids = _grade_answer(question, ans)
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

    _notify_quiz_result(attempt, lesson)

    return attempt, time_expired


def _notify_quiz_result(attempt, lesson):
    """Best-effort notification; must never block the graded result from returning."""
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
        pass


def get_history(lesson, user):
    """Return the student's past attempts for a quiz lesson, most recent first."""
    return QuizAttempt.objects.filter(
        lesson=lesson, student=user
    ).order_by('-started_at')