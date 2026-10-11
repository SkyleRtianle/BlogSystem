# Formatting contract

- Reference source: `/Users/skyler/Desktop/人工智能导论/软件综合实践报告模板.doc`, SHA-256 `b2ddbf60b667f77c52af42f293a96b62fde0cd4e8759e938d407743980ea8814`.
- Faithful Word conversion used for inspection only: `/Users/skyler/Python Project/BlogSystem/.codex-doc-format-work/模板转换.docx`, SHA-256 `055d1eca6f9bd935ff9dac784d9916c66237284b35a37ded0d04e5adc30ed75c`, 3 pages, 3 sections.
- Evidence: `template-contact.png`, `template-style.json`, `template-*-audit.txt`, and the section/style dumps in this directory.

## Page system

- A4 portrait throughout.
- Cover section margins: left 0.88 in, right 0.64 in, top 1.08 in, bottom 1.00 in.
- TOC/body sections: left/right 0.79 in, top/bottom 0.98 in.
- Cover, TOC, and body begin on new pages; the reference has a final continuous section used for body/footer behavior.
- Preserve the report's existing headers, footers, PAGE fields, TOC field, images, diagrams, tables, relationships, and content order.

## Typography and rhythm

- Cover: retain the report's existing cover because it is already copied from the reference (24 pt bold centered report title, 15 pt bold labels, 16 pt bold centered school name, reference table and spacing).
- TOC title: 黑体 24 pt, regular, centered.
- TOC entries: 宋体 12 pt, exact 20 pt line spacing, no extra paragraph spacing; preserve level indentation and dot leaders.
- Level-1 body headings: 黑体 16 pt, regular, exact 20 pt line spacing, 6 pt before/after, keep with next.
- Level-2 body headings: reference-derived subordinate hierarchy, 黑体 14 pt, regular, exact 20 pt line spacing, 6 pt before/after, keep with next.
- Body: 宋体 12 pt, justified, 0.74 cm first-line indent, exact 20 pt line spacing, no paragraph space before/after.
- Lists: 宋体 12 pt, exact 20 pt line spacing, no extra paragraph spacing; preserve real numbering/bullets and their current hanging indents.
- Captions: 宋体 10.5 pt, centered, single line spacing, 4 pt before and 6 pt after; kept with the following visual where applicable.
- Tables/code blocks: 宋体 10.5 pt to preserve legibility and fit; headers retain bold/centering and existing fills/borders; body alignment and cell geometry remain unchanged.

## Slots and scope

- Editable: document styles, direct run font properties, paragraph spacing/alignment/indentation, and section margins needed to match the reference.
- Preserve-only: all text content; cover graphic elements; TOC and PAGE field instructions; all images, diagrams, table structures/widths/fills/borders; headers/footers; numbering definitions; bookmarks; relationships; and embedded binary parts.
- No content controls, footnotes, or endnotes are present. The report contains one TOC field and three PAGE fields; set `w:updateFields=true` so Word refreshes cached values when opened.

## Fidelity gates

- Original `.doc` template and source report remain byte-for-byte unchanged.
- Final is A4 and retains the cover plus all original content/visuals.
- No clipped text, table overflow, unexpected blank pages, broken images, altered headers/footers, or unintended field loss.
- Final output is rendered through Microsoft Word to PDF and every page is visually inspected; cached TOC/page fields may refresh on opening in Word.
