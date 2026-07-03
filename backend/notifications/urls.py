from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, NotificationPreferenceView

router = DefaultRouter()
router.register('', NotificationViewSet, basename='notification')

urlpatterns = [
    # Must come before the router include — otherwise DefaultRouter's
    # detail route ('<pk>/') would try to treat "preferences" as a pk.
    path('preferences/', NotificationPreferenceView.as_view(), name='notification-preferences'),
    path('', include(router.urls)),
]