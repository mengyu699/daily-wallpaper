import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import searchRoutes from './search';

// Mock MongoDB
vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    db: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([
                  {
                    _id: '1',
                    msgId: 'msg1',
                    content: 'Hello World',
                    sender: 'user1',
                    receiver: 'user2',
                    timestamp: 1234567890,
                    chatId: 'chat1',
                    type: 1
                  }
                ])
              })
            })
          })
        }),
        countDocuments: vi.fn().mockResolvedValue(1),
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              _id: 'chat1',
              lastMessage: { content: 'Hello' },
              messageCount: 10,
              lastTimestamp: 1234567890
            }
          ])
        })
      })
    }),
    close: vi.fn()
  }))
}));

const app = express();
app.use(searchRoutes);

describe('Search API', () => {
  describe('GET /api/search', () => {
    it('should return search results', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ query: 'Hello' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toHaveLength(1);
      expect(response.body.data.messages[0].content).toBe('Hello World');
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ page: '2', limit: '10' });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should handle date range filters', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ from: '2024-01-01', to: '2024-12-31' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/chats', () => {
    it('should return chat list', async () => {
      const response = await request(app)
        .get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].chatId).toBe('chat1');
    });
  });
});