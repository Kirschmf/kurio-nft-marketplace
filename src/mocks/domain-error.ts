export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
  details?: unknown,
): never {
  throw new DomainError(status, code, message, fields, details);
}
