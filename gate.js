/* Telegram kanal obunasi darvozasi — SAT with Shirinabonu
   Sayt faqat @ShirinabonuBorixodjayeva kanaliga obuna bo'lganlarga ochiladi.
   Obunadan chiqilsa, keyingi tekshiruvda (har 5 daqiqada va sahifaga qaytganda) sayt yana yopiladi. */
(function () {
  var KEY = "sws_tg_auth";
  var state = { bot: null, channelUrl: "https://t.me/ShirinabonuBorixodjayeva", checking: false };
  var overlay, body;

  var LKEY = "sws_tg_link";
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function loadLink() { try { return localStorage.getItem(LKEY); } catch (e) { return null; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); localStorage.removeItem(LKEY); } catch (e) {} }
  // Bot yuborgan shaxsiy havola: ?tg=... — saqlab qo'yamiz va manzildan olib tashlaymiz
  try {
    var qs = new URLSearchParams(location.search); var tgp = qs.get("tg");
    if (tgp) { localStorage.setItem(LKEY, tgp); qs.delete("tg"); var q = qs.toString(); history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash); }
  } catch (e) {}
  function botUrl() { return "https://t.me/" + state.bot + "?start=site"; }

  var css = "" +
    "#sws-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;" +
    "background:radial-gradient(1200px 600px at 20% 0%,#EFE6FA 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#FFF1D6 0%,transparent 55%),#F6F7FC;" +
    "font-family:'Nunito Sans','Segoe UI','Helvetica Neue',Arial,sans-serif;color:#16204D;animation:swsGateIn .5s cubic-bezier(.22,1,.36,1) both}" +
    "@keyframes swsGateIn{from{opacity:0}to{opacity:1}}" +
    "@keyframes swsGateUp{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}" +
    "@keyframes swsGateSpin{to{transform:rotate(360deg)}}" +
    "#sws-gate .card{width:440px;max-width:100%;background:rgba(255,255,255,.86);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:28px;padding:34px 30px 28px;text-align:center;" +
    "box-shadow:0 1px 2px rgba(22,32,77,.05),0 40px 80px -36px rgba(22,32,77,.35);animation:swsGateUp .7s cubic-bezier(.22,1,.36,1) .05s both}" +
    "#sws-gate .logo{width:64px;height:64px;border-radius:20px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6B3FA0,#C2185B);color:#fff;font-weight:800;font-size:26px}" +
    "#sws-gate h1{font-size:23px;line-height:1.25;margin:0 0 8px;font-weight:800}" +
    "#sws-gate p{font-size:15px;line-height:1.6;color:#5B618C;margin:0 0 20px}" +
    "#sws-gate .steps{text-align:left;background:#F5F6FA;border-radius:16px;padding:14px 16px;margin:0 0 20px;font-size:14.5px;line-height:1.55}" +
    "#sws-gate .steps div{display:flex;gap:10px;align-items:flex-start;margin:6px 0}" +
    "#sws-gate .num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#6B3FA0;color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}" +
    "#sws-gate .num.done{background:#1C9A5B}" +
    "#sws-gate .btn{display:flex;width:100%;align-items:center;justify-content:center;gap:10px;border:none;border-radius:14px;padding:14px 18px;font-size:16px;font-weight:800;cursor:pointer;text-decoration:none;font-family:inherit;transition:transform .12s,filter .15s}" +
    "#sws-gate .btn:hover{filter:brightness(1.06)}#sws-gate .btn:active{transform:scale(.97)}" +
    "#sws-gate .tg{background:#229ED9;color:#fff;margin-bottom:10px}" +
    "#sws-gate .ghost{background:#fff;color:#16204D;border:1.5px solid #E4E7F5}" +
    "#sws-gate .msg{font-size:13.5px;margin-top:12px;min-height:18px;color:#5B618C}" +
    "#sws-gate .msg.err{color:#C8102E}" +
    "#sws-gate .spin{width:26px;height:26px;border-radius:50%;border:3px solid #E4E7F5;border-top-color:#6B3FA0;animation:swsGateSpin .8s linear infinite;margin:10px auto}" +
    "#sws-gate .widget{display:flex;justify-content:center;min-height:44px;margin-bottom:6px}" +
    "#sws-gate .who{font-size:13px;color:#5B618C;margin-top:14px}#sws-gate .who a{color:#6B3FA0;cursor:pointer;text-decoration:underline}";

  var TG_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M9.8 15.3l-.4 5.4c.6 0 .8-.2 1.1-.5l2.6-2.5 5.4 4c1 .5 1.7.3 2-.9l3.6-17c.3-1.5-.5-2.1-1.5-1.7L1.3 9.8c-1.4.6-1.4 1.4-.2 1.8l5.4 1.7L19 5.4c.6-.4 1.1-.2.7.2z"/></svg>';

  function ensureOverlay() {
    if (overlay) return;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    overlay = document.createElement("div"); overlay.id = "sws-gate";
    overlay.innerHTML = '<div class="card"><div class="logo">S</div><div id="sws-gate-body"></div></div>';
    document.body.appendChild(overlay);
    body = document.getElementById("sws-gate-body");
    document.documentElement.style.overflow = "hidden";
  }
  function hideOverlay() {
    if (!overlay) return;
    overlay.remove(); overlay = null; body = null;
    document.documentElement.style.overflow = "";
  }
  function setMsg(t, err) { var m = document.getElementById("sws-gate-msg"); if (m) { m.textContent = t || ""; m.className = "msg" + (err ? " err" : ""); } }

  function renderLoading() {
    ensureOverlay();
    body.innerHTML = '<h1>SAT with Shirinabonu</h1><p>Obuna tekshirilmoqda…</p><div class="spin"></div>';
  }

  function renderLogin() {
    ensureOverlay();
    body.innerHTML =
      '<h1>Saytdan foydalanish uchun Telegram kanalimizga obuna bo\'ling</h1>' +
      '<p>Platforma <b>@ShirinabonuBorixodjayeva</b> kanali obunachilari uchun bepul.</p>' +
      '<div class="steps"><div><span class="num">1</span><span>Kanalga obuna bo\'ling</span></div>' +
      '<div><span class="num">2</span><span>Botimizda <b>Start</b> ni bosing — u obunani tekshirib, saytga kirish tugmasini yuboradi</span></div></div>' +
      '<a class="btn tg" href="' + state.channelUrl + '" target="_blank" rel="noopener">' + TG_ICON + ' 1. Kanalga obuna bo\'lish</a>' +
      '<a class="btn tg" style="background:#16204D" href="' + botUrl() + '" target="_blank" rel="noopener">' + TG_ICON + ' 2. Telegram orqali kirish</a>' +
      '<div style="font-size:12.5px;color:#8A90B0;margin:10px 0 8px">yoki kompyuterda:</div>' +
      '<div class="widget" id="sws-gate-widget"></div>' +
      '<div class="msg" id="sws-gate-msg"></div>';
    var s = document.createElement("script");
    s.async = true; s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", state.bot);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "14");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-onauth", "swsGateOnAuth(user)");
    document.getElementById("sws-gate-widget").appendChild(s);
  }

  function renderNotMember(auth) {
    ensureOverlay();
    var name = auth && (auth.first_name || auth.username) ? (auth.first_name || "@" + auth.username) : "";
    body.innerHTML =
      '<h1>Kanalga obuna bo\'lmagansiz</h1>' +
      '<p>Saytdan foydalanish uchun <b>@ShirinabonuBorixodjayeva</b> kanaliga obuna bo\'ling. Obuna bo\'lib qaytsangiz, sayt o\'zi ochiladi.</p>' +
      '<a class="btn tg" id="sws-gate-join" href="' + state.channelUrl + '" target="_blank" rel="noopener">' + TG_ICON + ' Kanalga obuna bo\'lish</a>' +
      '<a class="btn tg" style="background:#16204D" href="' + botUrl() + '" target="_blank" rel="noopener">' + TG_ICON + ' Obuna bo\'ldim — botdan kirish</a>' +
      '<button class="btn ghost" id="sws-gate-recheck">Qayta tekshirish</button>' +
      '<div class="msg" id="sws-gate-msg"></div>' +
      (name ? '<div class="who">' + escapeHtml(name) + ' sifatida kirdingiz · <a id="sws-gate-out">boshqa akkaunt</a></div>' : "");
    document.getElementById("sws-gate-recheck").onclick = function () { verify(true); };
    var out = document.getElementById("sws-gate-out"); if (out) out.onclick = function () { clear(); renderLogin(); };
  }

  function escapeHtml(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  window.swsGateOnAuth = function (user) { save(user); verify(true); };

  function verify(showSpinner) {
    var auth = load(); var link = loadLink();
    if (!auth && !link) { renderLogin(); return; }
    if (state.checking) return;
    state.checking = true;
    if (showSpinner && overlay) setMsg("Tekshirilmoqda…");
    fetch("/api/tg-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(link ? { link: link } : { auth: auth }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        state.checking = false;
        if (!d.configured) { hideOverlay(); return; }
        if (d.channelUrl) state.channelUrl = d.channelUrl;
        if (d.ok) { hideOverlay(); return; }
        if (d.reason === "bad_auth") { clear(); renderLogin(); setMsg("Qaytadan Telegram orqali kiring.", true); return; }
        if (d.reason === "check_failed") { ensureOverlay(); if (!document.getElementById("sws-gate-recheck")) renderNotMember(auth); setMsg("Tekshirib bo'lmadi (" + (d.detail || "xato") + "). Birozdan keyin qayta urinib ko'ring.", true); return; }
        renderNotMember(auth);
        if (showSpinner) setMsg("Hali obuna ko'rinmayapti. Obuna bo'lgach, qayta tekshiring.", true);
      })
      .catch(function () { state.checking = false; if (overlay) setMsg("Internet bilan muammo. Qayta urinib ko'ring.", true); });
  }

  function start() {
    renderLoading();
    fetch("/api/tg-check", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { configured: false }; })
      .then(function (d) {
        if (!d.configured || !d.bot) { hideOverlay(); return; }
        state.bot = d.bot; if (d.channelUrl) state.channelUrl = d.channelUrl;
        verify(false);
        setInterval(function () { verify(false); }, 5 * 60 * 1000);
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") verify(!!overlay); });
      })
      .catch(function () { hideOverlay(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
