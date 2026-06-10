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

# The 6 files that must contain the new sponsored banner blocks in the body
expected_banner_files = {
    "index.html",
    "cnc-machinist\\index.html",
    "cvbanao\\index.html",
    "fairshare\\index.html",
    "passportsizephoto\\index.html",
    "photopassportsizepro\\index.html"
}

# The files that should have a redirection link in their javascript download functions
expected_download_redirects = {
    "passportsizephoto\\index.html", # via script.js
    "photopassportsizepro\\index.html",
    "cvbanao\\template1\\index.html",
    "cvbanao\\template2\\index.html",
    "cvbanao\\template3\\index.html",
    "cvbanao\\template4\\index.html",
    "cvbanao\\template5\\index.html"
}

# We also check the script.js file for the classic passport photo app
classic_script_path = os.path.join(root_dir, "passportsizephoto", "script.js")
if os.path.exists(classic_script_path):
    with open(classic_script_path, 'r', encoding='utf-8') as f:
        classic_script_content = f.read()
    if new_ad_url not in classic_script_content:
        print("[!] passportsizephoto/script.js is missing the download redirection link")
        issues += 1

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

    # 2. Check body banner presence (based on unique markup style snippet containing the sponsor link)
    body_banner_count = 0
    start_pos = 0
    while True:
        idx = content.find('max-width: 1080px; margin: 10px auto 34px;', start_pos)
        if idx == -1:
            break
        # Check if the banner links to the sponsor ad url
        block = content[idx:idx+400]
        if new_ad_url in block:
            body_banner_count += 1
        start_pos = idx + 1
    
    if rel_path in expected_banner_files:
        if body_banner_count != 2:
            print(f"[!] {rel_path} has {body_banner_count} body banners (expected exactly 2)")
            issues += 1
    else:
        if body_banner_count > 0:
            print(f"[!] {rel_path} has body banners but was not in the expected list")
            issues += 1
            
    # 3. Check download redirect presence
    has_redirect = new_ad_url in content
    if rel_path in expected_download_redirects:
        if not has_redirect:
            print(f"[!] {rel_path} is missing the sponsored download redirect link")
            issues += 1
    elif rel_path not in expected_banner_files:
        # If it's not a banner file and not a download redirect file, it should NOT have the ad url
        if has_redirect:
            print(f"[!] {rel_path} contains the sponsored link unexpectedly")
            issues += 1

if issues == 0:
    print("\nSUCCESS: All old Adsterra/AdSense tags are completely removed. The custom sponsored banner and download redirections are correctly integrated!")
else:
    print(f"\nFound {issues} verification issues.")
