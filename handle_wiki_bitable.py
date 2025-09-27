#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

def handle_wiki_embedded_bitable():
    """处理Wiki文档中嵌入的多维表格"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    print("=== 处理Wiki中嵌入的多维表格 ===")
    
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
    
    wiki_doc_id = "IimiwyD3Gi3wxWkjZBAcbIXcnJb"
    
    print(f"Wiki文档ID: {wiki_doc_id}")
    
    # 方案1: 尝试通过文档API访问
    print(f"\n=== 方案1: 通过文档API访问 ===")
    
    # 尝试获取文档信息
    doc_apis = [
        f"https://open.feishu.cn/open-apis/docx/v1/documents/{wiki_doc_id}",
        f"https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token={wiki_doc_id}",
        f"https://open.feishu.cn/open-apis/drive/v1/files/{wiki_doc_id}",
    ]
    
    for api_url in doc_apis:
        print(f"尝试: {api_url}")
        try:
            resp = requests.get(api_url, headers=auth_headers)
            print(f"状态: {resp.status_code}")
            if resp.status_code == 200:
                result = resp.json()
                print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
                if result.get("code") == 0:
                    print("✅ 成功获取文档信息!")
                    break
            else:
                print(f"错误: {resp.text[:200]}")
        except Exception as e:
            print(f"异常: {e}")
        print()
    
    # 方案2: 创建一个新的多维表格来测试
    print(f"\n=== 方案2: 创建测试多维表格 ===")
    
    create_url = "https://open.feishu.cn/open-apis/bitable/v1/apps"
    create_data = {
        "name": "照片测试表格",
        "folder_token": "root"  # 创建在根目录
    }
    
    create_response = requests.post(create_url, headers=auth_headers, json=create_data)
    print(f"创建多维表格状态: {create_response.status_code}")
    
    if create_response.status_code == 200:
        create_result = create_response.json()
        if create_result.get("code") == 0:
            new_app_token = create_result["data"]["app"]["app_token"]
            print(f"✅ 成功创建测试多维表格!")
            print(f"App Token: {new_app_token}")
            print(f"URL: {create_result['data']['app']['url']}")
            
            # 在新表格中添加照片字段并演示使用
            demo_photo_field(auth_headers, new_app_token)
        else:
            print(f"创建失败: {create_result}")
    else:
        print(f"创建HTTP错误: {create_response.text}")
    
    # 方案3: 提供手动解决步骤
    print(f"\n=== 方案3: 手动解决步骤 ===")
    print("如果API方式无法直接访问Wiki中的多维表格，请尝试:")
    print("1. 将Wiki中的多维表格复制/导出为独立的多维表格")
    print("2. 确保新的多维表格授权给你的应用")
    print("3. 使用新多维表格的URL进行API调用")
    
    print(f"\n具体步骤:")
    print("1. 打开你的Wiki: https://wsbj757q14.feishu.cn/wiki/IimiwyD3Gi3wxWkjZBAcbIXcnJb")
    print("2. 点击多维表格右上角的'...'菜单")
    print("3. 选择'复制到多维表格' 或 '另存为多维表格'")
    print("4. 新创建的多维表格会有独立的URL，格式类似: https://xxx.feishu.cn/base/xxxxx")
    print("5. 使用新URL中的app_token来调用API")

def demo_photo_field(headers, app_token):
    """演示照片字段的使用"""
    print(f"\n--- 演示照片字段使用 ---")
    
    base_url = "https://open.feishu.cn/open-apis"
    
    # 获取表列表
    tables_url = f"{base_url}/bitable/v1/apps/{app_token}/tables"
    tables_response = requests.get(tables_url, headers=headers)
    
    if tables_response.status_code == 200:
        tables_result = tables_response.json()
        if tables_result.get("code") == 0:
            tables = tables_result["data"]["items"]
            if tables:
                table_id = tables[0]["table_id"]
                table_name = tables[0]["name"]
                
                print(f"使用默认表: {table_name} (ID: {table_id})")
                
                # 添加照片字段
                fields_url = f"{base_url}/bitable/v1/apps/{app_token}/tables/{table_id}/fields"
                field_data = {
                    "field_name": "照片",
                    "type": 17  # 附件字段类型
                }
                
                field_response = requests.post(fields_url, headers=headers, json=field_data)
                print(f"添加照片字段状态: {field_response.status_code}")
                
                if field_response.status_code == 200:
                    field_result = field_response.json()
                    if field_result.get("code") == 0:
                        print("✅ 成功添加照片字段!")
                        print("现在你可以:")
                        print("1. 手动在多维表格中上传一些图片到照片字段")
                        print("2. 使用我提供的代码来提取和下载这些图片")
                        
                        # 提供使用示例
                        print(f"\n使用示例代码:")
                        print(f"```python")
                        print(f"APP_TOKEN = '{app_token}'")
                        print(f"TABLE_ID = '{table_id}'")
                        print(f"# 查询记录中的照片字段")
                        print(f"records = search_records(APP_TOKEN, TABLE_ID, field_names=['照片'])")
                        print(f"# 下载照片")
                        print(f"for record in records:")
                        print(f"    photo_data = record['fields'].get('照片')")
                        print(f"    if photo_data:")
                        print(f"        download_images(photo_data)")
                        print(f"```")
                    else:
                        print(f"添加字段失败: {field_result}")
                else:
                    print(f"添加字段HTTP错误: {field_response.text}")

if __name__ == "__main__":
    handle_wiki_embedded_bitable()