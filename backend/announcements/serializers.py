from rest_framework import serializers
from .models import Announcement
from courses.models import Course

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    created_by_role = serializers.CharField(source='created_by.role', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'content', 'created_by', 'created_by_name',
            'created_by_role', 'course', 'course_title', 'is_pinned',
            'created_at'
        ]
        read_only_fields = ['created_by', 'created_at']

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            return attrs

        user = request.user
        course = attrs.get('course')

        if user.role == 'MENTOR':
            if not course:
                raise serializers.ValidationError({
                    "course": "Mentors must associate announcements with a specific course."
                })
            if course.mentor != user:
                raise serializers.ValidationError({
                    "course": "You can only post announcements to courses you own."
                })
        elif user.role == 'STUDENT':
            raise serializers.ValidationError("Students cannot create announcements.")

        return attrs
