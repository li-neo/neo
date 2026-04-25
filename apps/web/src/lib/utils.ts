import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export { richTextToPlain } from "@/lib/rich-text";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
