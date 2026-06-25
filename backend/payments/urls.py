from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet, LessonProgressViewSet, CheckoutViewSet, PaymentViewSet

router = DefaultRouter()
router.register('enrollments', EnrollmentViewSet, basename='enrollment')
router.register('progress',    LessonProgressViewSet, basename='progress')
router.register('checkout',    CheckoutViewSet, basename='checkout')
router.register('payments',    PaymentViewSet,  basename='payment')

urlpatterns = [
    path('', include(router.urls)),
]