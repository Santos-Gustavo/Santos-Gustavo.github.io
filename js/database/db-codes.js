export const PROJECT_STATUS = Object.freeze({
  DRAFT: 0,
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
  ARCHIVED: 5,
});

export const REPORT_STATUS = Object.freeze({
  DRAFT: 0,
  READY: 1,
  SENT: 2,
  APPROVED: 3,
  ARCHIVED: 4,
});

export const SENT_VIA = Object.freeze({
  MANUAL_UNKNOWN: 0,
  WHATSAPP: 1,
  EMAIL: 2,
  PDF_DOWNLOAD: 3,
  OTHER: 4,
});

export const PHOTO_SOURCE = Object.freeze({
  MANUAL: 0,
  UPLOAD: 1,
  WHATSAPP: 2,
  MOBILE: 3,
  API: 4,
});

export const PHOTO_STAGE = Object.freeze({
  NORMAL: 0,
  BEFORE: 1,
  AFTER: 2,
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 0,
  PAID: 1,
  FAILED: 2,
  EXPIRED: 3,
  CANCELLED: 4,
});

export const PAYMENT_METHOD = Object.freeze({
  MULTIBANCO: "multibanco",
  MBWAY: "mbway",
});

export function mapSentViaLabelToCode(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "whatsapp") return SENT_VIA.WHATSAPP;
  if (normalized === "email") return SENT_VIA.EMAIL;
  if (normalized === "pdf" || normalized === "download" || normalized === "pdf_download") {
    return SENT_VIA.PDF_DOWNLOAD;
  }
  if (normalized === "portal" || normalized === "impresso" || normalized === "other") {
    return SENT_VIA.OTHER;
  }

  return SENT_VIA.MANUAL_UNKNOWN;
}

export function mapSentViaCodeToLabel(code) {
  if (code === SENT_VIA.WHATSAPP) return "WhatsApp";
  if (code === SENT_VIA.EMAIL) return "Email";
  if (code === SENT_VIA.PDF_DOWNLOAD) return "PDF";
  if (code === SENT_VIA.OTHER) return "Outro";
  return "Manual";
}