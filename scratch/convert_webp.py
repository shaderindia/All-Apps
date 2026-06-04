import os
from PIL import Image

app_dir = "C:/Users/POWERHOUSE/.gemini/antigravity/scratch/All-Apps"

# Images to convert and compress
# Format: (relative_src_path, relative_dest_path, target_width, target_height_or_none)
images_to_process = [
    ("cvbanao/banner.png", "cvbanao/banner.webp", None, None),
    ("berofchat/banner.jpg", "berofchat/banner.webp", None, None),
    ("cnc-machinist/banner.jpg", "cnc-machinist/banner.webp", None, None),
    ("photocompressor/banner.jpg", "photocompressor/banner.webp", None, None),
    ("photopassportsizepro/banner.jpg", "photopassportsizepro/banner.webp", None, None),
    ("passport-logo.jpg", "passport-logo.webp", 128, 128)
]

for src_rel, dest_rel, w_limit, h_limit in images_to_process:
    src_path = os.path.join(app_dir, src_rel)
    dest_path = os.path.join(app_dir, dest_rel)
    
    if not os.path.exists(src_path):
        print(f"Source not found: {src_path}")
        continue
        
    try:
        im = Image.open(src_path)
        
        # If transparency exists in PNG, convert to RGBA then save as WebP
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            im = im.convert("RGBA")
        else:
            im = im.convert("RGB")
            
        # Resize if limits are defined
        if w_limit and h_limit:
            im = im.resize((w_limit, h_limit), Image.Resampling.LANCZOS)
            print(f"Resized {src_rel} to {w_limit}x{h_limit}")
            
        # Save as WebP with compression
        im.save(dest_path, "WEBP", quality=80)
        print(f"Saved {dest_rel} (size: {os.path.getsize(dest_path)} bytes)")
    except Exception as e:
        print(f"Error processing {src_rel}: {e}")
