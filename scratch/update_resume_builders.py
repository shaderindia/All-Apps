import os

root_dir = r"C:\Users\POWERHOUSE\Desktop\All-Apps\cvbanao"
sponsor_link = "https://emotionallytonightintelligent.com/x8fvr0fu?key=a0df723f661db51d2b97818a0f27ea09"

target_files = []
for root, dirs, files in os.walk(root_dir):
    for f in files:
        if f.lower() == 'index.html' and 'template' in root:
            target_files.append(os.path.join(root, f))

print(f"Found templates: {target_files}")

modified_count = 0

for fpath in target_files:
    rel_path = os.path.relpath(fpath, root_dir)
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Check if downloadPDF is in content
    if 'async function downloadPDF()' in content:
        # Check if it already has the window.open redirect to prevent duplicate inserts
        if sponsor_link in content:
            print(f"[SKIP] Already updated: {rel_path}")
            continue

        # Inject the redirect window.open inside the function opening
        new_func_head = f'async function downloadPDF() {{\n      window.open("{sponsor_link}", "_blank");'
        content = content.replace('async function downloadPDF() {', new_func_head)
        
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[OK] Modified: {rel_path}")
        modified_count += 1
    else:
        print(f"[!] Warning: downloadPDF not found in {rel_path}")

print(f"\nDone! Updated {modified_count} template index.html files.")
