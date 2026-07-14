from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Profile

User = get_user_model()

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'bio', 'title', 'skills', 'is_approved', 'is_suspended', 
            'avatar', 'phone_number', 'website', 'location',
            'date_of_birth', 'education_level', 'areas_of_interest',
            'years_of_experience', 'areas_of_expertise', 'resume'
        ]
        read_only_fields = ['is_approved', 'is_suspended']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and ret.get('resume'):
            ret['resume'] = request.build_absolute_uri(instance.resume.url)
        return ret


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'profile_complete', 'profile']
        read_only_fields = ['id', 'role', 'email', 'profile_complete']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        # Update Profile fields
        if profile_data and hasattr(instance, 'profile'):
            profile = instance.profile
            profile.bio = profile_data.get('bio', profile.bio)
            profile.title = profile_data.get('title', profile.title)
            profile.skills = profile_data.get('skills', profile.skills)
            profile.phone_number = profile_data.get('phone_number', profile.phone_number)
            profile.website = profile_data.get('website', profile.website)
            profile.location = profile_data.get('location', profile.location)
            profile.date_of_birth = profile_data.get('date_of_birth', profile.date_of_birth)
            profile.education_level = profile_data.get('education_level', profile.education_level)
            profile.areas_of_interest = profile_data.get('areas_of_interest', profile.areas_of_interest)
            profile.years_of_experience = profile_data.get('years_of_experience', profile.years_of_experience)
            profile.areas_of_expertise = profile_data.get('areas_of_expertise', profile.areas_of_expertise)
            if 'avatar' in profile_data:
                profile.avatar = profile_data.get('avatar', profile.avatar)
            if 'resume' in profile_data:
                profile.resume = profile_data.get('resume', profile.resume)
            profile.save()

        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    role = serializers.ChoiceField(choices=[(User.Role.STUDENT, 'Student'), (User.Role.MENTOR, 'Mentor')])
    
    # Profile fields that can be provided on signup
    bio = serializers.CharField(required=False, allow_blank=True, default='')
    title = serializers.CharField(required=False, allow_blank=True, default='')
    skills = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'role', 'bio', 'title', 'skills']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        validate_password(attrs['password'])
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        bio = validated_data.pop('bio', '')
        title = validated_data.pop('title', '')
        skills = validated_data.pop('skills', '')
        
        password = validated_data.pop('password')
        
        with transaction.atomic():
            user = User.objects.create_user(password=password, **validated_data)
            
            # Profile is auto-created by signal, update its fields
            profile = user.profile
            profile.bio = bio
            profile.title = title
            profile.skills = skills
            profile.save()
            
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove username input field, enforce email input
        self.fields.pop('username', None)
        self.fields['email'] = serializers.EmailField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        # SimpleJWT expects username_field inside the attrs dict
        attrs[self.username_field] = email
        
        data = super().validate(attrs)
        # We removed the strict is_email_verified block to allow quick-login,
        # relying instead on profile_complete route-guarding in the frontend.
        
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role,
            'profile_complete': self.user.profile_complete,
            'profile': ProfileSerializer(self.user.profile, context=self.context).data
        }
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("No user is registered with this email.")
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        validate_password(attrs['new_password'])
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate_current_password(self, value):
        user = self.context.get('request').user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "New passwords do not match."})
        if attrs['new_password'] == attrs['current_password']:
            raise serializers.ValidationError({"new_password": "New password cannot be the same as your current password."})
        validate_password(attrs['new_password'])
        return attrs


# ---------------------------------------------------------------------------
# Admin User Management Serializers
# ---------------------------------------------------------------------------

class AdminUserListSerializer(serializers.ModelSerializer):
    """
    Compact serializer for listing all users in the admin panel.
    Includes key status flags for quick overview.
    """
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    is_suspended = serializers.SerializerMethodField()
    is_approved = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'avatar', 'is_active', 'is_suspended', 'is_approved',
            'date_joined', 'last_login',
        ]

    def get_is_suspended(self, obj):
        return obj.is_suspended

    def get_is_approved(self, obj):
        return obj.is_approved

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class AdminUserDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for viewing/editing a single user in the admin panel.
    Exposes all relevant fields the admin may need to inspect or modify.
    """
    id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    role = serializers.CharField(source='user.role', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'avatar', 'bio', 'title', 'skills', 'phone_number', 'website', 'location',
            'is_active', 'is_suspended', 'is_approved',
            'date_joined', 'last_login',
        ]

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None
