// js/payments/payment.js

import { supabaseClient } from "#database/supabase-client.js";

let initialized = false;

export function initPayments() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", handlePaymentClick);

  installTemporaryPaymentBridge();
}

async function handlePaymentClick(event) {
  const actionEl = event.target.closest("[data-payment-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.paymentAction;

  event.preventDefault();

  if (action === "create-eupago-payment") {
    const method = actionEl.dataset.paymentMethod;
    await createEupagoPayment(method);
  }
}

export async function createEupagoPayment(method) {
  console.log("createEupagoPayment clicked:", method);

  try {
    if (!method) {
      throw new Error("Método de pagamento em falta.");
    }

    let phone = null;

    if (method === "mbway") {
      phone = prompt("Número MB WAY:");

      if (!phone) {
        alert("Número MB WAY obrigatório.");
        return null;
      }
    }

    const { data, error } = await supabaseClient.functions.invoke(
      "create-eupago-payment",
      {
        body: {
          method,
          phone,
        },
      },
    );

    console.log("EuPago Edge Function response:", { data, error });

    if (error) {
      throw new Error(await extractFunctionErrorMessage(error));
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (method === "multibanco") {
      alert(
        [
          "Referência Multibanco criada.",
          "",
          `Entidade: ${data.entity || "—"}`,
          `Referência: ${data.reference || "—"}`,
          `Valor: ${data.amount || "—"}€`,
          `Expira: ${data.expiresAt || "—"}`,
        ].join("\n"),
      );
    }

    if (method === "mbway") {
      alert("Pedido MB WAY enviado. Confirme no telemóvel.");
    }

    return data || null;
  } catch (error) {
    console.error("Erro ao criar pagamento EuPago:", error);
    alert("Erro ao criar pagamento: " + error.message);
    return null;
  }
}

async function extractFunctionErrorMessage(error) {
  let realMessage = error.message || "Erro desconhecido na Edge Function.";

  try {
    if (error.context instanceof Response) {
      const errorBody = await error.context.json();

      realMessage =
        errorBody.error ||
        errorBody.details ||
        JSON.stringify(errorBody);
    }
  } catch (parseError) {
    console.error("Could not parse Edge Function error body:", parseError);
  }

  return realMessage;
}

function installTemporaryPaymentBridge() {
  // Temporary bridge for old inline onclick handlers.
  // Remove after index.html payment buttons use data-payment-action.
  window.createEupagoPayment = createEupagoPayment;
}