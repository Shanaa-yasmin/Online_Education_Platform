from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics_views import CourseAnalyticsView, MentorOverviewView
from .admin_reports_views import AdminReportsView, AdminReportsExportView, AdminReportFilterOptionsView
from .search_views import CourseSearchView, CourseAutocompleteView
from .views import (
    CourseViewSet,
    LessonViewSet,
    ModuleViewSet,
    QuizAttemptViewSet,
    QuizQuestionViewSet,
    ReviewViewSet,
    AdminReviewReportViewSet,
)

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'reviews', ReviewViewSet, basename='review')
router.register(r'admin/review-reports', AdminReviewReportViewSet, basename='admin-review-report')
router.register(r'modules', ModuleViewSet, basename='module')

router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'quiz-questions', QuizQuestionViewSet, basename='quizquestion')
router.register(r'quiz-attempts', QuizAttemptViewSet, basename='quizattempt')

urlpatterns = [
    # Keep static course paths above router include to prevent course detail collisions.
    path('courses/search/', CourseSearchView.as_view(), name='course-search'),
    path('courses/autocomplete/', CourseAutocompleteView.as_view(), name='course-autocomplete'),
    path('courses/<int:course_id>/analytics/', CourseAnalyticsView.as_view(), name='course-analytics'),
    path('mentor/overview/', MentorOverviewView.as_view(), name='mentor-overview'),
    path('admin-reports/', AdminReportsView.as_view(), name='admin-reports'),
    path('admin-reports/export/', AdminReportsExportView.as_view(), name='admin-reports-export'),
    path('admin-reports/filter-options/', AdminReportFilterOptionsView.as_view(), name='admin-reports-filter-options'),
    path('', include(router.urls)),
]