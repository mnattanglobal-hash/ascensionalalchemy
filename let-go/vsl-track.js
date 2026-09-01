/* VSLT — retenção do vídeo de vendas. Envia progresso para o painel ROI.
   sendBeacon com text/plain: requisição simples, sem preflight CORS. */
(function () {
  var EP = "https://alquimia.imanto.com.br/api/vsl/event";
  var PAGE = location.pathname.replace(/\/+$/, "/") || "/";
  var K = "vslt_sid";
  var sid = sessionStorage.getItem(K);
  if (!sid) {
    sid = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(K, sid);
  }
  var mob = /Mobi|Android/i.test(navigator.userAgent) ? 1 : 0;
  var maxT = 0, dur = 0, lastSent = -1, played = 0;

  function send(ev, extra) {
    var p = { sid: sid, page: PAGE, ev: ev, t: Math.round(maxT * 10) / 10, d: Math.round(dur * 10) / 10, m: mob };
    if (extra) for (var k in extra) p[k] = extra[k];
    var body = JSON.stringify(p);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(EP, new Blob([body], { type: "text/plain" }));
      } else {
        fetch(EP, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } });
      }
    } catch (e) { /* nunca quebrar a página por causa de métrica */ }
  }

  function attach(v) {
    if (v.__vslt) return;
    v.__vslt = 1;
    dur = v.duration || 0;
    v.addEventListener("loadedmetadata", function () { dur = v.duration || dur; });
    v.addEventListener("play", function () {
      if (!played) { played = 1; send("play"); }
    });
    v.addEventListener("timeupdate", function () {
      if (v.currentTime > maxT) maxT = v.currentTime;
      /* um tick a cada 10s de vídeo alcançado */
      var bucket = Math.floor(maxT / 10);
      if (bucket > lastSent) { lastSent = bucket; send("tick"); }
    });
    v.addEventListener("ended", function () { maxT = dur || maxT; send("done"); });
  }

  function findVideo() {
    var v = document.querySelector("video");
    if (v) { attach(v); return true; }
    return false;
  }

  if (!findVideo()) {
    var tries = 0;
    var iv = setInterval(function () {
      if (findVideo() || ++tries > 40) clearInterval(iv);
    }, 250);
  }

  send("view");
  addEventListener("pagehide", function () { send("bye"); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") send("bye");
  });

  /* clique em qualquer link pro checkout conta como clique no CTA */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href*='pay.hotmart.com']") : null;
    if (a) send("cta_click");
  }, true);

  window.VSLT = { send: send };
})();
