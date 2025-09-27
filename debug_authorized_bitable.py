#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re

def debug_authorized_bitable():
    """调试已授权的多维表格访问"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    TARGET_URL = "wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb?table=tblEeAYFnTlvIYZQ&view=vewLosn3qq"
    
    print("=== 调试已授权的多维表格 ===")
    print(f"目标URL: {TARGET_URL}")
    
    # 1. 获取访问令牌
    print("\n1. 获取访问令牌...")
    token_url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(token_url, headers=headers, json=data)
    token_result = response.json()
    
    if token_result.get("code") != 0:
        print(f"❌ 获取访问令牌失败: {token_result}")
        return
    
    access_token = token_result["tenant_access_token"]
    print("✅ 访问令牌获取成功")
    
    auth_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    # 2. 解析URL参数
    wiki_id = "IimiwyD3Gi3wxWkjZBAcbIXcnJb"
    table_id = "tblEeAYFnTlvIYZQ"
    view_id = "vewLosn3qq"
    
    print(f"\n2. URL解析结果:")
    print(f"   Wiki/App ID: {wiki_id}")
    print(f"   Table ID: {table_id}")
    print(f"   View ID: {view_id}")
    
    # 3. 尝试不同的API调用方式
    print(f"\n3. 尝试各种API调用方式...")
    
    # 方式1: 直接使用wiki_id作为app_token
    print(f"\n--- 方式1: 使用wiki_id作为app_token ---")
    test_bitable_api(auth_headers, wiki_id, table_id, "wiki_id作为app_token")
    
    # 方式2: 尝试获取所有可访问的多维表格，看是否包含目标ID
    print(f"\n--- 方式2: 检查所有可访问多维表格 ---")
    files_url = "https://open.feishu.cn/open-apis/drive/v1/files"
    files_response = requests.get(files_url, headers=auth_headers)
    
    if files_response.status_code == 200:
        files_result = files_response.json()
        if files_result.get("code") == 0:
            bitables = [f for f in files_result["data"]["files"] if f["type"] == "bitable"]
            print(f"找到 {len(bitables)} 个多维表格:")
            
            target_found = False
            for bt in bitables:
                print(f"  - 名称: {bt['name']}")
                print(f"    Token: {bt['token']}")
                print(f"    URL: {bt['url']}")
                
                # 检查是否匹配目标ID
                if wiki_id in bt['url'] or bt['token'] == wiki_id:
                    print(f"    🎯 这个就是目标多维表格!")
                    target_found = True
                    test_bitable_api(auth_headers, bt['token'], table_id, "匹配的多维表格")
                
                print()
            
            if not target_found:
                print("❌ 未找到匹配的目标多维表格")
                print("💡 尝试用找到的多维表格进行测试...")
                for bt in bitables:
                    test_first_table_with_records(auth_headers, bt['token'], bt['name'])
        else:
            print(f"获取文件列表失败: {files_result}")
    else:
        print(f"获取文件列表HTTP错误: {files_response.text}")
    
    # 方式3: 尝试用user_access_token而不是tenant_access_token
    print(f"\n--- 方式3: 检查是否需要用户令牌 ---")
    print("某些多维表格可能需要用户授权令牌而不是应用令牌")
    print("如果以上方式都失败，可能需要引导用户进行OAuth授权")

def test_bitable_api(headers, app_token, table_id, method_name):
    """测试多维表格API"""
    print(f"测试 {method_name}:")
    print(f"  App Token: {app_token}")
    print(f"  Table ID: {table_id}")
    
    base_url = "https://open.feishu.cn/open-apis"
    
    # 先尝试获取表列表
    tables_url = f"{base_url}/bitable/v1/apps/{app_token}/tables"
    tables_response = requests.get(tables_url, headers=headers)
    
    print(f"  表列表API状态: {tables_response.status_code}")
    
    if tables_response.status_code == 200:
        tables_result = tables_response.json()
        if tables_result.get("code") == 0:
            tables = tables_result["data"]["items"]
            print(f"  ✅ 成功! 找到 {len(tables)} 个数据表:")
            
            target_table_found = False
            for table in tables:
                print(f"    - {table['name']} (ID: {table['table_id']})")
                if table['table_id'] == table_id:
                    target_table_found = True
                    print(f"      🎯 这就是目标表!")
                    
                    # 尝试获取记录
                    records_url = f"{base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
                    records_data = {"page_size": 10}
                    
                    records_response = requests.post(records_url, headers=headers, json=records_data)
                    print(f"      记录查询状态: {records_response.status_code}")
                    
                    if records_response.status_code == 200:
                        records_result = records_response.json()
                        if records_result.get("code") == 0:
                            items = records_result["data"]["items"]
                            print(f"      ✅ 找到 {len(items)} 条记录")
                            
                            # 检查照片字段
                            for i, item in enumerate(items[:3]):  # 只检查前3条
                                fields = item.get("fields", {})
                                print(f"        记录 {i+1} 字段: {list(fields.keys())}")
                                
                                for field_name, field_value in fields.items():
                                    if "照片" in field_name:
                                        print(f"        🖼️ 找到照片字段: {field_name}")
                                        print(f"        数据: {json.dumps(field_value, indent=10, ensure_ascii=False)}")
                        else:
                            print(f"      记录查询失败: {records_result}")
                    else:
                        print(f"      记录查询HTTP错误: {records_response.text}")
            
            if not target_table_found:
                print(f"  ⚠️ 未找到目标表 {table_id}")
                
        else:
            print(f"  ❌ 表列表查询失败: {tables_result}")
    else:
        print(f"  ❌ 表列表HTTP错误: {tables_response.text}")

def test_first_table_with_records(headers, app_token, app_name):
    """测试第一个有记录的表"""
    print(f"\n--- 测试 {app_name} 中的表 ---")
    
    base_url = "https://open.feishu.cn/open-apis"
    tables_url = f"{base_url}/bitable/v1/apps/{app_token}/tables"
    tables_response = requests.get(tables_url, headers=headers)
    
    if tables_response.status_code == 200:
        tables_result = tables_response.json()
        if tables_result.get("code") == 0:
            for table in tables_result["data"]["items"]:
                table_id = table['table_id']
                table_name = table['name']
                
                # 查询记录
                records_url = f"{base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
                records_response = requests.post(records_url, headers=headers, json={"page_size": 5})
                
                if records_response.status_code == 200:
                    records_result = records_response.json()
                    if records_result.get("code") == 0:
                        items = records_result["data"]["items"]
                        if items:
                            print(f"  表 '{table_name}' 有 {len(items)} 条记录")
                            for field_name in items[0].get("fields", {}).keys():
                                print(f"    字段: {field_name}")
                            break

if __name__ == "__main__":
    debug_authorized_bitable()