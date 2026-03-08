import client from './client';

export const fetchChats = async (token) => {
  try {
    const response = await client.get(`/chats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Fetch Chats error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const fetchChatMessages = async (token, chatId) => {
  try {
    const response = await client.get(`/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
} catch (error) {
    console.error("Fetch Chat Messages error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const deleteChat = async (token, chatId) => {
  try {
    const response = await client.delete(`/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Delete Chat error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const updateChat = async (token, chatId, title) => {
  try {
    const response = await client.put(`/chats/${chatId}`, { title }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Update Chat error:", error);
    throw error.response ? error.response.data : error;
  }
};
