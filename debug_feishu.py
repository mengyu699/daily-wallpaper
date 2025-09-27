#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

def debug_feishu_access():
    """调试飞书API访问问题"""
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    print("=== 飞书API调试工具 ===\n")
    
    # 1. 获取访问令牌
    print("1. 获取访问令牌...")
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(url, headers=headers, json=data)
    token_result = response.json()
    
    if token_result.get("code") == 0:
        access_token = token_result["tenant_access_token"]
        print(f"✓ 成功获取访问令牌")
    else:
        print(f"✗ 获取访问令牌失败: {token_result}")
        return
    
    # 2. 尝试获取所有可访问的多维表格应用
    print("\n2. 获取所有可访问的多维表格应用...")
    
    # 这个API可能需要不同的权限，先试试
    list_apps_url = "https://open.feishu.cn/open-apis/bitable/v1/apps"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    response = requests.get(list_apps_url, headers=headers)
    print(f"HTTP状态码: {response.status_code}")
    print(f"响应内容: {response.text}")
    
    try:
        apps_result = response.json()
        print(f"JSON解析成功: {apps_result}")
    except Exception as e:
        print(f"JSON解析失败: {e}")
        print("可能是API端点不存在或需要不同的权限")
        apps_result = {"code": -1}
    
    # 3. 如果有app_token，列出其下的表
    if apps_result.get("code") == 0 and apps_result.get("data", {}).get("items"):
        print(f"\n3. 找到 {len(apps_result['data']['items'])} 个多维表格应用:")
        for app in apps_result['data']['items']:
            app_token = app.get('app_token')
            app_name = app.get('name', 'Unknown')
            print(f"  - 应用名称: {app_name}")
            print(f"  - App Token: {app_token}")
            
            # 列出此应用下的表
            tables_url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables"
            tables_response = requests.get(tables_url, headers=headers)
            tables_result = tables_response.json()
            
            if tables_result.get("code") == 0:
                print(f"    包含 {len(tables_result['data']['items'])} 个数据表:")
                for table in tables_result['data']['items']:
                    print(f"      - 表名: {table['name']}, 表ID: {table['table_id']}")
            else:
                print(f"    无法获取表列表: {tables_result}")
            print()
    else:
        print(f"无法获取应用列表或没有可访问的应用")
        print("这可能意味着:")
        print("- 应用没有被授权访问任何多维表格")
        print("- 需要在飞书开放平台配置权限")
        print("- 多维表格没有共享给此应用")

if __name__ == "__main__":
    debug_feishu_access()