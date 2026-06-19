from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Profile

User = get_user_model()

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'Profile'
    fields = ('title', 'skills', 'bio', 'is_approved', 'avatar')

class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline,)
    list_display = ('username', 'email', 'role', 'get_is_approved', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_staff', 'is_superuser', 'profile__is_approved')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)

    def get_is_approved(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.is_approved
        return False
    get_is_approved.boolean = True
    get_is_approved.short_description = 'Approved'

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_role', 'title', 'is_approved')
    list_filter = ('is_approved', 'user__role')
    search_fields = ('user__username', 'user__email', 'title', 'skills')
    actions = ['approve_mentors', 'unapprove_mentors']

    def get_role(self, obj):
        return obj.user.role
    get_role.short_description = 'User Role'

    @admin.action(description='Approve selected mentors')
    def approve_mentors(self, request, queryset):
        # We only want to approve users that are mentors
        mentors = queryset.filter(user__role=User.Role.MENTOR)
        updated = mentors.update(is_approved=True)
        self.message_user(request, f"Successfully approved {updated} mentor(s).")

    @admin.action(description='Revoke approval for selected mentors')
    def unapprove_mentors(self, request, queryset):
        updated = queryset.update(is_approved=False)
        self.message_user(request, f"Successfully revoked approval for {updated} profile(s).")

admin.site.register(User, UserAdmin)
