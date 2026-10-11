"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders, ensureAuthorized, getAuthToken } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type Comment = {
  id: number;
  post_id: number;
  parent_id: number | null;
  author: string;
  content: string;
  created_at: string;
};

export default function CommentSection({ postId, isOwner = false }: { postId: number; isOwner?: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null);
  const [replyAuthor, setReplyAuthor] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/public/posts/${postId}/comments`);
      if (!res.ok) throw new Error("评论加载失败");
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "评论加载失败");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/public/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim(), content: content.trim() }),
      });
      if (!res.ok) throw new Error("评论发送失败");
      setAuthor("");
      setContent("");
      await fetchComments();
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    } catch (e) {
      setError(e instanceof Error ? e.message : "评论发送失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: number) => {
    if (!replyAuthor.trim() || !replyContent.trim()) return;
    setReplySubmitting(true);
    setReplyError("");

    try {
      const res = await fetch(`${API_BASE_URL}/public/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: replyAuthor.trim(), content: replyContent.trim(), parent_id: parentId }),
      });
      if (!res.ok) throw new Error("回复发送失败");
      setReplyTo(null);
      setReplyAuthor("");
      setReplyContent("");
      await fetchComments();
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "回复发送失败");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("删除失败");
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  const isReply = (comment: Comment) => comment.parent_id !== null;

  return (
    <aside className="comment-panel">
      <div className="comment-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="comment-card-header">
          <span>评论</span>
          {comments.length > 0 && <span className="comment-count-badge">{comments.length}</span>}
        </div>

        <form className="comment-form" onSubmit={handleSubmit}>
          <div className="comment-form-fields">
            <input className="comment-input" type="text" placeholder="你的昵称" value={author}
              onChange={(e) => setAuthor(e.target.value)} maxLength={60} required />
            <textarea className="comment-input" placeholder="写下你的想法..." value={content}
              onChange={(e) => setContent(e.target.value)} maxLength={1000} rows={3} required style={{ minHeight: 80 }} />
            {error && <p className="comment-error-msg">{error}</p>}
            <button type="submit" className="comment-submit-btn" disabled={submitting}>
              {submitting ? "发送中..." : "发送评论"}
            </button>
          </div>
        </form>

        <div className="comment-list-scroll" ref={listRef}>
          {loading && (
            <div className="comment-loading">
              <span className="comment-loading-spinner" />加载评论...
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="comment-empty">
              <p className="comment-empty-text">还没有评论</p>
              <p className="comment-empty-hint">成为第一个评论的人</p>
            </div>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className={`comment-item ${isReply(comment) ? "comment-reply" : ""}`}>
              <div className="comment-item-author">
                <span className="comment-author-avatar">{comment.author.charAt(0).toUpperCase()}</span>
                <span className="comment-author-name">{comment.author}</span>
                <span className="comment-item-time">{formatCommentTime(comment.created_at)}</span>
                {isOwner && (
                  <button type="button" className="comment-delete-btn" onClick={() => handleDelete(comment.id)}
                    aria-label="删除评论" title="删除">×</button>
                )}
              </div>
              <p className="comment-item-content">
                {isReply(comment) && <span className="comment-reply-to">回复 </span>}
                {comment.content}
              </p>

              {/* Reply button */}
              <button type="button" className="comment-reply-btn"
                onClick={() => setReplyTo(replyTo?.id === comment.id ? null : { id: comment.id, author: comment.author })}>
                {replyTo?.id === comment.id ? "取消回复" : "回复"}
              </button>

              {/* Inline reply form */}
              {replyTo?.id === comment.id && (
                <div className="comment-reply-form">
                  <input className="comment-input" type="text" placeholder="你的昵称" value={replyAuthor}
                    onChange={(e) => setReplyAuthor(e.target.value)} maxLength={60} />
                  <textarea className="comment-input" placeholder={`回复 ${replyTo.author}...`} value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)} maxLength={500} rows={2} style={{ minHeight: 56 }} />
                  {replyError && <p className="comment-error-msg">{replyError}</p>}
                  <button type="button" className="comment-submit-btn" disabled={replySubmitting}
                    onClick={() => handleReply(comment.id)}>
                    {replySubmitting ? "发送中..." : "回复"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
}
