from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import sys
import os

import json
try:
    from LightAgent import LightAgent
except ImportError:
    print("LightAgent not installed. Install with: pip install lightagent")
    sys.exit(1)

# Load MCP config
mcp_config = None
if os.path.exists("mcp_servers.json"):
    with open("mcp_servers.json", "r") as f:
        mcp_config = json.load(f)

app = FastAPI()

class ChatRequest(BaseModel):
    query: str
    apiKey: str
    baseUrl: str = ""
    model: str = "gpt-4"
    smtpConfig: dict = {}

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
        if mcp_config:
            # Inject dynamic smtp config if present
            if request.smtpConfig and "email-sender" in mcp_config.get("mcpServers", {}):
                env = mcp_config["mcpServers"]["email-sender"].get("env", {})
                env["SMTP_HOST"] = request.smtpConfig.get("host", env.get("SMTP_HOST"))
                env["SMTP_PORT"] = request.smtpConfig.get("port", env.get("SMTP_PORT"))
                env["SMTP_USER"] = request.smtpConfig.get("user", env.get("SMTP_USER"))
                env["SMTP_PASS"] = request.smtpConfig.get("pass", env.get("SMTP_PASS"))
                mcp_config["mcpServers"]["email-sender"]["env"] = env

            await agent.setup_mcp(mcp_config)
            from LightAgent.tools import AsyncToolDispatcher
            agent.tool_dispatcher = AsyncToolDispatcher(agent.tool_registry.function_mappings)
            
        response = agent.run(request.query)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000)
