// Мост к возможностям телефона. В браузере всё это молча отключается.
(function () {
  const C = window.Capacitor;
  const NATIVE = !!(C && C.isNativePlatform && C.isNativePlatform());
  const P = (C && C.Plugins) || {};
  const N = (window.NATIVE = {
    on: NATIVE,
    platform: NATIVE ? C.getPlatform() : "web",

    // Камера: фото холодильника или чека
    async photo() {
      if (!NATIVE || !P.Camera) return null;
      const r = await P.Camera.getPhoto({ quality: 70, width: 1600, resultType: "dataUrl", source: "PROMPT", promptLabelHeader: "Фото", promptLabelPhoto: "Из галереи", promptLabelPicture: "Сфотографировать" });
      return await (await fetch(r.dataUrl)).blob();
    },

    // Лёгкая вибрация при отметке «съел»
    tap() { try { NATIVE && P.Haptics && P.Haptics.impact({ style: "LIGHT" }); } catch (e) {} },

    // Системное «Поделиться»
    async share(text) {
      if (!NATIVE || !P.Share) return false;
      try { await P.Share.share({ title: "Покупки", text }); return true; } catch (e) { return true; }
    },

    // Экран не гаснет во время готовки
    awake(on) { try { if (NATIVE && P.KeepAwake) on ? P.KeepAwake.keepAwake() : P.KeepAwake.allowSleep(); } catch (e) {} },

    // Напоминания о сроках годности: вечером накануне
    _t: null,
    scheduleExpiry(items) {
      if (!NATIVE || !P.LocalNotifications) return;
      clearTimeout(N._t);
      N._t = setTimeout(async () => {
        try {
          const LN = P.LocalNotifications;
          let perm = await LN.checkPermissions();
          if (perm.display === "prompt" || perm.display === "prompt-with-rationale") perm = await LN.requestPermissions();
          if (perm.display !== "granted") return;
          const pend = await LN.getPending();
          if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
          const now = Date.now();
          const list = items
            .map(it => { const d = new Date(it.at); d.setHours(18, 0, 0, 0); return { ...it, when: d }; })
            .filter(it => it.when.getTime() > now + 60000)
            .slice(0, 30)
            .map((it, ix) => ({ id: 1000 + ix, title: "⏳ Пора использовать: " + it.name.toLowerCase(), body: "Откройте приложение: подскажу, что из этого приготовить.", schedule: { at: it.when, allowWhileIdle: true } }));
          if (list.length) await LN.schedule({ notifications: list });
        } catch (e) {}
      }, 1500);
    },

    // Кнопка «назад» на Android
    onBack(fn) { try { NATIVE && P.App && P.App.addListener("backButton", fn); } catch (e) {} },
  });

  // Веб-версия: кэш для работы без интернета и установки на экран
  if (!NATIVE && "serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // iPhone: подсказка «Установить на экран Домой» (только в Safari и пока не установлено)
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  let hidden = false; try { hidden = localStorage.getItem("ichto2:iosHint") === "no"; } catch (e) {}
  N.installHint = !NATIVE && isIOS && !standalone && !hidden;
  if (N.installHint) {
    window.addEventListener("load", () => {
      const st = document.createElement("style");
      st.textContent = `.ios-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:20;width:min(488px,calc(100% - 24px));background:var(--ink);color:var(--app);border-radius:16px;padding:14px 44px 14px 16px;font-size:14px;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.ios-hint b{display:block;font-size:15px;margin-bottom:2px}.ios-hint .sh{display:inline-block;vertical-align:-3px;width:16px;height:18px}
.ios-hint button{position:absolute;top:8px;right:8px;border:0;background:transparent;color:inherit;font-size:20px;width:32px;height:32px;line-height:1}`;
      document.head.appendChild(st);
      const d = document.createElement("div");
      d.className = "ios-hint"; d.setAttribute("role", "note");
      d.innerHTML = '<b>Установите как приложение</b>Нажмите <svg class="sh" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V1M4.5 4.5 8 1l3.5 3.5M3 7.5H2v9h12v-9h-1"/></svg> «Поделиться» внизу Safari, затем «На экран Домой». Иконка появится рядом с другими приложениями.<button aria-label="Скрыть">×</button>';
      d.querySelector("button").onclick = () => { d.remove(); try { localStorage.setItem("ichto2:iosHint", "no"); } catch (e) {} };
      document.body.appendChild(d);
    });
  }
})();
