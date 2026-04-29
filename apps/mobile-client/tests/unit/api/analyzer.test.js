import { analyzeMedicine } from '../../../src/api/analyzer';
import client from '../../../src/api/client';

jest.mock('../../../src/api/client', () => ({
  post: jest.fn(),
}));

describe('Analyzer API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeMedicine', () => {
    it('should post medicine data and return result', async () => {
      const mockData = { data: { result: 'Good Medicine' } };
      client.post.mockResolvedValueOnce(mockData);

      const result = await analyzeMedicine('token123', 'image_base64_data');
      expect(client.post).toHaveBeenCalledWith(
        '/analyze',
        { medicine_data: 'image_base64_data' },
        { headers: { Authorization: 'Bearer token123' } }
      );
      expect(result).toEqual(mockData.data);
    });

    it('should throw server error with status', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { error: 'NOT_MEDICINE_LABEL' },
        },
      };
      client.post.mockRejectedValueOnce(mockError);

      await expect(analyzeMedicine('token123', 'bad_data')).rejects.toEqual({
        error: 'NOT_MEDICINE_LABEL',
        status: 400,
      });
    });
  });
});
