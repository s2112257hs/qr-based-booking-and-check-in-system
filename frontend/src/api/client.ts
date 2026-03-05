const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const withoutApiPrefix = path.startsWith("/api/") ? path.slice(4) : path;
  const normalizedPath = withoutApiPrefix.startsWith("/")
    ? withoutApiPrefix
    : `/${withoutApiPrefix}`;

  return `${API_BASE_URL}${normalizedPath}`;
}
