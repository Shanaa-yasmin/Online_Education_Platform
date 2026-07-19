from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()

class AuthTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('auth_register')
        self.login_url = reverse('auth_login')
        self.profile_url = reverse('auth_profile')
        self.logout_url = reverse('auth_logout')
        self.refresh_url = reverse('auth_refresh')
        
        self.student_data = {
            'username': 'student1',
            'email': 'student@platform.com',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'role': 'STUDENT',
            'bio': 'I am a computer science student.'
        }
        
        self.mentor_data = {
            'username': 'mentor1',
            'email': 'mentor@platform.com',
            'password': 'Password123!',
            'password_confirm': 'Password123!',
            'role': 'MENTOR',
            'title': 'Senior Software Architect',
            'skills': 'Python, Django, React'
        }

    def test_register_student_success(self):
        response = self.client.post(self.register_url, self.student_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh_token', response.cookies)
        self.assertEqual(response.data['user']['username'], 'student1')
        self.assertEqual(response.data['user']['email'], 'student@platform.com')
        self.assertEqual(response.data['user']['role'], 'STUDENT')
        self.assertEqual(response.data['user']['profile']['bio'], 'I am a computer science student.')

    def test_register_mentor_success(self):
        response = self.client.post(self.register_url, self.mentor_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['profile']['title'], 'Senior Software Architect')
        self.assertEqual(response.data['user']['profile']['skills'], 'Python, Django, React')

    def test_register_password_mismatch(self):
        data = self.student_data.copy()
        data['password_confirm'] = 'DifferentPassword123!'
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_login_only_by_email(self):
        # Register a user first
        self.client.post(self.register_url, self.student_data, format='json')
        
        # Try to login with username (should fail as we removed username field from input)
        login_data_username = {
            'username': 'student1',
            'password': 'Password123!'
        }
        response = self.client.post(self.login_url, login_data_username, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)  # email is required
        
        # Login with email
        login_data_email = {
            'email': 'student@platform.com',
            'password': 'Password123!'
        }
        response = self.client.post(self.login_url, login_data_email, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], 'student1')
        self.assertEqual(response.data['user']['role'], 'STUDENT')

    def test_profile_retrieve_and_update(self):
        # Register and get token
        reg_response = self.client.post(self.register_url, self.student_data, format='json')
        token = reg_response.data['access']
        
        # Set authorization header
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        
        # Retrieve profile
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['profile']['bio'], 'I am a computer science student.')
        
        # Update profile
        update_data = {
            'username': 'student_new',
            'profile': {
                'bio': 'Updated bio description.',
                'title': 'Wannabe developer'
            }
        }
        response = self.client.patch(self.profile_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'student_new')
        self.assertEqual(response.data['profile']['bio'], 'Updated bio description.')
        self.assertEqual(response.data['profile']['title'], 'Wannabe developer')

    def test_logout_blacklists_token(self):
        reg_response = self.client.post(self.register_url, self.student_data, format='json')
        access = reg_response.data['access']
        refresh = reg_response.cookies['refresh_token'].value
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        
        # Logout using the refresh token (API expects it via cookie or body)
        # Note: the logout view expects cookie or body.
        self.client.cookies['refresh_token'] = refresh
        logout_response = self.client.post(self.logout_url, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        
        # Try to refresh with the blacklisted token (should fail)
        self.client.cookies['refresh_token'] = refresh
        refresh_response = self.client.post(self.refresh_url, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_email_verification_success(self):
        from django.core import signing
        # Register user
        reg_res = self.client.post(self.register_url, self.student_data, format='json')
        self.assertEqual(reg_res.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(email='student@platform.com')
        self.assertFalse(user.is_email_verified)
        
        # Generate token using signing
        token = signing.dumps({"user_id": user.pk})
        verify_url = reverse('auth_verify_email')
        
        verify_res = self.client.post(verify_url, {'token': token}, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
