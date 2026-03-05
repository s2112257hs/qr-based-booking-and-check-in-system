"use client";

import { LoginScreen } from "@/components/login-screen";
import { useRedirectAuthenticatedToHome } from "@/hooks/use-route-guards";

export default function LoginPage() {
  const { isAuthenticated } = useRedirectAuthenticatedToHome();

  if (isAuthenticated) {
    return null;
  }

  return <LoginScreen />;
}
