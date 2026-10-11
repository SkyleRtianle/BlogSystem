from pathlib import Path
from PIL import Image, ImageDraw


def build(src, out, cols=3, thumb_w=360):
    paths = sorted(Path(src).glob('*.png'))
    items = []
    for i, path in enumerate(paths, 1):
        im = Image.open(path).convert('RGB')
        h = round(im.height * thumb_w / im.width)
        im = im.resize((thumb_w, h))
        canvas = Image.new('RGB', (thumb_w, h + 28), 'white')
        canvas.paste(im, (0, 28))
        ImageDraw.Draw(canvas).text((8, 7), f'Page {i}', fill='black')
        items.append(canvas)
    rows = (len(items) + cols - 1) // cols
    cell_h = max(im.height for im in items)
    sheet = Image.new('RGB', (cols * thumb_w, rows * cell_h), '#d0d0d0')
    for idx, im in enumerate(items):
        sheet.paste(im, ((idx % cols) * thumb_w, (idx // cols) * cell_h))
    sheet.save(out)


build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/template-png', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/template-contact.png')
build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/report-png', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/report-contact.png')
build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-render-skill', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-contact.png')
build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-png', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-contact.png')
build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-png-2', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-contact-2.png')
build('/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-png-3', '/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/final-word-contact-3.png')
