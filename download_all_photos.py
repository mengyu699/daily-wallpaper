#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import os
from urllib.parse import unquote

def download_all_photos_with_auth():
    """使用你的密钥认证并下载所有照片"""
    
    # 你提供的应用密钥
    APP_ID = "cli_a4b128a68fb9d00e"
    APP_SECRET = "TMr6fIFmAYGWSE0m451ngfBcfwkQxAKc"
    
    print("🔐 使用你的密钥获取认证...")
    
    # 1. 获取访问令牌
    token_url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {"app_id": APP_ID, "app_secret": APP_SECRET}
    
    response = requests.post(token_url, headers=headers, json=data)
    token_result = response.json()
    
    if token_result.get("code") != 0:
        print(f"❌ 认证失败: {token_result}")
        return
    
    access_token = token_result["tenant_access_token"]
    print("✅ 认证成功，获得访问令牌")
    
    # 2. 准备下载头信息
    download_headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    # 3. 你的照片链接列表
    photo_links = [
        {
            "name": "照片1_测试一下字段.png",
            "url": "https://open.feishu.cn/open-apis/drive/v1/medias/J8RLbqGOeogrs7xFstuclLOBnAh/download",
            "size": "1.1MB",
            "token": "J8RLbqGOeogrs7xFstuclLOBnAh"
        },
        {
            "name": "照片2_照片字段.png", 
            "url": "https://open.feishu.cn/open-apis/drive/v1/medias/LKT6bhdQZoGzxRx1dCAcz4uKnLY/download",
            "size": "3.9MB",
            "token": "LKT6bhdQZoGzxRx1dCAcz4uKnLY"
        }
    ]
    
    # 4. 创建下载目录
    download_dir = "./your_photos"
    os.makedirs(download_dir, exist_ok=True)
    
    print(f"\n📥 开始下载你的照片到: {download_dir}/")
    
    downloaded_files = []
    
    # 5. 逐个下载照片
    for i, photo in enumerate(photo_links, 1):
        print(f"\n📸 下载照片 {i}: {photo['name']} ({photo['size']})")
        print(f"   链接: {photo['url']}")
        
        try:
            # 发送下载请求
            response = requests.get(photo['url'], headers=download_headers, stream=True)
            
            print(f"   状态码: {response.status_code}")
            
            if response.status_code == 200:
                # 保存文件
                filepath = os.path.join(download_dir, photo['name'])
                
                with open(filepath, 'wb') as f:
                    downloaded_size = 0
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)
                
                downloaded_files.append(filepath)
                print(f"   ✅ 下载成功!")
                print(f"   💾 保存位置: {filepath}")
                print(f"   📊 实际大小: {downloaded_size:,} 字节")
                
            else:
                print(f"   ❌ 下载失败: HTTP {response.status_code}")
                print(f"   错误信息: {response.text[:200]}...")
                
        except Exception as e:
            print(f"   ❌ 下载异常: {e}")
    
    # 6. 下载结果汇总
    print(f"\n" + "="*60)
    print(f"🎉 下载完成!")
    print(f"📊 成功下载 {len(downloaded_files)} 张照片")
    print(f"📁 保存目录: {os.path.abspath(download_dir)}")
    
    if downloaded_files:
        print(f"\n📋 下载的文件:")
        for file in downloaded_files:
            file_size = os.path.getsize(file)
            print(f"   ✅ {os.path.basename(file)} ({file_size:,} 字节)")
    
    print(f"\n💡 你现在可以在以下位置查看照片:")
    print(f"   {os.path.abspath(download_dir)}")
    
    return downloaded_files

if __name__ == "__main__":
    download_all_photos_with_auth()