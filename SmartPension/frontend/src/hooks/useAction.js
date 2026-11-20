import { useCallback, useState } from "react";
import { getErrorMessage } from "../api/client";
import { useToast } from "../context/ToastContext";

/**
 * Runs a mutating API call with a busy flag and toast feedback.
 * The API's own success message ({ message }) is shown when available.
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn, { success, onSuccess } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(success || res?.message || "Done.");
      onSuccess?.(res);
      return res;
    } catch (e) {
      toast.error(getErrorMessage(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  return { busy, run };
}
