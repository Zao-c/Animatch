"use client";

import { useEffect } from "react";
import { registerUnsavedChangesGuard } from "./unsaved-changes-guard";

export function useUnsavedChanges(dirty: boolean, message = "还有未保存的修改，确定离开？") {
  useEffect(() => {
    if (!dirty) return;
    return registerUnsavedChangesGuard(window, message);
  }, [dirty, message]);
}
