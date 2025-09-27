#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

def test_accessible_bitables():
    """测试实际可访问的多维表格"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    # 获取访问令牌
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(url, headers=headers, json=data)
    token_result = response.json()
    access_token = token_result["tenant_access_token"]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8"
    }
    
    # 从权限检查中发现的可访问表格
    accessible_bitables = [
        {
            "name": "微信文章处理数据表",
            "token": "E1Z5bSDaaa5H0RsqRNeczAVrn7g",
            "url": "https://wsbj757q14.feishu.cn/base/E1Z5bSDaaa5H0RsqRNeczAVrn7g"
        },
        {
            "name": "无名表格",
            "token": "TqN9bbiylaYTzSs3qbsccp9Jnng", 
            "url": "https://wsbj757q14.feishu.cn/base/TqN9bbiylaYTzSs3qbsccp9Jnng"
        }
    ]
    
    for bitable in accessible_bitables:
        print(f"\n=== 测试表格: {bitable['name']} ===")
        app_token = bitable["token"]
        
        # 1. 列出表格中的所有数据表
        tables_url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables"
        tables_response = requests.get(tables_url, headers=headers)
        
        print(f"表列表API状态: {tables_response.status_code}")
        if tables_response.status_code == 200:
            tables_result = tables_response.json()
            if tables_result.get("code") == 0:
                tables = tables_result["data"]["items"]
                print(f"✓ 找到 {len(tables)} 个数据表:")
                
                for table in tables:
                    table_id = table["table_id"]
                    table_name = table["name"]
                    print(f"  - 表名: {table_name}, 表ID: {table_id}")
                    
                    # 2. 查询每个表的记录
                    records_url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/search"
                    records_data = {"page_size": 3}  # 只查询3条记录
                    
                    records_response = requests.post(records_url, headers=headers, json=records_data)
                    print(f"    记录查询状态: {records_response.status_code}")
                    
                    if records_response.status_code == 200:
                        records_result = records_response.json()
                        if records_result.get("code") == 0:
                            items = records_result["data"]["items"]
                            print(f"    ✓ 找到 {len(items)} 条记录")
                            
                            # 3. 检查是否有照片字段
                            for i, item in enumerate(items):
                                fields = item.get("fields", {})
                                print(f"      记录 {i+1} 字段: {list(fields.keys())}")
                                
                                # 查找可能的照片/附件字段
                                for field_name, field_value in fields.items():
                                    if field_name in ["照片", "图片", "附件", "文件"] or "photo" in field_name.lower() or "image" in field_name.lower():
                                        print(f"      ✓ 找到可能的照片字段: {field_name}")
                                        print(f"        数据: {json.dumps(field_value, indent=8, ensure_ascii=False)}")
                                    elif isinstance(field_value, list) and field_value and isinstance(field_value[0], dict):
                                        # 检查是否包含file_token等附件特征
                                        first_item = field_value[0]
                                        if "file_token" in first_item or "url" in first_item or "type" in first_item:
                                            print(f"      ✓ 找到附件字段: {field_name}")
                                            print(f"        数据: {json.dumps(field_value, indent=8, ensure_ascii=False)}")
                        else:
                            print(f"    ✗ 记录查询失败: {records_result}")
                    else:
                        print(f"    ✗ 记录查询HTTP错误: {records_response.text}")
            else:
                print(f"✗ 表列表查询失败: {tables_result}")
        else:
            print(f"✗ 表列表HTTP错误: {tables_response.text}")

if __name__ == "__main__":
    test_accessible_bitables()