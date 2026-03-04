"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRegisterSchema } from "@/schemas/user.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, LayoutDashboard, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [adminInviteCode, setAdminInviteCode] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    adminInviteCode?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = UserRegisterSchema.safeParse({
      name,
      email,
      password,
      role,
      adminInviteCode: role === "admin" ? adminInviteCode : undefined,
    });
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof typeof fieldErrors;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (role === "admin" && !adminInviteCode.trim()) {
      setErrors({ adminInviteCode: "Admin invite code is required." });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });

    setLoading(false);

    if (res.status === 409) {
      setServerError("An account with this email already exists.");
      return;
    }
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      setServerError((json as { error?: string }).error ?? "Access denied.");
      return;
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setServerError((json as { error?: string }).error ?? "Registration failed. Please try again.");
      return;
    }

    router.push("/login?registered=1");
  }

  const ROLES: { value: "driver" | "admin"; icon: React.ReactNode; label: string; description: string }[] = [
    {
      value: "driver",
      icon: <Truck className="h-6 w-6" />,
      label: "Truck Driver",
      description: "Track location, send messages & stress signals",
    },
    {
      value: "admin",
      icon: <LayoutDashboard className="h-6 w-6" />,
      label: "Fleet Admin",
      description: "Monitor fleet, manage drivers & respond to SOS",
    },
  ];

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "var(--base)" }}
    >
      {/* Subtle radial glows */}
      <div
        className="absolute top-0 right-0 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 70% 15%, rgba(28,58,94,0.07) 0%, transparent 60%)",
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
        className="relative w-full max-w-[480px] p-8"
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
          Get started
        </p>
        <h1
          className="font-display text-[28px] font-bold tracking-[-0.03em] mb-6"
          style={{ color: "var(--ink)" }}
        >
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div
              className="flex items-start gap-2.5 rounded-[10px] px-4 py-3"
              style={{
                background: "var(--terra-lt)",
                border: "1px solid rgba(184,80,57,0.25)",
              }}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--terra)" }} />
              <p className="font-body text-[13px]" style={{ color: "var(--terra)" }}>
                {serverError}
              </p>
            </div>
          )}

          {/* Role selector */}
          <div className="space-y-2">
            <Label
              className="font-body text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Account Type
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => {
                const isSelected = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className="flex flex-col items-center gap-2 p-4 rounded-[12px] transition-all text-left"
                    style={{
                      background: isSelected ? "var(--navy-lt)" : "var(--base)",
                      border: isSelected
                        ? "2px solid var(--navy-md)"
                        : "2px solid var(--hairline)",
                      boxShadow: isSelected ? "0 0 0 3px rgba(28,58,94,0.12)" : "none",
                    }}
                  >
                    <span style={{ color: isSelected ? "var(--navy)" : "var(--muted)" }}>
                      {r.icon}
                    </span>
                    <span
                      className="font-body text-[13px] font-semibold"
                      style={{ color: isSelected ? "var(--navy)" : "var(--ink)" }}
                    >
                      {r.label}
                    </span>
                    <span
                      className="font-body text-[11px] text-center leading-snug"
                      style={{ color: isSelected ? "var(--navy-md)" : "var(--muted)" }}
                    >
                      {r.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="font-body text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <p className="font-body text-[12px]" style={{ color: "var(--terra)" }}>
                {errors.name}
              </p>
            )}
          </div>

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
              placeholder={role === "admin" ? "admin@example.com" : "driver@example.com"}
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
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && (
              <p className="font-body text-[12px]" style={{ color: "var(--terra)" }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Admin invite code — only shown when admin role selected */}
          {role === "admin" && (
            <div
              className="space-y-1.5 rounded-[12px] p-4"
              style={{
                background: "var(--honey-lt)",
                border: "1px solid var(--honey)",
              }}
            >
              <Label
                htmlFor="adminInviteCode"
                className="font-body text-[13px] font-medium"
                style={{ color: "var(--ink)" }}
              >
                Admin Invite Code
              </Label>
              <Input
                id="adminInviteCode"
                type="password"
                placeholder="Enter invite code"
                value={adminInviteCode}
                onChange={(e) => setAdminInviteCode(e.target.value)}
                style={{ background: "var(--surface)" }}
              />
              {errors.adminInviteCode ? (
                <p className="font-body text-[12px]" style={{ color: "var(--terra)" }}>
                  {errors.adminInviteCode}
                </p>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--honey)" }}>
                  Contact your fleet manager for an invite code.
                </p>
              )}
            </div>
          )}

          <div className="pt-1 space-y-3">
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>

            <p className="font-body text-[13px] text-center" style={{ color: "var(--muted)" }}>
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold hover:underline"
                style={{ color: "var(--navy)" }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
