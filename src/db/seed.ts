import { db } from "./index";
import { rooms, professionals, services, schedules, appointments, centerSettings, botSimulations, clients } from "./schema";

export async function seedDatabase() {
  const existingRooms = await db.select().from(rooms);
  if (existingRooms.length > 0) {
    // Si la taula de clients és buida, sembrem clientes de mostra
    const existingClients = await db.select().from(clients);
    if (existingClients.length === 0) {
      await db.insert(clients).values([
        {
          name: "Núria Soler i Vidal",
          phone: "+34 654 11 22 33",
          email: "nuria.soler@gmail.com",
          allergies: "Al·lèrgica a certs olis minerals i cítrics",
          preferences: "Prefereix massatge amb pressió mitjana i llum tènue",
          notes: "Clienta habitual des de fa 2 anys. Sol fer-se neteges d'oxigen.",
          birthday: "1988-04-12",
          isActive: true,
        },
        {
          name: "Montserrat Valls",
          phone: "+34 678 44 55 66",
          email: "montse.valls@outlook.com",
          allergies: null,
          preferences: "Pell sensible i seca. Demana sempre protecció solar 50+",
          notes: "Té pack de radiofreqüència facial contractat.",
          birthday: "1975-09-23",
          isActive: true,
        },
        {
          name: "Carla Ferrer",
          phone: "+34 699 88 77 66",
          email: "carla.f@gmail.com",
          allergies: "Reacció lleu al làtex (emprar guants de nitril)",
          preferences: "Depilació làser díode suau a la zona dels turmells",
          notes: "Sessió recordatori de làser un cop l'any.",
          birthday: "1994-11-05",
          isActive: true,
        },
        {
          name: "Ariadna Mas i Font",
          phone: "+34 633 44 11 22",
          email: "ariadna.mas@gmail.com",
          allergies: null,
          preferences: "Esmalts colors pastís o tons bordeus a la tardor",
          notes: "Manicura semipermanent cada 3 setmanes puntual.",
          birthday: "1991-06-30",
          isActive: true,
        },
        {
          name: "Clara Domènech",
          phone: "+34 612 99 88 77",
          email: "clara.d@hotmail.com",
          allergies: null,
          preferences: "Maderoteràpia corporal drenant",
          notes: "Ha contactat via bot de WhatsApp.",
          birthday: "1985-02-14",
          isActive: true,
        },
      ]);
    }
    return;
  }

  console.log("Seeding initial data for Estètica Diana...");

  // 1. Inserir 3 sales
  const insertedRooms = await db.insert(rooms).values([
    {
      name: "Cabina 1 - Facial & Benestar",
      description: "Equipada amb llitera hidràulica, oxigenoteràpia, llum LED i ambient relaxant amb aromateràpia.",
      color: "#ec4899", // Pink
      capacity: 1,
      isActive: true,
    },
    {
      name: "Cabina 2 - Làser & Corporal",
      description: "Aparell de làser díode d'última generació, radiofreqüència corporal i equip de maderoteràpia.",
      color: "#8b5cf6", // Purple
      capacity: 1,
      isActive: true,
    },
    {
      name: "Cabina 3 - Mans, Peus & Mirada",
      description: "Estacions d'esmaltat semipermanent, silló de pedicura spa amb hidromassatge i llitera per a pestanyes.",
      color: "#0ea5e9", // Sky blue
      capacity: 1,
      isActive: true,
    },
  ]).returning();

  // 2. Inserir Professionals
  const insertedProfessionals = await db.insert(professionals).values([
    {
      name: "Diana Gómez",
      email: "diana@esteticadiana.cat",
      phone: "+34 689 34 52 10",
      specialty: "Directora & Estètica Avançada",
      color: "#db2777",
      isActive: true,
    },
    {
      name: "Marta Rovira",
      email: "marta@esteticadiana.cat",
      phone: "+34 611 22 33 44",
      specialty: "Especialista Facial & Massatges",
      color: "#7c3aed",
      isActive: true,
    },
    {
      name: "Laia Puig",
      email: "laia@esteticadiana.cat",
      phone: "+34 622 55 66 77",
      specialty: "Manicura, Pedicura & Mirada",
      color: "#0284c7",
      isActive: true,
    },
  ]).returning();

  // 3. Inserir Clientes
  await db.insert(clients).values([
    {
      name: "Núria Soler i Vidal",
      phone: "+34 654 11 22 33",
      email: "nuria.soler@gmail.com",
      allergies: "Al·lèrgica a certs olis minerals i cítrics",
      preferences: "Prefereix massatge amb pressió mitjana i llum tènue",
      notes: "Clienta habitual des de fa 2 anys. Sol fer-se neteges d'oxigen.",
      birthday: "1988-04-12",
      isActive: true,
    },
    {
      name: "Montserrat Valls",
      phone: "+34 678 44 55 66",
      email: "montse.valls@outlook.com",
      allergies: null,
      preferences: "Pell sensible i seca. Demana sempre protecció solar 50+",
      notes: "Té pack de radiofreqüència facial contractat.",
      birthday: "1975-09-23",
      isActive: true,
    },
    {
      name: "Carla Ferrer",
      phone: "+34 699 88 77 66",
      email: "carla.f@gmail.com",
      allergies: "Reacció lleu al làtex (emprar guants de nitril)",
      preferences: "Depilació làser díode suau a la zona dels turmells",
      notes: "Sessió recordatori de làser un cop l'any.",
      birthday: "1994-11-05",
      isActive: true,
    },
    {
      name: "Ariadna Mas i Font",
      phone: "+34 633 44 11 22",
      email: "ariadna.mas@gmail.com",
      allergies: null,
      preferences: "Esmalts colors pastís o tons bordeus a la tardor",
      notes: "Manicura semipermanent cada 3 setmanes puntual.",
      birthday: "1991-06-30",
      isActive: true,
    },
    {
      name: "Clara Domènech",
      phone: "+34 612 99 88 77",
      email: "clara.d@hotmail.com",
      allergies: null,
      preferences: "Maderoteràpia corporal drenant",
      notes: "Ha contactat via bot de WhatsApp.",
      birthday: "1985-02-14",
      isActive: true,
    },
  ]);

  // 4. Inserir Serveis
  const r1 = insertedRooms[0].id;
  const r2 = insertedRooms[1].id;
  const r3 = insertedRooms[2].id;

  const insertedServices = await db.insert(services).values([
    {
      name: "Neteja Facial Profunda amb Oxigen",
      category: "Facial",
      durationMinutes: 60,
      price: "55.00",
      description: "Higiene completa amb extracció de porus, peeling ultrasònic, màscara calmant i hidratació amb oxigen pur.",
      defaultRoomId: r1,
      color: "#ec4899",
      isActive: true,
    },
    {
      name: "Radiofreqüència Facial Efecte Lifting",
      category: "Facial",
      durationMinutes: 60,
      price: "75.00",
      description: "Estimulació de col·lagen i elastina, reafirmant el rostre, coll i escot de forma no invasiva.",
      defaultRoomId: r1,
      color: "#f43f5e",
      isActive: true,
    },
    {
      name: "Depilació Làser Díode - Cametes / Cuixes",
      category: "Depilació",
      durationMinutes: 45,
      price: "60.00",
      description: "Tecnologia d'alta precisió indolora per a eliminació permanent del pèl corporal.",
      defaultRoomId: r2,
      color: "#8b5cf6",
      isActive: true,
    },
    {
      name: "Massatge Relaxant d'Olis Essencials",
      category: "Benestar",
      durationMinutes: 50,
      price: "50.00",
      description: "Massatge suau corporal amb aromateràpia d'espígol i cítrics per desconnectar i alliberar tensions.",
      defaultRoomId: r1,
      color: "#10b981",
      isActive: true,
    },
    {
      name: "Maderoteràpia Corporal Reductora",
      category: "Corporal",
      durationMinutes: 60,
      price: "65.00",
      description: "Tècnica holística amb fustes naturals per modelar la silueta, drenar líquids i reduir cel·lulitis.",
      defaultRoomId: r2,
      color: "#d97706",
      isActive: true,
    },
    {
      name: "Manicura Russa Semipermanent",
      category: "Mans i Peus",
      durationMinutes: 60,
      price: "35.00",
      description: "Neteja de cutícules amb torn de precisió, anivellament d'ungla i esmaltat durador.",
      defaultRoomId: r3,
      color: "#0ea5e9",
      isActive: true,
    },
    {
      name: "Pedicura Spa Completa amb Hidratació",
      category: "Mans i Peus",
      durationMinutes: 50,
      price: "42.00",
      description: "Bany d'hidromassatge, eliminació de dureses, exfoliació amb sals marines, massatge i esmaltat.",
      defaultRoomId: r3,
      color: "#06b6d4",
      isActive: true,
    },
    {
      name: "Lifting de Pestanyes amb Tint i Botox",
      category: "Mirada",
      durationMinutes: 45,
      price: "45.00",
      description: "Corbatura natural des de l'arrel amb bany de color intens i tractament nutritiu de queratina.",
      defaultRoomId: r3,
      color: "#6366f1",
      isActive: true,
    },
  ]).returning();

  // 5. Inserir Horaris
  await db.insert(schedules).values([
    { dayOfWeek: 1, dayName: "Dilluns", isOpen: true, morningStart: "09:30", morningEnd: "13:30", afternoonStart: "15:30", afternoonEnd: "20:00", notes: "Horari habitual" },
    { dayOfWeek: 2, dayName: "Dimarts", isOpen: true, morningStart: "09:30", morningEnd: "13:30", afternoonStart: "15:30", afternoonEnd: "20:00", notes: "Horari habitual" },
    { dayOfWeek: 3, dayName: "Dimecres", isOpen: true, morningStart: "09:30", morningEnd: "13:30", afternoonStart: "15:30", afternoonEnd: "20:00", notes: "Horari habitual" },
    { dayOfWeek: 4, dayName: "Dijous", isOpen: true, morningStart: "09:30", morningEnd: "13:30", afternoonStart: "15:30", afternoonEnd: "20:00", notes: "Horari habitual" },
    { dayOfWeek: 5, dayName: "Divendres", isOpen: true, morningStart: "09:30", morningEnd: "13:30", afternoonStart: "15:30", afternoonEnd: "20:00", notes: "Torn continuat disponible sota petició" },
    { dayOfWeek: 6, dayName: "Dissabte", isOpen: true, morningStart: "09:30", morningEnd: "14:00", afternoonStart: "16:00", afternoonEnd: "19:00", notes: "Obert matí i tarda amb cita prèvia" },
    { dayOfWeek: 0, dayName: "Diumenge", isOpen: false, morningStart: "10:00", morningEnd: "14:00", afternoonStart: "16:00", afternoonEnd: "20:00", notes: "Descans setmanal" },
  ]);

  // 6. Inserir Configuració del Centre
  await db.insert(centerSettings).values({
    centerName: "Estètica Diana",
    phone: "+34 689 34 52 10",
    address: "Carrer Gran de Gràcia, 112, Barcelona",
    autoReplyEnabled: true,
    autoReplyGreeting: "Hola! Gràcies per escriure a Estètica Diana ✨ He revisat la nostra agenda i aquestes són les 3 millors hores lliures que et puc oferir:",
    autoReplyConfirmation: "Genial! La teva cita ha quedat confirmada i agendada automàticament a la nostra sala. T'esperem a Estètica Diana!",
    slotIntervalMinutes: 30,
  });

  // 7. Cites de mostra per al dia d'avui i dies propers
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const d0 = formatDate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const d1 = formatDate(tomorrow);

  const p1 = insertedProfessionals[0].id;
  const p2 = insertedProfessionals[1].id;
  const p3 = insertedProfessionals[2].id;

  const s1 = insertedServices[0].id;
  const s2 = insertedServices[1].id;
  const s3 = insertedServices[2].id;
  const s5 = insertedServices[4].id;
  const s6 = insertedServices[5].id;
  const s8 = insertedServices[7].id;

  await db.insert(appointments).values([
    {
      clientName: "Núria Soler",
      clientPhone: "+34 654 11 22 33",
      clientEmail: "nuria.soler@gmail.com",
      roomId: r1,
      serviceId: s1,
      professionalId: p1,
      date: d0,
      startTime: "10:00",
      endTime: "11:00",
      durationMinutes: 60,
      status: "confirmada",
      price: "55.00",
      notes: "Pell sensible i reactiva. Aplicar màscara de camamilla.",
      source: "manual",
    },
    {
      clientName: "Montserrat Valls",
      clientPhone: "+34 678 44 55 66",
      clientEmail: "montse.valls@outlook.com",
      roomId: r1,
      serviceId: s2,
      professionalId: p2,
      date: d0,
      startTime: "16:00",
      endTime: "17:00",
      durationMinutes: 60,
      status: "confirmada",
      price: "75.00",
      notes: "3a sessió del pack anti-edat",
      source: "whatsapp",
    },
    {
      clientName: "Carla Ferrer",
      clientPhone: "+34 699 88 77 66",
      clientEmail: "carla.f@gmail.com",
      roomId: r2,
      serviceId: s3,
      professionalId: p1,
      date: d0,
      startTime: "11:30",
      endTime: "12:15",
      durationMinutes: 45,
      status: "confirmada",
      price: "60.00",
      notes: "Sessió recordatori de làser",
      source: "manual",
    },
    {
      clientName: "Clara Domènech",
      clientPhone: "+34 612 99 88 77",
      clientEmail: "clara.d@hotmail.com",
      roomId: r2,
      serviceId: s5,
      professionalId: p2,
      date: d0,
      startTime: "17:30",
      endTime: "18:30",
      durationMinutes: 60,
      status: "pendent",
      price: "65.00",
      notes: "Primer tractament de maderoteràpia",
      source: "bot_simulador",
    },
    {
      clientName: "Ariadna Mas",
      clientPhone: "+34 633 44 11 22",
      clientEmail: "ariadna.mas@gmail.com",
      roomId: r3,
      serviceId: s6,
      professionalId: p3,
      date: d0,
      startTime: "10:30",
      endTime: "11:30",
      durationMinutes: 60,
      status: "confirmada",
      price: "35.00",
      notes: "Color bordeus semipermanent",
      source: "manual",
    },
    {
      clientName: "Júlia Pons",
      clientPhone: "+34 644 77 88 99",
      clientEmail: "julia.pons@yahoo.es",
      roomId: r3,
      serviceId: s8,
      professionalId: p3,
      date: d0,
      startTime: "16:30",
      endTime: "17:15",
      durationMinutes: 45,
      status: "confirmada",
      price: "45.00",
      notes: "Clienta nova, té un casament dissabte",
      source: "manual",
    },
    {
      clientName: "Sílvia Rovira",
      clientPhone: "+34 670 12 34 56",
      clientEmail: "silvia.rov@gmail.com",
      roomId: r1,
      serviceId: s1,
      professionalId: p1,
      date: d1,
      startTime: "11:00",
      endTime: "12:00",
      durationMinutes: 60,
      status: "confirmada",
      price: "55.00",
      notes: "Vol consell per a rutina de nit",
      source: "manual",
    },
  ]);

  console.log("Database seeded successfully!");
}
