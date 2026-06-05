import os
import re

root_path = r'C:\Users\POWERHOUSE\.gemini\antigravity\scratch\All-Apps'

def audit_images(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Find all image sources
    img_srcs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
    
    non_webp = [src for src in img_srcs if not (src.endswith('.webp') or src.endswith('.svg') or src.startswith('data:') or '${' in src)]
    
    return {
        'path': os.path.relpath(file_path, root_path),
        'non_webp': non_webp
    }

results = []
for root, dirs, files in os.walk(root_path):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.html'):
            full_path = os.path.join(root, file)
            res = audit_images(full_path)
            if res['non_webp']:
                results.append(res)

for r in results:
    print(f"File: {r['path']}")
    print(f"  Non-WebP Images: {r['non_webp']}")
    print("-" * 50)
