from django.urls import path

from . import views

urlpatterns = [
    path("registrar/", views.registrar, name="conta-registrar"),
    path("entrar/", views.entrar, name="conta-entrar"),
    path("sair/", views.sair, name="conta-sair"),
    path("eu/", views.eu, name="conta-eu"),
    path("progresso/", views.progresso, name="conta-progresso"),
]
