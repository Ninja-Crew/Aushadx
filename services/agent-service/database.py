import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/aushadx")
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_default_database() if "/" in MONGO_URI.split("mongodb://")[-1] else client["aushadx_agent"]
chats_collection = db["chats"]

async def create_chat(chat_id: str, user_id: str, title: str):
    now = datetime.now(timezone.utc)
    chat_doc = {
        "_id": chat_id,
        "chat_id": chat_id,
        "user_id": user_id,
        "title": title,
        "created_at": now,
        "updated_at": now
    }
    await chats_collection.insert_one(chat_doc)
    return chat_doc

async def update_chat_timestamp(chat_id: str, user_id: str):
    now = datetime.now(timezone.utc)
    await chats_collection.update_one(
        {"chat_id": chat_id, "user_id": user_id},
        {"$set": {"updated_at": now}}
    )

async def get_user_chats(user_id: str):
    cursor = chats_collection.find({"user_id": user_id}).sort("updated_at", -1)
    chats = await cursor.to_list(length=100)
    for chat in chats:
        chat["_id"] = str(chat["_id"])
    return chats

async def get_chat(chat_id: str, user_id: str):
    chat = await chats_collection.find_one({"chat_id": chat_id, "user_id": user_id})
    if chat:
        chat["_id"] = str(chat["_id"])
    return chat

async def delete_chat(chat_id: str, user_id: str):
    result = await chats_collection.delete_one({"chat_id": chat_id, "user_id": user_id})
    return result.deleted_count > 0

async def update_chat_title(chat_id: str, user_id: str, new_title: str):
    now = datetime.now(timezone.utc)
    result = await chats_collection.update_one(
        {"chat_id": chat_id, "user_id": user_id},
        {"$set": {"title": new_title, "updated_at": now}}
    )
    return result.modified_count > 0
