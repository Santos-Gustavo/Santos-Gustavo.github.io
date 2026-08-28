export const PROJECT_STATUS = Object.freeze({
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
  ARCHIVED: 5,
});

export const PROJECT_VISIBILITY = Object.freeze({
  VISIBLE: "visible",
  HIDDEN: "hidden",
});

export const PROJECT_CLOSURE_TYPE = Object.freeze({
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ABANDONED: "abandoned",
  DISPUTED: "disputed",
  TRANSFERRED: "transferred",
  OTHER: "other",
});

export const PROJECT_STATUS_LABELS = Object.freeze({
  [PROJECT_STATUS.ACTIVE]: "Em curso",
  [PROJECT_STATUS.PAUSED]: "Pausada",
  [PROJECT_STATUS.COMPLETED]: "Concluída",
  [PROJECT_STATUS.ARCHIVED]: "Arquivada",
});

export const PROJECT_CLOSURE_TYPE_LABELS = Object.freeze({
  [PROJECT_CLOSURE_TYPE.COMPLETED]: "Concluída",
  [PROJECT_CLOSURE_TYPE.CANCELLED]: "Cancelada",
  [PROJECT_CLOSURE_TYPE.ABANDONED]: "Abandonada",
  [PROJECT_CLOSURE_TYPE.DISPUTED]: "Em disputa",
  [PROJECT_CLOSURE_TYPE.TRANSFERRED]: "Transferida",
  [PROJECT_CLOSURE_TYPE.OTHER]: "Outro motivo",
});

export function normalizeProjectStatus(status) {
  const numericStatus = Number(status);

  if (Object.values(PROJECT_STATUS).includes(numericStatus)) {
    return numericStatus;
  }

  return PROJECT_STATUS.ACTIVE;
}

export function getProjectStatusLabel(status) {
  const normalizedStatus = normalizeProjectStatus(status);

  return PROJECT_STATUS_LABELS[normalizedStatus] || "Estado desconhecido";
}

export function getProjectClosureTypeLabel(closureType) {
  if (!closureType) {
    return "";
  }

  return PROJECT_CLOSURE_TYPE_LABELS[closureType] || "Outro motivo";
}

export function isProjectActive(project) {
  return normalizeProjectStatus(project?.status) === PROJECT_STATUS.ACTIVE;
}

export function isProjectPaused(project) {
  return normalizeProjectStatus(project?.status) === PROJECT_STATUS.PAUSED;
}

export function isProjectCompleted(project) {
  return normalizeProjectStatus(project?.status) === PROJECT_STATUS.COMPLETED;
}

export function isProjectArchived(project) {
  return normalizeProjectStatus(project?.status) === PROJECT_STATUS.ARCHIVED;
}

export function isProjectHidden(project) {
  return Boolean(project?.hidden_at);
}

export function isProjectVisible(project) {
  return !isProjectHidden(project);
}

export function canPauseProject(project) {
  return isProjectActive(project);
}

export function canResumeProject(project) {
  return isProjectPaused(project);
}

export function canCompleteProject(project) {
  return isProjectActive(project) || isProjectPaused(project);
}

export function canArchiveProject(project) {
  return isProjectPaused(project) || isProjectCompleted(project);
}

export function canHideProject(project) {
  return isProjectArchived(project) && isProjectVisible(project);
}

export function canUnhideProject(project) {
  return isProjectArchived(project) && isProjectHidden(project);
}

export function canReopenProject(project) {
  return isProjectArchived(project) || isProjectCompleted(project);
}

export function canCreateWeeklyReport(project) {
  return isProjectActive(project) || isProjectPaused(project);
}

export function canCreateLegalFinancialReport(project) {
  return (
    isProjectActive(project) ||
    isProjectPaused(project) ||
    isProjectCompleted(project)
  );
}

export function canUploadProjectPhoto(project) {
  return (
    isProjectActive(project) ||
    isProjectPaused(project) ||
    isProjectCompleted(project)
  );
}

export function canEditProject(project) {
  return (
    isProjectActive(project) ||
    isProjectPaused(project) ||
    isProjectCompleted(project)
  );
}

export function canShowInDefaultProjectList(project) {
  return !isProjectArchived(project) && isProjectVisible(project);
}

export function canShowInArchivedProjectList(project) {
  return isProjectArchived(project) && isProjectVisible(project);
}

export function canShowInHiddenProjectList(project) {
  return isProjectArchived(project) && isProjectHidden(project);
}

export function getAllowedProjectActions(project) {
  return {
    pause: canPauseProject(project),
    resume: canResumeProject(project),
    complete: canCompleteProject(project),
    archive: canArchiveProject(project),
    hide: canHideProject(project),
    unhide: canUnhideProject(project),
    reopen: canReopenProject(project),
    createWeeklyReport: canCreateWeeklyReport(project),
    createLegalFinancialReport: canCreateLegalFinancialReport(project),
    uploadPhoto: canUploadProjectPhoto(project),
    edit: canEditProject(project),
  };
}

export function validateProjectTransition(project, nextStatus) {
  const currentStatus = normalizeProjectStatus(project?.status);
  const normalizedNextStatus = normalizeProjectStatus(nextStatus);

  if (currentStatus === normalizedNextStatus) {
    return {
      allowed: false,
      reason: "O projeto já está nesse estado.",
    };
  }

  if (
    currentStatus === PROJECT_STATUS.ACTIVE &&
    normalizedNextStatus === PROJECT_STATUS.ARCHIVED
  ) {
    return {
      allowed: false,
      reason:
        "Um projeto em curso não pode ser arquivado diretamente. Primeiro pause ou conclua o projeto.",
    };
  }

  if (
    currentStatus === PROJECT_STATUS.ACTIVE &&
    normalizedNextStatus === PROJECT_STATUS.PAUSED
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.ACTIVE &&
    normalizedNextStatus === PROJECT_STATUS.COMPLETED
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.PAUSED &&
    normalizedNextStatus === PROJECT_STATUS.ACTIVE
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.PAUSED &&
    normalizedNextStatus === PROJECT_STATUS.COMPLETED
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.PAUSED &&
    normalizedNextStatus === PROJECT_STATUS.ARCHIVED
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.COMPLETED &&
    normalizedNextStatus === PROJECT_STATUS.ARCHIVED
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.COMPLETED &&
    normalizedNextStatus === PROJECT_STATUS.ACTIVE
  ) {
    return { allowed: true, reason: "" };
  }

  if (
    currentStatus === PROJECT_STATUS.ARCHIVED &&
    normalizedNextStatus === PROJECT_STATUS.ACTIVE
  ) {
    return { allowed: true, reason: "" };
  }

  return {
    allowed: false,
    reason: "Transição de estado não permitida.",
  };
}