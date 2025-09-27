/**
 * 基础测试示例 - 验证测试框架正常工作
 */

describe('测试框架验证', () => {
  it('测试环境应该正确设置', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('基础JavaScript功能应该正常', () => {
    const testObject = {
      name: '测试',
      value: 123,
      active: true
    };

    expect(testObject.name).toBe('测试');
    expect(testObject.value).toBeGreaterThan(100);
    expect(testObject.active).toBe(true);
  });

  it('异步函数应该正常工作', async () => {
    const asyncFunction = () => {
      return new Promise(resolve => {
        setTimeout(() => resolve('测试完成'), 10);
      });
    };

    const result = await asyncFunction();
    expect(result).toBe('测试完成');
  });

  it('数组操作应该正常', () => {
    const testArray = [1, 2, 3, 4, 5];
    const filtered = testArray.filter(n => n > 3);
    const mapped = testArray.map(n => n * 2);

    expect(filtered).toEqual([4, 5]);
    expect(mapped).toEqual([2, 4, 6, 8, 10]);
  });

  it('测试工具函数应该可用', () => {
    expect(testUtils).toBeDefined();
    expect(testUtils.createMockMessages).toBeInstanceOf(Function);
    
    const mockMessages = testUtils.createMockMessages(3);
    expect(mockMessages).toHaveLength(3);
    expect(mockMessages[0]).toMatchObject({
      id: expect.any(Number),
      content: expect.any(String),
      sender: expect.any(String),
      senderName: expect.any(String),
      timestamp: expect.any(String),
      type: 'text'
    });
  });
});