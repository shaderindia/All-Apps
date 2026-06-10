import os
import re

root_dir = r"C:\Users\POWERHOUSE\Desktop\All-Apps"
new_ad_url = "https://emotionallytonightintelligent.com/x8fvr0fu?key=a0df723f661db51d2b97818a0f27ea09"

new_banner_html = f"""<div style="max-width: 1080px; margin: 10px auto 34px; padding: 0 18px; text-align: center; overflow: hidden;">
  <a href="{new_ad_url}" target="_blank" rel="noopener sponsored" style="text-decoration: none; display: block;">
    <div style="background: var(--glass-bg, rgba(255, 255, 255, 0.73)); border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.16)); border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 15px; min-height: 90px; transition: transform 0.2s; cursor: pointer; position: relative; flex-wrap: wrap; padding: 16px 20px; box-shadow: var(--shadow, 0 8px 32px 0 rgba(31, 38, 135, 0.08)); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);" onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'">
      <span style="position: absolute; top: 6px; right: 12px; margin: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted, #6b7280);">Sponsored</span>
      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1, #a855f7); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"></path>
        </svg>
      </div>
      <div style="text-align: left; flex-grow: 1; min-width: 200px;">
        <div style="font-weight: 700; color: var(--text-main, #1f2937); font-size: 0.95rem; margin-bottom: 2px;">Premium Offers &amp; Tools</div>
        <div style="color: var(--text-muted, #6b7280); font-size: 0.8rem;">Explore high-quality resources and special partner deals to boost your productivity.</div>
      </div>
      <div style="flex-shrink: 0;">
        <span style="display: inline-block; background: var(--primary, #6366f1); color: white; padding: 6px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);">Learn More</span>
      </div>
    </div>
  </a>
</div>"""

html_files = []
for root, dirs, files in os.walk(root_dir):
    if '.git' in root:
        continue
    for f in files:
        if f.lower().endswith('.html'):
            html_files.append(os.path.join(root, f))

modified_count = 0

# 1. Compile regexes for body ad containers FIRST (before removing scripts)
# Replace standard .ad-container blocks
ad_container_regex = re.compile(
    r'<div class="ad-container[^"]*"[^>]*>\s*<div class="ad-container-inner"[^>]*>.*?<script[^>]*effectivecpmnetwork\.com.*?/script>\s*<div id="container-[a-f0-9]+"></div>.*?</div>\s*</div>',
    re.DOTALL | re.IGNORECASE
)

# Replace Tailwind-styled ad containers (in index.html)
tailwind_ad_regex = re.compile(
    r'<!-- Ad Container -->\s*<div class="max-w-7xl[^"]*"[^>]*>\s*<div class="bg-white border[^"]*"[^>]*>.*?<script[^>]*effectivecpmnetwork\.com.*?/script>\s*<div id="container-[a-f0-9]+"></div>\s*</div>\s*</div>',
    re.DOTALL | re.IGNORECASE
)

for fpath in html_files:
    rel_path = os.path.relpath(fpath, root_dir)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    orig_content = content
    
    # Perform container replacements first
    content, count1 = ad_container_regex.subn(new_banner_html, content)
    content, count2 = tailwind_ad_regex.subn(new_banner_html, content)
    
    # 2. Globally clean up preconnect/dns-prefetch tags for effectivecpmnetwork.com
    content = re.sub(
        r'\s*<link[^>]+(?:preconnect|dns-prefetch)[^>]*?effectivecpmnetwork\.com[^>]*>',
        '', content, flags=re.IGNORECASE
    )
    
    # 3. Globally clean up script tags pointing to effectivecpmnetwork.com
    content = re.sub(
        r'\s*<script[^>]*?src=["\']https?://[^"\']*?effectivecpmnetwork\.com/[^"\']*?["\'][^>]*></script>',
        '', content, flags=re.IGNORECASE
    )
    
    # 4. Clean up any leftover script tags for effectivecpmnetwork.com
    content = re.sub(
        r'\s*<script[^>]*?effectivecpmnetwork\.com.*?/script>',
        '', content, flags=re.IGNORECASE
    )
    
    # 5. Clean up any leftover empty container divs
    content = re.sub(
        r'\s*<div id="container-[a-f0-9]+"></div>',
        '', content, flags=re.IGNORECASE
    )
    
    if content != orig_content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[OK] Modified: {rel_path} (replacements: ad-container={count1}, tailwind-ad={count2})")
        modified_count += 1

print(f"\nDone! Modified {modified_count} files.")
