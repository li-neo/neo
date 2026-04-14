"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import { MultiOptionInput, SingleOptionInput } from "@/components/ui/flexible-fields";
import { api } from "@/lib/api";

export interface DetailFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "select" | "single_option" | "multi_option" | "url_with_upload";
  options?: string[];
  rows?: number;
  wide?: boolean;
}

async function compressImage(file: File, maxW = 1600, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w <= maxW) {
        resolve(file);
        return;
      }
      const ratio = maxW / w;
      w = maxW;
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function DetailEditSheet({
  open,
  title,
  token,
  fields,
  data,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  open: boolean;
  title: string;
  token: string;
  fields: DetailFieldDef[];
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  if (!open) return null;

  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  const handleFileUpload = async (key: string, file: File) => {
    setUploadingField(key);
    const compressed = await compressImage(file);
    const res = await api.admin.upload(token, compressed);
    if (res.data) {
      const url = res.data.url.startsWith("http")
        ? res.data.url
        : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${res.data.url}`;
      set(key, url);
    }
    setUploadingField(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-stone-950/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-background px-6 py-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Admin Edit</p>
            <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const rawValue = data[field.key];
            const stringValue = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue ?? "");
            const previewUrl = typeof rawValue === "string" ? rawValue.trim() : "";
            return (
              <div key={field.key} className={field.wide || field.type === "textarea" || field.type === "url_with_upload" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{field.label}</label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    rows={field.rows ?? 5}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  />
                )}

                {field.type === "checkbox" && (
                  <input
                    type="checkbox"
                    checked={Boolean(rawValue)}
                    onChange={(e) => set(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={stringValue}
                    onChange={(e) => set(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  >
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "single_option" && (
                  <SingleOptionInput
                    value={String(rawValue ?? "")}
                    options={field.options ?? []}
                    onChange={(next) => set(field.key, next)}
                    placeholder={field.label}
                  />
                )}

                {field.type === "multi_option" && (
                  <MultiOptionInput
                    values={Array.isArray(rawValue) ? (rawValue as string[]) : []}
                    options={field.options ?? []}
                    onChange={(next) => set(field.key, next)}
                    placeholder={field.label}
                  />
                )}

                {field.type === "url_with_upload" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={stringValue}
                        onChange={(e) => set(field.key, e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          fileRef.current?.setAttribute("data-field", field.key);
                          fileRef.current?.click();
                        }}
                        className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        disabled={uploadingField === field.key}
                      >
                        {uploadingField === field.key ? "Uploading..." : "Upload"}
                      </button>
                    </div>
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt={field.label} className="max-h-48 rounded-2xl border border-border/50 object-cover" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const field = fileRef.current?.getAttribute("data-field");
            if (file && field) await handleFileUpload(field, file);
            e.currentTarget.value = "";
          }}
        />

        <div className="mt-6 flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
