// The gate screen a user hits when navigating to a whitelisted, locked site.
//
// It has no idea what the browser was trying to load - the redirect already
// happened - so the target URL comes from the background service worker, which
// remembers it from webRequest.onBeforeRequest.

const params = new URLSearchParams(location.search);
const entryId = params.get("entry");

const els = {
  form: document.getElementById("gateForm"),
  password: document.getElementById("password"),
  submit: document.getElementById("submitBtn"),
  message: document.getElementById("message"),
  siteName: document.getElementById("siteName"),
  footer: document.getElementById("footer"),
};

const send = (message) => chrome.runtime.sendMessage(message);

let targetUrl = null;
let cooldownTimer = null;

function showError(text) {
  els.message.textContent = text;
  els.message.classList.remove("ok");
}

async function boot() {
  const context = await send({ type: "gate:context", entryId });
  targetUrl = context.targetUrl;

  if (!context.hasPassword) {
    els.siteName.textContent = "Unknown entry";
    showError("This whitelist entry no longer exists.");
    els.submit.disabled = true;
    return;
  }

  els.siteName.textContent = context.label || context.pattern;
  els.footer.textContent = context.alreadyUnlocked
    ? "Already unlocked - redirecting…"
    : `Unlocks ${context.pattern} for this browser session.`;

  if (context.alreadyUnlocked) {
    proceed();
    return;
  }
  if (context.cooldown > Date.now()) {
    applyCooldown(context.cooldown);
  }
  els.password.focus();
}

function applyCooldown(until) {
  const seconds = Math.ceil((until - Date.now()) / 1000);
  showError(`Too many wrong attempts. Retry in ${seconds}s.`);
  els.submit.disabled = true;
  els.password.disabled = true;
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    if (Date.now() >= until) {
      clearInterval(cooldownTimer);
      els.submit.disabled = false;
      els.password.disabled = false;
      showError("");
    } else {
      showError(`Too many wrong attempts. Retry in ${Math.ceil((until - Date.now()) / 1000)}s.`);
    }
  }, 500);
}

function proceed() {
  if (!targetUrl) {
    showError("Could not tell which page was requested. Open the site again.");
    return;
  }
  window.location.replace(targetUrl);
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.submit.disabled = true;
  showError("");

  const result = await send({ type: "gate:attempt", entryId, password: els.password.value });
  if (result?.ok) {
    els.message.textContent = `Unlocked for ${result.minutes} minutes. Redirecting…`;
    els.message.classList.add("ok");
    setTimeout(proceed, 350);
    return;
  }

  els.submit.disabled = false;
  els.password.select();
  showError(result?.error || "Unlock failed.");
});

document.addEventListener("DOMContentLoaded", boot);