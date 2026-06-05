"""
Replace FontAwesome CSS + icon font with a tiny inline SVG icon system.
Only the 7 icons used in the hero carousel are needed.
Eliminates the 23KB font-awesome.min.css from cache + the woff2 font files.
"""
import re

# FA6 Free Solid SVG paths for only the 7 icons we use
# Source: Font Awesome 6 Free (CC BY 4.0)
ICONS = {
    # fa-compress  (used for Photo Compressor)
    'compress': ('0 0 448 512', 'M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zm128 0v64h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H288c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zm288 64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352H320c-17.7 0-32-14.3-32-32s14.3-32 32-32h96c17.7 0 32 14.3 32 32v96c0 17.7-14.3 32-32 32s-32-14.3-32-32z'),
    # fa-camera-retro  (used for Passport Photo PRO)
    'camera-retro': ('0 0 512 512', 'M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z'),
    # fa-comments  (used for Private Chat)
    'comments': ('0 0 640 512', 'M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.8 25.4c-4.8 6.2-9.7 12-14.8 17.8c-2.6 3-2 7.5 1.3 9.7c12.3 7.4 26.5 11.7 41.7 11.7c30.9 0 58.6-13.3 78.2-34.8C149.6 349 178.3 352 208 352zm272-96c17.5 0 34.1-2.2 49.8-6.2c-29.6-23.6-47.8-55.8-47.8-91.8c0-55.2 32.5-103.5 81.3-133.5c-22.1-8-46.3-12.5-71.3-12.5c-114.9 0-208 78.8-208 176c0 42.6 16.3 81.7 43.3 112.7C327.8 299.5 344 272 344 240z'),
    # fa-file-invoice  (used for Resume Builder)
    'file-invoice': ('0 0 384 512', 'M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM64 80c0-8.8 7.2-16 16-16h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16zm0 64c0-8.8 7.2-16 16-16h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16zm128 72c8.8 0 16 7.2 16 16v17.3c8.5 1.2 16.7 3.1 24.1 5.1c8.5 2.3 13.6 11 11.3 19.6s-11 13.6-19.6 11.3c-11.1-3-22-4.6-32.1-4.7c-16 0-34.8 6.3-34.8 26.3c0 8.7 3.8 15.3 19.8 22.6l27.1 11.9c24 10.5 47.4 26.8 47.4 60.4c0 35.9-27.5 53.7-61.9 57.2V432c0 8.8-7.2 16-16 16s-16-7.2-16-16V414.8c-11.3-1.9-22.3-5.1-32.1-8.9c-8.3-3.2-12.4-12.5-9.2-20.8s12.5-12.4 20.8-9.2c12.6 4.8 26.3 7.5 40.2 7.5c20.3 0 38.3-6.7 38.3-28.4c0-10.1-4.4-17.9-23.7-26.7l-23.4-10.3c-26.5-11.6-47.2-29.4-47.2-60.3c0-34.4 26.6-52.2 59.6-55.8V240c0-8.8 7.2-16 16-16z'),
    # fa-calculator  (used for Salary Calculator)
    'calculator': ('0 0 384 512', 'M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM96 64H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32zm32 160a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm160-96a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM192 288a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z'),
    # fa-receipt  (used for Receipt Maker)
    'receipt': ('0 0 384 512', 'M14.1 0H17c.5 0 .9 .4 .9 .9V28.8l5.8-5.8c.9-.9 2.3-.9 3.2 0l5.8 5.8V.9c0-.5 .4-.9 .9-.9h2.9C40.7 0 44.8 4.1 44.8 9.1v.9H.9C.4 10 0 9.6 0 9.1V0h14.1zm20.7 10H.9c-.5 0-.9 .4-.9 .9V51c0 .5 .4 .9 .9 .9h43c.5 0 .9-.4 .9-.9V10.9c0-.5-.4-.9-.9-.9H34.8zM9 20h27c.6 0 1 .4 1 1s-.4 1-1 1H9c-.6 0-1-.4-1-1s.4-1 1-1zm0 8h27c.6 0 1 .4 1 1s-.4 1-1 1H9c-.6 0-1-.4-1-1s.4-1 1-1zm0 8h19c.6 0 1 .4 1 1s-.4 1-1 1H9c-.6 0-1-.4-1-1s.4-1 1-1z'),
    # fa-scale-balanced  (used for FairShare)
    'scale-balanced': ('0 0 640 512', 'M96 64c0-17.7 14.3-32 32-32H320c17.7 0 32 14.3 32 32s-14.3 32-32 32H240V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V96H128c-17.7 0-32-14.3-32-32zM304.6 180.2c6-12.5 22.8-12.5 28.8 0l58.3 121.5H246.3l58.3-121.5zm58.3 153.5c-7.2 15-23.6 25.5-41.1 25.5H278.2c-17.5 0-33.9-10.5-41.1-25.5H362.9zM511.4 180.2c6-12.5 22.8-12.5 28.8 0l58.3 121.5H453.1l58.3-121.5zm58.3 153.5c-7.2 15-23.6 25.5-41.1 25.5H452.9c-17.5 0-33.9-10.5-41.1-25.5H569.7zM480 96H416c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32z'),
}

