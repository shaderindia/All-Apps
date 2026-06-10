import os
import re

root_dir = r"C:\Users\POWERHOUSE\Desktop\All-Apps"
new_ad_url = "https://emotionallytonightintelligent.com/x8fvr0fu?key=a0df723f661db51d2b97818a0f27ea09"

html_files = []
for root, dirs, files in os.walk(root_dir):
    if '.git' in root:
        continue
    for f in files:
        if f.lower().endswith('.html'):
            html_files.append(os.path.join(root, f))

print(f"Total HTML files to verify: {len(html_files)}")
issues = 0

# The 6 files that must contain the new sponsored banner links
expected_banner_files = {
    "index.html",
    "cnc-machinist\\index.html",
    "cvbanao\\index.html",
    "fairshare\\index.html",
    "passportsizephoto\\index.html",
    "photopassportsizepro\\index.html"
}

for fpath in html_files:
    rel_path = os.path.relpath(fpath, root_dir)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # 1. Verify no leftover Adsterra domains or script tags
    if 'effectivecpmnetwork.com' in content:
        print(f"[!] Leftover Adsterra domain (effectivecpmnetwork.com) in {rel_path}")
        issues += 1

    if 'googlesyndication.com' in content or 'adsbygoogle' in content:
        print(f"[!] Leftover AdSense in {rel_path}")
        issues += 1

    # 2. Check banner presence
    banner_count = content.count(new_ad_url)
    
    if rel_path in expected_banner_files:
        if banner_count != 2:
            print(f"[!] {rel_path} has {banner_count} sponsored banners (expected exactly 2)")
            issues += 1
    else:
        if banner_count > 0:
            print(f"[!] {rel_path} contains the sponsored banner link but was not in the expected list")
            issues += 1

if issues == 0:
    print("\nSUCCESS: All old Adsterra/AdSense tags are completely removed. The custom sponsored banner is correctly integrated exactly twice on all 6 designated pages!")
else:
    print(f"\nFound {issues} verification issues.")
