import json

def extract_photo_urls(data_str):
    """
    从JSON数据中提取照片相关的URL和临时URL
    
    Args:
        data_str (str): JSON格式的字符串数据
    
    Returns:
        dict: 包含urls和tmp_urls的字典
    """
    data = json.loads(data_str)
    
    urls = []
    tmp_urls = []
    
    # 遍历所有键值对
    for key, value in data.items():
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    # 提取url字段
                    if 'url' in item:
                        urls.append(item['url'])
                    # 提取tmp_url字段
                    if 'tmp_url' in item:
                        tmp_urls.append(item['tmp_url'])
    
    return {
        'urls': urls,
        'tmp_urls': tmp_urls
    }

# 使用示例
if __name__ == "__main__":
    data_str = '{"主题":[{"text":"换过10个公司之后，\\n","type":"text"},{"type":"text","text":"我决定开启我的勇气之旅"}],"测试一下":[{"file_token":"J8RLbqGOeogrs7xFstuclLOBnAh","name":"4f570185d48b4d64bc356819151092cb.png~tplv-mdko3gqilj-image.png%3Frk3s%3Dc8fe7ad5%26x-expires%3D1788076627%26x-signature%3Do3Xq5HyzY52KqEO5DxohzKaCbtA%253D.png","size":1102532,"tmp_url":"https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=J8RLbqGOeogrs7xFstuclLOBnAh","type":"image/png","url":"https://open.feishu.cn/open-apis/drive/v1/medias/J8RLbqGOeogrs7xFstuclLOBnAh/download"}],"自我介绍":[{"text":"30岁之后把自己重新养一遍\\n","type":"text"},{"text":"30天自驾从北京到云南\\n","type":"text"},{"text":"35岁决定给自己一个交代","type":"text"}],"序号":"1","形象照链接":{"type":1,"value":[{"text":"https://wsbj757q14.feishu.cn/space/api/box/stream/download/all/LKT6bhdQZoGzxRx1dCAcz4uKnLY/?extra=%7B%22bitablePerm%22%3A%7B%22tableId%22%3A%22tblEeAYFnTlvIYZQ%22%2C%22rev%22%3A41%2C%22attachments%22%3A%7B%22fldepnEvLb%22%3A%7B%22recau94ZM9%22%3A%5B%22LKT6bhdQZoGzxRx1dCAcz4uKnLY%22%5D%7D%7D%7D%7D&mount_node_token=RlMubEOWxaiykXsKJIRcbRAfni2&mount_point=bitable","type":"text"}]},"时间":[{"text":"8月9日 早9:30","type":"text"}],"昵称":[{"text":"BB","type":"text"}],"照片":[{"file_token":"LKT6bhdQZoGzxRx1dCAcz4uKnLY","name":"11.png","size":3902137,"tmp_url":"https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=LKT6bhdQZoGzxRx1dCAcz4uKnLY","type":"image/png","url":"https://open.feishu.cn/open-apis/drive/v1/medias/LKT6bhdQZoGzxRx1dCAcz4uKnLY/download"}],"组别":[{"text":"B","type":"text"}],"编号":5,"英文昵称":[{"text":"BB","type":"text"}]}'
    
    result = extract_photo_urls(data_str)
    
    print("提取的URLs:")
    for url in result['urls']:
        print(f"  {url}")
    
    print("\n提取的临时URLs:")
    for tmp_url in result['tmp_urls']:
        print(f"  {tmp_url}")