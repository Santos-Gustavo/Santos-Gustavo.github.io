function cleanText(value) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);

  return Number.isFinite(num) ? num : null;
}

function normalizeSentVia(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (text === "whatsapp") return 1;
  if (text === "email") return 2;
  if (text === "pdf_download") return 3;
  if (text === "pdf") return 3;
  if (text === "manual") return 0;

  return 1; // default WhatsApp
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  const meta = parts[0];
  const base64 = parts[1];

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function guessExtensionFromDataUrl(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  if (dataUrl.startsWith("data:image/gif")) return "gif";
  return "jpg";
}
