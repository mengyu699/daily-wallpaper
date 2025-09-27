#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书多维表格照片字段提取 - 完整可用解决方案

✅ 已验证可用！成功提取并下载了照片！

使用方法：
1. 对于Wiki中的多维表格，先通过Wiki API获取真正的多维表格token
2. 使用真正的token调用多维表格API
3. 查询记录并提取照片字段
4. 下载照片到本地
"""

import requests
import json
import os
import re
from urllib.parse import urlparse

class FeishuBitablePhotoExtractor:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = None
        self.base_url = "https://open.feishu.cn/open-apis"
    
    def get_tenant_access_token(self):
        """获取访问令牌"""
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        data = {"app_id": self.app_id, "app_secret": self.app_secret}
        
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get("code") == 0:
            self.access_token = result["tenant_access_token"]
            return True
        else:
            print(f"获取访问令牌失败: {result}")
            return False
    
    def get_real_bitable_token_from_wiki_url(self, wiki_url):
        """从Wiki URL获取真正的多维表格token"""
        # 提取Wiki节点ID
        wiki_match = re.search(r'/wiki/([^?]+)', wiki_url)
        if not wiki_match:
            return None, None, None
        
        wiki_node_id = wiki_match.group(1)
        
        # 提取table_id和view_id
        table_match = re.search(r'table=([^&]+)', wiki_url)
        view_match = re.search(r'view=([^&]+)', wiki_url)
        
        table_id = table_match.group(1) if table_match else None
        view_id = view_match.group(1) if view_match else None
        
        print(f"Wiki节点ID: {wiki_node_id}")
        print(f"表格ID: {table_id}")
        print(f"视图ID: {view_id}")
        
        if not self.access_token:
            if not self.get_tenant_access_token():
                return None, None, None
        
        # 通过Wiki API获取真正的多维表格token
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        wiki_api_url = f"{self.base_url}/wiki/v2/spaces/get_node?token={wiki_node_id}"
        response = requests.get(wiki_api_url, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 0:
                node_data = result["data"]["node"]
                if node_data["obj_type"] == "bitable":
                    real_bitable_token = node_data["obj_token"]
                    print(f"✅ 获取到真正的多维表格token: {real_bitable_token}")
                    return real_bitable_token, table_id, view_id
        
        print(f"❌ 无法获取多维表格token")
        return None, None, None
    
    def extract_photos_from_bitable(self, wiki_url, download_dir="./downloads"):
        """从Wiki URL提取照片的完整流程"""
        print("=== 飞书多维表格照片提取器 ===")
        print(f"目标URL: {wiki_url}")
        
        # 1. 获取真正的多维表格token
        real_token, table_id, view_id = self.get_real_bitable_token_from_wiki_url(wiki_url)
        if not real_token:
            return []
        
        # 2. 查询多维表格数据
        return self.extract_photos_from_token(real_token, table_id, download_dir)
    
    def extract_photos_from_token(self, app_token, table_id=None, download_dir="./downloads"):
        """从多维表格token提取照片"""
        if not self.access_token:
            if not self.get_tenant_access_token():
                return []
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        # 创建下载目录
        os.makedirs(download_dir, exist_ok=True)
        all_photos = []
        
        print(f"\n📋 获取表列表...")
        tables_url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables"
        tables_response = requests.get(tables_url, headers=headers)
        
        if tables_response.status_code != 200:
            print(f"❌ 获取表列表失败: {tables_response.text}")
            return []
        
        tables_result = tables_response.json()
        if tables_result.get("code") != 0:
            print(f"❌ 表列表API失败: {tables_result}")
            return []
        
        tables = tables_result["data"]["items"]
        print(f"✅ 找到 {len(tables)} 个数据表")
        
        # 如果指定了table_id，只处理该表
        if table_id:
            tables = [t for t in tables if t['table_id'] == table_id]
            if not tables:
                print(f"❌ 未找到目标表: {table_id}")
                return []
        
        for table in tables:
            table_id = table['table_id']
            table_name = table['name']
            
            print(f"\n🔍 处理数据表: {table_name} (ID: {table_id})")
            
            # 查询记录
            records_url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
            records_data = {"page_size": 100}
            
            records_response = requests.post(records_url, headers=headers, json=records_data)
            
            if records_response.status_code != 200:
                print(f"  ❌ 获取记录失败: {records_response.text}")
                continue
            
            records_result = records_response.json()
            if records_result.get("code") != 0:
                print(f"  ❌ 记录API失败: {records_result}")
                continue
            
            items = records_result["data"]["items"]
            print(f"  ✅ 找到 {len(items)} 条记录")
            
            # 检查每条记录的照片字段
            for i, item in enumerate(items):
                record_id = item.get("record_id")
                fields = item.get("fields", {})
                
                for field_name, field_value in fields.items():
                    if self._is_photo_field(field_name, field_value):
                        print(f"  📸 记录 {i+1} - 发现照片字段: '{field_name}'")
                        
                        photos = self._download_photos_from_field(
                            field_value, 
                            f"{download_dir}/{table_name}_{field_name}", 
                            headers
                        )
                        
                        if photos:
                            all_photos.extend(photos)
                            print(f"    ✅ 下载了 {len(photos)} 张照片")
        
        return all_photos
    
    def _is_photo_field(self, field_name, field_value):
        """判断是否为照片字段"""
        # 检查字段名
        photo_keywords = ["照片", "图片", "附件", "文件", "photo", "image", "picture"]
        if any(keyword in field_name.lower() for keyword in photo_keywords):
            if isinstance(field_value, list) and field_value:
                return True
        
        # 检查字段值结构
        if isinstance(field_value, list) and field_value:
            first_item = field_value[0]
            if isinstance(first_item, dict):
                # 检查是否包含图片附件
                if first_item.get('type', '').startswith('image/'):
                    return True
        
        return False
    
    def _download_photos_from_field(self, photo_data, dir_path, headers):
        """从照片字段下载图片"""
        os.makedirs(dir_path, exist_ok=True)
        downloaded_files = []
        
        download_headers = dict(headers)
        download_headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        
        for i, attachment in enumerate(photo_data):
            if not isinstance(attachment, dict):
                continue
            
            file_type = attachment.get('type', '')
            if not file_type.startswith('image/'):
                continue
            
            download_url = attachment.get('url') or attachment.get('tmp_url')
            if not download_url:
                continue
            
            # 生成安全的文件名
            original_name = attachment.get('name', f'image_{i+1}')
            safe_name = self._make_safe_filename(original_name)
            filepath = os.path.join(dir_path, safe_name)
            
            try:
                response = requests.get(download_url, headers=download_headers, stream=True)
                if response.status_code == 200:
                    with open(filepath, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    downloaded_files.append(filepath)
                    print(f"      ✅ {safe_name}")
                else:
                    print(f"      ❌ {safe_name} - HTTP {response.status_code}")
            except Exception as e:
                print(f"      ❌ {safe_name} - {e}")
        
        return downloaded_files
    
    def _make_safe_filename(self, filename):
        """生成安全的文件名"""
        # 移除或替换不安全字符
        unsafe_chars = '<>:"/\\|?*%'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')
        
        # 限制长度
        if len(filename) > 100:
            name, ext = os.path.splitext(filename)
            filename = name[:90] + ext
        
        return filename

# 使用示例和测试
def main():
    """主函数 - 演示完整使用流程"""
    
    # 你的应用配置
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    # 你的目标多维表格URL
    WIKI_URL = "https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq"
    
    # 创建提取器
    extractor = FeishuBitablePhotoExtractor(APP_ID, APP_SECRET)
    
    # 提取照片
    downloaded_photos = extractor.extract_photos_from_bitable(WIKI_URL)
    
    print(f"\n🎉 提取完成!")
    print(f"总共下载了 {len(downloaded_photos)} 张照片")
    for photo in downloaded_photos:
        print(f"  - {photo}")
    
    # 也可以直接使用已知的token
    print(f"\n--- 或者直接使用已知token ---")
    REAL_TOKEN = "RlMubEOWxaiykXsKJIRcbRAfni2"
    TARGET_TABLE = "tblEeAYFnTlvIYZQ"
    
    more_photos = extractor.extract_photos_from_token(REAL_TOKEN, TARGET_TABLE)
    print(f"直接调用下载了 {len(more_photos)} 张照片")

if __name__ == "__main__":
    main()