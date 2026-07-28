from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("disciplinas", views.DisciplinaViewSet, basename="disciplina")
router.register("questoes", views.QuestaoViewSet, basename="questao")
router.register("provas", views.ProvaViewSet, basename="prova")
router.register("aulas", views.AulaViewSet, basename="aula")

urlpatterns = [
    path("meta/", views.meta, name="meta"),
    path("questoes/<str:questao_id>/comentar/", views.comentar_gabarito, name="comentar-gabarito"),
    path("", include(router.urls)),
]
