import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  real,
  timestamp,
  doublePrecision,
  index,
  unique,
  boolean,
  json,
  date,
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// PostgreSQL Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["driver", "admin"]);

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

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    tag: varchar("tag", { length: 20 }).notNull().unique(),
    tagNumber: integer("tag_number").notNull(),
    profileImageUrl: varchar("profile_image_url", { length: 255 }),
    role: userRoleEnum("role").notNull().default("driver"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    roleIdx: index("users_role_idx").on(table.role),
  })
);

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
// call_history
// ---------------------------------------------------------------------------

export const callTypeEnum = pgEnum("call_type", ["voice", "video"]);

export const callStatusEnum = pgEnum("call_status", [
  "ongoing",
  "completed",
  "missed",
  "declined",
]);

export const routeStatusEnum = pgEnum("route_status", [
  "active",
  "completed",
  "cancelled",
]);

export const callHistory = pgTable(
  "call_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomName: varchar("room_name", { length: 100 }).notNull().unique(),
    callerId: uuid("caller_id").references(() => users.id, { onDelete: "set null" }),
    calleeId: uuid("callee_id").references(() => users.id, { onDelete: "set null" }),
    callType: callTypeEnum("call_type").notNull(),
    status: callStatusEnum("status").notNull().default("ongoing"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    callerIdIdx: index("call_history_caller_id_idx").on(table.callerId),
    calleeIdIdx: index("call_history_callee_id_idx").on(table.calleeId),
    createdAtIdx: index("call_history_created_at_idx").on(table.createdAt),
  })
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserRole = (typeof userRoleEnum.enumValues)[number];

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

export type CallHistory = InferSelectModel<typeof callHistory>;
export type NewCallHistory = InferInsertModel<typeof callHistory>;

// ---------------------------------------------------------------------------
// driver_routes
// ---------------------------------------------------------------------------

export const driverRoutes = pgTable(
  "driver_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originLat: doublePrecision("origin_lat").notNull(),
    originLng: doublePrecision("origin_lng").notNull(),
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),
    destinationLabel: text("destination_label").notNull(),
    /** GeoJSON LineString coordinates array [[lng,lat], ...] stored as JSON */
    routeGeometry: json("route_geometry").notNull().$type<[number, number][]>(),
    distanceMeters: doublePrecision("distance_meters").notNull(),
    durationSeconds: doublePrecision("duration_seconds").notNull(),
    status: routeStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    driverIdStatusIdx: index("driver_routes_driver_id_status_idx").on(
      table.driverId,
      table.status
    ),
    statusCreatedAtIdx: index("driver_routes_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
  })
);

export type DriverRoute = InferSelectModel<typeof driverRoutes>;
export type NewDriverRoute = InferInsertModel<typeof driverRoutes>;

// ---------------------------------------------------------------------------
// IoT Device + Sensor Enums
// ---------------------------------------------------------------------------

export const deviceStatusEnum = pgEnum("device_status", [
  "online",
  "offline",
  "unknown",
]);

export const sensorAlertTypeEnum = pgEnum("sensor_alert_type", [
  "temp_high",
  "temp_low",
  "humidity_high",
  "vibration_high",
]);

export const sensorAlertStatusEnum = pgEnum("sensor_alert_status", [
  "active",
  "acknowledged",
]);

// ---------------------------------------------------------------------------
// iot_devices
// ---------------------------------------------------------------------------

export const iotDevices = pgTable(
  "iot_devices",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    deviceId:        varchar("device_id", { length: 50 }).unique().notNull(),
    driverId:        uuid("driver_id").references(() => users.id, { onDelete: "set null" }),
    truckLabel:      varchar("truck_label", { length: 100 }).notNull(),
    status:          deviceStatusEnum("status").notNull().default("unknown"),
    lastSeenAt:      timestamp("last_seen_at", { withTimezone: true }),
    firmwareVersion: varchar("firmware_version", { length: 20 }),
    alertConfig:     json("alert_config").notNull().default({ temp_min_c: 2, temp_max_c: 8, humidity_max_pct: 85, vibration_max_g: 0.5 }),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deviceIdIdx: index("iot_devices_device_id_idx").on(t.deviceId),
    statusIdx:   index("iot_devices_status_idx").on(t.status),
  })
);

