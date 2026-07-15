from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from courses.models import Course, Lesson
from payments.models import Enrollment
from .models import LessonProgress, CourseProgress, recalculate_course_progress
from django.db.models import Count
from certificates.models import Certificate


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
        student = request.user
        enrollments = Enrollment.objects.filter(
            student=student, is_active=True, course__is_deleted=False
        ).select_related('course')

        course_ids = [e.course_id for e in enrollments]

        # Total lesson count per course
        lesson_counts = dict(
            Lesson.objects.filter(module__course_id__in=course_ids)
            .values('module__course_id')
            .annotate(n=Count('id'))
            .values_list('module__course_id', 'n')
        )

        # Completed lesson count per course, for this student
        completed_counts = dict(
            LessonProgress.objects.filter(
                student=student, lesson__module__course_id__in=course_ids, completed=True
            )
            .values('lesson__module__course_id')
            .annotate(n=Count('id'))
            .values_list('lesson__module__course_id', 'n')
        )

        # CourseProgress records, keyed by course_id
        course_progress_map = {
            cp.course_id: cp
            for cp in CourseProgress.objects.filter(student=student, course_id__in=course_ids)
        }

        # Last-accessed lesson per course (most recent first per course)
        # Certificates: which enrollment_ids have one
        enrollment_ids_with_cert = set(
            Certificate.objects.filter(enrollment_id__in=[e.id for e in enrollments])
            .values_list('enrollment_id', flat=True)
        )

        # Last-accessed lesson AND up to 3 recent lessons per course, in ONE combined query
        last_accessed_map = {}
        recent_by_course = {}
        combined_progresses = (
            LessonProgress.objects.filter(student=student, lesson__module__course_id__in=course_ids)
            .select_related('lesson', 'lesson__module')
            .order_by('lesson__module__course_id', '-last_accessed')
        )
        for lp in combined_progresses:
            cid = lp.lesson.module.course_id
            if cid not in last_accessed_map:
                last_accessed_map[cid] = lp
            recent_by_course.setdefault(cid, [])
            if len(recent_by_course[cid]) < 3:
                recent_by_course[cid].append({
                    "lesson_id": lp.lesson_id,
                    "lesson_title": lp.lesson.title,
                    "last_accessed": lp.last_accessed
                })

        results = []
        for enroll in enrollments:
            cid = enroll.course_id
            total = lesson_counts.get(cid, 0)
            completed = completed_counts.get(cid, 0)

            cp = course_progress_map.get(cid)
            completion_percentage = float(cp.completion_percentage) if cp else (
                round((completed / total) * 100, 2) if total > 0 else 0.00
            )

            last_progress = last_accessed_map.get(cid)
            resume_lesson_id = last_progress.lesson_id if last_progress else None
            video_position_seconds = last_progress.video_position_seconds if last_progress else 0

            duration_hours = getattr(enroll.course, 'duration_hours', 0) or 0
            time_remaining_hours = float(duration_hours) * (1 - (completion_percentage / 100.0))
            if time_remaining_hours > 0:
                estimated_time_remaining = (
                    f"{round(time_remaining_hours * 60)} mins" if time_remaining_hours < 1
                    else f"{round(time_remaining_hours, 1)} hours"
                )
            else:
                estimated_time_remaining = "0 mins"

            results.append({
                "course_id": cid,
                "course_title": enroll.course.title,
                "course_thumbnail": request.build_absolute_uri(enroll.course.thumbnail.url) if enroll.course.thumbnail else None,
                "progress_percent": float(enroll.progress_percent),
                "has_certificate": enroll.id in enrollment_ids_with_cert,
                "completed_lessons_count": completed,
                "total_lessons_count": total,
                "resume_position": {
                    "lesson_id": resume_lesson_id,
                    "video_position_seconds": video_position_seconds
                },
                "estimated_time_remaining": estimated_time_remaining,
                "recent_lessons": recent_by_course.get(cid, [])
            })

        return Response(results, status=status.HTTP_200_OK)

class CourseProgressDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, course_id):
        course = get_object_or_404(Course, pk=course_id)
        is_exempt = (
            request.user.is_staff
            or request.user.role == 'ADMIN'
            or (request.user.role == 'MENTOR' and course.mentor == request.user)
        )
        # Check enrollment
        if not is_exempt and not Enrollment.objects.filter(
            student=request.user, course=course, is_active=True, course__is_deleted=False
        ).exists():
            return Response({"detail": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)

        progress_data = get_course_progress_data(request.user, course)
        return Response(progress_data, status=status.HTTP_200_OK)


class LessonCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_id):
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        course = lesson.module.course
        
        # Check enrollment (exclude soft-deleted courses) - exempt admins, staff, and the course mentor
        is_exempt = request.user.is_staff or request.user.role == 'ADMIN' or (request.user.role == 'MENTOR' and course.mentor == request.user)
        if not is_exempt and not Enrollment.objects.filter(student=request.user, course=course, is_active=True, course__is_deleted=False).exists():
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
        
        # Check enrollment (exclude soft-deleted courses) - exempt admins, staff, and the course mentor
        is_exempt = request.user.is_staff or request.user.role == 'ADMIN' or (request.user.role == 'MENTOR' and course.mentor == request.user)
        if not is_exempt and not Enrollment.objects.filter(student=request.user, course=course, is_active=True, course__is_deleted=False).exists():
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
        
        # Check enrollment (exclude soft-deleted courses) - exempt admins, staff, and the course mentor
        is_exempt = request.user.is_staff or request.user.role == 'ADMIN' or (request.user.role == 'MENTOR' and course.mentor == request.user)
        if not is_exempt and not Enrollment.objects.filter(student=request.user, course=course, is_active=True, course__is_deleted=False).exists():
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
