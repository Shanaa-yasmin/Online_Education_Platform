from rest_framework import status, generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    CustomTokenObtainPairSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer
)

User = get_user_model()

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Generate JWT tokens for auto-login
            tokens = get_tokens_for_user(user)
            
            # Serialize created user details
            user_data = UserSerializer(user).data
            
            return Response({
                "user": user_data,
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "detail": "Registration successful. Logged in automatically."
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        
        # Add role-specific statistics
        stats = {}
        user = instance
        
        if user.role == 'STUDENT':
            from payments.models import Enrollment, Certificate
            enrollments = Enrollment.objects.filter(student=user, is_active=True)
            completed_enrollments = enrollments.filter(progress_percent=100.0)
            certificates = Certificate.objects.filter(student=user)
            
            # Simple calculations
            progress_sum = sum(e.progress_percent for e in enrollments)
            learning_progress = float(progress_sum / enrollments.count()) if enrollments.exists() else 0.0
            
            stats = {
                'courses_enrolled': enrollments.count(),
                'courses_completed': completed_enrollments.count(),
                'certificates_earned': certificates.count(),
                'current_streak': 3,  # Modern default streak
                'learning_progress': round(learning_progress, 1),
                'recent_learning': [
                    {
                        'id': e.course.id,
                        'title': e.course.title,
                        'thumbnail': e.course.thumbnail.url if e.course.thumbnail else None,
                        'level': e.course.get_level_display(),
                        'duration_hours': e.course.duration_hours,
                        'mentor_name': e.course.mentor.username,
                        'progress_percent': float(e.progress_percent),
                    } for e in enrollments.order_by('-enrolled_at')[:4]
                ],
                'certificates': [
                    {
                        'id': c.id,
                        'course_title': c.course.title,
                        'certificate_code': c.certificate_code,
                        'issued_at': c.created_at.strftime('%Y-%m-%d') if hasattr(c, 'created_at') else '2026-06-28',
                        'pdf_url': request.build_absolute_uri(c.pdf_file.url) if c.pdf_file else None,
                    } for c in certificates
                ]
            }
            
        elif user.role == 'MENTOR':
            from courses.models import Course, Review
            from payments.models import Enrollment, Payment
            from django.db.models import Sum, Avg
            
            courses = Course.objects.filter(mentor=user)
            published = courses.filter(is_published=True, is_approved=True)
            drafts = courses.filter(is_published=False) | courses.filter(is_approved=False)
            drafts = drafts.distinct()
            
            mentor_course_ids = courses.values_list('id', flat=True)
            enrollments = Enrollment.objects.filter(course_id__in=mentor_course_ids, is_active=True)
            reviews = Review.objects.filter(course_id__in=mentor_course_ids)
            
            avg_rating = reviews.aggregate(avg=Avg('rating'))['avg'] or 0.0
            payments = Payment.objects.filter(enrollment__course_id__in=mentor_course_ids, status=Payment.StatusChoices.COMPLETED)
            
            total_earnings = payments.aggregate(total=Sum('amount'))['total'] or 0.00
            
            from django.utils import timezone
            from datetime import timedelta
            last_30_days = timezone.now() - timedelta(days=30)
            monthly_payments = payments.filter(created_at__gte=last_30_days)
            monthly_earnings = monthly_payments.aggregate(total=Sum('amount'))['total'] or 0.00
            
            stats = {
                'courses_created': courses.count(),
                'published_courses': published.count(),
                'draft_courses': drafts.count(),
                'students_enrolled': enrollments.count(),
                'avg_rating': round(float(avg_rating), 1),
                'total_reviews': reviews.count(),
                'total_earnings': float(total_earnings),
                'monthly_earnings': float(monthly_earnings),
                'recent_sales': [
                    {
                        'id': p.id,
                        'course_title': p.enrollment.course.title,
                        'student_name': p.student.username,
                        'amount': float(p.amount),
                        'created_at': p.created_at.strftime('%Y-%m-%d %H:%M'),
                    } for p in payments.order_by('-created_at')[:5]
                ],
                'latest_courses': [
                    {
                        'id': c.id,
                        'title': c.title,
                        'status': 'Approved' if c.is_approved else ('Pending Approval' if c.is_published else 'Draft'),
                        'students_count': c.enrollments.filter(is_active=True).count(),
                        'rating_average': float(c.rating_average),
                        'thumbnail': c.thumbnail.url if c.thumbnail else None,
                    } for c in courses.order_by('-created_at')[:4]
                ]
            }
            
        elif user.role == 'ADMIN':
            from django.contrib.auth import get_user_model
            from courses.models import Course
            from chat.models import ChatMessage
            from .models import Profile as UserProfile
            
            UserClass = get_user_model()
            total_users = UserClass.objects.count()
            students_count = UserClass.objects.filter(role='STUDENT').count()
            mentors_count = UserClass.objects.filter(role='MENTOR').count()
            courses_count = Course.objects.count()
            
            pending_mentors = UserProfile.objects.filter(user__role='MENTOR', is_approved=False).count()
            pending_courses = Course.objects.filter(is_approved=False).count()
            reported_msg = ChatMessage.objects.filter(is_flagged_abuse=True).count()
            
            stats = {
                'total_users': total_users,
                'students': students_count,
                'mentors': mentors_count,
                'courses': courses_count,
                'pending_mentor_requests': pending_mentors,
                'pending_course_approvals': pending_courses,
                'reported_messages': reported_msg,
                'recent_activities': [
                    {
                        'type': 'MENTOR_SIGNUP',
                        'message': f"New mentor '{p.user.username}' signed up, waiting for approval.",
                        'time': p.user.date_joined.strftime('%Y-%m-%d %H:%M') if p.user.date_joined else 'Just now'
                    } for p in UserProfile.objects.filter(user__role='MENTOR', is_approved=False).order_by('-user__date_joined')[:5]
                ]
            }
            
        data['stats'] = stats
        return Response(data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .serializers import ChangePasswordSerializer
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({"detail": "Password has been changed successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email=email)
            
            # Generate reset token and encoded user ID
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Construct reset URL
            reset_link = f"http://localhost:5173/password-reset/confirm?uid={uid}&token={token}"
            
            # Print mock email details to standard output
            print("\n" + "="*60)
            print("MOCK EMAIL SERVICE - PASSWORD RESET LINK")
            print(f"To: {email}")
            print(f"Subject: Reset Your Password")
            print(f"Reset Link: {reset_link}")
            print("="*60 + "\n")
            
            return Response({
                "detail": "Password reset link generated (mocked). Check console logs.",
                "reset_link": reset_link  # Returned for visual verification
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']
            uid_b64 = request.data.get('uid')
            
            if not uid_b64:
                return Response({"detail": "User ID (uid) is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                uid = urlsafe_base64_decode(uid_b64).decode()
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                return Response({"detail": "Invalid User ID (uid)."}, status=status.HTTP_400_BAD_REQUEST)
            
            if not default_token_generator.check_token(user, token):
                return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)
            
            user.set_password(new_password)
            user.save()
            return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from .permissions import IsAdmin

class AdminProfileListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get('role')
        is_approved = self.request.query_params.get('is_approved')
        
        if role:
            queryset = queryset.filter(role=role)
        if is_approved is not None:
            is_approved_bool = is_approved.lower() == 'true'
            queryset = queryset.filter(profile__is_approved=is_approved_bool)
            
        return queryset


class AdminProfileApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.role != User.Role.MENTOR:
                return Response({"detail": "User is not a mentor."}, status=status.HTTP_400_BAD_REQUEST)
            profile = user.profile
            profile.is_approved = True
            profile.save()
            return Response({
                "detail": f"Mentor {user.username} has been approved.",
                "is_approved": True
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class AdminProfileRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            if user.role != User.Role.MENTOR:
                return Response({"detail": "User is not a mentor."}, status=status.HTTP_400_BAD_REQUEST)
            profile = user.profile
            profile.is_approved = False
            profile.save()
            return Response({
                "detail": f"Mentor {user.username} approval has been revoked.",
                "is_approved": False
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

