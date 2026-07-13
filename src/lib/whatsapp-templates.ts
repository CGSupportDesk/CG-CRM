import type { Lead, StudioClient, WhatsappTemplateKey } from "./types";

export const DEFAULT_CLOSING_GAP_WHATSAPP_NUMBER = "919633294791";

export const whatsappTemplateOptions: WhatsappTemplateKey[] = [
  "Send me Details",
  "Will think about it",
  "Didnt answer the call",
  "Seen but no reply",
  "Expensive - Follow-up 1",
  "Expensive - Follow-up 2",
  "Has Designer - Follow-up 1",
  "Has Designer - Follow-up 2",
  "Gone Cold - Follow-up 1",
  "Gone Cold - Follow-up 2",
  "Not Now - Follow-up 1",
  "Not Now - Follow-up 2",
  "Questions - Follow-up 1",
  "Questions - Follow-up 2",
  "Custom Message",
];

export const whatsappTemplateContext = `
30 Poster Package WhatsApp template labels:
- Send me Details: use when the lead asked for details, package info, or portfolio/gallery.
- Will think about it: use when the lead needs time, wants to discuss, or is undecided.
- Didnt answer the call: use when a call did not connect or the lead missed the call.
- Seen but no reply: use when messages were seen but the lead has not responded.
- Expensive - Follow-up 1/2: use when the lead says the package is expensive or cannot afford it.
- Has Designer - Follow-up 1/2: use when the lead already has a designer, agency, or team.
- Gone Cold - Follow-up 1/2: use when there has been no reply for 4-5 days.
- Not Now - Follow-up 1/2: use when the lead says next month, future, or not now.
- Questions - Follow-up 1/2: use when the lead will think, has questions, or needs clarity.
- Custom Message: use when a manual message is more appropriate.
`;

type WhatsappRecipient = Pick<
  Lead,
  | "leadName"
  | "businessName"
  | "contactPerson"
  | "phone"
  | "industry"
  | "remarks"
  | "leadStage"
  | "objectionReason"
> | Pick<StudioClient, "clientName" | "contactPerson" | "phone" | "industry" | "notes">;

export function getWhatsappRecipientName(recipient: WhatsappRecipient) {
  if ("clientName" in recipient) {
    return recipient.contactPerson || recipient.clientName || "there";
  }

  return recipient.contactPerson || recipient.leadName || recipient.businessName || "there";
}

export function getDefaultWhatsappTemplate(recipient?: WhatsappRecipient): WhatsappTemplateKey {
  if (!recipient) return "Custom Message";
  if ("clientName" in recipient) return "Will think about it";

  const remarks = recipient.remarks.toLowerCase();
  const objection = recipient.objectionReason.toLowerCase();
  if (remarks.includes("expensive") || remarks.includes("price") || remarks.includes("budget") || objection === "price high" || objection === "no budget") {
    return "Expensive - Follow-up 1";
  }
  if (remarks.includes("designer") || remarks.includes("agency") || remarks.includes("team") || objection.includes("agency") || objection.includes("team")) {
    return "Has Designer - Follow-up 1";
  }
  if (remarks.includes("not now") || remarks.includes("next month") || remarks.includes("future") || objection === "not interested now" || objection === "will contact later") {
    return "Not Now - Follow-up 1";
  }
  if (remarks.includes("question") || remarks.includes("doubt") || remarks.includes("clarify")) {
    return "Questions - Follow-up 1";
  }
  if (remarks.includes("seen") || remarks.includes("no reply")) return "Seen but no reply";
  if (
    remarks.includes("tried") ||
    remarks.includes("didn't answer") ||
    remarks.includes("didnt answer") ||
    remarks.includes("missed") ||
    remarks.includes("no response")
  ) {
    return recipient.leadStage === "No Response" ? "Gone Cold - Follow-up 1" : "Didnt answer the call";
  }
  if (remarks.includes("think") || remarks.includes("time") || remarks.includes("call back")) {
    return "Questions - Follow-up 1";
  }
  if (remarks.includes("details") || remarks.includes("gallery")) return "Send me Details";
  if (recipient.leadStage === "No Response") return "Gone Cold - Follow-up 1";
  if (recipient.leadStage === "Details Sent" || recipient.leadStage === "Proposal Sent") {
    return "Will think about it";
  }
  if (recipient.leadStage === "New Lead" || recipient.leadStage === "Contacted") {
    return "Send me Details";
  }

  return recipient.phone ? "Send me Details" : "Custom Message";
}

