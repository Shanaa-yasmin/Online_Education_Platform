from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Course, Module, Lesson, QuizQuestion

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
            question_text="What is the print function output for print(2+2)?",
            option_a="22",
            option_b="4",
            option_c="Error",
            option_d="None",
            correct_option=QuizQuestion.CorrectOptionChoices.B
        )

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

    def test_course_listings_visibility(self):
        # 1. Student should only see Approved and Published courses
        self.client.force_authenticate(user=self.student)
        url = reverse('course-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see 1 course (the approved & published one)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], self.course_published_approved.title)

        # 2. Mentor who owns the draft course should see both their draft and published courses
        self.client.force_authenticate(user=self.mentor1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Mentor1 owns one draft and one published course, plus can view all other published courses (total 2)
        self.assertEqual(len(response.data), 2)

        # 3. Mentor2 who doesn't own the draft course should only see the published course
        self.client.force_authenticate(user=self.mentor2)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_quiz_question_correct_option_visibility(self):
        # 1. Student should not see the correct_option field in quiz question GET queries
        self.client.force_authenticate(user=self.student)
        url = reverse('quizquestion-detail', kwargs={'pk': self.quiz_question.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('correct_option', response.data)

        # 2. Mentor (creator) should see the correct_option field
        self.client.force_authenticate(user=self.mentor1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('correct_option', response.data)
        self.assertEqual(response.data['correct_option'], 'B')

    def test_quiz_question_check_answer_endpoint(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('quizquestion-check-answer', kwargs={'pk': self.quiz_question.pk})

        response = self.client.post(url, {"selected_option": "B"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_correct'])
        self.assertEqual(response.data['correct_option'], 'B')
        self.assertEqual(response.data['selected_option'], 'B')

        response = self.client.post(url, {"selected_option": "A"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_correct'])
        self.assertEqual(response.data['correct_option'], 'B')

    def test_quiz_question_check_answer_rejects_invalid_option(self):
        self.client.force_authenticate(user=self.student)
        url = reverse('quizquestion-check-answer', kwargs={'pk': self.quiz_question.pk})

        response = self.client.post(url, {"selected_option": "E"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'selected_option must be one of A, B, C, D.')

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
        url = reverse('course-publish', kwargs={'pk': self.course_draft.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course_draft.refresh_from_db()
        self.assertTrue(self.course_draft.is_published)
