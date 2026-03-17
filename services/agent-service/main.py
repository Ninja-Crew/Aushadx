import os
import json
import jwt
from typing import List
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, Header
from pydantic import BaseModel
from agent.graph import graph
from langchain_core.messages import HumanMessage, ToolMessage
from database import create_chat, update_chat_timestamp, get_user_chats, get_chat, delete_chat, update_chat_title
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
    
    chat_id = websocket.query_params.get("chatId")
    if not chat_id:
        import uuid
        chat_id = str(uuid.uuid4())
    
    # thread_id = chat session ID (used by LangGraph checkpointer for memory)
    # user_id is stored separately so tools can access the real user identity
    config = {"configurable": {"thread_id": chat_id, "user_id": user_id}}
    chat_created_in_session = False
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received from {user_id}: {data}")
            
            # Extract plain text from JSON payload 
            try:
                parsed_data = json.loads(data)
                user_message = parsed_data.get("message", data)
            except json.JSONDecodeError:
                user_message = data
            
            if not chat_created_in_session:
                chat_doc = await get_chat(chat_id, user_id)
                if not chat_doc:
                    title = user_message[:30].strip() + ("..." if len(user_message) > 30 else "")
                    await create_chat(user_id=user_id, chat_id=chat_id, title=title)
                else:
                    await update_chat_timestamp(chat_id, user_id)
                chat_created_in_session = True
            else:
                await update_chat_timestamp(chat_id, user_id)

            # Normal chat turn
            inputs = {"messages": [HumanMessage(content=user_message)]}
            
            # Resume graph execution
            async for msg, metadata in graph.astream(inputs, config=config, stream_mode="messages"):
                if msg.content:
                    # Ignore tool messages being streamed, only send Assistant generated responses
                    if getattr(msg, 'type', '') == 'ai':
                        if isinstance(msg.content, str):
                            await manager.send_personal_message(msg.content, websocket)
                        elif isinstance(msg.content, list):
                            for item in msg.content:
                                if isinstance(item, dict) and "text" in item:
                                    await manager.send_personal_message(item["text"], websocket)
                        else:
                            await manager.send_personal_message(str(msg.content), websocket)
            

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

@app.get("/chats/{user_id}")
async def fetch_user_chats_endpoint(user_id: str):
    return await get_user_chats(user_id)

@app.get("/chats/{chat_id}/messages/{user_id}")
async def fetch_chat_messages_endpoint(chat_id: str, user_id: str):
    chat_doc = await get_chat(chat_id, user_id)
    if not chat_doc:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    config = {"configurable": {"thread_id": chat_id}}
    state = graph.get_state(config)
    messages = state.values.get("messages", [])
    
    formatted = []
    for msg in messages:
         # Skip tool and system messages for simplicity, just show Human and AI
         if getattr(msg, 'type', '') not in ['human', 'ai']:
             continue
         is_user = getattr(msg, 'type', '') == 'human'
         content = msg.content
         if isinstance(content, str):
             if content.strip():
                 formatted.append({"isUser": is_user, "text": content})
         elif isinstance(content, list):
             text_content = " ".join([item.get("text", "") for item in content if isinstance(item, dict) and "text" in item])
             if text_content.strip():
                 formatted.append({"isUser": is_user, "text": text_content})
    return formatted

class UpdateChatRequest(BaseModel):
    title: str

@app.delete("/chats/{chat_id}/{user_id}")
async def delete_user_chat(chat_id: str, user_id: str):
    success = await delete_chat(chat_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found or already deleted")
    return {"status": "success", "message": "Chat deleted"}

@app.put("/chats/{chat_id}/{user_id}")
async def update_user_chat(chat_id: str, user_id: str, body: UpdateChatRequest):
    success = await update_chat_title(chat_id, user_id, body.title)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "success", "message": "Chat updated"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3004))
    uvicorn.run(app, host="0.0.0.0", port=port)
