"""
Agent Runner - Lightweight runtime for executing AI agents
"""

import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Agent Runtime")

# Load configuration from environment
AGENT_NAME = os.getenv("AGENT_NAME", "default-agent")
AGENT_MODEL = os.getenv("AGENT_MODEL", "gpt-4")
AGENT_TEMPERATURE = float(os.getenv("AGENT_TEMPERATURE", "0.7"))
AGENT_MAX_TOKENS = int(os.getenv("AGENT_MAX_TOKENS", "4096"))
AGENT_SYSTEM_PROMPT = os.getenv("AGENT_SYSTEM_PROMPT", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

class ChatRequest(BaseModel):
    message: str
    context: dict | None = None

class ChatResponse(BaseModel):
    response: str
    model: str
    tokens_used: int

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "agent": AGENT_NAME, "model": AGENT_MODEL}

@app.get("/config")
async def get_config():
    """Get current agent configuration"""
    return {
        "name": AGENT_NAME,
        "model": AGENT_MODEL,
        "temperature": AGENT_TEMPERATURE,
        "max_tokens": AGENT_MAX_TOKENS,
    }

@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    """Send a message to the agent"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    
    # Call OpenAI API
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    
    messages = []
    if AGENT_SYSTEM_PROMPT:
        messages.append({"role": "system", "content": AGENT_SYSTEM_PROMPT})
    messages.append({"role": "user", "content": request.message})
    
    payload = {
        "model": AGENT_MODEL,
        "messages": messages,
        "temperature": AGENT_TEMPERATURE,
        "max_tokens": AGENT_MAX_TOKENS,
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
		response = await client.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        data = response.json()
        return ChatResponse(
            response=data["choices"][0]["message"]["content"],
            model=data["model"],
            tokens_used=data["usage"]["total_tokens"],
        )

@app.on_event("startup")
async def startup():
    print(f"Agent Runtime started: {AGENT_NAME}")
    print(f"Model: {AGENT_MODEL}, Temperature: {AGENT_TEMPERATURE}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)