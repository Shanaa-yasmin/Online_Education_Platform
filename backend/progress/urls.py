from django.urls import path
from .views import (
    CourseProgressListView,
    CourseProgressDetailView,
    LessonCompleteView,
    LessonResumeView,
    VideoPositionUpdateView
)

urlpatterns = [
    path('', CourseProgressListView.as_view(), name='course-progress-list'),
    path('course/<int:course_id>/', CourseProgressDetailView.as_view(), name='course-progress-detail'),
    path('lesson/<int:lesson_id>/complete/', LessonCompleteView.as_view(), name='lesson-complete'),
    path('lesson/<int:lesson_id>/resume/', LessonResumeView.as_view(), name='lesson-resume'),
    path('video-position/', VideoPositionUpdateView.as_view(), name='video-position-update'),
]
