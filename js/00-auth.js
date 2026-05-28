// ── AUTH ────────────────────────────────────────────────────────────

let CURRENT_USER = null;

async function initAuth() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Auth session error:", error);
    showAuthMessage("Erro ao verificar sessão.", true);
    showLoggedOutUI();
    return;
  }

  CURRENT_USER = data.session?.user || null;

  if (CURRENT_USER) {
    await showLoggedInUI();
  } else {
    showLoggedOutUI();
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth event:", event);

    CURRENT_USER = session?.user || null;

    if (CURRENT_USER) {
      await showLoggedInUI();
    } else {
      showLoggedOutUI();
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
    password
  });

  if (error) {
    console.error("Sign up error:", error);
    showAuthMessage(error.message, true);
    return;
  }

  // If email confirmation is enabled, user may need to confirm email.
  if (!data.session) {
    showAuthMessage("Conta criada. Confirme o email antes de entrar.", false);
    return;
  }

  CURRENT_USER = data.user;
  showAuthMessage("Conta criada com sucesso.", false);
  await showLoggedInUI();
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
    password
  });

  if (error) {
    console.error("Sign in error:", error);
    showAuthMessage("Email ou password inválidos.", true);
    return;
  }

  CURRENT_USER = data.user;
  showAuthMessage("Login efetuado com sucesso.", false);
  await showLoggedInUI();
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
    alert("Erro ao sair: " + error.message);
    return;
  }

  CURRENT_USER = null;
  showLoggedOutUI();
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
  el.style.color = isError ? "#dc2626" : "#166534";
}

async function showLoggedInUI() {
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");

  if (authScreen) authScreen.style.display = "none";
  if (appScreen) appScreen.style.display = "block";

  renderUserInfo();

  if (typeof renderProjectList === "function") {
    await renderProjectList();
  }
}

function showLoggedOutUI() {
  const authScreen = document.getElementById("authScreen");
  const appScreen = document.getElementById("appScreen");

  if (authScreen) authScreen.style.display = "flex";
  if (appScreen) appScreen.style.display = "none";
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
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    `;
    document.body.appendChild(el);
  }

  el.innerHTML = `
    <span>${CURRENT_USER?.email || ""}</span>
    <button onclick="signOut()" style="margin-left:8px;">Sair</button>
  `;
}

// Expose functions because your app currently uses inline onclick handlers.
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.initAuth = initAuth;