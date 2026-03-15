import client from './client';

export const getReminders = async (token) => {
  try {
    // Gateway routes /reminders -> Medicine Scheduler
    // Passing token in header for Gateway to verify and inject user ID
    const response = await client.get('/reminders', {
        headers: { Authorization: `Bearer ${token}` }
    });
    // Medicine Scheduler backend returns { reminders: [...], pagination: {...} }
    return response.data.reminders || response.data;
  } catch (error) {
     console.error("Get Reminders error:", error);
    throw error.response ? error.response.data : error;
  }
};

export const createReminder = async (token, reminderData) => {
    try {
        const response = await client.post('/reminders', reminderData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Create Reminder error:", error);
        throw error.response ? error.response.data : error;
    }
}
export const updateReminder = async (token, id, reminderData) => {
    try {
        const response = await client.put(`/reminders/${id}`, reminderData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Update Reminder error:", error);
        throw error.response ? error.response.data : error;
    }
}

export const deleteReminder = async (token, id) => {
    try {
        const response = await client.delete(`/reminders/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Delete Reminder error:", error);
        throw error.response ? error.response.data : error;
    }
}

export const takeReminder = async (token, id, scheduledTime) => {
    try {
        const response = await client.post(`/reminders/${id}/take`, { scheduledTime }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Take Reminder error:", error);
        throw error.response ? error.response.data : error;
    }
}

export const snoozeReminder = async (token, id) => {
    try {
        const response = await client.post(`/reminders/${id}/snooze`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Snooze Reminder error:", error);
        throw error.response ? error.response.data : error;
    }
}
export const getPendingCount = async (token) => {
    try {
        const response = await client.get(`/reminders/pending/count`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.count;
    } catch (error) {
        console.error("Get Pending Count error:", error);
        return 0;
    }
}

export const getMissedReminders = async (token, page = 1, limit = 10) => {
    try {
        const response = await client.get('/reminders/missed', {
            headers: { Authorization: `Bearer ${token}` },
            params: { page, limit }
        });
        return response.data;
    } catch (error) {
        console.error("Get Missed Reminders error:", error);
        throw error.response ? error.response.data : error;
    }
}
export const clearAllReminders = async (token) => {
    try {
        const response = await client.post('/reminders/missed/clear', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Clear All Reminders error:", error);
        throw error.response ? error.response.data : error;
    }
}

export const deleteAllReminders = async (token) => {
    try {
        const response = await client.delete('/reminders/user', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Delete All Reminders error:", error);
        throw error.response ? error.response.data : error;
    }
}
