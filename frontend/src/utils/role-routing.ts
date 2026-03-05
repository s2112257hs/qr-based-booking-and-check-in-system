import { Role } from "@/types";

export function homePathForRole(role: Role): string {
  if (role === "super_admin") return "/trips";
  if (role === "receptionist") return "/trips";
  return "/trips";
}
