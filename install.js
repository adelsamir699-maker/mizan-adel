/* install.js — منطق زرار «تنزيل أيقونة البرنامج على الجهاز» (تثبيت PWA).
 *
 * السلوك المطلوب:
 *  - الزرار يظهر دايمًا في شاشة الدخول (مش مربوط بحدث معيّن) عشان المستخدم يشوفه.
 *  - لما المستخدم يدوس: نستخدم نافذة التثبيت الأصلية للمتصفح لو متاحة (beforeinstallprompt).
 *    لو مش متاحة (متصفح مش داعم)، نعرض إرشاد بالعربي يركّب الاختصار من قائمة المتصفح.
 *  - لو التطبيق مثبّت بالفعل → نخفي الزرار ونتجاهل أي ضغط.
 *    وكشف التثبيت بيعمل بطريقتين:
 *      1) navigator.getInstalledRelatedApps() → بيرجع التطبيق المثبّت من نفس الأصل
 *         (فلو المستخدم مسح الاختصار من الديسكتوب، القائمة تفضى والزرار يرجع يظهر).
 *      2) وضع standalone (فاتح التطبيق من الاختصار نفسه) → مخفي.
 *      3) حدث appinstalled لحظة التثبيت → مخفي.
 * ده بيحقّق شرط «يتجاهل الضغط لحد ما يمسحها من الديسكتوب» من غير أي علم مخزّن في الكاش.
 */
(function () {
  "use strict";

  let deferredPrompt = null;

  function btn() { return document.getElementById("btnInstallApp"); }
  function hint() { return document.getElementById("installHint"); }

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
    const h = hint();
    if (h) h.hidden = true;
  }

  function showHint(text) {
    const h = hint();
    if (!h) return;
    h.textContent = text;
    h.hidden = false;
  }

  // إرشاد مركّب حسب نوع الجهاز عشان يكون واضح للمستخدم
  function platformHint() {
    const ua = (navigator.userAgent || "") + " " + (navigator.platform || "");
    const isIOS = /iphone|ipod/i.test(ua) || (/ipad/i.test(ua)) ||
                  (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    if (isIOS) {
      return "على الآيفون/الآيباد: دوس زرار المشاركة (⬆ Share) في سفاري، واختار «إضافة إلى الشاشة الرئيسية / Add to Home Screen» — وهتلاقي أيقونة ميزان على شاشة الموبايل تفتح البرنامج بملء الشاشة.";
    }
    if (isAndroid) {
      return "على أندرويد: افتح قائمة المتصفح (⋮) واختار «تثبيت التطبيق / Install app» أو «إضافة إلى الشاشة الرئيسية» — وهتلاقي أيقونة ميزان على شاشة الموبايل.";
    }
    return "متصفحك مبيفتحش نافذة تثبيت تلقائية. افتح قائمة المتصفح (علامة ⋮ أو ... فوق) واختار: «تثبيت ميزان…» أو «Install ميزان / Install app» — وهيتم عمل اختصار بأيقونة البرنامج على سطح المكتب.";
  }

  // هل التطبيق مثبّت بالفعل من نفس الأصل؟ (Chrome/Edge)
  function isInstalled() {
    return new Promise((resolve) => {
      try {
        if (navigator.getInstalledRelatedApps) {
          navigator.getInstalledRelatedApps().then((list) => {
            resolve(!!(list && list.length));
          }).catch(() => resolve(false));
          return;
        }
      } catch (e) { /* تجاهل */ }
      resolve(false);
    });
  }

  // التقاط نافذة التثبيت الأصلية لو المتصفح وفّرها
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

  function onClick() {
    // مثبّت بالفعل أو فاتح من الاختصار → تجاهل الضغط تمامًا
    if (isStandalone()) { hideBtn(); return; }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          if (choice && choice.outcome === "accepted") hideBtn();
          deferredPrompt = null;
        }).catch(() => { deferredPrompt = null; });
        return;
      } catch (e) { deferredPrompt = null; }
    }

    // مفيش نافذة أصلية → إرشاد بالعربي مركّب حسب نوع الجهاز
    showHint(platformHint());
  }

  function init() {
    const b = btn();
    if (b) b.addEventListener("click", onClick);

    // سجّل الـ Service Worker (شرط لازم للتثبيت)
    let swState = "مش مدعوم";
    if ("serviceWorker" in navigator) {
      const secure = location.protocol === "https:" ||
                     location.hostname === "localhost" ||
                     location.hostname === "127.0.0.1";
      if (secure) {
        navigator.serviceWorker.register("sw.js").then(() => { swState = "مسجّل"; diag(); })
          .catch((e) => { swState = "فشل: " + (e && e.message ? e.message : String(e)); diag(); });
      } else {
        swState = "محجوب (الاتصال مش آمن)";
      }
    }

    // تشخيص مؤقت: بيكتب حالة التثبيت في سطر مستقل (#installDiag)
    // عشان ميمسحوش سطر الإرشاد (#installHint) والعكس
    function diag() {
      const d = document.getElementById("installDiag");
      if (!d) return;
      const secure = location.protocol === "https:" ||
                     location.hostname === "localhost" ||
                     location.hostname === "127.0.0.1";
      fetch("manifest.webmanifest", { cache: "no-store" }).then((r) => {
        const manifestOk = r.ok ? "تمام" : ("فشل " + r.status);
        return r.ok ? r.json().then((m) => ({ manifestOk, m })) : { manifestOk, m: null };
      }).catch(() => ({ manifestOk: "فشل شبكة", m: null })).then((res) => {
        const icons = res.m && Array.isArray(res.m.icons) ? res.m.icons.length : 0;
        d.hidden = false;
        d.textContent = "تشخيص مؤقت — اتصال آمن: " + (secure ? "أيوه" : "لأ (" + location.origin + ")") +
          " | SW: " + swState +
          " | manifest: " + res.manifestOk +
          " | أيقونات: " + icons +
          " | نافذة تثبيت: " + (deferredPrompt ? "جاهزة" : "لسه مجتش");
      });
    }
    setTimeout(diag, 1200);

    // قرّر الإظهار/الإخفاء: مخفي بس لو مثبّت أو standalone، غير كده ظاهر
    if (isStandalone()) { hideBtn(); return; }
    isInstalled().then((installed) => {
      if (installed) hideBtn();
      else showBtn();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
