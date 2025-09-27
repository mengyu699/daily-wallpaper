import axios from 'axios';

interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'deepseek';
  apiKey: string;
  baseURL?: string;
}

interface AISummaryResponse {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keyPoints: string[];
}

export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  async summary(texts: string[]): Promise<AISummaryResponse> {
    if (texts.length === 0) {
      throw new Error('Text array cannot be empty');
    }

    const combinedText = texts.join('\n\n');
    
    if (combinedText.length > 4000) {
      throw new Error('Text too long, please limit to 4000 characters');
    }

    const prompt = `请对以下微信聊天记录进行摘要，要求：
1. 用中文总结对话的主要内容
2. 分析对话的情感倾向（积极/消极/中性）
3. 提取3-5个关键信息点
4. 控制在100字以内

聊天记录：
${combinedText}

请按以下格式返回：
摘要：[简洁的摘要]
情感：[积极/消极/中性]
要点：[关键信息点1]、[关键信息点2]、[关键信息点3]`;

    try {
      let response;

      switch (this.config.provider) {
        case 'openai':
          response = await this.callOpenAI(prompt);
          break;
        case 'anthropic':
          response = await this.callAnthropic(prompt);
          break;
        case 'deepseek':
          response = await this.callDeepSeek(prompt);
          break;
        default:
          throw new Error('Unsupported AI provider');
      }

      return this.parseResponse(response);
    } catch (error) {
      console.error('AI summary error:', error);
      throw new Error('Failed to generate summary');
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await axios.post(
      this.config.baseURL || 'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const response = await axios.post(
      this.config.baseURL || 'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      }
    );

    return response.data.content[0]?.text || '';
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    const response = await axios.post(
      this.config.baseURL || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  private parseResponse(response: string): AISummaryResponse {
    const lines = response.split('\n');
    let summary = '';
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let keyPoints: string[] = [];

    for (const line of lines) {
      if (line.startsWith('摘要：')) {
        summary = line.replace('摘要：', '').trim();
      } else if (line.startsWith('情感：')) {
        const sentimentText = line.replace('情感：', '').trim();
        if (sentimentText.includes('积极')) sentiment = 'positive';
        else if (sentimentText.includes('消极')) sentiment = 'negative';
        else sentiment = 'neutral';
      } else if (line.startsWith('要点：')) {
        const pointsText = line.replace('要点：', '').trim();
        keyPoints = pointsText.split('、').map(p => p.trim()).filter(p => p);
      }
    }

    // 如果解析失败，使用默认值
    if (!summary) {
      summary = '对话内容已总结，但格式不符合预期。';
    }
    if (keyPoints.length === 0) {
      keyPoints = ['对话内容包含重要信息'];
    }

    return { summary, sentiment, keyPoints };
  }
}

export default AIService;