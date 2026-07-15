"""
Elasticsearch Document classes for Course and Lesson models.

Uses django-elasticsearch-dsl to map Django models to ES indices with:
- Full-text search fields (title, description, mentor name, category)
- Completion suggester fields for fast prefix autocomplete
- Edge n-gram analyzers for partial match autocomplete
- Nested/keyword fields for filtering and faceting
"""
from django_elasticsearch_dsl import Document, fields, Index
from django_elasticsearch_dsl.registries import registry
from elasticsearch_dsl import analyzer, tokenizer, token_filter

from .models import Course, Lesson

# ── Custom Analyzers ──────────────────────────────────────────────────────────

# Edge n-gram filter — generates prefix tokens ("pyt" → "p", "py", "pyt")
# keeping tokens at their original word positions for correct phrase/synonym matching
edge_ngram_filter = token_filter(
    'edge_ngram_filter',
    type='edge_ngram',
    min_gram=2,
    max_gram=15
)

edge_ngram_analyzer = analyzer(
    'edge_ngram_analyzer',
    type='custom',
    tokenizer='standard',
    filter=['lowercase', edge_ngram_filter]
)

# Synonym filter for query-time synonym expansion
synonym_filter = token_filter(
    'synonym_filter',
    type='synonym_graph',
    synonyms=[
        'js, javascript',
        'py, python',
        'ml, machine learning',
        'ai, artificial intelligence',
        'db, database'
    ]
)

# Standard search analyzer applied at query time so "python" doesn't get
# split into edge n-grams when searching (only during indexing)
search_analyzer = analyzer(
    'search_analyzer',
    type='custom',
    tokenizer='standard',
    filter=['lowercase', synonym_filter]
)

# ── Course Index ──────────────────────────────────────────────────────────────

COURSE_INDEX = Index('courses')
COURSE_INDEX.settings(
    number_of_shards=1,
    number_of_replicas=0,
    max_ngram_diff=13,         # allows edge_ngram min=2 max=15
)


@registry.register_document
class CourseDocument(Document):
    """
    Elasticsearch document for the Course model.
    Fields indexed:
      - title (text + edge_ngram for autocomplete + completion suggester)
      - description (text for full-text search)
      - mentor_name (text + edge_ngram for autocomplete)
      - category (keyword for filtering, text for search)
      - level (keyword)
      - language (keyword)
      - price (float)
      - rating_average (float)
      - total_reviews (integer)
      - enrollment_count (integer via prepare method)
      - slug (keyword)
      - thumbnail (keyword — URL passthrough)
      - created_at (date)
      - is_approved, is_published (boolean)
      - title_suggest (completion — for ES completion suggester)
    """

    # ── Text fields with edge n-gram for autocomplete ─────────────────────────
    title = fields.TextField(
        analyzer=edge_ngram_analyzer,
        search_analyzer=search_analyzer,
        fields={
            'raw': fields.KeywordField(),
            'suggest': fields.CompletionField(),
        }
    )
    description = fields.TextField(analyzer='standard')

    mentor_name = fields.TextField(
        analyzer=edge_ngram_analyzer,
        search_analyzer=search_analyzer,
        fields={
            'raw': fields.KeywordField(),
            'suggest': fields.CompletionField(),
        }
    )

    mentor_id = fields.IntegerField()

    # ── Keyword / filterable fields ───────────────────────────────────────────
    category = fields.TextField(
        analyzer='standard',
        fields={'raw': fields.KeywordField()}
    )
    level = fields.KeywordField()
    language = fields.KeywordField()
    slug = fields.KeywordField()
    thumbnail = fields.KeywordField()

    # ── Numeric fields ────────────────────────────────────────────────────────
    price = fields.FloatField()
    rating_average = fields.FloatField()
    total_reviews = fields.IntegerField()
    enrollment_count = fields.IntegerField()
    duration_hours = fields.IntegerField()

    # ── Date fields ───────────────────────────────────────────────────────────
    created_at = fields.DateField()

    # ── Boolean fields ────────────────────────────────────────────────────────
    is_approved = fields.BooleanField()
    is_published = fields.BooleanField()

    class Index:
        name = 'courses'
        settings = {
            'number_of_shards': 1,
            'number_of_replicas': 0,
            'max_ngram_diff': 13,
        }

    class Django:
        model = Course
        # Only index non-deleted, approved, published courses
        queryset_pagination = 500

    def get_queryset(self):
        """Only index published + approved courses."""
        return super().get_queryset().filter(
            is_approved=True,
            is_published=True,
            is_deleted=False
        ).select_related('mentor')

    # ── Prepare methods for computed fields ───────────────────────────────────
    def prepare_mentor_name(self, instance):
        return instance.mentor.get_full_name() or instance.mentor.username

    def prepare_mentor_id(self, instance):
        return instance.mentor_id

    def prepare_enrollment_count(self, instance):
        return instance.enrollments.filter(is_active=True).count()

    def prepare_thumbnail(self, instance):
        if instance.thumbnail:
            return instance.thumbnail.url
        return ''


# ── Lesson Index ──────────────────────────────────────────────────────────────

@registry.register_document
class LessonDocument(Document):
    """
    Elasticsearch document for the Lesson model.
    Indexes lesson titles so users can find specific lessons within courses.
    """
    title = fields.TextField(
        analyzer=edge_ngram_analyzer,
        search_analyzer=search_analyzer,
        fields={
            'raw': fields.KeywordField(),
        }
    )
    content_type = fields.KeywordField()

    # Denormalized course info so search results can display course context
    course_id = fields.IntegerField()
    course_title = fields.TextField(
        analyzer='standard',
        fields={'raw': fields.KeywordField()}
    )
    course_slug = fields.KeywordField()
    module_title = fields.TextField(analyzer='standard')

    class Index:
        name = 'lessons'
        settings = {
            'number_of_shards': 1,
            'number_of_replicas': 0,
            'max_ngram_diff': 13,
        }

    class Django:
        model = Lesson
        queryset_pagination = 500

    def get_queryset(self):
        """Only index lessons from published courses."""
        return super().get_queryset().select_related(
            'module__course', 'module__course__mentor'
        ).filter(
            module__course__is_approved=True,
            module__course__is_published=True,
            module__course__is_deleted=False
        )

    def prepare_course_id(self, instance):
        return instance.module.course_id

    def prepare_course_title(self, instance):
        return instance.module.course.title

    def prepare_course_slug(self, instance):
        return instance.module.course.slug

    def prepare_module_title(self, instance):
        return instance.module.title
