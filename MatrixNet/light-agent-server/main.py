from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import sys
import os

try:
    from LightAgent import LightAgent
except ImportError:
    print("LightAgent not installed. Install with: pip install lightagent")
    sys.exit(1)

app = FastAPI()

class ChatRequest(BaseModel):
    query: str
    apiKey: str
    baseUrl: str = ""
    model: str = "gpt-4"

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # If no base url is provided, use default or let LightAgent decide
        kwargs = {
            "model": request.model,
            "api_key": request.apiKey,
        }
        if request.baseUrl:
            kwargs["base_url"] = request.baseUrl
            
        agent = LightAgent(**kwargs)
        response = agent.run(request.query)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
