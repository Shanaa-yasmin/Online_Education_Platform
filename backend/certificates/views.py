from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Certificate
from .serializers import CertificateSerializer


class CertificateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Certificate.objects.all()
    serializer_class = CertificateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'ADMIN':
            return Certificate.objects.filter(enrollment__is_active=True).order_by('-issued_at')
        return Certificate.objects.filter(student=user, enrollment__is_active=True).order_by('-issued_at')

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        url_path=r'verify/(?P<code_str>[^/.]+)',
    )
    def verify(self, request, code_str=None):
        try:
            cert = Certificate.objects.get(certificate_code=code_str, enrollment__is_active=True)
            serializer = self.get_serializer(cert)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Certificate.DoesNotExist:
            return Response({"detail": "Invalid or revoked certificate code."}, status=status.HTTP_404_NOT_FOUND)
