import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import END

def test_should_continue_end():
    from agent.graph import should_continue
    state = {"messages": [HumanMessage(content="Hi"), AIMessage(content="Hello")]}
    result = should_continue(state)
    assert result == END

def test_should_continue_tools():
    from agent.graph import should_continue
    ai_msg = AIMessage(content="", tool_calls=[{"name": "test_tool", "args": {}, "id": "123"}])
    state = {"messages": [HumanMessage(content="Do something"), ai_msg]}
    result = should_continue(state)
    assert result == "tools"

def test_should_continue_human_node():
    from agent.graph import should_continue
    ai_msg = AIMessage(content="", tool_calls=[{"name": "ask_user", "args": {"question": "Time?"}, "id": "123"}])
    state = {"messages": [HumanMessage(content="Do something"), ai_msg]}
    result = should_continue(state)
    assert result == "human_node"

@patch("agent.graph.llm_with_tools")
def test_call_model(mock_llm):
    from agent.graph import call_model
    mock_response = AIMessage(content="Test Response")
    mock_llm.invoke.return_value = mock_response
    state = {"messages": [HumanMessage(content="Hello")]}
    result = call_model(state, config={"configurable": {"thread_id": "test_user"}})
    assert len(result["messages"]) == 1
    assert result["messages"][0].content == "Test Response"

def test_human_input_node():
    from agent.graph import human_input_node
    state = {"messages": [HumanMessage(content="Hello")]}
    result = human_input_node(state)
    assert result == {"messages": []}
