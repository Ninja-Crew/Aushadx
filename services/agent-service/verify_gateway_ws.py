import asyncio
import websockets
import jwt
import sys

async def test_websocket_gateway():
    # Mock token (Gateway verifies validation, so we need a valid signature if using real verify middleware)
    # But wait, our verifyToken middleware uses process.env.JWT_PUBLIC_KEY or file.
    # If not set, it might fail or used dummy.
    # User provided code: verifyJWT(token) checks JWT.
    
    # We don't have the private key used by Profile Manager to sign tokens locally easily unless we know the secret.
    # However, for `verify_ws.py` we used a dummy token. 
    # The Gateway `verifyToken` middleware likely needs a real key.
    # Let's check `middleware/verifyToken.js` again to see how strict it is.
    
    # If strict, we can't test Gateway auth easily without mocking or knowing the key.
    # But wait, `middleware/verifyToken.js` uses `process.env.JWT_PUBLIC_KEY`.
    # If not set, it says `return null`.
    # Then `verifyToken` middleware:
    # if (!token) return res.status(401)...
    # jwt.verify(token, PUBLIC_KEY, ...)
    
    # If PUBLIC_KEY is null, jwt.verify might fail or error.
    
    print("Skipping detailed token generation, assuming we can use the same approach as direct test if we disable verification for testing or if we have the key.")
    # For now, let's try connecting. If it fails with 401, we know Gateway is enforcing auth.
    
    uri = "ws://127.0.0.1:3000/ws?token=dummy"
    print(f"Connecting to Gateway: {uri}")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to Gateway!")
            await websocket.send("Hello via Gateway")
            response = await websocket.recv()
            print(f"Received from Gateway: {response}")
    except Exception as e:
        print(f"Gateway connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_gateway())
