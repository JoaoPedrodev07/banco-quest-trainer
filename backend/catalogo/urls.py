from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("disciplinas", views.DisciplinaViewSet, basename="disciplina")
router.register("questoes", views.QuestaoViewSet, basename="questao")
router.register("provas", views.ProvaViewSet, basename="prova")

urlpatterns = [
    path("meta/", views.meta, name="meta"),
    path("", include(router.urls)),
]
