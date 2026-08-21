import { supabaseClient } from "#database/supabase-client.js";
import { createProjectStatusEvent } from "#database/db-project-status-events.js";
import {
  PROJECT_STATUS,
  PROJECT_CLOSURE_TYPE,
  normalizeProjectStatus,
  validateProjectTransition,
} from "#projects/project-status-rules.js";

function requireProject(project) {
  if (!project?.id) {
    throw new Error("Missing project for status transition.");
  }
}

function requireReason(reason, actionLabel) {
  if (!String(reason || "").trim()) {
    throw new Error(`É obrigatório indicar o motivo para: ${actionLabel}.`);
  }
}

function getProjectHiddenAt(project) {
  return project?.hidden_at || project?.hiddenAt || null;
}

function getCurrentUserIdFromSession(sessionData) {
  const userId = sessionData?.session?.user?.id || sessionData?.user?.id;

  if (!userId) {
    throw new Error("Não foi possível identificar o utilizador autenticado.");
  }

  return userId;
}

async function getCurrentUserId() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw error;
  }

  return getCurrentUserIdFromSession(data);
}

async function updateProjectLifecycle(projectId, updates) {
  const { data, error } = await supabaseClient
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) {
    console.error("Error updating project lifecycle:", error);
    throw error;
  }

  return data;
}

function buildBasicSnapshot(project, extra = {}) {
  return {
    project_id: project.id,
    project_name: project.name || null,
    company_id: project.company_id || project.companyId || null,
    client_id: project.client_id || project.clientId || null,
    status: project.status ?? null,
    hidden_at: getProjectHiddenAt(project),
    archived_at: project.archived_at || project.archivedAt || null,
    closure_type: project.closure_type || project.closureType || null,
    closure_reason: project.closure_reason || project.closureReason || null,
    snapshot_created_at: new Date().toISOString(),
    ...extra,
  };
}

async function transitionProjectStatus({
  project,
  nextStatus,
  reason,
  note = "",
  closureType = null,
  updates = {},
  snapshotExtra = {},
}) {
  requireProject(project);

  const oldStatus = normalizeProjectStatus(project.status);
  const normalizedNextStatus = normalizeProjectStatus(nextStatus);
  const validation = validateProjectTransition(project, normalizedNextStatus);

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  const changedBy = await getCurrentUserId();
  const now = new Date().toISOString();

  const lifecycleUpdates = {
    status: normalizedNextStatus,
    ...updates,
  };

  if (normalizedNextStatus === PROJECT_STATUS.COMPLETED) {
    lifecycleUpdates.closed_at = now;
    lifecycleUpdates.closure_type =
      closureType || PROJECT_CLOSURE_TYPE.COMPLETED;
    lifecycleUpdates.closure_reason = reason || null;
  }

  if (normalizedNextStatus === PROJECT_STATUS.ARCHIVED) {
    lifecycleUpdates.archived_at = now;
    lifecycleUpdates.closure_type = closureType || project.closure_type || project.closureType || null;
    lifecycleUpdates.closure_reason = reason || project.closure_reason || project.closureReason || null;
  }

  if (normalizedNextStatus === PROJECT_STATUS.ACTIVE) {
    lifecycleUpdates.reopened_at = now;
  }

  const updatedProject = await updateProjectLifecycle(
    project.id,
    lifecycleUpdates
  );

  await createProjectStatusEvent({
    projectId: project.id,
    oldStatus,
    newStatus: normalizedNextStatus,
    oldHiddenAt: getProjectHiddenAt(project),
    newHiddenAt: updatedProject.hidden_at || null,
    closureType: lifecycleUpdates.closure_type || null,
    reason,
    note,
    changedBy,
    snapshotJson: buildBasicSnapshot(project, {
      transition: {
        old_status: oldStatus,
        new_status: normalizedNextStatus,
        reason: reason || null,
        note: note || null,
        closure_type: lifecycleUpdates.closure_type || null,
      },
      ...snapshotExtra,
    }),
  });

  return updatedProject;
}

