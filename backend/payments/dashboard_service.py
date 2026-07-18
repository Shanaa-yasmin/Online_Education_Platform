"""
payments/dashboard_service.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Query/aggregation logic backing DashboardStatsView, split out so that
views.py stays limited to request handling. Each function returns a
plain dict matching the exact response shape the view used to build
inline, for a given role.
"""

import datetime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Avg, Sum, Q, Count
from django.utils import timezone

from certificates.models import Certificate
from courses.models import Course, Review
from notifications.models import Notification
from progress.models import LessonProgress

from .models import Enrollment, Payment
from .serializers import EnrollmentSerializer

User = get_user_model()

# ── Cache constants ────────────────────────────────────────────────────────────
# Import this constant in any view that invalidates admin dashboard data so that
# the key string is defined in exactly one place.
ADMIN_DASHBOARD_CACHE_KEY = "admin_dashboard"
ADMIN_DASHBOARD_CACHE_TTL = 60  # seconds — short so stale data cannot persist
                                 # more than 60 s even if explicit invalidation
                                 # misses an edge case.


def get_mentor_dashboard(user) -> dict:
    my_courses = Course.objects.filter(mentor=user)
    courses_count = my_courses.count()
    published_count = my_courses.filter(is_published=True).count()

    total_students = Enrollment.objects.filter(course__mentor=user, is_active=True, course__is_deleted=False).count()

    avg_rating_val = Review.objects.filter(course__mentor=user).aggregate(Avg('rating'))['rating__avg']
    avg_rating = round(avg_rating_val, 1) if avg_rating_val is not None else 0.0

    # Revenue Summary
    revenue_sum = Payment.objects.filter(
        enrollment__course__mentor=user,
        status=Payment.StatusChoices.COMPLETED
    ).aggregate(total=Sum('amount'))['total'] or 0.00
    revenue = float(revenue_sum)

    # Course list performance optimized: 2 queries instead of 2 * N queries
    enroll_counts = dict(
        Enrollment.objects.filter(course__mentor=user, course__is_deleted=False)
        .values('course_id').annotate(n=Count('id')).values_list('course_id', 'n')
    )
    revenue_by_course = dict(
        Payment.objects.filter(enrollment__course__mentor=user, status=Payment.StatusChoices.COMPLETED)
        .values('enrollment__course_id').annotate(r=Sum('amount')).values_list('enrollment__course_id', 'r')
    )
    course_performance = [
        {
            "id": c.id,
            "title": c.title,
            "students": enroll_counts.get(c.id, 0),
            "revenue": float(revenue_by_course.get(c.id, 0) or 0.00),
            "rating": float(c.rating_average),
        }
        for c in my_courses
    ]

    # Recent enrollments
    recent_enrollments_qs = Enrollment.objects.filter(course__mentor=user, course__is_deleted=False).order_by('-enrolled_at')[:5].select_related('student', 'course')
    recent_enrollments = []
    for re in recent_enrollments_qs:
        recent_enrollments.append({
            "student_username": re.student.username,
            "course_title": re.course.title,
            "enrolled_at": re.enrolled_at
        })

    # Recent reviews optimized: select_related('student', 'course')
    from courses.serializers import ReviewSerializer
    recent_reviews = Review.objects.filter(course__mentor=user).select_related('student', 'course').order_by('-created_at')[:5]
    reviews_data = ReviewSerializer(recent_reviews, many=True).data

    # Pending questions
    from chat.models import ChatMessage
    pending_questions_qs = ChatMessage.objects.filter(
        room__course__mentor=user,
        parent=None
    ).exclude(
        replies__sender__role__in=['MENTOR', 'ADMIN']
    ).distinct().order_by('-created_at')[:5].select_related('sender', 'room__course')

    pending_questions = []
    for pq in pending_questions_qs:
        pending_questions.append({
            "id": pq.id,
            "course_id": pq.room.course_id,
            "course_title": pq.room.course.title,
            "student_username": pq.sender.username,
            "message_text": pq.message_text[:80],
            "created_at": pq.created_at
        })

    total_reviews = Review.objects.filter(course__mentor=user).count()
    from chat.models import ChatMessage
    pending_questions_count = ChatMessage.objects.filter(
        room__course__mentor=user,
        parent=None
    ).exclude(
        replies__sender__role__in=['MENTOR', 'ADMIN']
    ).distinct().count()
    unpublished_count = my_courses.filter(is_published=False).count()

    return {
        "role": "MENTOR",
        "stats": {
            "courses_count": courses_count,
            "total_students": total_students,
            "published_count": published_count,
            "avg_rating": avg_rating,
            "revenue": revenue,
            "total_reviews": total_reviews,
            "pending_questions_count": pending_questions_count,
            "unpublished_count": unpublished_count
        },
        "course_performance": course_performance,
        "recent_enrollments": recent_enrollments,
        "recent_reviews": reviews_data,
        "pending_questions": pending_questions
    }


