import { describe, it, expect, vi } from 'vitest';
import { AIService } from './ai';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('AIService', () => {
  describe('summary', () => {
    it('should generate summary with OpenAI', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: '摘要：这是一段测试对话\n情感：积极\n要点：测试、对话、AI'
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key'
      });

      const result = await service.summary(['Hello', 'How are you?']);

      expect(result.summary).toBe('这是一段测试对话');
      expect(result.sentiment).toBe('positive');
      expect(result.keyPoints).toEqual(['测试', '对话', 'AI']);
    });

    it('should handle empty text array', async () => {
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key'
      });

      await expect(service.summary([])).rejects.toThrow('Text array cannot be empty');
    });

    it('should handle text too long', async () => {
      const longText = 'a'.repeat(5000);
      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key'
      });

      await expect(service.summary([longText])).rejects.toThrow('Text too long');
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key'
      });

      await expect(service.summary(['Hello'])).rejects.toThrow('Failed to generate summary');
    });

    it('should generate summary with Anthropic', async () => {
      const mockResponse = {
        data: {
          content: [{
            text: '摘要：这是一段测试对话\n情感：中性\n要点：测试、对话'
          }]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const service = new AIService({
        provider: 'anthropic',
        apiKey: 'test-key'
      });

      const result = await service.summary(['Hello']);

      expect(result.sentiment).toBe('neutral');
    });
  });
});