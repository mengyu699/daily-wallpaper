# 飞书多维表格照片提取 - HTTP协议实现方案

## 方案1：飞书机器人 + HTTP Webhook

### 1.1 创建飞书机器人
```json
POST https://open.feishu.cn/open-apis/bot/v2/hook/{webhook_token}
Content-Type: application/json

{
  "msg_type": "interactive",
  "card": {
    "elements": [
      {
        "tag": "button",
        "text": {
          "tag": "plain_text",
          "content": "提取照片"
        },
        "type": "primary",
        "url": "https://your-server.com/extract-photos"
      }
    ]
  }
}
```

### 1.2 HTTP服务端处理
```javascript
// Node.js Express 示例
app.post('/extract-photos', async (req, res) => {
  try {
    // 1. 获取访问令牌
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: 'cli_a4b128a68fb9d00e',
        app_secret: 'TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc'
      })
    });
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.tenant_access_token;
    
    // 2. 查询多维表格数据
    const recordsResponse = await fetch(
      'https://open.feishu.cn/open-apis/bitable/v1/apps/RlMubEOWxaiykXsKJIRcbRAfni2/tables/tblEeAYFnTlvIYZQ/records/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page_size: 100 })
      }
    );
    
    const recordsData = await recordsResponse.json();
    
    // 3. 提取照片链接
    const photoLinks = [];
    for (const item of recordsData.data.items) {
      const fields = item.fields || {};
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          for (const attachment of fieldValue) {
            if (attachment.type && attachment.type.startsWith('image/')) {
              photoLinks.push({
                name: attachment.name,
                url: attachment.url,
                downloadUrl: `https://your-server.com/download-photo?token=${attachment.file_token}`
              });
            }
          }
        }
      }
    }
    
    // 4. 返回结果给飞书
    res.json({
      msg_type: 'text',
      content: {
        text: `找到 ${photoLinks.length} 张照片\n${photoLinks.map(p => `• ${p.name}: ${p.downloadUrl}`).join('\n')}`
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 方案2：飞书小程序 + HTTP API

### 2.1 飞书小程序前端
```javascript
// 小程序 JavaScript
Page({
  data: {
    photos: []
  },
  
  async extractPhotos() {
    try {
      // 调用后端API
      const response = await tt.request({
        url: 'https://your-server.com/api/extract-photos',
        method: 'POST',
        header: {
          'content-type': 'application/json'
        },
        data: {
          bitableUrl: 'https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ'
        }
      });
      
      this.setData({
        photos: response.data.photos
      });
      
      tt.showToast({
        title: `找到 ${response.data.photos.length} 张照片`,
        icon: 'success'
      });
      
    } catch (error) {
      tt.showToast({
        title: '提取失败',
        icon: 'error'
      });
    }
  },
  
  downloadPhoto(e) {
    const photoUrl = e.currentTarget.dataset.url;
    tt.downloadFile({
      url: photoUrl,
      success: (res) => {
        tt.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            tt.showToast({ title: '保存成功' });
          }
        });
      }
    });
  }
});
```

### 2.2 小程序WXML界面
```xml
<!-- 小程序界面 -->
<view class="container">
  <button bindtap="extractPhotos" class="extract-btn">提取照片</button>
  
  <view wx:for="{{photos}}" wx:key="index" class="photo-item">
    <image src="{{item.thumbnail}}" mode="aspectFit"></image>
    <text class="photo-name">{{item.name}}</text>
    <button bindtap="downloadPhoto" data-url="{{item.downloadUrl}}" size="mini">下载</button>
  </view>
</view>
```

## 方案3：飞书快捷指令 + HTTP API

### 3.1 创建快捷指令
```json
{
  "command": "/extract_photos",
  "description": "提取多维表格照片",
  "webhook_url": "https://your-server.com/webhook/extract-photos",
  "method": "POST"
}
```

### 3.2 Webhook处理
```python
# Python Flask 示例
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/webhook/extract-photos', methods=['POST'])
def extract_photos_webhook():
    try:
        # 获取飞书传来的数据
        data = request.json
        user_id = data.get('user_id')
        
        # 执行照片提取逻辑
        photos = extract_photos_from_bitable()
        
        # 构建回复消息
        message = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": f"找到 {len(photos)} 张照片"
                    }
                },
                "elements": []
            }
        }
        
        # 添加每张照片的下载链接
        for photo in photos:
            message["card"]["elements"].append({
                "tag": "action",
                "actions": [{
                    "tag": "button",
                    "text": {
                        "tag": "plain_text",
                        "content": f"下载 {photo['name']}"
                    },
                    "url": f"https://your-server.com/download/{photo['token']}"
                }]
            })
        
        return jsonify(message)
        
    except Exception as e:
        return jsonify({
            "msg_type": "text",
            "content": {
                "text": f"提取失败: {str(e)}"
            }
        }), 500

def extract_photos_from_bitable():
    # 之前的照片提取逻辑
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    # 获取token
    token_resp = requests.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        json={"app_id": APP_ID, "app_secret": APP_SECRET}
    )
    access_token = token_resp.json()['tenant_access_token']
    
    # 查询记录
    records_resp = requests.post(
        'https://open.feishu.cn/open-apis/bitable/v1/apps/RlMubEOWxaiykXsKJIRcbRAfni2/tables/tblEeAYFnTlvIYZQ/records/search',
        headers={'Authorization': f'Bearer {access_token}'},
        json={'page_size': 100}
    )
    
    photos = []
    for item in records_resp.json()['data']['items']:
        fields = item.get('fields', {})
        for field_name, field_value in fields.items():
            if isinstance(field_value, list):
                for attachment in field_value:
                    if attachment.get('type', '').startswith('image/'):
                        photos.append({
                            'name': attachment['name'],
                            'token': attachment['file_token'],
                            'url': attachment['url']
                        })
    
    return photos

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## 方案4：纯HTTP客户端调用

### 4.1 cURL示例
```bash
#!/bin/bash

# 1. 获取访问令牌
ACCESS_TOKEN=$(curl -s -X POST \
  "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "cli_a4b128a68fb9d00e",
    "app_secret": "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
  }' | jq -r '.tenant_access_token')

echo "获取到访问令牌: $ACCESS_TOKEN"

# 2. 查询多维表格记录
RECORDS=$(curl -s -X POST \
  "https://open.feishu.cn/open-apis/bitable/v1/apps/RlMubEOWxaiykXsKJIRcbRAfni2/tables/tblEeAYFnTlvIYZQ/records/search" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page_size": 100}')

echo "查询结果: $RECORDS"

# 3. 提取照片下载链接
PHOTO_URLS=$(echo "$RECORDS" | jq -r '.data.items[].fields | to_entries[] | select(.value | type == "array") | .value[] | select(.type | startswith("image/")) | .url')

echo "照片下载链接:"
echo "$PHOTO_URLS"

# 4. 下载照片
mkdir -p photos
COUNTER=1
while IFS= read -r url; do
  if [ -n "$url" ]; then
    echo "下载照片 $COUNTER: $url"
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
         -o "photos/photo_$COUNTER.png" \
         "$url"
    echo "保存为: photos/photo_$COUNTER.png"
    ((COUNTER++))
  fi
done <<< "$PHOTO_URLS"

echo "下载完成!"
```

### 4.2 Postman Collection
```json
{
  "info": {
    "name": "飞书照片提取",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "获取访问令牌",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"app_id\": \"cli_a4b128a68fb9d00e\",\n  \"app_secret\": \"TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc\"\n}"
        },
        "url": {
          "raw": "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
          "protocol": "https",
          "host": ["open", "feishu", "cn"],
          "path": ["open-apis", "auth", "v3", "tenant_access_token", "internal"]
        }
      }
    },
    {
      "name": "查询多维表格记录",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"page_size\": 100\n}"
        },
        "url": {
          "raw": "https://open.feishu.cn/open-apis/bitable/v1/apps/RlMubEOWxaiykXsKJIRcbRAfni2/tables/tblEeAYFnTlvIYZQ/records/search",
          "protocol": "https",
          "host": ["open", "feishu", "cn"],
          "path": ["open-apis", "bitable", "v1", "apps", "RlMubEOWxaiykXsKJIRcbRAfni2", "tables", "tblEeAYFnTlvIYZQ", "records", "search"]
        }
      }
    }
  ]
}
```

## 方案5：JavaScript前端实现

### 5.1 纯JavaScript实现
```html
<!DOCTYPE html>
<html>
<head>
    <title>飞书照片提取器</title>
    <meta charset="utf-8">
