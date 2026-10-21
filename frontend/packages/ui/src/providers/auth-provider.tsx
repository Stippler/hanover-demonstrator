"use client";

import { createContext, useContext, type ReactNode } from "react";

interface AuthState {
  participantId: string;
  participantName: string;
  role: string;
}

const participants: Record<string, AuthState> = {
  vendor: {
    participantId: "vendor",
    participantName: "Alpine Ski Manufacturing",
    role: "vendor",
  },
  owner_a: {
    participantId: "owner_a",
    participantName: "Anna Schmidt",
    role: "owner",
  },
  owner_b: {
    participantId: "owner_b",
    participantName: "Bob Meier",
    role: "owner",
  },
  service_shop: {
    participantId: "service_shop",
    participantName: "Peak Service Center",
    role: "service",
  },
  admin: {
    participantId: "admin",
    participantName: "System Admin",
    role: "admin",
  },
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pid =
    process.env.NEXT_PUBLIC_PARTICIPANT_ID ?? "vendor";
  const auth = participants[pid] ?? participants.vendor;

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
