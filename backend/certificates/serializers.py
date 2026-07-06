from rest_framework import serializers
from .models import Certificate
from courses.serializers import UserMiniSerializer, CourseListSerializer


class CertificateSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)
    course_details = CourseListSerializer(source='course', read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            'id', 'student', 'course', 'course_details', 
            'certificate_code', 'issued_at', 'pdf_url'
        ]
        read_only_fields = fields

    def get_pdf_url(self, obj):
        request = self.context.get('request')
        if obj.pdf_file and request:
            return request.build_absolute_uri(obj.pdf_file.url)
        return None
