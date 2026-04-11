"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Locale = "en" | "zh";

const dict = {
  nav: {
    projects: { en: "Projects", zh: "项目" },
    skills: { en: "Skills", zh: "Skills" },
    blog: { en: "Blog", zh: "博客" },
    guestbook: { en: "Guestbook", zh: "留言板" },
  },
  hero: {
    badge: { en: "Chatting with NEO-AI", zh: "正在与 NEO-AI 对话" },
    subtitle: {
      en: "Exploring the frontiers of AI — from large language models and autonomous driving to world models.",
      zh: "探索 AI 前沿 — 从大语言模型、自动驾驶到世界模型。",
    },
    viewProjects: { en: "View Projects", zh: "查看项目" },
    exploreSkills: { en: "Explore Skills", zh: "探索 Skills" },
    scrollHint: { en: "Scroll to enter", zh: "向下滚动进入" },
    hoverHint: {
      en: "Hover over a star \u00b7 some carry messages, others lead to projects",
      zh: "悬停在星球上 \u00b7 有些承载留言，有些通往项目",
    },
    clickToOpen: { en: "click to open", zh: "点击打开" },
    leaveMessage: { en: "Leave a message", zh: "留下一条消息" },
  },
  projects: {
    title: { en: "Projects", zh: "项目" },
    subtitle: {
      en: "Research & engineering across the AI landscape",
      zh: "横跨 AI 领域的研究与工程实践",
    },
    viewAll: { en: "View all projects", zh: "查看全部项目" },
    all: { en: "All", zh: "全部" },
    featured: { en: "Featured", zh: "精选" },
    noProjects: {
      en: "No projects found for this category",
      zh: "该分类下暂无项目",
    },
  },
  skills: {
    title: { en: "Skills & Tools", zh: "Skills & Tools" },
    subtitle: {
      en: "OpenClaw skills, MCP services, and developer tools",
      zh: "OpenClaw Skills、MCP 服务与开发者工具",
    },
    browseAll: { en: "Browse all skills", zh: "浏览全部 Skills" },
    browseCreate: {
      en: "Browse, create, and publish skills for OpenClaw and beyond",
      zh: "浏览、创建和发布 OpenClaw Skills",
    },
    installs: { en: "installs", zh: "次安装" },
    viewSource: { en: "View source", zh: "查看源码" },
    noSkills: { en: "No skills available yet", zh: "暂无 Skills" },
  },
  blog: {
    title: { en: "Blog", zh: "博客" },
    subtitle: {
      en: "Thoughts on AI research, engineering, and the tools we build",
      zh: "关于 AI 研究、工程实践与工具构建的思考",
    },
    backToList: { en: "Back to blog", zh: "返回博客列表" },
    loadingPost: { en: "Loading article...", zh: "正在加载文章..." },
    postNotFound: { en: "This article does not exist or is not public.", zh: "这篇文章不存在，或暂未公开。" },
    draft: { en: "Draft", zh: "草稿" },
    minRead: { en: "min read", zh: "分钟阅读" },
    views: { en: "views", zh: "次浏览" },
    noPosts: { en: "No posts published yet", zh: "暂无文章" },
  },
  guestbook: {
    title: { en: "Guestbook", zh: "留言板" },
    subtitle: {
      en: "Sign in with GitHub and leave a message",
      zh: "使用 GitHub 登录并留下一条消息",
    },
    empty: {
      en: "No messages yet. Be the first to sign the guestbook!",
      zh: "还没有留言，成为第一个留言的人吧！",
    },
    inputPlaceholder: { en: "Write a message...", zh: "写一条留言..." },
    nicknamePlaceholder: { en: "Nickname (optional)", zh: "昵称（选填）" },
    send: { en: "Send", zh: "发送" },
    sending: { en: "Sending...", zh: "发送中..." },
  },
  workspace: {
    title: { en: "Workspace", zh: "工作台" },
    subtitle: {
      en: "Automation tasks, integrations, and deployment status",
      zh: "自动化任务、集成与部署状态",
    },
  },
  admin: {
    title: { en: "Admin Dashboard", zh: "管理后台" },
    dashboard: { en: "Dashboard", zh: "管理台" },
    viewSite: { en: "View Site", zh: "返回站点" },
    mode: { en: "Admin Mode", zh: "管理模式" },
    managing: { en: "Managing current page", zh: "正在管理当前页面" },
    openPanel: { en: "Open Panel", zh: "打开后台" },
    manageSection: { en: "Manage Section", zh: "管理当前栏目" },
    login: { en: "Admin Login", zh: "管理员登录" },
    loginDesc: { en: "Sign in with GitHub to access the admin panel", zh: "使用 GitHub 登录以访问管理后台" },
    loginBtn: { en: "Sign in with GitHub", zh: "使用 GitHub 登录" },
    noAccess: { en: "You do not have admin access", zh: "您没有管理员权限" },
    projects: { en: "Projects", zh: "项目管理" },
    skills: { en: "Skills", zh: "Skills 管理" },
    guestbook: { en: "Guestbook", zh: "留言管理" },
    uploads: { en: "Media", zh: "媒体文件" },
    save: { en: "Save", zh: "保存" },
    saving: { en: "Saving...", zh: "保存中..." },
    cancel: { en: "Cancel", zh: "取消" },
    create: { en: "Create", zh: "新建" },
    edit: { en: "Edit", zh: "编辑" },
    delete: { en: "Delete", zh: "删除" },
    confirm: { en: "Are you sure?", zh: "确认操作？" },
    saved: { en: "Saved successfully", zh: "保存成功" },
    saveFailed: { en: "Save failed", zh: "保存失败" },
    deleted: { en: "Deleted successfully", zh: "删除成功" },
    deleteFailed: { en: "Delete failed", zh: "删除失败" },
    upload: { en: "Upload File", zh: "上传文件" },
    uploading: { en: "Uploading...", zh: "上传中..." },
    uploaded: { en: "Uploaded successfully", zh: "上传成功" },
    uploadFailed: { en: "Upload failed", zh: "上传失败" },
    dragDrop: { en: "Drag & drop or click to upload", zh: "拖拽或点击上传" },
    dragHint: { en: "Images (JPG, PNG, WebP, SVG) · Videos (MP4, WebM) · Auto-compressed", zh: "图片 (JPG, PNG, WebP, SVG) · 视频 (MP4, WebM) · 自动压缩" },
    noData: { en: "No data yet", zh: "暂无数据" },
    logout: { en: "Logout", zh: "退出登录" },
    copyUrl: { en: "Copy URL", zh: "复制链接" },
    copied: { en: "Copied!", zh: "已复制!" },
    fTitle: { en: "Title", zh: "标题" },
    fSlug: { en: "Slug", zh: "URL 标识" },
    fCategory: { en: "Category", zh: "分类" },
    fDescription: { en: "Description", zh: "描述" },
    fTechStack: { en: "Tech Stack (comma-separated)", zh: "技术栈（逗号分隔）" },
    fCoverUrl: { en: "Cover Image URL", zh: "封面图片 URL" },
    fRepoUrl: { en: "GitHub URL", zh: "GitHub 地址" },
    fDemoUrl: { en: "Demo URL", zh: "Demo 地址" },
    fHfUrl: { en: "HuggingFace URL", zh: "HuggingFace 地址" },
    fFeatured: { en: "Featured", zh: "精选推荐" },
    fStatus: { en: "Status", zh: "状态" },
    fName: { en: "Name", zh: "名称" },
    fVersion: { en: "Version", zh: "版本" },
    fPlatform: { en: "Platform", zh: "平台" },
    fInstallCmd: { en: "Install Command", zh: "安装命令" },
    fSourceUrl: { en: "Source URL", zh: "源码地址" },
    fSummary: { en: "Summary", zh: "摘要" },
    fContent: { en: "Content (Markdown)", zh: "正文 (Markdown)" },
    fTags: { en: "Tags (comma-separated)", zh: "标签（逗号分隔）" },
    fReadingTime: { en: "Reading Time", zh: "阅读时长" },
    fPublished: { en: "Published", zh: "已发布" },
    blog: { en: "Blog", zh: "博客管理" },
    uploadDoc: { en: "Upload PDF / Markdown", zh: "上传 PDF / Markdown" },
    importFeishu: { en: "Paste Feishu URL", zh: "粘贴飞书文档链接" },
    importNotion: { en: "Paste Notion URL", zh: "粘贴 Notion 链接" },
    importUrl: { en: "Import Link", zh: "导入链接" },
    importPlaceholder: { en: "Feishu / Notion / public article URL", zh: "飞书 / Notion / 公开文章链接" },
    contentPreview: { en: "Preview", zh: "预览" },
    ghImport: { en: "Import from GitHub", zh: "从 GitHub 导入" },
    ghImportDesc: { en: "Select repos to import as projects", zh: "选择仓库导入为项目" },
    ghFetch: { en: "Fetch Repos", zh: "获取仓库列表" },
    ghFetching: { en: "Fetching...", zh: "获取中..." },
    ghUsername: { en: "GitHub username or URL, e.g. octocat", zh: "GitHub 用户名或链接，如 octocat" },
    ghNoRepos: { en: "No repos found", zh: "未找到仓库" },
    ghImporting: { en: "Importing...", zh: "导入中..." },
    ghImported: { en: "Imported successfully", zh: "导入成功" },
    ghImportFailed: { en: "Import failed", zh: "导入失败" },
    ghSelectAll: { en: "Select All", zh: "全选" },
    ghImportSelected: { en: "Import Selected", zh: "导入选中项" },
    ghStars: { en: "stars", zh: "星标" },
    ghAlreadyExists: { en: "Already exists", zh: "已存在" },
    chatSessions: { en: "Chat Records", zh: "聊天记录" },
    chatNoSessions: { en: "No chat sessions yet", zh: "暂无聊天记录" },
    chatMessages: { en: "messages", zh: "条消息" },
    chatViewDetail: { en: "View", zh: "查看" },
    chatBack: { en: "Back to list", zh: "返回列表" },
  },
  chat: {
    title: { en: "Chat with NEO-AI", zh: "与 NEO-AI 对话" },
    placeholder: { en: "Ask me anything...", zh: "问我任何问题..." },
    send: { en: "Send", zh: "发送" },
    thinking: { en: "Thinking...", zh: "思考中..." },
    error: { en: "Failed to get response", zh: "获取回复失败" },
    offline: { en: "AI service offline", zh: "AI 服务离线" },
    newChat: { en: "New Chat", zh: "新对话" },
    close: { en: "Close", zh: "关闭" },
    welcome: { en: "Hi! I'm NEO-AI. Ask me about projects, skills, or anything else.", zh: "你好！我是 NEO-AI。可以问我关于项目、技能或其他任何问题。" },
  },
  footer: {
    rights: { en: "All rights reserved.", zh: "保留所有权利。" },
  },
} as const;

