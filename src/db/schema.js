import {integer, pgTable,text,time,timestamp,uuid,customType,index,jsonb,pgEnum,uniqueIndex} from "drizzle-orm/pg-core";


export const users= pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true}).notNull().defaultNow(),
});

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  slotMinutes: integer("slot_minutes").notNull(),
  openTime: time("open_time").notNull(),
  closeTime: time("close_time").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});


const timestampRange = customType({
  dataType() {
    return "tstzrange";
  },
});

export const bookingStatus = pgEnum("booking_status", [
  "held",
  "confirmed",
  "cancelled",
  "expired",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    during: timestampRange("during").notNull(),
    status: bookingStatus("status").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("bookings_user_created_idx").on(table.userId, table.createdAt),
    index("bookings_status_expiry_idx").on(
      table.status,
      table.holdExpiresAt,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_user_key_idx").on(
      table.userId,
      table.key,
    ),
  ],
);