"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  type Block,
  type PartialBlock,
} from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function tryParseBlocks(raw: string | undefined): PartialBlock[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // not JSON
  }
  return undefined;
}

/* ─────────── Editor (editable) ─────────── */

interface RichEditorProps {
  initialContent?: string;
  onChange?: (jsonContent: string, markdown: string) => void;
  token?: string;
  editable?: boolean;
}

function EditorInner({
  initialBlocks,
  markdownToLoad,
  onChange,
  token,
  editable = true,
}: {
  initialBlocks?: PartialBlock[];
  markdownToLoad?: string;
  onChange?: (jsonContent: string, markdown: string) => void;
  token?: string;
  editable?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const loadedMdRef = useRef(false);

  const editor = useCreateBlockNote({
    initialContent: initialBlocks,
    uploadFile: token ? (file: File) => uploadFile(file, token) : undefined,
  });

  useEffect(() => {
    if (loadedMdRef.current || !markdownToLoad || initialBlocks) return;
    loadedMdRef.current = true;
    (async () => {
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
        editor.replaceBlocks(editor.document, blocks);
      } catch {
        // ignore
      }
    })();
  }, [editor, markdownToLoad, initialBlocks]);

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
      />
    </div>
  );
}

/**
 * Keyed wrapper — guarantees a fresh editor instance when `initialContent` changes.
 * Parent should pass a unique `key` (e.g. the entity slug/id) so React unmounts
 * the old editor and mounts a new one when switching between items.
 */
export function RichEditor({ initialContent, onChange, token, editable = true }: RichEditorProps) {
  const blocks = tryParseBlocks(initialContent);
  const mdToLoad = blocks ? undefined : initialContent;

  return (
    <EditorInner
      initialBlocks={blocks}
      markdownToLoad={mdToLoad}
      onChange={onChange}
      token={token}
      editable={editable}
    />
  );
}

/* ─────────── Viewer (read-only) ─────────── */

export function RichViewer({ content }: { content: string | null | undefined }) {
  if (!content || content.trim() === "") return null;

  const blocks = tryParseBlocks(content);
  if (!blocks) return null;

  return <ViewerInner blocks={blocks} />;
}

function ViewerInner({ blocks }: { blocks: PartialBlock[] }) {
  const editor = useCreateBlockNote({ initialContent: blocks });

  return (
    <div className="neo-blocknote-viewer">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}
