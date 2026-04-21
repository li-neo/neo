import { api } from "@/lib/api";

export function compressImage(file: File, maxW = 1600, quality = 0.85): Promise<File> {
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
      if (w <= maxW) { resolve(file); return; }
      const ratio = maxW / w;
      w = maxW;
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export async function uploadImage(token: string, file: File): Promise<string | null> {
  const compressed = await compressImage(file);
  const res = await api.admin.upload(token, compressed);
  if (!res.data) return null;
  return res.data.url.startsWith("http")
    ? res.data.url
    : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${res.data.url}`;
}
