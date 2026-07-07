import type { Lead, StudioClient, WhatsappTemplateKey } from "./types";

export const DEFAULT_CLOSING_GAP_WHATSAPP_NUMBER = "919633294791";

export const whatsappTemplateOptions: WhatsappTemplateKey[] = [
  "Send me Details",
  "Will think about it",
  "Didnt answer the call",
  "Seen but no reply",
  "Custom Message",
];

export const whatsappTemplateContext = `
30 Poster Package WhatsApp template labels:
- Send me Details: use when the lead asked for details, package info, or portfolio/gallery.
- Will think about it: use when the lead needs time, wants to discuss, or is undecided.
- Didnt answer the call: use when a call did not connect or the lead missed the call.
- Seen but no reply: use when messages were seen but the lead has not responded.
- Custom Message: use when a manual message is more appropriate.
`;

type WhatsappRecipient = Pick<
  Lead,
  "leadName" | "businessName" | "contactPerson" | "phone" | "industry" | "remarks"
> | Pick<StudioClient, "clientName" | "contactPerson" | "phone" | "industry" | "notes">;

export function getWhatsappRecipientName(recipient: WhatsappRecipient) {
  if ("clientName" in recipient) {
    return recipient.contactPerson || recipient.clientName || "there";
  }

  return recipient.contactPerson || recipient.leadName || recipient.businessName || "there";
}

export function getDefaultWhatsappTemplate(recipient?: WhatsappRecipient): WhatsappTemplateKey {
  if (!recipient || "clientName" in recipient) return "Will think about it";

  const remarks = recipient.remarks.toLowerCase();
  if (remarks.includes("seen") || remarks.includes("no reply")) return "Seen but no reply";
  if (
    remarks.includes("tried") ||
    remarks.includes("didn't answer") ||
    remarks.includes("didnt answer") ||
    remarks.includes("missed") ||
    remarks.includes("no response")
  ) {
    return "Didnt answer the call";
  }
  if (remarks.includes("think") || remarks.includes("time") || remarks.includes("call back")) {
    return "Will think about it";
  }
  if (remarks.includes("details") || remarks.includes("gallery")) return "Send me Details";

  return recipient.phone ? "Send me Details" : "Custom Message";
}

export function buildWhatsappMessage(
  template: WhatsappTemplateKey,
  recipient: WhatsappRecipient,
) {
  const name = getWhatsappRecipientName(recipient);

  if (template === "Send me Details") {
    return [
      `Hi ${name}, Naveen here from Closing Gap Studio.`,
      "",
      "As promised - here's a look at what we do:",
      "👉 cgstudio.theclosinggap.net/gallery",
      "",
      "Quick summary:",
      "✅ 30 custom designed posts every month",
      "✅ ₹4,999 only - that's ₹167 per post",
      "✅ No follow ups, no chasing - we deliver",
      "",
      "We have a few slots open this month. If you'd like to go ahead, we can start this week itself.",
      "",
      "Just say the word 🙂",
    ].join("\n");
  }

  if (template === "Will think about it") {
    return [
      `Hi ${name}, Naveen here.`,
      "",
      "Just following up on our conversation - completely understand you're thinking it over.",
      "",
      "One thing I can do - let me design 2 sample posters for your business, specific to your industry. No cost, no obligation. You see the quality first, then decide.",
      "",
      "Fair enough? Just confirm your business name and I'll get it done by tomorrow.",
    ].join("\n");
  }

  if (template === "Didnt answer the call") {
    return [
      `Hi ${name}, this is Naveen from Closing Gap Studio. Tried calling - you were probably busy/couldn't connect.`,
      "",
      "We help businesses like yours stay consistent on social media - 30 custom posts every month for ₹4,999.",
      "",
      "Have a look at our work: cgstudio.theclosinggap.net/gallery",
    ].join("\n");
  }

  if (template === "Seen but no reply") {
    return [
      `Hi ${name} - Naveen here. Noticed you might have seen my last message.`,
      "",
      "No pressure at all - just didn't want you to miss this.",
      "",
      "30 posts a month, ₹4,999, completely done for you. Your competitors are posting every day - this is how you keep up without the effort.",
      "",
      "If you want I can send 2 free sample designs for your business - takes me a day, costs you nothing. Then you decide.",
      "",
      "Interested? 🙂",
      "",
      "If it looks interesting, I can design 3 free sample posts for your business so you can see exactly what it would look like before deciding anything.",
      "",
      "Reply when you get a chance 🙂",
    ].join("\n");
  }

  if (template === "Custom Message") {
    return "";
  }

  return "";
}
