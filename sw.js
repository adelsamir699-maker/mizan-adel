/* sw.js — Service Worker بسيط جدًا، غرضه الوحيد تمكين تثبيت التطبيق (PWA).
 *
 * مهم جدًا: مفيش أي كاش للبيانات هنا.
 * كل الطلبات بتتمرّر للشبكة، و**الشاشة (index.html / التنقّل) بتخرج بـ cache:"no-store"**
 * من build 147 — والسبب مقاس، مش نظرية:
 *   رِس GitHub Pages بيخدم `Cache-Control: max-age=600` (متقاس لايف 08/10 على
 *   index.html وapp.js وsw.js وmanifest.webmanifest)، والـ `<meta http-equiv>` في
 *   index.html **ما بيقهرش** الهيدر الحقيقي، و`fetch(event.request)` الافتراضي
 *   بيسمح بكاش الـ HTTP ⇒ الجهاز اللي عنده سو قديم كان بيفتح **من غير ولا طلب شبكة**
 *   (متقاس: صفر hits على السيرفر في تنقّلات متكررة) ويفضل شايف شاشة النشر القديم.
 *   `cache:"no-store"` على الشاشة بيمنع ده، وباقي الطلبات (skripts/صور) زي ما هي
 *   عشان مانشيلش أي سلوك تاني.
 *
 * مفيش هنا كاش للعنصر ده ولا لتخزين بيانات مستخدم — مافيش `caches` مستخدمة خالص،
 * و`activate` لسه بيمسح أي كاش قديم موجود (احتياطي).
 *
 * لو حصلت أي مشكلة في الـ fetch بنرجّع الخطأ زي ما هو (من غير intercept صامت).
 */
"use strict";

const SW_VERSION = 147;

self.addEventListener("install", (event) => {
  // من غير انتظار: فعّل النسخة الجديدة فورًا
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // امسح أي كاش قديم لو موجود (احتياطي) وخذ التحكم في كل التابات
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) { /* تجاهل */ }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // الشاشة = من غير لمس كاش الـ HTTP (الإصلاح المقاس في build 147)؛
  // باقي الطلبات بتتمرّر زي ما هي.
  // ده بيحقّق شرط "service worker له fetch handler" المطلوب للتثبيت.
  const req = event.request;
  const shell = req.mode === "navigate" || /\/index\.html(\?|$)/.test(req.url) || /\/$/.test(new URL(req.url).pathname);
  event.respondWith(shell ? fetch(req, { cache: "no-store" }) : fetch(req));
});
