"use client";

import { login as loginRequest } from "@/api/auth";
import { Role } from "@/types";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type AuthContextValue = {
  accessToken: string;
  role: Role | "";
  username: string;
  login: (username: string, password: string) => Promise<Role>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [username, setUsername] = useState("");

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      role,
      username,
      async login(nextUsername: string, password: string) {
        const data = await loginRequest(nextUsername, password);
        setAccessToken(data.access_token);
        setRole(data.user.role);
        setUsername(data.user.username);
        return data.user.role;
      },
      logout() {
        setAccessToken("");
        setRole("");
        setUsername("");
      },
    }),
    [accessToken, role, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
