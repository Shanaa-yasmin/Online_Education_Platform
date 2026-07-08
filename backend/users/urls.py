from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    LogoutView,
    ProfileView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AdminProfileListView,
    AdminProfileApproveView,
    AdminProfileRejectView,
    ChangePasswordView,
    AdminUserViewSet,
)

# Router for the new Admin User Management ViewSet
admin_user_router = DefaultRouter()
admin_user_router.register(r'users', AdminUserViewSet, basename='admin-users')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('profile/', ProfileView.as_view(), name='auth_profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='auth_change_password'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    # Legacy Mentor Moderation Endpoints (kept for backwards compatibility)
    path('profiles/', AdminProfileListView.as_view(), name='admin_profiles_list'),
    path('profiles/<int:pk>/approve/', AdminProfileApproveView.as_view(), name='admin_profile_approve'),
    path('profiles/<int:pk>/reject/', AdminProfileRejectView.as_view(), name='admin_profile_reject'),

    # Admin User Management (new)
    path('admin/', include(admin_user_router.urls)),
]
