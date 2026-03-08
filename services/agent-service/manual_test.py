import asyncio
import os
from langchain_core.messages import HumanMessage
from agent.graph import graph
from dotenv import load_dotenv

load_dotenv()

async def test_agent():
    print("Starting Agent Test...")
    try:
        inputs = {"messages": [HumanMessage(content="Hello, who are you?")]}
        config = {"configurable": {"thread_id": "test-user"}}
        
        print("Invoking graph...")
        result = await graph.ainvoke(inputs, config=config)
        
        last_message = result["messages"][-1]
        print(f"Agent Response: {last_message.content}")
        print("Test Finished Successfully")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_agent())
