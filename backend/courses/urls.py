from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CourseViewSet,
    ModuleViewSet,
    LessonViewSet,
    QuizQuestionViewSet,
    CourseSearchView
)

router = DefaultRouter()
router.register('courses', CourseViewSet, basename='course')
router.register('modules', ModuleViewSet, basename='module')
router.register('lessons', LessonViewSet, basename='lesson')
router.register('quiz-questions', QuizQuestionViewSet, basename='quizquestion')

urlpatterns = [
    path('courses/search/', CourseSearchView.as_view(), name='course-search'),
    path('', include(router.urls)),
]
