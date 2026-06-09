import os
import re

root_dir = r"C:\Users\POWERHOUSE\Desktop\All-Apps"

html_files = []
for root, dirs, files in os.walk(root_dir):
    if '.git' in root:
        continue
    for f in files:
        if f.lower().endswith('.html'):
            html_files.append(os.path.join(root, f))

print(f"Total HTML files to verify: {len(html_files)}")
issues = 0

for fpath in html_files:
    rel_path = os.path.relpath(fpath, root_dir)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    is_noindex = False
    robots_matches = re.findall(r'<meta\s+name=["\']robots["\']\s+content=["\'](.*?)["\']', content, re.IGNORECASE)
    for match in robots_matches:
        if 'noindex' in match.lower():
            is_noindex = True
            break
            
    # AdSense check (must be empty)
    if 'adsbygoogle' in content or 'googlesyndication.com' in content:
        print(f"[!] AdSense leftover in {rel_path}")
        issues += 1
        
    # Second Adsterra check (must be empty)
    if 'pl29683052.effectivecpmnetwork.com' in content:
        print(f"[!] Second Adsterra tag (pl29683052) leftover in {rel_path}")
        issues += 1
        
    # First Adsterra check (pl29683051)
    has_first_adsterra = 'pl29683051.effectivecpmnetwork.com' in content
    
    # Check if script is inside <head>
    head_match = re.search(r'<head>(.*?)</head>', content, re.DOTALL | re.IGNORECASE)
    in_head = False
    if head_match:
        in_head = 'pl29683051.effectivecpmnetwork.com' in head_match.group(1)
        
    is_legal = rel_path.lower() in [
        "about.html",
        "contact.html",
        "privacy-policy.html",
        "terms.html",
        "faq.html",
        "sitemap.html"
    ]

    if is_noindex or is_legal:
        if has_first_adsterra:
            print(f"[!] {rel_path} should not contain Adsterra script (noindex or legal/compliance page).")
            issues += 1
    else:
        if not has_first_adsterra:
            print(f"[!] {rel_path} is indexable but missing Adsterra script.")
            issues += 1
        elif not in_head:
            print(f"[!] {rel_path} has Adsterra script outside <head>.")
            issues += 1

if issues == 0:
    print("ALL 55 PAGES ARE 100% CORRECT (Google AdSense and the 2nd Adsterra tags are completely removed; the 1st Adsterra tag is correctly placed inside the head of main pages; legal/compliance/noindex pages are clean)!")
else:
    print(f"Found {issues} issues to resolve.")
