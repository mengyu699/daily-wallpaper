#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import os
from urllib.parse import urlparse, unquote
import mimetypes

class FeishuImageExtractor:
    def __init__(self, access_token):
        self.access_token = access_token
    
    def download_image_from_attachment(self, attachment_data, download_dir="./downloads"):
        """从飞书附件数据中下载图片"""
        if not attachment_data or len(attachment_data) == 0:
            print("没有附件数据")
            return None
        
        # 确保下载目录存在
        os.makedirs(download_dir, exist_ok=True)
        
        downloaded_files = []
        
        for i, attachment in enumerate(attachment_data):
            print(f"\n处理附件 {i+1}/{len(attachment_data)}")
            print(f"文件名: {attachment.get('name', 'unknown')}")
            print(f"文件类型: {attachment.get('type', 'unknown')}")
            print(f"文件大小: {attachment.get('size', 0)} 字节")
            
            # 检查是否为图片
            file_type = attachment.get('type', '')
            if not file_type.startswith('image/'):
                print(f"跳过非图片文件: {file_type}")
                continue
            
            # 获取下载URL
            download_url = attachment.get('url')
            if not download_url:
                print("没有找到下载URL")
                continue
            
            print(f"下载URL: {download_url}")
            
            # 下载文件
            try:
                headers = {
                    'Authorization': f'Bearer {self.access_token}',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
                
                response = requests.get(download_url, headers=headers, stream=True)
                print(f"HTTP状态码: {response.status_code}")
                
                if response.status_code == 200:
                    # 生成文件名
                    filename = attachment.get('name', f"image_{i+1}")
                    # 如果文件名没有扩展名，根据MIME类型添加
                    if '.' not in filename:
                        ext = mimetypes.guess_extension(file_type)
                        if ext:
                            filename += ext
                    
                    filepath = os.path.join(download_dir, filename)
                    
                    # 写入文件
                    with open(filepath, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    print(f"✓ 下载成功: {filepath}")
                    downloaded_files.append(filepath)
                    
                else:
                    print(f"✗ 下载失败: HTTP {response.status_code}")
                    print(f"响应内容: {response.text[:200]}...")
                    
            except Exception as e:
                print(f"✗ 下载异常: {e}")
        
        return downloaded_files
    
    def parse_attachment_data(self, attachment_json_str):
        """解析附件JSON字符串"""
        try:
            if isinstance(attachment_json_str, str):
                return json.loads(attachment_json_str)
            else:
                return attachment_json_str
        except json.JSONDecodeError as e:
            print(f"JSON解析失败: {e}")
            return None

def main():
    """主函数 - 演示如何使用"""
    
    # 示例附件数据（基于你提供的格式）
    sample_attachment = [{
        "file_token": "Vl3FbVkvnowlgpxpqsAbBrtFcrd",
        "name": "飞书.jpeg",
        "size": 32975,
        "tmp_url": "https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=Vl3FbVk11owlgpxpqsAbBrtFcrd&extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblBJyX6jZteblYv%22%2C%22rev%22%3A90%7D%7D",
        "type": "image/jpeg",
        "url": "https://open.feishu.cn/open-apis/drive/v1/medias/Vl3FbVk11owlgpxpqsAbBrtFcrd/download?extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblBJyX6jZteblYv%22%2C%22rev%22%3A90%7D%7D"
    }]
    
    print("=== 飞书图片提取工具 ===")
    print("\n使用说明:")
    print("1. 从飞书多维表格API获取包含附件字段的记录数据")
    print("2. 提取附件字段中的图片数据")
    print("3. 使用access_token下载图片到本地")
    
    print("\n示例附件数据结构:")
    print(json.dumps(sample_attachment, indent=2, ensure_ascii=False))
    
    # 如果你有实际的access_token，可以这样使用：
    # access_token = "YOUR_ACCESS_TOKEN_HERE"
    # extractor = FeishuImageExtractor(access_token)
    # downloaded = extractor.download_image_from_attachment(sample_attachment)
    # print(f"下载的文件: {downloaded}")
    
    print("\n实际使用步骤:")
    print("1. 获取飞书访问令牌 (tenant_access_token)")
    print("2. 调用多维表格查询API获取记录")
    print("3. 从记录的照片字段中提取附件数据") 
    print("4. 使用本工具下载图片")
    
    print("\n代码示例:")
    code_example = '''
# 1. 获取访问令牌
access_token = "your_tenant_access_token"

# 2. 创建图片提取器
extractor = FeishuImageExtractor(access_token)

# 3. 假设从API获取的附件数据
attachment_data = [
    {
        "file_token": "Vl3FbVkvnowlgpxpqsAbBrtFcrd",
        "name": "飞书.jpeg",
        "size": 32975,
        "type": "image/jpeg",
        "url": "https://open.feishu.cn/open-apis/drive/v1/medias/..."
    }
]

# 4. 下载图片
downloaded_files = extractor.download_image_from_attachment(attachment_data)
print(f"下载的文件: {downloaded_files}")
'''
    print(code_example)

if __name__ == "__main__":
    main()