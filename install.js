/* install.js — منطق زرار «تنزيل أيقونة البرنامج على الجهاز» (تثبيت PWA).
 *
 * السلوك المطلوب (build 98):
 *  - الزرار يظهر دايمًا في شاشة الدخول في وضع المتصفح — حتى لو المتصفح فاكر
 *    إن التطبيق مثبّت — عشان المستخدم لو مسح الأيقونة يقدر يرجّعها بضغطة.
 *  - لما المستخدم يدوس: نستخدم نافذة التثبيت الأصلية للمتصفح لو متاحة (beforeinstallprompt).
 *    التثبيت من نفس الأصل بيستبدل النسخة القديمة بالحديثة تلقائيًا وبدون فقدان بيانات.
 *    لو مش متاحة (متصفح مش داعم)، نعرض إرشاد بالعربي يركّب الاختصار من قائمة المتصفح.
 *  - الزرار بيختفي فقط لو التطبيق شغال من الاختصار نفسه (وضع standalone).
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

  // التقاط نافذة التثبيت الأصلية لو المتصفح وفّرها
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBtn();
  });

  // بعد نجاح التثبيت: الزرار يتحول لرسالة طمأنة
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    const b = btn();
    if (b) b.hidden = true;
    showHint("✅ تم تثبيت البرنامج — افتحه من أيقونة ميزان، وأي نسخة أحدث بتنزل تلقائيًا عند التشغيل.");
  });

  function onClick() {
    // فاتح من الاختصار نفسه → التحديث تلقائي، مفيش حاجة تتعمل
    if (isStandalone()) {
      showHint("أنت الآن تفتح ميزان من الأيقونة المثبتة بالفعل — والنسخة المعروضة هي دائمًا الأحدث.");
      return;
    }

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

    // الزرار دايمًا ظاهر في وضع المتصفح — حتى لو المتصفح فاكر إن التطبيق
    // لسه مثبّت، لأن المستخدم ممكن يمسح الأيقونة ويريد يرجّعها (تثبيت
    // من نفس الأصل بيحدّث/يستبدل النسخة القديمة تلقائيًا بنفس البيانات).
    // مخفي بس في حالتين: فاتح من الاختصار نفسه (standalone).
    if (isStandalone()) { hideBtn(); return; }
    showBtn();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
