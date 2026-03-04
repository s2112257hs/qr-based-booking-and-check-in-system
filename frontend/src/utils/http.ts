import { ApiError } from "@/types";

export async function parseErrorMessage(response: Response): Promise<string> {
  let data: ApiError | undefined;
  try {
    data = (await response.json()) as ApiError;
  } catch {
    return `Request failed with status ${response.status}`;
  }

  const message = data?.message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return `Request failed with status ${response.status}`;
}

export function withAuth(headers: HeadersInit, token: string): HeadersInit {
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
