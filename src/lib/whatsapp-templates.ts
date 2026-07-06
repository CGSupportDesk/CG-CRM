import type { Lead, StudioClient, WhatsappTemplateKey } from "./types";

export const DEFAULT_CLOSING_GAP_WHATSAPP_NUMBER = "919633294791";

export const whatsappTemplateOptions: WhatsappTemplateKey[] = [
  "First Contact",
  "Follow-up",
  "Details Sent",
  "Proposal Follow-up",
  "Final Follow-up",
  "Custom Message",
];

export const whatsappTemplateContext = `
30 Poster Package WhatsApp template labels:
- First Contact: use for a new lead who has not received the first package message.
- Follow-up: use after a call, missed call, no response, or when the lead needs time.
- Details Sent: use when sending gallery and 30 Poster Package details.
- Proposal Follow-up: use after pricing, proposal, or package details have already been shared.
- Final Follow-up: use when closing the loop after multiple attempts.
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
  if (!recipient || "clientName" in recipient) return "Follow-up";

  const remarks = recipient.remarks.toLowerCase();
  if (remarks.includes("proposal")) return "Proposal Follow-up";
  if (remarks.includes("details") || remarks.includes("gallery")) return "Details Sent";
  if (remarks.includes("tried") || remarks.includes("no response") || remarks.includes("call back")) {
    return "Follow-up";
  }

  return recipient.phone ? "First Contact" : "Custom Message";
}

export function buildWhatsappMessage(
  template: WhatsappTemplateKey,
  recipient: WhatsappRecipient,
) {
  const name = getWhatsappRecipientName(recipient);
  const business = "clientName" in recipient
    ? recipient.clientName
    : recipient.businessName || recipient.leadName;
  const businessLine = business ? ` for ${business}` : "";

  if (template === "First Contact") {
    return [
      `Hi ${name}, Naveen here from Closing Gap Studio.`,
      "",
      "We help businesses stay consistent on social media with the 30 Poster Package.",
      "",
      "Quick summary:",
      "- 30 custom designed posts every month",
      "- Rs 4,999 only - about Rs 167 per post",
      "- No follow ups, no chasing - we deliver",
      "",
      "You can see our work here:",
      "cgstudio.theclosinggap.net/gallery",
      "",
      "Would you like me to send the details?",
    ].join("\n");
  }

  if (template === "Details Sent") {
    return [
      `Hi ${name}, Naveen here from Closing Gap Studio.`,
      "",
      "As promised, here is a look at what we do:",
      "cgstudio.theclosinggap.net/gallery",
      "",
      "Quick summary:",
      "- 30 custom designed posts every month",
      "- Rs 4,999 only - about Rs 167 per post",
      "- No follow ups, no chasing - we deliver",
      "",
      "We have a few slots open this month. If you would like to go ahead, we can start this week itself.",
      "",
      "Just say the word.",
    ].join("\n");
  }

  if (template === "Proposal Follow-up") {
    return [
      `Hi ${name}, Naveen here.`,
      "",
      `Just checking if you had a chance to review the 30 Poster Package${businessLine}.`,
      "",
      "It is Rs 4,999 for 30 custom posts every month, fully handled by our studio.",
      "",
      "If it helps, I can also share 2-3 sample post ideas for your business before you decide.",
    ].join("\n");
  }

  if (template === "Final Follow-up") {
    return [
      `Hi ${name}, Naveen here from Closing Gap Studio.`,
      "",
      "Just closing the loop on the 30 Poster Package.",
      "",
      "If now is not the right time, no worries at all. If you want to revisit it later, you can message me here anytime.",
      "",
      "Thanks.",
    ].join("\n");
  }

  if (template === "Custom Message") {
    return "";
  }

  return [
    `Hi ${name}, Naveen here.`,
    "",
    "Just following up on our conversation.",
    "",
    "One thing I can do: let me design 2 sample posters for your business, specific to your industry. No cost, no obligation. You see the quality first, then decide.",
    "",
    "Fair enough? Just confirm your business name and I will get it done.",
  ].join("\n");
}
