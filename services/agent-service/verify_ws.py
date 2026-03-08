import asyncio
import websockets
import jwt
import sys

async def test_websocket():
    # Mock token
    token = jwt.encode({"sub": "test-user-123"}, "secret", algorithm="HS256") 
    # Note: Gateway verifies with RS256/Private key from Profile Manager usually. 
    # Depending on how strict the Gateway is (it checks Profile Manager JWKS).
    # Since we can't easily generate a valid RS256 token signed by Profile Manager without its private key,
    # This test might fail against the REAL Gateway unless we mock the JWKS response or use a real token.
    
    # OPTION 1: Test Agent Service DIRECTLY (bypass Gateway for basic functional test)
    uri_agent = "ws://127.0.0.1:3004/ws?token=" + token
    print(f"Connecting to Agent Service directly: {uri_agent}")
    try:
        async with websockets.connect(uri_agent) as websocket:
            await websocket.send("Hello AushadX, What can you do?")
            print("> Sent: Hello AushadX, What can you do?")
            
            while True:
                response = await websocket.recv()
                print(f"< Received: {response}")
                if response: break # Break after first response for test
                
    except Exception as e:
        print(f"Direct connection failed: {e}")

    # OPTION 2: Test via Gateway (If we had a valid token)
    # uri_gateway = "ws://localhost:3001/ws"
    # ...

if __name__ == "__main__":
    asyncio.run(test_websocket())
