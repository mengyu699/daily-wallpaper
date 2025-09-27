#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re

class FeishuWikiBitableAPI:
    """处理知识库中嵌入的多维表格"""
    
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
            print(f"✓ 成功获取访问令牌")
            return self.access_token
        else:
            print(f"✗ 获取访问令牌失败: {result}")
            return None
    
    def parse_wiki_bitable_url(self, url):
        """解析知识库中多维表格的URL"""
        print(f"解析URL: {url}")
        
        # 从URL中提取各个参数
        # https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq
        
        # 提取wiki文档ID (可能就是app_token)
        wiki_match = re.search(r'/wiki/([^?]+)', url)
        wiki_doc_id = wiki_match.group(1) if wiki_match else None
        
        # 提取table_id
        table_match = re.search(r'table=([^&]+)', url)
        table_id = table_match.group(1) if table_match else None
        
        # 提取view_id (可选)
        view_match = re.search(r'view=([^&]+)', url)
        view_id = view_match.group(1) if view_match else None
        
        print(f"Wiki文档ID: {wiki_doc_id}")
        print(f"表格ID: {table_id}")
        print(f"视图ID: {view_id}")
        
        return wiki_doc_id, table_id, view_id
    
    def search_records_direct(self, app_token, table_id, field_names=None, page_size=20):
        """直接查询多维表格记录 - 尝试不同的API端点"""
        if not self.access_token:
            print("请先获取访问令牌")
            return None
        
        # 方法1: 标准多维表格API
        url1 = f"{self.base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
        
        # 方法2: 可能的wiki文档API (如果app_token实际是文档ID)
        url2 = f"{self.base_url}/docx/v1/documents/{app_token}/blocks"
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        data = {
            "page_size": page_size
        }
        
        if field_names:
            data["field_names"] = field_names
        
        print(f"尝试API端点1: {url1}")
        response1 = requests.post(url1, headers=headers, json=data)
        print(f"响应状态: {response1.status_code}")
        
        if response1.status_code == 200:
            result1 = response1.json()
            print(f"API端点1结果: {result1}")
            if result1.get("code") == 0:
                return result1["data"]
        else:
            print(f"API端点1失败: {response1.text}")
        
        # 如果第一个失败，可能需要先获取文档信息
        print(f"\n尝试获取文档信息...")
        doc_url = f"{self.base_url}/docx/v1/documents/{app_token}"
        doc_response = requests.get(doc_url, headers=headers)
        print(f"文档API状态: {doc_response.status_code}")
        print(f"文档API响应: {doc_response.text}")
        
        return None
    
    def debug_all_apis(self, wiki_doc_id, table_id):
        """调试所有可能的API端点"""
        if not self.access_token:
            print("请先获取访问令牌")
            return
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json; charset=utf-8"
        }
        
        # 尝试的API端点列表
        api_endpoints = [
            # 标准多维表格API
            f"{self.base_url}/bitable/v1/apps/{wiki_doc_id}/tables/{table_id}/records/search",
            f"{self.base_url}/bitable/v1/apps/{wiki_doc_id}/tables",
            
            # 如果是文档中的表格
            f"{self.base_url}/docx/v1/documents/{wiki_doc_id}",
            f"{self.base_url}/docx/v1/documents/{wiki_doc_id}/blocks",
            
            # 可能的其他格式
            f"{self.base_url}/sheets/v3/spreadsheets/{wiki_doc_id}",
        ]
        
        for i, endpoint in enumerate(api_endpoints, 1):
            print(f"\n=== 测试API端点 {i} ===")
            print(f"URL: {endpoint}")
            
            try:
                if "search" in endpoint:
                    # POST请求
                    response = requests.post(endpoint, headers=headers, json={"page_size": 10})
                else:
                    # GET请求
                    response = requests.get(endpoint, headers=headers)
                
                print(f"状态码: {response.status_code}")
                print(f"响应: {response.text[:300]}...")
                
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if result.get("code") == 0:
                            print("✓ 成功! 这个API端点可用")
                            return endpoint, result
                    except:
                        pass
                        
            except Exception as e:
                print(f"请求异常: {e}")
        
        print("\n❌ 所有API端点都失败了")
        return None, None
    
    def get_photo_field_data(self, bitable_url, photo_field_name="照片"):
        """获取知识库多维表格中照片字段的数据"""
        # 1. 获取访问令牌
        if not self.get_tenant_access_token():
            return None
        
        # 2. 解析URL
        wiki_doc_id, table_id, view_id = self.parse_wiki_bitable_url(bitable_url)
        if not wiki_doc_id or not table_id:
            print("无法解析URL")
            return None
        
        # 3. 调试所有API端点
        print(f"\n开始调试API端点...")
        working_endpoint, result = self.debug_all_apis(wiki_doc_id, table_id)
        
        if working_endpoint and result:
            print(f"\n找到可用的API端点: {working_endpoint}")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # 如果是records数据，提取照片字段
            if "items" in result:
                photo_records = []
                for item in result["items"]:
                    record_id = item.get("record_id")
                    fields = item.get("fields", {})
                    photo_data = fields.get(photo_field_name)
                    
                    if photo_data:
                        photo_records.append({
                            "record_id": record_id,
                            "photo_field": photo_data
                        })
                
                return photo_records
        
        return None

# 使用示例
if __name__ == "__main__":
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    WIKI_BITABLE_URL = "https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq"
    
    api = FeishuWikiBitableAPI(APP_ID, APP_SECRET)
    photo_data = api.get_photo_field_data(WIKI_BITABLE_URL)
    
    if photo_data:
        print(f"\n✓ 找到 {len(photo_data)} 条包含照片的记录:")
        for i, record in enumerate(photo_data, 1):
            print(f"\n记录 {i} (ID: {record['record_id']}):")
            print(json.dumps(record['photo_field'], indent=2, ensure_ascii=False))
    else:
        print("\n❌ 未找到照片数据")