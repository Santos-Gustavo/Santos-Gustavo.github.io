import { supabase } from "#database/supabase-client.js";

export async function createProjectStatusEvent({
  projectId,
  oldStatus = null,
  newStatus = null,
  oldHiddenAt = null,
  newHiddenAt = null,
  closureType = null,
  reason = "",
  note = "",
  changedBy,
  snapshotJson = {},
}) {
  if (!projectId) {
    throw new Error("Missing projectId for project status event.");
  }

  if (!changedBy) {
    throw new Error("Missing changedBy for project status event.");
  }

  const payload = {
    project_id: projectId,
    old_status: oldStatus,
    new_status: newStatus,
    old_hidden_at: oldHiddenAt,
    new_hidden_at: newHiddenAt,
    closure_type: closureType || null,
    reason: reason || null,
    note: note || null,
    changed_by: changedBy,
    snapshot_json: snapshotJson || {},
  };

  const { data, error } = await supabase
    .from("project_status_events")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Error creating project status event:", error);
    throw error;
  }

  return data;
}

export async function getProjectStatusEvents(projectId) {
  if (!projectId) {
    throw new Error("Missing projectId for project status events lookup.");
  }

  const { data, error } = await supabase
    .from("project_status_events")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading project status events:", error);
    throw error;
  }

  return data || [];
}