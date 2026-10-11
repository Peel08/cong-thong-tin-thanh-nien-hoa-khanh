from PIL import Image, ImageFilter
import numpy as np
from collections import deque

def clean_transparent_logo(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    arr = np.array(img)
    h, w, _ = arr.shape
    r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)

    # 1. Non-white
    is_bg_white = (r > 240) & (g > 240) & (b > 240)
    emblem_pixels = ~is_bg_white

    # 2. Dilate to bridge gaps in green circle boundary
    mask_img = Image.fromarray((emblem_pixels * 255).astype(np.uint8), mode='L')
    dilated = mask_img.filter(ImageFilter.MaxFilter(9))
    dil_arr = np.array(dilated)

    # 3. BFS flood fill exterior only
    exterior = np.zeros((h, w), dtype=bool)
    q = deque()
    for y in range(h):
        for x in [0, w-1]:
            if dil_arr[y, x] == 0 and not exterior[y, x]:
                exterior[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in [0, h-1]:
            if dil_arr[y, x] == 0 and not exterior[y, x]:
                exterior[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1,0), (1,0), (0,-1), (0,1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not exterior[ny, nx]:
                if dil_arr[ny, nx] == 0:
                    exterior[ny, nx] = True
                    q.append((ny, nx))

    # 4. Fill interior solid & erode back
    interior_img = Image.fromarray(((~exterior) * 255).astype(np.uint8), mode='L')
    eroded_interior = interior_img.filter(ImageFilter.MinFilter(11))

    # 5. Smooth boundary
    edge_smooth = eroded_interior.filter(ImageFilter.GaussianBlur(0.7))
    final_alpha = np.array(edge_smooth)

    clean_rgb = arr[:,:,:3].copy()
    arr_out = np.dstack([clean_rgb, final_alpha])
    res = Image.fromarray(arr_out)
    res.save(output_path, "PNG")
    print(f"Clean logo saved to {output_path}")

if __name__ == "__main__":
    clean_transparent_logo("images.png", "logo.png")
    clean_transparent_logo("images.png", "assets/images/logo.png")
