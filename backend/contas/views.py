"""
Endpoints de conta e sincronização (ADR-021).

Auth por token DRF (`Authorization: Token …`): um token por usuário, sem
sessão/cookie (frontend e API vivem em origens diferentes) e sem JWT
(refresh/expiração é complexidade sem requisito aqui).

Os endpoints de credencial têm throttle próprio e apertado: força bruta de
senha é o ataque barato. Login errado responde genérico — não revela se o
e-mail existe.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import ProgressoUsuario

CREDENCIAL_INVALIDA = "E-mail ou senha incorretos."


class ThrottleDeCredencial(ScopedRateThrottle):
    scope = "credencial"


def _corpo(request) -> dict:
    return request.data if isinstance(request.data, dict) else {}


@api_view(["POST"])
@throttle_classes([ThrottleDeCredencial])
def registrar(request):
    """Cria a conta e já devolve o token — registrar e não estar logado é fricção sem propósito."""
    corpo = _corpo(request)
    email = str(corpo.get("email", "")).strip().lower()
    senha = str(corpo.get("senha", ""))

    try:
        validate_email(email)
    except ValidationError:
        return Response({"erro": "Informe um e-mail válido."}, status=400)
    # `username` do Django tem limite de 150; e-mails maiores são raríssimos e
    # recusar é mais honesto que truncar (truncado, o login nunca mais casa).
    if len(email) > 150:
        return Response({"erro": "E-mail longo demais (máx. 150 caracteres)."}, status=400)
    try:
        validate_password(senha)
    except ValidationError as erro:
        return Response({"erro": " ".join(erro.messages)}, status=400)
    if User.objects.filter(username=email).exists():
        return Response(
            {"erro": "Já existe conta com este e-mail. Use 'Entrar'."}, status=400
        )

    usuario = User.objects.create_user(username=email, email=email, password=senha)
    token = Token.objects.create(user=usuario)
    return Response({"token": token.key, "email": email}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@throttle_classes([ThrottleDeCredencial])
def entrar(request):
    corpo = _corpo(request)
    email = str(corpo.get("email", "")).strip().lower()
    senha = str(corpo.get("senha", ""))
    usuario = authenticate(request, username=email, password=senha)
    if usuario is None:
        return Response({"erro": CREDENCIAL_INVALIDA}, status=400)
    token, _ = Token.objects.get_or_create(user=usuario)
    return Response({"token": token.key, "email": usuario.email or usuario.username})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sair(request):
    # Apagar o token desloga TODOS os dispositivos — é um token por usuário
    # (ADR-021), e para logout de conta é o comportamento certo.
    Token.objects.filter(user=request.user).delete()
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eu(request):
    progresso = ProgressoUsuario.objects.filter(usuario=request.user).first()
    return Response(
        {
            "email": request.user.email or request.user.username,
            "progressoAtualizadoEm": progresso.atualizado_em.isoformat() if progresso else None,
        }
    )


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def progresso(request):
    """O blob de progresso do usuário logado (ADR-021).

    PUT com controle de concorrência otimista: o cliente manda `base` (o
    `atualizadoEm` que conhece). Se outro dispositivo salvou depois, 409 — o
    cliente decide, nunca sobrescrevemos calado. `force=true` pula a checagem
    (é a escolha explícita do usuário no conflito).
    """
    atual = ProgressoUsuario.objects.filter(usuario=request.user).first()

    if request.method == "GET":
        if atual is None:
            return Response({"progresso": None, "atualizadoEm": None, "versao": None})
        return Response(
            {
                "progresso": atual.dados,
                "atualizadoEm": atual.atualizado_em.isoformat(),
                "versao": atual.versao_backup,
            }
        )

    corpo = _corpo(request)
    dados = corpo.get("progresso")
    if not isinstance(dados, dict) or "historico" not in dados:
        return Response(
            {"erro": "corpo precisa de 'progresso' no formato do backup (com 'historico')."},
            status=400,
        )

    base = corpo.get("base")
    if atual is not None and not corpo.get("force"):
        # Comparação por string ISO: é o mesmo valor que o GET devolveu.
        if base != atual.atualizado_em.isoformat():
            return Response(
                {
                    "erro": "outro dispositivo salvou progresso mais recente.",
                    "atualizadoEm": atual.atualizado_em.isoformat(),
                },
                status=status.HTTP_409_CONFLICT,
            )

    versao = corpo.get("versao")
    registro, _ = ProgressoUsuario.objects.update_or_create(
        usuario=request.user,
        defaults={"dados": dados, "versao_backup": versao if isinstance(versao, int) else 2},
    )
    registro.refresh_from_db()
    return Response({"atualizadoEm": registro.atualizado_em.isoformat()})
