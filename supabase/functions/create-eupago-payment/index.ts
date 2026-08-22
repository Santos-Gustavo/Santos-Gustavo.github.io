import { createClient } from "npm:@supabase/supabase-js@^2.0.0";

const PROVIDER_EUPAGO = 1;

const METHOD_MULTIBANCO = 1;
const METHOD_MBWAY = 2;

const STATUS_PENDING = 0;
const STATUS_FAILED = 2;

const PLAN_PRO_MONTHLY_AMOUNT = 19.0;
const PLAN_PRO_MONTHLY_PERIOD_DAYS = 30;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";

  const allowedOrigins = [
    "https://santos-gustavo.github.io",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5500",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8080",
  ];

  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : "https://santos-gustavo.github.io",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  const corsHeaders = getCorsHeaders(req);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;

  return String(phone)
    .replace(/\s+/g, "")
    .replace(/^(\+351)/, "")
    .trim();
}

function getEuPagoValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }

  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      req,
      {
        error: "Method not allowed.",
      },
      405,
    );
  }

  try {
    console.log("create-eupago-payment called", {
      method: req.method,
      origin: req.headers.get("origin"),
      hasEupagoKey: !!Deno.env.get("EUPAGO_API_KEY"),
      hasBaseUrl: !!Deno.env.get("EUPAGO_API_BASE_URL"),
      hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
      hasAnonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
      hasServiceRole: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    });

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse(
        req,
        {
          error: "Missing authorization header.",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      return jsonResponse(
        req,
        {
          error: "Missing SUPABASE_URL in Edge Function environment.",
        },
        500,
      );
    }

    if (!anonKey) {
      return jsonResponse(
        req,
        {
          error: "Missing SUPABASE_ANON_KEY in Edge Function environment.",
        },
        500,
      );
    }

    if (!serviceRoleKey) {
      return jsonResponse(
        req,
        {
          error: "Missing SUPABASE_SERVICE_ROLE_KEY in Edge Function environment.",
        },
        500,
      );
    }

    /**
     * Important:
     * - supabaseUser uses the user's JWT only to verify identity.
     * - supabaseAdmin uses service role for DB writes that frontend users must not do directly.
     */
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("User auth error:", userError);

      return jsonResponse(
        req,
        {
          error: "User not authenticated.",
          details: userError?.message || null,
        },
        401,
      );
    }

    console.log("authenticated user:", {
      id: user.id,
      email: user.email,
    });

    const body = await req.json().catch(() => ({}));

    console.log("payment request body:", body);

    const methodRaw = String(body.method || "").toLowerCase();

    const method =
      methodRaw === "multibanco"
        ? METHOD_MULTIBANCO
        : methodRaw === "mbway"
          ? METHOD_MBWAY
          : null;

    if (!method) {
      return jsonResponse(
        req,
        {
          error: "Método de pagamento inválido.",
        },
        400,
      );
    }

    const phone = normalizePhone(body.phone);

    if (method === METHOD_MBWAY && !phone) {
      return jsonResponse(
        req,
        {
          error: "Número MB WAY obrigatório.",
        },
        400,
      );
    }

    if (method === METHOD_MBWAY && !/^9\d{8}$/.test(phone || "")) {
      return jsonResponse(
        req,
        {
          error:
            "Número MB WAY inválido. Usa um número português com 9 dígitos começado por 9.",
        },
        400,
      );
    }

    const amount = PLAN_PRO_MONTHLY_AMOUNT;
    const periodDays = PLAN_PRO_MONTHLY_PERIOD_DAYS;
    const expiresAt = addDays(new Date(), 2);

    /**
     * Ownership is still manually enforced here.
     * Admin client bypasses RLS, so every admin query must include user ownership checks.
     */
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, email, owner_id, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    console.log("company lookup:", {
      company,
      companyError,
    });

    if (companyError || !company) {
      return jsonResponse(
        req,
        {
          error:
            "Nenhuma empresa encontrada para este utilizador. Cria primeiro uma empresa/obra antes de pagar.",
          details: companyError?.message || null,
        },
        400,
      );
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        company_id: company.id,
        provider: PROVIDER_EUPAGO,
        method,
        status: STATUS_PENDING,
        amount,
        currency: "EUR",
        period_days: periodDays,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    console.log("payment insert:", {
      payment,
      paymentError,
    });

    if (paymentError || !payment) {
      return jsonResponse(
        req,
        {
          error: "Erro ao criar pagamento na base de dados.",
          details: paymentError?.message || null,
          code: paymentError?.code || null,
        },
        400,
      );
    }

    const apiKey = Deno.env.get("EUPAGO_API_KEY");
    const baseUrl = Deno.env.get("EUPAGO_API_BASE_URL");

    if (!apiKey) {
      return jsonResponse(
        req,
        {
          error: "Missing EUPAGO_API_KEY secret.",
        },
        500,
      );
    }

    if (!baseUrl) {
      return jsonResponse(
        req,
        {
          error: "Missing EUPAGO_API_BASE_URL secret.",
        },
        500,
      );
    }

    let eupagoUrl: string;
    let eupagoPayload: Record<string, unknown>;

    if (method === METHOD_MULTIBANCO) {
      eupagoUrl = `${baseUrl}/clientes/rest_api/multibanco/create`;

      eupagoPayload = {
        chave: apiKey,
        valor: amount,
        id: payment.id,
        data_fim: expiresAt.toISOString().slice(0, 10),
        per_dup: 0,
      };
    } else {
      eupagoUrl = `${baseUrl}/clientes/rest_api/mbway/create`;

      eupagoPayload = {
        chave: apiKey,
        valor: amount,
        id: payment.id,
        alias: phone,
        descricao: `Plano Pro - ${company.name || "Empresa"}`,
      };
    }

    console.log("calling EuPago:", {
      eupagoUrl,
      eupagoPayload: {
        ...eupagoPayload,
        chave: "[hidden]",
      },
    });

    const eupagoResponse = await fetch(eupagoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eupagoPayload),
    });

    const eupagoText = await eupagoResponse.text();

    let eupagoData: Record<string, unknown>;

    try {
      eupagoData = JSON.parse(eupagoText);
    } catch {
      eupagoData = {
        raw: eupagoText,
      };
    }

    console.log("EuPago response:", {
      status: eupagoResponse.status,
      ok: eupagoResponse.ok,
      data: eupagoData,
    });

    if (!eupagoResponse.ok) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: STATUS_FAILED,
          raw_create_response: eupagoData,
        })
        .eq("id", payment.id);

      return jsonResponse(
        req,
        {
          error: "EuPago rejeitou o pedido de pagamento.",
          eupagoStatus: eupagoResponse.status,
          eupago: eupagoData,
        },
        400,
      );
    }

    const transactionId = getEuPagoValue(eupagoData, [
      "transaction_id",
      "transactionID",
      "transacao",
      "id_transacao",
      "id",
    ]);

    const reference = getEuPagoValue(eupagoData, [
      "reference",
      "referencia",
      "ref",
    ]);

    const entity = getEuPagoValue(eupagoData, ["entity", "entidade"]);

    const success = getEuPagoValue(eupagoData, [
      "success",
      "sucesso",
      "estado",
      "status",
    ]);

    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        eupago_transaction_id: transactionId ? String(transactionId) : null,
        eupago_reference: reference ? String(reference) : null,
        eupago_entity: entity ? String(entity) : null,
        eupago_identifier: payment.id,
        eupago_payment_method_code:
          method === METHOD_MULTIBANCO ? "PC:PT" : "MW:PT",
        raw_create_response: eupagoData,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      console.error("payment update after EuPago failed:", paymentUpdateError);

      return jsonResponse(
        req,
        {
          error: "Pagamento criado na EuPago, mas falhou ao atualizar a base de dados.",
          details: paymentUpdateError.message,
          code: paymentUpdateError.code,
          eupago: eupagoData,
        },
        500,
      );
    }

    return jsonResponse(req, {
      paymentId: payment.id,
      method: methodRaw,
      amount,
      currency: "EUR",
      entity,
      reference,
      transactionId,
      success,
      expiresAt: expiresAt.toISOString(),
      eupago: eupagoData,
    });
  } catch (error) {
    console.error("create-eupago-payment fatal error:", error);

    return jsonResponse(
      req,
      {
        error: error?.message || String(error),
        stack: error?.stack || null,
      },
      500,
    );
  }
});