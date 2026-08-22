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

async function parsePayload(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

Deno.serve(async (req) => {
  try {
    const payload = await parsePayload(req);

    console.log("EuPago webhook payload:", payload);

    const apiKeyFromPayload = payload.chave_api || payload.chave || null;
    const expectedApiKey = Deno.env.get("EUPAGO_API_KEY");

    // Basic verification: EuPago webhook 1.0 sends chave_api.
    // If your EuPago webhook 2.0 has a stronger signature, use that instead.
    if (apiKeyFromPayload && expectedApiKey && apiKeyFromPayload !== expectedApiKey) {
      return new Response("Invalid API key", { status: 403 });
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
      console.warn("Payment not found for payload:", payload);
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
        raw_webhook_payload: payload,
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

    return new Response("Webhook error: " + error.message, {
      status: 500,
    });
  }
});