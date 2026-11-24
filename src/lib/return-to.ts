export function safeReturnTo(
  value: string | undefined,
  origin: string,
): string {
  if (
    !value?.startsWith("/") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return "/";
  try {
    const url = new URL(value, origin);
    if (
      url.origin !== origin ||
      /^\/(login|register)(?:\/|$)/.test(url.pathname)
    )
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
