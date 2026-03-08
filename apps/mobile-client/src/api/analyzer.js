import client from './client';

export const analyzeMedicine = async (token, data) => {
  try {
    // Gateway routes /analyze -> Medicine Analyzer
    const response = await client.post('/analyze', { medicine_data: data }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const serverError = error.response?.data
      ? { ...error.response.data, status }   // merge HTTP status into server payload
      : error;

    if (serverError?.error === 'NOT_MEDICINE_LABEL') {
      console.log('Log: invalid medicine label image');
    } else {
      console.error('Analyze Medicine error:', error);
    }
    throw serverError;
  }
};
