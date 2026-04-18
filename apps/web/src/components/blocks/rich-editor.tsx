"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import {
  BlockNoteEditor,
  type Block,
  type PartialBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RichEditorProps {
  initialContent?: string;
  onChange?: (jsonContent: string, markdown: string) => void;
  token?: string;
  editable?: boolean;
  placeholder?: string;
}

function parseInitialContent(raw: string | undefined): PartialBlock[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // not JSON — will convert from markdown in the hook
  }
  return undefined;
}

async function uploadFile(file: File, token?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/v1/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json();
  const url = json?.data?.url ?? "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export function RichEditor({
  initialContent,
  onChange,
  token,
  editable = true,
  placeholder,
}: RichEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initializedRef = useRef(false);
  const initialContentRef = useRef(initialContent);

  const parsedBlocks = useMemo(
    () => parseInitialContent(initialContentRef.current),
    [],
  );

  const editor = useCreateBlockNote({
    initialContent: parsedBlocks,
    uploadFile: token ? (file: File) => uploadFile(file, token) : undefined,
  });

  useEffect(() => {
    if (initializedRef.current) return;
    const raw = initialContentRef.current;
    if (!raw || raw.trim() === "") return;
    if (parsedBlocks) return; // already loaded as JSON

    (async () => {
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(raw);
        editor.replaceBlocks(editor.document, blocks);
      } catch {
        // fallback: leave default empty doc
      }
    })();
    initializedRef.current = true;
  }, [editor, parsedBlocks]);

  const handleChange = useCallback(async () => {
    if (!onChangeRef.current) return;
    const blocks = editor.document as Block[];
    const json = JSON.stringify(blocks);
    const md = await editor.blocksToMarkdownLossy(blocks);
    onChangeRef.current(json, md);
  }, [editor]);

  return (
    <div className="neo-blocknote-wrapper rounded-2xl border border-border/50 bg-white overflow-hidden">
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleChange}
        theme="light"
        data-placeholder={placeholder}
      />
    </div>
  );
}

export function RichViewer({ content }: { content: string | null | undefined }) {
  if (!content || content.trim() === "") {
    return null;
  }

  let parsedBlocks: PartialBlock[] | undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsedBlocks = parsed;
    }
  } catch {
    // not JSON block content — use MarkdownRenderer instead
    return null;
  }

  return <RichViewerInner blocks={parsedBlocks!} />;
}

function RichViewerInner({ blocks }: { blocks: PartialBlock[] }) {
  const editor = useCreateBlockNote({
    initialContent: blocks,
  });

  return (
    <div className="neo-blocknote-viewer">
      <BlockNoteView
        editor={editor}
        editable={false}
        theme="light"
      />
    </div>
  );
}
