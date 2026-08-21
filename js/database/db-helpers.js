export function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

export function toNullableText(value) {
  const text = cleanText(value);
  return text || null;
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function assertRequired(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function normalizeDbError(error, fallbackMessage = "Erro na base de dados.") {
  if (!error) return new Error(fallbackMessage);

  const message = [
    error.message,
    error.details,
    error.hint,
    error.code,
  ].filter(Boolean).join(" | ");

  return new Error(message || fallbackMessage);
}

export function throwIfDbError(error, fallbackMessage) {
  if (error) {
    throw normalizeDbError(error, fallbackMessage);
  }
}