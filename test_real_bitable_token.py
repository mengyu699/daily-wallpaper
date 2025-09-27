#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

def test_real_bitable_token():
    """使用从Wiki节点获取的真正多维表格token进行测试"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    # 从Wiki节点信息中获取的真正多维表格token
    REAL_BITABLE_TOKEN = "RlMubEOWxaiykXsKJIRcbRAfni2"
    TARGET_TABLE_ID = "tblEeAYFnTlvIYZQ"
    
    print("=== 使用真正的多维表格Token测试 ===")
    print(f"真正的Bitable Token: {REAL_BITABLE_TOKEN}")
    print(f"目标Table ID: {TARGET_TABLE_ID}")
    
    # 获取访问令牌
    token_url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(token_url, headers=headers, json=data)
    token_result = response.json()
    access_token = token_result["tenant_access_token"]
    
    auth_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    base_url = "https://open.feishu.cn/open-apis"
    
    # 1. 获取表列表
    print(f"\n1. 获取表列表...")
    tables_url = f"{base_url}/bitable/v1/apps/{REAL_BITABLE_TOKEN}/tables"
    tables_response = requests.get(tables_url, headers=auth_headers)
    
    print(f"状态码: {tables_response.status_code}")
    
    if tables_response.status_code == 200:
        tables_result = tables_response.json()
        if tables_result.get("code") == 0:
            tables = tables_result["data"]["items"]
            print(f"✅ 成功! 找到 {len(tables)} 个数据表:")
            
            target_table_found = False
            for table in tables:
                table_id = table['table_id']
                table_name = table['name']
                print(f"  - {table_name} (ID: {table_id})")
                
                if table_id == TARGET_TABLE_ID:
                    target_table_found = True
                    print(f"    🎯 这就是目标表!")
                    
                    # 2. 查询目标表的记录
                    print(f"\n2. 查询目标表记录...")
                    records_url = f"{base_url}/bitable/v1/apps/{REAL_BITABLE_TOKEN}/tables/{TARGET_TABLE_ID}/records/search"
                    records_data = {"page_size": 10}
                    
                    records_response = requests.post(records_url, headers=auth_headers, json=records_data)
                    print(f"记录查询状态: {records_response.status_code}")
                    
                    if records_response.status_code == 200:
                        records_result = records_response.json()
                        if records_result.get("code") == 0:
                            items = records_result["data"]["items"]
                            print(f"✅ 找到 {len(items)} 条记录")
                            
                            # 3. 检查照片字段
                            print(f"\n3. 检查照片字段...")
                            photo_found = False
                            
                            for i, item in enumerate(items):
                                record_id = item.get("record_id")
                                fields = item.get("fields", {})
                                
                                print(f"\n  记录 {i+1} (ID: {record_id}):")
                                print(f"    字段: {list(fields.keys())}")
                                
                                # 查找照片字段
                                for field_name, field_value in fields.items():
                                    if "照片" in field_name or "图片" in field_name:
                                        photo_found = True
                                        print(f"    🖼️ 找到照片字段: '{field_name}'")
                                        print(f"    📸 照片数据:")
                                        print(json.dumps(field_value, indent=6, ensure_ascii=False))
                                        
                                        # 如果有照片数据，尝试下载
                                        if field_value and isinstance(field_value, list):
                                            download_photos(field_value, access_token)
                                    
                                    elif isinstance(field_value, list) and field_value:
                                        # 检查是否可能是附件字段
                                        first_item = field_value[0]
                                        if isinstance(first_item, dict) and ("file_token" in first_item or "url" in first_item):
                                            print(f"    📎 发现可能的附件字段: '{field_name}'")
                                            print(json.dumps(field_value, indent=6, ensure_ascii=False))
                                            
                                            # 检查是否是图片附件
                                            for attachment in field_value:
                                                if attachment.get('type', '').startswith('image/'):
                                                    photo_found = True
                                                    print(f"    🖼️ 发现图片附件!")
                                                    download_photos(field_value, access_token)
                                                    break
                            
                            if not photo_found:
                                print(f"\n⚠️ 未找到照片字段")
                                print("建议检查:")
                                print("1. 确认多维表格中有照片字段")
                                print("2. 照片字段中有上传的图片")
                                print("3. 字段名是否包含'照片'关键词")
                                
                        else:
                            print(f"❌ 记录查询失败: {records_result}")
                    else:
                        print(f"❌ 记录查询HTTP错误: {records_response.text}")
            
            if not target_table_found:
                print(f"\n⚠️ 未找到目标表ID: {TARGET_TABLE_ID}")
                print("可用的表ID:")
                for table in tables:
                    print(f"  - {table['name']}: {table['table_id']}")
                    
                # 测试第一个有数据的表
                print(f"\n尝试查询第一个表的记录...")
                if tables:
                    first_table_id = tables[0]['table_id']
                    test_any_table(auth_headers, REAL_BITABLE_TOKEN, first_table_id, access_token)
                
        else:
            print(f"❌ 表列表查询失败: {tables_result}")
    else:
        print(f"❌ 表列表HTTP错误: {tables_response.text}")

def test_any_table(headers, app_token, table_id, access_token):
    """测试任意表是否有数据"""
    base_url = "https://open.feishu.cn/open-apis"
    
    records_url = f"{base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
    records_data = {"page_size": 5}
    
    records_response = requests.post(records_url, headers=headers, json=records_data)
    
    if records_response.status_code == 200:
        records_result = records_response.json()
        if records_result.get("code") == 0:
            items = records_result["data"]["items"]
            print(f"  表中有 {len(items)} 条记录")
            
            for i, item in enumerate(items):
                fields = item.get("fields", {})
                if fields:
                    print(f"    记录 {i+1} 字段: {list(fields.keys())}")
                    for field_name, field_value in fields.items():
                        if isinstance(field_value, list) and field_value:
                            first_item = field_value[0]
                            if isinstance(first_item, dict) and ("file_token" in first_item or "url" in first_item):
                                print(f"      📎 附件字段 '{field_name}': {len(field_value)} 个附件")

def download_photos(photo_data, access_token):
    """下载照片"""
    print(f"\n    📥 开始下载照片...")
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    import os
    os.makedirs("downloads", exist_ok=True)
    
    for i, attachment in enumerate(photo_data):
        if isinstance(attachment, dict):
            file_name = attachment.get('name', f'image_{i+1}')
            file_type = attachment.get('type', '')
            download_url = attachment.get('url') or attachment.get('tmp_url')
            
            print(f"      文件 {i+1}: {file_name} ({file_type})")
            
            if download_url and file_type.startswith('image/'):
                try:
                    response = requests.get(download_url, headers=headers, stream=True)
                    if response.status_code == 200:
                        filepath = f"downloads/{file_name}"
                        with open(filepath, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=8192):
                                f.write(chunk)
                        print(f"        ✅ 下载成功: {filepath}")
                    else:
                        print(f"        ❌ 下载失败: HTTP {response.status_code}")
                except Exception as e:
                    print(f"        ❌ 下载异常: {e}")

if __name__ == "__main__":
    test_real_bitable_token()