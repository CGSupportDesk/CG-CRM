export function formatPhoneForWhatsApp(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed || /^no\s*number$/i.test(trimmed) || /^n\/?a$/i.test(trimmed)) return "";

  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length > 10 && digits.length <= 15) return digits;

  return "";
}

export function encodeWhatsAppMessage(message: string) {
  return encodeURIComponent(message);
}

export function buildWhatsAppUrl(phoneNumber: string, message: string) {
  const formattedPhone = formatPhoneForWhatsApp(phoneNumber);
  if (!formattedPhone) return "";

  return `https://wa.me/${formattedPhone}?text=${encodeWhatsAppMessage(message)}`;
}
