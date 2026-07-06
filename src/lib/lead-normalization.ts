import {
  DEFAULT_ASSIGNEE,
  DEFAULT_INDUSTRY,
  assigneeOptions,
  leadSourceOptions,
} from "./constants";
import type { Lead, LeadDraft } from "./types";

type LeadInput = Lead | LeadDraft;

const autoDetectedSources = new Set(["", "Instagram", "Facebook", "WhatsApp", "Website", "Web"]);

export function inferLeadSourceFromUrl(url: string) {
  const value = url.trim().toLowerCase();
  if (!value) return "";

  if (value.includes("instagram.com")) return "Instagram";
  if (value.includes("facebook.com") || value.includes("fb.com") || value.includes("fb.me")) {
    return "Facebook";
  }
  if (
    value.includes("wa.me") ||
    value.includes("api.whatsapp.com") ||
    value.includes("whatsapp")
  ) {
    return "WhatsApp";
  }

  return "Website";
}

export function normalizeLeadForStorage<T extends LeadInput>(
  lead: T,
  options: { preferUrlSource?: boolean; sourceFallback?: string } = {},
): T {
  return {
    ...lead,
    assignedTo: normalizeAssignedTo(lead.assignedTo),
    industry: normalizeIndustry(lead.industry, [
      lead.leadUrl,
      lead.businessName,
      lead.leadName,
      lead.contactPerson,
      lead.remarks,
    ]),
    source: normalizeLeadSource(lead.source, lead.leadUrl, options),
  };
}

export function normalizeAssignedTo(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "captain") return DEFAULT_ASSIGNEE;

  const known = assigneeOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  return known || trimmed;
}

export function normalizeLeadSource(
  source: string,
  leadUrl: string,
  options: { preferUrlSource?: boolean; sourceFallback?: string } = {},
) {
  const detected = inferLeadSourceFromUrl(leadUrl);
  const canonical = canonicalSource(source);

  if (
    detected &&
    (options.preferUrlSource || autoDetectedSources.has(canonical || source.trim()))
  ) {
    return detected;
  }

  return canonical || detected || options.sourceFallback || "Other";
}

export function normalizeIndustry(industry: string, textParts: string[]) {
  const trimmed = industry.trim();
  if (trimmed && trimmed.toLowerCase() !== "poster campaign") return trimmed;

  return inferIndustryFromLeadText(textParts);
}

export function inferIndustryFromLeadText(textParts: string[]) {
  const text = textParts.join(" ").toLowerCase();

  if (
    /\b(clinic|hospital|dental|health|neuro|tooth|scan|ayurveda|care360|medical|doctor)\b/.test(
      text,
    )
  ) {
    return "Healthcare";
  }
  if (/\b(salon|beauty|makeup|lash|aesthetic|hair|spa|lounge)\b/.test(text)) {
    return "Salon & Beauty";
  }
  if (
    /\b(restaurant|cafe|mandhi|hotel|kitchen|brew|ruchi|baker|bakery|cake|pastr|food|dine)\b/.test(
      text,
    )
  ) {
    return "Restaurant & Food";
  }
  if (/\b(tennis|fitness|gym|martial|nutrition|academy|sports|run|yoga)\b/.test(text)) {
    return "Fitness & Sports";
  }
  if (
    /\b(builder|builders|homes|properties|realty|interio|architect|homez|fencing|decor|design)\b/.test(
      text,
    )
  ) {
    return "Real Estate & Interiors";
  }
  if (/\b(college|school|montessori|infotech|training|tuition|institute)\b/.test(text)) {
    return "Education";
  }
  if (
    /\b(jewel|gold|handloom|boutique|bridal|store|wear|spices|soaps|mart|fashion|textile)\b/.test(
      text,
    )
  ) {
    return "Retail";
  }
  if (/\b(event|wedding|decor|catering)\b/.test(text)) {
    return "Events";
  }
  if (/\b(travel|tour|resort|homestay)\b/.test(text)) {
    return "Travel & Hospitality";
  }

  return DEFAULT_INDUSTRY;
}

function canonicalSource(source: string) {
  const trimmed = source.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "web") return "Website";

  return leadSourceOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase()) || trimmed;
}
