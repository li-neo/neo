"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ensureStringArray, mergeFlexibleOptions } from "@/lib/flexible-options";

export function SingleOptionInput({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const normalizedOptions = useMemo(() => mergeFlexibleOptions(options, [value]), [options, value]);

  return (
    <div className="space-y-2">
      <input
        list={listId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <datalist id={listId}>
        {normalizedOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {normalizedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {normalizedOptions.map((option) => {
            const active = option.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MultiOptionInput({
  values,
  options,
  onChange,
  placeholder,
}: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const selected = useMemo(() => ensureStringArray(values), [values]);
  const suggestions = useMemo(() => mergeFlexibleOptions(options, selected), [options, selected]);

  const commitDraft = (raw: string) => {
    const [first] = raw.split(",");
    const next = mergeFlexibleOptions(selected, [first]);
    if (next.length !== selected.length) onChange(next);
    setDraft("");
  };

  const removeValue = (target: string) => {
    onChange(selected.filter((item) => item.toLowerCase() !== target.toLowerCase()));
  };

  return (
    <div className="space-y-2">
      <input
        list={listId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) commitDraft(draft);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            commitDraft(draft);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => removeValue(value)}
              className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/20"
            >
              {value} ×
            </button>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions
            .filter((option) => !selected.some((item) => item.toLowerCase() === option.toLowerCase()))
            .map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(mergeFlexibleOptions(selected, [option]))}
                className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                + {option}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

