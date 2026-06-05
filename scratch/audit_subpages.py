import re, os

pages = [
    'photocompressor/index.html',
    'cvbanao/index.html',
    'berofchat/index.html',
    'photopassportsizepro/index.html',
    'bcal/index.html',
    'receiptpro/index.html',
    'hourlysalarycalculator/index.html',
    'fairshare/index.html',
]

print('PAGE                                       | RB-CSS | RB-FA | NO-LAZY | G-FONT | PRECONN | SIZE')
print('-' * 110)
for page in pages:
    try:
        with open(page, 'r', encoding='utf-8') as f:
            html = f.read()
        rb_css   = bool(re.search(r"<link rel=['\"]stylesheet['\"]", html))
        rb_fa    = 'font-awesome.min.css' in html and 'rel="stylesheet"' in html
        async_fa = 'font-awesome' in html and 'media="print"' in html
        img_tags = len(re.findall(r'<img ', html))
        lazy_tags= len(re.findall(r'loading=', html))
        no_lazy  = img_tags - lazy_tags
        gfont    = 'fonts.googleapis.com' in html
        preconn  = 'preconnect' in html
        size_kb  = os.path.getsize(page) // 1024
        rb_fa_str = 'BLOCK' if (rb_fa and not async_fa) else ('async' if async_fa else 'none')
        print(f'{page:<42} | {"YES" if rb_css else "ok":<6} | {rb_fa_str:<5} | {no_lazy:<7} | {"YES" if gfont else "ok":<6} | {"YES" if preconn else "NO":<7} | {size_kb} KB')
    except Exception as e:
        print(f'{page:<42} | ERROR: {e}')
