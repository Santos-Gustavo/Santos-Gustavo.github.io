import { createClient } from "npm:@supabase/supabase-js@^2.0.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const STATUS_PENDING = 0;
const STATUS_PAID = 1;

const SUBSCRIPTION_ACTIVE = 2;
const PLAN_PRO_MONTHLY = 1;

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Only these non-personal webhook fields are logged and stored in
// payments.raw_webhook_payload. Everything else is dropped — notably
// chave_api (the EuPago API key) and any customer data.
const WEBHOOK_PAYLOAD_FIELDS = [
  "valor", "canal", "referencia", "reference", "transacao", "transaction_id",
  "transactionID", "identificador", "id", "order_id", "mp", "data", "entidade",
  "entity", "comissao", "local", "estado", "status",
];

function minimisePayload(payload: Record<string, unknown>) {
  const kept: Record<string, unknown> = {};

  for (const key of WEBHOOK_PAYLOAD_FIELDS) {
    const value = payload?.[key];
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      kept[key] = value;
    }
  }

  return kept;
}

async function parsePayload(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

// Constant-time comparison of the shared secret.
function secretsMatch(received: string, expected: string) {
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const expectedApiKey = Deno.env.get("EUPAGO_API_KEY");

    if (!expectedApiKey) {
      console.error("EuPago webhook rejected: EUPAGO_API_KEY is not configured");
      return new Response("Unavailable", { status: 503 });
    }

    const payload = await parsePayload(req).catch(() => null);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return new Response("Bad request", { status: 400 });
    }

    const payloadSummary = minimisePayload(payload);

    console.log("EuPago webhook payload:", payloadSummary);

    // EuPago webhook 1.0 sends the account's chave_api with every
    // notification. It is mandatory: a missing or wrong key is rejected
    // before any payment lookup. (Webhook 2.0 signatures are not handled.)
    const apiKeyFromPayload = typeof payload.chave_api === "string" ? payload.chave_api : "";

    if (!apiKeyFromPayload || !secretsMatch(apiKeyFromPayload, expectedApiKey)) {
      console.warn("EuPago webhook rejected: missing or invalid chave_api");
      return new Response("Unauthorized", { status: 401 });
    }

    const identifier =
      payload.identificador ||
      payload.id ||
      payload.order_id ||
      null;

    const transactionId =
      payload.transacao ||
      payload.transaction_id ||
      payload.transactionID ||
      null;

    const reference =
      payload.referencia ||
      payload.reference ||
      null;

    if (!identifier && !transactionId && !reference) {
      return new Response("Missing payment identifier", { status: 400 });
    }

    let query = supabase
      .from("payments")
      .select("id, company_id, status, period_days, amount")
      .limit(1);

    if (identifier) {
      query = query.eq("id", identifier);
    } else if (transactionId) {
      query = query.eq("eupago_transaction_id", transactionId);
    } else {
      query = query.eq("eupago_reference", reference);
    }

    const { data: payments, error: paymentError } = await query;

    if (paymentError) throw paymentError;

    const payment = payments?.[0];

    if (!payment) {
      console.warn("Payment not found for payload:", payloadSummary);
      return new Response("Payment not found", { status: 404 });
    }

    if (payment.status === STATUS_PAID) {
      return new Response("Already processed", { status: 200 });
    }

    const now = new Date();
    const periodEnd = addDays(now, payment.period_days || 30);

    const { error: updatePaymentError } = await supabase
      .from("payments")
      .update({
        status: STATUS_PAID,
        paid_at: now.toISOString(),
        raw_webhook_payload: payloadSummary,
        eupago_transaction_id: transactionId,
        eupago_reference: reference,
        eupago_entity: payload.entidade || payload.entity || null,
        eupago_payment_method_code: payload.mp || null,
      })
      .eq("id", payment.id)
      .eq("status", STATUS_PENDING);

    if (updatePaymentError) throw updatePaymentError;

    const { error: updateCompanyError } = await supabase
      .from("companies")
      .update({
        subscription_status: SUBSCRIPTION_ACTIVE,
        subscription_plan: PLAN_PRO_MONTHLY,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", payment.company_id);

    if (updateCompanyError) throw updateCompanyError;

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("EuPago webhook error:", error);

    return new Response("Webhook error", {
      status: 500,
    });
  }
});