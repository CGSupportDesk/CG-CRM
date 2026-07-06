import type { WhatsappTemplateKey } from "./types";

export const whatsappTemplateOptions: WhatsappTemplateKey[] = [
  "Send Details",
  "Will Think About It",
  "Did Not Answer",
  "Seen But No Reply",
  "Sample Offer",
  "Price Objection",
  "None",
];

export const whatsappTemplateContext = `
30 Poster Package WhatsApp template labels:
- Send Details: use when the lead asked for details, package info, or portfolio/gallery.
- Will Think About It: use when the lead needs time, wants to discuss, or is undecided.
- Did Not Answer: use when a call did not connect or the lead missed the call.
- Seen But No Reply: use when messages were seen but the lead has not responded.
- Sample Offer: use when the best next step is offering free sample poster designs.
- Price Objection: use when the lead says price is high or budget is a concern.
- None: use when no message recommendation is appropriate.
`;
