import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeChatSyncService } from './sync_wechat';
import axios from 'axios';
import { MongoClient } from 'mongodb';

vi.mock('axios');
vi.mock('mongodb');
const mockedMongoClient = vi.mocked(MongoClient);

describe('WeChatSyncService', () => {
  let service: WeChatSyncService;
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCollection = {
      findOne: vi.fn(),
      updateOne: vi.fn(),
      insertMany: vi.fn(),
      createIndex: vi.fn()
    };
    
    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    };

    const mockClient = {
      db: vi.fn().mockReturnValue(mockDb),
      connect: vi.fn(),
      close: vi.fn()
    };

    mockedMongoClient.prototype = mockClient as any;
    service = new WeChatSyncService();
  });

  it('should get last sync time', async () => {
    mockCollection.findOne.mockResolvedValue({ _id: 'last_sync', timestamp: 1234567890 });
    
    const result = await service.getLastSyncTime();
    expect(result).toBe(1234567890);
  });

  it('should return 0 if no last sync time', async () => {
    mockCollection.findOne.mockResolvedValue(null);
    
    const result = await service.getLastSyncTime();
    expect(result).toBe(0);
  });

  it('should fetch messages successfully', async () => {
    const mockMessages = [
      { msgId: '1', content: 'Hello', timestamp: 1234567890 }
    ];
    
    vi.mocked(axios.get).mockResolvedValue({
      data: { messages: mockMessages }
    });

    const result = await service.fetchMessages(1234567890);
    expect(result).toEqual(mockMessages);
    expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
      'http://localhost:3030/messages',
      {
        params: {
          since: expect.any(String),
          limit: 1000
        }
      }
    );
  });

  it('should handle empty messages', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { messages: [] } });
    
    const result = await service.syncMessages();
    expect(result.insertedCount).toBe(0);
    expect(result.latestTimestamp).toBe(0);
  });

  it('should update last sync time', async () => {
    await service.updateLastSyncTime(1234567890);
    
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'last_sync' },
      expect.objectContaining({
        $set: expect.objectContaining({ timestamp: 1234567890 })
      }),
      { upsert: true }
    );
  });
});