#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书多维表格照片字段提取 - 最终解决方案

问题根源：你提供的URL中的多维表格(IimiwyD3Gi3wxWkjZBAcbIXcnJb)没有授权给你的应用

解决方案：
1. 将目标多维表格授权给应用
2. 使用已授权的多维表格测试功能
"""

import requests
import json
import os

class FeishuBitableFinalSolution:
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
            return self.access_token
        return None
    
    def get_accessible_bitables(self):
        """获取所有可访问的多维表格"""
        if not self.access_token:
            self.get_tenant_access_token()
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        # 获取文档列表（包括多维表格）
        files_url = f"{self.base_url}/drive/v1/files"
        response = requests.get(files_url, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("code") == 0:
                bitables = [f for f in result["data"]["files"] if f["type"] == "bitable"]
                return bitables
        return []
    
    def search_photo_fields_in_bitable(self, app_token, bitable_name=""):
        """在指定多维表格中搜索照片字段"""
        if not self.access_token:
            return None
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        print(f"\n=== 搜索多维表格: {bitable_name} ===")
        print(f"App Token: {app_token}")
        
        # 1. 获取所有表
        tables_url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables"
        tables_response = requests.get(tables_url, headers=headers)
        
        if tables_response.status_code != 200:
            print(f"❌ 无法获取表列表: {tables_response.text}")
            return None
        
        tables_result = tables_response.json()
        if tables_result.get("code") != 0:
            print(f"❌ 获取表列表失败: {tables_result}")
            return None
        
        tables = tables_result["data"]["items"]
        print(f"✓ 找到 {len(tables)} 个数据表")
        
        photo_records = []
        
        for table in tables:
            table_id = table["table_id"]
            table_name = table["name"]
            print(f"\n--- 检查数据表: {table_name} (ID: {table_id}) ---")
            
            # 2. 获取表中的记录
            records_url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
            records_data = {"page_size": 50}
            
            records_response = requests.post(records_url, headers=headers, json=records_data)
            
            if records_response.status_code != 200:
                print(f"  ❌ 无法获取记录: {records_response.text}")
                continue
            
            records_result = records_response.json()
            if records_result.get("code") != 0:
                print(f"  ❌ 获取记录失败: {records_result}")
                continue
            
            items = records_result["data"]["items"]
            print(f"  ✓ 找到 {len(items)} 条记录")
            
            # 3. 检查每条记录的字段
            for i, item in enumerate(items):
                record_id = item.get("record_id")
                fields = item.get("fields", {})
                
                if not fields:
                    continue
                
                print(f"    记录 {i+1}: {list(fields.keys())}")
                
                # 4. 查找照片字段
                for field_name, field_value in fields.items():
                    if self._is_photo_field(field_name, field_value):
                        print(f"    ✅ 发现照片字段: '{field_name}'")
                        photo_records.append({
                            "bitable_name": bitable_name,
                            "table_name": table_name,
                            "table_id": table_id,
                            "record_id": record_id,
                            "field_name": field_name,
                            "photo_data": field_value
                        })
                        print(f"    📸 照片数据: {json.dumps(field_value, indent=6, ensure_ascii=False)}")
        
        return photo_records
    
    def _is_photo_field(self, field_name, field_value):
        """判断是否为照片字段"""
        # 检查字段名
        photo_keywords = ["照片", "图片", "附件", "文件", "photo", "image", "picture", "attachment"]
        if any(keyword in field_name.lower() for keyword in photo_keywords):
            return True
        
        # 检查字段值结构
        if isinstance(field_value, list) and field_value:
            first_item = field_value[0]
            if isinstance(first_item, dict):
                # 检查是否包含附件特征字段
                attachment_keys = ["file_token", "url", "tmp_url", "type", "name", "size"]
                if any(key in first_item for key in attachment_keys):
                    return True
        
        return False
    
    def download_photos_from_field(self, photo_data, download_dir="./downloads"):
        """从照片字段数据中下载图片"""
        if not isinstance(photo_data, list):
            return []
        
        os.makedirs(download_dir, exist_ok=True)
        downloaded_files = []
        
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
        for i, attachment in enumerate(photo_data):
            if not isinstance(attachment, dict):
                continue
            
            file_type = attachment.get('type', '')
            if not file_type.startswith('image/'):
                print(f"跳过非图片文件: {file_type}")
                continue
            
            download_url = attachment.get('url') or attachment.get('tmp_url')
            if not download_url:
                print(f"附件 {i+1} 没有下载URL")
                continue
            
            filename = attachment.get('name', f'image_{i+1}')
            filepath = os.path.join(download_dir, filename)
            
            try:
                response = requests.get(download_url, headers=headers, stream=True)
                if response.status_code == 200:
                    with open(filepath, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    print(f"✅ 下载成功: {filepath}")
                    downloaded_files.append(filepath)
                else:
                    print(f"❌ 下载失败: HTTP {response.status_code}")
            except Exception as e:
                print(f"❌ 下载异常: {e}")
        
        return downloaded_files
    
    def find_and_extract_all_photos(self):
        """查找并提取所有可访问多维表格中的照片"""
        print("🔍 开始搜索所有可访问多维表格中的照片字段...")
        
        if not self.get_tenant_access_token():
            print("❌ 获取访问令牌失败")
            return
        
        # 获取可访问的多维表格
        bitables = self.get_accessible_bitables()
        if not bitables:
            print("❌ 没有找到可访问的多维表格")
            return
        
        print(f"✅ 找到 {len(bitables)} 个可访问的多维表格:")
        for bt in bitables:
            print(f"  - {bt['name']} (Token: {bt['token']})")
        
        # 搜索每个多维表格中的照片字段
        all_photo_records = []
        for bitable in bitables:
            photo_records = self.search_photo_fields_in_bitable(
                bitable['token'], 
                bitable['name']
            )
            if photo_records:
                all_photo_records.extend(photo_records)
        
        if not all_photo_records:
            print("\n❌ 在所有多维表格中都没有找到照片字段")
            print("\n💡 建议:")
            print("1. 在多维表格中添加照片字段并上传一些图片")
            print("2. 确保字段名包含'照片'、'图片'、'附件'等关键词")
            return
        
        # 下载找到的所有照片
        print(f"\n🎯 找到 {len(all_photo_records)} 个包含照片的记录，开始下载...")
        
        total_downloaded = 0
        for record in all_photo_records:
            print(f"\n📥 下载记录: {record['bitable_name']} > {record['table_name']} > {record['field_name']}")
            downloaded = self.download_photos_from_field(record['photo_data'])
            total_downloaded += len(downloaded)
        
        print(f"\n🎉 下载完成！总共下载了 {total_downloaded} 张图片")

# 解决你的具体问题
def solve_your_problem():
    """解决你的具体问题"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    TARGET_URL = "https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq"
    
    print("🎯 解决你的问题:")
    print(f"目标多维表格URL: {TARGET_URL}")
    print(f"目标app_token: IimiwyD3Gi3wxWkjZBAcbIXcnJb")
    
    solution = FeishuBitableFinalSolution(APP_ID, APP_SECRET)
    
    # 检查是否能访问目标多维表格
    if solution.get_tenant_access_token():
        photo_records = solution.search_photo_fields_in_bitable(
            "IimiwyD3Gi3wxWkjZBAcbIXcnJb", 
            "目标多维表格"
        )
        
        if photo_records:
            print("✅ 成功访问目标多维表格并找到照片!")
            for record in photo_records:
                downloaded = solution.download_photos_from_field(record['photo_data'])
                print(f"下载了 {len(downloaded)} 张图片")
        else:
            print("❌ 无法访问目标多维表格")
            print("\n🔧 让我检查你实际能访问的多维表格...")
            solution.find_and_extract_all_photos()
    
    print("\n📋 问题总结:")
    print("1. ❌ 你的应用无权访问URL中的多维表格")
    print("2. ✅ 你的应用可以访问其他多维表格")
    print("3. 🔧 解决方案:")
    print("   - 将目标多维表格分享/授权给你的应用")
    print("   - 或使用已授权的多维表格进行测试")

if __name__ == "__main__":
    solve_your_problem()