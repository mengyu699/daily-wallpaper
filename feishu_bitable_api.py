#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re

class FeishuBitableAPI:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token = None
        self.base_url = "https://open.feishu.cn/open-apis"
    
    def get_tenant_access_token(self):
        """获取tenant_access_token"""
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        data = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get("code") == 0:
            self.access_token = result["tenant_access_token"]
            print(f"成功获取访问令牌")
            return self.access_token
        else:
            print(f"获取访问令牌失败: {result}")
            return None
    
    def parse_bitable_url(self, url):
        """解析多维表格URL获取app_token和table_id"""
        print(f"原始URL: {url}")
        
        # 提取table参数作为table_id
        table_match = re.search(r'table=([^&]+)', url)
        table_id = table_match.group(1) if table_match else None
        
        # 对于wiki中的多维表格，wiki后的ID就是app_token
        # URL格式: https://xxx.feishu.cn/wiki/{app_token}?table={table_id}&view={view_id}
        wiki_match = re.search(r'/wiki/([^?]+)', url)
        app_token = wiki_match.group(1) if wiki_match else None
        
        print(f"解析结果 - App Token: {app_token}, Table ID: {table_id}")
        return app_token, table_id
    
    def list_tables(self, app_token):
        """列出多维表格中的所有数据表"""
        if not self.access_token:
            print("请先获取访问令牌")
            return None
        
        url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        response = requests.get(url, headers=headers)
        result = response.json()
        
        if result.get("code") == 0:
            print(f"找到 {len(result['data']['items'])} 个数据表:")
            for table in result['data']['items']:
                print(f"  - 表名: {table['name']}, 表ID: {table['table_id']}")
            return result["data"]
        else:
            print(f"获取表列表失败: {result}")
            return None
    
    def search_records(self, app_token, table_id, field_names=None, page_size=20):
        """查询多维表格记录"""
        if not self.access_token:
            print("请先获取访问令牌")
            return None
        
        url = f"{self.base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        data = {
            "page_size": page_size
        }
        
        if field_names:
            data["field_names"] = field_names
        
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get("code") == 0:
            return result["data"]
        else:
            print(f"查询记录失败: {result}")
            return None
    
    def get_photo_field_data(self, bitable_url, photo_field_name="照片"):
        """获取多维表格中照片字段的数据"""
        # 1. 获取访问令牌
        if not self.get_tenant_access_token():
            return None
        
        # 2. 解析URL获取app_token和table_id
        app_token, table_id = self.parse_bitable_url(bitable_url)
        if not app_token:
            print("无法解析多维表格URL中的app_token")
            return None
        
        # 3. 先列出所有表，验证app_token是否正确，并找到正确的table_id
        tables_data = self.list_tables(app_token)
        if not tables_data:
            print("无法获取数据表列表，可能app_token不正确")
            return None
        
        # 如果从URL解析的table_id不存在，使用第一个表
        valid_table_ids = [table['table_id'] for table in tables_data['items']]
        if table_id not in valid_table_ids:
            print(f"URL中的table_id ({table_id}) 不存在，使用第一个表")
            table_id = valid_table_ids[0]
        
        print(f"使用 App Token: {app_token}")
        print(f"使用 Table ID: {table_id}")
        
        # 4. 查询记录，只获取照片字段
        records_data = self.search_records(app_token, table_id, field_names=[photo_field_name])
        
        if not records_data:
            return None
        
        # 5. 提取照片字段数据
        photo_records = []
        for item in records_data.get("items", []):
            record_id = item.get("record_id")
            fields = item.get("fields", {})
            photo_data = fields.get(photo_field_name)
            
            if photo_data:
                photo_records.append({
                    "record_id": record_id,
                    "photo_field": photo_data
                })
        
        return photo_records

# 使用示例
if __name__ == "__main__":
    # 配置参数
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    BITABLE_URL = "https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq"
    
    # 创建API实例
    api = FeishuBitableAPI(APP_ID, APP_SECRET)
    
    # 先获取访问令牌
    if not api.get_tenant_access_token():
        print("无法获取访问令牌")
        exit(1)
    
    # 手动尝试不同的app_token值
    possible_tokens = [
        "IimiwyD3Gi3wxWkjZBAcbIXcnJb",  # 从wiki路径提取的
        "wsbj757q14",  # 从域名提取的
        "cli_a4b128a68fb9d00e",  # app_id
    ]
    
    print("尝试不同的app_token值:")
    for token in possible_tokens:
        print(f"\n尝试app_token: {token}")
        tables = api.list_tables(token)
        if tables:
            print(f"成功! 使用app_token: {token}")
            
            # 使用找到的正确token获取照片数据
            table_id = "tblEeAYFnTlvIYZQ"  # 从URL解析的
            records_data = api.search_records(token, table_id, field_names=["照片"])
            
            if records_data:
                print(f"\n找到 {len(records_data.get('items', []))} 条记录:")
                for i, item in enumerate(records_data.get("items", []), 1):
                    record_id = item.get("record_id")
                    fields = item.get("fields", {})
                    photo_data = fields.get("照片")
                    
                    print(f"\n记录 {i} (ID: {record_id}):")
                    if photo_data:
                        print("照片数据:")
                        print(json.dumps(photo_data, indent=2, ensure_ascii=False))
                    else:
                        print("此记录无照片数据")
            else:
                print("无法获取记录数据")
            break
        else:
            print(f"app_token {token} 不正确")
    
    print("\n如果所有token都失败，请检查:")
    print("1. 多维表格是否公开或已授权给此应用")
    print("2. App ID和App Secret是否正确")
    print("3. 应用是否有访问该多维表格的权限")