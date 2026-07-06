from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from courses.models import Course, Lesson
from payments.models import Enrollment
from .models import LessonProgress, CourseProgress, recalculate_course_progress


def get_course_progress_data(student, course):
    # All lessons in the course ordered by module order and lesson order
    lessons = list(Lesson.objects.filter(module__course=course).order_by('module__order', 'order'))
    total_lessons_count = len(lessons)
    
    # Completed lesson progresses
    completed_progresses = LessonProgress.objects.filter(
        student=student,
        lesson__module__course=course,
        completed=True
    )
    completed_ids = list(completed_progresses.values_list('lesson_id', flat=True))
    
    remaining_ids = [l.id for l in lessons if l.id not in completed_ids]
    
    # Course progress record
    course_progress = CourseProgress.objects.filter(student=student, course=course).first()
    completion_percentage = 0.00
    if course_progress:
        completion_percentage = float(course_progress.completion_percentage)
    elif total_lessons_count > 0:
        completion_percentage = round((len(completed_ids) / total_lessons_count) * 100, 2)
        
    # Find last accessed lesson progress for resume position
    last_progress = LessonProgress.objects.filter(
        student=student,
        lesson__module__course=course
    ).order_by('-last_accessed').first()
    
    resume_lesson_id = None
    video_position_seconds = 0
    
    if last_progress:
        resume_lesson_id = last_progress.lesson_id
        video_position_seconds = last_progress.video_position_seconds
    elif remaining_ids:
        resume_lesson_id = remaining_ids[0]
    elif lessons:
        resume_lesson_id = lessons[0].id
        
    duration_hours = getattr(course, 'duration_hours', 0) or 0
    time_remaining_hours = float(duration_hours) * (1 - (completion_percentage / 100.0))
    if time_remaining_hours > 0:
        if time_remaining_hours < 1:
            estimated_time_remaining = f"{round(time_remaining_hours * 60)} mins"
        else:
            estimated_time_remaining = f"{round(time_remaining_hours, 1)} hours"
    else:
        estimated_time_remaining = "0 mins"
        
    return {
        "completed_lessons": completed_ids,
        "remaining_lessons": remaining_ids,
        "completion_percentage": completion_percentage,
        "resume_position": {
            "lesson_id": resume_lesson_id,
            "video_position_seconds": video_position_seconds
        },
        "estimated_time_remaining": estimated_time_remaining
    }


class CourseProgressListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Allow students to see their course progress list
        enrollments = Enrollment.objects.filter(student=request.user, is_active=True).select_related('course')
        results = []
        for enroll in enrollments:
            progress_data = get_course_progress_data(request.user, enroll.course)
            
            has_certificate = False
            try:
                if enroll.certificate:
                    has_certificate = True
            except:
                pass
                
            recent_lessons = []
            recent_progresses = LessonProgress.objects.filter(
                student=request.user, 
                lesson__module__course=enroll.course
            ).order_by('-last_accessed')[:3].select_related('lesson')
            
            for rp in recent_progresses:
                recent_lessons.append({
                    "lesson_id": rp.lesson_id,
                    "lesson_title": rp.lesson.title,
                    "last_accessed": rp.last_accessed
                })
            
            results.append({
                "course_id": enroll.course.id,
                "course_title": enroll.course.title,
                "course_thumbnail": request.build_absolute_uri(enroll.course.thumbnail.url) if enroll.course.thumbnail else None,
                "progress_percent": float(enroll.progress_percent),
                "has_certificate": has_certificate,
                "completed_lessons_count": len(progress_data["completed_lessons"]),
                "total_lessons_count": len(progress_data["completed_lessons"]) + len(progress_data["remaining_lessons"]),
                "resume_position": progress_data["resume_position"],
                "estimated_time_remaining": progress_data["estimated_time_remaining"],
                "recent_lessons": recent_lessons
            })
            
        return Response(results, status=status.HTTP_200_OK)


class CourseProgressDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        # Check enrollment
        if not request.user.is_staff and not request.user.role == 'ADMIN' and not Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists():
            return Response({"detail": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)
            
        progress_data = get_course_progress_data(request.user, course)
        return Response(progress_data, status=status.HTTP_200_OK)


class LessonCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        course = lesson.module.course
        
        # Check enrollment
        if not Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists():
            return Response({"detail": "You must be enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)
            
        progress, created = LessonProgress.objects.get_or_create(
            student=request.user,
            lesson=lesson,
            defaults={
                'course': course,
                'completed': True,
                'is_completed': True,
                'completed_at': timezone.now()
            }
        )
        if not created and not progress.completed:
            progress.completed = True
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()
            
        # Explicit recalculation call to verify CourseProgress
        recalculate_course_progress(request.user, course)
        
        progress_data = get_course_progress_data(request.user, course)
        return Response(progress_data, status=status.HTTP_200_OK)


class LessonResumeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        course = lesson.module.course
        
        # Check enrollment
        if not Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists():
            return Response({"detail": "You must be enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)
            
        progress, created = LessonProgress.objects.get_or_create(
            student=request.user,
            lesson=lesson,
            defaults={
                'course': course,
                'completed': False,
                'is_completed': False
            }
        )
        # Touch last_accessed
        progress.last_accessed = timezone.now()
        progress.save(update_fields=['last_accessed'])
        
        progress_data = get_course_progress_data(request.user, course)
        return Response(progress_data, status=status.HTTP_200_OK)


class VideoPositionUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        lesson_id = request.data.get('lesson_id')
        video_position_seconds = request.data.get('video_position_seconds')
        
        if lesson_id is None or video_position_seconds is None:
            return Response({"detail": "lesson_id and video_position_seconds are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        course = lesson.module.course
        
        # Check enrollment
        if not Enrollment.objects.filter(student=request.user, course=course, is_active=True).exists():
            return Response({"detail": "You must be enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)
            
        progress, created = LessonProgress.objects.get_or_create(
            student=request.user,
            lesson=lesson,
            defaults={
                'course': course,
                'completed': False,
                'is_completed': False
            }
        )
        
        progress.video_position_seconds = int(video_position_seconds)
        progress.last_accessed = timezone.now()
        
        # Optional completion_percentage update (e.g. watch duration relative to total)
        completion_percentage = request.data.get('completion_percentage')
        if completion_percentage is not None:
            progress.completion_percentage = float(completion_percentage)
            
        progress.save()
        
        progress_data = get_course_progress_data(request.user, course)
        return Response(progress_data, status=status.HTTP_200_OK)
