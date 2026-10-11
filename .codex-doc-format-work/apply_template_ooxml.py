from pathlib import Path
import shutil
import tempfile
import zipfile

from lxml import etree


SOURCE = Path('/Users/skyler/Python Project/BlogSystem/软件综合实践报告_个人博客系统.docx')
OUTPUT = Path('/Users/skyler/Python Project/BlogSystem/软件综合实践报告_个人博客系统_按模板格式.docx')

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}


def qn(tag):
    return f'{{{W}}}{tag}'


def child(parent, tag, first=False):
    found = parent.find(qn(tag))
    if found is None:
        found = etree.Element(qn(tag))
        if first:
            parent.insert(0, found)
        else:
            parent.append(found)
    return found


def set_attr(el, name, value):
    el.set(qn(name), str(value))


def ensure_ppr(p):
    ppr = p.find(qn('pPr'))
    if ppr is None:
        ppr = etree.Element(qn('pPr'))
        p.insert(0, ppr)
    return ppr


def ensure_rpr(r):
    rpr = r.find(qn('rPr'))
    if rpr is None:
        rpr = etree.Element(qn('rPr'))
        r.insert(0, rpr)
    return rpr


def set_run_font(r, name, half_points, bold=None):
    rpr = ensure_rpr(r)
    fonts = child(rpr, 'rFonts', first=True)
    for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        set_attr(fonts, attr, name)
    for tag in ('sz', 'szCs'):
        set_attr(child(rpr, tag), 'val', half_points)
    set_attr(child(rpr, 'color'), 'val', '000000')
    if bold is not None:
        for tag in ('b', 'bCs'):
            set_attr(child(rpr, tag), 'val', '1' if bold else '0')


def set_style_font(style, name, half_points, bold=None):
    rpr = child(style, 'rPr')
    fonts = child(rpr, 'rFonts', first=True)
    for attr in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        set_attr(fonts, attr, name)
    for tag in ('sz', 'szCs'):
        set_attr(child(rpr, tag), 'val', half_points)
    set_attr(child(rpr, 'color'), 'val', '000000')
    if bold is not None:
        for tag in ('b', 'bCs'):
            set_attr(child(rpr, tag), 'val', '1' if bold else '0')


def set_spacing(ppr, before, after, line, rule='exact'):
    spacing = child(ppr, 'spacing')
    set_attr(spacing, 'before', before)
    set_attr(spacing, 'after', after)
    set_attr(spacing, 'line', line)
    set_attr(spacing, 'lineRule', rule)


def set_ind(ppr, first_line=None, left=None, right=None):
    ind = child(ppr, 'ind')
    for stale in ('firstLineChars', 'hanging', 'hangingChars'):
        ind.attrib.pop(qn(stale), None)
    if first_line is not None:
        set_attr(ind, 'firstLine', first_line)
    if left is not None:
        set_attr(ind, 'left', left)
    if right is not None:
        set_attr(ind, 'right', right)


def set_jc(ppr, value):
    set_attr(child(ppr, 'jc'), 'val', value)


def style_maps(styles_root):
    by_id = {}
    by_name = {}
    for style in styles_root.findall('w:style', NS):
        sid = style.get(qn('styleId'))
        name_el = style.find('w:name', NS)
        name = name_el.get(qn('val')) if name_el is not None else sid
        by_id[sid] = (name, style)
        by_name[name] = (sid, style)
    return by_id, by_name


with zipfile.ZipFile(SOURCE, 'r') as zin:
    infos = zin.infolist()
    blobs = {info.filename: zin.read(info.filename) for info in infos}

styles_root = etree.fromstring(blobs['word/styles.xml'])
doc_root = etree.fromstring(blobs['word/document.xml'])
settings_root = etree.fromstring(blobs['word/settings.xml'])
by_id, by_name = style_maps(styles_root)

specs = {
    'Report Normal': ('宋体', 24, None),
    'Report heading 1': ('黑体', 32, False),
    'Report heading 2': ('黑体', 28, False),
    'Report List Bullet': ('宋体', 24, None),
    'Report List Number': ('宋体', 24, None),
    'Report caption': ('宋体', 21, False),
    'toc 1': ('宋体', 24, None),
    'toc 2': ('宋体', 24, None),
}
for display_name, (font, size, bold) in specs.items():
    if display_name in by_name:
        _, style = by_name[display_name]
        set_style_font(style, font, size, bold)

all_tables = doc_root.findall('.//w:tbl', NS)
table_index = {id(tbl): idx for idx, tbl in enumerate(all_tables)}

