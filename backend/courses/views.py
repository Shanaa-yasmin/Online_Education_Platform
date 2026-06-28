from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import OrderingFilter
from django.db.models import Q, Avg, Count, Min, Max
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend

from .models import Course, Module, Lesson, QuizQuestion
from .serializers import (
    CourseSerializer,
    CourseListSerializer,
    ModuleSerializer,
    LessonSerializer,
    QuizQuestionSerializer,
    CourseSearchSerializer
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

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminOrStaff])
    def approve(self, request, pk=None):
        """
        Action for Admins to approve a course.
        """
        course = self.get_object()
        course.is_approved = True
        course.save()
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
        # If rejected, unpublish as well to keep integrity
        course.is_published = False
        course.save()
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
    ViewSet for QuizQuestion CRUD.
    """
    queryset = QuizQuestion.objects.all()
    serializer_class = QuizQuestionSerializer
    permission_classes = [permissions.IsAuthenticated, IsCourseMentorOrAdmin]

    def perform_create(self, serializer):
        # Validate that the mentor creating the quiz question owns the parent lesson's course
        lesson = serializer.validated_data.get('lesson')
        if lesson.module.course.mentor != self.request.user and not (self.request.user.is_staff or self.request.user.role == 'ADMIN'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to add quiz questions to this lesson.")
        serializer.save()


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
