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
})();
