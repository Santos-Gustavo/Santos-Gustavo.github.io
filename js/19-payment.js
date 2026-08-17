async function createEupagoPayment(method) {
  console.log("createEupagoPayment clicked:", method);

  try {
    let phone = null;

    if (method === "mbway") {
      phone = prompt("Número MB WAY:");

      if (!phone) {
        alert("Número MB WAY obrigatório.");
        return;
      }
    }

    const { data, error } = await supabaseClient.functions.invoke(
      "create-eupago-payment",
      {
        body: {
          method,
          phone
        }
      }
    );

    console.log("EuPago Edge Function response:", { data, error });

    if (error) {
      console.error("Edge Function invoke error full object:", error);
      throw new Error(
        error.message ||
        error.context?.error ||
        JSON.stringify(error)
      );
    }

    if (data?.error) {
      console.error("Edge Function returned data error:", data);
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
          `Expira: ${data.expiresAt || "—"}`
        ].join("\n")
      );
    }

    if (method === "mbway") {
      alert("Pedido MB WAY enviado. Confirme no telemóvel.");
    }
  } catch (error) {
    console.error("Erro ao criar pagamento EuPago:", error);
    alert("Erro ao criar pagamento: " + (error.message || JSON.stringify(error)));
  }
}

window.createEupagoPayment = createEupagoPayment;