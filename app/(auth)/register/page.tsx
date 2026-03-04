"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRegisterSchema } from "@/schemas/user.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, LayoutDashboard } from "lucide-react";

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Truck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join TruckConnect today</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {serverError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                {serverError}
              </p>
            )}

            {/* Role selector */}
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["driver", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      role === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {r === "driver" ? (
                      <Truck className="h-7 w-7" />
                    ) : (
                      <LayoutDashboard className="h-7 w-7" />
                    )}
                    <span className="font-semibold text-sm">
                      {r === "driver" ? "Truck Driver" : "Fleet Admin"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={role === "admin" ? "admin@example.com" : "driver@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {/* Admin invite code — only shown when admin role is selected */}
            {role === "admin" && (
              <div className="space-y-1">
                <Label htmlFor="adminInviteCode">Admin Invite Code</Label>
                <Input
                  id="adminInviteCode"
                  type="password"
                  placeholder="Enter invite code"
                  value={adminInviteCode}
                  onChange={(e) => setAdminInviteCode(e.target.value)}
                />
                {errors.adminInviteCode && (
                  <p className="text-xs text-destructive">{errors.adminInviteCode}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Contact your fleet manager for an invite code.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
