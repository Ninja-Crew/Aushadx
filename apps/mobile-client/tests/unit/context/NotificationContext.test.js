import React from 'react';
import { Text, Button } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NotificationProvider, useNotificationContext } from '../../../src/context/NotificationContext';
import * as remindersApi from '../../../src/api/reminders';
import * as storage from '../../../src/utils/storage';

jest.mock('../../../src/api/reminders', () => ({
  getMissedReminders: jest.fn(),
  getPendingCount: jest.fn(),
}));

jest.mock('../../../src/utils/storage', () => ({
  getToken: jest.fn(),
}));

jest.mock('@notifee/react-native', () => ({
  cancelAllNotifications: jest.fn(),
}));

const TestComponent = () => {
  const { unreadCount, decrementUnread, notifications, removeNotification } = useNotificationContext();
  return (
    <>
      <Text testID="unread-count">{unreadCount}</Text>
      <Text testID="notif-count">{notifications.length}</Text>
      <Button testID="decrement-btn" title="Dec" onPress={decrementUnread} />
      <Button testID="remove-btn" title="Rem" onPress={() => removeNotification(1)} />
    </>
  );
};

describe('NotificationContext Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch notifications and count on mount if token exists', async () => {
    storage.getToken.mockResolvedValueOnce('token123');
    remindersApi.getMissedReminders.mockResolvedValueOnce({ notifications: [{ reminderId: 1 }] });
    remindersApi.getPendingCount.mockResolvedValueOnce(5);

    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(getByTestId('unread-count').props.children).toBe(5);
      expect(getByTestId('notif-count').props.children).toBe(1);
    });
  });

  it('should decrement unread count', async () => {
    storage.getToken.mockResolvedValueOnce('token123');
    remindersApi.getMissedReminders.mockResolvedValueOnce({ notifications: [] });
    remindersApi.getPendingCount.mockResolvedValueOnce(2);

    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    await waitFor(() => expect(getByTestId('unread-count').props.children).toBe(2));

    fireEvent.press(getByTestId('decrement-btn'));

    await waitFor(() => expect(getByTestId('unread-count').props.children).toBe(1));
  });

  it('should remove notification optimistically', async () => {
    storage.getToken.mockResolvedValueOnce('token123');
    remindersApi.getMissedReminders.mockResolvedValueOnce({ notifications: [{ reminderId: 1 }, { reminderId: 2 }] });
    remindersApi.getPendingCount.mockResolvedValueOnce(2);

    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(getByTestId('notif-count').props.children).toBe(2);
      expect(getByTestId('unread-count').props.children).toBe(2);
    });

    fireEvent.press(getByTestId('remove-btn'));

    await waitFor(() => {
      expect(getByTestId('notif-count').props.children).toBe(1);
      expect(getByTestId('unread-count').props.children).toBe(1);
    });
  });
});