// ---------------------------------------------------------------------------
// sensor_readings
// ---------------------------------------------------------------------------

export const sensorReadings = pgTable(
  "sensor_readings",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    deviceId:           varchar("device_id", { length: 50 }).notNull(),
    recordedAt:         timestamp("recorded_at", { withTimezone: true }).notNull(),
    temperatureC:       real("temperature_c").notNull(),
    humidityPct:        real("humidity_pct").notNull(),
    vibrationMagnitude: real("vibration_magnitude").notNull(),
    accelX:             real("accel_x").notNull(),
    accelY:             real("accel_y").notNull(),
    accelZ:             real("accel_z").notNull(),
  },
  (t) => ({
    deviceTimeIdx: index("sensor_readings_device_time_idx").on(t.deviceId, t.recordedAt),
    timeIdx:       index("sensor_readings_time_idx").on(t.recordedAt),
  })
);

// ---------------------------------------------------------------------------
// sensor_alerts
// ---------------------------------------------------------------------------

export const sensorAlerts = pgTable(
  "sensor_alerts",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    deviceId:    varchar("device_id", { length: 50 }).notNull(),
    driverId:    uuid("driver_id").references(() => users.id, { onDelete: "set null" }),
    alertType:   sensorAlertTypeEnum("alert_type").notNull(),
    value:       real("value").notNull(),
    threshold:   real("threshold").notNull(),
    status:      sensorAlertStatusEnum("status").notNull().default("active"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull(),
    ackedAt:     timestamp("acked_at", { withTimezone: true }),
    ackedBy:     uuid("acked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    deviceStatusIdx: index("sensor_alerts_device_status_idx").on(t.deviceId, t.status),
    statusTimeIdx:   index("sensor_alerts_status_time_idx").on(t.status, t.triggeredAt),
  })
);

export type IotDevice = InferSelectModel<typeof iotDevices>;
export type NewIotDevice = InferInsertModel<typeof iotDevices>;

export type SensorReading = InferSelectModel<typeof sensorReadings>;
export type NewSensorReading = InferInsertModel<typeof sensorReadings>;

export type SensorAlert = InferSelectModel<typeof sensorAlerts>;
export type NewSensorAlert = InferInsertModel<typeof sensorAlerts>;

// ===========================================================================
// ESG / CSRD — FEAT-008
// ===========================================================================

// ---------------------------------------------------------------------------
// ESG Enums
// ---------------------------------------------------------------------------

export const fuelTypeEnum = pgEnum("fuel_type", [
  "diesel",
  "petrol",
  "lpg",
  "electric",
  "hydrogen",
  "cng",
  "other",
]);

export const reportPeriodEnum = pgEnum("report_period", [
  "weekly",
  "monthly",
  "quarterly",
  "custom",
]);

export const shiftStatusEnum = pgEnum("shift_status", [
  "active",
  "completed",
  "cancelled",
]);

export const maintenanceTypeEnum = pgEnum("maintenance_type", [
  "oil_change",
  "tire_replacement",
  "brake_service",
  "technical_inspection",
  "filter_replacement",
  "battery",
  "bodywork",
  "fuel_fill",
  "other",
]);

export const trainingTypeEnum = pgEnum("training_type", [
  "license_renewal",
  "adr_certification",
  "eco_driving",
  "defensive_driving",
  "first_aid",
  "cargo_handling",
  "digital_tools",
  "other",
]);

export const contractTypeEnum = pgEnum("contract_type", [
  "cdi",
  "cdd",
  "interim",
  "apprenticeship",
  "other",
]);

export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
]);

// ---------------------------------------------------------------------------
// transport_trips — trip log per driver, base for all ESG transport metrics
// ---------------------------------------------------------------------------

