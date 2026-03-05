"use client";

import { login as loginRequest } from "@/api/auth";
import { Role } from "@/types";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthContextValue = {
  isHydrated: boolean;
  accessToken: string;
  role: Role | "";
  username: string;
  login: (username: string, password: string) => Promise<Role>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = "qr_booking_auth_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        accessToken?: string;
        role?: Role;
        username?: string;
      };
      setAccessToken(parsed.accessToken ?? "");
      setRole(parsed.role ?? "");
      setUsername(parsed.username ?? "");
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isHydrated,
      accessToken,
      role,
      username,
      async login(nextUsername: string, password: string) {
        const data = await loginRequest(nextUsername, password);
        setAccessToken(data.access_token);
        setRole(data.user.role);
        setUsername(data.user.username);
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            accessToken: data.access_token,
            role: data.user.role,
            username: data.user.username,
          }),
        );
        return data.user.role;
      },
      logout() {
        setAccessToken("");
        setRole("");
        setUsername("");
        localStorage.removeItem(AUTH_STORAGE_KEY);
      },
    }),
    [isHydrated, accessToken, role, username],
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
