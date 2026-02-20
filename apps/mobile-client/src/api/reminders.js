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
