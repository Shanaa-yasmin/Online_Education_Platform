from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Course, Module, Lesson, QuizQuestion, QuizOption

User = get_user_model()

class CourseAPITests(APITestCase):
    def setUp(self):
        # Create users
        self.mentor1 = User.objects.create_user(
            username='mentor1',
            email='mentor1@test.com',
            password='testpassword123',
            role=User.Role.MENTOR
        )
        if hasattr(self.mentor1, 'profile'):
            self.mentor1.profile.is_approved = True
            self.mentor1.profile.save()
        self.mentor2 = User.objects.create_user(
            username='mentor2',
            email='mentor2@test.com',
            password='testpassword123',
            role=User.Role.MENTOR
        )
        self.student = User.objects.create_user(
            username='student1',
            email='student1@test.com',
            password='testpassword123',
            role=User.Role.STUDENT
        )
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@test.com',
            password='testpassword123',
            role=User.Role.ADMIN,
            is_staff=True
        )

        # Create Courses
        self.course_published_approved = Course.objects.create(
            title="Approved & Published Python Course",
            description="Learn python coding",
            mentor=self.mentor1,
            price=29.99,
            level=Course.Level.BEGINNER,
            is_approved=True,
            is_published=True
        )
        
        self.course_draft = Course.objects.create(
            title="Python Draft Course",
            description="Under development",
            mentor=self.mentor1,
            price=19.99,
            level=Course.Level.INTERMEDIATE,
            is_approved=False,
            is_published=False
        )

        # Create modules & lessons
        self.module = Module.objects.create(
            course=self.course_published_approved,
            title="Introduction",
            order=1
        )
        self.lesson_quiz = Lesson.objects.create(
            module=self.module,
            title="Python Syntax Quiz",
            content_type=Lesson.ContentType.QUIZ,
            order=1
        )
        self.quiz_question = QuizQuestion.objects.create(
            lesson=self.lesson_quiz,
            question_type=QuizQuestion.QuestionType.SINGLE_CHOICE,
            question_text="What is the print function output for print(2+2)?",
            points=1,
            order=1
        )
        self.option_a = QuizOption.objects.create(question=self.quiz_question, text="22", is_correct=False, order=1)
        self.option_b = QuizOption.objects.create(question=self.quiz_question, text="4", is_correct=True, order=2)
        self.option_c = QuizOption.objects.create(question=self.quiz_question, text="Error", is_correct=False, order=3)
        self.option_d = QuizOption.objects.create(question=self.quiz_question, text="None", is_correct=False, order=4)

    def test_student_cannot_create_course(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('course-list')
        data = {
            "title": "New React Course",
            "description": "Learn react web dev",
            "price": 49.99,
            "level": "BEGINNER",
            "language": "English"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mentor_can_create_course(self):
        self.client.force_authenticate(user=self.mentor1)
        url = reverse('course-list')
        data = {
            "title": "New React Course",
            "description": "Learn react web dev",
            "price": "49.99",
            "level": "BEGINNER",
            "language": "English"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], "New React Course")
        self.assertEqual(response.data['mentor']['username'], "mentor1")
        self.assertEqual(response.data['is_approved'], False) # Newly created course must be unapproved

    def test_unapproved_mentor_cannot_create_course(self):
        self.client.force_authenticate(user=self.mentor2)
        url = reverse('course-list')
        data = {
            "title": "Unapproved React Course",
            "description": "Learn react web dev",
            "price": "49.99",
            "level": "BEGINNER",
            "language": "English"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrator should approve to create course", response.data['detail'])

    def test_course_listings_visibility(self):
        # 1. Student should only see Approved and Published courses
        self.client.force_authenticate(user=self.student)
        url = reverse('course-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see 1 course (the approved & published one)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], self.course_published_approved.title)

        # 2. Mentor who owns the draft course should see both their draft and published courses
        self.client.force_authenticate(user=self.mentor1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Mentor1 owns one draft and one published course, plus can view all other published courses (total 2)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 2)

        # 3. Mentor2 who doesn't own the draft course should only see the published course
        self.client.force_authenticate(user=self.mentor2)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)

    def test_quiz_question_correct_option_visibility(self):
        # 1. Student should not see the is_correct field or explanation in quiz question detail queries
        self.client.force_authenticate(user=self.student)
        url = reverse('quizquestion-detail', kwargs={'pk': self.quiz_question.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # options array should not have 'is_correct' for student
        for opt in response.data['options']:
            self.assertNotIn('is_correct', opt)
        self.assertNotIn('explanation', response.data)

        # 2. Mentor (creator) should see the is_correct field and explanation
        self.client.force_authenticate(user=self.mentor1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(opt['is_correct'] for opt in response.data['options']))
        self.assertIn('explanation', response.data)

    def test_quiz_attempt_start(self):
        # Student should be able to start an attempt
        # Enroll first (since it's a student)
        from payments.models import Enrollment
        Enrollment.objects.create(student=self.student, course=self.course_published_approved, is_active=True)

        self.client.force_authenticate(user=self.student)
        # Endpoint: POST /api/quiz-attempts/lessons/{lesson_pk}/start/
        url = f"/api/payments/quiz-attempts/lessons/{self.lesson_quiz.pk}/start/"
        # Let's check what the base path for courses views is:
        # Actually it's registered under router which is included in core/urls.py as:
        # path('api/courses/', include('courses.urls'))
        # Let's check:
        # wait! In urls.py: path('api/courses/', include('courses.urls'))
        # So it is: /api/quiz-attempts/lessons/{lesson_pk}/start/
        url = f"/api/quiz-attempts/lessons/{self.lesson_quiz.pk}/start/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('attempt_number', response.data)

    def test_admin_approve_course(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('course-approve', kwargs={'pk': self.course_draft.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course_draft.refresh_from_db()
        self.assertTrue(self.course_draft.is_approved)

    def test_mentor_cannot_approve_course(self):
        self.client.force_authenticate(user=self.mentor1)
        url = reverse('course-approve', kwargs={'pk': self.course_draft.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mentor_publish_course(self):
        self.client.force_authenticate(user=self.mentor1)
        # Approve the draft course first (required by the publish action)
        self.client.force_authenticate(user=self.admin)
        approve_url = reverse('course-approve', kwargs={'pk': self.course_draft.pk})
        self.client.post(approve_url)
        self.course_draft.refresh_from_db()

        # Now publish as the mentor
        self.client.force_authenticate(user=self.mentor1)
        url = reverse('course-publish', kwargs={'pk': self.course_draft.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course_draft.refresh_from_db()
        self.assertTrue(self.course_draft.is_published)