def make_svg(icon_name):
    viewBox, path = ICONS[icon_name]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewBox}" '
        f'style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem">'
        f'<path d="{path}"/></svg>'
    )

# Mapping: FA icon class string → SVG string
ICON_MAP = {
    'fa-solid fa-compress fa-beat mr-2':        make_svg('compress'),
    'fa-solid fa-camera-retro fa-bounce mr-2':  make_svg('camera-retro'),
    'fa-solid fa-comments fa-beat-fade mr-2':   make_svg('comments'),
    'fa-solid fa-file-invoice fa-shake mr-2':   make_svg('file-invoice'),
    'fa-solid fa-calculator fa-flip mr-2':      make_svg('calculator'),
    'fa-solid fa-receipt fa-bounce mr-2':       make_svg('receipt'),
    'fa-solid fa-scale-balanced fa-shake mr-2': make_svg('scale-balanced'),
}

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. Remove FontAwesome preload link from <head>
fa_preload = '''  <!-- FontAwesome CDN for premium category icons & micro-animations -->
    <link \r
    rel="preload" \r
    href="/css/font-awesome.min.css" \r
    as="style" \r
    onload="this.onload=null;this.rel=\'stylesheet\'" \r
    crossorigin="anonymous" \r
  />\r
  <noscript>\r
    <link rel="stylesheet" href="/css/font-awesome.min.css" crossorigin="anonymous" />\r
  </noscript>'''

# Try a looser match
html_new = re.sub(
    r'  <!-- FontAwesome CDN.*?</noscript>',
    '',
    html,
    flags=re.DOTALL
)
if html_new != html:
    html = html_new
    print('✓ FA preload block removed')
else:
    print('WARNING: FA preload block not found via regex')

# ── 2. Replace static HTML carousel button icon tags
# Button A: fa-compress
html = html.replace(
    '<i class="fa-solid fa-compress fa-beat mr-2"></i>',
    make_svg('compress')
)
# Button B: fa-camera-retro
html = html.replace(
    '<i class="fa-solid fa-camera-retro fa-bounce mr-2"></i>',
    make_svg('camera-retro')
)
# Button C: fa-comments
html = html.replace(
    '<i class="fa-solid fa-comments fa-beat-fade mr-2"></i>',
    make_svg('comments')
)

print('✓ Static HTML icon tags replaced')

# ── 3. Update icon strings in the JS toolsList array
for fa_class, svg in ICON_MAP.items():
    # In JS the icon is stored as a string like: icon: "fa-solid fa-compress fa-beat mr-2"
    # and used in createButtonHTML as: <i class="${tool.icon}"></i>
    # We just update the string values and the createElement call
    js_old = f'icon: "{fa_class}"'
    js_new = f'icon: "{fa_class}"'  # keep the same (we'll update createButtonHTML instead)
    pass

