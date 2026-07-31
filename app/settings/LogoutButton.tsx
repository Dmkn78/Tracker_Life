"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <IconButton onClick={logout}>
      <LogOut className="h-4 w-4" />
      Log out
    </IconButton>
  );
}
