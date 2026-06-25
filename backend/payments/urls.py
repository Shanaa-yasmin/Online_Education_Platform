from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet, LessonProgressViewSet, CheckoutViewSet, PaymentViewSet, DashboardStatsView

router = DefaultRouter()
router.register('enrollments', EnrollmentViewSet, basename='enrollment')
router.register('progress',    LessonProgressViewSet, basename='progress')
router.register('checkout',    CheckoutViewSet, basename='checkout')
router.register('payments',    PaymentViewSet,  basename='payment')

urlpatterns = [
    path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('', include(router.urls)),
]