#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书多维表格照片字段提取完整解决方案

根据你提供的多维表格链接和应用配置，这个脚本演示了如何：
1. 获取飞书访问令牌
2. 查询多维表格记录
3. 提取照片字段中的附件数据
4. 下载图片到本地

注意：由于多维表格权限配置问题，需要确保：
- 多维表格已经授权给你的应用
- 应用有相应的API权限
- 正确的app_token和table_id
"""

import requests
import json
import os
from urllib.parse import urlparse, unquote
import mimetypes

class FeishuBitableImageSolution:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = None
        self.base_url = "https://open.feishu.cn/open-apis"
    
    def get_tenant_access_token(self):
        """获取tenant_access_token"""
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        data = {"app_id": self.app_id, "app_secret": self.app_secret}
        
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get("code") == 0:
            self.access_token = result["tenant_access_token"]
            return self.access_token
        else:
            print(f"获取访问令牌失败: {result}")
            return None
    
    def extract_images_from_photo_field(self, attachment_data, download_dir="./downloads"):
        """从照片字段的附件数据中提取并下载图片"""
        if not self.access_token:
            print("请先获取访问令牌")
            return []
        
        if not attachment_data:
            print("没有附件数据")
            return []
        
        # 确保下载目录存在
        os.makedirs(download_dir, exist_ok=True)
        downloaded_files = []
        
        for i, attachment in enumerate(attachment_data):
            print(f"\n=== 处理附件 {i+1}/{len(attachment_data)} ===")
            print(f"文件令牌: {attachment.get('file_token')}")
            print(f"文件名: {attachment.get('name')}")
            print(f"文件类型: {attachment.get('type')}")
            print(f"文件大小: {attachment.get('size')} 字节")
            
            # 检查是否为图片
            file_type = attachment.get('type', '')
            if not file_type.startswith('image/'):
                print(f"跳过非图片文件: {file_type}")
                continue
            
            # 选择下载URL
            # 优先使用直接下载URL，如果没有则使用临时URL
            download_url = attachment.get('url') or attachment.get('tmp_url')
            if not download_url:
                print("没有找到可用的下载URL")
                continue
            
            print(f"下载URL: {download_url}")
            
            # 下载图片
            success = self._download_image(download_url, attachment, download_dir, i+1)
            if success:
                downloaded_files.append(success)
        
        return downloaded_files
    
    def _download_image(self, url, attachment, download_dir, index):
        """下载单个图片文件"""
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/*,*/*;q=0.8'
            }
            
            print("正在下载...")
            response = requests.get(url, headers=headers, stream=True, timeout=30)
            
            print(f"HTTP状态码: {response.status_code}")
            if response.status_code != 200:
                print(f"下载失败: {response.text[:200]}")
                return None
            
            # 生成文件名
            filename = attachment.get('name', f"image_{index}")
            if '.' not in filename:
                # 根据MIME类型添加扩展名
                file_type = attachment.get('type', '')
                ext = mimetypes.guess_extension(file_type)
                if ext:
                    filename += ext
                else:
                    filename += '.jpg'  # 默认扩展名
            
            filepath = os.path.join(download_dir, filename)
            
            # 写入文件
            with open(filepath, 'wb') as f:
                downloaded_size = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded_size += len(chunk)
            
            print(f"✓ 下载成功: {filepath}")
            print(f"  实际下载大小: {downloaded_size} 字节")
            return filepath
            
        except Exception as e:
            print(f"✗ 下载异常: {e}")
            return None
    
    def process_bitable_photo_field(self, photo_field_data, download_dir="./downloads"):
        """处理多维表格照片字段数据的完整流程"""
        print("=== 飞书多维表格照片字段提取工具 ===\n")
        
        # 1. 获取访问令牌
        print("1. 获取访问令牌...")
        if not self.get_tenant_access_token():
            return []
        print("✓ 访问令牌获取成功\n")
        
        # 2. 解析照片字段数据
        print("2. 解析照片字段数据...")
        if isinstance(photo_field_data, str):
            try:
                photo_field_data = json.loads(photo_field_data)
            except json.JSONDecodeError:
                print("✗ 照片字段数据JSON解析失败")
                return []
        
        if not photo_field_data:
            print("✗ 照片字段数据为空")
            return []
        
        print(f"✓ 找到 {len(photo_field_data)} 个附件\n")
        
        # 3. 下载图片
        print("3. 开始下载图片...")
        downloaded_files = self.extract_images_from_photo_field(photo_field_data, download_dir)
        
        print(f"\n=== 下载完成 ===")
        print(f"成功下载 {len(downloaded_files)} 个图片文件:")
        for file in downloaded_files:
            print(f"  - {file}")
        
        return downloaded_files

def demo_usage():
    """演示如何使用这个解决方案"""
    
    # 你提供的应用配置
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    # 示例：你从多维表格查询API获取的照片字段数据
    sample_photo_field = [{
        "file_token": "Vl3FbVkvnowlgpxpqsAbBrtFcrd",
        "name": "飞书.jpeg", 
        "size": 32975,
        "tmp_url": "https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=Vl3FbVk11owlgpxpqsAbBrtFcrd&extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblBJyX6jZteblYv%22%2C%22rev%22%3A90%7D%7D",
        "type": "image/jpeg",
        "url": "https://open.feishu.cn/open-apis/drive/v1/medias/Vl3FbVk11owlgpxpqsAbBrtFcrd/download?extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblBJyX6jZteblYv%22%2C%22rev%22%3A90%7D%7D"
    }]
    
    # 创建解决方案实例
    solution = FeishuBitableImageSolution(APP_ID, APP_SECRET)
    
    # 处理照片字段数据并下载图片
    downloaded = solution.process_bitable_photo_field(sample_photo_field)
    
    if downloaded:
        print("\n使用成功! 你可以按以下方式使用这个解决方案:")
        print("1. 从多维表格API获取记录数据")
        print("2. 提取记录中的[照片]字段") 
        print("3. 调用 process_bitable_photo_field() 方法下载图片")
    else:
        print("\n可能的问题:")
        print("- 多维表格没有授权给你的应用")
        print("- 应用缺少相应的API权限")
        print("- 附件URL已过期或无权限访问")

if __name__ == "__main__":
    demo_usage()