import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User as DbUser } from "@shared/models/auth";

// Extended User type with server-computed fields
export type User = DbUser & {
  needsOnboarding?: boolean;
  isOwner?: boolean;
};

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch (e) {
    console.error("Logout error:", e);
  }
  window.location.href = "/";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 5000, // Consider data stale after 5 seconds to ensure fresh data on navigation
    gcTime: 0, // Don't keep old data in cache when unmounted
    refetchOnMount: 'always', // Always refetch when component mounts to get fresh onboarding status
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid race conditions
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  };
}
