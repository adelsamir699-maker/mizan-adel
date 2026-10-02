/* sw.js — Service Worker بسيط جدًا، غرضه الوحيد تمكين تثبيت التطبيق (PWA).
 *
 * مهم جدًا: مفيش أي كاش للبيانات هنا.
 * كل الطلبات بتتمرّر للشبكة مباشرة (network-only passthrough)،
 * عشان ميأثرش على سياسة "no-cache" الموجودة في index.html
 * ولا يخزّن أي بيانات مستخدم على الجهاز بشكل قديم.
 *
 * لو حصلت أي مشكلة في الـ fetch بنرجّع الخطأ زي ما هو (من غير intercept صامت).
 */
"use strict";

const SW_VERSION = 122;

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
  // network-only: مرّر الطلب للشبكة من غير كاش.
  // ده بيحقّق شرط "service worker له fetch handler" المطلوب للتثبيت،
  // ومن غير ما يغيّر سلوك التحميل/الكاش الحالي للتطبيق.
  event.respondWith(fetch(event.request));
});
