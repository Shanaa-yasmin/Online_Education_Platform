from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from courses.models import Course
from payments.models import Enrollment
from .models import ChatRoom, ChatMessage
from .serializers import ChatMessageSerializer

class ChatMessageViewSet(viewsets.ViewSet):
    """
    ViewSet for fetching chat message logs for courses.
    Enforces active enrollment check for students, ownership for mentors, or administrative access.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='course/(?P<course_id>[^/.]+)')
    def list_course_messages(self, request, course_id=None):
        user = request.user
        course = get_object_or_404(Course, pk=course_id)

        # Access check
        has_access = False
        if user.is_staff or user.role == 'ADMIN':
            has_access = True
        elif user.role == 'MENTOR':
            has_access = course.mentor == user
        elif user.role == 'STUDENT':
            has_access = Enrollment.objects.filter(student=user, course=course, is_active=True).exists()

        if not has_access:
            raise PermissionDenied("You do not have access to this course's Q&A chat.")

        # Lazy-create ChatRoom if missing
        room, _ = ChatRoom.objects.get_or_create(course=course)

        messages = ChatMessage.objects.filter(room=room).order_by('created_at')
        
        # Filter out hidden/moderated messages for students
        if user.role == 'STUDENT' and not (user.is_staff or user.is_superuser):
            messages = messages.filter(is_hidden=False)

        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
