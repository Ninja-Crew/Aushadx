from typing import TypedDict, Annotated, Sequence, Union, Literal
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
try:
    from langchain_google_vertexai import ChatVertexAI
    VERTEXAI_AVAILABLE = True
except ImportError:
    VERTEXAI_AVAILABLE = False
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode
import operator
import os
from agent.tools import tools, core_tools
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from langgraph.graph.message import add_messages
from datetime import datetime

load_dotenv()

# We use add_messages to append messages to the state
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

# Initialize LLM based on GEMINI_PROVIDER env var.
# Set GEMINI_PROVIDER=vertexai to use Google Vertex AI.
# Defaults to 'genai' which uses the GEMINI_API_KEY directly.
def _build_llm():
    provider = os.getenv("GEMINI_PROVIDER", "genai").lower()
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")
    
    if provider == "vertexai" and VERTEXAI_AVAILABLE:
        # Vertex AI uses Google Cloud credentials.
        # We explicitly load the service account file if it exists to be sure.
        project = os.getenv("VERTEX_PROJECT")
        location = os.getenv("VERTEX_LOCATION", "us-central1")
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        from google.oauth2 import service_account
        credentials = None
        if creds_path and os.path.exists(creds_path):
            credentials = service_account.Credentials.from_service_account_file(
                creds_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            print(f"DEBUG: Loaded credentials from {creds_path} (Email: {credentials.service_account_email})")
        
        print(f"DEBUG: Using Vertex AI - Model: {model}, Project: {project}, Location: {location}")
        return ChatVertexAI(
            model=model,
            project=project,
            location=location,
            credentials=credentials,
            temperature=0
        )
    else:
        # Default: Google GenAI (direct API key flow)
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0
        )

llm = _build_llm()

# Bind all tools (including ask_user) to the LLM so it knows it can call them
llm_with_tools = llm.bind_tools(tools)

from langgraph.prebuilt import tools_condition

SYSTEM_PROMPT = """You are AushadX, an intelligent medical assistant. 
Your goal is to help users manage their medications, schedule reminders, and understand their prescriptions. 
You have access to tools for analyzing medicine text, scheduling reminders, checking user profiles, checking schedule complications, and generating clinical summaries.

CRITICAL INSTRUCTIONS:
1. When scheduling or evaluating relative times (like "tomorrow", "in 2 hours", "next week"), you MUST FIRST call the `get_current_datetime` tool to determine the current time before proceeding.
2. DO NOT provide a `user_id` when calling any tools. The system securely injects the `user_id` automatically under the hood for every tool call. You do not need it and should never ask the user for it.
3. When the user wants to perform an action (like scheduling a reminder) but provides INCOMPLETE information, you should explicitly acknowledge the partial information they provided and ONLY ask for the REMAINING missing information. DO NOT repeat questions for information the user has already provided in the chat history.
4. Be helpful, empathetic, and concise. Always prioritize patient safety and advise consulting a doctor for medical advice."""

def call_model(state: AgentState, config: RunnableConfig):
    messages = state["messages"]
    
    # Prepend system message to the current interaction model prompt
    prompt = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    
    response = llm_with_tools.invoke(prompt)
    return {"messages": [response]}

# The tool node executes the core tools.
tool_node = ToolNode(core_tools)

# Build Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")

# Use standard langgraph tools condition
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# Compile with persistence to support state memory
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/aushadx")
mongo_client = MongoClient(mongo_uri)
memory = MongoDBSaver(mongo_client)
graph = workflow.compile(checkpointer=memory)
