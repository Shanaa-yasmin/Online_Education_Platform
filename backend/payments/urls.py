from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet, LessonProgressViewSet

router = DefaultRouter()
router.register('enrollments', EnrollmentViewSet, basename='enrollment')
router.register('progress', LessonProgressViewSet, basename='progress')

urlpatterns = [
    path('', include(router.urls)),
]
