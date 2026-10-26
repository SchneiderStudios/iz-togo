"""Иконка приложения: тарелка с ростком на зелёном фоне. Рисуется в 4x и уменьшается."""
from PIL import Image, ImageDraw
import pathlib

GREEN = (43, 111, 72); CREAM = (247, 249, 246); LEAF = (143, 208, 165); AMBER = (226, 180, 94)

def mark(size, bg=True, pad=0.0):
    S = size * 4
    im = Image.new("RGBA", (S, S), GREEN + (255,) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S / 2; r = S * (0.30 - pad)
    # тарелка
    d.ellipse([c - r, c - r * 0.55 + S * 0.08, c + r, c + r * 0.55 + S * 0.08], fill=CREAM)
    d.ellipse([c - r * 0.68, c - r * 0.36 + S * 0.08, c + r * 0.68, c + r * 0.36 + S * 0.08], fill=(226, 238, 229))
    # росток
    sw = int(S * 0.022)
    d.line([c, c + S * 0.07, c, c - S * 0.12], fill=CREAM, width=sw)
    d.ellipse([c - S * 0.16, c - S * 0.20, c - S * 0.005, c - S * 0.10], fill=LEAF)
    d.ellipse([c + S * 0.005, c - S * 0.26, c + S * 0.17, c - S * 0.15], fill=LEAF)
    # капля «ещё не испортилось» — тёплая точка
    d.ellipse([c + r * 0.52, c + S * 0.02, c + r * 0.52 + S * 0.06, c + S * 0.08], fill=AMBER)
    return im.resize((size, size), Image.LANCZOS)

root = pathlib.Path(__file__).parent
icons = root / "www" / "icons"; icons.mkdir(parents=True, exist_ok=True)
for s in (180, 192, 512):
    mark(s).save(icons / f"icon-{s}.png")
# маскируемая (с запасом по краям)
m = Image.new("RGBA", (512, 512), GREEN + (255,)); m.alpha_composite(mark(512, bg=False, pad=0.04)); m.save(icons / "icon-maskable-512.png")
mark(1024).convert("RGB").save(root / "resources" / "icon-1024.png") if (root / "resources").exists() else None

# Android
res = root / "android" / "app" / "src" / "main" / "res"
if res.exists():
    for name, px, fg in (("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)):
        dd = res / f"mipmap-{name}"; dd.mkdir(exist_ok=True)
        mark(px).save(dd / "ic_launcher.png")
        rnd = mark(px); mask = Image.new("L", (px, px), 0); ImageDraw.Draw(mask).ellipse([0, 0, px - 1, px - 1], fill=255); rnd.putalpha(mask); rnd.save(dd / "ic_launcher_round.png")
        f = Image.new("RGBA", (fg, fg), (0, 0, 0, 0)); inner = mark(int(fg * 0.62), bg=False); f.alpha_composite(inner, ((fg - inner.width) // 2, (fg - inner.height) // 2)); f.save(dd / "ic_launcher_foreground.png")
    vals = res / "values" / "ic_launcher_background.xml"
    vals.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2B6F48</color>\n</resources>\n', encoding="utf-8")
print("icons ok")
