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
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });
    return res.json();
  } catch {
    return { code: -1, message: "Service unavailable", data: null };
  }
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
    create: (message: string) => api.post<GuestbookEntry>("/guestbook", { message }),
  },
  mcp: {
    tools: () => api.get<unknown[]>("/mcp/tools"),
    invoke: (method: string, params?: Record<string, unknown>) =>
      api.post<unknown>("/mcp/invoke", { method, params }),
  },
};
