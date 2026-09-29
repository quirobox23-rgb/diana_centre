import twilioLib from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // p.ex. "whatsapp:+14155238886"

let client: twilioLib.Twilio | null = null;
function getClient(): twilioLib.Twilio {
  if (!accountSid || !authToken) {
    throw new Error("Falten les variables TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN");
  }
  if (!client) client = twilioLib(accountSid, authToken);
  return client;
}

export async function sendWhatsApp(toPhone: string, body: string): Promise<void> {
  if (!fromNumber) throw new Error("Falta la variable TWILIO_WHATSAPP_FROM");
  const to = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  await getClient().messages.create({ from: fromNumber, to, body });
}

// Valida que la petició al webhook ve realment de Twilio (evita webhooks falsos).
// En desenvolupament local es pot desactivar amb SKIP_TWILIO_VALIDATION=true.
export function validateTwilioSignature(signature: string | null, rawBody: string, appUrl: string): boolean {
  if (process.env.SKIP_TWILIO_VALIDATION === "true") return true
  if (!authToken || !signature) return false

  const params = Object.fromEntries(new URLSearchParams(rawBody));
  return twilioLib.validateRequest(authToken, signature, appUrl, params);
}