export const transportTrips = pgTable(
  "transport_trips",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    driverId:         uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    routeId:          uuid("route_id").references(() => driverRoutes.id, { onDelete: "set null" }),
    vehiclePlate:     varchar("vehicle_plate", { length: 20 }).notNull(),
    originLabel:      text("origin_label"),
    destinationLabel: text("destination_label"),
    distanceKm:       real("distance_km"),
    durationMinutes:  real("duration_minutes"),
    fuelLiters:       real("fuel_liters"),
    fuelType:         fuelTypeEnum("fuel_type"),
    cargoWeightKg:    real("cargo_weight_kg"),
    /** true when truck returns with no cargo — ESRS E1 empty run metric */
    isEmptyRun:       boolean("is_empty_run").notNull().default(false),
    /** cargo weight / max payload × 100; null if not tracked */
    loadFactorPct:    real("load_factor_pct"),
    startedAt:        timestamp("started_at",  { withTimezone: true }),
    completedAt:      timestamp("completed_at", { withTimezone: true }),
    status:           routeStatusEnum("status").notNull().default("active"),
    /** FK set after behaviour report is generated on trip completion */
    behaviourReportId: uuid("behaviour_report_id"),
    createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:        uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    driverIdIdx:      index("transport_trips_driver_id_idx").on(t.driverId),
    statusIdx:        index("transport_trips_status_idx").on(t.status),
    startedAtIdx:     index("transport_trips_started_at_idx").on(t.startedAt),
    driverStatusIdx:  index("transport_trips_driver_status_idx").on(t.driverId, t.status),
  })
);

export type TransportTrip    = InferSelectModel<typeof transportTrips>;
export type NewTransportTrip = InferInsertModel<typeof transportTrips>;

// ---------------------------------------------------------------------------
// driver_profiles — HR / diversity profile (ESRS S1-12)
// ---------------------------------------------------------------------------

export const driverProfiles = pgTable(
  "driver_profiles",
  {
    id:                       uuid("id").primaryKey().defaultRandom(),
    /** 1-to-1 with users (role=driver) */
    driverId:                 uuid("driver_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    gender:                   genderEnum("gender"),
    /** Year only (GDPR: no full DOB) */
    birthYear:                integer("birth_year"),
    nationality:              varchar("nationality", { length: 100 }),
    contractType:             contractTypeEnum("contract_type"),
    contractStartDate:        date("contract_start_date"),
    /** null for CDI (permanent contract) */
    contractEndDate:          date("contract_end_date"),
    /** Contractual hours per week */
    weeklyHoursContractual:   real("weekly_hours_contractual"),
    /** string[] e.g. ['B','C','CE','D'] */
    drivingLicenseCategories: json("driving_license_categories").notNull().default([]).$type<string[]>(),
    licenseObtainedYear:      integer("license_obtained_year"),
    createdAt:                timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:                timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:                uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    driverIdIdx: index("driver_profiles_driver_id_idx").on(t.driverId),
  })
);

export type DriverProfile    = InferSelectModel<typeof driverProfiles>;
export type NewDriverProfile = InferInsertModel<typeof driverProfiles>;

// ---------------------------------------------------------------------------
// driver_shifts — shift log (ESRS S1-7: working time, overtime, rest)
// ---------------------------------------------------------------------------

export const driverShifts = pgTable(
  "driver_shifts",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    driverId:        uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tripId:          uuid("trip_id").references(() => transportTrips.id, { onDelete: "set null" }),
    shiftDate:       date("shift_date").notNull(),
    startedAt:       timestamp("started_at",  { withTimezone: true }).notNull(),
    /** null while shift is still active */
    endedAt:         timestamp("ended_at",    { withTimezone: true }),
    breakMinutes:    integer("break_minutes").notNull().default(0),
    /** computed: (endedAt - startedAt) in minutes - breakMinutes */
    drivingMinutes:  integer("driving_minutes"),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    /** shift spans 22:00-06:00 window */
    nightShift:      boolean("night_shift").notNull().default(false),
    status:          shiftStatusEnum("status").notNull().default("active"),
    driverNotes:     text("driver_notes"),
    createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:       uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    driverIdIdx:  index("driver_shifts_driver_id_idx").on(t.driverId),
    shiftDateIdx: index("driver_shifts_shift_date_idx").on(t.shiftDate),
    driverDateIdx:index("driver_shifts_driver_date_idx").on(t.driverId, t.shiftDate),
  })
);

export type DriverShift    = InferSelectModel<typeof driverShifts>;
export type NewDriverShift = InferInsertModel<typeof driverShifts>;

// ---------------------------------------------------------------------------
// vehicle_maintenance_logs — service records (ESRS E5, G1)
// ---------------------------------------------------------------------------

