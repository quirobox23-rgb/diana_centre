export interface Room {
  id: number;
  name: string;
  description: string | null;
  color: string;
  capacity: number;
  isActive: boolean;
}

export interface Professional {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  color: string;
  isActive: boolean;
}

export interface Service {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: string;
  description: string | null;
  defaultRoomId: number | null;
  color: string;
  isActive: boolean;
  roomName?: string | null;
}

export interface Schedule {
  id: number;
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  notes: string | null;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  allergies: string | null;
  preferences: string | null;
  birthday: string | null;
  isActive: boolean;
  createdAt?: string;
  appointmentsCount?: number;
}

export interface Appointment {
  id: number;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  clientId?: number | null;
  roomId: number;
  serviceId: number;
  professionalId: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  status: "confirmada" | "pendent" | "completada" | "cancel·lada";
  price: string;
  notes?: string | null;
  source: string;
  createdAt?: string;
  roomName?: string | null;
  roomColor?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  serviceColor?: string | null;
  professionalName?: string | null;
  professionalColor?: string | null;
}

export interface ProposedSlot {
  date: string;
  displayDate: string;
  time: string;
  endTime: string;
  roomId: number;
  roomName: string;
  professionalId: number;
  professionalName: string;
}

export interface BotSimulation {
  id: number;
  clientPhone: string;
  clientName: string;
  incomingMessage: string;
  detectedIntent: string | null;
  detectedServiceId: number | null;
  replyMessage: string;
  proposedSlots: string | null;
  selectedSlotIndex: number | null;
  status: string;
  createdAt: string;
}

export interface CenterSettings {
  id: number;
  centerName: string;
  phone: string;
  address: string;
  autoReplyEnabled: boolean;
  autoReplyGreeting: string;
  autoReplyConfirmation: string;
  slotIntervalMinutes: number;
}
