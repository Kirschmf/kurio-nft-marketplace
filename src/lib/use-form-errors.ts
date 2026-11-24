import { useEffect } from "react";
export function useFormErrors(errors: Record<string, string[]>) {
  useEffect(() => {
    if (Object.keys(errors).length)
      document.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus();
  }, [errors]);
}
