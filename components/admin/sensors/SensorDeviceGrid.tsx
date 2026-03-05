"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Cpu } from "lucide-react";
import { type AdminSensorDeviceView } from "@/app/(admin)/admin/sensors/page";
import { SensorDeviceCard } from "@/components/admin/sensors/SensorDeviceCard";

interface SensorDeviceGridProps {
  devices: AdminSensorDeviceView[];
}

export function SensorDeviceGrid({ devices }: SensorDeviceGridProps) {
  const router = useRouter();

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cpu className="mb-3 h-10 w-10" style={{ color: "var(--hairline)" }} />
        <p
          className="font-display text-[15px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          No devices registered
        </p>
        <p className="mt-1 font-body text-[13px]" style={{ color: "var(--muted)" }}>
          Register an ESP32 device to start monitoring cargo conditions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {devices.map((device, i) => (
        <motion.div
          key={device.deviceId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: i * 0.04, ease: "easeOut" }}
        >
          <SensorDeviceCard
            device={device}
            onClick={() => router.push(`/admin/sensors/${device.deviceId}`)}
          />
        </motion.div>
      ))}
    </div>
  );
}