def get_admin_dashboard() -> dict:
    """
    Return shared admin dashboard stats.

    Results are cached for ADMIN_DASHBOARD_CACHE_TTL seconds.  Any admin
    action that mutates the data visible here (course approve/reject, mentor
    approve/reject) must call cache.delete(ADMIN_DASHBOARD_CACHE_KEY) so the
    next request sees fresh data immediately rather than waiting for TTL expiry.
    """
    cached = cache.get(ADMIN_DASHBOARD_CACHE_KEY)
    if cached is not None:
        return cached

    course_stats = Course.objects.aggregate(
        total=Count('id'),
        published=Count('id', filter=Q(is_published=True)),
        pending=Count('id', filter=Q(is_submitted_for_review=True, is_approved=False))
    )
    total_courses = course_stats['total']
    published_count = course_stats['published']
    pending_courses = course_stats['pending']

    user_stats = User.objects.aggregate(
        students=Count('id', filter=Q(role='STUDENT')),
        mentors=Count('id', filter=Q(role='MENTOR'))
    )
    total_students = user_stats['students']
    total_mentors = user_stats['mentors']

    # Revenue Overview
    revenue_sum = Payment.objects.filter(status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
    revenue = float(revenue_sum)

    total_enrollments = Enrollment.objects.filter(is_active=True, course__is_deleted=False).count()
    total_reviews = Review.objects.count()

    # Recent registrations
    recent_registrations_qs = User.objects.order_by('-date_joined')[:5].values('id', 'username', 'email', 'role', 'date_joined')
    recent_registrations = list(recent_registrations_qs)

    # Pending mentor approvals
    pending_mentor_approvals_qs = User.objects.filter(role='MENTOR', profile__is_approved=False).select_related('profile')[:5]
    pending_mentor_approvals = []
    for pm in pending_mentor_approvals_qs:
        pending_mentor_approvals.append({
            "id": pm.id,
            "username": pm.username,
            "email": pm.email,
            "skills": pm.profile.skills,
            "title": pm.profile.title
        })

    # Pending course approvals optimized: select_related('mentor')
    pending_course_approvals_qs = Course.objects.filter(is_submitted_for_review=True, is_approved=False).select_related('mentor')[:5]
    pending_course_approvals = []
    for pc in pending_course_approvals_qs:
        pending_course_approvals.append({
            "id": pc.id,
            "title": pc.title,
            "mentor": pc.mentor.username,
            "price": float(pc.price)
        })

    # Recent refunds optimized: select_related('student', 'enrollment__course')
    recent_refunds_qs = Payment.objects.filter(status=Payment.StatusChoices.REFUNDED).select_related('student', 'enrollment__course').order_by('-refunded_at')[:5]
    recent_refunds = []
    for pr in recent_refunds_qs:
        recent_refunds.append({
            "id": pr.id,
            "student_username": pr.student.username,
            "course_title": pr.enrollment.course.title,
            "amount": float(pr.amount),
            "refunded_at": pr.refunded_at
        })

    # System activity
    system_activity_qs = Notification.objects.order_by('-created_at')[:8]
    system_activity = []
    for sa in system_activity_qs:
        system_activity.append({
            "id": sa.id,
            "title": sa.title,
            "message": sa.message,
            "created_at": sa.created_at
        })

    result = {
        "role": "ADMIN",
        "stats": {
            "total_courses": total_courses,
            "published_count": published_count,
            "pending_courses": pending_courses,
            "total_students": total_students,
            "total_mentors": total_mentors,
            "revenue": revenue,
            "total_enrollments": total_enrollments,
            "total_reviews": total_reviews
        },
        "recent_registrations": recent_registrations,
        "pending_mentor_approvals": pending_mentor_approvals,
        "pending_course_approvals": pending_course_approvals,
        "recent_refunds": recent_refunds,
        "system_activity": system_activity
    }

    cache.set(ADMIN_DASHBOARD_CACHE_KEY, result, ADMIN_DASHBOARD_CACHE_TTL)
    return result


def get_student_dashboard(user, request) -> dict:
    # Exclude enrollments that point to soft-deleted courses. Prefetch course and course__mentor.
    active_enrollments = Enrollment.objects.filter(student=user, is_active=True, course__is_deleted=False).select_related('course', 'course__mentor')

    # Collapse student stats into a single aggregate query
    enrollment_stats = active_enrollments.aggregate(
        enrolled=Count('id'),
        in_progress=Count('id', filter=Q(progress_percent__gt=0, progress_percent__lt=100)),
        completed=Count('id', filter=Q(progress_percent=100)),
        hours_learned=Sum('course__duration_hours', filter=Q(progress_percent=100)),
        avg_progress=Avg('progress_percent')
    )
    enrolled_count = enrollment_stats['enrolled']
    in_progress_count = enrollment_stats['in_progress']
    completed_count = enrollment_stats['completed']
    hours_learned = enrollment_stats['hours_learned'] or 0
    avg_progress = round(float(enrollment_stats['avg_progress'] or 0.0), 2)

    # 1. Continue Learning
    # Find the most recent lesson progress but ignore entries for soft-deleted courses
    last_progress = (
        LessonProgress.objects.filter(student=user)
        .filter(Q(course__is_deleted=False) | Q(lesson__module__course__is_deleted=False))
        .order_by('-last_accessed')
        .select_related('lesson__module__course', 'course')
        .first()
    )
    continue_learning = None
    upcoming_lessons = []

    if last_progress:
        continue_learning = {
            "course_id": last_progress.course_id or last_progress.lesson.module.course_id,
            "course_title": last_progress.course.title if last_progress.course else last_progress.lesson.module.course.title,
            "lesson_id": last_progress.lesson_id,
            "lesson_title": last_progress.lesson.title,
            "video_position_seconds": last_progress.video_position_seconds
        }

        # 2. Upcoming lessons in this course
        from courses.models import Lesson as CourseLesson
        course_lessons = list(
            CourseLesson.objects.filter(
                module__course_id=last_progress.course_id or last_progress.lesson.module.course_id
            ).order_by('module__order', 'order')
        )
        current_idx = next((i for i, l in enumerate(course_lessons) if l.id == last_progress.lesson_id), -1)
        if current_idx != -1 and current_idx + 1 < len(course_lessons):
            for idx in range(current_idx + 1, min(current_idx + 4, len(course_lessons))):
                upcoming_lessons.append({
                    "id": course_lessons[idx].id,
                    "title": course_lessons[idx].title,
                    "content_type": course_lessons[idx].content_type
                })

    # 3. Learning streak (consecutive days of lesson progress updates)
    # Only consider progress history for non-deleted courses, look back max 60 days, and group in SQL
    from django.db.models.functions import TruncDate
    recent_cutoff = timezone.now() - datetime.timedelta(days=60)
    days = list(
        LessonProgress.objects.filter(student=user, last_accessed__gte=recent_cutoff)
        .filter(Q(course__is_deleted=False) | Q(lesson__module__course__is_deleted=False))
        .annotate(day=TruncDate('last_accessed'))
        .values_list('day', flat=True)
        .distinct()
        .order_by('-day')
    )

    streak = 0
    current_date = timezone.now().date()
    if days:
        if days[0] == current_date or days[0] == current_date - datetime.timedelta(days=1):
            streak = 1
            for i in range(1, len(days)):
                if days[i - 1] - days[i] == datetime.timedelta(days=1):
                    streak += 1
                else:
                    break

    # 4. Certificates earned
    certificates_count = Certificate.objects.filter(student=user, enrollment__is_active=True).count()

    # 5. Recent notifications
    recent_notifications_qs = Notification.objects.filter(recipient=user).order_by('-created_at')[:5]
    recent_notifications = []
    for n in recent_notifications_qs:
        recent_notifications.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "created_at": n.created_at,
            "is_read": n.is_read
        })

    # Calculate daily study activity for calendar heatmap (group by date)
    activity_qs = (
        LessonProgress.objects.filter(student=user)
        .filter(Q(course__is_deleted=False) | Q(lesson__module__course__is_deleted=False))
        .annotate(date_val=TruncDate('last_accessed'))
        .values('date_val')
        .annotate(lessons_completed=Count('id'))
        .order_by('date_val')
    )
    activity = []
    for a in activity_qs:
        if a['date_val']:
            activity.append({
                "date": a['date_val'].strftime('%Y-%m-%d'),
                "lessons_completed": a['lessons_completed']
            })

    enrollment_data = EnrollmentSerializer(
        active_enrollments.order_by('-enrolled_at'),
        many=True,
        context={'request': request}
    ).data

    return {
        "role": "STUDENT",
        "stats": {
            "enrolled_count": enrolled_count,
            "in_progress_count": in_progress_count,
            "completed_count": completed_count,
            "hours_learned": hours_learned,
            "streak": streak,
            "certificates_count": certificates_count,
            "avg_progress": avg_progress
        },
        "continue_learning": continue_learning,
        "upcoming_lessons": upcoming_lessons,
        "recent_notifications": recent_notifications,
        "enrollments": enrollment_data,
        "activity": activity
    }