type Dict = typeof dict;
type DotPath<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? { [K in keyof T & string]: T[K] extends { en: string; zh: string }
      ? `${Prefix}${K}`
      : DotPath<T[K], `${Prefix}${K}.`>
  }[keyof T & string]
  : never;

export type TKey = DotPath<Dict>;

function resolve(key: string, locale: Locale): string {
  const parts = key.split(".");
  let node: unknown = dict;
  for (const p of parts) {
    if (node && typeof node === "object" && p in node) {
      node = (node as Record<string, unknown>)[p];
    } else return key;
  }
  if (node && typeof node === "object" && locale in (node as Record<string, string>)) {
    return (node as Record<string, string>)[locale];
  }
  return key;
}

interface I18nCtx {
  locale: Locale;
  t: (key: TKey) => string;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nCtx>({
  locale: "en",
  t: (k) => k,
  setLocale: () => {},
});

const STORAGE_KEY = "neo-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "en" || stored === "zh") {
      setLocaleState(stored);
    } else {
      const browserZh = navigator.language.startsWith("zh");
      setLocaleState(browserZh ? "zh" : "en");
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);

  const t = useCallback((key: TKey) => resolve(key, locale), [locale]);

  return <Ctx.Provider value={{ locale, t, setLocale }}>{children}</Ctx.Provider>;
}

export function useI18n() { return useContext(Ctx); }

export function dateLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}
