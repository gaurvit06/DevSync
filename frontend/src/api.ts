let token = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function api(path: string, options: RequestInit = {}) {
  if (!token) {
    const r = await fetch("/api/auth/csrf");
    if (!r.ok) throw new Error("Cannot connect to API");
    token = (await r.json()).token;
  }
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-XSRF-TOKEN": token,
      ...options.headers,
    },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new ApiError(
      b.message ||
        (r.status === 403
          ? "Access denied. Reload if your session expired."
          : r.status === 401
            ? "Please sign in."
            : "Request failed (" + r.status + ")"),
      r.status,
    );
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
export const send = (path: string, data: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });
export function resetToken() {
  token = "";
}
export const statuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
export const label = (s: string) =>
  s
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
