FROM python:3.12-slim AS deps

# praat-parselmouth has no Linux arm64 wheels, so pip compiles it there
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake ninja-build \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /venv
ENV PATH=/venv/bin:$PATH
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /venv /venv
ENV PATH=/venv/bin:$PATH

WORKDIR /app
COPY app ./app
COPY scripts ./scripts

# Gemma weights are downloaded here on first start
ENV HF_HOME=/models/hf

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
