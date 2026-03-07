import { jest } from '@jest/globals';

// Mock dependencies using unstable_mockModule
jest.unstable_mockModule('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn(),
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  default: {
    PINECONE_API_KEY: 'test-key',
    PINECONE_INDEX: 'test-index',
    PINECONE_INDEX_HOST: 'test-host',
    PINECONE_NAMESPACE: 'test-namespace',
  }
}));

jest.unstable_mockModule('../src/config/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Import modules AFTER mocking
const { Pinecone } = await import('@pinecone-database/pinecone');
const { default: ragClient } = await import('../src/services/ragClient.js');

// Define mocks outside to maintain stable references across tests (since module state is cached)
const mockSearchRecords = jest.fn();

const mockNamespace = {
    searchRecords: mockSearchRecords
};

const mockIndex = {
    namespace: jest.fn().mockReturnValue(mockNamespace)
};

describe('ragClient', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchRecords.mockReset(); 
    // Ensure Pinecone constructor returns our stable mockIndex
    Pinecone.mockReturnValue({
        index: jest.fn().mockReturnValue(mockIndex),
    });
  });

  it('search should query Pinecone with integrated embedding syntax', async () => {
    mockSearchRecords.mockResolvedValue({
      result: {
        hits: [
          { fields: { text: "Result 1" }, _score: 0.9 },
          { fields: { text: "Result 2" }, _score: 0.8 },
        ]
      }
    });

    const results = await ragClient.search("test query", 5);

    expect(mockSearchRecords).toHaveBeenCalledWith({
      query: {
        topK: 5,
        inputs: { text: "test query" }
      }
    });

    expect(results).toEqual([
      { text: "Result 1", score: 0.9 },
      { text: "Result 2", score: 0.8 },
    ]);
  });

  it('should return empty array on logging error', async () => {
    mockSearchRecords.mockRejectedValue(new Error("Pinecone error"));
    
    const results = await ragClient.search("fail", 5);
    
    expect(results).toEqual([]);
  });
});
