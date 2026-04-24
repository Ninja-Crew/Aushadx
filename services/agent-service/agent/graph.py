import os
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
from pydantic import BaseModel, Field
import operator
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from langgraph.graph.message import add_messages
from datetime import datetime
from langchain_core.tools import tool

from agent.tools import (
    get_upcoming_reminders,
    get_pending_or_missed_reminders,
    analyze_medicine,
    check_medicine_taken,
    check_schedule_complications,
    schedule_reminder,
    update_reminder,
    generate_medical_summary,
    get_current_datetime,
    core_tools
)

from agent.agents import (
    create_agent_node,
    MEDICAL_MANAGEMENT_PROMPT,
    MEDICINE_ANALYSIS_PROMPT,
    NUTRITION_MANAGEMENT_PROMPT,
    SYMPTOM_ANALYSIS_PROMPT
)

load_dotenv()

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    next: str
    sender: str

def _build_llm():
    provider = os.getenv("GEMINI_PROVIDER", "genai").lower()
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")
    
    if provider == "vertexai" and VERTEXAI_AVAILABLE:
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
        
        return ChatVertexAI(
            model=model,
            project=project,
            location=location,
            credentials=credentials,
            temperature=0
        )
    else:
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0
        )

llm = _build_llm()

# --- Supervisor Setup ---

@tool
def route_to_worker(worker_name: Literal["Medical_Management", "Medicine_Analysis", "Nutrition_Management", "Symptom_Analysis"]):
    """Route the conversation to a specialized worker agent for handling schedules, analysis, nutrition, or symptoms."""
    return f"Transferred to {worker_name}"

supervisor_tools = [route_to_worker, generate_medical_summary]
supervisor_llm = llm.bind_tools(supervisor_tools)

def supervisor_node(state: AgentState, config: RunnableConfig):
    system_prompt = (
        "You are AushadX, a medical supervisor and general QnA assistant.\n"
        "You handle general medical questions, provide empathetic health advice, and generate medical summaries yourself.\n"
        "CRITICAL: For specialized tasks, you MUST transfer to the appropriate worker agent by calling the `route_to_worker` tool:\n"
        "- Medical_Management: managing medicine schedules (creating, updating, fetching dates).\n"
        "- Medicine_Analysis: analyzing specific medicines and evaluating schedule conflicts/contraindications.\n"
        "- Nutrition_Management: providing diet and nutrition plans based on medicines.\n"
        "- Symptom_Analysis: investigating symptoms by checking for missed doses or side effects.\n\n"
        "AUTONOMOUS ACTIONS: Do not ask the user for permission to route to a worker or fetch their medical summary. Execute these actions silently and autonomously immediately when needed.\n"
        "NEVER ask the user what medications they are taking, their medical history, or if they missed any doses. You MUST route to the appropriate worker agent or use tools to autonomously find out.\n"
        "When calling a tool (like `route_to_worker` or `generate_medical_summary`), DO NOT output any conversational text. Just call the tool directly.\n"
        "If you can answer the user's general question directly, do so. Always advise consulting a doctor for critical decisions."
    )
    
    messages = [SystemMessage(content=system_prompt)] + state.get("messages", [])
    response = supervisor_llm.invoke(messages)
    
    return {"messages": [response], "sender": "supervisor"}

def supervisor_router(state: AgentState):
    messages = state.get("messages", [])
    if not messages:
        return END
        
    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
        
    return END

# --- Specialized Agents Setup ---

medical_management_tools = [get_upcoming_reminders, schedule_reminder, update_reminder, get_current_datetime]
medicine_analysis_tools = [analyze_medicine, check_schedule_complications, generate_medical_summary, get_upcoming_reminders]
nutrition_tools = [get_upcoming_reminders, generate_medical_summary]
symptom_tools = [get_pending_or_missed_reminders, check_medicine_taken, get_upcoming_reminders]

medical_management_node = create_agent_node(llm, medical_management_tools, MEDICAL_MANAGEMENT_PROMPT, "Medical_Management")
medicine_analysis_node = create_agent_node(llm, medicine_analysis_tools, MEDICINE_ANALYSIS_PROMPT, "Medicine_Analysis")
nutrition_node = create_agent_node(llm, nutrition_tools, NUTRITION_MANAGEMENT_PROMPT, "Nutrition_Management")
symptom_node = create_agent_node(llm, symptom_tools, SYMPTOM_ANALYSIS_PROMPT, "Symptom_Analysis")

# --- Tools Node Setup ---

all_tools = core_tools + [route_to_worker]
tool_node = ToolNode(all_tools)

def router_after_tool(state: AgentState):
    messages = state.get("messages", [])
    if len(messages) >= 2:
        last_msg = messages[-1]
        ai_msg = messages[-2]
        if isinstance(last_msg, ToolMessage) and isinstance(ai_msg, AIMessage):
            # Check if this tool invocation was a routing call
            for tc in ai_msg.tool_calls:
                if tc["name"] == "route_to_worker":
                    return tc["args"]["worker_name"]
                    
    sender = state.get("sender", "supervisor")
    if sender == "supervisor" or not sender:
        return "supervisor"
    return sender

def agent_router(state: AgentState):
    messages = state.get("messages", [])
    if not messages:
        return "supervisor"
        
    last_message = messages[-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
        
    # If the agent is done, route back to the supervisor
    return "supervisor"

# --- Build Graph ---

workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("Medical_Management", medical_management_node)
workflow.add_node("Medicine_Analysis", medicine_analysis_node)
workflow.add_node("Nutrition_Management", nutrition_node)
workflow.add_node("Symptom_Analysis", symptom_node)
workflow.add_node("tools", tool_node)

# Add edges
workflow.set_entry_point("supervisor")

members = ["Medical_Management", "Medicine_Analysis", "Nutrition_Management", "Symptom_Analysis"]

# Supervisor conditional edges
workflow.add_conditional_edges(
    "supervisor",
    supervisor_router,
    {"tools": "tools", END: END}
)

# Agent conditional edges
for member in members:
    workflow.add_conditional_edges(
        member,
        agent_router,
        {"tools": "tools", "supervisor": "supervisor"}
    )

# Tools conditional edges
workflow.add_conditional_edges(
    "tools",
    router_after_tool,
    {**{member: member for member in members}, "supervisor": "supervisor"}
)

# Compile with persistence
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/aushadx")
mongo_client = MongoClient(mongo_uri)
memory = MongoDBSaver(mongo_client)
graph = workflow.compile(checkpointer=memory)
