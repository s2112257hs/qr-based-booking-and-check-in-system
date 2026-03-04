"use client";

import { useAuth } from "@/context/auth-context";

export function useAuthSession() {
  return useAuth();
}
