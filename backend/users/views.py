from rest_framework import status, generics, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from datetime import timedelta
from payments.dashboard_service import ADMIN_DASHBOARD_CACHE_KEY
import logging

logger = logging.getLogger(__name__)


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

def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(timedelta(days=7).total_seconds()),  # keep in sync with SIMPLE_JWT REFRESH_TOKEN_LIFETIME
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=settings.AUTH_COOKIE_PATH,
    )

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate verification token
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            
            # Build verification URL
            # We assume frontend is running on localhost:5173 for local dev, or use origin
            origin = request.headers.get('origin', 'http://localhost:5173')
            verify_url = f"{origin}/verify-email?uidb64={uidb64}&token={token}"
            
            # Send email asynchronously
            from django.core.mail import send_mail
            import threading
            
            def send_verification_email():
                try:
                    send_mail(
                        subject="Verify your EduPath email",
                        message=f"Hi {user.username},\n\nPlease verify your email address by clicking the link below:\n{verify_url}\n\nThanks,\nEduPath Team",
                        from_email=None,
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.error(f"Failed to send verification email to {user.email}: {e}")

            threading.Thread(target=send_verification_email).start()

            user_data = UserSerializer(user, context={'request': request}).data
            
            # Issue tokens immediately so they can proceed to Complete Profile
            tokens = get_tokens_for_user(user)
            
            response = Response({
                "user": user_data,
                "access": tokens['access'],
                "detail": "Registration successful. Please complete your profile."
            }, status=status.HTTP_201_CREATED)
            
            set_refresh_cookie(response, tokens['refresh'])
            return response
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uidb64')
        token = request.data.get('token')
        
        if not uidb64 or not token:
            return Response({"detail": "Missing uidb64 or token."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)
            
        if default_token_generator.check_token(user, token):
            user.is_email_verified = True
            user.save()
            return Response({"detail": "Email verified successfully."}, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Verification link is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)


class ResendVerificationEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(email__iexact=email)
            if user.is_email_verified:
                return Response({"detail": "Email is already verified."}, status=status.HTTP_400_BAD_REQUEST)
                
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            origin = request.headers.get('origin', 'http://localhost:5173')
            verify_url = f"{origin}/verify-email?uidb64={uidb64}&token={token}"
            
            from django.core.mail import send_mail
            import threading
            def send_verification_email():
                try:
                    send_mail(
                        subject="Verify your EduPath email",
                        message=f"Hi {user.username},\n\nPlease verify your email address by clicking the link below:\n{verify_url}\n\nThanks,\nEduPath Team",
                        from_email=None,
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    logger.error(f"Failed to send verification email to {user.email}: {e}")

            threading.Thread(target=send_verification_email).start()
            
            return Response({"detail": "Verification email sent."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            # Return success even if user doesn't exist to prevent email enumeration
            return Response({"detail": "If the email is registered, a verification link has been sent."}, status=status.HTTP_200_OK)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh = response.data.pop('refresh', None)  # never expose refresh token in JSON
            if refresh:
                set_refresh_cookie(response, refresh)
        return response


class CookieTokenRefreshView(APIView):
    """Reads the refresh token from the httponly cookie instead of the request body."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer

        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "Refresh token not found."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={'refresh': refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)
            response.delete_cookie(settings.AUTH_COOKIE_NAME, path=settings.AUTH_COOKIE_PATH)
            return response

        data = serializer.validated_data
        response = Response({"access": data["access"]}, status=status.HTTP_200_OK)

        # ROTATE_REFRESH_TOKENS=True in your SIMPLE_JWT settings means a new
        # refresh token comes back on every call — re-set the cookie each time.
        new_refresh = data.get("refresh")
        if new_refresh:
            set_refresh_cookie(response, new_refresh)

        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)

        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass  # already invalid/expired — irrelevant, we're logging out either way

        response.delete_cookie(settings.AUTH_COOKIE_NAME, path=settings.AUTH_COOKIE_PATH)
        return response

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
            from payments.models import Enrollment
            from certificates.models import Certificate
            
            # Exclude enrollments for soft-deleted courses, prefetch course & mentor details
            enrollments_list = list(Enrollment.objects.filter(
                student=user, is_active=True, course__is_deleted=False
            ).select_related('course', 'course__mentor'))
            
            completed_enrollments_count = sum(1 for e in enrollments_list if e.progress_percent == 100.0)
            certificates = list(Certificate.objects.filter(student=user, enrollment__is_active=True).select_related('course'))
            
            # Simple calculations
            progress_sum = sum(e.progress_percent for e in enrollments_list)
            enrollments_count = len(enrollments_list)
            learning_progress = float(progress_sum / enrollments_count) if enrollments_count > 0 else 0.0
            
            stats = {
                'courses_enrolled': enrollments_count,
                'courses_completed': completed_enrollments_count,
                'certificates_earned': len(certificates),
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
                    } for e in sorted(enrollments_list, key=lambda x: x.enrolled_at, reverse=True)[:4]
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
            from django.db.models import Sum, Avg,Count,Q
            
            # Annotate student counts in courses to avoid counting in loop
            courses_with_counts = Course.objects.filter(mentor=user).annotate(
                active_students_count=Count('enrollments', filter=Q(enrollments__is_active=True))
            )
            courses_list = list(courses_with_counts.order_by('-created_at'))
            
            published_count = sum(1 for c in courses_list if c.is_published and c.is_approved)
            drafts_count = sum(1 for c in courses_list if not c.is_published or not c.is_approved)
            
            mentor_course_ids = [c.id for c in courses_list]
            
            # Exclude enrollments tied to deleted courses
            enrollments = Enrollment.objects.filter(course_id__in=mentor_course_ids, is_active=True, course__is_deleted=False)
            reviews = Review.objects.filter(course_id__in=mentor_course_ids)
            
            avg_rating = reviews.aggregate(avg=Avg('rating'))['avg'] or 0.0
            payments = Payment.objects.filter(enrollment__course_id__in=mentor_course_ids, status=Payment.StatusChoices.COMPLETED)
            
            total_earnings = payments.aggregate(total=Sum('amount'))['total'] or 0.00
            
            from django.utils import timezone
            from datetime import timedelta
            last_30_days = timezone.now() - timedelta(days=30)
            monthly_payments = payments.filter(created_at__gte=last_30_days)
            monthly_earnings = monthly_payments.aggregate(total=Sum('amount'))['total'] or 0.00
            
            # Pre-fetch recent sales to avoid N+1 queries in loops
            recent_sales_list = list(payments.select_related('enrollment__course', 'student').order_by('-created_at')[:5])
            
            stats = {
                'courses_created': len(courses_list),
                'published_courses': published_count,
                'draft_courses': drafts_count,
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
                    } for p in recent_sales_list
                ],
                'latest_courses': [
                    {
                        'id': c.id,
                        'title': c.title,
                        'status': 'Approved' if c.is_approved else ('Pending Approval' if c.is_published else 'Draft'),
                        'students_count': c.active_students_count,
                        'rating_average': float(c.rating_average),
                        'thumbnail': c.thumbnail.url if c.thumbnail else None,
                    } for c in courses_list[:4]
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
            
            # Pre-fetch user data to avoid N+1 queries in loops
            pending_mentors_list = list(UserProfile.objects.filter(
                user__role='MENTOR', is_approved=False
            ).select_related('user').order_by('-user__date_joined')[:5])
            
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
                    } for p in pending_mentors_list
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
            
            # Log mock email details
            logger.warning(
                f"\nMOCK EMAIL SERVICE - PASSWORD RESET LINK\n"
                f"To: {email}\n"
                f"Subject: Reset Your Password\n"
                f"Reset Link: {reset_link}\n"
            )
            
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

            # Invalidate admin dashboard cache so the pending_mentor_approvals
            # list no longer shows this mentor on the next admin page load.
            cache.delete(ADMIN_DASHBOARD_CACHE_KEY)

            from notifications.models import Notification
            Notification.objects.create(
                recipient=user,
                title="Mentor Registration Approved",
                message="Your mentor registration application has been approved! You can now create and publish courses.",
                notification_type=Notification.NotificationType.MENTOR_APPROVED,
                related_object_id=user.id,
                related_object_type="User"
            )

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

            # Invalidate admin dashboard cache so the change is visible
            # immediately on the admin dashboard pending approvals list.
            cache.delete(ADMIN_DASHBOARD_CACHE_KEY)

            return Response({
                "detail": f"Mentor {user.username} approval has been revoked.",
                "is_approved": False
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

# ---------------------------------------------------------------------------
# Admin User Management ViewSet
# ---------------------------------------------------------------------------

from .serializers import AdminUserListSerializer, AdminUserDetailSerializer
from .models import Profile


class AdminUserViewSet(viewsets.ViewSet):
    """
    Admin-only ViewSet for full user management:
      list         – GET  /api/users/admin/users/
      retrieve     – GET  /api/users/admin/users/<pk>/
      activate     – POST /api/users/admin/users/<pk>/activate/
      deactivate   – POST /api/users/admin/users/<pk>/deactivate/
      suspend      – POST /api/users/admin/users/<pk>/suspend/
      reactivate   – POST /api/users/admin/users/<pk>/reactivate/
      destroy      – DELETE /api/users/admin/users/<pk>/

    Filtering (via query params):
      ?role=STUDENT|MENTOR|ADMIN
      ?is_active=true|false
      ?is_suspended=true|false
      ?search=<string>   (matches username, email, first_name, last_name)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def _get_profile_or_404(self, pk):
        try:
            return Profile.objects.select_related('user').get(user__pk=pk)
        except Profile.DoesNotExist:
            return None

    def list(self, request):
        """List all users with optional search/filter."""
        qs = Profile.objects.select_related('user').order_by('-user__date_joined')

        # --- Role filter ---
        role = request.query_params.get('role')
        if role:
            qs = qs.filter(user__role=role.upper())

        # --- is_active filter ---
        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(user__is_active=is_active.lower() == 'true')

        # --- is_suspended filter ---
        is_suspended = request.query_params.get('is_suspended')
        if is_suspended is not None:
            qs = qs.filter(is_suspended=is_suspended.lower() == 'true')

        # --- Search filter ---
        search = request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(user__username__icontains=search) |
                Q(user__email__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search)
            )

        serializer = AdminUserListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """Retrieve full details for a single user."""
        profile = self._get_profile_or_404(pk)
        if not profile:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Extra statistics per role
        user = profile.user
        extra = {}

        if user.role == User.Role.STUDENT:
            from payments.models import Enrollment
            from certificates.models import Certificate
            extra['courses_enrolled'] = Enrollment.objects.filter(student=user, is_active=True, course__is_deleted=False).count()
            extra['certificates_earned'] = Certificate.objects.filter(student=user, enrollment__is_active=True).count()

        elif user.role == User.Role.MENTOR:
            from courses.models import Course
            from payments.models import Enrollment, Payment
            from django.db.models import Sum, Avg
            from courses.models import Review
            courses = Course.objects.filter(mentor=user)
            extra['courses_created'] = courses.count()
            extra['published_courses'] = courses.filter(is_published=True, is_approved=True).count()
            course_ids = courses.values_list('id', flat=True)
            extra['students_enrolled'] = Enrollment.objects.filter(course_id__in=course_ids, is_active=True, course__is_deleted=False).count()
            avg = Review.objects.filter(course_id__in=course_ids).aggregate(avg=Avg('rating'))['avg']
            extra['avg_rating'] = round(float(avg), 1) if avg else 0.0
            total = Payment.objects.filter(
                enrollment__course_id__in=course_ids,
                status=Payment.StatusChoices.COMPLETED
            ).aggregate(t=Sum('amount'))['t']
            extra['total_earnings'] = float(total) if total else 0.0

        serializer = AdminUserDetailSerializer(profile, context={'request': request})
        data = serializer.data
        data['extra_stats'] = extra
        return Response(data, status=status.HTTP_200_OK)



    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """
        Suspend a user (profile.is_suspended=True).
        Data is preserved; user can be reactivated later.
        """
        profile = self._get_profile_or_404(pk)
        if not profile:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        user = profile.user
        if user == request.user:
            return Response({"detail": "You cannot suspend your own account."}, status=status.HTTP_400_BAD_REQUEST)
        if profile.is_suspended:
            return Response({"detail": "User is already suspended."}, status=status.HTTP_200_OK)
        profile.is_suspended = True
        profile.save()

        from notifications.models import Notification
        Notification.objects.create(
            recipient=user,
            title="Account Suspended",
            message="Your account has been suspended by an administrator. Please contact support.",
            notification_type=Notification.NotificationType.GENERAL,
            related_object_id=user.id,
            related_object_type="User"
        )
        return Response({
            "detail": f"User '{user.username}' has been suspended.",
            "is_suspended": True
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Lift a suspension (profile.is_suspended=False)."""
        profile = self._get_profile_or_404(pk)
        if not profile:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not profile.is_suspended:
            return Response({"detail": "User is not currently suspended."}, status=status.HTTP_200_OK)
        profile.is_suspended = False
        profile.save()

        from notifications.models import Notification
        Notification.objects.create(
            recipient=profile.user,
            title="Account Reactivated",
            message="Your account suspension has been lifted. Welcome back!",
            notification_type=Notification.NotificationType.GENERAL,
            related_object_id=profile.user.id,
            related_object_type="User"
        )
        return Response({
            "detail": f"User '{profile.user.username}' has been reactivated.",
            "is_suspended": False
        }, status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """Permanently delete a user and all their data. Admin-only."""
        profile = self._get_profile_or_404(pk)
        if not profile:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        user = profile.user
        if user == request.user:
            return Response({"detail": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        username = user.username
        user.delete()
        return Response({"detail": f"User '{username}' has been permanently deleted."}, status=status.HTTP_200_OK)


class CompleteProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        user = request.user
        profile = user.profile
        data = request.data

        # Student specific fields
        if user.is_student:
            if 'date_of_birth' in data:
                profile.date_of_birth = data.get('date_of_birth') or None
            if 'education_level' in data:
                profile.education_level = data.get('education_level')
            if 'areas_of_interest' in data:
                import json
                try:
                    # Depending on how frontend sends it (form-data might stringify arrays)
                    val = data.get('areas_of_interest')
                    if isinstance(val, str):
                        profile.areas_of_interest = json.loads(val)
                    else:
                        profile.areas_of_interest = val
                except (ValueError, TypeError):
                    pass

        # Mentor specific fields
        elif user.is_mentor:
            if 'title' in data:
                profile.title = data.get('title')
            if 'years_of_experience' in data:
                try:
                    profile.years_of_experience = int(data.get('years_of_experience', 0))
                except ValueError:
                    pass
            if 'areas_of_expertise' in data:
                import json
                try:
                    val = data.get('areas_of_expertise')
                    if isinstance(val, str):
                        profile.areas_of_expertise = json.loads(val)
                    else:
                        profile.areas_of_expertise = val
                except (ValueError, TypeError):
                    pass
            if 'bio' in data:
                profile.bio = data.get('bio')
            if 'website' in data:
                profile.website = data.get('website')
            if 'resume' in request.FILES:
                profile.resume = request.FILES['resume']

        profile.save()
        user.profile_complete = True
        user.save()
        
        user_data = UserSerializer(user, context={'request': request}).data
        return Response(user_data, status=status.HTTP_200_OK)
