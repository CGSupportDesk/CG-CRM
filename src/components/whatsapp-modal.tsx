"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import { Button, FieldLabel, inputClasses } from "@/components/ui";
import {
  buildWhatsappMessage,
  getDefaultWhatsappTemplate,
  getWhatsappRecipientName,
  whatsappTemplateOptions,
} from "@/lib/whatsapp-templates";
import { buildWhatsAppUrl, formatPhoneForWhatsApp } from "@/lib/whatsapp";
import type { Lead, StudioClient, WhatsappTemplateKey } from "@/lib/types";

type WhatsappRecipient = Lead | StudioClient;

export function WhatsAppModal({
  recipient,
  onClose,
  onOpened,
}: {
  recipient: WhatsappRecipient;
  onClose: () => void;
  onOpened?: (template: WhatsappTemplateKey) => Promise<void> | void;
}) {
  const defaultTemplate = useMemo(() => getDefaultWhatsappTemplate(recipient), [recipient]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplateKey>(defaultTemplate);
  const [message, setMessage] = useState(() => buildWhatsappMessage(defaultTemplate, recipient));
  const [error, setError] = useState("");
  const formattedPhone = formatPhoneForWhatsApp(recipient.phone);

  function changeTemplate(template: WhatsappTemplateKey) {
    setSelectedTemplate(template);
    setMessage(buildWhatsappMessage(template, recipient));
    setError("");
  }

  function openWhatsApp() {
    const url = buildWhatsAppUrl(recipient.phone, message);
    if (!url) {
      setError("No valid WhatsApp number available.");
      return;
    }

    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      setError("Could not open WhatsApp. Please allow pop-ups for Growth Engine.");
      return;
    }

    void onOpened?.(selectedTemplate);
    onClose();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[#b8ead6] bg-[#eafaf3] p-4 text-sm font-semibold leading-6 text-[#0c7c52]">
        This opens WhatsApp with the message pre-filled. You still need to press Send inside WhatsApp.
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="rounded-[18px] border border-border bg-surface-soft p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Recipient</p>
          <p className="mt-2 font-semibold">{getWhatsappRecipientName(recipient)}</p>
          <p className="mt-1 text-sm text-muted">
            {formattedPhone ? `WhatsApp: ${formattedPhone}` : "No valid WhatsApp number available."}
          </p>
        </div>
        <FieldLabel label="Template">
          <select
            className={inputClasses}
            value={selectedTemplate}
            onChange={(event) => changeTemplate(event.target.value as WhatsappTemplateKey)}
          >
            {whatsappTemplateOptions.map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>

      <FieldLabel label="Message Preview">
        <textarea
          className={`${inputClasses} min-h-72 py-3 leading-6`}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setSelectedTemplate("Custom Message");
            setError("");
          }}
          placeholder="Type a custom WhatsApp message."
        />
      </FieldLabel>

      {error ? (
        <div className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-4 text-sm font-semibold text-[#bd2727]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={openWhatsApp}>
          <MessageCircle className="h-4 w-4" />
          Open WhatsApp
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
