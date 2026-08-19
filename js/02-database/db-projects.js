async function findOrCreateProject(companyId, clientId, v) {
  const projectName = cleanText(v.projectName);

  if (!projectName) {
    throw new Error("Nome da obra é obrigatório.");
  }

  if (!companyId) {
    throw new Error("Empresa é obrigatória para criar obra.");
  }

  if (!clientId) {
    throw new Error("Cliente é obrigatório para criar obra.");
  }

  const payload = {
    company_id: companyId,
    client_id: clientId,

    name: projectName,
    site_address: cleanText(v.location) || null,
    type_of_work: cleanText(v.typeOfWork) || null,
    start_date: v.startDate || null,
    expected_end_date: v.expectedEndDate || null,
    actual_end_date: v.actualEndDate || null,
    contract_num: cleanText(v.contractNum) || null,
    contract_value: v.contractValue ? Number(v.contractValue) : null,
    internal_notes: cleanText(v.internalNotes) || null,

    status: 1
  };

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