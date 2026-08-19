from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("disciplinas", views.DisciplinaViewSet, basename="disciplina")
router.register("questoes", views.QuestaoViewSet, basename="questao")
router.register("provas", views.ProvaViewSet, basename="prova")
router.register("aulas", views.AulaViewSet, basename="aula")
router.register(
    "classificacoes/fila-revisao",
    views.ClassificacaoQuestaoViewSet,
    basename="classificacao-fila-revisao",
)
router.register("problemas", views.ProblemaQuestaoViewSet, basename="problema")
router.register("concursos", views.ConcursoViewSet, basename="concurso")

urlpatterns = [
    path("meta/", views.meta, name="meta"),
    path("questoes/<str:questao_id>/comentar/", views.comentar_gabarito, name="comentar-gabarito"),
    path("questoes/<str:questao_id>/reportar/", views.reportar_problema, name="reportar-problema"),
    path("", include(router.urls)),
]
