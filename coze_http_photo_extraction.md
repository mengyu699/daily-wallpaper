# 扣子(Coze)中通过HTTP调用提取飞书照片的方案

## 场景说明
- 平台：扣子(Coze)
- 已有：通过API获取的多维表格记录数据
- 目标：解析照片字段，获取实际照片文件

## 数据结构分析

### 你已经拿到的照片字段数据格式：
```json
{
  "照片": [
    {
      "file_token": "LKT6bhdQZoGzxRx1dCAcz4uKnLY",
      "name": "11.png",
      "size": 3902137,
      "tmp_url": "https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=LKT6bhdQZoGzxRx1dCAcz4uKnLY",
      "type": "image/png",
      "url": "https://open.feishu.cn/open-apis/drive/v1/medias/LKT6bhdQZoGzxRx1dCAcz4uKnLY/download"
    }
  ]
}
```

## 方案1：扣子内置HTTP节点调用

### 步骤1：获取访问令牌
```yaml
HTTP节点配置:
  方法: POST
  URL: https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
  请求头:
    Content-Type: application/json
  请求体:
    {
      "app_id": "cli_a4b128a68fb9d00e",
      "app_secret": "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    }
  
输出变量: access_token
提取路径: $.tenant_access_token
```

### 步骤2：解析照片字段数据
```javascript
// 在代码节点中解析照片字段
function parsePhotoField(recordData) {
    const photos = [];
    
    // 遍历记录的所有字段
    for (const [fieldName, fieldValue] of Object.entries(recordData.fields || {})) {
        // 检查是否是照片字段
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
            for (const attachment of fieldValue) {
                // 检查是否是图片类型的附件
                if (attachment.type && attachment.type.startsWith('image/')) {
                    photos.push({
                        fieldName: fieldName,
                        fileName: attachment.name,
                        fileToken: attachment.file_token,
                        fileSize: attachment.size,
                        fileType: attachment.type,
                        downloadUrl: attachment.url,
                        tmpUrl: attachment.tmp_url
                    });
                }
            }
        }
    }
    
    return photos;
}

// 使用示例
const photos = parsePhotoField(inputRecord);
return { photos: photos, count: photos.length };
```

### 步骤3：下载照片文件
```yaml
HTTP节点配置 (针对每张照片):
  方法: GET
  URL: {{photo.downloadUrl}}  # 使用步骤2解析出的downloadUrl
  请求头:
    Authorization: Bearer {{access_token}}
    User-Agent: Mozilla/5.0 (compatible; Coze-Bot)
    
输出: 二进制文件数据
保存方式: 
  - 转换为base64字符串存储
  - 或保存到临时文件系统
```

## 方案2：批量处理多条记录

### 工作流设计：
```yaml
1. 输入节点: 多维表格记录数组

2. 循环节点: 遍历每条记录
   - 解析照片字段
   - 提取所有照片信息

3. HTTP节点: 获取访问令牌 (复用)

4. 嵌套循环节点: 遍历每张照片
   - 下载照片文件
   - 转换格式

5. 输出节点: 返回处理结果
```

### 代码实现：
```javascript
// 批量解析所有记录的照片字段
function batchParsePhotos(records) {
    const allPhotos = [];
    
    records.forEach((record, recordIndex) => {
        const photos = parsePhotoField(record);
        photos.forEach(photo => {
            allPhotos.push({
                ...photo,
                recordId: record.record_id,
                recordIndex: recordIndex
            });
        });
    });
    
    return allPhotos;
}

// 批量下载照片
async function batchDownloadPhotos(photos, accessToken) {
    const results = [];
    
    for (const photo of photos) {
        try {
            // 构建下载请求
            const downloadUrl = photo.downloadUrl;
            
            // 返回下载配置，供HTTP节点使用
            results.push({
                photoInfo: photo,
                downloadConfig: {
                    url: downloadUrl,
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "User-Agent": "Mozilla/5.0 (compatible; Coze-Bot)"
                    }
                }
            });
        } catch (error) {
            results.push({
                photoInfo: photo,
                error: error.message
            });
        }
    }
    
    return results;
}
```

## 方案3：扣子自定义插件方式

### 插件配置：
```yaml
插件名称: 飞书照片提取器
输入参数:
  - records: 多维表格记录数组
  - app_id: 飞书应用ID
  - app_secret: 飞书应用密钥
  
输出参数:
  - photos: 照片信息数组
  - download_urls: 可直接访问的下载链接
  - summary: 处理摘要
```

