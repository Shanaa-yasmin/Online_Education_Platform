"""
Elasticsearch-powered search views for the course catalog.

Provides:
  - CourseSearchView     — full-text multi_match search with filters, facets,
                           relevance scoring, fuzziness, and "did you mean"
  - CourseAutocompleteView — lightweight prefix autocomplete via completion
                             suggester + edge n-gram fallback

Both views gracefully fall back to ORM queries when ES_ENABLED=false or
when Elasticsearch is unreachable, so the app never hard-crashes.
"""

import logging

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q, Avg, Count, Min, Max
from django.db.models.functions import Coalesce
from rest_framework import permissions, generics, status
from rest_framework.response import Response

from .models import Course
from .serializers import CourseSearchSerializer

logger = logging.getLogger(__name__)

# Lazy import ES libs — may not be installed in every environment
try:
    from elasticsearch_dsl import Q as ESQ, Search
    from .documents import CourseDocument, LessonDocument
    _ES_AVAILABLE = True
except ImportError:
    _ES_AVAILABLE = False


def _es_is_live():
    """Quick liveness check — returns True if ES is enabled and reachable."""
    if not settings.ES_ENABLED or not _ES_AVAILABLE:
        return False
    try:
        return CourseDocument._index.exists()
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  Full-text search with filters, facets, and "did you mean"
# ─────────────────────────────────────────────────────────────────────────────

