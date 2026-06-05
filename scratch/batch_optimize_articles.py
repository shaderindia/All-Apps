"""
Extend batch optimization to blog/article pages and remaining sub-apps.
Same fixes: async FA, remove Google Fonts, add lazy loading.
"""
import re, os

EXTRA_PAGES = [
    'passport-photo-online-free.html',
    'resume-builder-ats-guide.html',
    'cnc-circular-interpolation-g02-g03.html',
    'cnc-speeds-feeds-machining-guide.html',
    'cnc-macro-programming-fanuc-b.html',
    'salary-calculator-hourly-to-yearly.html',
    'ber-of-chat-p2p-messaging-guide.html',
    'cnc-angle-length-calculator-guide.html',
    'cnc-chamfer-programming-guide.html',
    'cnc-gcode-beginners-guide.html',
    'photo-compression-guide-online.html',
    'professional-receipt-maker-guide.html',
    'trading-mastery-risk-management.html',
    'simple-monthly-budgeting-guide.html',
    'digital-workspace-organization.html',
    'remote-work-productivity-tools.html',
    'split-expenses-with-friends.html',
    'top-interview-questions-prep.html',
    'passport-photo-lighting-setup.html',
    'online-web-tools-data-security.html',
    'cnc-machinist-drill-chart-reference.html',
    'shader7-new-features-updates.html',
    'cnc-pcd-calculator-guide.html',
    '3d-cad-browser-machinist-modeling.html',
    'blog.html',
    'passportsizephoto/index.html',
    'cnc-machinist/index.html',
]

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

changed = []
skipped = []

for page in EXTRA_PAGES:
    if not os.path.exists(page):
        skipped.append(page)
        continue

    with open(page, 'r', encoding='utf-8') as f:
        html = f.read()

    original = html
    ops = []

    # 1. Async FontAwesome
    def make_fa_async(m):
        tag = m.group(0)
        if 'onload=' in tag or 'media=' in tag:
            return tag
        return (
            '<link\n    rel="preload"\n    href="/css/font-awesome.min.css"\n'
            '    as="style"\n    onload="this.onload=null;this.rel=\'stylesheet\'"\n'
            '    crossorigin="anonymous"\n  />\n'
            '  <noscript><link rel="stylesheet" href="/css/font-awesome.min.css" crossorigin="anonymous" /></noscript>'
        )
    fa_pat = re.compile(r'<link\s[^>]*href=["\'][^"\']*font-awesome\.min\.css[^"\']*["\'][^>]*>', re.IGNORECASE | re.DOTALL)
    new = fa_pat.sub(make_fa_async, html)
    if new != html:
        ops.append('FA->async')
        html = new

    # 2. Remove Google Fonts
    if 'fonts.googleapis.com' in html:
        html = re.sub(r'\s*<link[^>]+preconnect[^>]*fonts\.(gstatic|googleapis)\.com[^>]*/?\s*>', '', html)
        html = re.sub(r'\s*<link[^>]+fonts\.googleapis\.com/css[^>]*/?\s*>', '', html)
        html = re.sub(r'\s*<noscript>\s*<link[^>]+fonts\.googleapis\.com[^>]*/?\s*>\s*</noscript>', '', html)
        ops.append('GFont->removed')
        if '/fonts/Inter-Variable.woff2' not in html:
            html = html.replace('<head>', '<head>\n' + INTER_FONT_FACE, 1)
            ops.append('Inter added')

    # 3. Lazy load images (skip first 2)
    count = [0]
    def add_lazy(m):
        tag = m.group(0)
        count[0] += 1
        if 'loading=' in tag or count[0] <= 2:
            return tag
        return tag.replace('<img ', '<img loading="lazy" ', 1)
    new = re.sub(r'<img\s[^>]+>', add_lazy, html, flags=re.DOTALL)
    added = new.count('loading="lazy"') - html.count('loading="lazy"')
    if added > 0:
        ops.append(f'+lazy({added})')
        html = new

    if html != original:
        with open(page, 'w', encoding='utf-8') as f:
            f.write(html)
        changed.append((page, ', '.join(ops)))

print(f'Changed {len(changed)} pages, skipped {len(skipped)} not found:')
for p, ops in changed:
    print(f'  OK  {p}: {ops}')
if skipped:
    print(f'\nNot found: {", ".join(skipped[:5])}{"..." if len(skipped)>5 else ""}')
