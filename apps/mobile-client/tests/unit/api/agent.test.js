import { fetchChats, fetchChatMessages, deleteChat, updateChat } from '../../../src/api/agent';
import client from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  get: jest.fn(),
  delete: jest.fn(),
  put: jest.fn(),
}));

describe('Agent API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchChats', () => {
    it('should fetch chats', async () => {
      const mockData = { data: { chats: [] } };
      client.get.mockResolvedValueOnce(mockData);

      const result = await fetchChats('token123');
      expect(client.get).toHaveBeenCalledWith('/chats', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual(mockData.data);
    });
  });

  describe('fetchChatMessages', () => {
    it('should fetch chat messages for a specific chat id', async () => {
      const mockData = { data: { messages: [] } };
      client.get.mockResolvedValueOnce(mockData);

      const result = await fetchChatMessages('token123', 'chat123');
      expect(client.get).toHaveBeenCalledWith('/chats/chat123/messages', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual(mockData.data);
    });
  });

  describe('deleteChat', () => {
    it('should delete a chat', async () => {
      const mockData = { data: { success: true } };
      client.delete.mockResolvedValueOnce(mockData);

      const result = await deleteChat('token123', 'chat123');
      expect(client.delete).toHaveBeenCalledWith('/chats/chat123', { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual(mockData.data);
    });
  });

  describe('updateChat', () => {
    it('should update chat title', async () => {
      const mockData = { data: { success: true } };
      client.put.mockResolvedValueOnce(mockData);

      const result = await updateChat('token123', 'chat123', 'New Title');
      expect(client.put).toHaveBeenCalledWith('/chats/chat123', { title: 'New Title' }, { headers: { Authorization: 'Bearer token123' } });
      expect(result).toEqual(mockData.data);
    });
  });
});