### 插件API设计：
```javascript
{
  "name": "extract_feishu_photos",
  "description": "提取飞书多维表格中的照片",
  "parameters": {
    "type": "object",
    "properties": {
      "records": {
        "type": "array",
        "description": "多维表格记录数组"
      },
      "app_credentials": {
        "type": "object",
        "properties": {
          "app_id": {"type": "string"},
          "app_secret": {"type": "string"}
        }
      }
    },
    "required": ["records", "app_credentials"]
  }
}
```

## 方案4：完整的扣子工作流

### 节点流程图：
```
[输入记录数据] 
    ↓
[解析照片字段] (代码节点)
    ↓
[获取访问令牌] (HTTP节点)
    ↓
[并行下载照片] (批处理HTTP节点)
    ↓
[格式化输出] (代码节点)
    ↓
[返回结果]
```

### 具体配置：

#### 节点1：解析照片字段
```javascript
// 输入: records (数组)
function main(input) {
    const { records } = input;
    const allPhotos = [];
    
    records.forEach(record => {
        const fields = record.fields || {};
        
        Object.entries(fields).forEach(([fieldName, fieldValue]) => {
            if (Array.isArray(fieldValue)) {
                fieldValue.forEach(attachment => {
                    if (attachment.type && attachment.type.startsWith('image/')) {
                        allPhotos.push({
                            recordId: record.record_id,
                            fieldName: fieldName,
                            fileName: attachment.name,
                            fileToken: attachment.file_token,
                            fileSize: attachment.size,
                            fileType: attachment.type,
                            downloadUrl: attachment.url
                        });
                    }
                });
            }
        });
    });
    
    return { photos: allPhotos };
}
```

#### 节点2：获取访问令牌
```yaml
HTTP请求:
  URL: https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
  方法: POST
  头部:
    Content-Type: application/json
  体:
    {
      "app_id": "cli_a4b128a68fb9d00e",
      "app_secret": "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    }
```

#### 节点3：批量下载照片
```javascript
// 为每张照片生成下载配置
function generateDownloadConfigs(input) {
    const { photos, access_token } = input;
    
    const downloadConfigs = photos.map(photo => ({
        url: photo.downloadUrl,
        headers: {
            "Authorization": `Bearer ${access_token}`,
            "User-Agent": "Mozilla/5.0 (compatible; Coze-Bot)"
        },
        metadata: {
            fileName: photo.fileName,
            fileToken: photo.fileToken,
            recordId: photo.recordId,
            fieldName: photo.fieldName
        }
    }));
    
    return { downloadConfigs };
}
```

#### 节点4：处理下载结果
```javascript
function processDownloadResults(input) {
    const { downloadResults } = input;
    
    const processedPhotos = downloadResults.map(result => {
        if (result.success) {
            return {
                ...result.metadata,
                status: 'downloaded',
                fileSize: result.data.length,
                base64Data: btoa(result.data), // 转换为base64
                downloadTime: new Date().toISOString()
            };
        } else {
            return {
                ...result.metadata,
                status: 'failed',
                error: result.error
            };
        }
    });
    
    const summary = {
        total: processedPhotos.length,
        success: processedPhotos.filter(p => p.status === 'downloaded').length,
        failed: processedPhotos.filter(p => p.status === 'failed').length
    };
    
    return { 
        photos: processedPhotos, 
        summary: summary 
    };
}
```

## 关键要点

1. **认证管理**: 在扣子中缓存access_token，避免重复获取
2. **并发控制**: 控制同时下载的照片数量，避免触发API限制
3. **错误处理**: 对每个HTTP调用添加重试机制
4. **数据格式**: 将照片转换为base64格式便于在扣子中传递
5. **性能优化**: 对大量照片进行分批处理

## 使用示例

在扣子中调用这个工作流：
```
输入: 你已经获取的多维表格记录数据
输出: 
{
  "photos": [
    {
      "recordId": "recau94ZM9",
      "fieldName": "照片",
      "fileName": "11.png",
      "fileToken": "LKT6bhdQZoGzxRx1dCAcz4uKnLY",
      "status": "downloaded",
      "base64Data": "iVBORw0KGgoAAAANSUhEUgAA...",
      "downloadTime": "2024-01-01T10:00:00Z"
    }
  ],
  "summary": {
    "total": 3,
    "success": 2,
    "failed": 1
  }
}
```