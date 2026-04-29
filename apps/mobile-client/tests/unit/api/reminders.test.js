import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  takeReminder,
  snoozeReminder,
  getPendingCount,
  getMissedReminders,
  clearAllReminders,
  deleteAllReminders,
} from '../../../src/api/reminders';
import client from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('Reminders API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getReminders should fetch reminders', async () => {
    const mockData = { data: { reminders: [{ id: 1, text: 'Take med' }] } };
    client.get.mockResolvedValueOnce(mockData);

    const result = await getReminders('token');
    expect(client.get).toHaveBeenCalledWith('/reminders', { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data.reminders);
  });

  it('createReminder should post new reminder', async () => {
    const mockData = { data: { success: true } };
    client.post.mockResolvedValueOnce(mockData);

    const reminderData = { text: 'Take med' };
    const result = await createReminder('token', reminderData);
    expect(client.post).toHaveBeenCalledWith('/reminders', reminderData, { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('updateReminder should put updated data', async () => {
    const mockData = { data: { success: true } };
    client.put.mockResolvedValueOnce(mockData);

    const reminderData = { text: 'Take med' };
    const result = await updateReminder('token', 1, reminderData);
    expect(client.put).toHaveBeenCalledWith('/reminders/1', reminderData, { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('deleteReminder should delete reminder', async () => {
    const mockData = { data: { success: true } };
    client.delete.mockResolvedValueOnce(mockData);

    const result = await deleteReminder('token', 1);
    expect(client.delete).toHaveBeenCalledWith('/reminders/1', { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('takeReminder should post take action', async () => {
    const mockData = { data: { success: true } };
    client.post.mockResolvedValueOnce(mockData);

    const result = await takeReminder('token', 1, '10:00');
    expect(client.post).toHaveBeenCalledWith('/reminders/1/take', { scheduledTime: '10:00' }, { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('snoozeReminder should post snooze action', async () => {
    const mockData = { data: { success: true } };
    client.post.mockResolvedValueOnce(mockData);

    const result = await snoozeReminder('token', 1);
    expect(client.post).toHaveBeenCalledWith('/reminders/1/snooze', {}, { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('getPendingCount should return count', async () => {
    const mockData = { data: { count: 5 } };
    client.get.mockResolvedValueOnce(mockData);

    const result = await getPendingCount('token');
    expect(client.get).toHaveBeenCalledWith('/reminders/pending/count', { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(5);
  });

  it('getMissedReminders should fetch missed reminders', async () => {
    const mockData = { data: { reminders: [] } };
    client.get.mockResolvedValueOnce(mockData);

    const result = await getMissedReminders('token', 1, 10);
    expect(client.get).toHaveBeenCalledWith('/reminders/missed', {
      headers: { Authorization: 'Bearer token' },
      params: { page: 1, limit: 10 }
    });
    expect(result).toEqual(mockData.data);
  });

  it('clearAllReminders should post clear missed action', async () => {
    const mockData = { data: { success: true } };
    client.post.mockResolvedValueOnce(mockData);

    const result = await clearAllReminders('token');
    expect(client.post).toHaveBeenCalledWith('/reminders/missed/clear', {}, { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });

  it('deleteAllReminders should delete all reminders', async () => {
    const mockData = { data: { success: true } };
    client.delete.mockResolvedValueOnce(mockData);

    const result = await deleteAllReminders('token');
    expect(client.delete).toHaveBeenCalledWith('/reminders/user', { headers: { Authorization: 'Bearer token' } });
    expect(result).toEqual(mockData.data);
  });
});
