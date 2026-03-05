"use client";

import { useAuth } from "@/context/auth-context";
import { Role } from "@/types";
import { homePathForRole } from "@/utils/role-routing";
import { useRouter } from "next/router";
import { useEffect } from "react";

type RequireAuthResult = {
  auth: ReturnType<typeof useAuth>;
  authorized: boolean;
};

export function useRedirectAuthenticatedToHome(): {
  auth: ReturnType<typeof useAuth>;
  isAuthenticated: boolean;
} {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !auth.isHydrated) return;
    if (auth.accessToken && auth.role) {
      router.replace(homePathForRole(auth.role));
    }
  }, [auth.isHydrated, auth.accessToken, auth.role, router]);

  return {
    auth,
    isAuthenticated: auth.isHydrated && Boolean(auth.accessToken && auth.role),
  };
}

export function useRequireAuth(allowedRoles?: Role[]): RequireAuthResult {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !auth.isHydrated) return;

    if (!auth.accessToken || !auth.role) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(auth.role)) {
      router.replace(homePathForRole(auth.role));
    }
  }, [allowedRoles, auth.isHydrated, auth.accessToken, auth.role, router]);

  const authorized =
    auth.isHydrated &&
    Boolean(auth.accessToken && auth.role) &&
    (!allowedRoles || (auth.role ? allowedRoles.includes(auth.role) : false));

  return { auth, authorized };
}
