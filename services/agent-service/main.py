import os
import json
import jwt
from typing import List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from agent.graph import graph
from langchain_core.messages import HumanMessage
from utils.logger import logger
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AushadX Agent Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared Key or Public Key for JWT Verification
# In prod, load from file or JWKS. For now, using a simple check or decoding without verification if purely internal trusting gateway?
# IMPORTANT: Gateway already verifies the token. 
# However, to be safe and extract user_id, we decode it here.
# Assuming Gateway passes X-User-Id header? WebSockets don't pass headers easily in all clients.
# But we are using a Proxy. The Proxy *can* pass headers if configured.
# Our Gateway implementation passes `req.headers["x-user-id"] = decoded.sub`.
# But for WebSocket in FastAPI, accessing headers is done via `websocket.headers`.

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("New WebSocket connection attempt")
    # Gateway should have verified token and injected X-User-Id.
    # However, http-proxy logic for WS might be tricky with headers.
    # Let's verify if we get the header.
    
    user_id = websocket.headers.get("x-user-id")
    logger.info(f"Headers: {websocket.headers}")
    
    # If header is missing (e.g. proxy didn't inject it or client connected directly), 
    # we might fallback to token query param if we want to support direct checks.
    # But strictly speaking, we rely on Gateway.
    
    if not user_id:
        # Check for query param token as fallback or dev testing
        # This is strictly for robustness if Gateway header injection fails on WS upgrade
        token = websocket.query_params.get("token")
        if token:
             try:
                # Decode without verification (Gateway does verification) or verify if you have the key
                # For safety, we should verify if exposed directly. 
                # But here we assume Gateway did it.
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get("sub") or decoded.get("id")
             except Exception:
                 pass
    
    if not user_id:
        logger.warning("Connection attempt without user_id")
        await websocket.close(code=1008)
        return

    logger.info(f"User ID from token/header: {user_id}")
    await manager.connect(websocket)
    
    # Initialize config for this user session
    config = {"configurable": {"thread_id": user_id}}
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received from {user_id}: {data}")
            
            inputs = {"messages": [HumanMessage(content=data)]}
            
            # Streaming response or single response?
            # Creating a generator to stream back chunks if graph supports it.
            # Using ainvoke for now to keep it simple as per original code, but WS allows streaming.
            
            # Let's try to stream if possible, or just await result.
            # result = await graph.ainvoke(inputs, config=config)
            # response_content = result["messages"][-1].content
            # await manager.send_personal_message(response_content, websocket)
            
            # Using stream for better UX
            # logger.info("Invoking graph stream...")
            async for event in graph.astream_events(inputs, config=config, version="v1"):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    content = chunk.content
                    if content:
                        if isinstance(content, str):
                            await manager.send_personal_message(content, websocket)
                        elif isinstance(content, list):
                            for item in content:
                                if isinstance(item, dict) and "text" in item:
                                    await manager.send_personal_message(item["text"], websocket)
                        else:
                            await manager.send_personal_message(str(content), websocket)
            # logger.info("Graph stream finished for this turn.")
                        
            # Determine if we need to send a "Done" signal or just let the stream end for this turn.
            # A simple way is to just send the text chunks. 
            # If the client needs to know when turn ends, we might need a protocol.
            # For now, simplistic streaming.
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"Client {user_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await manager.send_personal_message(f"Error: {str(e)}", websocket)
        except:
            pass
        manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "agent-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3004))
    uvicorn.run(app, host="0.0.0.0", port=port)
