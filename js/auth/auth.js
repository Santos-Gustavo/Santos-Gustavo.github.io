import { supabaseClient } from "#database/supabase-client.js";
import { renderProjectList } from "#projects/project-list.js";
import { loadPrimaryCompanyIntoState } from "#company/company-profile.js";


let currentUser = null;
// Guards against a stale/in-flight onAuthStateChange event (e.g. a
// background token refresh that was already scheduled) firing with a
// truthy session in the middle of an explicit sign-out and re-showing the
// app shell right after signOut() has already torn it down.
let signingOut = false;

export function getCurrentUser() {
  return currentUser;
}

export async function initAuth() {
  bindAuthEvents();

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Auth session error:", error);
    showAuthMessage("Erro ao verificar sessão.", true);
    showLoggedOutUI();
    return;
  }

  currentUser = data.session?.user || null;

  if (currentUser) {
    await showLoggedInUI();
  } else {
    showLoggedOutUI();
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth event:", event);

    if (signingOut) return;

    currentUser = session?.user || null;

    if (currentUser) {
      await showLoggedInUI();
    } else {
      showLoggedOutUI();
    }
  });
}

function bindAuthEvents() {
  document.addEventListener("click", async (event) => {
    const actionEl = event.target.closest("[data-auth-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.authAction;

    if (action === "sign-in") {
      await signIn();
      return;
    }

    if (action === "sign-up") {
      await signUp();
      return;
    }

    if (action === "reset-password") {
      await resetPassword();
      return;
    }

    if (action === "sign-out") {
      await signOut();
    }
  });
}

async function signUp() {
  const email = getAuthEmail();
  const password = getAuthPassword();

  if (!email || !password) {
    showAuthMessage("Email e password são obrigatórios.", true);
    return;
  }

  if (password.length < 6) {
    showAuthMessage("A password deve ter pelo menos 6 caracteres.", true);
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Sign up error:", error);
    showAuthMessage(error.message, true);
    return;
  }

  if (!data.session) {
    showAuthMessage("Conta criada. Confirme o email antes de entrar.", false);
    return;
  }

  currentUser = data.user;
  showAuthMessage("Conta criada com sucesso.", false);
  // showLoggedInUI() is not called here — the onAuthStateChange listener
  // below already runs it for this same sign-up as part of Supabase's
  // internal subscriber notification, and a second, redundant call here
  // used to race a fast subsequent sign-out (see DESIGN-SYSTEM-001).
}

async function signIn() {
  const email = getAuthEmail();
  const password = getAuthPassword();

  if (!email || !password) {
    showAuthMessage("Email e password são obrigatórios.", true);
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Sign in error:", error);
    showAuthMessage("Email ou password inválidos.", true);
    return;
  }

  currentUser = data.user;
  showAuthMessage("Login efetuado com sucesso.", false);
  // showLoggedInUI() is not called here — see the comment in signUp() above.
}

async function signOut() {
  signingOut = true;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    alert("Erro ao sair: " + error.message);
    signingOut = false;
    return;
  }

  currentUser = null;
  showLoggedOutUI();
  signingOut = false;
}

async function resetPassword() {
  const email = getAuthEmail();

  if (!email) {
    showAuthMessage("Introduza o email para recuperar a password.", true);
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "https://santos-gustavo.github.io/reset-password.html",
  });

  if (error) {
    alert("Erro ao enviar email: " + error.message);
    return;
  }

  alert("Email de recuperação enviado.");
}

function getAuthEmail() {
  return document.getElementById("authEmail")?.value.trim() || "";
}

function getAuthPassword() {
  return document.getElementById("authPassword")?.value || "";
}

function showAuthMessage(message, isError = false) {
  const el = document.getElementById("authMessage");
  if (!el) return;

  el.textContent = message || "";
  el.style.color = isError ? "var(--rust)" : "var(--forest)";
}

async function showLoggedInUI() {
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");

  if (authScreen) authScreen.style.display = "none";
  if (appShell) appShell.style.display = "flex";

  renderUserInfo();

  // One primary company per user (COMPANY-PROFILE-001) — loaded once here so
  // it's ready before the user ever touches project creation.
  try {
    await loadPrimaryCompanyIntoState();
  } catch (error) {
    console.error("Error loading company profile:", error);
  }

  // Temporary bridge until project list is migrated to ESM.
  await renderProjectList();
}

function showLoggedOutUI() {
  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");

  if (authScreen) authScreen.style.display = "flex";
  if (appShell) appShell.style.display = "none";

  const userInfo = document.getElementById("userInfo");
  if (userInfo) userInfo.remove();
}

function renderUserInfo() {
  let el = document.getElementById("userInfo");

  if (!el) {
    el = document.createElement("div");
    el.id = "userInfo";
    el.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 9999;
      background: var(--card);
      border: 1px solid var(--paper-line);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      font-family: 'IBM Plex Sans', sans-serif;
      color: var(--ink);
      box-shadow: 0 4px 12px rgba(22,38,58,0.08);
    `;
    document.body.appendChild(el);
  }

  el.innerHTML = `
    <span>${currentUser?.email || ""}</span>
    <button type="button" data-auth-action="sign-out" style="margin-left:8px;">Sair</button>
  `;
}