for p in doc_root.findall('.//w:p', NS):
    ppr = ensure_ppr(p)
    pstyle = ppr.find(qn('pStyle'))
    sid = pstyle.get(qn('val')) if pstyle is not None else None
    display_name = by_id.get(sid, (None, None))[0]
    text_value = ''.join(p.itertext()).replace(' ', '').replace('\u3000', '')
    runs = p.findall('.//w:r', NS)

    # Image/object carrier paragraphs use their own geometry. Applying the
    # reference's exact 20 pt line height here would clip VML pictures.
    if p.find('.//w:pict', NS) is not None or p.find('.//w:drawing', NS) is not None or p.find('.//w:object', NS) is not None:
        continue

    # Determine whether this paragraph belongs to a non-cover table.
    table_ancestor = None
    ancestor = p.getparent()
    while ancestor is not None:
        if ancestor.tag == qn('tbl'):
            table_ancestor = ancestor
            break
        ancestor = ancestor.getparent()
    if table_ancestor is not None and table_index[id(table_ancestor)] > 0:
        set_ind(ppr, first_line=0)
        set_spacing(ppr, 0, 0, 320)
        for r in runs:
            set_run_font(r, '宋体', 21)
        continue

    if display_name == 'Report heading 1':
        set_jc(ppr, 'left')
        set_ind(ppr, first_line=0, left=0, right=0)
        set_spacing(ppr, 120, 120, 400)
        child(ppr, 'keepNext')
        for r in runs:
            set_run_font(r, '黑体', 32, False)
    elif display_name == 'Report heading 2':
        set_jc(ppr, 'left')
        set_ind(ppr, first_line=0, left=0, right=0)
        set_spacing(ppr, 120, 120, 400)
        child(ppr, 'keepNext')
        for r in runs:
            set_run_font(r, '黑体', 28, False)
    elif display_name == 'Report Normal':
        if text_value == '目录':
            set_jc(ppr, 'center')
            set_ind(ppr, first_line=0)
            set_spacing(ppr, 0, 0, 400)
            for r in runs:
                set_run_font(r, '黑体', 48, False)
        else:
            is_reference = text_value.startswith('[') and len(text_value) > 2 and text_value[1].isdigit()
            set_jc(ppr, 'left' if is_reference else 'both')
            set_ind(ppr, first_line=0 if is_reference else 420, left=0, right=0)
            set_spacing(ppr, 0, 0, 400)
            for r in runs:
                set_run_font(r, '宋体', 24)
    elif display_name in ('Report List Bullet', 'Report List Number'):
        set_spacing(ppr, 0, 0, 400)
        for r in runs:
            set_run_font(r, '宋体', 24)
    elif display_name == 'Report caption':
        set_jc(ppr, 'center')
        set_ind(ppr, first_line=0)
        set_spacing(ppr, 80, 120, 240, 'auto')
        child(ppr, 'keepNext')
        for r in runs:
            set_run_font(r, '宋体', 21, False)
    elif display_name in ('toc 1', 'toc 2'):
        set_spacing(ppr, 0, 0, 400)
        for r in runs:
            set_run_font(r, '宋体', 24)

# A4 and reference margins. The source has two sections: cover, then TOC/body.
for idx, sect in enumerate(doc_root.findall('.//w:sectPr', NS)):
    pgsz = child(sect, 'pgSz')
    set_attr(pgsz, 'w', 11906)
    set_attr(pgsz, 'h', 16838)
    pgmar = child(sect, 'pgMar')
    if idx == 0:
        margins = {'left': 1267, 'right': 922, 'top': 1555, 'bottom': 1440}
    else:
        margins = {'left': 1138, 'right': 1138, 'top': 1411, 'bottom': 1411}
    for key, value in margins.items():
        set_attr(pgmar, key, value)

update = settings_root.find(qn('updateFields'))
if update is None:
    update = etree.Element(qn('updateFields'))
    settings_root.append(update)
set_attr(update, 'val', 'true')

blobs['word/styles.xml'] = etree.tostring(styles_root, xml_declaration=True, encoding='UTF-8', standalone=True)
blobs['word/document.xml'] = etree.tostring(doc_root, xml_declaration=True, encoding='UTF-8', standalone=True)
blobs['word/settings.xml'] = etree.tostring(settings_root, xml_declaration=True, encoding='UTF-8', standalone=True)

with zipfile.ZipFile(OUTPUT, 'w') as zout:
    for info in infos:
        zout.writestr(info, blobs[info.filename])

print(OUTPUT)
