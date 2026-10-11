import type { AuthSession } from "./auth";

function getAuthErrorMessage(status: number, detail: unknown, isLogin: boolean): string {
  if (status >= 500) return `后端服务暂时不可用（HTTP ${status}），请稍后重试或联系管理员`;
  if (status === 404 || status === 405) return `账号接口无法访问（HTTP ${status}），请联系管理员检查部署配置`;
  if (status === 409) return "这个邮箱已经注册过，请直接登录";
  if (status === 401) return "邮箱或密码不正确";
  if (status === 403) return "请求被拒绝（HTTP 403），请检查网站访问权限";
  if (status === 429) return "请求过于频繁，请稍后重试";
  if (status === 422) {
    const fields = Array.isArray(detail)
      ? detail.flatMap((error) => Array.isArray(error?.loc) ? error.loc : [])
      : [];
    if (fields.includes("username")) return "用户名需要 3–30 个字符";
    if (fields.includes("nickname")) return "昵称不能超过 80 个字符";
    return "请检查邮箱格式与长度，密码需要 6–120 位";
  }
  if (typeof detail === "string") return detail;
  return `${isLogin ? "登录" : "注册"}请求失败（HTTP ${status}），请稍后重试`;
}

export async function readAuthResponse(response: Response, isLogin: boolean): Promise<AuthSession> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getAuthErrorMessage(response.status, body?.detail, isLogin));
  }
  if (!body || typeof body.token !== "string" || !body.token || !body.user || typeof body.user.id !== "number") {
    throw new Error("账号接口返回了异常响应，请联系管理员检查部署配置");
  }
  return body;
}
