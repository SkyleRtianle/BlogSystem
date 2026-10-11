from hashlib import sha256
from pathlib import Path
import zipfile

source = Path('/Users/skyler/Python Project/BlogSystem/软件综合实践报告_个人博客系统.docx')
final = Path('/Users/skyler/Python Project/BlogSystem/软件综合实践报告_个人博客系统_按模板格式.docx')
allowed = {'word/document.xml', 'word/styles.xml', 'word/settings.xml'}

with zipfile.ZipFile(source) as a, zipfile.ZipFile(final) as b:
    names_a, names_b = set(a.namelist()), set(b.namelist())
    print('parts_source', len(names_a), 'parts_final', len(names_b), 'same_names', names_a == names_b)
    changed = []
    for name in sorted(names_a | names_b):
        if name not in names_a or name not in names_b:
            changed.append(name)
        elif sha256(a.read(name)).digest() != sha256(b.read(name)).digest():
            changed.append(name)
    print('changed_parts', changed)
    unexpected = [name for name in changed if name not in allowed]
    print('unexpected_changes', unexpected)
    print('media_parts', len([n for n in names_a if n.startswith('word/media/')]))
    print('embedding_parts', len([n for n in names_a if n.startswith('word/embeddings/')]))
    print('altchunk_parts', len([n for n in names_a if 'afchunk' in n.lower() or 'altchunk' in n.lower()]))