export function buildWhatsappMessage(
  template: WhatsappTemplateKey,
  recipient: WhatsappRecipient,
) {
  const name = getWhatsappRecipientName(recipient);

  const templates: Record<Exclude<WhatsappTemplateKey, "Custom Message">, string> = {
    "Send me Details": [
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
    ].join("\n"),
    "Will think about it": [
      `Hi ${name}, Naveen here.`,
      "",
      "Just following up on our conversation - completely understand you're thinking it over.",
      "",
      "One thing I can do - let me design 2 sample posters for your business, specific to your industry. No cost, no obligation. You see the quality first, then decide.",
      "",
      "Fair enough? Just confirm your business name and I'll get it done by tomorrow.",
    ].join("\n"),
    "Didnt answer the call": [
      `Hi ${name}, this is Naveen from Closing Gap Studio. Tried calling - you were probably busy/couldn't connect.`,
      "",
      "We help businesses like yours stay consistent on social media - 30 custom posts every month for ₹4,999.",
      "",
      "Have a look at our work: cgstudio.theclosinggap.net/gallery",
    ].join("\n"),
    "Seen but no reply": [
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
    ].join("\n"),
    "Expensive - Follow-up 1": [
      `Hi ${name}, Naveen here.`,
      "",
      "Totally understand - budgets are tight and every expense needs to make sense.",
      "",
      "Here's a way to look at it - what does it currently cost you to get one post designed? Time, effort, or money paid to someone. Multiply that by 30.",
      "",
      "We do all 30 for ₹4,999. That's it.",
      "",
      "And if you're still unsure - let us design 2 free samples for your business first. See the quality, then decide. No payment needed for that.",
      "",
      "Worth a shot? 🙂",
    ].join("\n"),
    "Expensive - Follow-up 2": [
      `Hi ${name}, Naveen here again.`,
      "",
      "Just to make it easier to decide - you don't have to commit first.",
      "",
      "Let us create 2 sample posters for your business. If the quality feels useful, we can start the 30 Poster Package at ₹4,999. If not, no issue at all.",
      "",
      "Can I prepare the samples for you?",
    ].join("\n"),
    "Has Designer - Follow-up 1": [
      `Hi ${name}, Naveen here.`,
      "",
      "Glad you have someone - consistency is what makes the difference though. Are they delivering every single month, on time, without you having to follow up?",
      "",
      "That's exactly what we do - 30 posts, every month, zero follow up needed from your side.",
      "",
      "Even if you want to stick with your current designer, happy to send 1 free sample just so you have a comparison. No harm in that right?",
      "",
      "Let me know 🙂",
    ].join("\n"),
    "Has Designer - Follow-up 2": [
      `Hi ${name}, Naveen here.`,
      "",
      "Quick thought - you can keep your current designer and still use us as a backup for consistency.",
      "",
      "If you ever need monthly posting support without chasing, the 30 Poster Package can cover that gap. I can send a free sample first so you can compare styles.",
      "",
      "Should I make one for your business?",
    ].join("\n"),
    "Gone Cold - Follow-up 1": [
      `Hi ${name}, Naveen here - just checking in.`,
      "",
      "It's been a few days since we spoke. Wanted to let you know we still have a slot open this month - but we're filling up.",
      "",
      "If you'd like to get started, this week would be a good time. We can have your first set of posts ready before the month ends.",
      "",
      "Still want those 2 free samples first? Happy to do that today itself. 🙂",
    ].join("\n"),
    "Gone Cold - Follow-up 2": [
      `Hi ${name}, Naveen here.`,
      "",
      "I'll keep this short - should I close this for now, or would you still like the 2 free sample posters?",
      "",
      "Either answer is completely fine. Just didn't want to keep disturbing you if the timing is not right.",
    ].join("\n"),
    "Not Now - Follow-up 1": [
      `Hi ${name}, Naveen here.`,
      "",
      "No worries at all - whenever you're ready, we're here.",
      "",
      "One small thing before I let you go - let me send you 2 sample posts designed for your business. Completely free, no strings attached. You can use them whenever you want even if you don't sign up now.",
      "",
      "At least you'll have something in hand. Okay? 🙂",
    ].join("\n"),
    "Not Now - Follow-up 2": [
      `Hi ${name}, Naveen here.`,
      "",
      "Since you mentioned later, I'll follow up another time.",
      "",
      "Before that, I can still make the 2 free samples so you have a clear reference when you're ready next month.",
      "",
      "Should I prepare them?",
    ].join("\n"),
    "Questions - Follow-up 1": [
      `Hi ${name}, Naveen here.`,
      "",
      "Happy to answer any questions - what would you like to know?",
      "",
      "Most people usually ask:",
      "",
      "* Who writes the content? We do - you just approve.",
      "* Can we use our own photos? Absolutely.",
      "* Is there a contract? No - month to month.",
      "",
      "Anything else on your mind, just ask. And if you want to see the quality first - 2 free samples, your business, your industry. Ready in a day. 🙂",
    ].join("\n"),
    "Questions - Follow-up 2": [
      `Hi ${name}, Naveen here.`,
      "",
      "Just checking if any question is still pending from your side.",
      "",
      "The package is simple: 30 custom posts every month for ₹4,999, content + design handled by us, month to month.",
      "",
      "If you'd like, I can send 2 free sample posters first so you can judge the quality before deciding.",
    ].join("\n"),
  };

  if (template === "Custom Message") return "";
  return templates[template] || "";
}