export const vehicleMaintenanceLogs = pgTable(
  "vehicle_maintenance_logs",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    driverId:            uuid("driver_id").references(() => users.id, { onDelete: "set null" }),
    vehiclePlate:        varchar("vehicle_plate", { length: 20 }).notNull(),
    maintenanceType:     maintenanceTypeEnum("maintenance_type").notNull(),
    performedAt:         date("performed_at").notNull(),
    odometerKm:          real("odometer_km"),
    costEur:             real("cost_eur"),
    /** fuel_fill type only */
    fuelLiters:          real("fuel_liters"),
    fuelType:            fuelTypeEnum("fuel_type"),
    providerName:        varchar("provider_name", { length: 200 }),
    nextDueAt:           date("next_due_at"),
    nextDueKm:           real("next_due_km"),
    /** passed inspection / meets regulation */
    regulatoryCompliant: boolean("regulatory_compliant").notNull().default(true),
    notes:               text("notes"),
    /** invoice/certificate URL */
    documentUrl:         varchar("document_url", { length: 500 }),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:           uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    driverIdIdx:     index("vehicle_maintenance_driver_id_idx").on(t.driverId),
    vehiclePlateIdx: index("vehicle_maintenance_plate_idx").on(t.vehiclePlate),
    performedAtIdx:  index("vehicle_maintenance_performed_at_idx").on(t.performedAt),
    typeIdx:         index("vehicle_maintenance_type_idx").on(t.maintenanceType),
  })
);

export type VehicleMaintenanceLog    = InferSelectModel<typeof vehicleMaintenanceLogs>;
export type NewVehicleMaintenanceLog = InferInsertModel<typeof vehicleMaintenanceLogs>;

// ---------------------------------------------------------------------------
// driver_training_records — training + certifications (ESRS S1-13)
// ---------------------------------------------------------------------------

export const driverTrainingRecords = pgTable(
  "driver_training_records",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    driverId:            uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trainingType:        trainingTypeEnum("training_type").notNull(),
    title:               varchar("title", { length: 200 }).notNull(),
    provider:            varchar("provider", { length: 200 }),
    completedAt:         date("completed_at").notNull(),
    durationHours:       real("duration_hours").notNull(),
    costEur:             real("cost_eur"),
    certificationNumber: varchar("certification_number", { length: 100 }),
    /** expiry date for certifications */
    expiryDate:          date("expiry_date"),
    passed:              boolean("passed").notNull().default(true),
    notes:               text("notes"),
    documentUrl:         varchar("document_url", { length: 500 }),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:           uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    driverIdIdx:    index("driver_training_driver_id_idx").on(t.driverId),
    completedAtIdx: index("driver_training_completed_at_idx").on(t.completedAt),
    trainingTypeIdx:index("driver_training_type_idx").on(t.trainingType),
    expiryDateIdx:  index("driver_training_expiry_date_idx").on(t.expiryDate),
  })
);

export type DriverTrainingRecord    = InferSelectModel<typeof driverTrainingRecords>;
export type NewDriverTrainingRecord = InferInsertModel<typeof driverTrainingRecords>;

// ---------------------------------------------------------------------------
// driver_esg_reports — compiled report records (KPI snapshot + status)
// ---------------------------------------------------------------------------

