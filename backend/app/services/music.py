from functools import lru_cache
from typing import Any

import requests

NETEASE_BASE = "https://music.163.com"

HEADERS = {
    "Referer": "https://music.163.com/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


@lru_cache(maxsize=128)
def _album_cover(album_id: int) -> str:
    try:
        resp = requests.get(
            f"{NETEASE_BASE}/api/album/{album_id}",
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get("album", {})
        return data.get("picUrl") or data.get("blurPicUrl") or ""
    except Exception:
        return ""


def search_songs(keyword: str, limit: int = 10, offset: int = 0) -> list[dict[str, Any]]:
    resp = requests.get(
        f"{NETEASE_BASE}/api/search/get",
        params={"s": keyword, "type": 1, "limit": limit, "offset": offset},
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    result = resp.json()
    songs = result.get("result", {}).get("songs", [])

    enriched: list[dict[str, Any]] = []
    for s in songs:
        album = s.get("album", {})
        album_id = album.get("id", 0)
        pic_url = _album_cover(album_id) if album_id else ""
        if not pic_url:
            artists = s.get("artists", [])
            if artists:
                pic_url = artists[0].get("img1v1Url", "")
        enriched.append({
            "id": s["id"],
            "name": s["name"],
            "artists": [{"name": a["name"]} for a in s.get("artists", [])],
            "album": {
                "id": album_id,
                "name": album.get("name", ""),
                "picUrl": pic_url,
            },
            "duration": s.get("duration", 0),
        })
    return enriched


def get_song_url(song_id: int) -> str | None:
    resp = requests.get(
        f"{NETEASE_BASE}/api/song/enhance/player/url",
        params={"id": song_id, "ids": f"[{song_id}]", "br": 128000},
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    result = resp.json()
    data_list: list[dict[str, Any]] = result.get("data", [])
    if not data_list:
        return None
    song = data_list[0]
    return song.get("url") or None


def get_lyric(song_id: int) -> dict[str, str]:
    resp = requests.get(
        f"{NETEASE_BASE}/api/song/lyric",
        params={"id": str(song_id), "lv": 1},
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    result = resp.json()
    lrc = result.get("lrc", {}) if isinstance(result.get("lrc"), dict) else {}
    tlyric = result.get("tlyric", {}) if isinstance(result.get("tlyric"), dict) else {}
    return {
        "lyric": lrc.get("lyric", ""),
        "tlyric": tlyric.get("lyric", ""),
    }
