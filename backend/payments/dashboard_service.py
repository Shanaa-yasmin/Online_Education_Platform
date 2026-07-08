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
from django.db.models import Avg, Sum
from django.utils import timezone

from certificates.models import Certificate
from courses.models import Course, Review
from notifications.models import Notification
from progress.models import LessonProgress

from .models import Enrollment, Payment
from .serializers import EnrollmentSerializer

User = get_user_model()


def get_mentor_dashboard(user) -> dict:
    my_courses = Course.objects.filter(mentor=user)
    courses_count = my_courses.count()
    published_count = my_courses.filter(is_published=True).count()

    total_students = Enrollment.objects.filter(course__mentor=user, is_active=True).count()

    avg_rating_val = Review.objects.filter(course__mentor=user).aggregate(Avg('rating'))['rating__avg']
    avg_rating = round(avg_rating_val, 1) if avg_rating_val is not None else 0.0

    # Revenue Summary
    revenue_sum = Payment.objects.filter(
        enrollment__course__mentor=user,
        status=Payment.StatusChoices.COMPLETED
    ).aggregate(total=Sum('amount'))['total'] or 0.00
    revenue = float(revenue_sum)

    # Course list performance
    course_performance = []
    for c in my_courses:
        c_enrolls = Enrollment.objects.filter(course=c).count()
        c_rev = Payment.objects.filter(enrollment__course=c, status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
        course_performance.append({
            "id": c.id,
            "title": c.title,
            "students": c_enrolls,
            "revenue": float(c_rev),
            "rating": float(c.rating_average)
        })

    # Recent enrollments
    recent_enrollments_qs = Enrollment.objects.filter(course__mentor=user).order_by('-enrolled_at')[:5].select_related('student', 'course')
    recent_enrollments = []
    for re in recent_enrollments_qs:
        recent_enrollments.append({
            "student_username": re.student.username,
            "course_title": re.course.title,
            "enrolled_at": re.enrolled_at
        })

    # Recent reviews
    from courses.serializers import ReviewSerializer
    recent_reviews = Review.objects.filter(course__mentor=user).order_by('-created_at')[:5]
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
            "course_title": pq.room.course.title,
            "student_username": pq.sender.username,
            "message_text": pq.message_text[:80],
            "created_at": pq.created_at
        })

    return {
        "role": "MENTOR",
        "stats": {
            "courses_count": courses_count,
            "total_students": total_students,
            "published_count": published_count,
            "avg_rating": avg_rating,
            "revenue": revenue
        },
        "course_performance": course_performance,
        "recent_enrollments": recent_enrollments,
        "recent_reviews": reviews_data,
        "pending_questions": pending_questions
    }


def get_admin_dashboard() -> dict:
    total_courses = Course.objects.count()
    published_count = Course.objects.filter(is_published=True).count()
    pending_courses = Course.objects.filter(is_submitted_for_review=True, is_approved=False).count()
    total_students = User.objects.filter(role='STUDENT').count()
    total_mentors = User.objects.filter(role='MENTOR').count()

    # Revenue Overview
    revenue_sum = Payment.objects.filter(status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
    revenue = float(revenue_sum)

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

    # Pending course approvals
    pending_course_approvals_qs = Course.objects.filter(is_submitted_for_review=True, is_approved=False)[:5]
    pending_course_approvals = []
    for pc in pending_course_approvals_qs:
        pending_course_approvals.append({
            "id": pc.id,
            "title": pc.title,
            "mentor": pc.mentor.username,
            "price": float(pc.price)
        })

    # Recent refunds
    recent_refunds_qs = Payment.objects.filter(status=Payment.StatusChoices.REFUNDED).order_by('-refunded_at')[:5]
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

    return {
        "role": "ADMIN",
        "stats": {
            "total_courses": total_courses,
            "published_count": published_count,
            "pending_courses": pending_courses,
            "total_students": total_students,
            "total_mentors": total_mentors,
            "revenue": revenue
        },
        "recent_registrations": recent_registrations,
        "pending_mentor_approvals": pending_mentor_approvals,
        "pending_course_approvals": pending_course_approvals,
        "recent_refunds": recent_refunds,
        "system_activity": system_activity
    }


def get_student_dashboard(user, request) -> dict:
    active_enrollments = Enrollment.objects.filter(student=user, is_active=True).select_related('course')
    enrolled_count = active_enrollments.count()

    in_progress_count = active_enrollments.filter(progress_percent__gt=0, progress_percent__lt=100).count()
    completed_count = active_enrollments.filter(progress_percent=100).count()

    hours_learned_val = active_enrollments.filter(progress_percent=100).aggregate(total=Sum('course__duration_hours'))['total']
    hours_learned = hours_learned_val if hours_learned_val is not None else 0

    # 1. Continue Learning
    last_progress = LessonProgress.objects.filter(student=user).order_by('-last_accessed').select_related('lesson', 'course').first()
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
    progress_history = LessonProgress.objects.filter(student=user).values_list('last_accessed', flat=True)
    days = sorted(list(set([d.date() for d in progress_history])), reverse=True)
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
    certificates_count = Certificate.objects.filter(student=user).count()

    # 5. Average progress
    avg_progress = active_enrollments.aggregate(avg=Avg('progress_percent'))['avg'] or 0.0
    avg_progress = round(float(avg_progress), 2)

    # 6. Recent notifications
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
        "enrollments": enrollment_data
    }
