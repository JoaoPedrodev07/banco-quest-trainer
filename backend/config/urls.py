from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Usado pelo frontend para decidir entre API e mocks locais."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/", include("catalogo.urls")),
]
