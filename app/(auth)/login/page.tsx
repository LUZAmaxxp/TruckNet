"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { UserLoginSchema } from "@/schemas/user.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = UserLoginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof typeof fieldErrors;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const res = await signIn("credentials", {
      email: result.data.email,
      password: result.data.password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setServerError("Invalid email or password.");
    } else {
      // Let middleware handle role-based redirect (admin → /admin, driver → /dashboard)
      router.push("/");
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "var(--base)" }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute top-0 right-0 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 70% 20%, rgba(28,58,94,0.07) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 90%, rgba(58,107,82,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[420px] p-8"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--hairline)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="h-9 w-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "var(--navy)", boxShadow: "var(--shadow-sm)" }}
          >
            <Truck className="h-5 w-5 text-white" />
          </div>
          <span
            className="font-display text-[16px] font-bold tracking-[-0.02em]"
            style={{ color: "var(--navy)" }}
          >
            TruckConnect
          </span>
        </div>

        {/* Heading */}
        <p
          className="font-mono text-[11px] uppercase tracking-wider mb-1"
          style={{ color: "var(--slate)" }}
        >
          Welcome back
        </p>
        <h1
          className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6"
          style={{ color: "var(--ink)" }}
        >
          Sign In
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div
              className="rounded-[10px] px-4 py-3"
              style={{
                background: "var(--terra-lt)",
                border: "1px solid rgba(184,80,57,0.25)",
              }}
            >
              <p className="font-body text-[13px]" style={{ color: "var(--terra)" }}>
                {serverError}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="font-body text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="driver@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && (
              <p className="font-body text-[12px]" style={{ color: "var(--terra)" }}>
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="font-body text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && (
              <p className="font-body text-[12px]" style={{ color: "var(--terra)" }}>
                {errors.password}
              </p>
            )}
          </div>

          <div className="pt-1 space-y-3">
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <p
              className="font-mono text-[10px] text-center uppercase tracking-wide"
              style={{ color: "var(--subtle)" }}
            >
              Admins are redirected to the fleet dashboard automatically.
            </p>

            <p className="font-body text-[13px] text-center" style={{ color: "var(--muted)" }}>
              No account?{" "}
              <Link
                href="/register"
                className="font-semibold hover:underline"
                style={{ color: "var(--navy)" }}
              >
                Create one
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
