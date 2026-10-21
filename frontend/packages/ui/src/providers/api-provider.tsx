"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { SessionContext } from "./session-provider";

interface ApiClient {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  put: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  del: <T = unknown>(path: string) => Promise<T>;
}

const ApiContext = createContext<ApiClient | null>(null);

function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof window !== "undefined") {
    console.error("NEXT_PUBLIC_API_URL is not set; API requests may fail. Set it in your environment.");
  }
  return "/api";
}

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  onUnauthorized?: () => void
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      onUnauthorized?.();
    }
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const baseUrl = getBaseUrl();
  const session = useContext(SessionContext);
  const token = session?.token ?? null;
  const logout = session?.logout;

  const client = useMemo<ApiClient>(
    () => ({
      get: <T = unknown,>(path: string) =>
        request<T>(baseUrl, "GET", path, undefined, token, logout),
      post: <T = unknown,>(path: string, body?: unknown) =>
        request<T>(baseUrl, "POST", path, body, token, logout),
      put: <T = unknown,>(path: string, body?: unknown) =>
        request<T>(baseUrl, "PUT", path, body, token, logout),
      del: <T = unknown,>(path: string) =>
        request<T>(baseUrl, "DELETE", path, undefined, token, logout),
    }),
    [baseUrl, token, logout]
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return ctx;
}
