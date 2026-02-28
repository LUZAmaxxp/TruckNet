"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Loader2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User className="h-6 w-6" /> My Profile
      </h1>

      {/* Avatar section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
          <CardDescription>Upload a profile picture (JPEG, PNG, WebP, GIF — max 5 MB)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {/* Avatar preview */}
          <div className={`relative w-24 h-24 rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center transition-all duration-300 ${preview ? 'border-primary ring-4 ring-primary/30' : 'border-border'}`}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.name}
                fill
                className="object-cover"
                unoptimized={avatarUrl.startsWith("blob:")}
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
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
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-1" />
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
                    onClick={() => void handleUpload()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : null}
                    Upload
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="font-medium text-sm">{profile.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium text-sm">{profile.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tag</span>
            <Badge variant="secondary" className="font-mono">{profile.tag}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm text-muted-foreground">
              {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
