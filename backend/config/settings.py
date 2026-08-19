"""
Configuração do backend do Foco BB 2026.

Tudo que muda entre máquinas vem de variável de ambiente (arquivo `.env` na raiz
do backend). O padrão é o de desenvolvimento: SQLite e CORS liberado para o Vite.
"""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(nome: str, padrao: bool) -> bool:
    valor = os.getenv(nome)
    if valor is None:
        return padrao
    return valor.strip().lower() in {"1", "true", "yes", "on", "sim"}


def env_list(nome: str, padrao: list[str]) -> list[str]:
    valor = os.getenv(nome)
    if not valor:
        return padrao
    return [item.strip() for item in valor.split(",") if item.strip()]


# FAIL-CLOSED (ADR-020): o padrão é produção. Desenvolvimento liga DEBUG
# explicitamente no backend/.env (copie o backend/.env.example). Antes o padrão
# era True, e um deploy com env incompleta subia com DEBUG ligado, CORS de
# loopback e nenhum header de segurança — sem nada acusar.
DEBUG = env_bool("DJANGO_DEBUG", False)

# A chave assina sessão, cookie e token de recuperação de senha. O fallback de
# desenvolvimento **não pode** valer em produção: o valor está no repositório,
# então quem o conhece forja qualquer coisa assinada. Antes ele era usado em
# silêncio quando a variável faltava — um deploy esquecido subia inseguro sem
# nada acusar. Agora a falta derruba o processo na hora, que é o único momento
# em que alguém ainda está olhando.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY é obrigatória quando DJANGO_DEBUG=False. "
            "Gere uma com: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )
    SECRET_KEY = "dev-inseguro-troque-em-producao"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django_filters",
    "rest_framework",
    "catalogo",
    "ingest",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # A API de conteúdo é pública e só de leitura nesta fase: o progresso do
    # usuário continua no localStorage do frontend.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    # Sem paginação, `/api/questoes/` devolvia o acervo inteiro numa resposta só —
    # 1,6 MB com 838 questões, e crescendo a cada prova importada. O custo não é
    # só de banda: é uma requisição barata de fazer e cara de servir, que é a
    # forma mais simples de derrubar a API sem precisar de volume.
    "DEFAULT_PAGINATION_CLASS": "catalogo.pagination.PaginacaoPadrao",
    "PAGE_SIZE": 200,
    # Limite de requisições por IP. `AnonRateThrottle` cobre toda a API porque
    # não há usuário autenticado: a API é pública e só de leitura.
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": os.getenv("API_THROTTLE_ANON", "240/min")},
    # 0 = identifica o cliente pelo REMOTE_ADDR, imune a spoof de
    # X-Forwarded-For (o header é do cliente). Atrás de UM proxy (nginx,
    # Cloudflare), configure 1 para o throttle enxergar o IP real (ADR-020).
    "NUM_PROXIES": int(os.getenv("DJANGO_NUM_PROXIES", "0")),
}

# Com Redis, o rate limit conta entre workers do gunicorn e sobrevive a restart.
# Sem ele (desenvolvimento), o LocMemCache padrão do Django segue valendo —
# contador por processo, suficiente para uma máquina só (ADR-020).
REDIS_URL = os.getenv("REDIS_URL", "")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }

# Observabilidade (ADR-020): sem SENTRY_DSN nada é importado nem enviado —
# custo zero em desenvolvimento. Com ele, exceção não tratada chega ao Sentry
# em vez de morrer num terminal que ninguém está olhando.
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # PII desligado: raciocínios e anotações de estudo são dado pessoal.
        send_default_pii=False,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")),
    )

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "padrao": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "padrao"}},
    "root": {"handlers": ["console"], "level": os.getenv("DJANGO_LOG_LEVEL", "INFO")},
}

# Cabeçalhos e cookies de produção. Ficam sob `not DEBUG` porque HSTS e
# redirecionamento para HTTPS quebrariam o desenvolvimento local, que roda em
# http://localhost — e um HSTS emitido por engano fica gravado no navegador do
# desenvolvedor por um ano.
if not DEBUG:
    # O proxy (nginx, Cloudflare, Railway) termina o TLS e repassa em texto; sem
    # isto o Django acha que a conexão é insegura e entra em laço de redirect.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"
    # O admin do Django é a única superfície de escrita exposta pela web. Sem
    # CSRF_TRUSTED_ORIGINS o login dele falha atrás de proxy HTTPS.
    CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", [])

# 8080 é a porta que o `npm run dev` deste projeto usa de fato (o Vite vem
# configurado pelo preset do Lovable); 5173 é o padrão do Vite e fica na lista
# porque o preset pode mudar. Faltar a porta certa aqui não dá erro no servidor:
# o navegador é que bloqueia a resposta, e a tela cai no mock sem dizer por quê.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
)

# A lista fixa acima não basta: quando a porta preferida está ocupada, o Vite sobe
# na seguinte (8080 -> 8081) sem avisar, o app cai no mock e parece que o backend
# está fora do ar. Em desenvolvimento, liberar qualquer porta de loopback elimina
# essa classe de erro. Fora de DEBUG a lista explícita continua sendo a única
# fonte — liberar localhost em produção abriria a API para qualquer app local.
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://(localhost|127\.0\.0\.1):\d+$"]

# Onde o app de ingestão guarda os PDFs baixados e o texto extraído.
INGEST_DIR = Path(os.getenv("INGEST_DIR", BASE_DIR / "dados_brutos"))
