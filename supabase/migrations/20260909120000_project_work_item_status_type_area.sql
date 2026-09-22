-- PROJECT-HUB-INTEGRATION-001 — "+ Adicionar trabalho" on Estado da Obra now opens the
-- same fields used when adding a work item on a weekly report (Tipo de trabalho / Área /
-- Descrição / Estado), not just a free-text description. These two columns give manually
-- added items (no source report) a home for type/area, the same way `desc` was added in
-- 20260908120000_project_status_state.sql.

alter table public.project_work_item_status add column if not exists "type" text null;
alter table public.project_work_item_status add column if not exists "area" text null;
