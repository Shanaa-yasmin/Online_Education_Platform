from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

class EmailAuthBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        identifier = username or kwargs.get('email') or kwargs.get('username')
        if not identifier:
            return None
        try:
            # Case-insensitive lookup for email or username
            user = UserModel.objects.get(Q(email__iexact=identifier) | Q(username__iexact=identifier))
        except UserModel.DoesNotExist:
            return None
        
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