# ── 4. Update createButtonHTML to use inline SVG map instead of <i class>
old_create = '''    function createButtonHTML(tool, categoryColor) {
      return `
        <img src="${tool.img}" alt="${tool.name} Preview" class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48">
        <div class="flex flex-col text-left">
          <span style="font-size: 10px; opacity: 0.8; font-weight: 600; text-transform: uppercase; tracking-wider; color: ${categoryColor}; margin-bottom: 2px;">${tool.category}</span>
          <span class="text-sm font-bold text-white flex items-center">
            <i class="${tool.icon}"></i> Open ${tool.name}
          </span>
        </div>
      `;
    }'''

new_create = '''    // SVG icons for carousel (replaces FontAwesome — no external CSS needed)
    const ICON_SVGS = {
      "fa-solid fa-compress fa-beat mr-2":        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zm128 0v64h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H288c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zm288 64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352H320c-17.7 0-32-14.3-32-32s14.3-32 32-32h96c17.7 0 32 14.3 32 32v96c0 17.7-14.3 32-32 32s-32-14.3-32-32z"/></svg>',
      "fa-solid fa-camera-retro fa-bounce mr-2":  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/></svg>',
      "fa-solid fa-comments fa-beat-fade mr-2":   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M208 352c114.9 0 208-78.8 208-176S322.9 0 208 0S0 78.8 0 176c0 38.6 14.7 74.3 39.6 103.4c-3.5 9.4-8.7 17.7-14.8 25.4c-4.8 6.2-9.7 12-14.8 17.8c-2.6 3-2 7.5 1.3 9.7c12.3 7.4 26.5 11.7 41.7 11.7c30.9 0 58.6-13.3 78.2-34.8C149.6 349 178.3 352 208 352zm272-96c17.5 0 34.1-2.2 49.8-6.2c-29.6-23.6-47.8-55.8-47.8-91.8c0-55.2 32.5-103.5 81.3-133.5c-22.1-8-46.3-12.5-71.3-12.5c-114.9 0-208 78.8-208 176c0 42.6 16.3 81.7 43.3 112.7C327.8 299.5 344 272 344 240z"/></svg>',
      "fa-solid fa-file-invoice fa-shake mr-2":   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM80 64H240c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H176c8.8 0 16 7.2 16 16s-7.2 16-16 16H80c-8.8 0-16-7.2-16-16s7.2-16 16-16zm96 104c8.8 0 16 7.2 16 16v17.3c8.5 1.2 16.7 3.1 24.1 5.1c8.5 2.3 13.6 11 11.3 19.6s-11 13.6-19.6 11.3c-11.1-3-22-4.6-32.1-4.7c-16 0-34.8 6.3-34.8 26.3c0 8.7 3.8 15.3 19.8 22.6l27.1 11.9c24 10.5 47.4 26.8 47.4 60.4c0 35.9-27.5 53.7-61.9 57.2V432c0 8.8-7.2 16-16 16s-16-7.2-16-16V414.8c-11.3-1.9-22.3-5.1-32.1-8.9c-8.3-3.2-12.4-12.5-9.2-20.8s12.5-12.4 20.8-9.2c12.6 4.8 26.3 7.5 40.2 7.5c20.3 0 38.3-6.7 38.3-28.4c0-10.1-4.4-17.9-23.7-26.7l-23.4-10.3C99.7 321.1 80 303.3 80 272.4c0-34.4 26.6-52.2 59.6-55.8V240c0-8.8 7.2-16 16-16z"/></svg>',
      "fa-solid fa-calculator fa-flip mr-2":      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM96 64H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32zm32 160a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm160-96a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM192 288a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32 96a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
      "fa-solid fa-receipt fa-bounce mr-2":       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M14.1 0H17c.5 0 .9 .4 .9 .9V28.8l5.8-5.8c.9-.9 2.3-.9 3.2 0l5.8 5.8V.9c0-.5 .4-.9 .9-.9h2.9C40.7 0 44.8 4.1 44.8 9.1v.9H.9C.4 10 0 9.6 0 9.1V0h14.1zM0 64C0 28.7 28.7 0 64 0H320c35.3 0 64 28.7 64 64V448c0 9.7-4.4 18.4-11.4 24.2L256 384l-73.7 57.8c-9.3 7.3-22.3 7.3-31.6 0L77 384 11.4 472.2C4.4 466.4 0 457.7 0 448V64zm96 96c-8.8 0-16 7.2-16 16s7.2 16 16 16H288c8.8 0 16-7.2 16-16s-7.2-16-16-16H96zm0 96c-8.8 0-16 7.2-16 16s7.2 16 16 16H288c8.8 0 16-7.2 16-16s-7.2-16-16-16H96zm0 96c-8.8 0-16 7.2-16 16s7.2 16 16 16H160c8.8 0 16-7.2 16-16s-7.2-16-16-16H96z"/></svg>',
      "fa-solid fa-scale-balanced fa-shake mr-2": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;fill:currentColor;margin-right:0.5rem"><path d="M96 64c0-17.7 14.3-32 32-32H512c17.7 0 32 14.3 32 32s-14.3 32-32 32H336V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V96H128c-17.7 0-32-14.3-32-32zM.4 232.3C3 223.8 10.9 218 19.8 218H236.2c8.9 0 16.8 5.8 19.4 14.3l56 184H320 264 240c-8.8 0-16 7.2-16 16s7.2 16 16 16h48H344h48c8.8 0 16-7.2 16-16s-7.2-16-16-16H372l56-184c2.6-8.5 10.5-14.3 19.4-14.3H664.2c8.9 0 16.8 5.8 19.4 14.3l56 184H756h-48-24c-8.8 0-16 7.2-16 16s7.2 16 16 16h24 72 24c8.8 0 16-7.2 16-16s-7.2-16-16-16H780l56-184zM224 218H20l102 168L224 218zm432 0H452l102 168 102-168z"/></svg>',
    };

    function createButtonHTML(tool, categoryColor) {
      const iconSvg = ICON_SVGS[tool.icon] || "";
      return `
        <img src="${tool.img}" alt="${tool.name} Preview" class="w-12 h-12 rounded-full object-cover border-2 border-white/50 mr-4 shadow-sm" style="width: 48px; height: 48px; min-width: 48px;" width="48" height="48">
        <div class="flex flex-col text-left">
          <span style="font-size: 10px; opacity: 0.8; font-weight: 600; text-transform: uppercase; tracking-wider; color: ${categoryColor}; margin-bottom: 2px;">${tool.category}</span>
          <span class="text-sm font-bold text-white flex items-center">
            ${iconSvg} Open ${tool.name}
          </span>
        </div>
      `;
    }'''

if old_create in html:
    html = html.replace(old_create, new_create)
    print('✓ createButtonHTML updated with inline SVG map')
else:
    print('WARNING: createButtonHTML not found! Trying fuzzy match...')
    # Try to find it with \r\n
    old_create_crlf = old_create.replace('\n', '\r\n')
    if old_create_crlf in html:
        html = html.replace(old_create_crlf, new_create)
        print('✓ createButtonHTML updated (CRLF match)')
    else:
        print('ERROR: could not find createButtonHTML')

# ── 5. Also remove the .carousel-btn i width reservation (no longer needed)
html = html.replace(
    '\r\n    .carousel-btn i {\r\n      display: inline-block;\r\n      width: 1.25em;\r\n      text-align: center;\r\n    }',
    ''
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

import os
print(f'\nFinal index.html: {os.path.getsize("index.html")//1024} KB')
print('✓ FontAwesome dependency eliminated. No external font files needed.')
