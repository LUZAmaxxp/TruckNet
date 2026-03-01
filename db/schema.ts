import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  doublePrecision,
  index,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// PostgreSQL Enums
// ---------------------------------------------------------------------------

export const voiceMessageStatusEnum = pgEnum("voice_message_status", [
  "delivered",
  "listened",
]);

export const textMessageStatusEnum = pgEnum("text_message_status", [
  "delivered",
  "read",
]);

export const stressSignalStatusEnum = pgEnum("stress_signal_status", [
  "active",
  "resolved",
]);

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "pending",
  "accepted",
  "rejected",
]);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tag: varchar("tag", { length: 20 }).notNull().unique(),
  tagNumber: integer("tag_number").notNull(),
  profileImageUrl: varchar("profile_image_url", { length: 255 }),
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
// friend_requests
// ---------------------------------------------------------------------------

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniquePair: unique("friend_requests_sender_receiver_unique").on(
      table.senderId,
      table.receiverId
    ),
  })
);

// ---------------------------------------------------------------------------
// text_messages
// ---------------------------------------------------------------------------

export const textMessages = pgTable(
  "text_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: textMessageStatusEnum("status").notNull().default("delivered"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    senderReceiverIdx: index("text_messages_sender_receiver_idx").on(
      table.senderId,
      table.receiverId
    ),
    createdAtIdx: index("text_messages_created_at_idx").on(table.createdAt),
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

export type FriendRequest = InferSelectModel<typeof friendRequests>;
export type NewFriendRequest = InferInsertModel<typeof friendRequests>;

export type TextMessage = InferSelectModel<typeof textMessages>;
export type NewTextMessage = InferInsertModel<typeof textMessages>;
