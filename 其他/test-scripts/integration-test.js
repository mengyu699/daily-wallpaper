#!/usr/bin/env node

/**
 * n8n + 扣子 集成测试脚本
 * 用于验证 n8n 工作流 API 端点是否正常工作
 */

const https = require('https');
const http = require('http');

// 配置信息
const CONFIG = {
  // 替换为您的 n8n 实例URL
  N8N_BASE_URL: 'https://your-n8n-instance.com',
  // 替换为您的API密钥（如果启用了认证）
  API_KEY: 'your-secret-api-key',
  // 测试端点路径
  WEBHOOK_PATH: '/webhook/echo-service'
};

/**
 * 发送HTTP请求的工具函数
 */
function makeRequest(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };

    const req = requestModule.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * 测试用例定义
 */
const TEST_CASES = [
  {
    name: '基本回声测试',
    description: '测试基本的消息回声功能',
    payload: {
      user_query: '你好，这是一个测试消息',
      user_id: 'test_user_001',
      context: {
        session_id: 'test_session_' + Date.now(),
        timestamp: new Date().toISOString(),
        test_case: 'basic_echo'
      }
    },
    expectedFields: ['success', 'data', 'message', 'timestamp']
  },
  {
    name: '最小参数测试',
    description: '测试只使用必需参数的情况',
    payload: {
      user_query: '最小参数测试',
      user_id: 'test_user_002'
    },
    expectedFields: ['success', 'data', 'message']
  },
  {
    name: '中文测试',
    description: '测试中文字符处理',
    payload: {
      user_query: '这是一个包含中文、数字123和符号！@#的测试',
      user_id: 'test_user_003',
      context: {
        language: 'zh-CN',
        encoding: 'utf-8'
      }
    },
    expectedFields: ['success', 'data']
  },
  {
    name: '长文本测试',
    description: '测试较长文本的处理',
    payload: {
      user_query: '这是一个很长的测试文本，用来验证系统是否能够正确处理较长的用户输入。'.repeat(5),
      user_id: 'test_user_004',
      context: {
        text_length: 'long'
      }
    },
    expectedFields: ['success', 'data']
  },
  {
    name: 'JSON数据测试',
    description: '测试复杂JSON数据的处理',
    payload: {
      user_query: '请处理这个复杂的查询',
      user_id: 'test_user_005',
      context: {
        complex_data: {
          nested_object: {
            array: [1, 2, 3],
            boolean: true,
            null_value: null
          },
          metadata: {
            version: '1.0',
            features: ['feature1', 'feature2']
          }
        }
      }
    },
    expectedFields: ['success', 'data']
  }
];

/**
 * 运行单个测试用例
 */
