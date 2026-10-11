import numpy as np
from PIL import Image, ImageFilter
from collections import deque

def clean_transparent_logo(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    arr = np.array(img, dtype=np.float32)

    # Detect white/near-white pixels
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    # Background in images.png is > 240
    is_white = (r > 238) & (g > 238) & (b > 238)

    visited = np.zeros((height, width), dtype=bool)
    exterior_bg = np.zeros((height, width), dtype=bool)

    queue = deque()
    # Edges
    for y in [0, height - 1]:
        for x in range(width):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                exterior_bg[y, x] = True
                queue.append((y, x))

    for x in [0, width - 1]:
        for y in range(height):
            if is_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                exterior_bg[y, x] = True
                queue.append((y, x))

    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < height and 0 <= nx < width and not visited[ny, nx]:
                if is_white[ny, nx]:
                    visited[ny, nx] = True
                    exterior_bg[ny, nx] = True
                    queue.append((ny, nx))

    # Mask: 255 for foreground, 0 for exterior_bg
    mask_arr = np.where(exterior_bg, 0, 255).astype(np.uint8)
    mask_img = Image.fromarray(mask_arr, mode="L")
    
    # Slight antialiasing at the boundary
    # Dilate mask slightly and feather
    dilated = mask_img.filter(ImageFilter.MaxFilter(3))
    eroded = mask_img.filter(ImageFilter.MinFilter(3))
    
    # Final alpha: exact 0 outside, feathered on the 1-pixel border
    final_alpha = np.array(mask_img, dtype=np.float32)
    dil_arr = np.array(dilated)
    ero_arr = np.array(eroded)
    
    border_pixels = (dil_arr > 0) & (ero_arr < 255)
    for y, x in zip(*np.where(border_pixels)):
        brightness = (r[y, x] + g[y, x] + b[y, x]) / 3.0
        if brightness > 220:
            final_alpha[y, x] = max(0.0, min(255.0, (255.0 - brightness) / 35.0 * 255.0))

    final_alpha[exterior_bg] = 0

    arr_out = np.array(img)
    arr_out[:, :, 3] = final_alpha.astype(np.uint8)

    res = Image.fromarray(arr_out)
    res.save(output_path, "PNG")
    print(f"Clean transparent logo saved to {output_path}")

if __name__ == "__main__":
    clean_transparent_logo("images.png", "logo.png")
    clean_transparent_logo("images.png", "assets/images/logo.png")
