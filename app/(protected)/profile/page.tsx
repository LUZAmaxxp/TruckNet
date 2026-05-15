"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Cpu, Loader2, Unlink, User, Wifi, WifiOff } from "lucide-react";
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

interface DeviceInfo {
  deviceId: string;
  truckLabel: string;
  status: string;
  lastSeenAt?: string | null;
}

interface AvailableDevice {
  deviceId: string;
  truckLabel: string;
  status: string;
  driverId: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Device state ──────────────────────────────────────────────────────────
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [deviceSaving, setDeviceSaving] = useState(false);

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

  async function fetchDevice() {
    setDeviceLoading(true);
    try {
      const [devRes, availRes] = await Promise.all([
        fetch("/api/profile/device"),
        fetch("/api/profile/device/available"),
      ]);
      if (devRes.ok) {
        const { device } = (await devRes.json()) as { device: DeviceInfo | null };
        setCurrentDevice(device);
        setSelectedDeviceId(device?.deviceId ?? "");
      }
      if (availRes.ok) {
        const { devices } = (await availRes.json()) as { devices: AvailableDevice[] };
        setAvailableDevices(devices);
      }
    } finally {
      setDeviceLoading(false);
    }
  }

  useEffect(() => {
    void fetchProfile();
    void fetchDevice();
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

  async function linkDevice() {
    if (!selectedDeviceId) return;
    setDeviceSaving(true);
    try {
      const res = await fetch("/api/profile/device", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: selectedDeviceId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to link device.");
        return;
      }
      const { device } = (await res.json()) as { device: DeviceInfo };
      setCurrentDevice(device);
      toast.success(`Linked to ${device.truckLabel}`);
    } finally {
      setDeviceSaving(false);
    }
  }

  async function unlinkDevice() {
    setDeviceSaving(true);
    try {
      const res = await fetch("/api/profile/device", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to unlink device.");
        return;
      }
      setCurrentDevice(null);
      setSelectedDeviceId("");
      // refresh available list after unlink
      const availRes = await fetch("/api/profile/device/available");
      if (availRes.ok) {
        const { devices } = (await availRes.json()) as { devices: AvailableDevice[] };
        setAvailableDevices(devices);
      }
      toast.success("Device unlinked.");
    } finally {
      setDeviceSaving(false);
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

      {/* My Device */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--hairline)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm" style={{ background: "var(--navy-lt)" }}>
            <Cpu className="h-4 w-4" style={{ color: "var(--navy)" }} />
          </div>
          <span className="font-display text-[14px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            My Truck Device
          </span>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--muted)" }}>
          Link your ESP32 sensor device so you receive real-time safety alerts.
        </p>

        {deviceLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--muted)" }} />
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>Loading devices…</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Current device badge */}
            {currentDevice && (
              <div
                className="flex items-center justify-between rounded-[8px] px-[14px] py-3"
                style={{ background: "var(--base)", border: "1px solid var(--hairline)" }}
              >
                <div className="flex items-center gap-2">
                  {currentDevice.status === "online" ? (
                    <Wifi className="h-4 w-4" style={{ color: "#22c55e" }} />
                  ) : (
                    <WifiOff className="h-4 w-4" style={{ color: "var(--muted)" }} />
                  )}
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{currentDevice.truckLabel}</p>
                    <p className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>{currentDevice.deviceId}</p>
                  </div>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: currentDevice.status === "online" ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                    color: currentDevice.status === "online" ? "#16a34a" : "var(--muted)",
                  }}
                >
                  {currentDevice.status}
                </span>
              </div>
            )}

            {/* Selector */}
            <div className="flex gap-2">
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="flex-1 rounded-[8px] border px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-[var(--navy)]"
                style={{
                  background: "var(--base)",
                  borderColor: "var(--hairline)",
                  color: "var(--ink)",
                }}
              >
                <option value="">— Select a device —</option>
                {availableDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.truckLabel} ({d.deviceId})
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant="primary"
                onClick={() => void linkDevice()}
                disabled={
                  deviceSaving ||
                  !selectedDeviceId ||
                  selectedDeviceId === currentDevice?.deviceId
                }
              >
                {deviceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>

            {/* Unlink */}
            {currentDevice && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void unlinkDevice()}
                disabled={deviceSaving}
                className="text-[12px]"
              >
                <Unlink className="h-3.5 w-3.5 mr-1.5" />
                Unlink device
              </Button>
            )}

            {availableDevices.length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                No devices available. Ask your admin to register a device first.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
