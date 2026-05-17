# Agent Runtime Dockerfile
# Lightweight Python runtime for AI agent execution

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for LLM and agent runtime
RUN pip install --no-cache-dir \
    openai>=1.0.0 \
    httpx>=0.25.0 \
    pydantic>=2.0.0 \
    python-dotenv>=1.0.0 \
    fastapi>=0.109.0 \
    uvicorn>=0.27.0

# Copy agent runtime files
COPY agent_runner.py .
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

# Expose default port for agent communication
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Environment variables (will be overridden at runtime)
ENV AGENT_NAME=""
ENV AGENT_DESCRIPTION=""
ENV AGENT_MODEL="gpt-4"
ENV AGENT_TEMPERATURE="0.7"
ENV AGENT_MAX_TOKENS="4096"
ENV AGENT_SYSTEM_PROMPT=""
ENV AGENT_CONFIG=""
ENV OPENAI_API_KEY=""

ENTRYPOINT ["./entrypoint.sh"]