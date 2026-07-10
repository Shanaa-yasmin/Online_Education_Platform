"""
Test-specific settings.

Run tests with:  python manage.py test --settings=core.settings_test

Behaviour:
- If TEST_DATABASE_URL is set → uses that Postgres instance for testing
- Otherwise → falls back to a local SQLite in-memory DB for fast offline tests
"""

from core.settings import *   # noqa: F401, F403
import dj_database_url

_TEST_DATABASE_URL = os.environ.get('TEST_DATABASE_URL')

if _TEST_DATABASE_URL:
    # CI / staging — run tests against a real Postgres instance
    DATABASES = {
        'default': dj_database_url.parse(
            _TEST_DATABASE_URL,
            conn_max_age=0,
            ssl_require=bool(os.environ.get('TEST_DB_SSL', 'false').lower() == 'true'),
        ),
    }
else:
    # Local dev — fast in-memory SQLite fallback (no Postgres needed)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable throttling during tests
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}
