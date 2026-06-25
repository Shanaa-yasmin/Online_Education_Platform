from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/course/(?P<course_id>[^/.]+)/qa/$', consumers.ChatConsumer.as_asgi()),
]
