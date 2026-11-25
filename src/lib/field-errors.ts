import type { ZodError } from "zod";

export function fieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
