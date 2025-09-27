#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的HTTP服务器实现飞书照片提取功能

运行方法: python3 simple_http_server.py
访问地址: http://localhost:8000
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import os

class PhotoExtractorHandler(BaseHTTPRequestHandler):
    
    def do_GET(self):
        """处理GET请求"""
        if self.path == '/':
            self.serve_html_page()
        elif self.path.startswith('/extract'):
            self.extract_photos()
        elif self.path.startswith('/download'):
            self.download_photo()
        else:
            self.send_error(404)
    
    def do_POST(self):
        """处理POST请求"""
        if self.path == '/api/extract':
            self.extract_photos_api()
        else:
            self.send_error(404)
    
    def serve_html_page(self):
        """提供网页界面"""
        html = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>飞书照片提取器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .photo-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .btn { background: #0066cc; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #0052a3; }
        .loading { color: #666; font-style: italic; }
        .error { color: red; }
        .success { color: green; }
        img { max-width: 200px; height: auto; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ 飞书多维表格照片提取器</h1>
        <p>点击下面的按钮提取你的多维表格中的所有照片</p>
        
        <button class="btn" onclick="extractPhotos()">🔍 提取照片</button>
        
        <div id="status"></div>
        <div id="results"></div>
    </div>

    <script>
        async function extractPhotos() {
            const statusDiv = document.getElementById('status');
            const resultsDiv = document.getElementById('results');
            
            statusDiv.innerHTML = '<div class="loading">⏳ 正在提取照片...</div>';
            resultsDiv.innerHTML = '';
            
            try {
                const response = await fetch('/extract');
                const data = await response.json();
                
                if (data.success) {
                    statusDiv.innerHTML = '<div class="success">✅ 提取成功!</div>';
                    displayPhotos(data.photos);
                } else {
                    statusDiv.innerHTML = '<div class="error">❌ 提取失败: ' + data.error + '</div>';
                }
            } catch (error) {
                statusDiv.innerHTML = '<div class="error">❌ 请求失败: ' + error.message + '</div>';
            }
        }
        
        function displayPhotos(photos) {
            const resultsDiv = document.getElementById('results');
            let html = '<h2>📸 找到 ' + photos.length + ' 张照片:</h2>';
            
            photos.forEach((photo, index) => {
                html += `
                    <div class="photo-item">
                        <h3>📎 ${photo.name}</h3>
                        <p><strong>大小:</strong> ${(photo.size / 1024 / 1024).toFixed(2)} MB</p>
                        <p><strong>类型:</strong> ${photo.type}</p>
                        <p><strong>字段:</strong> ${photo.field}</p>
                        <button class="btn" onclick="downloadPhoto('${photo.token}', '${photo.name}')">
                            💾 下载照片
                        </button>
                        <br><br>
                        <strong>🔗 直接链接:</strong><br>
                        <code style="word-break: break-all; background: #f5f5f5; padding: 5px;">${photo.url}</code>
                    </div>
                `;
            });
            
            resultsDiv.innerHTML = html;
        }
        
        async function downloadPhoto(token, filename) {
            try {
                const response = await fetch('/download?token=' + token + '&name=' + encodeURIComponent(filename));
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    alert('✅ 下载成功: ' + filename);
                } else {
                    alert('❌ 下载失败: ' + response.statusText);
                }
            } catch (error) {
                alert('❌ 下载错误: ' + error.message);
            }
        }
    </script>
</body>
</html>
        '''
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def extract_photos(self):
        """提取照片接口"""
        try:
            # 飞书应用配置
            APP_ID = "cli_a4b128a68fb9d00e"
            APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
            BITABLE_TOKEN = "RlMubEOWxaiykXsKJIRcbRAfni2"
            TABLE_ID = "tblEeAYFnTlvIYZQ"
            
            # 1. 获取访问令牌
            token_data = {
                'app_id': APP_ID,
                'app_secret': APP_SECRET
            }
            
            token_req = urllib.request.Request(
                'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
                data=json.dumps(token_data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(token_req) as response:
                token_result = json.loads(response.read().decode('utf-8'))
            
            if token_result.get('code') != 0:
                raise Exception(f"获取访问令牌失败: {token_result}")
            
            access_token = token_result['tenant_access_token']
            
            # 2. 查询多维表格记录
            records_data = {'page_size': 100}
            records_req = urllib.request.Request(
                f'https://open.feishu.cn/open-apis/bitable/v1/apps/{BITABLE_TOKEN}/tables/{TABLE_ID}/records/search',
                data=json.dumps(records_data).encode('utf-8'),
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
            )
            
            with urllib.request.urlopen(records_req) as response:
                records_result = json.loads(response.read().decode('utf-8'))
            
            if records_result.get('code') != 0:
                raise Exception(f"查询记录失败: {records_result}")
            
            # 3. 提取照片信息
            photos = []
            for item in records_result['data']['items']:
                record_id = item.get('record_id')
                fields = item.get('fields', {})
                
                for field_name, field_value in fields.items():
                    if isinstance(field_value, list):
                        for attachment in field_value:
                            if isinstance(attachment, dict) and attachment.get('type', '').startswith('image/'):
                                photos.append({
                                    'name': attachment['name'],
                                    'size': attachment['size'],
                                    'type': attachment['type'],
                                    'token': attachment['file_token'],
                                    'url': attachment['url'],
                                    'field': field_name,
                                    'record_id': record_id
                                })
            
            # 4. 返回结果
            result = {
                'success': True,
                'photos': photos,
                'total': len(photos)
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e)
            }
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(error_result, ensure_ascii=False).encode('utf-8'))
    
    def download_photo(self):
        """下载照片"""
        try:
            # 解析参数
            parsed_path = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed_path.query)
            
            token = params.get('token', [''])[0]
            filename = params.get('name', ['photo.png'])[0]
            
            if not token:
                raise Exception("缺少文件token")
            
            # 获取访问令牌
            APP_ID = "cli_a4b128a68fb9d00e"
            APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
            
            token_data = {
                'app_id': APP_ID,
                'app_secret': APP_SECRET
            }
            
            token_req = urllib.request.Request(
                'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
                data=json.dumps(token_data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(token_req) as response:
                token_result = json.loads(response.read().decode('utf-8'))
            
            access_token = token_result['tenant_access_token']
            
            # 下载文件
            download_url = f'https://open.feishu.cn/open-apis/drive/v1/medias/{token}/download'
            download_req = urllib.request.Request(
                download_url,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            )
            
            with urllib.request.urlopen(download_req) as response:
                file_data = response.read()
            
            # 返回文件
            self.send_response(200)
            self.send_header('Content-type', 'image/png')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(file_data)))
            self.end_headers()
            self.wfile.write(file_data)
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(f"下载失败: {str(e)}".encode('utf-8'))

def run_server(port=8000):
    """启动HTTP服务器"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, PhotoExtractorHandler)
    
    print(f"🚀 飞书照片提取服务器启动成功!")
    print(f"📍 访问地址: http://localhost:{port}")
    print(f"🔄 按 Ctrl+C 停止服务器")
    print(f"=" * 50)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n👋 服务器已停止")
        httpd.server_close()

if __name__ == '__main__':
    run_server()