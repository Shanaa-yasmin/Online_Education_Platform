from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from courses.models import Course
from payments.models import Enrollment, Payment

User = get_user_model()

class PaymentsTests(APITestCase):
    def setUp(self):
        # Create users
        self.student = User.objects.create_user(
            username='student1',
            email='student1@example.com',
            password='password123',
            role='STUDENT'
        )
        self.mentor = User.objects.create_user(
            username='mentor1',
            email='mentor1@example.com',
            password='password123',
            role='MENTOR'
        )
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@example.com',
            password='password123',
            role='ADMIN'
        )

        # Create a paid, approved, and published course
        self.paid_course = Course.objects.create(
            title='Advanced Python',
            description='Learn advanced Python coding.',
            mentor=self.mentor,
            price=Decimal('99.99'),
            level='ADVANCED',
            is_approved=True,
            is_published=True
        )

        # Create a free course
        self.free_course = Course.objects.create(
            title='Intro to HTML',
            description='Learn basic HTML.',
            mentor=self.mentor,
            price=Decimal('0.00'),
            level='BEGINNER',
            is_approved=True,
            is_published=True
        )

    def test_create_checkout_session_paid_course(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('checkout-create-session')
        data = {
            'course_id': self.paid_course.id,
            'gateway': 'STRIPE'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('checkout_url', response.data)
        self.assertIn('transaction_id', response.data)

        # Verify database entities
        enrollment = Enrollment.objects.get(student=self.student, course=self.paid_course)
        self.assertFalse(enrollment.is_active)  # inactive until payment verified

        payment = Payment.objects.get(enrollment=enrollment)
        self.assertEqual(payment.status, Payment.StatusChoices.PENDING)
        self.assertEqual(payment.amount, Decimal('99.99'))

    def test_create_checkout_session_free_course_fails(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('checkout-create-session')
        data = {
            'course_id': self.free_course.id,
            'gateway': 'STRIPE'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_create_checkout_session_invalid_role_fails(self):
        self.client.force_authenticate(user=self.mentor)
        url = reverse('checkout-create-session')
        data = {
            'course_id': self.paid_course.id,
            'gateway': 'STRIPE'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_verify_mock_payment_stripe(self):
        self.client.force_authenticate(user=self.student)
        
        # 1. Create a pending checkout
        enrollment = Enrollment.objects.create(student=self.student, course=self.paid_course, is_active=False)
        mock_session_id = 'mock_stripe_sess_TEST12345'
        payment = Payment.objects.create(
            enrollment=enrollment,
            student=self.student,
            gateway='STRIPE',
            transaction_id=mock_session_id,
            amount=Decimal('99.99'),
            status=Payment.StatusChoices.PENDING
        )

        # 2. Call verify endpoint
        url = reverse('checkout-verify-payment')
        data = {
            'gateway': 'stripe',
            'session_id': mock_session_id,
            'course_id': self.paid_course.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['verified'])

        # Verify update in DB
        payment.refresh_from_db()
        enrollment.refresh_from_db()
        self.assertEqual(payment.status, Payment.StatusChoices.COMPLETED)
        self.assertTrue(enrollment.is_active)

    def test_refund_and_entitlement_rollback(self):
        # 1. Setup completed payment and active enrollment
        enrollment = Enrollment.objects.create(student=self.student, course=self.paid_course, is_active=True)
        mock_transaction_id = 'mock_stripe_sess_REFUND999'
        payment = Payment.objects.create(
            enrollment=enrollment,
            student=self.student,
            gateway='STRIPE',
            transaction_id=mock_transaction_id,
            amount=Decimal('99.99'),
            status=Payment.StatusChoices.COMPLETED
        )

        # 2. Request refund by mentor (mentor of the course)
        self.client.force_authenticate(user=self.mentor)
        url = reverse('payment-refund', kwargs={'pk': payment.id})
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'REFUNDED')

        # Verify database fields update
        payment.refresh_from_db()
        enrollment.refresh_from_db()
        self.assertEqual(payment.status, Payment.StatusChoices.REFUNDED)
        self.assertIsNotNone(payment.refunded_at)
        self.assertFalse(enrollment.is_active)  # rolled back access!

    def test_dashboard_stats_student(self):
        # Enroll student in free course and set progress
        enrollment = Enrollment.objects.create(student=self.student, course=self.free_course, is_active=True, progress_percent=50.0)
        
        self.client.force_authenticate(user=self.student)
        url = reverse('dashboard-stats')
        response = self.client.get(url, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'STUDENT')
        self.assertEqual(response.data['stats']['enrolled_count'], 1)
        self.assertEqual(response.data['stats']['in_progress_count'], 1)
        self.assertEqual(response.data['stats']['completed_count'], 0)
        self.assertEqual(response.data['stats']['hours_learned'], 0)
        self.assertEqual(len(response.data['enrollments']), 1)

    def test_dashboard_stats_mentor(self):
        self.client.force_authenticate(user=self.mentor)
        url = reverse('dashboard-stats')
        response = self.client.get(url, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'MENTOR')
        self.assertEqual(response.data['stats']['courses_count'], 2)  # self.paid_course, self.free_course
        self.assertEqual(response.data['stats']['published_count'], 2)
        self.assertEqual(response.data['stats']['total_students'], 0)
        self.assertEqual(len(response.data['course_performance']), 2)

