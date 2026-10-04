"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { PrimaryButton } from "@/components/ui";
import { loginSession } from "@/features/auth/api/sessionApi";
import { loginDestination } from "@/features/android/domain/websiteVersion";

export default function LoginPage() {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginSession(accessKey);
      router.push(loginDestination(new URLSearchParams(location.search).get("returnTo")));
      router.refresh();
    } catch {
      setError("Access key was not accepted.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-panel p-5 shadow-2xl shadow-black/20">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent/10 text-accent">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-50">Life Regime Tracker</h1>
            <p className="text-sm text-slate-400">Enter your local access key.</p>
          </div>
        </div>
        <input
          autoFocus
          type="password"
          value={accessKey}
          onChange={(event) => setAccessKey(event.target.value)}
          className="focus-ring h-11 w-full rounded-md border border-line bg-shell px-3 text-slate-100 placeholder:text-slate-500"
          placeholder="Access key"
        />
        {error ? <p className="mt-3 text-sm font-medium text-risk">{error}</p> : null}
        <PrimaryButton disabled={loading || accessKey.length === 0} className="mt-4 w-full">
          {loading ? "Checking..." : "Unlock"}
        </PrimaryButton>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Set <code>APP_ACCESS_KEY</code> in <code>.env</code>. In development only, the fallback key is{" "}
          <code>dev-access-key</code>.
        </p>
      </form>
    </main>
  );
}
