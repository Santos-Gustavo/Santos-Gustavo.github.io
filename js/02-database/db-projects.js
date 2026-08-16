async function findOrCreateProject(companyId, clientId, v) {
  const name = cleanText(v.projectName);

  if (!name) {
    throw new Error("Nome da obra é obrigatório.");
  }

  const contractNum = cleanText(v.contractNum);

  let query = supabaseClient
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .limit(1);

  if (contractNum) {
    query = query.eq("contract_num", contractNum);
  } else {
    query = query.eq("name", name);
  }

  const { data: existing, error: findError } = await query.maybeSingle();

  if (findError) throw findError;

  const payload = {
    company_id: companyId,
    client_id: clientId,
    name,
    site_address: cleanText(v.location) || null,
    type_of_work: null,
    start_date: v.periodStart || null,
    expected_end_date: v.periodEnd || null,
    status: "active",
    contract_num: contractNum || null,
    contract_value: toNumberOrNull(v.contractValue),
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabaseClient
      .from("projects")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data, error } = await supabaseClient
    .from("projects")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


async function updateProjectById(projectId, companyId, clientId, v) {
  if (!projectId) {
    throw new Error("ID da obra em falta.");
  }

  const name = cleanText(v.projectName);

  if (!name) {
    throw new Error("Nome da obra é obrigatório.");
  }

  const payload = {
    company_id: companyId,
    client_id: clientId,
    name,
    site_address: cleanText(v.location),
    contract_num: cleanText(v.contractNum),
    contract_value: toNumberOrNull(v.contractValue),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from("projects")
    .update(payload)
    .eq("id", projectId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function deleteProjectById(projectId) {
  if (!projectId) {
    throw new Error("ID da obra em falta.");
  }

  const { data, error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

window.deleteProjectById = deleteProjectById;

window.updateProjectById = updateProjectById;