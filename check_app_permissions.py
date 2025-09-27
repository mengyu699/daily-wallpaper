#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

def check_feishu_app_permissions():
    """检查飞书应用权限和可访问资源"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    print("=== 飞书应用权限检查工具 ===\n")
    
    # 1. 获取访问令牌
    print("1. 获取访问令牌...")
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(url, headers=headers, json=data)
    token_result = response.json()
    
    if token_result.get("code") == 0:
        access_token = token_result["tenant_access_token"]
        print("✓ 访问令牌获取成功")
    else:
        print(f"✗ 获取访问令牌失败: {token_result}")
        return
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    # 2. 检查应用信息
    print("\n2. 检查应用信息...")
    app_info_url = "https://open.feishu.cn/open-apis/application/v6/applications/self"
    app_response = requests.get(app_info_url, headers=headers)
    print(f"应用信息API状态: {app_response.status_code}")
    if app_response.status_code == 200:
        app_info = app_response.json()
        print(f"应用信息: {json.dumps(app_info, indent=2, ensure_ascii=False)}")
    else:
        print(f"应用信息获取失败: {app_response.text}")
    
    # 3. 尝试列出所有可访问的多维表格
    print("\n3. 尝试获取可访问的多维表格...")
    
    # 可能的API端点
    test_endpoints = [
        ("多维表格应用列表", "GET", "https://open.feishu.cn/open-apis/bitable/v1/apps"),
        ("文档列表", "GET", "https://open.feishu.cn/open-apis/drive/v1/files"),
        ("文件夹列表", "GET", "https://open.feishu.cn/open-apis/drive/v1/files?folder_token=root"),
    ]
    
    for name, method, endpoint in test_endpoints:
        print(f"\n--- {name} ---")
        try:
            if method == "GET":
                resp = requests.get(endpoint, headers=headers)
            else:
                resp = requests.post(endpoint, headers=headers, json={})
            
            print(f"状态码: {resp.status_code}")
            if resp.status_code == 200:
                result = resp.json()
                print(f"成功响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
            else:
                print(f"失败响应: {resp.text}")
        except Exception as e:
            print(f"请求异常: {e}")
    
    # 4. 检查权限作用域
    print("\n4. 应用权限检查建议:")
    print("请在飞书开放平台 (https://open.feishu.cn) 检查以下配置:")
    print("- 应用权限 > 多维表格 > 查看、编辑多维表格")
    print("- 应用权限 > 云文档 > 查看、编辑云文档")
    print("- 应用可用性 > 添加应用到具体的多维表格或工作区")
    print("- 版本管理 > 确保应用已发布或在测试版本")
    
    print("\n5. 多维表格分享权限:")
    print("请确认多维表格已经:")
    print("- 设置为公开访问，或")
    print("- 明确分享给你的应用，或") 
    print("- 你的应用在多维表格所在的工作区内")

if __name__ == "__main__":
    check_feishu_app_permissions()