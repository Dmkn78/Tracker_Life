"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconButton } from "@/components/ui";
import { logoutSession } from "@/features/auth/api/sessionApi";
import { ApiError } from "@/lib/http/apiClient";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function logout() {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutSession();
      router.push("/login");
      router.refresh();
    } catch (error: unknown) {
      setLogoutError(readApiErrorMessage(error, "Unable to log out."));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div>
      <IconButton onClick={logout} disabled={isLoggingOut}>
        <LogOut className="h-4 w-4" />
        Log out
      </IconButton>
      {logoutError ? (
        <p role="alert" className="mt-3 text-sm text-risk">
          {logoutError}
        </p>
      ) : null}
    </div>
  );
}

function readApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
