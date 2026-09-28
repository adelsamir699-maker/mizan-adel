/* install.js — منطق زرار «تنزيل أيقونة البرنامج على الجهاز» (تثبيت PWA).
 *
 * السلوك المطلوب (build 100):
 *  - الزرار يظهر دايمًا في شاشة الدخول في كل الحالات — متصفح/standalone، كمبيوتر وموبايل —
 *    حتى لو المتصفح فاكر إن التطبيق مثبّت، عشان المستخدم لو مسح الأيقونة يقدر يرجّعها بضغطة.
 *  - لما المستخدم يدوس: نستخدم نافذة التثبيت الأصلية للمتصفح لو متاحة (beforeinstallprompt).
 *    التثبيت من نفس الأصل بيستبدل النسخة القديمة بالحديثة تلقائيًا وبدون فقدان بيانات.
 *    لو مش متاحة (متصفح مش داعم)، نعرض إرشاد بالعربي يركّب الاختصار من قائمة المتصفح.
 *    ولو شغال من الاختصار (standalone) → رسالة طمأنة إن دي دائمًا الأحدث.
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
    if (b) b.hidden = false; // الزرار ظاهر دايمًا في كل الحالات (متصفح/standalone/كمبيوتر/موبايل)
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

  // إرشاد مركّب حسب نوع الجهاز وطريقة الفتح عشان يكون واضح للمستخدم
  function platformHint() {
    // فاتح من الملف مباشرة (file://) → المتصفح بيمنع التثبيت هناك
    if (location.protocol === "file:") {
      return "عايز تثبّت اختصار البرنامج بأيقونته؟ افتح البرنامج من السيرفر المحلي (دبل كليك على «تشغيل ميزان.bat») أو من الرابط الرسمي على الإنترنت، وبعدين دوس زرار التنزيل تاني — المتصفح مبيدعمش التثبيت من الملف مباشرة.";
    }
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

  // علامة ?reinstall=1: جاي من نافذة الأيقونة عايز يثبّت من المتصفح العادي
  function wantsReinstall() {
    try { return location.search.indexOf("reinstall=1") !== -1; } catch (e) { return false; }
  }

  // التقاط نافذة التثبيت الأصلية لو المتصفح وفّرها
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBtn();
    // جاي بعلامة إعادة التثبيت → نجرب فتح النافذة فورًا (لو المتصفح سمح)
    if (wantsReinstall()) {
      try {
        e.prompt();
        e.userChoice.then(() => { deferredPrompt = null; }).catch(() => { deferredPrompt = null; });
      } catch (err) { /* لو محتاج ضغطة يدوية، الزرار ظاهر فوق */ }
    }
  });

  // بعد نجاح التثبيت: الزرار يفضل ظاهر + رسالة طمأنة
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    showBtn();
    showHint("✅ تم تثبيت البرنامج — افتحه من أيقونة ميزان، وأي نسخة أحدث بتنزل تلقائيًا عند التشغيل.");
  });

  function onClick() {
    // لو نافذة التثبيت الأصلية جاهزة → استخدمها على طول (حتى من جوه الأيقونة)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          deferredPrompt = null;
          if (choice && choice.outcome === "accepted") {
            showHint("✅ تم تثبيت البرنامج — افتحه من أيقونة ميزان، والنسخة الأحدث تنزل تلقائيًا عند كل تشغيل.");
          }
        }).catch(() => { deferredPrompt = null; });
        return;
      } catch (e) { deferredPrompt = null; }
    }

    // فاتح من الأيقونة نفسها (standalone) → المتصفح مبيقدرش يفتح نافذة تثبيت من هنا،
    // فنفتح الصفحة في متصفح عادي بعلامة ?reinstall=1 ويكمل التثبيت من هناك.
    if (isStandalone()) {
      showHint("أنت بتفتح ميزان من الأيقونة نفسها — فتحنا لك الصفحة في متصفح عادي في نافذة جديدة، دوس زرار «⬇️ تنزيل أيقونة البرنامج» هناك واختار تثبيت. النسخة الجديدة هتستبدل القديمة بنفس بياناتك. (لو النافذة ما فتحتش: انسخ الرابط وافتحه في كروم عادي)");
      try {
        window.open(location.origin + location.pathname + "?reinstall=1", "_blank");
      } catch (e) { /* تجاهل */ }
      return;
    }

    // مفيش نافذة أصلية جاهزة دلوقتي: لو المتصفح فاكر إن التطبيق لسه مثبّت
    // (حتى بعد مسح الأيقونة) نوجّه المستخدم لإرجاعها من قائمة المتصفح.
    isInstalled().then((installed) => {
      if (installed) {
        showHint("البرنامج مثبّت فعلًا على جهازك في سجل المتصفح. لو مسحت الأيقونة وعايز ترجّعها: افتح قائمة المتصفح (⋮) واختار «تثبيت التطبيق / Install app» — هترجع الأيقونة بنفس بياناتك، والنسخة القديمة تتحدث تلقائيًا للأحدث.");
      } else {
        // إرشاد بالعربي مركّب حسب نوع الجهاز
        showHint(platformHint());
      }
    });
  }

  function init() {
    const b = btn();
    if (b) b.addEventListener("click", onClick);

    // سجّل الـ Service Worker (شرط لازم للتثبيت) — بيشتغل بس على https أو localhost
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

    // الزرار دايمًا ظاهر في كل الحالات (build 100): في وضع المتصفح بيثبّت/يحدّث
    // الأيقونة (حتى لو المتصفح فاكر التطبيق مثبّت — المستخدم ممكن يكون مسحها)،
    // وفي وضع standalone بيطمّن المستخدم إن النسخة دي هي الأحدث.
    showBtn();

    // جاي بعلامة ?reinstall=1 → إرشاد ودّي لو نافذة التثبيت ماظهرتش لوحدها
    if (wantsReinstall() && !isStandalone()) {
      showHint("دوس زرار «⬇️ تنزيل أيقونة البرنامج» فوق واختار «تثبيت» من النافذة اللي هتظهر — النسخة الجديدة هتستبدل القديمة بنفس بياناتك.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
