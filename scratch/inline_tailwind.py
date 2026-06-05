"""
Inline tailwind.min.css into index.html using plain string search/replace.
Run from the All-Apps directory.
"""
import os, re

with open('css/tailwind.min.css', 'r', encoding='utf-8') as f:
    tailwind_css = f.read()

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Helper: remove a block identified by start/end markers
def remove_between(text, start_marker, end_marker):
    si = text.find(start_marker)
    if si == -1:
        return text, False
    ei = text.find(end_marker, si)
    if ei == -1:
        return text, False
    return text[:si] + text[ei + len(end_marker):], True

# ── 1. Remove the preload hint for tailwind
html, ok = remove_between(
    html,
    '  <!-- Preload Tailwind CSS so it starts downloading immediately',
    '/>\r\n'
)
print(f'Preload hint removed: {ok}')

# ── 2. Remove FOUC guard rule block
html, ok = remove_between(
    html,
    '    /* FOUC guard: hide body until Tailwind finishes loading',
    '    }'
)
print(f'FOUC guard CSS removed: {ok}')

# ── 3. Replace async link block with inline <style>
ASYNC_START = '  <!-- Load Tailwind CSS asynchronously (non-render-blocking)'
ASYNC_END   = '  <noscript><link rel="stylesheet" href="/css/tailwind.min.css" /></noscript>'
si = html.find(ASYNC_START)
ei = html.find(ASYNC_END, si)
if si != -1 and ei != -1:
    end_pos = ei + len(ASYNC_END)
    inline_block = (
        '  <!-- Tailwind CSS inlined — eliminates render-blocking network request -->\r\n'
        f'  <style>{tailwind_css}</style>'
    )
    html = html[:si] + inline_block + html[end_pos:]
    print('Async link replaced with inline <style>: OK')
else:
    print(f'ERROR: async block not found! si={si}, ei={ei}')

# ── 4. Remove tailwind-pending class from <body>
old_body = 'class="bg-gray-50 text-gray-800 antialiased tailwind-pending"'
new_body = 'class="bg-gray-50 text-gray-800 antialiased"'
if old_body in html:
    html = html.replace(old_body, new_body)
    print('tailwind-pending class removed from body: OK')
else:
    print('NOTE: tailwind-pending not found in body (may already be clean)')

# ── 5. Remove the 3-second safety timeout
TIMEOUT_START = '    // Safety: Reveal the page within 3s'
TIMEOUT_END   = '    }, 3000);\r\n\r\n'
si = html.find(TIMEOUT_START)
ei = html.find(TIMEOUT_END, si) if si != -1 else -1
if si != -1 and ei != -1:
    html = html[:si] + '    ' + html[ei + len(TIMEOUT_END):]
    print('Safety timeout removed: OK')
else:
    print('NOTE: safety timeout not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

file_size = os.path.getsize('index.html')
print(f'\nFinal index.html: {file_size} bytes ({file_size//1024} KB)')

# Verify no render-blocking link remains
checks = {
    'No blocking link': 'rel="stylesheet" href="/css/tailwind.min.css"' not in html,
    'No tailwind-pending': 'tailwind-pending' not in html,
    'No preload hint': 'Preload Tailwind CSS so it starts' not in html,
    'Inline style present': f'<style>{tailwind_css[:30]}' in html,
}
for label, ok in checks.items():
    print(f'  {"OK" if ok else "FAIL"}: {label}')
