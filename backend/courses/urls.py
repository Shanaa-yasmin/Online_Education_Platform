from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseViewSet,
    ModuleViewSet,
    LessonViewSet,
    QuizQuestionViewSet,
    CourseSearchView,
    CourseAutocompleteView,
    ReviewViewSet
)
from .analytics_views import CourseAnalyticsView, MentorOverviewView
from .admin_reports_views import AdminReportsView, AdminReportsExportView

router = DefaultRouter()
router.register('courses', CourseViewSet, basename='course')
router.register('modules', ModuleViewSet, basename='module')
router.register('lessons', LessonViewSet, basename='lesson')
router.register('quiz-questions', QuizQuestionViewSet, basename='quizquestion')
router.register('reviews', ReviewViewSet, basename='review')

urlpatterns = [
    path('courses/search/', CourseSearchView.as_view(), name='course-search'),
    path('courses/autocomplete/', CourseAutocompleteView.as_view(), name='course-autocomplete'),
    path('courses/<int:course_id>/analytics/', CourseAnalyticsView.as_view(), name='course-analytics'),
    path('mentor/dashboard-overview/', MentorOverviewView.as_view(), name='mentor-overview'),
    path('admin-reports/', AdminReportsView.as_view(), name='admin-reports'),
    path('admin-reports/export/', AdminReportsExportView.as_view(), name='admin-reports-export'),
    path('', include(router.urls)),
]
