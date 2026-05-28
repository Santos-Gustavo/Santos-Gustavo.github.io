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

  if (existing) return existing;

  const payload = {
    company_id: companyId,
    name,
    phone: null,
    email: null,
    address: null,
    notes: null
  };

  const { data, error } = await supabaseClient
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}