export const driverEsgReports = pgTable(
  "driver_esg_reports",
  {
    id:                          uuid("id").primaryKey().defaultRandom(),
    driverId:                    uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodType:                  reportPeriodEnum("period_type").notNull(),
    periodStart:                 date("period_start").notNull(),
    periodEnd:                   date("period_end").notNull(),
    // ── KPI snapshot (stored at generation time) ──
    totalTrips:                  integer("total_trips").notNull().default(0),
    emptyRunCount:               integer("empty_run_count").notNull().default(0),
    emptyRunPct:                 real("empty_run_pct"),
    totalDistanceKm:             real("total_distance_km").notNull().default(0),
    totalDrivingHours:           real("total_driving_hours").notNull().default(0),
    totalShiftHours:             real("total_shift_hours").notNull().default(0),
    totalOvertimeHours:          real("total_overtime_hours").notNull().default(0),
    totalFuelLiters:             real("total_fuel_liters").notNull().default(0),
    totalGhgKgco2eq:             real("total_ghg_kgco2eq").notNull().default(0),
    ghgIntensityPerKm:           real("ghg_intensity_per_km"),
    ghgIntensityPerTonneKm:      real("ghg_intensity_per_tonne_km"),
    incidentCount:               integer("incident_count").notNull().default(0),
    workStoppageCount:           integer("work_stoppage_count").notNull().default(0),
    cargoBreachCount:            integer("cargo_breach_count").notNull().default(0),
    avgCargoTempC:               real("avg_cargo_temp_c"),
    maintenanceCount:            integer("maintenance_count").notNull().default(0),
    trainingHours:               real("training_hours").notNull().default(0),
    certificationsCount:         integer("certifications_count").notNull().default(0),
    expiringCertificationsCount: integer("expiring_certifications_count").notNull().default(0),
    // ── Source record IDs ──
    tripIds:             json("trip_ids").notNull().default([]).$type<string[]>(),
    shiftIds:            json("shift_ids").notNull().default([]).$type<string[]>(),
    incidentIds:         json("incident_ids").notNull().default([]).$type<string[]>(),
    maintenanceIds:      json("maintenance_ids").notNull().default([]).$type<string[]>(),
    trainingIds:         json("training_ids").notNull().default([]).$type<string[]>(),
    sensorReadingCount:  integer("sensor_reading_count").notNull().default(0),
    // ── Status ──
    /** generating | ready | failed */
    status:         varchar("status", { length: 20 }).notNull().default("generating"),
    errorMessage:   text("error_message"),
    generatedAt:    timestamp("generated_at", { withTimezone: true }),
    generatedBy:    uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    driverIdIdx: index("driver_esg_reports_driver_id_idx").on(t.driverId),
    periodIdx:   index("driver_esg_reports_period_idx").on(t.periodStart, t.periodEnd),
    statusIdx:   index("driver_esg_reports_status_idx").on(t.status),
  })
);

export type DriverEsgReport    = InferSelectModel<typeof driverEsgReports>;
export type NewDriverEsgReport = InferInsertModel<typeof driverEsgReports>;

// ---------------------------------------------------------------------------
// esg_report_schedules — automated report generation config
// ---------------------------------------------------------------------------

export const esgReportSchedules = pgTable(
  "esg_report_schedules",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    periodType:          reportPeriodEnum("period_type").notNull(),
    active:              boolean("active").notNull().default(true),
    /** email address to send completed reports to HR */
    hrEmail:             varchar("hr_email", { length: 300 }).notNull(),
    language:            varchar("language", { length: 10 }).notNull().default("fr"),
    nextRunAt:           date("next_run_at").notNull(),
    lastRunAt:           date("last_run_at"),
    lastRunReportCount:  integer("last_run_report_count"),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:           uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  }
);

export type EsgReportSchedule    = InferSelectModel<typeof esgReportSchedules>;
export type NewEsgReportSchedule = InferInsertModel<typeof esgReportSchedules>;

// ===========================================================================
// FEAT-009 — Driver Behaviour Report
// ===========================================================================

export const drivingEventTypeEnum = pgEnum("driving_event_type", [
  "speed_violation",
  "harsh_braking",
  "harsh_acceleration",
  "sudden_swerve",
  "drowsiness_alert",
  "microsleep_alert",
  "distraction_alert",
  "idle_excess",
  "sos_triggered",
]);

export const drivingEventSeverityEnum = pgEnum("driving_event_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const eventSourceEnum = pgEnum("event_source", [
  "gps",
  "esp32",
  "ai_camera",
  "driver",
]);

// ---------------------------------------------------------------------------
// driving_events — immutable event log from all 3 streams
// ---------------------------------------------------------------------------