class CourseSearchView(generics.GenericAPIView):
    """
    GET /api/courses/search/

    Query params:
      search      — free-text query (multi_match across title, description,
                     mentor_name, category) with fuzziness for typo tolerance
      level       — filter by level (BEGINNER / INTERMEDIATE / ADVANCED)
      language    — filter by language
      min_price   — minimum price
      max_price   — maximum price
      is_free     — true/false
      min_rating  — minimum avg rating
      category    — filter by category keyword
      ordering    — one of price, -price, created_at, -created_at,
                     avg_rating, -avg_rating
      page        — page number (20 results per page)

    Response includes:
      results     — list of serialized courses
      count       — total number of matching courses
      facets      — available filter facet values
      suggestion  — "did you mean" when zero/low results
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseSearchSerializer

    def get(self, request, *args, **kwargs):
        if _es_is_live():
            try:
                return self._es_search(request)
            except Exception as exc:
                logger.warning('ES search failed, falling back to ORM: %s', exc)

        return self._orm_search(request)

    # ── Elasticsearch search path ─────────────────────────────────────────────
    def _es_search(self, request):
        query_text = request.query_params.get('search', '').strip()
        page = int(request.query_params.get('page', 1))
        page_size = 20
        start = (page - 1) * page_size

        s = CourseDocument.search()

        # Always limit to published + approved
        s = s.filter('term', is_approved=True)
        s = s.filter('term', is_published=True)

        # ── Full-text query ───────────────────────────────────────────────────
        if query_text:
            s = s.query(
                ESQ('multi_match',
                    query=query_text,
                    fields=[
                        'title^3',
                        'title.raw^5',
                        'description',
                        'mentor_name^2',
                        'category^1.5',
                    ],
                    type='best_fields',
                    fuzziness='AUTO',
                    prefix_length=1,
                    )
            )
        else:
            s = s.sort('-created_at')

        # ── Filters ───────────────────────────────────────────────────────────
        level = request.query_params.get('level')
        if level and level != 'ALL':
            s = s.filter('term', level=level)

        language = request.query_params.get('language')
        if language and language != 'ALL':
            s = s.filter('term', language=language)

        min_price = request.query_params.get('min_price')
        if min_price:
            s = s.filter('range', price={'gte': float(min_price)})

        max_price = request.query_params.get('max_price')
        if max_price:
            s = s.filter('range', price={'lte': float(max_price)})

        is_free = request.query_params.get('is_free')
        if is_free == 'true':
            s = s.filter('term', price=0.0)
        elif is_free == 'false':
            s = s.filter('range', price={'gt': 0.0})

        min_rating = request.query_params.get('min_rating')
        if min_rating and min_rating != 'ALL':
            s = s.filter('range', rating_average={'gte': float(min_rating)})

        category = request.query_params.get('category')
        if category and category != 'ALL':
            s = s.filter('term', **{'category.raw': category})

        # ── Ordering ──────────────────────────────────────────────────────────
        ordering = request.query_params.get('ordering')
        if ordering:
            order_map = {
                'price': 'price',
                '-price': '-price',
                'created_at': 'created_at',
                '-created_at': '-created_at',
                'avg_rating': 'rating_average',
                '-avg_rating': '-rating_average',
            }
            es_sort = order_map.get(ordering)
            if es_sort:
                s = s.sort(es_sort)

        # ── Aggregations for facets ───────────────────────────────────────────
        s.aggs.bucket('levels', 'terms', field='level', size=10)
        s.aggs.bucket('languages', 'terms', field='language', size=50)
        s.aggs.bucket('categories', 'terms', field='category.raw', size=50)
        s.aggs.metric('min_price', 'min', field='price')
        s.aggs.metric('max_price', 'max', field='price')

        # ── Execute with pagination ───────────────────────────────────────────
        total_s = s.count()
        s = s[start:start + page_size]
        response = s.execute()

        # ── Build results from ES hits ────────────────────────────────────────
        course_ids = [hit.meta.id for hit in response]
        if course_ids:
            courses_qs = Course.objects.filter(
                id__in=course_ids
            ).select_related('mentor').annotate(
                avg_rating=Coalesce(Avg('reviews__rating'), 0.0),
                enrollment_count=Count('enrollments', distinct=True)
            )
            # Preserve ES relevance ordering
            courses_map = {str(c.id): c for c in courses_qs}
            ordered_courses = [courses_map[cid] for cid in course_ids if cid in courses_map]
        else:
            ordered_courses = []

        serializer = CourseSearchSerializer(ordered_courses, many=True, context={'request': request})

        # ── Facets from aggregations ──────────────────────────────────────────
        aggs = response.aggregations
        facets = {
            'levels': [b.key for b in aggs.levels.buckets],
            'languages': [b.key for b in aggs.languages.buckets],
            'categories': [b.key for b in aggs.categories.buckets],
            'price_range': {
                'min': aggs.min_price.value if aggs.min_price.value is not None else 0.0,
                'max': aggs.max_price.value if aggs.max_price.value is not None else 1000.0,
            }
        }

        # ── "Did you mean" suggestion for low/zero results ────────────────────
        suggestion = None
        if query_text and total_s < 3:
            suggestion = self._get_suggestion(query_text)

        # ── Build paginated response ──────────────────────────────────────────
        data = {
            'results': serializer.data,
            'count': total_s,
            'facets': facets,
            'next': page + 1 if start + page_size < total_s else None,
            'previous': page - 1 if page > 1 else None,
        }
        if suggestion:
            data['suggestion'] = suggestion

        return Response(data)

    def _get_suggestion(self, query_text):
        """Use the phrase suggester to produce a 'did you mean' correction."""
        try:
            s = CourseDocument.search()
            s = s.suggest('title_suggestion', query_text, phrase={
                'field': 'title',
                'size': 1,
                'gram_size': 3,
                'direct_generator': [{
                    'field': 'title',
                    'suggest_mode': 'popular',
                }]
            })
            s = s.suggest('desc_suggestion', query_text, phrase={
                'field': 'description',
                'size': 1,
                'gram_size': 3,
                'direct_generator': [{
                    'field': 'description',
                    'suggest_mode': 'popular',
                }]
            })
            resp = s.execute()

            # Pick the first non-empty suggestion
            for key in ('title_suggestion', 'desc_suggestion'):
                options = resp.suggest.get(key, [{}])
                if options and options[0].get('options'):
                    return options[0]['options'][0]['text']
        except Exception:
            pass
        return None

    # ── ORM fallback search path ──────────────────────────────────────────────
    def _orm_search(self, request):
        """Fallback that mirrors the old ORM-based CourseSearchView exactly."""
        qs = Course.objects.filter(
            is_approved=True, is_published=True
        ).select_related('mentor').annotate(
            avg_rating=Coalesce(Avg('reviews__rating'), 0.0),
            enrollment_count=Count('enrollments', distinct=True)
        )

        query_text = request.query_params.get('search', '').strip()
        if query_text:
            qs = qs.filter(
                Q(title__icontains=query_text) |
                Q(description__icontains=query_text) |
                Q(mentor__username__icontains=query_text)
            )

        level = request.query_params.get('level')
        if level and level != 'ALL':
            qs = qs.filter(level=level)

        language = request.query_params.get('language')
        if language and language != 'ALL':
            qs = qs.filter(language__icontains=language)

        min_price = request.query_params.get('min_price')
        if min_price:
            qs = qs.filter(price__gte=float(min_price))

        max_price = request.query_params.get('max_price')
        if max_price:
            qs = qs.filter(price__lte=float(max_price))

        is_free = request.query_params.get('is_free')
        if is_free == 'true':
            qs = qs.filter(price=0)
        elif is_free == 'false':
            qs = qs.filter(price__gt=0)

        min_rating = request.query_params.get('min_rating')
        if min_rating and min_rating != 'ALL':
            qs = qs.filter(avg_rating__gte=float(min_rating))

        ordering = request.query_params.get('ordering', '-created_at')
        order_map = {
            'avg_rating': 'avg_rating',
            '-avg_rating': '-avg_rating',
        }
        qs = qs.order_by(order_map.get(ordering, ordering))

        # Facets
        def _compute_facets():
            base = Course.objects.filter(is_approved=True, is_published=True)
            levels = list(base.values_list('level', flat=True).distinct())
            languages = list(filter(None, base.values_list('language', flat=True).distinct()))
            categories = list(filter(None, base.values_list('category', flat=True).distinct()))
            prices = base.aggregate(min_p=Min('price'), max_p=Max('price'))
            return {
                'levels': levels,
                'languages': languages,
                'categories': categories,
                'price_range': {
                    'min': float(prices['min_p']) if prices['min_p'] is not None else 0.0,
                    'max': float(prices['max_p']) if prices['max_p'] is not None else 1000.0,
                }
            }

        facets = cache.get_or_set('catalog_facets', _compute_facets, timeout=300)

        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = 20
        start = (page - 1) * page_size
        total = qs.count()
        page_qs = qs[start:start + page_size]

        serializer = CourseSearchSerializer(page_qs, many=True, context={'request': request})

        return Response({
            'results': serializer.data,
            'count': total,
            'facets': facets,
            'next': page + 1 if start + page_size < total else None,
            'previous': page - 1 if page > 1 else None,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Autocomplete endpoint
# ─────────────────────────────────────────────────────────────────────────────

class CourseAutocompleteView(generics.GenericAPIView):
    """
    GET /api/courses/autocomplete/?q=<query>

    Returns up to 8 course title suggestions and up to 4 mentor name
    suggestions for fast prefix autocomplete.

    Uses ES completion suggester + edge n-gram when available, falls back
    to ORM icontains otherwise.

    Response format:
      {
        "courses": [{"id": 1, "title": "...", "slug": "..."}],
        "mentors": [{"id": 2, "name": "..."}]
      }
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'courses': [], 'mentors': []})

        if _es_is_live():
            try:
                return self._es_autocomplete(q)
            except Exception as exc:
                logger.warning('ES autocomplete failed, falling back to ORM: %s', exc)

        return self._orm_autocomplete(q)

    def _es_autocomplete(self, q):
        """Use completion suggester for course titles and mentor names."""
        s = CourseDocument.search()

        # Completion suggesters
        s = s.suggest('course_suggest', q, completion={
            'field': 'title.suggest',
            'size': 8,
            'fuzzy': {
                'fuzziness': 'AUTO',
            }
        })
        s = s.suggest('mentor_suggest', q, completion={
            'field': 'mentor_name.suggest',
            'size': 4,
            'fuzzy': {
                'fuzziness': 'AUTO',
            }
        })

        resp = s.execute()

        # Parse course suggestions
        courses = []
        seen_course_ids = set()
        for option in resp.suggest.get('course_suggest', [{}])[0].get('options', []):
            src = option.get('_source', {})
            cid = str(option.get('_id', ''))
            if cid not in seen_course_ids:
                seen_course_ids.add(cid)
                courses.append({
                    'id': int(cid) if cid.isdigit() else cid,
                    'title': src.get('title', option.get('text', '')),
                    'slug': src.get('slug', ''),
                })

        # Parse mentor suggestions (deduplicate by mentor_id)
        mentors = []
        seen_mentor_ids = set()
        for option in resp.suggest.get('mentor_suggest', [{}])[0].get('options', []):
            src = option.get('_source', {})
            mid = src.get('mentor_id')
            if mid and mid not in seen_mentor_ids:
                seen_mentor_ids.add(mid)
                mentors.append({
                    'id': mid,
                    'name': src.get('mentor_name', option.get('text', '')),
                })

        # If completion suggester returned too few, supplement with edge n-gram
        if len(courses) < 3:
            edge_s = CourseDocument.search()
            edge_s = edge_s.filter('term', is_approved=True)
            edge_s = edge_s.filter('term', is_published=True)
            edge_s = edge_s.query('match', title=q)
            edge_s = edge_s[:8]
            edge_resp = edge_s.execute()
            for hit in edge_resp:
                hid = str(hit.meta.id)
                if hid not in seen_course_ids:
                    seen_course_ids.add(hid)
                    courses.append({
                        'id': int(hid) if hid.isdigit() else hid,
                        'title': hit.title,
                        'slug': hit.slug,
                    })
                if len(courses) >= 8:
                    break

        return Response({'courses': courses[:8], 'mentors': mentors[:4]})

    def _orm_autocomplete(self, q):
        """ORM fallback — simple title icontains."""
        courses = list(
            Course.objects.filter(
                is_approved=True,
                is_published=True,
                title__icontains=q
            )
            .only('id', 'title', 'slug')
            .values('id', 'title', 'slug')
            .order_by('title')[:8]
        )
        return Response({'courses': courses, 'mentors': []})
