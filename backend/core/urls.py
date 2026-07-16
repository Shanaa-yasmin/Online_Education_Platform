"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from users.views import ProfileView, ChangePasswordView


def health_check(request):
    """No-auth health check used by Render to verify the service is alive."""
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('api/health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/profile/', ProfileView.as_view(), name='core_profile'),
    path('api/profile/change-password/', ChangePasswordView.as_view(), name='core_change_password'),
    path('api/', include('courses.urls')),
    path('api/progress/', include('progress.urls')),
    path('api/certificates/', include('certificates.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/announcements/', include('announcements.urls')),
]

# In local dev, serve media + static from Django's built-in dev server.
# In production, static files are handled by WhiteNoise; media is on S3.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

