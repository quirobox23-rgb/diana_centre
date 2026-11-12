import { pgTable, serial, text, integer, boolean, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#c06a44"),
  capacity: integer("capacity").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const professionals = pgTable("professionals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  specialty: text("specialty"),
  color: text("color").notNull().default("#866353"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Facial"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("45.00"),
  description: text("description"),
  defaultRoomId: integer("default_room_id").references(() => rooms.id),
  color: text("color").notNull().default("#a85436"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Diumenge, 1 = Dilluns, ... 6 = Dissabte
  dayName: text("day_name").notNull(),
  isOpen: boolean("is_open").notNull().default(true),
  morningStart: text("morning_start").notNull().default("09:30"),
  morningEnd: text("morning_end").notNull().default("13:30"),
  afternoonStart: text("afternoon_start").notNull().default("15:30"),
  afternoonEnd: text("afternoon_end").notNull().default("20:00"),
  notes: text("notes"),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  allergies: text("allergies"),
  preferences: text("preferences"),
  birthday: text("birthday"), // YYYY-MM-DD
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tractaments habituals de cada clienta, amb la seva durada i professional preferida.
// Ex.: la depilació a la Maria li porta 50 min i a l'Eva 30 min.
export const clientTreatments = pgTable("client_treatments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  durationMinutes: integer("duration_minutes"),
  professionalId: integer("professional_id").references(() => professionals.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("client_treatments_client_service_idx").on(t.clientId, t.serviceId)]);

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientEmail: text("client_email"),
  clientId: integer("client_id").references(() => clients.id),
  roomId: integer("room_id").notNull().references(() => rooms.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  professionalId: integer("professional_id").notNull().references(() => professionals.id),
  date: text("date").notNull(), // Formatted as YYYY-MM-DD
  startTime: text("start_time").notNull(), // Formatted as HH:MM
  endTime: text("end_time").notNull(), // Formatted as HH:MM
  durationMinutes: integer("duration_minutes").notNull().default(60),
  status: text("status").notNull().default("confirmada"), // "confirmada", "pendent", "completada", "cancel·lada"
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"), // "manual", "bot_simulador", "whatsapp", "web"
  reminderSent: boolean("reminder_sent").notNull().default(false),
  // Pagat en efectiu? Tot el que no es marqui com a efectiu es considera pagat amb targeta
  paidCash: boolean("paid_cash").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const botSimulations = pgTable("bot_simulations", {
  id: serial("id").primaryKey(),
  clientPhone: text("client_phone").notNull(),
  clientName: text("client_name").notNull(),
  incomingMessage: text("incoming_message").notNull(),
  detectedIntent: text("detected_intent"),
  detectedServiceId: integer("detected_service_id").references(() => services.id),
  replyMessage: text("reply_message").notNull(),
  proposedSlots: text("proposed_slots"), // JSON string array of 3 options: [{date, time, roomId, roomName, professionalId, professionalName}]
  selectedSlotIndex: integer("selected_slot_index"),
  status: text("status").notNull().default("opcions_enviades"), // "pendent", "opcions_enviades", "pendent_confirmacio", "cita_confirmada", "cancel·lat"
  conversationStep: text("conversation_step").notNull().default("esperant_seleccio"), // "esperant_seleccio", "esperant_confirmacio", "tancada"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const centerSettings = pgTable("center_settings", {
  id: serial("id").primaryKey(),
  centerName: text("center_name").notNull().default("Estètica Diana"),
  phone: text("phone").notNull().default("+34 689 34 52 10"),
  address: text("address").notNull().default("Carrer Gran de Gràcia, 112, Barcelona"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(true),
  autoReplyGreeting: text("auto_reply_greeting").notNull().default("Hola! Gràcies per contactar amb Estètica Diana ✨ He buscat a la nostra agenda les millors opcions per a tu:"),
  autoReplyConfirmation: text("auto_reply_confirmation").notNull().default("Perfecte! La teva cita ha quedat reservada a la nostra agenda. T'esperem a Estètica Diana ✨"),
  slotIntervalMinutes: integer("slot_interval_minutes").notNull().default(30),
});

// Xecs regal (bons regal). Poden ser d'un import (es gasta a poc a poc) o d'un servei concret.
export const giftVouchers = pgTable("gift_vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  kind: text("kind").notNull().default("import"), // "import" | "servei"
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  remaining: numeric("remaining", { precision: 10, scale: 2 }).notNull().default("0.00"),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
  serviceText: text("service_text"),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  issueDate: text("issue_date").notNull(), // YYYY-MM-DD
  expiryDate: text("expiry_date"), // YYYY-MM-DD
  paymentMethod: text("payment_method"), // "efectiu", "targeta", "bizum", "transferència"
  status: text("status").notNull().default("actiu"), // "actiu", "bescanviat", "anul·lat"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cada vegada que es fa servir un xec (total o parcialment)
export const giftVoucherUses = pgTable("gift_voucher_uses", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull().references(() => giftVouchers.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
