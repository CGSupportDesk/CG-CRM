"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button, FieldLabel, inputClasses } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Invalid Growth Engine login details.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <FieldLabel label="Username">
        <input
          className={inputClasses}
          value={username}
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="captain"
        />
      </FieldLabel>
      <FieldLabel label="Password">
        <input
          className={inputClasses}
          value={password}
          type="password"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
        />
      </FieldLabel>
      {error ? (
        <p className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-3 text-sm font-semibold text-[#bd2727]">
          {error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={loading}>
        <LockKeyhole className="h-4 w-4" />
        {loading ? "Checking..." : "Login to Growth Engine"}
      </Button>
    </form>
  );
}
