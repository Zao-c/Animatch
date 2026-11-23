"use client";

import { useCallback, useEffect, useState } from "react";

interface Draft<T> {
  version: 1;
  updatedAt: number;
  baseVersion: string;
  data: T;
}

/** Per-tab recovery: never uploads edits or silently replaces the server copy. */
export function useRecoverableDraft<T>(key: string | null, data: T, dirty: boolean, baseVersion: string) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [pending, setPending] = useState<Draft<T> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const serialized = JSON.stringify(data);

  useEffect(() => {
    setPending(null);
    setStorageError(null);
    setReadFailed(false);
    if (!key) { setLoadedKey(null); return; }
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw) as Draft<T>;
        if (draft.version !== 1 || typeof draft.baseVersion !== "string" || !Number.isFinite(draft.updatedAt) || !("data" in draft)) {
          throw new Error("invalid draft");
        }
        setPending(draft);
      }
    } catch {
      setReadFailed(true);
      setStorageError("无法读取此标签页的暂存内容，请及时保存到账号。");
    }
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || loadedKey !== key || pending || readFailed) return;
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ version: 1, updatedAt: Date.now(), baseVersion, data: JSON.parse(serialized) }));
      else sessionStorage.removeItem(key);
      setStorageError(null);
    } catch {
      setStorageError("浏览器暂存不可用，请保存到账号后再离开。");
    }
  }, [key, loadedKey, pending, readFailed, dirty, baseVersion, serialized]);

  const dismiss = useCallback(() => {
    if (key) {
      try { sessionStorage.removeItem(key); }
      catch { setStorageError("无法清除浏览器暂存，请检查浏览器存储设置。"); }
    }
    setPending(null);
    setReadFailed(false);
  }, [key]);

  return { pending: loadedKey === key ? pending : null, ready: key !== null && loadedKey === key, storageError, dismiss };
}