export const drivingEvents = pgTable(
  "driving_events",
  {
    eventId:             uuid("event_id").primaryKey().defaultRandom(),
    driverId:            uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tripId:              uuid("trip_id").notNull().references(() => transportTrips.id, { onDelete: "cascade" }),
    eventType:           drivingEventTypeEnum("event_type").notNull(),
    severity:            drivingEventSeverityEnum("severity").notNull().default("low"),
    source:              eventSourceEnum("source").notNull(),
    occurredAt:          timestamp("occurred_at", { withTimezone: true }).notNull(),
    durationSeconds:     real("duration_seconds"),
    gpsLat:              real("gps_lat"),
    gpsLng:              real("gps_lng"),
    gpsSpeedKmh:         real("gps_speed_kmh"),
    speedLimitKmh:       real("speed_limit_kmh"),
    speedExcessKmh:      real("speed_excess_kmh"),
    vibrationMagnitude:  real("vibration_magnitude"),
    accelX:              real("accel_x"),
    accelY:              real("accel_y"),
    accelZ:              real("accel_z"),
    earValue:            real("ear_value"),
    headAngleDeg:        real("head_angle_deg"),
    confidence:          real("confidence"),
    idleDurationMinutes: real("idle_duration_minutes"),
    metadata:            json("metadata"),
    createdAt:           timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    driverIdIdx:  index("driving_events_driver_id_idx").on(t.driverId),
    tripIdIdx:    index("driving_events_trip_id_idx").on(t.tripId),
    eventTypeIdx: index("driving_events_event_type_idx").on(t.eventType),
    occurredAtIdx: index("driving_events_occurred_at_idx").on(t.occurredAt),
    sourceIdx:    index("driving_events_source_idx").on(t.source),
  })
);

export type DrivingEvent    = InferSelectModel<typeof drivingEvents>;
export type NewDrivingEvent = InferInsertModel<typeof drivingEvents>;

// ---------------------------------------------------------------------------
// behaviour_reports — per-trip compiled report (one per trip)
// ---------------------------------------------------------------------------

export const behaviourReports = pgTable(
  "behaviour_reports",
  {
    behaviourReportId:     uuid("behaviour_report_id").primaryKey().defaultRandom(),
    driverId:              uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tripId:                uuid("trip_id").notNull().unique().references(() => transportTrips.id, { onDelete: "cascade" }),
    // ── Scores ──
    globalScore:           integer("global_score").notNull(),
    speedScore:            integer("speed_score").notNull(),
    drivingStyleScore:     integer("driving_style_score").notNull(),
    fatigueScore:          integer("fatigue_score").notNull(),
    idleScore:             integer("idle_score").notNull(),
    // ── Event counts ──
    speedViolationCount:   integer("speed_violation_count").notNull().default(0),
    maxSpeedRecordedKmh:   real("max_speed_recorded_kmh"),
    maxSpeedExcessKmh:     real("max_speed_excess_kmh"),
    harshBrakingCount:     integer("harsh_braking_count").notNull().default(0),
    harshAccelerationCount: integer("harsh_acceleration_count").notNull().default(0),
    suddenSwerveCount:     integer("sudden_swerve_count").notNull().default(0),
    drowsinessAlertCount:  integer("drowsiness_alert_count").notNull().default(0),
    microsleepAlertCount:  integer("microsleep_alert_count").notNull().default(0),
    distractionAlertCount: integer("distraction_alert_count").notNull().default(0),
    idleExcessCount:       integer("idle_excess_count").notNull().default(0),
    totalIdleMinutes:      real("total_idle_minutes").notNull().default(0),
    sosCount:              integer("sos_count").notNull().default(0),
    // ── Summary ──
    totalEvents:           integer("total_events").notNull().default(0),
    criticalEvents:        integer("critical_events").notNull().default(0),
    tripDistanceKm:        real("trip_distance_km"),
    tripDurationHours:     real("trip_duration_hours"),
    eventsPer100km:        real("events_per_100km"),
    // ── Status / review ──
    status:                varchar("status", { length: 20 }).notNull().default("generating"),
    adminReviewed:         boolean("admin_reviewed").notNull().default(false),
    adminReviewedBy:       uuid("admin_reviewed_by").references(() => users.id, { onDelete: "set null" }),
    adminReviewedAt:       timestamp("admin_reviewed_at", { withTimezone: true }),
    adminNote:             text("admin_note"),
    generatedAt:           timestamp("generated_at", { withTimezone: true }),
    createdAt:             timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:             timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    driverIdIdx:    index("behaviour_reports_driver_id_idx").on(t.driverId),
    tripIdIdx:      index("behaviour_reports_trip_id_idx").on(t.tripId),
    globalScoreIdx: index("behaviour_reports_global_score_idx").on(t.globalScore),
    generatedAtIdx: index("behaviour_reports_generated_at_idx").on(t.generatedAt),
  })
);

