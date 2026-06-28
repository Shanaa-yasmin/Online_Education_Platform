import django_filters
from django.db.models import Q, Avg
from django.db.models.functions import Coalesce
from .models import Course

class CourseFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    level = django_filters.ChoiceFilter(choices=Course.Level.choices)
    language = django_filters.CharFilter(lookup_expr='icontains')
    min_price = django_filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price', lookup_expr='lte')
    is_free = django_filters.BooleanFilter(method='filter_is_free')
    min_rating = django_filters.NumberFilter(method='filter_min_rating')

    class Meta:
        model = Course
        fields = ['level', 'language']

    def filter_search(self, queryset, name, value):
        if not value or not value.strip():
            return queryset
        return queryset.filter(
            Q(title__icontains=value) |
            Q(description__icontains=value) |
            Q(mentor__username__icontains=value)
        )

    def filter_is_free(self, queryset, name, value):
        if value is None:
            return queryset
        if value:
            return queryset.filter(price=0)
        return queryset.filter(price__gt=0)

    def filter_min_rating(self, queryset, name, value):
        if value is None:
            return queryset
        # Dynamically annotate the average rating to ensure we can filter by it
        return queryset.annotate(
            temp_avg_rating=Coalesce(Avg('reviews__rating'), 0.0)
        ).filter(temp_avg_rating__gte=value)
