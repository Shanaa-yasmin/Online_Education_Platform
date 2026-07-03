from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from courses.models import Course, Review
from payments.models import Enrollment, Payment
from notifications.models import Notification

User = get_user_model()

class ProfileAndNotificationTests(APITestCase):
    def setUp(self):
        # 1. Create student and mentor users
        self.student = User.objects.create_user(
            username="student_tester",
            email="student@tester.com",
            password="password123",
            role=User.Role.STUDENT
        )
        self.mentor = User.objects.create_user(
            username="mentor_tester",
            email="mentor@tester.com",
            password="password123",
            role=User.Role.MENTOR
        )
        
        # 2. Create a course owned by the mentor
        self.course = Course.objects.create(
            title="Introduction to testing",
            description="Let's write robust tests",
            mentor=self.mentor,
            price=25.00,
            is_approved=True,
            is_published=True
        )

    def test_profile_retrieve_and_statistics(self):
        # Authenticate student
        self.client.force_authenticate(user=self.student)
        url = reverse('core_profile')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('stats', response.data)
        self.assertEqual(response.data['stats']['courses_enrolled'], 0)
        
        # Now enroll the student and verify stats change
        enrollment = Enrollment.objects.create(student=self.student, course=self.course, is_active=True)
        response = self.client.get(url)
        self.assertEqual(response.data['stats']['courses_enrolled'], 1)

    def test_profile_patch_update(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('core_profile')
        
        payload = {
            "first_name": "John",
            "last_name": "Doe",
            "profile": {
                "bio": "Avid learner.",
                "phone_number": "123-456-7890",
                "location": "New York"
            }
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], "John")
        self.assertEqual(response.data['profile']['bio'], "Avid learner.")
        self.assertEqual(response.data['profile']['location'], "New York")

    def test_change_password(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('core_change_password')
        
        payload = {
            "current_password": "password123",
            "new_password": "new_password123",
            "new_password_confirm": "new_password123"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify old password no longer works
        self.assertFalse(self.student.check_password("password123"))
        
        # Reload user and check new password
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password("new_password123"))

    def test_review_posting_constraints(self):
        # 1. Enforce student cannot review if not enrolled
        self.client.force_authenticate(user=self.student)
        url = reverse('course-reviews', kwargs={'pk': self.course.id})
        
        payload = {"rating": 5, "comment": "Amazing course!"}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("You must be enrolled in the course", str(response.data))

        # 2. Enroll student and post review successfully
        enrollment = Enrollment.objects.create(student=self.student, course=self.course, is_active=True)
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['rating'], 5)

        # 3. Second POST updates existing review instead of rejecting (create-or-update)
        updated_payload = {"rating": 4, "comment": "Updated review!"}
        response = self.client.post(url, updated_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['rating'], 4)
        self.assertEqual(response.data['comment'], "Updated review!")

    def test_notifications_list_and_read(self):
        self.client.force_authenticate(user=self.student)
        
        # Create a notification
        notification = Notification.objects.create(
            recipient=self.student,
            title="Important Alert",
            message="Test message details."
        )
        
        # Retrieve notification list
        list_url = reverse('notification-list')
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Support both paginated (dict with results) and non-paginated (list) results
        data_list = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data_list), 1)
        self.assertEqual(data_list[0]['title'], "Important Alert")
        self.assertEqual(data_list[0]['is_read'], False)

        # Mark as read
        read_url = reverse('notification-mark-as-read', kwargs={'pk': notification.id})
        response = self.client.post(read_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_read'], True)

    def test_notifications_pagination_search_filter(self):
        self.client.force_authenticate(user=self.student)
        
        # Create 12 notifications, some read, some unread, some with search terms
        for i in range(12):
            Notification.objects.create(
                recipient=self.student,
                title=f"Notification {i}" if i != 5 else "Special Subject",
                message=f"Body details {i}",
                is_read=(i % 2 == 0) # 0, 2, 4, 6, 8, 10 are read (6 total); 1, 3, 5, 7, 9, 11 are unread (6 total)
            )
            
        list_url = reverse('notification-list')
        
        # Test pagination (should return 10 results by default page size)
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], 12)
        self.assertEqual(response.data['unread_count'], 6)
        
        # Test page 2 (should return 2 results)
        response = self.client.get(list_url, {'page': 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        
        # Test filter is_read=true
        response = self.client.get(list_url, {'is_read': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 6)
        for item in response.data['results']:
            self.assertTrue(item['is_read'])
            
        # Test filter is_read=false
        response = self.client.get(list_url, {'is_read': 'false'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 6)
        for item in response.data['results']:
            self.assertFalse(item['is_read'])
            
        # Test search
        response = self.client.get(list_url, {'search': 'Special'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], "Special Subject")

