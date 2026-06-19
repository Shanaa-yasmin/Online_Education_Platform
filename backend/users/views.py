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

