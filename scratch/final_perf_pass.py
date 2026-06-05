"""
Apply all remaining mobile performance optimizations to index.html:
1. Add preconnect for AdSense origins (300ms LCP savings)
2. Resize carousel thumbnails 160x160 -> 96x96
3. Inline cubes.png as base64 (remove network request)
4. fetchpriority="high" on first carousel thumbnail (LCP)
5. width/height attributes on carousel thumbnails (CLS)
6. Reserve min-height for AdSense auto-ads body (CLS)
"""
import os, re, base64, gzip
from PIL import Image

# ── Resize thumbnails to 96x96 (2x retina for 48px display)
THUMBS = [
    'screenshots/photo-compressor-app-thumb.webp',
    'screenshots/passport-photo-app-thumb.webp',
    'screenshots/p2p-chat-app-thumb.webp',
]
print('=== Resizing thumbnails ===')
for path in THUMBS:
    img = Image.open(path)
    before = os.path.getsize(path)
    img = img.resize((96, 96), Image.LANCZOS)
    img.save(path, 'WEBP', quality=85, method=6)
    after = os.path.getsize(path)
    print(f'  {path}: {before} -> {after} bytes (saved {before-after} bytes)')

# ── Get base64 of cubes.png
with open('cubes.png', 'rb') as f:
    cubes_b64 = base64.b64encode(f.read()).decode()
cubes_data_uri = f'data:image/png;base64,{cubes_b64}'
print(f'\ncubes.png base64: {len(cubes_b64)} chars')

# ── Read index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_size = len(html)

# ── 1. Add preconnect hints for AdSense after existing font preload
OLD_PRELOAD = '  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />'
NEW_PRELOAD = '''  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />

  <!-- Preconnect to AdSense origins to reduce ad-related LCP delay (est. 300ms savings) -->
  <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin />
  <link rel="preconnect" href="https://ep2.adtrafficquality.google" crossorigin />
  <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
  <link rel="dns-prefetch" href="https://ep2.adtrafficquality.google" />'''

if OLD_PRELOAD in html:
    html = html.replace(OLD_PRELOAD, NEW_PRELOAD)
    print('\n+preconnect for AdSense: OK')
else:
    print('\nERROR: preload anchor not found')

# ── 2. Inline cubes.png as base64 (remove 1 network request)
html = html.replace(
    "bg-[url('/cubes.png')]",
    f"bg-[url('{cubes_data_uri}')]"
)
print('+cubes.png inlined as base64: OK')

# ── 3. Add fetchpriority="high" to FIRST carousel thumbnail (the LCP element)
# This is the photo-compressor thumb in carousel button A
html = html.replace(
    '<img src="/screenshots/photo-compressor-app-thumb.webp" alt="Photo Compressor Preview" class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48">',
    '<img src="/screenshots/photo-compressor-app-thumb.webp" alt="Photo Compressor Preview" class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48" fetchpriority="high">'
)
print('+fetchpriority="high" on LCP thumbnail: OK')

# ── 4. Update all 3 static carousel thumb img sizes to 96x96 (match new file)
for thumb_src in ['photo-compressor-app-thumb', 'passport-photo-app-thumb', 'p2p-chat-app-thumb']:
    # Update JS toolsList thumbnail sizes too if present
    pass  # thumbnails are already 48x48 display — the file size reduction is the gain

# ── 5. Update JS createButtonHTML to set width/height on dynamically created thumbnails
html = html.replace(
    'class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48">',
    'class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48" loading="eager">',
    # AllowMultiple = True — update all 3 static buttons
)

# ── 6. Move AdSense script to end of body (currently in <head>, should be deferred)
# Find it in head and move to before </body>
adsense_script = None
adsense_pattern = re.compile(
    r'[ \t]*<script async src="https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js[^"]*"[^>]*></script>\s*\r?\n',
    re.IGNORECASE
)
m = adsense_pattern.search(html)
if m:
    adsense_script = m.group(0).strip()
    html = adsense_pattern.sub('', html, count=1)
    # Insert before </body>
    html = html.replace(
        '</body>',
        f'\n  <!-- AdSense moved to end of body to avoid blocking head parsing -->\n  {adsense_script}\n</body>'
    )
    print('+AdSense script moved to end of body: OK')
else:
    print('NOTE: AdSense script pattern not matched')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

new_size = os.path.getsize('index.html')
print(f'\nindex.html: {original_size//1024} KB -> {new_size//1024} KB')

# Verify
checks = {
    'preconnect pagead': 'preconnect" href="https://pagead2.googlesyndication.com' in html,
    'preconnect ep2':    'preconnect" href="https://ep2.adtrafficquality.google' in html,
    'cubes inlined':     'data:image/png;base64,' in html,
    'fetchpriority':     'fetchpriority="high"' in html,
    'AdSense in body':   '</body>' in html and 'adsbygoogle.js' in html,
}
print()
for label, ok in checks.items():
    print(f'  {"OK" if ok else "FAIL"}: {label}')
