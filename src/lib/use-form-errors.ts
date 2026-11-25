import { useEffect, type RefObject } from "react";
export function useFormErrors(
  errors: Record<string, string[]>,
  scope?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (Object.keys(errors).length)
      (scope?.current ?? document)
        .querySelector<HTMLElement>("[aria-invalid=true]")
        ?.focus();
  }, [errors, scope]);
}
