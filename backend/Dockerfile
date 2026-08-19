# Backend do Foco BB (ADR-020). Build: docker build -t focobb-api backend/
# O compose da raiz sobe web + Postgres + Redis juntos.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependências primeiro, para o cache de camada sobreviver a mudanças de código.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# collectstatic no build (whitenoise serve): a imagem nasce pronta, sem passo
# manual pós-deploy. SECRET_KEY dummy só para este comando — o settings é
# fail-closed e exigiria a real; em runtime a real vem do ambiente.
RUN DJANGO_SECRET_KEY=apenas-para-collectstatic DJANGO_DEBUG=false \
    python manage.py collectstatic --noinput

# Usuário não-root: container comprometido não ganha root de brinde.
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# `migrate` na subida é deliberado para um deploy de instância única; com
# múltiplas réplicas, mova para um job de release.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3}"]
