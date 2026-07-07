from fastapi import APIRouter, HTTPException, Query

from app.services.music import get_lyric, get_song_url, search_songs

router = APIRouter()


@router.get("/music/search")
async def search(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(10, ge=1, le=30, description="返回结果数量"),
) -> dict:
    try:
        songs = search_songs(keyword, limit=limit)
        return {"songs": songs}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"音乐搜索失败：{exc}") from exc


@router.get("/music/song")
async def song_url(
    id: int = Query(..., description="歌曲ID"),
) -> dict:
    try:
        url = get_song_url(id)
        if url is None:
            raise HTTPException(status_code=404, detail="无法获取播放地址")
        return {"id": id, "url": url}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取播放地址失败：{exc}") from exc


@router.get("/music/lyric")
async def lyric(
    id: int = Query(..., description="歌曲ID"),
) -> dict:
    try:
        result = get_lyric(id)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取歌词失败：{exc}") from exc
