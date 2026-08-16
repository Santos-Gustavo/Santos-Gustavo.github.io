async function deleteProject(id) {
  const proj = getProjectById(id);

  if (!proj) {
    alert("Obra não encontrada.");
    return;
  }

  const confirmed = confirm(
    `Tem a certeza que quer apagar a obra "${proj.name}"?\n\nEsta ação pode apagar relatórios associados.`
  );

  if (!confirmed) return;

  try {
    await deleteProjectById(id);

    if (S.currentProjectId === id) {
      S.currentProjectId = null;
      S.currentClientId = null;
      S.currentCompanyId = null;
      S.mode = "";
      S.flow = null;
      S.isEditingProject = false;
      S.isNewProject = false;
    }

    await renderProjectList();

    alert("Obra apagada com sucesso.");

  } catch (error) {
    console.error("Error deleting project:", error);
    alert("Erro ao apagar obra: " + error.message);
  }
}

window.deleteProject = deleteProject;