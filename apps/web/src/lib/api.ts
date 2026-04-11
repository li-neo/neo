const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  meta?: {
    pagination?: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface Project {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  tech_stack: string[] | null;
  cover_url: string | null;
  demo_url: string | null;
  repo_url: string | null;
  hf_url: string | null;
  featured: boolean;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  tags: string[] | null;
  cover_url: string | null;
  published: boolean;
  reading_time: number;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  version: string;
  author_id: number | null;
  source_url: string | null;
  install_command: string | null;
  install_count: number;
  status: string;
  platform: string;
  created_at: string;
  updated_at: string;
}

export interface GuestbookEntry {
  id: number;
  message: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    avatar_url: string | null;
  };
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${API_PREFIX}${path}`;
  try {
    const { headers: extraHeaders, ...rest } = options ?? {};
    const res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(extraHeaders as Record<string, string>),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      const detail = json.detail;
      let msg = `HTTP ${res.status}`;
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail.map((d: { loc?: string[]; msg?: string }) => `${(d.loc ?? []).join(".")}: ${d.msg}`).join("; ");
      else if (detail) msg = JSON.stringify(detail);
      return { code: res.status, message: msg, data: null };
    }
    return json;
  } catch {
    return { code: -1, message: "Service unavailable", data: null };
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function authReq<T>(path: string, token: string, init?: RequestInit) {
  return request<T>(path, { ...init, headers: { ...init?.headers, ...authHeaders(token) } });
}

function authPost<T>(path: string, token: string, body?: unknown) {
  return request<T>(path, {
    method: "POST", body: JSON.stringify(body),
    headers: authHeaders(token),
  });
}

function authPut<T>(path: string, token: string, body?: unknown) {
  return request<T>(path, {
    method: "PUT", body: JSON.stringify(body),
    headers: authHeaders(token),
  });
}

function authDelete<T>(path: string, token: string) {
  return request<T>(path, { method: "DELETE", headers: authHeaders(token) });
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  projects: {
    list: (params?: string, init?: RequestInit) =>
      api.get<Project[]>(`/projects${params ? `?${params}` : ""}`, init),
    get: (slug: string, init?: RequestInit) =>
      api.get<Project>(`/projects/${slug}`, init),
  },
  posts: {
    list: (params?: string, init?: RequestInit) =>
      api.get<Post[]>(`/posts${params ? `?${params}` : ""}`, init),
    get: (slug: string, init?: RequestInit) =>
      api.get<Post>(`/posts/${slug}`, init),
  },
  skills: {
    list: (params?: string, init?: RequestInit) =>
      api.get<Skill[]>(`/skills${params ? `?${params}` : ""}`, init),
    get: (slug: string, init?: RequestInit) =>
      api.get<Skill>(`/skills/${slug}`, init),
  },
  guestbook: {
    list: (init?: RequestInit) => api.get<GuestbookEntry[]>("/guestbook", init),
    create: (message: string, nickname?: string) => api.post<GuestbookEntry>("/guestbook", { message, nickname: nickname || undefined }),
  },
  mcp: {
    tools: () => api.get<unknown[]>("/mcp/tools"),
    invoke: (method: string, params?: Record<string, unknown>) =>
      api.post<unknown>("/mcp/invoke", { method, params }),
  },

  auth: {
    me: (token: string) => authReq<{ id: number; username: string; role: string; avatar_url: string | null }>("/auth/me", token),
    githubLoginUrl: () => api.get<{ url: string }>("/auth/github/login"),
  },

  admin: {
    projects: {
      create: (token: string, data: Partial<Project>) => authPost<Project>("/projects", token, data),
      update: (token: string, slug: string, data: Partial<Project>) => authPut<Project>(`/projects/${slug}`, token, data),
      delete: (token: string, slug: string) => authDelete<void>(`/projects/${slug}`, token),
    },
    skills: {
      create: (token: string, data: Partial<Skill>) => authPost<Skill>("/skills", token, data),
      update: (token: string, slug: string, data: Partial<Skill>) => authPut<Skill>(`/skills/${slug}`, token, data),
      delete: (token: string, slug: string) => authDelete<void>(`/skills/${slug}`, token),
    },
    posts: {
      create: (token: string, data: Partial<Post>) => authPost<Post>("/posts", token, data),
      update: (token: string, slug: string, data: Partial<Post>) => authPut<Post>(`/posts/${slug}`, token, data),
      delete: (token: string, slug: string) => authDelete<void>(`/posts/${slug}`, token),
    },
    guestbook: {
      delete: (token: string, id: number) => authDelete<void>(`/guestbook/${id}`, token),
    },
    chat: {
      sessions: (token: string, page = 1) =>
        authReq<{ session_id: string; visitor_id: string; msg_count: number; started_at: string; last_at: string }[]>(
          `/chat/sessions?page=${page}`, token
        ),
      sessionMessages: (token: string, sessionId: string) =>
        authReq<{ id: number; role: string; content: string; created_at: string }[]>(
          `/chat/sessions/${sessionId}`, token
        ),
    },
    github: {
      repos: (token: string, username?: string) =>
        authReq<{ name: string; full_name: string; description: string | null; html_url: string; language: string | null; stargazers_count: number; topics: string[]; homepage: string | null; updated_at: string }[]>(
          `/github/repos${username ? `?username=${username}` : ""}`, token
        ),
      import: (token: string, repos: { full_name: string; category?: string }[]) =>
        authPost<{ created: { id: number; slug: string; title: string; full_name: string }[]; skipped: { full_name: string }[]; failed: { full_name: string; error: string }[] }>("/github/import", token, { repos }),
    },
    upload: async (token: string, file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
      const form = new FormData();
      form.append("file", file);
      const url = `${API_BASE}${API_PREFIX}/uploads`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        return res.json();
      } catch {
        return { code: -1, message: "Upload failed", data: null };
      }
    },
  },
};
