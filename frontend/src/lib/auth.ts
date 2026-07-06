import { useSyncExternalStore } from "react";

export type AuthUser = {
  id: number;
  email: string;
  nickname: string;
  username: string;
  created_at: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const TOKEN_KEY = "blogsystem.auth.token";
const USER_KEY = "blogsystem.auth.user";
let cachedUserRaw: string | null = null;
let cachedUser: AuthUser | null = null;

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;

  const rawUser = window.localStorage.getItem(USER_KEY);
  if (!rawUser) return null;
  if (rawUser === cachedUserRaw) return cachedUser;

  try {
    cachedUserRaw = rawUser;
    cachedUser = JSON.parse(rawUser) as AuthUser;
    return cachedUser;
  } catch {
    cachedUserRaw = null;
    cachedUser = null;
    return null;
  }
}

function subscribeAuthChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("blogsystem-auth-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("blogsystem-auth-change", onStoreChange);
  };
}

export function useAuthUser() {
  return useSyncExternalStore(subscribeAuthChanges, getStoredUser, () => null);
}

export function saveAuthSession(session: AuthSession) {
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.dispatchEvent(new Event("blogsystem-auth-change"));
}

export function clearAuthSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  cachedUserRaw = null;
  cachedUser = null;
  window.dispatchEvent(new Event("blogsystem-auth-change"));
}

export function authHeaders(token = getAuthToken()): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function requireAuthToken() {
  const token = getAuthToken();
  if (!token && typeof window !== "undefined") {
    window.location.href = "/";
  }
  return token;
}

export function redirectToLogin() {
  clearAuthSession();
  window.location.href = "/";
}

export function ensureAuthorized(response: Response) {
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("登录已过期，请重新登录");
  }
}

export function isOwnBlog(username: string): boolean {
  const user = getStoredUser();
  return user?.username === username;
}
