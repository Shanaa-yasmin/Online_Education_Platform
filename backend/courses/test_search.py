"""
Tests for the Elasticsearch-powered course search and autocomplete endpoints.

These tests exercise the ORM fallback path (ES_ENABLED is typically false
in the test runner unless a real ES instance is available), which validates
that the API contract is preserved regardless of the search backend.
"""
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import Course, Review

User = get_user_model()


@override_settings(ES_ENABLED=False)
class CourseSearchAPITests(APITestCase):
    def setUp(self):
        # Create users
        self.mentor = User.objects.create_user(
            username='mentor_bob',
            email='bob@test.com',
            password='testpassword123',
            role=User.Role.MENTOR
        )
        self.student = User.objects.create_user(
            username='student_alice',
            email='alice@test.com',
            password='testpassword123',
            role=User.Role.STUDENT
        )

        # Create Courses
        self.course_py = Course.objects.create(
            title="Advanced Python Programming",
            description="Master python concepts",
            mentor=self.mentor,
            price=50.00,
            level=Course.Level.ADVANCED,
            language="English",
            is_approved=True,
            is_published=True
        )
        self.course_js = Course.objects.create(
            title="Beginner JavaScript Essentials",
            description="Learn web coding basics",
            mentor=self.mentor,
            price=0.00,
            level=Course.Level.BEGINNER,
            language="English",
            is_approved=True,
            is_published=True
        )
        self.course_draft = Course.objects.create(
            title="React Native Draft",
            description="Under development",
            mentor=self.mentor,
            price=19.99,
            level=Course.Level.INTERMEDIATE,
            language="English",
            is_approved=False,
            is_published=False
        )

        # Create reviews to test rating filtering
        Review.objects.create(
            course=self.course_py,
            student=self.student,
            rating=5,
            comment="Awesome course!"
        )
        Review.objects.create(
            course=self.course_js,
            student=self.student,
            rating=3,
            comment="Okayish"
        )

    def test_search_list_public(self):
        # Unauthenticated users can search
        url = reverse('course-search')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Draft course must be excluded
        self.assertEqual(len(response.data['results']), 2)
        self.assertIn('facets', response.data)

    def test_keyword_search(self):
        url = reverse('course-search')
        response = self.client.get(url, {'search': 'Python'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], "Advanced Python Programming")

        # Search by description
        response = self.client.get(url, {'search': 'essentials'})
        self.assertEqual(len(response.data['results']), 1)

        # Search by mentor username
        response = self.client.get(url, {'search': 'bob'})
        self.assertEqual(len(response.data['results']), 2)

    def test_filter_by_level(self):
        url = reverse('course-search')
        response = self.client.get(url, {'level': 'BEGINNER'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['level'], 'BEGINNER')

    def test_filter_by_price_range(self):
        url = reverse('course-search')
        response = self.client.get(url, {'min_price': 10.00, 'max_price': 60.00})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], "Advanced Python Programming")

    def test_filter_is_free(self):
        url = reverse('course-search')
        response = self.client.get(url, {'is_free': 'true'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['price'], '0.00')

        response = self.client.get(url, {'is_free': 'false'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['price'], '50.00')

    def test_filter_by_rating(self):
        url = reverse('course-search')
        response = self.client.get(url, {'min_rating': 4.0})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['title'], "Advanced Python Programming")

    def test_ordering(self):
        url = reverse('course-search')
        # Ordering by price ascending
        response = self.client.get(url, {'ordering': 'price'})
        self.assertEqual(response.data['results'][0]['price'], '0.00')
        self.assertEqual(response.data['results'][1]['price'], '50.00')

        # Ordering by price descending
        response = self.client.get(url, {'ordering': '-price'})
        self.assertEqual(response.data['results'][0]['price'], '50.00')
        self.assertEqual(response.data['results'][1]['price'], '0.00')

    def test_response_has_count_and_pagination(self):
        """The new search view always returns count, next, previous."""
        url = reverse('course-search')
        response = self.client.get(url)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertEqual(response.data['count'], 2)

    def test_facets_include_categories(self):
        """ES-powered response now also returns categories facet."""
        url = reverse('course-search')
        response = self.client.get(url)
        self.assertIn('facets', response.data)
        facets = response.data['facets']
        self.assertIn('levels', facets)
        self.assertIn('languages', facets)
        self.assertIn('price_range', facets)
        # ORM fallback also returns categories
        self.assertIn('categories', facets)


@override_settings(ES_ENABLED=False)
class CourseAutocompleteAPITests(APITestCase):
    def setUp(self):
        self.mentor = User.objects.create_user(
            username='mentor_bob',
            email='bob@test.com',
            password='testpassword123',
            role=User.Role.MENTOR
        )
        self.course = Course.objects.create(
            title="Python Masterclass",
            description="Deep Python",
            mentor=self.mentor,
            price=25.00,
            level=Course.Level.INTERMEDIATE,
            language="English",
            is_approved=True,
            is_published=True
        )

    def test_autocomplete_minimum_length(self):
        url = reverse('course-autocomplete')
        response = self.client.get(url, {'q': 'P'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return empty for < 2 chars
        self.assertEqual(len(response.data.get('courses', [])), 0)

    def test_autocomplete_returns_courses_and_mentors(self):
        """New format returns { courses: [...], mentors: [...] }."""
        url = reverse('course-autocomplete')
        response = self.client.get(url, {'q': 'Py'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('courses', response.data)
        self.assertIn('mentors', response.data)
        self.assertGreater(len(response.data['courses']), 0)
        self.assertEqual(response.data['courses'][0]['title'], "Python Masterclass")

    def test_autocomplete_no_draft_courses(self):
        Course.objects.create(
            title="Python Draft",
            description="Draft course",
            mentor=self.mentor,
            price=10.00,
            is_approved=False,
            is_published=False
        )
        url = reverse('course-autocomplete')
        response = self.client.get(url, {'q': 'Python'})
        # Only the published course should appear
        titles = [c['title'] for c in response.data.get('courses', [])]
        self.assertNotIn("Python Draft", titles)
        self.assertIn("Python Masterclass", titles)
