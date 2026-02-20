import client from './client';

export const analyzeMedicine = async (token, data) => {
  try {
    // Gateway routes /analyze -> Medicine Analyzer
    const response = await client.post('/analyze', { medicine_data: data }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error("Analyze Medicine error:", error);
    throw error.response ? error.response.data : error;
  }
};
