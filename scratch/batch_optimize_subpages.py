"""
Batch optimization script for all shader7.com sub-pages.
Fixes:
  1. Render-blocking FontAwesome CSS -> async (preload+onload)
  2. Google Fonts -> remove (replaced by self-hosted Inter already on /fonts/)
  3. Missing lazy loading on below-fold images
  4. Add self-hosted @font-face + preload for Inter on pages that use Google Fonts
  5. Move AdSense/GA scripts below render-critical content where needed
"""
import re, os

# Pages to process
PAGES = [
    'photocompressor/index.html',
    'cvbanao/index.html',
    'berofchat/index.html',
    'photopassportsizepro/index.html',
    'bcal/index.html',
    'receiptpro/index.html',
    'hourlysalarycalculator/index.html',
    'fairshare/index.html',
]

# Inline @font-face for self-hosted Inter (same as main index.html)
INTER_FONT_FACE = '''  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
  <style>
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 300 900;
      font-display: optional;
      src: url('/fonts/Inter-Variable.woff2') format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
  </style>'''

results = []

for page in PAGES:
    if not os.path.exists(page):
        results.append((page, 'SKIP: not found'))
        continue

    with open(page, 'r', encoding='utf-8') as f:
        html = f.read()

    original = html
    changes = []

    # ── 1. Make blocking FontAwesome async (preload+onload pattern)
    # Pattern: <link rel="stylesheet" href="/css/font-awesome.min.css" ...>
    def make_fa_async(m):
        attrs = m.group(0)
        if 'media=' in attrs or 'onload=' in attrs:
            return attrs  # already async
        # Replace rel="stylesheet" with async load pattern
        return (
            '<link\n'
            '    rel="preload"\n'
            '    href="/css/font-awesome.min.css"\n'
            '    as="style"\n'
            '    onload="this.onload=null;this.rel=\'stylesheet\'"\n'
            '    crossorigin="anonymous"\n'
            '  />\n'
            '  <noscript><link rel="stylesheet" href="/css/font-awesome.min.css" crossorigin="anonymous" /></noscript>'
        )

    # Match blocking FA link (not already async)
    fa_pattern = re.compile(
        r'<link\s[^>]*href=["\'][^"\']*font-awesome\.min\.css[^"\']*["\'][^>]*>',
        re.IGNORECASE | re.DOTALL
    )
    new_html = fa_pattern.sub(make_fa_async, html)
    if new_html != html:
        changes.append('FA->async')
        html = new_html

    # ── 2. Remove Google Fonts requests and add self-hosted Inter instead
    has_google_font = 'fonts.googleapis.com' in html

    if has_google_font:
        # Remove preconnect to google fonts
        html = re.sub(
            r'\s*<link[^>]+preconnect[^>]*fonts\.gstatic\.com[^>]*/?\s*>',
            '', html
        )
        html = re.sub(
            r'\s*<link[^>]+preconnect[^>]*fonts\.googleapis\.com[^>]*/?\s*>',
            '', html
        )
        # Remove the actual Google Fonts CSS link (preload or stylesheet or noscript)
        html = re.sub(
            r'\s*<link[^>]+fonts\.googleapis\.com/css[^>]*/?\s*>',
            '', html
        )
        html = re.sub(
            r'\s*<noscript>\s*<link[^>]+fonts\.googleapis\.com[^>]*/?\s*>\s*</noscript>',
            '', html
        )
        # Remove inline JS font loading (if loadCSS pattern was used)
        html = re.sub(
            r"\s*<script>[^<]*fonts\.googleapis\.com[^<]*</script>",
            '', html, flags=re.DOTALL
        )
        changes.append('GoogleFonts->removed')

    # ── 3. Add self-hosted Inter font if Google Fonts was removed or if no font preload exists
    has_inter_preload = '/fonts/Inter-Variable.woff2' in html
    if (has_google_font and not has_inter_preload):
        # Insert Inter preload + @font-face after <head>
        html = html.replace('<head>', '<head>\n' + INTER_FONT_FACE, 1)
        changes.append('Inter-selfhost added')

    # ── 4. Add loading="lazy" to images that don't have it
    # Skip: images in the first viewport (hero section / header) - heuristic: first 3 img tags
    img_count = [0]
    def add_lazy(m):
        tag = m.group(0)
        img_count[0] += 1
        if 'loading=' in tag:
            return tag  # already has loading attribute
        if img_count[0] <= 2:
            return tag  # skip first 2 images (likely above fold)
        # Add loading="lazy" before the closing >
        return tag.replace('<img ', '<img loading="lazy" ', 1)

    new_html = re.sub(r'<img\s[^>]+>', add_lazy, html, flags=re.DOTALL)
    lazy_added = new_html.count('loading="lazy"') - html.count('loading="lazy"')
    if lazy_added > 0:
        changes.append(f'+lazy({lazy_added}imgs)')
        html = new_html

    # ── 5. Make fonts.css async if it's blocking (berofchat uses it)
    html = re.sub(
        r'<link rel=["\']stylesheet["\'] href=["\'][^"\']*fonts\.css["\']>',
        '<link rel="preload" href="/css/fonts.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">',
        html
    )

    # Save if changed
    if html != original:
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        results.append((page, 'OK: ' + ', '.join(changes) if changes else 'OK: lazy only'))
    else:
        results.append((page, 'NO CHANGE'))

print('\n=== BATCH OPTIMIZATION RESULTS ===')
for page, status in results:
    print(f'  {page:<45} {status}')
