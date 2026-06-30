import re

MARKDOWN_SYNTAX_RE = re.compile(r"[#>*_`~\[\]()!|]")
WHITESPACE_RE = re.compile(r"\s+")
WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9+#.-]{1,}|[\u4e00-\u9fff]{2,}")

TAG_RULES: dict[str, str] = {
    "python": "Python",
    "fastapi": "FastAPI",
    "sqlmodel": "SQLModel",
    "next": "Next.js",
    "next.js": "Next.js",
    "react": "React",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "tailwind": "Tailwind",
    "markdown": "Markdown",
    "md": "Markdown",
    "后端": "后端",
    "前端": "前端",
    "数据库": "数据库",
    "部署": "部署",
    "接口": "API",
    "api": "API",
    "博客": "博客",
    "标签": "标签",
    "搜索": "搜索",
    "教程": "教程",
    "指南": "指南",
}

STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "文章",
    "一个",
    "我们",
    "可以",
    "进行",
    "使用",
}


def markdown_to_plain_text(markdown: str) -> str:
    plain = MARKDOWN_SYNTAX_RE.sub(" ", markdown)
    plain = re.sub(r"https?://\S+", " ", plain)
    return WHITESPACE_RE.sub(" ", plain).strip()


def build_summary(markdown: str, limit: int = 180) -> str:
    plain = markdown_to_plain_text(markdown)
    if len(plain) <= limit:
        return plain
    return f"{plain[:limit].rstrip()}..."


def find_keyword_matches(text: str, keywords: list[str]) -> list[str]:
    lowered = text.lower()
    matches: list[str] = []

    for raw_keyword in keywords:
        keyword = raw_keyword.strip()
        if not keyword:
            continue
        if keyword.lower() in lowered and keyword not in matches:
            matches.append(keyword)

    return matches


def generate_tags(title: str, content: str, keyword_matches: list[str], limit: int = 8) -> list[str]:
    text = f"{title}\n{content}"
    lowered = text.lower()
    tags: list[str] = []

    def add_tag(tag: str) -> None:
        cleaned = tag.strip().strip("#,，.。:：;；")
        if cleaned and cleaned not in tags:
            tags.append(cleaned)

    for keyword, tag in TAG_RULES.items():
        if keyword in lowered:
            add_tag(tag)

    for keyword in keyword_matches:
        add_tag(keyword)

    for word in WORD_RE.findall(markdown_to_plain_text(text)):
        normalized = word.lower()
        if normalized in STOP_WORDS:
            continue
        if len(word) > 18:
            continue
        add_tag(TAG_RULES.get(normalized, word))
        if len(tags) >= limit:
            break

    return tags[:limit] or ["随笔"]
