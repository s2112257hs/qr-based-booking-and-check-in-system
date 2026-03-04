import { apiUrl } from "@/api/client";
import { Role } from "@/types";
import { parseErrorMessage } from "@/utils/http";

type LoginResponse = {
  access_token: string;
  user: { id: string; username: string; role: Role; is_active: boolean };
};

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as LoginResponse;
}
