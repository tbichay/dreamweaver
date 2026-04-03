"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import type { HoererProfil } from "@/lib/types";

interface ProfileContextValue {
  profiles: HoererProfil[];
  activeProfile: HoererProfil | null;
  setActiveProfile: (id: string) => void;
  loading: boolean;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "activeProfileId";

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const [profiles, setProfiles] = useState<HoererProfil[]>([]);
  const [activeProfile, setActiveProfileState] = useState<HoererProfil | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data: HoererProfil[] = await res.json();
      setProfiles(data);

      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = data.find((p) => p.id === savedId);
      setActiveProfileState(saved ?? data[0] ?? null);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      refreshProfiles();
    }
  }, [isSignedIn, refreshProfiles]);

  const setActiveProfile = useCallback(
    (id: string) => {
      const profile = profiles.find((p) => p.id === id);
      if (profile) {
        localStorage.setItem(STORAGE_KEY, id);
        setActiveProfileState(profile);
      }
    },
    [profiles]
  );

  return (
    <ProfileContext.Provider
      value={{ profiles, activeProfile, setActiveProfile, loading, refreshProfiles }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
