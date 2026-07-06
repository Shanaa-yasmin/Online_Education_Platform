from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Avg, Count, Q
from django.utils import timezone
from courses.models import Course, Lesson
from payments.models import Enrollment, Payment
from progress.models import LessonProgress, CourseProgress
from certificates.models import Certificate
import datetime


class CourseAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        
        # Verify permissions: only course mentor or admin can view course analytics
        if not (request.user.is_staff or request.user.role == 'ADMIN' or course.mentor == request.user):
            return Response({"detail": "You do not have permission to view this course's analytics."}, status=status.HTTP_403_FORBIDDEN)
            
        # 1. Stat cards
        total_students = Enrollment.objects.filter(course=course).count()
        active_students = Enrollment.objects.filter(course=course, is_active=True).count()
        
        avg_progress = Enrollment.objects.filter(course=course, is_active=True).aggregate(avg=Avg('progress_percent'))['avg'] or 0.0
        avg_progress = round(float(avg_progress), 2)
        
        completed_count = CourseProgress.objects.filter(course=course, completed=True).count()
        completion_rate = round((completed_count / active_students * 100), 2) if active_students > 0 else 0.0
        
        revenue = Payment.objects.filter(enrollment__course=course, status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
        revenue = float(revenue)
        
        certificates_issued = Certificate.objects.filter(course=course).count()
        
        # Most and Least viewed lessons
        lesson_views = list(
            LessonProgress.objects.filter(lesson__module__course=course)
            .values('lesson_id', 'lesson__title')
            .annotate(views=Count('student', distinct=True))
            .order_by('-views')
        )
        
        most_viewed = []
        for lv in lesson_views[:5]:
            most_viewed.append({
                "lesson_id": lv['lesson_id'],
                "title": lv['lesson__title'],
                "views": lv['views']
            })
            
        least_viewed = []
        for lv in lesson_views[::-1][:5]:
            least_viewed.append({
                "lesson_id": lv['lesson_id'],
                "title": lv['lesson__title'],
                "views": lv['views']
            })
            
        # Average watch percentage (VIDEO)
        avg_watch = LessonProgress.objects.filter(
            lesson__module__course=course,
            lesson__content_type='VIDEO'
        ).aggregate(avg=Avg('completion_percentage'))['avg'] or 0.0
        avg_watch = round(float(avg_watch), 2)
        
        # Quiz completion rate
        quiz_lessons = Lesson.objects.filter(module__course=course, content_type='QUIZ')
        total_quizzes = quiz_lessons.count()
        if total_quizzes > 0 and active_students > 0:
            completed_quizzes = LessonProgress.objects.filter(lesson__in=quiz_lessons, completed=True).count()
            quiz_completion_rate = round((completed_quizzes / (total_quizzes * active_students) * 100), 2)
        else:
            quiz_completion_rate = 0.0
            
        # 2. Chart Data: Enrollment Trend (last 30 days)
        from django.db.models.functions import TruncDay
        thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
        daily_enrollments = list(
            Enrollment.objects.filter(course=course, enrolled_at__gte=thirty_days_ago)
            .annotate(day=TruncDay('enrolled_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        
        enrollment_trend = []
        for de in daily_enrollments:
            enrollment_trend.append({
                "date": de['day'].strftime('%Y-%m-%d') if de['day'] else '',
                "enrollments": de['count']
            })
            
        if not enrollment_trend:
            for i in range(7):
                day = (timezone.now() - datetime.timedelta(days=6-i)).strftime('%Y-%m-%d')
                enrollment_trend.append({"date": day, "enrollments": 0})
                
        # 3. Chart Data: Progress Distribution (Brackets)
        p_0_25 = Enrollment.objects.filter(course=course, progress_percent__lte=25.0).count()
        p_26_50 = Enrollment.objects.filter(course=course, progress_percent__gt=25.0, progress_percent__lte=50.0).count()
        p_51_75 = Enrollment.objects.filter(course=course, progress_percent__gt=50.0, progress_percent__lte=75.0).count()
        p_76_100 = Enrollment.objects.filter(course=course, progress_percent__gt=75.0).count()
        
        progress_distribution = [
            {"name": "0-25%", "value": p_0_25},
            {"name": "26-50%", "value": p_26_50},
            {"name": "51-75%", "value": p_51_75},
            {"name": "76-100%", "value": p_76_100},
        ]
        
        # 4. Chart Data: Lesson Completion (bar chart)
        lessons = Lesson.objects.filter(module__course=course).order_by('module__order', 'order')[:10]  # limit to top 10
        lesson_completion_data = []
        for l in lessons:
            comp_count = LessonProgress.objects.filter(lesson=l, completed=True).count()
            lesson_completion_data.append({
                "title": l.title[:15],
                "completed": comp_count
            })
            
        response_data = {
            "stats": {
                "total_students": total_students,
                "active_students": active_students,
                "avg_progress": avg_progress,
                "completion_rate": completion_rate,
                "avg_rating": float(course.rating_average),
                "revenue": revenue,
                "total_reviews": course.total_reviews,
                "certificates_issued": certificates_issued,
                "avg_watch_percentage": avg_watch,
                "quiz_completion_rate": quiz_completion_rate
            },
            "most_viewed_lessons": most_viewed,
            "least_viewed_lessons": least_viewed,
            "charts": {
                "enrollment_trend": enrollment_trend,
                "progress_distribution": progress_distribution,
                "lesson_completion": lesson_completion_data
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)


class MentorOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.role == 'MENTOR' or request.user.role == 'ADMIN' or request.user.is_staff):
            return Response({"detail": "Only mentors can view mentor overview stats."}, status=status.HTTP_403_FORBIDDEN)
            
        # Get all courses created by this mentor
        courses = Course.objects.filter(mentor=request.user)
        
        total_students = Enrollment.objects.filter(course__in=courses).count()
        active_students = Enrollment.objects.filter(course__in=courses, is_active=True).count()
        
        avg_progress = Enrollment.objects.filter(course__in=courses, is_active=True).aggregate(avg=Avg('progress_percent'))['avg'] or 0.0
        avg_progress = round(float(avg_progress), 2)
        
        completed_count = CourseProgress.objects.filter(course__in=courses, completed=True).count()
        completion_rate = round((completed_count / active_students * 100), 2) if active_students > 0 else 0.0
        
        avg_rating = courses.aggregate(avg=Avg('rating_average'))['avg'] or 0.0
        avg_rating = round(float(avg_rating), 2)
        
        revenue = Payment.objects.filter(enrollment__course__in=courses, status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
        revenue = float(revenue)
        
        total_reviews = courses.aggregate(total=Sum('total_reviews'))['total'] or 0
        certificates_issued = Certificate.objects.filter(course__in=courses).count()
        
        # Course list performance
        course_performance = []
        for c in courses:
            c_enrolls = Enrollment.objects.filter(course=c).count()
            c_rev = Payment.objects.filter(enrollment__course=c, status=Payment.StatusChoices.COMPLETED).aggregate(total=Sum('amount'))['total'] or 0.00
            course_performance.append({
                "id": c.id,
                "title": c.title,
                "students": c_enrolls,
                "revenue": float(c_rev),
                "rating": float(c.rating_average)
            })
            
        # Recent reviews for mentor's courses
        from courses.serializers import ReviewSerializer
        from courses.models import Review
        recent_reviews = Review.objects.filter(course__in=courses).order_by('-created_at')[:5]
        reviews_data = ReviewSerializer(recent_reviews, many=True).data
        
        # Recent enrollments
        recent_enrollments_qs = Enrollment.objects.filter(course__in=courses).order_by('-enrolled_at')[:5].select_related('student', 'course')
        recent_enrollments = []
        for re in recent_enrollments_qs:
            recent_enrollments.append({
                "student_username": re.student.username,
                "course_title": re.course.title,
                "enrolled_at": re.enrolled_at
            })
            
        # Pending questions
        # ChatMessage has parent=None and room__course__mentor=mentor
        from chat.models import ChatMessage
        pending_questions_qs = ChatMessage.objects.filter(
            room__course__in=courses,
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
            
        response_data = {
            "stats": {
                "total_students": total_students,
                "active_students": active_students,
                "avg_progress": avg_progress,
                "completion_rate": completion_rate,
                "avg_rating": avg_rating,
                "revenue": revenue,
                "total_reviews": total_reviews,
                "certificates_issued": certificates_issued
            },
            "course_performance": course_performance,
            "recent_reviews": reviews_data,
            "recent_enrollments": recent_enrollments,
            "pending_questions": pending_questions
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
