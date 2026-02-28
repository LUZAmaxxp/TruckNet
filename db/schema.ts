import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// PostgreSQL Enums
// ---------------------------------------------------------------------------

export const voiceMessageStatusEnum = pgEnum("voice_message_status", [
  "delivered",
  "listened",
]);

export const stressSignalStatusEnum = pgEnum("stress_signal_status", [
  "active",
  "resolved",
]);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// driver_locations
// ---------------------------------------------------------------------------

export const driverLocations = pgTable(
  "driver_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("driver_locations_user_id_idx").on(table.userId),
    updatedAtIdx: index("driver_locations_updated_at_idx").on(table.updatedAt),
  })
);

// ---------------------------------------------------------------------------
// voice_messages
// ---------------------------------------------------------------------------

export const voiceMessages = pgTable("voice_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  audioUrl: text("audio_url").notNull(),
  durationSeconds: doublePrecision("duration_seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: voiceMessageStatusEnum("status").notNull().default("delivered"),
});

// ---------------------------------------------------------------------------
// stress_signals
// ---------------------------------------------------------------------------

export const stressSignals = pgTable(
  "stress_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: stressSignalStatusEnum("status").notNull().default("active"),
  },
  (table) => ({
    statusCreatedAtIdx: index("stress_signals_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
  })
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type DriverLocation = InferSelectModel<typeof driverLocations>;
export type NewDriverLocation = InferInsertModel<typeof driverLocations>;

export type VoiceMessage = InferSelectModel<typeof voiceMessages>;
export type NewVoiceMessage = InferInsertModel<typeof voiceMessages>;

export type StressSignal = InferSelectModel<typeof stressSignals>;
export type NewStressSignal = InferInsertModel<typeof stressSignals>;
