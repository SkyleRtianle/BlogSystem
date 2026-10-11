import { authHeaders, ensureAuthorized } from "@/lib/auth";

export async function uploadPhoto(
  apiBase: string,
  token: string,
  file: File,
  title: string,
  description: string,
): Promise<Response> {
  const preparation = await fetch(`${apiBase}/photos/upload-url`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
  });
  ensureAuthorized(preparation);
  if (!preparation.ok) throw new Error("照片上传准备失败，请检查文件格式和大小（最大 20 MiB）");
  const upload = await preparation.json();

  if (upload.storage === "r2") {
    const transfer = await fetch(upload.upload_url, {
      method: "PUT",
      headers: { "Content-Type": upload.content_type },
      body: file,
    });
    if (!transfer.ok) throw new Error("照片上传失败，请稍后重试");
    // The app token is only sent to the API, never to the object storage service.
    return fetch(`${apiBase}/photos/complete`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ filename: upload.filename, title, description }),
    });
  }

  const body = new FormData();
  body.append("title", title);
  body.append("description", description);
  body.append("file", file);
  return fetch(`${apiBase}/photos`, { method: "POST", headers: authHeaders(token), body });
}
