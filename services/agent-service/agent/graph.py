from typing import TypedDict, Annotated, Sequence, Union
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import os
from agent.tools import tools
from dotenv import load_dotenv

load_dotenv()

# Define Agent State
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]

# Initialize LLM
llm = ChatGoogleGenerativeAI(
    model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)

# Bind tools to LLM
llm_with_tools = llm.bind_tools(tools)

# System Prompt
SYSTEM_PROMPT = """You are AushadX, an intelligent medical assistant. 
Your goal is to help users manage their medications, schedule reminders, and understand their prescriptions. 
You have access to tools for analyzing medicine text, scheduling reminders, and checking user profiles. 
Be helpful, empathetic, and concise. Always prioritize patient safety and advise consulting a doctor for medical advice."""

from langchain_core.runnables import RunnableConfig

# Define Nodes
def call_model(state: AgentState, config: RunnableConfig):
    messages = state["messages"]
    user_id = config["configurable"].get("thread_id", "unknown")
    
    # Prepend system message to the current interaction
    system_message = f"{SYSTEM_PROMPT}\nCurrent User ID: {user_id}"
    prompt = [SystemMessage(content=system_message)] + messages
    response = llm_with_tools.invoke(prompt)
    return {"messages": [response]}

tool_node = ToolNode(tools)

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

# Build Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        END: END
    }
)
workflow.add_edge("tools", "agent")

from langgraph.checkpoint.memory import MemorySaver

# Compile Graph with Persistence
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)
