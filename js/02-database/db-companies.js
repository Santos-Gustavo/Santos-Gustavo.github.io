async function requireUser() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) throw error;

  const user = data.user;

  if (!user) {
    throw new Error("Precisa de entrar na conta antes de guardar.");
  }

  return user;
}

async function findOrCreateCompany(v) {
  const user = await requireUser();

  const name = cleanText(v.companyName);
  const nif = cleanText(v.companyNif);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  let query = supabaseClient
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1);

  if (nif) {
    query = query.eq("nif", nif);
  } else {
    query = query.eq("name", name);
  }

  const { data: existing, error: findError } = await query.maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { data: updated, error: updateError } = await supabaseClient
      .from("companies")
      .update({
        name,
        nif: nif || existing.nif,
        impic: cleanText(v.companyInci) || existing.impic,
        responsible: cleanText(v.responsible) || existing.responsible,
        phone: cleanText(v.companyPhone) || existing.phone,
        email: cleanText(v.companyEmail) || existing.email,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const payload = {
    owner_id: user.id,
    name,
    nif: nif || null,
    impic: cleanText(v.companyInci) || null,
    responsible: cleanText(v.responsible) || null,
    phone: cleanText(v.companyPhone) || null,
    email: cleanText(v.companyEmail) || null,
    default_vat_rate: 23.00
  };

  const { data, error } = await supabaseClient
    .from("companies")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}


async function updateCompanyById(companyId, v) {
  const user = await requireUser();

  if (!companyId) {
    throw new Error("ID da empresa em falta.");
  }

  const name = cleanText(v.companyName);

  if (!name) {
    throw new Error("Nome da empresa é obrigatório.");
  }

  const payload = {
    name,
    nif: cleanText(v.companyNif),
    impic: cleanText(v.companyInci),
    responsible: cleanText(v.responsible),
    phone: cleanText(v.companyPhone),
    email: cleanText(v.companyEmail),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from("companies")
    .update(payload)
    .eq("id", companyId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

window.updateCompanyById = updateCompanyById;