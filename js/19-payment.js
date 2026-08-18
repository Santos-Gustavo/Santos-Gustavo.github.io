async function saveReportToSupabase() {
  const v = getV();

  try {
    let company;
    let client;
    let project;

    if (S.currentCompanyId && S.currentClientId && S.currentProjectId) {
      company = { id: S.currentCompanyId };
      client = { id: S.currentClientId };
      project = { id: S.currentProjectId };
    } else {
      company = await findOrCreateCompany(v);
      client = await findOrCreateClient(company.id, v);
      project = await findOrCreateProject(company.id, client.id, v);

      S.currentCompanyId = company.id;
      S.currentClientId = client.id;
      S.currentProjectId = project.id;
    }

    // Normalized DB: reports only need project_id
    const report = await createReport(project.id, v);

    // Normalized DB: photos only need report_id
    const photos = await savePhotosForReport({
      reportId: report.id
    });

    console.log("Saved normalized report:", {
      company,
      client,
      project,
      report,
      photos
    });

    alert("Relatório guardado com sucesso.");

    await renderProjectList();

    return {
      company,
      client,
      project,
      report,
      photos
    };

  } catch (error) {
    console.error("Supabase save error:", error);
    alert("Erro ao guardar relatório: " + error.message);
    return null;
  }
}


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

      throw new Error(realMessage);
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
          `Expira: ${data.expiresAt || "—"}`
        ].join("\n")
      );
    }

    if (method === "mbway") {
      alert("Pedido MB WAY enviado. Confirme no telemóvel.");
    }
  } catch (error) {
    console.error("Erro ao criar pagamento EuPago:", error);
    alert("Erro ao criar pagamento: " + error.message);
  }
}

window.createEupagoPayment = createEupagoPayment;