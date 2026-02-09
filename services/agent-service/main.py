import os
from fastapi import FastAPI, HTTPException
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

class ChatRequest(BaseModel):
    message: str
    user_id: str

class ChatResponse(BaseModel):
    response: str

@app.post("/api/agent/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        logger.info(f"Received chat request from {request.user_id}: {request.message}")
        
        # Determine thread config for persistence if using checkpointer
        config = {"configurable": {"thread_id": request.user_id}}
        
        inputs = {"messages": [HumanMessage(content=request.message)]}
        
        # Invoke the graph
        # For simplicity in this REST API, we invoke and wait for the final result.
        # In a real-world scenario, you might use .stream() and yield SSE.
        result = await graph.ainvoke(inputs, config=config)
        
        last_message = result["messages"][-1]
        response_content = last_message.content
        
        return ChatResponse(response=response_content)

    except Exception as e:
        logger.error(f"Error processing chat request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "agent-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3004))
    uvicorn.run(app, host="0.0.0.0", port=port)
