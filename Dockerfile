FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd --create-home --uid 1000 user

WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY --chown=user:user backend/requirements.txt backend/requirements.txt
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

# Copy the application code, keeping the same folder layout as local development
COPY --chown=user:user backend/ backend/
COPY --chown=user:user frontend/ frontend/

USER user
WORKDIR /app/backend

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/health', timeout=5)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]