from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from courses.models import Course
from payments.models import Enrollment
from certificates.models import Certificate

User = get_user_model()

class CertificateEntitlementTests(APITestCase):
    def setUp(self):
        # Create users
        self.mentor = User.objects.create_user(
            username='mentor_test', 
            email='mentor@test.com', 
            password='password123',
            role='MENTOR'
        )
        self.student = User.objects.create_user(
            username='student_test', 
            email='student@test.com', 
            password='password123',
            role='STUDENT'
        )
        
        # Create a course
        self.course = Course.objects.create(
            title='Test Course',
            description='Test description',
            mentor=self.mentor,
            price=99.99,
            is_approved=True,
            is_published=True
        )
        
        # Create active enrollment
        self.enrollment = Enrollment.objects.create(
            student=self.student,
            course=self.course,
            is_active=True,
            progress_percent=100.0
        )
        
        # Issue completion certificate
        self.certificate = Certificate.objects.create(
            enrollment=self.enrollment,
            student=self.student,
            course=self.course,
            certificate_code='CERT-TEST-12345'
        )

    def test_certificate_visibility_for_active_enrollment(self):
        self.client.force_authenticate(user=self.student)
        
        # 1. Check visibility in profile endpoint
        profile_res = self.client.get('/api/profile/')
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        stats = profile_res.data.get('stats', {})
        self.assertEqual(stats.get('certificates_earned'), 1)
        self.assertEqual(len(stats.get('certificates', [])), 1)
        self.assertEqual(stats.get('certificates')[0]['certificate_code'], 'CERT-TEST-12345')
        
        # 2. Check visibility in certificate listing viewset
        list_res = self.client.get('/api/certificates/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 1)
        
        # 3. Check public verify endpoint
        verify_res = self.client.get(f'/api/certificates/verify/CERT-TEST-12345/')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data['certificate_code'], 'CERT-TEST-12345')

    def test_certificate_hidden_after_enrollment_deactivation(self):
        # Refund/Deactivate enrollment
        self.enrollment.is_active = False
        self.enrollment.save()
        
        self.client.force_authenticate(user=self.student)
        
        # 1. Assert hidden on profile endpoint
        profile_res = self.client.get('/api/profile/')
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        stats = profile_res.data.get('stats', {})
        self.assertEqual(stats.get('certificates_earned'), 0)
        self.assertEqual(len(stats.get('certificates', [])), 0)
        
        # 2. Assert hidden on listing viewset
        list_res = self.client.get('/api/certificates/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 0)
        
        # 3. Assert verify returns 404 Not Found (revoked)
        verify_res = self.client.get(f'/api/certificates/verify/CERT-TEST-12345/')
        self.assertEqual(verify_res.status_code, status.HTTP_404_NOT_FOUND)
