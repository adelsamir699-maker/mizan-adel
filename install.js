/* install.js — منطق زرار «تنزيل أيقونة البرنامج على الجهاز» (تثبيت PWA).
 *
 * الفكرة: المتصفح بيطلق حدث beforeinstallprompt مرة واحدة لما التطبيق
 * يبقى "قابل للتثبيت" (manifest + service worker شغالين ومش متثبت لسه).
 * - لما الحدث ييجي → نُظهر الزرار.
 * - لما المستخدم يثبّت (appinstalled) أو يفتح التطبيق من الاختصار (standalone) → نخفي الزرار.
 * - لو التطبيق متثبت بالفعل، المتصفح مش بيطلق الحدث أصلًا → الزرار يفضل مخفي،
 *   وأي ضغط عليه بيتجاهل تمامًا. ولما المستخدم يمسح الاختصار من الديسكتوب،
 *   التطبيق يبقى تاني قابل للتثبيت → الحدث يرجع يظهر → الزرار يظهر من جديد.
 * ده بيحقّق شرط «يتجاهل الضغط لحد ما يمسحها من الديسكتوب» من غير أي علم مخزّن في الكاش.
 */
(function () {
  "use strict";

  let deferredPrompt = null;

  function btn() { return document.getElementById("btnInstallApp"); }

  function isStandalone() {
    try {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  function showBtn() {
    const b = btn();
    if (b && !isStandalone()) b.hidden = false;
  }

  function hideBtn() {
    const b = btn();
    if (b) b.hidden = true;
  }

  // التقاط قابلية التثبيت (بييجي بس لما التطبيق مش متثبت لسه)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBtn();
  });

  // بعد نجاح التثبيت إخفي الزرار
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBtn();
  });

  // لو فاتحين التطبيق من الاختصار نفسه (نافذة مستقلة) إخفي الزرار
  if (isStandalone()) hideBtn();

  function onClick() {
    // مش قابل للتثبيت (متثبت بالفعل أو المتصفح مش داعم) → تجاهل الضغط تمامًا
    if (!deferredPrompt) { hideBtn(); return; }
    try {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice) => {
        if (choice && choice.outcome === "accepted") hideBtn();
        deferredPrompt = null;
      }).catch(() => { deferredPrompt = null; });
    } catch (e) {
      deferredPrompt = null;
    }
  }

  function init() {
    const b = btn();
    if (b) b.addEventListener("click", onClick);

    // تسجيل الـ Service Worker (شرط لازم للتثبيت)
    if ("serviceWorker" in navigator) {
      const secure = location.protocol === "https:" ||
                     location.hostname === "localhost" ||
                     location.hostname === "127.0.0.1";
      if (secure) {
        navigator.serviceWorker.register("sw.js").catch((e) => {
          console.warn("SW register failed:", e && e.message);
        });
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
