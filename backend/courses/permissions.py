from rest_framework import permissions

class IsAdminOrStaff(permissions.BasePermission):
    """
    Allows access only to admin users (staff or role == 'ADMIN').
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.role == 'ADMIN')
        )


class IsCourseMentorOrAdmin(permissions.BasePermission):
    """
    Object-level permission to allow only the course's mentor or admin to edit.
    Safe methods (GET, HEAD, OPTIONS) are allowed if the course is approved and published.
    """
    def has_object_permission(self, request, view, obj):
        # Traverse to course model to find the mentor
        from .models import Course, Module, Lesson, QuizQuestion
        
        course = None
        if isinstance(obj, Course):
            course = obj
        elif isinstance(obj, Module):
            course = obj.course
        elif isinstance(obj, Lesson):
            course = obj.module.course
        elif isinstance(obj, QuizQuestion):
            course = obj.lesson.module.course
            
        if not course:
            return False

        # Admins can do anything
        if request.user and (request.user.is_staff or request.user.role == 'ADMIN'):
            return True

        # Check if the user is the mentor of the course
        is_mentor = course.mentor == request.user

        # If it's a safe method (GET, etc.), check if the course is approved and published,
        # OR if the requesting user is the owner/mentor of the course
        if request.method in permissions.SAFE_METHODS:
            return (course.is_approved and course.is_published) or is_mentor

        # For write methods (POST, PUT, PATCH, DELETE), only the course mentor has permission
        return is_mentor
