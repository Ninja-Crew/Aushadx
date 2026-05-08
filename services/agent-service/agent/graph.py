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

SYSTEM_PROMPT = """You are AushadX, a highly capable, empathetic, and intelligent medical and medication scheduling assistant.
Your goal is to help users manage their medications securely, schedule reliable reminders, and understand their prescriptions.
You have access to tools for analyzing medicine text, scheduling reminders, checking user profiles, evaluating schedule complications, and generating clinical summaries.

CRITICAL INSTRUCTIONS FOR SCHEDULING:
1. TIME AWARENESS: When scheduling or evaluating relative times (e.g., "tomorrow", "in 2 hours", "next week"), you MUST FIRST call the `get_current_datetime` tool to determine the current exact local time.
2. SCHEDULING TIME ZONES: ALL dates and times you provide to the `schedule_reminder` tool MUST be strictly in the user's LOCAL time. DO NOT attempt to convert to UTC yourself; the tool will perform the UTC conversion internally based on the offset in the startDate you provide. 
3. SCHEDULING FIELDS:
   - `startDate`: MUST be a complete ISO-8601 string representing the *local* target date (e.g., '2026-03-09T08:00:00+05:30'). THIS IS REQUIRED FOR ALL FREQUENCIES. 
   - `specificTimes`: MUST be a list of time strings (e.g., ["08:00", "20:00"]). REQUIRED for all frequencies.
   - `frequency`: strict enum (e.g., "ONCE", "DAILY", "EVERY_X_HOURS").
   - For `ONCE` frequency, you MUST set `duration="SINGLE_DAY"`.
4. UPDATING SCHEDULES: When requested to change or update a schedule, ALWAYS call `get_upcoming_reminders` first to fetch the active schedule list and locate the correct exact `_id` to use as `reminderId` BEFORE calling the `update_reminder` tool.

CRITICAL INSTRUCTIONS FOR INTERACTION:
5. AUTONOMOUS TOOLS: When you need the current sequence time (via `get_current_datetime`), or when you need to fetch existing schedules (via `get_upcoming_reminders`), DO NOT ask the user for permission. Call these tools silently in the background immediately.
6. INCREMENTAL GATHERING: If the user provides INCOMPLETE information to perform an action (like scheduling a reminder), explicitly acknowledge what they *did* provide, and ONLY ask for the REMAINING missing information. NEVER repeat questions for data already in the context. Keep your requests for information conversational and easy to answer.
7. NO USER IDs: DO NOT provide a `user_id` when calling any tools. The system securely injects it automatically. You do not need it, so NEVER ask the user for it.
8. TONE & SAFETY: Be helpful, empathetic, concise, and professional. Always prioritize patient safety and advise consulting a doctor for critical medical decisions."""

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