export type BehaviourReport    = InferSelectModel<typeof behaviourReports>;
export type NewBehaviourReport = InferInsertModel<typeof behaviourReports>;

// ---------------------------------------------------------------------------
// behaviour_scoring_config — per-company configurable thresholds & weights
// (one row per company; if none exists system uses built-in defaults)
// ---------------------------------------------------------------------------

export const behaviourScoringConfig = pgTable(
  "behaviour_scoring_config",
  {
    configId:                     uuid("config_id").primaryKey().defaultRandom(),
    // ── ESP32 thresholds ──
    harshBrakingThresholdG:       real("harsh_braking_threshold_g").notNull().default(0.4),
    harshAccelerationThresholdG:  real("harsh_acceleration_threshold_g").notNull().default(0.35),
    swerveThresholdG:             real("swerve_threshold_g").notNull().default(0.3),
    // ── GPS thresholds ──
    speedViolationExcessKmh:      real("speed_violation_excess_kmh").notNull().default(10),
    idleExcessMinutes:            real("idle_excess_minutes").notNull().default(10),
    // ── Camera AI thresholds ──
    earDrowsyThreshold:           real("ear_drowsy_threshold").notNull().default(0.25),
    earMicrosleepThreshold:       real("ear_microsleep_threshold").notNull().default(0.20),
    drowsyDurationSeconds:        real("drowsy_duration_seconds").notNull().default(2.0),
    microsleepDurationSeconds:    real("microsleep_duration_seconds").notNull().default(3.0),
    headAngleDistractionDeg:      real("head_angle_distraction_deg").notNull().default(30),
    distractionDurationSeconds:   real("distraction_duration_seconds").notNull().default(3.0),
    // ── Score weights (should sum to 100) ──
    weightSpeed:                  integer("weight_speed").notNull().default(25),
    weightDrivingStyle:           integer("weight_driving_style").notNull().default(20),
    weightFatigue:                integer("weight_fatigue").notNull().default(30),
    weightIdle:                   integer("weight_idle").notNull().default(10),
    weightSos:                    integer("weight_sos").notNull().default(15),
    // ── Deductions ──
    deductionSpeedMinor:          integer("deduction_speed_minor").notNull().default(5),
    deductionSpeedMajor:          integer("deduction_speed_major").notNull().default(10),
    deductionHarshBraking:        integer("deduction_harsh_braking").notNull().default(3),
    deductionHarshAcceleration:   integer("deduction_harsh_acceleration").notNull().default(3),
    deductionSwerve:              integer("deduction_swerve").notNull().default(5),
    deductionDrowsiness:          integer("deduction_drowsiness").notNull().default(15),
    deductionMicrosleep:          integer("deduction_microsleep").notNull().default(25),
    deductionDistraction:         integer("deduction_distraction").notNull().default(8),
    deductionIdlePer10min:        integer("deduction_idle_per_10min").notNull().default(2),
    deductionSos:                 integer("deduction_sos").notNull().default(20),
    createdAt:                    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt:                    timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy:                    uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  }
);

export type BehaviourScoringConfig    = InferSelectModel<typeof behaviourScoringConfig>;
export type NewBehaviourScoringConfig = InferInsertModel<typeof behaviourScoringConfig>;

// ---------------------------------------------------------------------------
// gps_tracks — raw GPS positions per trip (for live map + event geo-context)
// ---------------------------------------------------------------------------

export const gpsTracks = pgTable(
  "gps_tracks",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    tripId:     uuid("trip_id").notNull().references(() => transportTrips.id, { onDelete: "cascade" }),
    driverId:   uuid("driver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lat:        real("lat").notNull(),
    lng:        real("lng").notNull(),
    speedKmh:      real("speed_kmh"),
    speedLimitKmh: real("speed_limit_kmh"),
    headingDeg:    real("heading_deg"),
    accuracyM:  real("accuracy_m"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    tripTimeIdx:   index("gps_tracks_trip_time_idx").on(t.tripId, t.recordedAt),
    driverTimeIdx: index("gps_tracks_driver_time_idx").on(t.driverId, t.recordedAt),
  })
);

export type GpsTrack    = InferSelectModel<typeof gpsTracks>;
export type NewGpsTrack = InferInsertModel<typeof gpsTracks>;