export async function pauseProject(project, { reason, note = "" } = {}) {
  requireReason(reason, "pausar projeto");

  return transitionProjectStatus({
    project,
    nextStatus: PROJECT_STATUS.PAUSED,
    reason,
    note,
  });
}

export async function resumeProject(project, { reason, note = "" } = {}) {
  requireReason(reason, "retomar projeto");

  return transitionProjectStatus({
    project,
    nextStatus: PROJECT_STATUS.ACTIVE,
    reason,
    note,
  });
}

export async function completeProject(
  project,
  { reason, note = "", closureType = PROJECT_CLOSURE_TYPE.COMPLETED } = {}
) {
  requireReason(reason, "concluir projeto");

  return transitionProjectStatus({
    project,
    nextStatus: PROJECT_STATUS.COMPLETED,
    reason,
    note,
    closureType,
  });
}

export async function archiveProject(
  project,
  { reason, note = "", closureType = null, snapshotExtra = {} } = {}
) {
  requireReason(reason, "arquivar projeto");

  return transitionProjectStatus({
    project,
    nextStatus: PROJECT_STATUS.ARCHIVED,
    reason,
    note,
    closureType,
    snapshotExtra,
  });
}

export async function reopenProject(project, { reason, note = "" } = {}) {
  requireReason(reason, "reabrir projeto");

  return transitionProjectStatus({
    project,
    nextStatus: PROJECT_STATUS.ACTIVE,
    reason,
    note,
    updates: {
      hidden_at: null,
    },
  });
}

export async function hideArchivedProject(project, { reason, note = "" } = {}) {
  requireProject(project);
  requireReason(reason, "ocultar projeto arquivada");

  const oldStatus = normalizeProjectStatus(project.status);

  if (oldStatus !== PROJECT_STATUS.ARCHIVED) {
    throw new Error("Só é possível ocultar projetos arquivadas.");
  }

  if (getProjectHiddenAt(project)) {
    throw new Error("A projeto já está oculta.");
  }

  const changedBy = await getCurrentUserId();
  const now = new Date().toISOString();

  const updatedProject = await updateProjectLifecycle(project.id, {
    hidden_at: now,
  });

  await createProjectStatusEvent({
    projectId: project.id,
    oldStatus,
    newStatus: oldStatus,
    oldHiddenAt: getProjectHiddenAt(project),
    newHiddenAt: updatedProject.hidden_at || null,
    closureType: project.closure_type || project.closureType || null,
    reason,
    note,
    changedBy,
    snapshotJson: buildBasicSnapshot(project, {
      transition: {
        action: "hide",
        reason,
        note,
      },
    }),
  });

  return updatedProject;
}

export async function unhideArchivedProject(
  project,
  { reason, note = "" } = {}
) {
  requireProject(project);
  requireReason(reason, "mostrar projeto oculta");

  const oldStatus = normalizeProjectStatus(project.status);

  if (oldStatus !== PROJECT_STATUS.ARCHIVED) {
    throw new Error("Só é possível restaurar visibilidade de projetos arquivadas.");
  }

  if (!getProjectHiddenAt(project)) {
    throw new Error("A projeto não está oculta.");
  }

  const changedBy = await getCurrentUserId();

  const updatedProject = await updateProjectLifecycle(project.id, {
    hidden_at: null,
  });

  await createProjectStatusEvent({
    projectId: project.id,
    oldStatus,
    newStatus: oldStatus,
    oldHiddenAt: getProjectHiddenAt(project),
    newHiddenAt: null,
    closureType: project.closure_type || project.closureType || null,
    reason,
    note,
    changedBy,
    snapshotJson: buildBasicSnapshot(project, {
      transition: {
        action: "unhide",
        reason,
        note,
      },
    }),
  });

  return updatedProject;
}