</head>
<body>
    <div id="app">
        <h1>飞书多维表格照片提取器</h1>
        <button onclick="extractPhotos()">提取照片</button>
        <div id="results"></div>
    </div>

    <script>
        async function extractPhotos() {
            try {
                // 注意：在实际生产环境中，不应该在前端暴露APP_SECRET
                // 应该通过后端代理API调用
                const response = await fetch('/api/extract-photos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        bitableUrl: 'https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ'
                    })
                });
                
                const data = await response.json();
                displayResults(data.photos);
                
            } catch (error) {
                console.error('提取失败:', error);
                document.getElementById('results').innerHTML = '<p>提取失败: ' + error.message + '</p>';
            }
        }
        
        function displayResults(photos) {
            const resultsDiv = document.getElementById('results');
            let html = '<h2>提取结果:</h2>';
            
            photos.forEach((photo, index) => {
                html += `
                    <div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">
                        <h3>${photo.name}</h3>
                        <p>大小: ${photo.size} 字节</p>
                        <button onclick="downloadPhoto('${photo.url}', '${photo.name}')">下载</button>
                        <img src="${photo.thumbnailUrl}" style="max-width: 200px; height: auto;" />
                    </div>
                `;
            });
            
            resultsDiv.innerHTML = html;
        }
        
        async function downloadPhoto(url, filename) {
            try {
                const response = await fetch(`/api/download-photo?url=${encodeURIComponent(url)}`);
                const blob = await response.blob();
                
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                
            } catch (error) {
                alert('下载失败: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

## 部署建议

### 1. 安全性
- 不要在前端暴露 APP_SECRET
- 使用 HTTPS 协议
- 实现访问令牌缓存和刷新机制
- 添加请求频率限制

### 2. 可扩展性
- 使用消息队列处理大量照片下载
- 实现分页查询支持大数据量
- 添加进度条显示下载状态

### 3. 用户体验
- 提供照片预览功能
- 支持批量下载和选择性下载
- 添加错误重试机制