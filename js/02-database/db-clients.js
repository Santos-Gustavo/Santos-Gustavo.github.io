async function findOrCreateClient(companyId, v) {
  const name = cleanText(v.clientName);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const { data: existing, error: findError } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  const payload = {
    company_id: companyId,
    name,
    phone: null,
    email: null,
    address: cleanText(v.location) || null,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { data: updated, error: updateError } = await supabaseClient
      .from("clients")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return updated;
  }

  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


async function updateClientById(clientId, companyId, v) {
  if (!clientId) {
    throw new Error("ID do cliente em falta.");
  }

  const name = cleanText(v.clientName);

  if (!name) {
    throw new Error("Nome do cliente é obrigatório.");
  }

  const payload = {
    company_id: companyId,
    name,
    phone: null,
    email: null,
    address: cleanText(v.location),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

window.updateClientById = updateClientById;