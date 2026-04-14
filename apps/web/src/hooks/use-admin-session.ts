"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

const TOKEN_KEY = "neo-admin-token";

export function useAdminSession() {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const nextToken = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
    if (!nextToken) {
      setChecked(true);
      return;
    }
    setToken(nextToken);
    api.auth
      .me(nextToken)
      .then((res) => {
        setIsAdmin(Boolean(res.data && res.data.role === "admin"));
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => setChecked(true));
  }, []);

  return { token, isAdmin, checked };
}