async function runTestCase(testCase) {
  console.log(`\n🧪 运行测试: ${testCase.name}`);
  console.log(`📝 描述: ${testCase.description}`);
  
  try {
    const requestData = JSON.stringify(testCase.payload);
    const headers = {};
    
    // 如果配置了API密钥，添加到请求头
    if (CONFIG.API_KEY && CONFIG.API_KEY !== 'your-secret-api-key') {
      headers['X-API-Key'] = CONFIG.API_KEY;
    }
    
    const startTime = Date.now();
    const response = await makeRequest(
      CONFIG.N8N_BASE_URL + CONFIG.WEBHOOK_PATH,
      requestData,
      headers
    );
    const endTime = Date.now();
    
    console.log(`⏱️  响应时间: ${endTime - startTime}ms`);
    console.log(`📊 HTTP状态码: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log(`✅ 测试通过`);
      
      // 验证响应数据结构
      const responseData = response.data;
      console.log(`📦 响应数据预览:`, {
        success: responseData.success,
        message: responseData.message,
        hasData: !!responseData.data,
        timestamp: responseData.timestamp
      });
      
      // 检查期望的字段
      const missingFields = testCase.expectedFields.filter(field => !(field in responseData));
      if (missingFields.length > 0) {
        console.log(`⚠️  缺少期望字段: ${missingFields.join(', ')}`);
      }
      
      // 如果有data字段，显示部分内容
      if (responseData.data) {
        console.log(`📄 data字段内容:`, JSON.stringify(responseData.data, null, 2));
      }
      
      return { success: true, responseTime: endTime - startTime };
    } else {
      console.log(`❌ 测试失败`);
      console.log(`📋 响应内容:`, response.data);
      return { success: false, statusCode: response.statusCode, responseTime: endTime - startTime };
    }
    
  } catch (error) {
    console.log(`❌ 测试失败 - 网络错误`);
    console.log(`🐛 错误详情:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 运行所有测试用例
 */
async function runAllTests() {
  console.log('🚀 开始 n8n + 扣子 集成测试');
  console.log(`🔗 测试目标: ${CONFIG.N8N_BASE_URL}${CONFIG.WEBHOOK_PATH}`);
  console.log(`🔑 使用API密钥: ${CONFIG.API_KEY !== 'your-secret-api-key' ? '是' : '否'}`);
  console.log(`📅 测试时间: ${new Date().toLocaleString()}`);
  console.log('=' .repeat(60));
  
  const results = [];
  const startTime = Date.now();
  
  for (const testCase of TEST_CASES) {
    const result = await runTestCase(testCase);
    results.push({
      name: testCase.name,
      ...result
    });
    
    // 测试之间稍作停顿
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const endTime = Date.now();
  
  // 显示测试总结
  console.log('\n' + '=' .repeat(60));
  console.log('📊 测试总结报告');
  console.log('=' .repeat(60));
  
  const passedTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`✅ 通过测试: ${passedTests.length}/${results.length}`);
  console.log(`❌ 失败测试: ${failedTests.length}/${results.length}`);
  console.log(`⏱️  总执行时间: ${endTime - startTime}ms`);
  
  if (passedTests.length > 0) {
    const avgResponseTime = passedTests.reduce((sum, t) => sum + (t.responseTime || 0), 0) / passedTests.length;
    console.log(`📈 平均响应时间: ${Math.round(avgResponseTime)}ms`);
  }
  
  // 显示失败的测试
  if (failedTests.length > 0) {
    console.log('\n❌ 失败的测试用例:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}: ${test.error || `HTTP ${test.statusCode}`}`);
    });
  }
  
  // 提供建议
  console.log('\n💡 建议:');
  if (failedTests.length === 0) {
    console.log('  - 所有测试都通过了！您的 n8n 工作流运行正常');
    console.log('  - 现在可以在扣子中配置自定义插件了');
  } else {
    console.log('  - 请检查 n8n 实例是否正在运行');
    console.log('  - 确认URL配置是否正确');
    console.log('  - 检查防火墙和网络连接');
    if (CONFIG.API_KEY !== 'your-secret-api-key') {
      console.log('  - 验证API密钥是否正确');
    }
  }
  
  console.log('\n🔗 下一步:');
  console.log('  1. 如果测试通过，使用 coze-plugins/n8n-echo-plugin.json 配置扣子插件');
  console.log('  2. 在扣子平台创建智能体并添加自定义插件');
  console.log('  3. 测试端到端的对话功能');
  
  process.exit(failedTests.length > 0 ? 1 : 0);
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
n8n + 扣子 集成测试工具

使用方法:
  node integration-test.js [选项]

选项:
  --url <url>     指定n8n实例URL (默认: ${CONFIG.N8N_BASE_URL})
  --key <key>     指定API密钥
  --path <path>   指定webhook路径 (默认: ${CONFIG.WEBHOOK_PATH})
  --help          显示帮助信息

示例:
  node integration-test.js --url https://my-n8n.com --key my-api-key
  node integration-test.js --url http://localhost:5678
`);
  process.exit(0);
}

// 解析命令行参数
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--url':
      CONFIG.N8N_BASE_URL = args[++i];
      break;
    case '--key':
      CONFIG.API_KEY = args[++i];
      break;
    case '--path':
      CONFIG.WEBHOOK_PATH = args[++i];
      break;
    case '--help':
      showHelp();
      break;
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  runTestCase,
  TEST_CASES,
  CONFIG
};