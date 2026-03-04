"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  tag: string;
  profileImageUrl: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = (await res.json()) as ProfileData;
        setProfile(data);
      } else {
        toast.error("Failed to load profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchProfile();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select an image first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Avatar upload failed.");
        return;
      }

      const { profileImageUrl } = (await res.json()) as { profileImageUrl: string };
      setProfile((prev) => prev ? { ...prev, profileImageUrl } : prev);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Avatar updated successfully!");
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  const avatarUrl = preview ?? profile.profileImageUrl;
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-lg mx-auto space-y-6"
    >
      {/* Page header */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span className="inline-block h-[1.5px] w-4 rounded-full" style={{ background: "var(--navy-md)" }} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--navy-md)" }}>
            Account
          </span>
        </div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
          My Profile
        </h1>
      </div>

      {/* Avatar section */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm text-[16px]" style={{ background: "var(--navy-lt)" }}>
            <Camera className="h-4 w-4" style={{ color: "var(--navy)" }} />
          </div>
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            Avatar
          </span>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>
          Upload a profile picture (JPEG, PNG, WebP, GIF — max 5 MB)
        </p>

        <div className="flex flex-col items-center gap-4">
          {/* Avatar circle */}
          <div
            className={`relative h-24 w-24 overflow-hidden rounded-full flex items-center justify-center transition-all duration-300 ${preview ? "ring-[3px] ring-[rgba(28,58,94,0.25)]" : ""}`}
            style={{ border: "2px solid var(--hairline)", background: "var(--navy-lt)" }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.name}
                fill
                className="object-cover"
                unoptimized={avatarUrl.startsWith("blob:")}
              />
            ) : (
              <span className="font-display text-[22px] font-bold" style={{ color: "var(--navy)" }}>{initials}</span>
            )}
          </div>

          {/* File input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            id="avatar-input"
            onChange={handleFileChange}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-1.5" />
              Choose Image
            </Button>
            <AnimatePresence>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void handleUpload()}
                    disabled={uploading}
                  >
                    {uploading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    Upload
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm text-[16px]" style={{ background: "var(--navy-lt)" }}>
            <User className="h-4 w-4" style={{ color: "var(--navy)" }} />
          </div>
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            Account Details
          </span>
        </div>

        <div className="space-y-3">
          {[
            { label: "Name", value: profile.name },
            { label: "Email", value: profile.email },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-[8px] px-[14px] py-3"
              style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
            >
              <span className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{value}</span>
            </div>
          ))}
          <div
            className="flex items-center justify-between rounded-[8px] px-[14px] py-3"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
          >
            <span className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Tag</span>
            <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--navy)" }}>{profile.tag}</span>
          </div>
          <div
            className="flex items-center justify-between rounded-[8px] px-[14px] py-3"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
          >
            <span className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>Member since</span>
            <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
              {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
