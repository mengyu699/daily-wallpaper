#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re

def extract_all_photo_links():
    """提取所有照片的附件链接"""
    
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
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
    
    # 使用真正的多维表格token
    REAL_TOKEN = "RlMubEOWxaiykXsKJIRcbRAfni2"
    TARGET_TABLE = "tblEeAYFnTlvIYZQ"
    
    print("=== 提取所有照片附件链接 ===\n")
    
    # 查询记录
    base_url = "https://open.feishu.cn/open-apis"
    records_url = f"{base_url}/bitable/v1/apps/{REAL_TOKEN}/tables/{TARGET_TABLE}/records/search"
    records_data = {"page_size": 100}
    
    records_response = requests.post(records_url, headers=auth_headers, json=records_data)
    records_result = records_response.json()
    
    if records_result.get("code") != 0:
        print(f"查询记录失败: {records_result}")
        return
    
    items = records_result["data"]["items"]
    print(f"找到 {len(items)} 条记录\n")
    
    all_photo_links = []
    
    for i, item in enumerate(items, 1):
        record_id = item.get("record_id")
        fields = item.get("fields", {})
        
        print(f"📋 记录 {i} (ID: {record_id}):")
        
        for field_name, field_value in fields.items():
            if isinstance(field_value, list) and field_value:
                # 检查是否是照片/附件字段
                is_photo_field = False
                for attachment in field_value:
                    if isinstance(attachment, dict) and attachment.get('type', '').startswith('image/'):
                        is_photo_field = True
                        break
                
                if is_photo_field:
                    print(f"  🖼️  字段: {field_name}")
                    
                    for j, attachment in enumerate(field_value, 1):
                        if isinstance(attachment, dict):
                            file_token = attachment.get('file_token')
                            file_name = attachment.get('name')
                            file_size = attachment.get('size')
                            file_type = attachment.get('type')
                            download_url = attachment.get('url')
                            tmp_url = attachment.get('tmp_url')
                            
                            print(f"    📎 附件 {j}:")
                            print(f"       文件名: {file_name}")
                            print(f"       文件类型: {file_type}")
                            print(f"       文件大小: {file_size} 字节")
                            print(f"       文件Token: {file_token}")
                            print(f"       下载链接: {download_url}")
                            print(f"       临时链接: {tmp_url}")
                            
                            # 添加到汇总列表
                            all_photo_links.append({
                                'record_id': record_id,
                                'field_name': field_name,
                                'file_name': file_name,
                                'file_type': file_type,
                                'file_size': file_size,
                                'file_token': file_token,
                                'download_url': download_url,
                                'tmp_url': tmp_url
                            })
                            print()
        print()
    
    # 汇总输出
    print("="*80)
    print("🔗 所有照片附件链接汇总:")
    print("="*80)
    
    for idx, photo in enumerate(all_photo_links, 1):
        print(f"\n📸 照片 {idx}:")
        print(f"   记录ID: {photo['record_id']}")
        print(f"   字段名: {photo['field_name']}")
        print(f"   文件名: {photo['file_name']}")
        print(f"   文件类型: {photo['file_type']}")
        print(f"   文件大小: {photo['file_size']} 字节")
        print(f"   文件Token: {photo['file_token']}")
        print(f"   🔗 直接下载链接:")
        print(f"      {photo['download_url']}")
        print(f"   🔗 临时下载链接:")
        print(f"      {photo['tmp_url']}")
    
    # 生成纯链接列表
    print("\n" + "="*80)
    print("📋 纯链接列表 (可直接复制使用):")
    print("="*80)
    
    print("\n🔗 直接下载链接:")
    for idx, photo in enumerate(all_photo_links, 1):
        print(f"{idx}. {photo['download_url']}")
    
    print(f"\n🔗 临时下载链接:")
    for idx, photo in enumerate(all_photo_links, 1):
        print(f"{idx}. {photo['tmp_url']}")
    
    # 保存到文件
    output_data = {
        'total_photos': len(all_photo_links),
        'photos': all_photo_links
    }
    
    with open('photo_links.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 详细信息已保存到: photo_links.json")
    print(f"📊 总计找到 {len(all_photo_links)} 张照片的附件链接")
    
    return all_photo_links

if __name__ == "__main__":
    extract_all_photo_links()