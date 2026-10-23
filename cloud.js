// ============================================================
// ميزان - طبقة المزامنة مع قاعدة البيانات المركزية
// تحوّل بيانات البرنامج (الموجودة في الذاكرة) إلى/من جداول Supabase
// بمعرّفات ثابتة (deterministic) حتى لا تتكاثر السجلات
// ============================================================
(function () {
  "use strict";

  function hexHash(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  }
  function detUuid(table, localId) {
    var org = (DATA && DATA.orgId && DATA.orgId()) || "n";
    var a = (hexHash(org) >>> 0).toString(16).padStart(8, "0");
    var b = (hexHash(org + ":" + table) >>> 0).toString(16).padStart(8, "0");
    var c = (hexHash(org + ":" + table + ":" + localId) >>> 0).toString(16).padStart(8, "0");
    var tail = Number(localId).toString(16).padStart(12, "0").slice(-12);
    return a.slice(0, 8) + "-" + b.slice(0, 4) + "-4" + b.slice(4, 7) + "-" + c.slice(0, 4) + "-" + tail;
  }
  // 🆕 ترحيل ٣٤: استرجاع الرقم المحلي من الـ uuid.detUuid رقم حتمي آخر ١٢ خانة فيه = الرقم المحلي.
  //    لو السطر فقد local_id على السحابة (ده كان بيحصل من شاشة الضبط)، بنعيد الرقم من الـ id
  //    ourselves — بس بعد ما نتأكد إن الـ id فعلاً متولّد من نفس الرقم (مش uuid عشوائي).
  function localIdFromUuid(table, id) {
    if (!id || typeof id !== "string") return null;
    var parts = id.split("-");
    var tail = parts[parts.length - 1];
    if (!/^[0-9a-f]{12}$/.test(tail)) return null;
    var n = Number.parseInt(tail, 16);
    if (!Number.isFinite(n) || n <= 0 || n > 1000000) return null;      // الأرقام العشوائية بتبقى ضخمة
    return detUuid(table, n) === id.toLowerCase() ? n : null;     // إثبات إن الرقم ده مصدر الـ id
  }

  // تاريخ المستند: النص الفاضي بيكسر عمود date في السحابة (والدورة كلها بتفشل) → بلا تاريخ = null
  function docDate(r) {
    var d = r.invoiceDate || r.date || r.returnDate || r.docDate || "";
    d = String(d).trim();
    return d ? d.slice(0, 10) : null;
  }

  // 🔗 رقم الطرف (عميل/مورد/صنف/خزينة) بين الأجهزة: بيتخزن كنص = local_id بتاعه.
  //    من غير الرقم ده الجهاز التاني بيشوف الاسم بس → الفاتورة بتقطع صلة صاحبها،
  //    والمتاح للرجوع ووسم المرتجع وكشف حساب الفاتورة كلهم بيتعطلوا.
  function localIdStr(v) {
    if (v === null || v === undefined || v === "") return "";
    var n = Number(v);
    return Number.isNaN(n) ? String(v) : String(n);
  }
  function localIdNum(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  // 🧾 رقم سطر الصنف جوه الفاتورة: على السحابة بيخزن مركّب (رقم الأب × 1000 + ترتيب السطر)
  //    عشان ما يتعارضش مع فاتورة تانية. هنا نفكّه لرقم السطر الأصلي (1، 2، 3...).
  //    السطور القديمة اللي أرقامها صغيرة بتفضل زي ما هي.
  function decodeItemLocalId(v) {
    var lid = Number(v) || 0;
    if (!lid) return lid;
    return (lid % 1000) || lid;
  }

  // عمود الأب في كل جدول أصناف/أسطر
  var PARENT_OF = {
    sale_items: "sale_id", purchase_items: "purchase_id",
    sale_return_items: "return_id", purchase_return_items: "return_id",
    journal_lines: "entry_id"
  };

  // 🗂 السطور اللي الجهاز ده شافها فعلًا في آخر تنزيل (local_id -> uuid السحابي).
  // الحذف السحابي بيتم بس للسطور دي: جهاز ما يشوفش سطر قط لا يمسحه.
  function seenIds(name) {
    var m = (W.idMap && W.idMap[name]) || {};
    var s = {};
    Object.keys(m).forEach(function (k) { if (m[k]) s[m[k]] = 1; });
    return s;
  }
  function rememberIds(name, rows) {
    W.idMap = W.idMap || {};
    var m = W.idMap[name] || (W.idMap[name] = {});
    (rows || []).forEach(function (r) {
      if (r && r.id != null && r.local_id != null) m[Number(r.local_id)] = r.id;
    });
  }
  // 🛡 حد أقصى للحذف في عملية واحدة (حماية لو جهاز حاله ناقص)
  function capDeletes(what, count, haveCount) {
    var max = Math.max(5, Math.floor((haveCount || 0) * 0.25));
    if (count > max) {
      console.warn("sync guard: تجاوز حد الحذف الآمن", what, count, haveCount);
      return false;
    }
    return true;
  }
  // 🛡🛡 حارس «المسح الكامل»: جهاز حاله فاضي خالص والسحابة فيها أكتر من سطر = ده مش مستخدم
  //    مسح مستنداته، ده جهاز فقد بياناته (أو لسه ما نزّلش). في الحالة دي مابنمسحش حاجة،
  //    والسحابة هي اللي ترجّع البيانات للجهاز. الحذف العادي (سطر/سطرين من جدول فيه بيانات)
  //    بيتم عادي — ولو فضل سطر واحد على السحابة حذفه بيتزامن.
  function wipeGuard(what, localCount, haveCount) {
    if (Number(localCount) === 0 && Number(haveCount) > 1) {
      console.warn("sync guard: الجهاز فاضي والسحابة فيها " + haveCount + " سطر من " + what + " — الحذف موقوف");
      try { if (DATA.onWipeBlocked) DATA.onWipeBlocked(what, haveCount); } catch (e) { }
      return false;
    }
    return true;
  }
  // ⚠️ فشل المزامنة كان بيكتب في console بس → المستخدم ما يعرفش. دلوقتي يوصل لتنبيه ودّي.
  function syncFailed(what, err) {
    console.warn("sync", what, err && err.message ? err.message : err);
    try { if (DATA.onSyncError) DATA.onSyncError(what, err); } catch (e) { }
  }

  // 🆕 إصلاح «الوحدة فاضية في الفاتورة»: الوحدة كانت بتضيع لأن جدول products على السحابة
  // مالوش عمود unit، فـ fromCloud كانت بترجعلها "" ثابت → كل صنف بيفقد وحدته بعد أول
  // تنزيل، والفواتير الجديدة بتتسجّل بوحدة فاضية. الحلول:
  //   1) ترحيل ٣ٻ بيضيف العمود، و toCloud بيبعت unit بس لما HAS_PRODUCT_UNIT=true (فحص مرّة).
  //   2) لحد العمود يتنفّذ: fromCloud بياخد الوحدة من النسخة اللي في الذاكرة (localUnitOf)
  //      بدل ما يمسيحها — فاللي مسجّله المستخدم على الجهاز ده ما يضيعش.
  var PROBE_CACHE_KEY = "mizan_schema_probes_v1";
  var PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  function probeCacheState() {
    try {
      var c = JSON.parse(localStorage.getItem(PROBE_CACHE_KEY) || "null");
      if (!c || typeof c !== "object" || !c.flags || typeof c.flags !== "object") return { at: Date.now(), build: String(window.MIZAN_BUILD || ""), flags: {} };
      if (String(c.build || "") !== String(window.MIZAN_BUILD || "")) return { at: Date.now(), build: String(window.MIZAN_BUILD || ""), flags: {} };
      if (!c.at || (Date.now() - Number(c.at)) > PROBE_CACHE_TTL_MS) return { at: Date.now(), build: String(window.MIZAN_BUILD || ""), flags: {} };
      return c;
    } catch (e) { return { at: Date.now(), build: String(window.MIZAN_BUILD || ""), flags: {} }; }
  }
  function probeCacheHit(name) {
    return probeCacheState().flags[name] === true;
  }
  function probeCacheSet(name, ok) {
    var c = probeCacheState();
    if (ok) c.flags[name] = true; else delete c.flags[name];
    c.at = Date.now();
    c.build = String(window.MIZAN_BUILD || "");
    try { localStorage.setItem(PROBE_CACHE_KEY, JSON.stringify(c)); } catch (e) { }
  }

  var HAS_PRODUCT_UNIT = false;
  function localUnitOf(localId) {
    var list = (typeof W !== "undefined" && W.products) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(localId)) return list[i].unit || "";
    }
    return "";
  }
  // فحص وجود العمود على السحابة: select لنفس العمود → لو مرجّعش خطأ = موجود.
  // بينادي مرة واحدة قبل loadAll عشان أول رفع للأصناف في الجلسة يعرف يبعث unit ولا لأ.
  function probeProductUnit() {
    if (probeCacheHit("productUnit")) { HAS_PRODUCT_UNIT = true; return Promise.resolve(true); }
    return Promise.resolve().then(function () {
      return DATA.client().from("products").select("unit").limit(1);
    }).then(function (r) {
      HAS_PRODUCT_UNIT = !(r && r.error);
      return HAS_PRODUCT_UNIT;
    }).catch(function () { HAS_PRODUCT_UNIT = false; return false; })
      .then(function (ok) { probeCacheSet("productUnit", ok); return ok; });
  }

  /* 🆕 بناء 179: الخانتين «آخر سعر شراء» و«متوسط سعر الشراء» (طلب المالك 17/10 عن أعمدة
     الإكسيل الثلاثة). العمودين `last_purchase_price` / `avg_purchase_price` اتعملوا على
     السحابة، والفحص ده بيأكد وجودهم قبل أول رفع عشان أي سيرفر/قاعدة مالهاش العمودين
     ما يرفضش طلب مزامنة الأصناف كله (42703) — نفس درس unit في بناء 117.
     ⚠️ الحماية التانية (والأهم لـ«بيانات رافّت ما تتمسحش»): الخانة **مترفعش خالص** لو
     قيمتها المحلية صفر. الجهاز اللي لسه على نسخة قديمة (178) مالوش الخانتين دول في
     مودهله المحلية ⇒ لو بعثنا `0` كان ممكن يكتب صفر فوق سعر حقيقي منزّل من الإكسيل.
     بمنع رفع الصفر، أي جهاز قديم بيبقى غير قادر يمسح السعر — وأقصى ما يعمله ما يغيّرش حاجة. */
  var HAS_PRODUCT_PRICES = false;
  // مثل `localUnitOf` فوق: لو السحابة مالهاش العمودين، السعر اللي في الذاكرة المحلية
  // (المحسوب من فاتورة شراء على الجهاز ده) ما يضيعش من أول تنزيل.
  function localPriceOf(localId, field) {
    var list = (typeof W !== "undefined" && W.products) || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(localId)) return Number(list[i][field]) || 0;
    }
    return 0;
  }
  function probeProductPrices() {
    if (probeCacheHit("productPrices")) { HAS_PRODUCT_PRICES = true; return Promise.resolve(true); }
    return Promise.resolve().then(function () {
      return DATA.client().from("products").select("last_purchase_price, avg_purchase_price").limit(1);
    }).then(function (r) {
      HAS_PRODUCT_PRICES = !(r && r.error);
      return HAS_PRODUCT_PRICES;
    }).catch(function () { HAS_PRODUCT_PRICES = false; return false; })
      .then(function (ok) { probeCacheSet("productPrices", ok); return ok; });
  }
  // القيمة اللي ليها وجود فعلًا في الموديل المحلي (ولو الحقل الجديد ناقص = صفر/مش معروف).
  function priceForCloud(a, b) {
    var n = Number(a);
    if (n > 0) return n;
    n = Number(b);
    return n > 0 ? n : 0;
  }

  // 🆕 مهمة 98: جدول «الأصول الثابتة» على السحابة بيتعمل بترحيل ٣٧، والمالك هو اللي بيأمر بتنفيذه.
  // لحد ما يتنفّذ بنسجل الأصل محليًا وعلى الديسك زي ما هو عادي، بس ما نحاولش الرفع (مافيش جدول
  // يرفعوله) — عشان كل حفظ ما يطلعلوش تحذير «المزامنة وقفت» وهو مالوش سبب.
  // المهم: العلامة بتتفعّل بس لو السبب «الجدول غير موجود» فعلًا (42P01 / PGRST205).
  // أي فشل تاني (نت مثلاً) بيسيب العلامة زي ما هي فالرفع بيحاول عادي وما بيكتمش في صمت —
  // ده درس build 108: صمت فشل المزامنة ممنوع، والمسار الوحيد اللي بيتخطّى فيه الرفع سببه معروف وموثّق.
  // أول ما الترحيل يتنفّذ، الفحص بيجيب الجدول موجود فالعلامة بتتمحي والرفع بيكمل من نفس اللحظة.
  var FA_TABLE_MISSING = false;
  function isMissingTableError(err) {
    var msg = String((err && (err.message || err.code || err.details)) || err || "");
    return /42P01|PGRST205|does not exist|not found/i.test(msg);
  }
  function probeFixedAssetsTable() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("fixedAssets")) { FA_TABLE_MISSING = false; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("fixed_assets").select("id").limit(1); })
      .then(function (r) {
        if (r && r.error) { if (isMissingTableError(r.error)) FA_TABLE_MISSING = true; return false; }
        FA_TABLE_MISSING = false; return true;
      })
      .catch(function (e) { if (isMissingTableError(e)) FA_TABLE_MISSING = true; return false; })
      .then(function (ok) { probeCacheSet("fixedAssets", ok); return ok; });
  }

  // 🧾 بناء 176: ورديات الكاشير — نفس منطق «الأصول الثابتة»: الجدول بيتعمل بترحيل ٥٤،
  // ولحد ما يتنفّذ (بأمر المالك) الوردية بتتسجّل محليًا + على الديسك وما نحاولش رفعها
  // (مافيش جدول) عشان كل حفظ وردية ما يطلعلوش تحذير «المزامنة وقفت» بلا سبب.
  // أول ما الترحيل يتنفّذ الفحص بيرجّع الجدول موجود فالعلامة بتتمحي والرفع يكمّل.
  var CS_TABLE_MISSING = false;
  function probeCashierShiftsTable() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("cashierShifts")) { CS_TABLE_MISSING = false; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("cashier_shifts").select("id").limit(1); })
      .then(function (r) {
        if (r && r.error) { if (isMissingTableError(r.error)) CS_TABLE_MISSING = true; return false; }
        CS_TABLE_MISSING = false; return true;
      })
      .catch(function (e) { if (isMissingTableError(e)) CS_TABLE_MISSING = true; return false; })
      .then(function (ok) { probeCacheSet("cashierShifts", ok); return ok; });
  }

  // 🚚 بناء 178: رحلات سيارات المناديب — نفس منطق ورديات الكاشير: الجدول بيتعمل بترحيل ٥٥،
  // ولحد ما يتنفّذ (بأمر المالك) الرحلات بتتسجّل محليًا + على الديسك وما نحاولش رفعها
  // (مافيش جدول) عشان كل تحميل/بيع/تصفية ما يطلعلوش تحذير «المزامنة وقفت» بلا سبب.
  var CT_TABLE_MISSING = false;
  function probeCarTripsTable() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("carTrips")) { CT_TABLE_MISSING = false; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("car_trips").select("id").limit(1); })
      .then(function (r) {
        if (r && r.error) { if (isMissingTableError(r.error)) CT_TABLE_MISSING = true; return false; }
        CT_TABLE_MISSING = false; return true;
      })
      .catch(function (e) { if (isMissingTableError(e)) CT_TABLE_MISSING = true; return false; })
      .then(function (ok) { probeCacheSet("carTrips", ok); return ok; });
  }

  // 🧾 بناء 190: الشيكات (ترحيل ٦٢) — نفس نمط car_trips: الجدول بيتعمل بترحيل ٦٢، ولحد ما
  // يتنفّذ (بأمر المالك) الشيكات بتتسجّل محليًا + على الديسك وما نحاولش رفعها (مافيش جدول)
  // عشان كل تحصيل/ارتجاع ما يطلعلوش تحذير «المزامنة وقفت» بلا سبب.
  var CH_TABLE_MISSING = false;
  function probeChecksTable() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("checks")) { CH_TABLE_MISSING = false; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("checks").select("id").limit(1); })
      .then(function (r) {
        if (r && r.error) { if (isMissingTableError(r.error)) CH_TABLE_MISSING = true; return false; }
        CH_TABLE_MISSING = false; return true;
      })
      .catch(function (e) { if (isMissingTableError(e)) CH_TABLE_MISSING = true; return false; })
      .then(function (ok) { probeCacheSet("checks", ok); return ok; });
  }

  // 🆕 بناء 184: خانتا وسم السند (ref_type/ref_id) على جدول vouchers — ترحيل ٥٦ بيضيفهم،
  // وtoCloud بيبعتهما بس لما HAS_VOUCHER_REFS=true (فحص مرّة قبل أول رفع سندات).
  // قبل الترحيل: منبعتهمش خالص وإلا PostgREST يرفض الصف كله (عمود غير موجود/42703) فتوقف
  // مزامنة كل السندات بلا سبب — نفس درس عمود unit (بناء ١١٧) وسعرَي الأصناف (بناء ١٧٩).
  // أول ما الترحيل يتنفّذ، الفحص ينجح والوسم يبدأ يترفع تلقائيًا من نفس اللحظة.
  var HAS_VOUCHER_REFS = false;
  function probeVoucherRefs() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("voucherRefs")) { HAS_VOUCHER_REFS = true; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("vouchers").select("ref_type, ref_id").limit(1); })
      .then(function (r) {
        HAS_VOUCHER_REFS = !(r && r.error);
        return HAS_VOUCHER_REFS;
      })
      .catch(function () { HAS_VOUCHER_REFS = false; return false; })
      .then(function (ok) { probeCacheSet("voucherRefs", ok); return ok; });
  }

  // 🆕 بناء 199 (بند #15 — الخيار ب): «مصدر السداد» على حركات العملاء/الموردين
  // (treasury_id/treasury_name/payment_method) — ترحيل ٦٣ بيضيفهم، وtoCloud بيبعتهما
  // **بس** لما HAS_TX_RECEIPT=true. قبل الترحيل منبعتهمش خالص وإلا PostgREST يرفض الصف
  // كله (42703) فتوقف مزامنة الحركات كلها — نفس درس وسم السند (١٨٤) وعمود unit (١١٧).
  var HAS_TX_RECEIPT = false;
  function probePartyTxReceipt() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("partyTxReceipt")) { HAS_TX_RECEIPT = true; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("customer_txs").select("treasury_id, treasury_name, payment_method").limit(1); })
      .then(function (r) { HAS_TX_RECEIPT = !(r && r.error); return HAS_TX_RECEIPT; })
      .catch(function () { HAS_TX_RECEIPT = false; return false; })
      .then(function (ok) { probeCacheSet("partyTxReceipt", ok); return ok; });
  }
  // تعبئة أعمدة مصدر السداد على صف حركة طرف (بتُنادى جوّه toCloud بشرط HAS_TX_RECEIPT)
  function partyRecvCols(r) {
    return {
      treasury_id: (r.treasuryId == null || r.treasuryId === "") ? null : String(r.treasuryId),
      treasury_name: r.treasuryName || "",
      payment_method: r.paymentMethod || ""
    };
  }
  // قراءة أعمدة مصدر السداد من صف سحابي — **ما بتمسحش قيمة محلية أبدًا**:
  // بتكتب بس لو السحابة رجّعت قيمة فعلية (قبل الترحيل الأعمدة مش موجودة ⇒ undefined ⇒
  // القيمة المحلية تفضل زي ما هي). كده أول تنزيل على جهاز جديد ياخد مصدر السداد الصح،
  // وقبل الترحيل مايحصلش أي فقدان لبيانات محلية.
  function partyRecvOut(r, row) {
    if (r.treasury_id != null && r.treasury_id !== "") row.treasuryId = Number(r.treasury_id);
    if (r.treasury_name) row.treasuryName = r.treasury_name;
    if (r.payment_method) row.paymentMethod = r.payment_method;
    return row;
  }

  // 🆕 بناء 204 (بند المراجعة #2): «المدفوع/الآجل/سطور السداد» على فواتير البيع والشراء
  // (paid_amount/due_amount/payments) — ترقية ٦٥. منبعتهمش ولا نقراهم قبل الترحيل،
  // وإلا PostgREST يرفض الصف كله (42703) فتتوقف مزامنة الفواتير — نفس درس ٦٣/١٨٤.
  var HAS_INV_PAID = false;
  function probeInvPaid() {
    if (!DATA.client()) return Promise.resolve(false);
    if (probeCacheHit("invPaid")) { HAS_INV_PAID = true; return Promise.resolve(true); }
    return Promise.resolve()
      .then(function () { return DATA.client().from("sales").select("paid_amount, due_amount, payments").limit(1); })
      .then(function (r) { HAS_INV_PAID = !(r && r.error); return HAS_INV_PAID; })
      .catch(function () { HAS_INV_PAID = false; return false; })
      .then(function (ok) { probeCacheSet("invPaid", ok); return ok; });
  }
  // تعبئة أعمدة المدفوع/الآجل/السطور على صف فاتورة (بتُنادى جوّه toCloud بشرط HAS_INV_PAID)
  function invPaidCols(r) {
    var pays = Array.isArray(r.payments)
      ? r.payments.filter(function (p) { return p && Number(p.amount) > 0; })
      : [];
    return {
      paid_amount: Number(r.paidAmount != null ? r.paidAmount : 0) || 0,
      due_amount: Number(r.dueAmount != null ? r.dueAmount : 0) || 0,
      payments: pays
    };
  }
  // قراءة أعمدة المدفوع/الآجل/السطور من صف سحابي — بتكتب بس لو العمود رجع فعلًا
  // (قبل الترحيل مش موجود ⇒ undefined ⇒ القيمة المحليّة تفضل زي ما هي · صفر فقدان)
  function invPaidOut(r, row) {
    if (r.paid_amount != null) row.paidAmount = Number(r.paid_amount);
    if (r.due_amount != null) row.dueAmount = Number(r.due_amount);
    if (Array.isArray(r.payments)) row.payments = r.payments.map(function (p) { return p || {}; });
    return row;
  }

  // خريطة تحويل (محلي → سماوي / سماوي → محلي)
  var META = {
    customers: {
      local: function () { return W.customers; },
      toCloud: function (r) {
        return { id: detUuid("customers", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, name_en: r.nameEn || "", phone: r.phone || "",
          address: r.address || "", opening_balance: r.openingBalance || 0,
          credit_limit: r.creditLimit || 0, is_active: r.isActive !== false, deleted: false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, nameEn: r.name_en || "",
          phone: r.phone || "", secondaryPhone: "", walletPhone: "", address: r.address || "",
          notes: "", openingBalance: Number(r.opening_balance || 0),
          currentBalance: Number(r.opening_balance || 0), creditLimit: Number(r.credit_limit || 0),
          isActive: r.is_active !== false, protected: false };
      }
    },
    suppliers: {
      local: function () { return W.suppliers; },
      toCloud: function (r) {
        return { id: detUuid("suppliers", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, phone: r.phone || "", address: r.address || "",
          opening_balance: r.openingBalance || 0, current_balance: r.currentBalance || 0,
          is_active: r.isActive !== false, deleted: false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, phone: r.phone || "",
          walletPhone: "", address: r.address || "", notes: "", openingBalance: Number(r.opening_balance || 0),
          currentBalance: Number(r.current_balance || 0),
          isActive: r.is_active !== false, protected: false };
      }
    },
    products: {
      local: function () { return W.products; },
      toCloud: function (r) {
        var row = { id: detUuid("products", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, barcode: r.barcode || "", name_ar: r.nameAr, name_en: r.nameEn || "",
          category: r.category || "عام", purchase_price: r.purchasePrice || 0,
          sale_price: r.salePrice || 0, stock_qty: r.qty || 0, min_stock: r.reorder || 0,
          stock: r.stock || {}, is_active: r.isActive !== false };
        // 🆕 إصلاح «الوحدة فاضية في الفاتورة»: عمود unit بيترفع للسحابة (ترحيل ٣٩) —
        // بس بعد ما نتأكد إن العمود موجود فعلًا، لأن رفع عمود غير معروف بيرفض طلب
        // المزامنة كله (42703) ويوقف رفع الأصناف. الفحص بيجري مرة واحدة جوه loadAll.
        if (HAS_PRODUCT_UNIT) row.unit = r.unit || "";
        // 🆕 بناء 179: العمودين الجدد بترفع **بس** لو موجودين على السحابة **وبس** لو ليها
        // قيمة فعلية — صفر مش بيرفع خالص (جهاز على نسخة قديمة مايمسحش سعرًا منزّلًا من الإكسيل).
        if (HAS_PRODUCT_PRICES) {
          var lp = priceForCloud(r.lastPurchasePrice, r.purchasePrice);
          var ap = priceForCloud(r.avgPurchasePrice, priceForCloud(r.weightedAvgCost, lp));
          if (lp > 0) row.last_purchase_price = lp;
          if (ap > 0) row.avg_purchase_price = ap;
        }
        return row;
      },
      fromCloud: function (r) {
        var stock = r.stock; // jsonb -> object {warehouse: qty}
        if (!stock || typeof stock !== "object" || Array.isArray(stock)) {
          // لنسخ الإصدارات القديمة بدون توزيع: رصيد المبلغ كله في المستودع الافتراضي
          stock = {};
          if (Number(r.stock_qty || 0) > 0) stock["المخزن الرئيسي"] = Number(r.stock_qty || 0);
        }
        return { id: r.local_id, code: r.code, barcode: r.barcode || "", nameAr: r.name_ar,
          nameEn: r.name_en || "", category: r.category || "عام",
          // 🆕 الوحدة: من العمود السحابي إن وجد، وإلا من النسخة المحلية الموجودة في الذاكرة
          // (كانت بتتكتب "" ثابت → كل صنف بيفقد وحدته بعد أي تحميل من السحابة والفاتورة تطلع فاضية)
          unit: String(r.unit || localUnitOf(r.local_id) || ""),
          defaultWarehouse: "المخزن الرئيسي", purchasePrice: Number(r.purchase_price || 0),
          // 🆕 بناء 179: الخانتين بترجعوا من العمودين الجدد، ولو السحابة مالهاش العمودين
          // (سيرفر قديم / ترحيل ما اتنفّذش) بترجع لسعر الشراء القديم ⇒ مافيش صنف يطلع فاضي.
          // ⚠️ كان `weightedAvgCost: Number(r.purchase_price||0)` دايمًا — ده اللي كان بيمنع
          // المتوسط الحقيقي (المتوسط اللي من الإكسيل / المحسوب من الفواتير) إنه يوصل للشاشة.
          lastPurchasePrice: priceForCloud(priceForCloud(r.last_purchase_price, r.purchase_price), localPriceOf(r.local_id, "lastPurchasePrice")),
          avgPurchasePrice: priceForCloud(priceForCloud(r.avg_purchase_price, r.purchase_price), localPriceOf(r.local_id, "avgPurchasePrice")),
          weightedAvgCost: priceForCloud(priceForCloud(r.avg_purchase_price, r.purchase_price), localPriceOf(r.local_id, "weightedAvgCost")),
          salePrice: Number(r.sale_price || 0),
          discountPercent: 0, discountStart: "", discountEnd: "",
          stock: stock, qty: Number(r.stock_qty || 0), reorder: Number(r.min_stock || 0),
          isActive: r.is_active !== false };
      }
    },
    treasury: {
      local: function () { return W.treasury; },
      toCloud: function (r) {
        // 🛡 بناء 119: الرصيد الافتتاحي مش بيمشي مع الرفع الجماعي.
        // الرفع الجماعي بيبعت الجدول كامل من لقطة الجهاز، فأي جهاز تاني لسه
        // ماسك قيمة قديم كان بيرجع يكتبها فوق تعديل المستخدم (شكوى المالك:
        // يخلي البنك صفر → «تم الحفظ» → يرجع 50,000). الرصيد الافتتاحي بيتكتب
        // دلوقتي بأمر مباشر لسطره هو فقط في setTreasuryOpening.
        return { id: detUuid("treasury", r.id), org_id: DATA.orgId(), local_id: r.id,
          name: r.name, type: r.type || "cash", account_no: r.accountNo || "",
          balance: r.balance || 0,
          is_active: r.isActive !== false };
      },
      fromCloud: function (r) {
        // ترحيل ٣٤: السطر اللي فقد local_id على السحابة يسترجعه من الـ uuid بدل ما يتشال
        // من القائمة ويعاد ترقيمه من جديد في كل تحميل (ده كان بيولّد التكرار).
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("treasury", r.id);
        return { id: lid, name: r.name, type: r.type || "cash", accountNo: r.account_no || "",
          openingBalance: Number(r.opening_balance || 0), balance: Number(r.balance || 0),
          isActive: r.is_active !== false };
      }
    },
    // 🆕 مهمة 98: الأصول الثابتة — نفس نمط الهوية (detUuid + local_id) من ترحيل ٣٧
    fixed_assets: {
      local: function () { return W.fixed_assets || []; },
      toCloud: function (r) {
        return { id: detUuid("fixed_assets", r.id), org_id: DATA.orgId(), local_id: r.id,
          name_ar: r.nameAr || "", asset_class: r.assetClass === "intangible" ? "intangible" : "noncurrent",
          category: r.category || "أخرى", purchase_date: r.purchaseDate || null,
          cost: Number(r.cost || 0), accum_dep: Number(r.accumDep || 0),
          notes: r.notes || "", is_active: r.isActive !== false, deleted: false };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("fixed_assets", r.id);
        return { id: lid, nameAr: r.name_ar || "",
          assetClass: r.asset_class === "intangible" ? "intangible" : "noncurrent",
          category: r.category || "أخرى", purchaseDate: String(r.purchase_date || "").slice(0, 10),
          cost: Number(r.cost || 0), accumDep: Number(r.accum_dep || 0),
          notes: r.notes || "", isActive: r.is_active !== false };
      }
    },
    // 🧾 بناء 176: ورديات الكاشير — نفس نمط الهوية (detUuid + local_id) من ترحيل ٥٤.
    // كل وردية = جلسة استعمال صندوق (خزينة) برقاقة افتتاحية تُقفل بأمر ثم تُسوّى.
    cashier_shifts: {
      local: function () { return W.cashier_shifts || []; },
      toCloud: function (r) {
        return { id: detUuid("cashier_shifts", r.id), org_id: DATA.orgId(), local_id: r.id,
          cashier_id: String(r.cashierId || ""), cashier_name: r.cashierName || "",
          cashier_key: r.cashierKey || "",
          treasury_id: (r.treasuryId != null ? Number(r.treasuryId) : null),
          treasury_name: r.treasuryName || "",
          opened_at: r.openedAt || "", opening_float: Number(r.openingFloat || 0),
          status: r.status || "open",
          closed_at: r.closedAt || null, closed_by: r.closedBy || null,
          expected_cash: (r.expectedCash != null ? Number(r.expectedCash) : null),
          counted_cash: (r.countedCash != null ? Number(r.countedCash) : null),
          difference: (r.difference != null ? Number(r.difference) : null),
          denoms: r.denoms || null, notes: r.notes || "",
          settled_at: r.settledAt || null, settled_by: r.settledBy || null,
          main_treasury_id: (r.mainTreasuryId != null ? Number(r.mainTreasuryId) : null),
          settled_amount: (r.settledAmount != null ? Number(r.settledAmount) : null),
          breakdown: r.breakdown || null, deleted: false };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("cashier_shifts", r.id);
        return { id: lid,
          cashierId: r.cashier_id || "", cashierName: r.cashier_name || "",
          cashierKey: r.cashier_key || "",
          treasuryId: (r.treasury_id != null ? Number(r.treasury_id) : null),
          treasuryName: r.treasury_name || "",
          openedAt: r.opened_at || "", openingFloat: Number(r.opening_float || 0),
          status: r.status || "open",
          closedAt: r.closed_at || null, closedBy: r.closed_by || null,
          expectedCash: (r.expected_cash != null ? Number(r.expected_cash) : null),
          countedCash: (r.counted_cash != null ? Number(r.counted_cash) : null),
          difference: (r.difference != null ? Number(r.difference) : null),
          denoms: r.denoms || null, notes: r.notes || "",
          settledAt: r.settled_at || null, settledBy: r.settled_by || null,
          mainTreasuryId: (r.main_treasury_id != null ? Number(r.main_treasury_id) : null),
          settledAmount: (r.settled_amount != null ? Number(r.settled_amount) : null),
          breakdown: r.breakdown || null };
      }
    },
    // 🚚 بناء 178: رحلات سيارات المناديب (ترحيل ٥٥). كل رحلة = تحميل سيارة يوم + بيع + مصروفات + تصفية.
    car_trips: {
      local: function () { return W.car_trips || []; },
      toCloud: function (r) {
        return { id: detUuid("car_trips", r.id), org_id: DATA.orgId(), local_id: r.id,
          car_name: r.carName || "", rep_name: r.repName || "", rep_user: r.repUser || "",
          rep_full: r.repFull || "",
          trip_date: r.date || "", status: r.status || "open",
          loaded: r.loaded || [], expenses: r.expenses || [],
          load_warehouse: r.loadWarehouse || "",
          opened_at: r.openedAt || "", opened_by: r.openedBy || "",
          settled_at: r.settledAt || null, settled_by: r.settledBy || null,
          counted_cash: (r.countedCash != null ? Number(r.countedCash) : null),
          expected_cash: (r.expectedCash != null ? Number(r.expectedCash) : null),
          difference: (r.difference != null ? Number(r.difference) : null),
          treasury_id: (r.treasuryId != null ? Number(r.treasuryId) : null),
          settle_warehouse: r.settleWarehouse || "",
          notes: r.notes || "", deleted: false };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("car_trips", r.id);
        return { id: lid,
          carName: r.car_name || "", repName: r.rep_name || "", repUser: r.rep_user || "",
          repFull: r.rep_full || "",
          date: r.trip_date || "", status: r.status || "open",
          loaded: r.loaded || [], expenses: r.expenses || [],
          loadWarehouse: r.load_warehouse || "",
          openedAt: r.opened_at || "", openedBy: r.opened_by || "",
          settledAt: r.settled_at || null, settledBy: r.settled_by || null,
          countedCash: (r.counted_cash != null ? Number(r.counted_cash) : null),
          expectedCash: (r.expected_cash != null ? Number(r.expected_cash) : null),
          difference: (r.difference != null ? Number(r.difference) : null),
          treasuryId: (r.treasury_id != null ? Number(r.treasury_id) : null),
          settleWarehouse: r.settle_warehouse || "",
          notes: r.notes || "" };
      }
    },
    // 🧾 بناء 190: الشيكات (ترحيل ٦٢). كل شيك = ورقة قبض بتاريخ استحقاق وحالة.
    checks: {
      local: function () { return W.checks || []; },
      toCloud: function (r) {
        return { id: detUuid("checks", r.id), org_id: DATA.orgId(), local_id: r.id,
          direction: r.direction || "in", party_kind: r.partyKind || "customer",
          customer_id: (r.customerId != null ? String(r.customerId) : null),
          customer_name: r.customerName || "", bank_name: r.bankName || "",
          check_no: r.checkNo || "", due_date: r.dueDate || null,
          amount: Number(r.amount) || 0, status: r.status || "pending",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : null),
          collected_at: r.collectedAt || null, notes: r.notes || "",
          ref_type: r.refType || "", ref_id: r.refId || "", deleted: false };
      },
      fromCloud: function (r) {
        var lid = (r.local_id != null) ? Number(r.local_id) : localIdFromUuid("checks", r.id);
        return { id: lid,
          direction: r.direction || "in", partyKind: r.party_kind || "customer",
          customerId: (r.customer_id != null ? r.customer_id : null),
          customerName: r.customer_name || "", bankName: r.bank_name || "",
          checkNo: r.check_no || "", dueDate: r.due_date || "",
          amount: Number(r.amount) || 0, status: r.status || "pending",
          treasuryId: (r.treasury_id != null ? r.treasury_id : null),
          collectedAt: r.collected_at || null, notes: r.notes || "",
          refType: r.ref_type || "", refId: r.ref_id || "" };
      }
    },
    accounts: {
      local: function () { return W.accounts; },
      toCloud: function (r) {
        var ob = Number(r.openingBalance || 0);
        return { id: detUuid("accounts", r.id), org_id: DATA.orgId(), local_id: r.id,
          code: r.code, name_ar: r.nameAr, type: r.type, parent_id: r.parentId || 0,
          opening_debit: ob < 0 ? 0 : ob, opening_credit: ob < 0 ? -ob : 0,
          balance: r.balance || 0, is_active: r.isActive !== false };
      },
      fromCloud: function (r) {
        return { id: r.local_id, code: r.code, nameAr: r.name_ar, type: r.type,
          parentId: Number(r.parent_id || 0),
          openingBalance: Number(r.opening_debit || 0) - Number(r.opening_credit || 0),
          balance: Number(r.balance || 0), isActive: r.is_active !== false };
      }
    },
    sales: {
      local: function () { return W.sales; },
      toCloud: function (r) {
        var row = {
          id: detUuid("sales", r.id),
          org_id: DATA.orgId(),
          local_id: r.id,
          invoice_no: r.invoiceNumber || r.invoiceNo || String(r.id),
          doc_date: docDate(r),
          customer: r.customerName || r.customer || "",
          customer_id: localIdStr(r.customerId),
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          discount: r.discountAmount || r.discount || 0,
          tax: r.taxAmount || r.tax || 0,
          grand_total: r.grandTotal || 0
        };
        if (HAS_INV_PAID) { var _p1 = invPaidCols(r); row.paid_amount = _p1.paid_amount; row.due_amount = _p1.due_amount; row.payments = _p1.payments; }
        return row;
      },
      fromCloud: function (r) {
        return invPaidOut(r, {
          id: r.local_id,
          invoiceNo: r.invoice_no,
          invoiceNumber: r.invoice_no,
          date: r.doc_date,
          invoiceDate: r.doc_date,
          customer: r.customer || "",
          customerName: r.customer || "",
          customerId: localIdNum(r.customer_id),
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !Number.isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "",
          warehouse: r.store || "",
          notes: r.notes || "",
          discount: Number(r.discount || 0),
          discountAmount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          taxAmount: Number(r.tax || 0),
          grandTotal: Number(r.grand_total || 0),
          subTotal: Number(r.grand_total || 0) + Number(r.discount || 0) - Number(r.tax || 0),
          status: "posted",
          items: []
        });
      },
      itemsTable: "sale_items",
      itemFromCloud: function (r) {
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "",
          nameAr: r.product_name || "",
          code: r.code || "",
          unit: r.unit || "",
          qty: Number(r.qty || 0),
          price: Number(r.price || 0),
          discount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0)
        };
      },
      itemToCloud: function (sale) {
        return (sale.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(sale.id) * 1000 + Number(itemId);
          return {
            id: detUuid("sale_items", uniqueLocalId),
            org_id: DATA.orgId(),
            local_id: uniqueLocalId,
            sale_id: detUuid("sales", sale.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "",
            code: it.code || "",
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            total: Number(it.total || 0)
          };
        });
      }
    },
    purchases: {
      local: function () { return W.purchases; },
      toCloud: function (r) {
        var row = {
          id: detUuid("purchases", r.id),
          org_id: DATA.orgId(),
          local_id: r.id,
          invoice_no: r.invoiceNumber || r.invoiceNo || String(r.id),
          doc_date: docDate(r),
          supplier: r.supplierName || r.supplier || "",
          supplier_id: localIdStr(r.supplierId),
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          discount: r.discountAmount || r.discount || 0,
          tax: r.taxAmount || r.tax || 0,
          grand_total: r.grandTotal || 0
        };
        if (HAS_INV_PAID) { var _p2 = invPaidCols(r); row.paid_amount = _p2.paid_amount; row.due_amount = _p2.due_amount; row.payments = _p2.payments; }
        return row;
      },
      fromCloud: function (r) {
        return invPaidOut(r, {
          id: r.local_id,
          invoiceNo: r.invoice_no,
          invoiceNumber: r.invoice_no,
          date: r.doc_date,
          invoiceDate: r.doc_date,
          supplier: r.supplier || "",
          supplierName: r.supplier || "",
          supplierId: localIdNum(r.supplier_id),
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !Number.isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "",
          warehouse: r.store || "",
          notes: r.notes || "",
          discount: Number(r.discount || 0),
          discountAmount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          taxAmount: Number(r.tax || 0),
          grandTotal: Number(r.grand_total || 0),
          subTotal: Number(r.grand_total || 0) + Number(r.discount || 0) - Number(r.tax || 0),
          status: "posted",
          items: []
        });
      },
      itemsTable: "purchase_items",
      itemFromCloud: function (r) {
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "",
          nameAr: r.product_name || "",
          code: r.code || "",
          unit: r.unit || "",
          qty: Number(r.qty || 0),
          price: Number(r.price || 0),
          discount: Number(r.discount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0)
        };
      },
      itemToCloud: function (pur) {
        return (pur.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(pur.id) * 1000 + Number(itemId);
          return {
            id: detUuid("purchase_items", uniqueLocalId),
            org_id: DATA.orgId(),
            local_id: uniqueLocalId,
            purchase_id: detUuid("purchases", pur.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "",
            code: it.code || "",
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
            qty: Number(it.qty || 0),
            price: Number(it.price || 0),
            total: Number(it.total || 0)
          };
        });
      }
    },
    // ============ المرتجعات (بناء 108) ============
    // نفس نمط الفواتير بالظبط: سطر رئيسي + أصناف، ومعرّف ثابت (detUuid)
    // عشان الجهاز التاني ما يكررش السطر.
    sale_returns: {
      local: function () { return W.sale_returns || []; },
      toCloud: function (r) {
        return {
          id: detUuid("sale_returns", r.id), org_id: DATA.orgId(), local_id: r.id,
          return_no: r.returnNumber || r.returnNo || String(r.id),
          doc_date: docDate(r),
          sale_local_id: (r.saleId != null && !Number.isNaN(Number(r.saleId))) ? Number(r.saleId) : null,
          customer: r.customerName || r.customer || "",
          customer_id: localIdStr(r.customerId),
          settlement: r.settlement || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          returnNo: r.return_no, returnNumber: r.return_no,
          date: r.doc_date, returnDate: r.doc_date,
          saleId: (r.sale_local_id == null ? null : Number(r.sale_local_id)),
          customerId: localIdNum(r.customer_id),
          customer: r.customer || "", customerName: r.customer || "",
          settlement: r.settlement || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !Number.isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "", warehouse: r.store || "",
          notes: r.notes || "",
          grandTotal: Number(r.grand_total || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "sale_return_items",
      itemFromCloud: function (r) {
        // local_id = رقم المرتجع ×1000 + رقم السطر → نرجّعه لرقم السطر عشان إعادة الدفع ما تكررش الأصناف
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "", nameAr: r.product_name || "",
          unit: r.unit || "", code: r.code || "",
          discount: Number(r.discount || 0), tax: Number(r.tax || 0),
          qty: Number(r.qty || 0), price: Number(r.price || 0), total: Number(r.total || 0)
        };
      },
      itemToCloud: function (ret) {
        return (ret.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(ret.id) * 1000 + Number(itemId);
          return {
            id: detUuid("sale_return_items", uniqueLocalId),
            org_id: DATA.orgId(), local_id: uniqueLocalId,
            return_id: detUuid("sale_returns", ret.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "", code: it.code || "",
            discount: Number(it.discount || 0), tax: Number(it.tax || 0),
            qty: Number(it.qty || 0), price: Number(it.price || 0), total: Number(it.total || 0)
          };
        });
      }
    },
    purchase_returns: {
      local: function () { return W.purchase_returns || []; },
      toCloud: function (r) {
        return {
          id: detUuid("purchase_returns", r.id), org_id: DATA.orgId(), local_id: r.id,
          return_no: r.returnNumber || r.returnNo || String(r.id),
          doc_date: docDate(r),
          purchase_local_id: (r.purchaseId != null && !Number.isNaN(Number(r.purchaseId))) ? Number(r.purchaseId) : null,
          supplier: r.supplierName || r.supplier || "",
          supplier_id: localIdStr(r.supplierId),
          settlement: r.settlement || "",
          payment_method: r.paymentMethod || "",
          treasury_id: (r.treasuryId != null ? String(r.treasuryId) : ""),
          store: r.warehouse || r.store || "",
          notes: r.notes || "",
          grand_total: r.grandTotal || 0
        };
      },
      fromCloud: function (r) {
        return {
          id: r.local_id,
          returnNo: r.return_no, returnNumber: r.return_no,
          date: r.doc_date, returnDate: r.doc_date,
          purchaseId: (r.purchase_local_id == null ? null : Number(r.purchase_local_id)),
          supplierId: localIdNum(r.supplier_id),
          supplier: r.supplier || "", supplierName: r.supplier || "",
          settlement: r.settlement || "",
          paymentMethod: r.payment_method || "",
          treasuryId: (r.treasury_id && !Number.isNaN(Number(r.treasury_id))) ? Number(r.treasury_id) : (r.treasury_id || null),
          store: r.store || "", warehouse: r.store || "",
          notes: r.notes || "",
          grandTotal: Number(r.grand_total || 0),
          status: "posted",
          items: []
        };
      },
      itemsTable: "purchase_return_items",
      itemFromCloud: function (r) {
        // local_id = رقم المرتجع ×1000 + رقم السطر → نفكّه لرقم السطر (زي جدول الفاتورة بالظبط)
        return {
          id: decodeItemLocalId(r.local_id),
          productId: r.product_id || "", nameAr: r.product_name || "",
          unit: r.unit || "", code: r.code || "",
          discount: Number(r.discount || 0), tax: Number(r.tax || 0),
          qty: Number(r.qty || 0), price: Number(r.price || 0), total: Number(r.total || 0)
        };
      },
      itemToCloud: function (ret) {
        return (ret.items || []).map(function (it, idx) {
          var itemId = it.id || (idx + 1);
          var uniqueLocalId = Number(ret.id) * 1000 + Number(itemId);
          return {
            id: detUuid("purchase_return_items", uniqueLocalId),
            org_id: DATA.orgId(), local_id: uniqueLocalId,
            return_id: detUuid("purchase_returns", ret.id),
            product_id: (it.productId || "").toString(),
            product_name: it.nameAr || "",
            unit: it.unit || "", code: it.code || "",
            discount: Number(it.discount || 0), tax: Number(it.tax || 0),
            qty: Number(it.qty || 0), price: Number(it.price || 0), total: Number(it.total || 0)
          };
        });
      }
    },
    supplier_txs: {
      local: function () { return W.supplier_txs || []; },
      toCloud: function (r) {
        var row = { id: detUuid("supplier_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          supplier_id: localIdStr(r.supplierId), doc_date: docDate(r),
          type: r.type || "", amount: r.amount || 0,
          description: r.desc || r.description || "",
          debit: r.debit || 0, credit: r.credit || 0 };
        // 🆕 بناء 199 (بند #15ب): مصدر السداد بيترفع بس بعد ترحيل ٦٣ (وإلا PostgREST يرفض الصف)
        if (HAS_TX_RECEIPT) { var c1 = partyRecvCols(r); row.treasury_id = c1.treasury_id; row.treasury_name = c1.treasury_name; row.payment_method = c1.payment_method; }
        return row;
      },
      fromCloud: function (r) {
        // السطور القديمة مفيهاش debit/credit (اتسجلت نوع/مبلغ بس) → نشتقهم
        var d = Number(r.debit || 0), c = Number(r.credit || 0);
        if (!d && !c && r.amount) {
          if (String(r.type || "").indexOf("مرتجع") !== -1 || String(r.description || "").indexOf("مرتجع") !== -1) c = Number(r.amount);
          else d = Number(r.amount);
        }
        return partyRecvOut(r, { id: r.local_id, supplierId: localIdNum(r.supplier_id), date: r.doc_date,
          createdAt: r.created_at || null,
          type: r.type || "", amount: Number(r.amount || 0),
          desc: r.description || "", debit: d, credit: c });
      }
    },
    customer_txs: {
      local: function () { return W.customer_txs || []; },
      toCloud: function (r) {
        var row = { id: detUuid("customer_txs", r.id), org_id: DATA.orgId(), local_id: r.id,
          customer_id: localIdStr(r.customerId), doc_date: docDate(r),
          description: r.desc || "", debit: r.debit || 0, credit: r.credit || 0 };
        if (HAS_TX_RECEIPT) { var c2 = partyRecvCols(r); row.treasury_id = c2.treasury_id; row.treasury_name = c2.treasury_name; row.payment_method = c2.payment_method; }
        return row;
      },
      fromCloud: function (r) {
        return partyRecvOut(r, { id: r.local_id, customerId: localIdNum(r.customer_id), date: r.doc_date,
          createdAt: r.created_at || null,
          desc: r.description || "", debit: Number(r.debit || 0), credit: Number(r.credit || 0) });
      }
    },
    vouchers: {
      local: function () { return W.vouchers; },
      toCloud: function (r) {
        var row = { id: detUuid("vouchers", r.id), org_id: DATA.orgId(), local_id: r.id,
          no: r.no || r.id, doc_date: docDate(r), kind: r.kind || r.type || "in",
          treasury_id: (r.treasuryId || "").toString(), account_id: (r.accountId || "").toString(),
          amount: r.amount || 0, notes: r.notes || r.desc || "" };
        // 🆕 بناء 184: وسم السند (refType/refId) بيترفع بس لو العمودان موجودان على السحابة
        // (ترحيل ٥٦). قبل الترحيل منبعتهمش خالص وإلا PostgREST يرفض الصف كله (42703)
        // ⇒ مزامنة السندات كلها تقف — نفس درس عمود unit في بناء ١١٧.
        if (HAS_VOUCHER_REFS) { row.ref_type = r.refType || ""; row.ref_id = r.refId || ""; }
        return row;
      },
      fromCloud: function (r) {
        var k = r.kind || "in";
        return { id: r.local_id, no: r.no, date: r.doc_date, kind: k, type: k,
          treasuryId: Number(r.treasury_id || 0), accountId: Number(r.account_id || 0),
          amount: Number(r.amount || 0), desc: r.notes || "", notes: r.notes || "",
          refType: r.ref_type || "", refId: r.ref_id || "" };
      }
    },
    journal_entries: {
      local: function () { return W.journalEntries; },
      toCloud: function (r) {
        // 🆕 بناء 118: app.js بيخزّن القيد بأسماء number/desc/ref — والعمود اسمه jrn_no/description/ref_type.
        // من غير الفallback ده كان كل قيد يدوي بيركب السحابة «بلا بيان وبلا رقم حقيقي».
        return { id: detUuid("journal_entries", r.id), org_id: DATA.orgId(), local_id: r.id,
          jrn_no: r.jrnNo || r.number || r.id, doc_date: docDate(r), ref_type: r.refType || r.ref || "",
          ref_id: (r.refId || "").toString(), description: r.description || r.desc || "" };
      },
      fromCloud: function (r) {
        // 🆕 بناء 118: ترجيع نفس أسماء الحقول اللي شاشة «القيود اليومية» بتقرأها
        // (number/desc/ref/debit/credit). قبل كده كانت بترجع jrnNo/description فقط ⇒
        // الجدول بيطلع صفوف فاضية بعد أي إعادة تشغيل رغم إن البيانات موجودة على السحابة.
        return { id: r.local_id, number: r.jrn_no, jrnNo: r.jrn_no, date: r.doc_date,
          desc: r.description || "", description: r.description || "",
          ref: r.ref_type || "", refType: r.ref_type || "", refId: r.ref_id,
          debit: 0, credit: 0, lines: [] };
      },
      itemsTable: "journal_lines",
      itemFromCloud: function (r) {
        return { id: decodeItemLocalId(r.local_id), accountId: Number(r.account_id || 0), accountName: r.account_name,
          debit: Number(r.debit || 0), credit: Number(r.credit || 0) };
      },
      itemToCloud: function (en) {
        return (en.lines || []).map(function (l) {
          return { id: detUuid("journal_lines", l.id), org_id: DATA.orgId(), local_id: l.id,
            entry_id: detUuid("journal_entries", en.id),
            account_id: (l.accountId || "").toString(), account_name: l.accountName || "",
            debit: l.debit || 0, credit: l.credit || 0 };
        });
      }
    }
  };

  var W = window.MIZAN_STATE || {};
  // ربط الحالة (نضع الحيوانات في window حتى تتمكن app من ملء المرجع)
  window.MIZAN_STATE = W;

  // ============ رفع جدول للسحابة ============
  // القواعد الجديدة (بناء ١٠٨):
  //  ١) مفتاح السطر السحابي (id) بيتقرأ من السحابة وميتكتبش من جديد — إعادة كتابة id
  //     كانت بتيتّم أسطر الأصناف وبنقلت سطور لفواتير تانية.
  //  ٢) الحذف بيتم بس للسطور اللي الجهاز ده شافها في آخر تنزيل، وبكمية محدودة.
  // 🆕 بناء 209 (بند 16): فلتر الشركة صريحًا على كل قراءة/مسح — حتى لو سياسة
  // السحابة اتغيّرت أو الدور بقى واسعًا، الجهاز ما يلمسش صفوف شركة تانية.
  function orgScoped(q) {
    var o = DATA.orgId ? DATA.orgId() : null;
    var w = window.MIZAN_STATE || {};
    if (!o && w.org && w.org.id) o = w.org.id;
    return o ? q.eq("org_id", o) : q;
  }

  // 🆕 بناء 234: أدوات رفع أسطر الأصناف/القيود للأب المتغير فقط.
  function chunkList(arr, size) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function upsertRowsSmart(client, table, rows) {
    return client.from(table).upsert(rows, { onConflict: "id" }).select("id, local_id").then(function (u) {
      if (u && u.error) {
        var code = String((u.error && u.error.code) || "");
        var msg = String((u.error && u.error.message) || "");
        if (code === "23505" || /duplicate key/i.test(msg)) {
          return client.from(table).upsert(rows, { onConflict: "org_id,local_id" }).select("id, local_id").then(function (u2) {
            if (u2 && u2.error) throw u2.error;
            return u2.data || [];
          });
        }
        throw u.error;
      }
      return u && u.data ? u.data : [];
    });
  }

  function deleteIdList(client, table, idList) {
    var list = (idList || []).filter(Boolean);
    if (!list.length) return Promise.resolve();
    return Promise.all(chunkList(list, 100).map(function (part) {
      return client.from(table).delete().in("id", part).then(function (d) {
        if (d && d.error) throw d.error;
      });
    }));
  }

  // أسطر الأب المتغير: نرفع أسطره الحالية، ونمسح فقط الأسطر القديمة اللي الجهاز شافها
  // (نفس حارس seenIds في syncItems) — مش بنمسح أسطر أضافها جهاز تاني بعد آخر تنزيل.
  function pushSubsetItems(name, ids, removed) {
    var meta = META[name];
    if (!meta || !meta.itemsTable) return Promise.resolve(true);
    var itemsTable = meta.itemsTable;
    var parentField = meta.itemsParentField || PARENT_OF[itemsTable];
    if (!parentField) return Promise.resolve(true);
    var client = DATA.client();
    var idMap = (W.idMap && W.idMap[name]) || {};
    var itemMap = (W.idMap && W.idMap[itemsTable]) || {};
    var local = meta.local() || [];
    var byId = {};
    local.forEach(function (p) { if (p && p.id != null) byId[Number(p.id)] = p; });
    var keep = {};
    (ids || []).forEach(function (raw) {
      var id = Number(raw);
      var p = byId[id];
      if (!p) return;
      keep[id] = 0;
    });
    var rows = [];
    (ids || []).forEach(function (raw) {
      var id = Number(raw);
      var p = byId[id];
      var pUuid = idMap[id];
      if (!p || !pUuid) return;
      var mapped = meta.itemToCloud(p) || [];
      mapped.forEach(function (row, idx) {
        if (!row) return;
        row.local_id = id * 1000 + (idx + 1);
        row[parentField] = pUuid;
        row.id = detUuid(itemsTable, row.local_id);
        rows.push(row);
      });
      keep[id] = Math.min(mapped.length, 999);
    });
    var changedParents = {};
    (ids || []).forEach(function (id) { changedParents[Number(id)] = 1; });
    (removed || []).forEach(function (id) { changedParents[Number(id)] = 1; });
    var stale = [];
    Object.keys(itemMap).forEach(function (k) {
      var lid = Number(k);
      if (!lid) return;
      var pid = Math.floor(lid / 1000);
      if (!changedParents[pid]) return;
      if (keep[pid] != null && (lid % 1000) <= keep[pid]) return;
      if (itemMap[k]) stale.push(itemMap[k]);
    });
    var chain = Promise.resolve();
    if (rows.length) {
      chain = upsertRowsSmart(client, itemsTable, rows).then(function (saved) {
        rememberIds(itemsTable, saved);
      });
    }
    if (stale.length) {
      var staleSet = {};
      stale.forEach(function (id) { staleSet[id] = 1; });
      chain = chain.then(function () { return deleteIdList(client, itemsTable, stale); }).then(function () {
        Object.keys(itemMap).forEach(function (k) {
          if (staleSet[itemMap[k]]) delete itemMap[k];
        });
      });
    }
    return chain.then(function () { return true; }).catch(function (e) {
      syncFailed(itemsTable, e);
      return false;
    });
  }

  // 🆕 بناء 232/233: رفع الصفوف المتغيرة فقط بدل الجدول كامل مع كل حفظ.
  // ids = أرقام local_id المتغيرة، removed = أرقام local_id المحذوفة محليًا.
  // لا نعمل select للجدول كامل: الهوية السحابية من W.idMap، والصفوف الجديدة فقط
  // بنسأل عليها بنداء مصغّر (id, local_id) مقسّم لدفعات.
  function pushSubsetRows(name, ids, removed) {
    var meta = META[name];
    if (!meta || !DATA.isOnline() || !DATA.client()) return Promise.resolve(false);
    var local = meta.local() || [];
    var want = {};
    (ids || []).forEach(function (id) { var n = Number(id); if (n > 0) want[n] = 1; });
    var rows = local.filter(function (r) { return want[Number(r.id)]; }).map(function (r) {
      return meta.toCloud(r);
    });
    var rem = (removed || []).map(Number).filter(function (n) { return n > 0; });
    if (!rows.length && !rem.length) return Promise.resolve(true);
    // حذف جماعي غير طبيعي ⇒ نرجع للمزامنة الكاملة (بحماياتها) بدل حذف واسع.
    if (rem.length > Math.max(5, Math.floor(local.length * 0.25))) return syncOne(name);
    var client = DATA.client();
    W.idMap = W.idMap || {};
    var idMap = W.idMap[name] || (W.idMap[name] = {});
    var missing = [];
    rows.forEach(function (row) {
      if (idMap[Number(row.local_id)] == null && missing.indexOf(Number(row.local_id)) < 0) {
        missing.push(Number(row.local_id));
      }
    });
    rem.forEach(function (id) {
      if (idMap[id] == null && missing.indexOf(id) < 0) missing.push(id);
    });
    var ready = Promise.resolve();
    if (missing.length) {
      var parts = [];
      for (var i = 0; i < missing.length; i += 200) parts.push(missing.slice(i, i + 200));
      ready = Promise.all(parts.map(function (part) {
        return orgScoped(client.from(name).select("id, local_id")).in("local_id", part).then(function (res) {
          if (res && res.error) throw res.error;
          (res.data || []).forEach(function (r) {
            if (r && r.local_id != null) idMap[Number(r.local_id)] = r.id;
          });
        });
      }));
    }
    return ready.then(function () {
      rows.forEach(function (row) {
        var cid = idMap[Number(row.local_id)];
        if (cid) row.id = cid;
      });
      var chain = Promise.resolve();
      if (rem.length) {
        chain = orgScoped(client.from(name).delete()).in("local_id", rem).then(function (d) {
          if (d && d.error) throw d.error;
          rem.forEach(function (id) { delete idMap[Number(id)]; });
        });
      }
      if (rows.length) {
        chain = chain.then(function () {
          return upsertRowsSmart(client, name, rows).then(function (saved) {
            saved.forEach(function (r) {
              if (r && r.local_id != null) idMap[Number(r.local_id)] = r.id;
            });
          });
        });
      }
      return chain.then(function () {
        return pushSubsetItems(name, ids, rem);
      }).then(function (itemsOk) {
        if (itemsOk === false) return false;
        // الهوية السحابية بتتسجّل من رد upsert نفسه (saved) — مش من row.id
        // المحسوب محليًا، عشان مسار fallback (org_id,local_id) ممكن يرجّع id مختلف.
        W.lastSyncAt = Date.now();
        W.lastSyncTable = name;
        return true;
      });
    }).catch(function (e) {
      syncFailed(name, e);
      return false;
    });
  }

  function pushProductRows(ids, removed) {
    return pushSubsetRows("products", ids, removed);
  }

  function pushAccountRows(ids, removed) {
    return pushSubsetRows("accounts", ids, removed);
  }

  function pushRows(name, ids, removed) {
    if (name === "products") return pushProductRows(ids, removed);
    if (name === "accounts") return pushAccountRows(ids, removed);
    if (name === "sales") return pushSubsetRows("sales", ids, removed);
    if (name === "journal_entries") return pushSubsetRows("journal_entries", ids, removed);
    return syncOne(name);
  }

  function syncOne(name) {
    var meta = META[name];
    if (!meta || !DATA.isOnline() || !DATA.client()) return Promise.resolve(null);
    // 🆕 مهمة 98: الجدول لسه ما اتعملش على السحابة (ترحيل ٣٧ بأمر المالك) ⇒ الرفع مالوش مكان.
    // السجل بيتحفظ محليًا + على الديسك زي ما هو، والعلامة بتتمحي أول ما الجدول يظهر.
    // غير كده (نت مثلاً) المحاولة بتفضل عادية — صمت فشل المزامنة ممنوع (درس build 108).
    if (name === "fixed_assets" && FA_TABLE_MISSING) return Promise.resolve(null);
    if (name === "cashier_shifts" && CS_TABLE_MISSING) return Promise.resolve(null);
    if (name === "car_trips" && CT_TABLE_MISSING) return Promise.resolve(null);
    if (name === "checks" && CH_TABLE_MISSING) return Promise.resolve(null);
    var failed = false;
    function fail(what, err) { failed = true; syncFailed(what, err); }
    var local = meta.local() || [];
    var client = DATA.client();
    return orgScoped(client.from(name).select("id, local_id")).then(function (res) {
      if (res.error) { fail(name, res.error); return false; }
      var have = res.data || [];
      var cloudId = {};                                  // local_id -> uuid الموجود على السحابة
      have.forEach(function (r) { if (r && r.local_id != null) cloudId[Number(r.local_id)] = r.id; });
      var seen = seenIds(name);
      var localIds = local.map(function (r) { return Number(r.id); });
      var drop = [];
      have.forEach(function (r) {
        if (!r || r.local_id == null) return;
        if (localIds.indexOf(Number(r.local_id)) !== -1) return;
        if (seen[r.id]) drop.push(r.local_id);           // (٢) اللي مانشوفوش ما نمسحوش
      });
      var rows = local.map(function (r) {
        var row = meta.toCloud(r);
        var k = Number(r.id);
        if (cloudId[k] != null) row.id = cloudId[k];     // (١) نلبس السطر نفس رقمه السحابي
        else if (W.idMap && W.idMap[name] && W.idMap[name][k]) row.id = W.idMap[name][k];
        return row;
      });
      // حماية إضافية: المحذوف ما يزيدش عن ربع الجدول، والممسوحش لما الجهاز حاله فاضي
      if (drop.length && !wipeGuard(name, local.length, have.length)) drop = [];
      if (drop.length && !capDeletes(name, drop.length, have.length)) drop = [];
      var chain = Promise.resolve();
      if (drop.length) {
        chain = client.from(name).delete().in("local_id", drop).then(function (d) {
          if (d && d.error) fail(name, d.error);
        });
      }
      if (rows.length) {
        chain = chain.then(function () {
          // 🆕 ترحيل ٣٤: الحكم هو المفتاح الأساسي (id). السطور اللي فقدت local_id على السحابة
          // ما بتتطابقش مع on conflict (org_id, local_id) فتتحول لـ INSERT بيصطدم بـ treasury_pkey
          // (خطأ 23505) ⇒ الدفعة كلها تفشل ⇒ رسالة «رفع «الخزائن» للسحابة مكملش دلوقتي».
          // بـ "id": نفس السطر بيتحدّث وlocal_id المرجّح بيتكتب من جديد (السطر بيقوم بصلح نفسه).
          // ولو حصل تصادم على فهرس تاني (نفس org_id+local_id برقمين مختلفين) نرجع للطريقة القديمة.
          return client.from(name).upsert(rows, { onConflict: "id" }).then(function (u) {
            if (u && u.error) {
              var code = String((u.error && u.error.code) || "");
              var msg = String((u.error && u.error.message) || "");
              if (code === "23505" || /duplicate key/i.test(msg)) {
                return client.from(name).upsert(rows, { onConflict: "org_id,local_id" }).then(function (u2) {
                  if (u2 && u2.error) throw u2.error;
                });
              }
              throw u.error;
            }
          });
        });
      }
      return chain.then(function () {
        rememberIds(name, rows);
        rows.forEach(function (r) { if (cloudId[Number(r.local_id)] == null) cloudId[Number(r.local_id)] = r.id; });
        return syncItems(name, meta, cloudId);
      }).then(function (itemsSynced) {
        if (!failed && itemsSynced !== false) {
          W.lastSyncAt = Date.now();
          W.lastSyncTable = name;
        }
        return !failed && itemsSynced !== false;
      }).catch(function (e) { fail(name, e); return false; });
    });
  }

  // ============ رفع أسطر الأصناف ============
  // هوية السطر = (رقم أبيه السحابي + ترتيبه جوه أبوه). مافيش رقم مركّب مشترك بين فاتورتين.
  function syncItems(name, meta, cloudId) {
    var itemsTable = meta.itemsTable;
    if (!itemsTable) return Promise.resolve(true);
    var client = DATA.client();
    var parentField = meta.itemsParentField || PARENT_OF[itemsTable];
    if (!parentField) return Promise.resolve(true);
    var failed = false;
    function fail(what, err) { failed = true; syncFailed(what, err); }
    var ids = cloudId || {};
    var items = [];
    (meta.local() || []).forEach(function (p) {
      var pUuid = ids[Number(p.id)];
      if (!pUuid) return;                               // أبوه لسه ما اترفعش → نستنى دورته
      var mapped = meta.itemToCloud(p);
      if (!Array.isArray(mapped)) return;
      mapped.forEach(function (row, idx) {
        if (!row) return;
        row.local_id = Number(p.id) * 1000 + (idx + 1);
        row[parentField] = pUuid;
        row.id = detUuid(itemsTable, row.local_id);
        row._pos = pUuid + ":" + (idx + 1);
        items.push(row);
      });
    });
    return orgScoped(client.from(itemsTable).select("id, local_id, " + parentField)).then(function (res) {
      if (res.error) { fail(itemsTable, res.error); return false; }
      var have = res.data || [];
      // لو السطر ده موجود على السحابة في نفس الأب وبنفس ترتيبه → نستخدم رقمه القديم
      var byPos = {}, claimed = {};
      have.forEach(function (r) {
        if (!r || !r[parentField] || r.local_id == null) return;
        byPos[r[parentField] + ":" + (Number(r.local_id) % 1000)] = r.id;
      });
      items.forEach(function (row) {
        var old = !claimed[row._pos] ? byPos[row._pos] : null;
        if (old) { claimed[row._pos] = 1; row.id = old; }
      });
      var seen = seenIds(itemsTable);
      var keep = {};
      items.forEach(function (r) { keep[r.id] = 1; });
      var drop = [];
      have.forEach(function (r) { if (r && !keep[r.id] && seen[r.id]) drop.push(r.id); });
      if (drop.length && !wipeGuard(itemsTable, items.length, have.length)) drop = [];
      if (drop.length && !capDeletes(itemsTable, drop.length, have.length)) drop = [];
      var chain = Promise.resolve();
      if (drop.length) {
        chain = client.from(itemsTable).delete().in("id", drop).then(function (d) {
          if (d && d.error) fail(itemsTable, d.error);
        });
      }
      if (items.length) {
        var payload = items.map(function (r) { delete r._pos; return r; });
        chain = chain.then(function () {
          return client.from(itemsTable).upsert(payload, { onConflict: "id" }).then(function (u) {
            if (u && u.error) throw u.error;
          });
        });
      }
      return chain.then(function () { rememberIds(itemsTable, items); return !failed; })
        .catch(function (e) { fail(itemsTable, e); return false; });
    });

  }

  function push(name) {
    var t = syncOne(name);
    return t.catch(function (e) { syncFailed(name, e); return false; });
  }

  // تحميل كل الجداول إلى الحالة المحلية
  function loadAll() {
    W.idMap = W.idMap || {};
    // 🆕 بناء 118: تعقّب «اكتمال التنزيل» لكل جدول كبير.
    // أي إعادة حساب لرصيد آجل قبل ما جدول الحركة يوصل بتصفّر رصيدًا حقيقيًا
    // (فاتورة مشتريات آجلة تختفي من مستحقات الموردين في المركز المالي) — فبتتمنع.
    W.loadedTables = {};
    // 🧪 بناء 227: الفحوص كانت fire-and-forget ⇒ سباق محتمل مع أول رفع، وسونار
    // كان بيعتبرها Promises غير معالَجة. بننتظرها كلها قبل أي استخدام لعلامات HAS_*.
    var probes = Promise.all([
      probeProductUnit(), // 🆕 نعرف هل عمود unit موجود على السحابة قبل أول رفع أصناف
      probeProductPrices(), // 🆕 بناء 179: هل عمودان «آخر سعر شراء/المتوسط» موجودين قبل أول رفع أصناف
      probeFixedAssetsTable(), // 🆕 مهمة 98: هل جدول fixed_assets اتعمل على السحابة ولا الترحيل لسه ما اتنفّذش
      probeCashierShiftsTable(), // 🧾 بناء 176: هل جدول cashier_shifts اتعمل (ترحيل ٥٤) ولا لسه
      probeCarTripsTable(), // 🚚 بناء 178: هل جدول car_trips اتعمل (ترحيل ٥٥) ولا لسه
      probeChecksTable(), // 🧾 بناء 190: هل جدول checks اتعمل (ترحيل ٦٢) ولا لسه
      probeVoucherRefs(), // 🆕 بناء 184: هل عمودا وسم السند (ref_type/ref_id) على vouchers موجودان (ترحيل ٥٦) ولا لسه
      probePartyTxReceipt(), // 🆕 بناء 199 (بند #15ب): هل أعمدة مصدر السداد على حركات الأطراف موجودة (ترحيل ٦٣) ولا لسه
      probeInvPaid() // 🆕 بناء 204 (بند #2): هل أعمدة المدفوع/الآجل/السطور على الفواتير موجودة (ترحيل ٦٥) ولا لسه
    ]);
    // 🆕 بناء 125 (بند 16): هل جدول messages اتعمل (ترقية ٤٥) ولا لسه على القرص بس.
    // الفحص ده بيحدد وحده ظهور تبويب «الدردشة» — فالترحيل لما يتنفّذ بأمر المالك
    // التبويب يطلع لوحده من نفس اللحظة، وبلا أي تغيير كود. (الجدول **ممنوع** يدخل
    // EAGER/LAZY/لقطة الديسك/النسخة الاحتياطية — قرار المالك: «الدردشة لا تدخل النسخ الاحتياطي».)
    // بنلفّه جوه الوعد اللي تحت (مش fire-and-forget) عشان `applyFeatureGating` اللي
    // بعد loadAll يلاقي العلامة متظبطة فعلًا، فالتبويب يطلع من أول رسم.
    var names = ["customers", "suppliers", "products", "treasury", "accounts",
      "fixed_assets", "cashier_shifts", "car_trips"];
    var eagerLoad = DATA.loadEagerAll ? DATA.loadEagerAll() : null;
    var eagerFallback = eagerLoad ? null : function (n) {
      return orgScoped(DATA.client().from(n).select("*")).order("created_at").then(function (r) { return [n, r.error ? [] : (r.data || [])]; });
    };
    return probes.then(function () {
      return eagerLoad || Promise.all(names.map(eagerFallback));
    }).then(function (all) {
      var arr = {};
      if (eagerLoad && all) { names.forEach(function (n) { arr[n] = all[n] || []; }); }
      if (!eagerLoad && all) { all.forEach(function (pair) { arr[pair[0]] = pair[1]; }); }
      names.forEach(function (n) {
        var rows = arr[n] || [];
        var pairs = [];
        rows.forEach(function (r) {
          var loc = META[n].fromCloud(r);
          if (loc && loc.id != null) pairs.push({ loc: loc, raw: r });
          // تسجيل الخريطة local_id -> uuid للسطور الموجودة فعلًا
          if (r.local_id != null) { W.idMap[n] = W.idMap[n] || {}; W.idMap[n][Number(r.local_id)] = r.id; }
        });
        // 🆕 ترحيل ٣٤: سطران الخزنة بنفس الرقم المحلي = نفس الحساب اتكرّر على السحابة.
        // نعرض واحد منهم بس (اللي عليه local_id صريح) — ما نرقمش التاني من جديد،
        // لأن الترقيم الجديد كان بيولّد سطرًا ثالثًا في كل جلسة (ده كان بيت التكرار).
        if (n === "treasury") pairs = dedupeTreasury(pairs);
        assignLocalIds(n, pairs.map(function (p) { return p.loc; }));
        W[n] = pairs.map(function (p) { return p.loc; });
      });
      // ⚡ بناء 212: الدردشة اتشالت من الواجهة والكود التشغيلي — مفيش فحص لجدول
      // الرسايل عند الدخول (كان نداء شبكة إضافي في كل فتح بلا استخدام).
      return loadLazyAll().then(function () { return true; });
    });
  }

  // 🆕 ترحيل ٣٤: إزالة تكرار أسطر الخزينة عند القراءة.
  // pairs = [{ loc: السطر المحلي, raw: سطر السحابة }] — بنفضّل السطر اللي عليه local_id صريح.
  function dedupeTreasury(pairs) {
    var byId = {}, kept = [];
    (pairs || []).forEach(function (p) {
      var k = Number(p.loc.id);
      var prev = byId[k];
      if (!prev) { byId[k] = p; kept.push(p); return; }
      var curExplicit = prev.raw && p.raw && p.raw.local_id != null && prev.raw.local_id == null;
      if (curExplicit) {
        var at = kept.indexOf(prev);
        if (at >= 0) kept[at] = p;
        byId[k] = p;
      }
    });
    return kept;
  }

  // 🆕 بناء ٣٥/115: تنقية سجل الحضور عند القراءة.
  // 1) سطران بنفس الرقم المحلي = نفس السطر اتكرّر ⇒ نفضّل اللي عليه local_id صريح (نفس منطق الخزنة).
  // 2) سطران لنفس الموظف في نفس اليوم (جهازان سجّلوا برقمين مختلفين قبل مزامنة بعضهما) ⇒
  //    نبقي رقمهم الأصغر (ثبات) ونلمّ الأوقات الناقصة من التاني — ما نرميش بيانات سجلت فعلًا.
  function dedupeAttendance(pairs) {
    var kept = dedupeTreasury(pairs);
    var map = {}, order = [];
    (kept || []).forEach(function (p) {
      if (!p || p.loc == null) return;
      var k = Number(p.loc.employeeId) + "|" + String(p.loc.date || "").slice(0, 10);
      if (!map[k]) { map[k] = p; order.push(k); return; }
      var cur = map[k];
      var base = Number(cur.loc.id) <= Number(p.loc.id) ? cur : p;
      var rest = base === cur ? p : cur;
      ["checkIn", "checkOut"].forEach(function (f) {
        if (!base.loc[f] && rest.loc[f]) base.loc[f] = rest.loc[f];
      });
      if (base.loc.status === "absent" && rest.loc.status && rest.loc.status !== "absent") {
        base.loc.status = rest.loc.status;
      }
      map[k] = base;
    });
    return order.map(function (k) { return map[k]; });
  }

  function assignLocalIds(table, arr) {
    // السطور بدون رقم محلي (فقط إن وجدت) تُرقّم وتحفظ ترقيمها
    var ids = arr.map(function (r) { return Number(r.id); }).filter(function (x) { return !Number.isNaN(x) && x > 0; });
    var max = ids.length ? Math.max.apply(null, ids) : 0;
    arr.forEach(function (r) {
      if (r.id == null || Number.isNaN(Number(r.id)) || Number(r.id) <= 0) {
        max++;
        r.id = max;
        W.pendingLocalIds = W.pendingLocalIds || {};
        W.pendingLocalIds[table] = W.pendingLocalIds[table] || {};
        W.pendingLocalIds[table][max] = true;
      }
    });
  }

  function loadLazyAll() {
    var lazy = ["sales", "purchases", "supplier_txs", "customer_txs", "vouchers", "journal_entries",
      "sale_returns", "purchase_returns"];
    var tasks = lazy.map(function (n) {
      return DATA.loadLazy(n).then(function (rows) {
        // 🆕 بناء 118: الجدول ده وصلت فعلًا ⇒ إعادة الحساب بقت مسموحة له
        W.loadedTables = W.loadedTables || {}; W.loadedTables[n] = true;
        rememberIds(n, rows);                            // عشان الحارس يعرف الجهاز ده شاف إيه
        if (n === "journal_entries") {
          W.loadedTables["journal_lines"] = true;
          return DATA.loadLazy("journal_lines").then(function (lines) {
            rememberIds("journal_lines", lines);
            W.journalEntries = (rows || []).map(function (r) { return META.journal_entries.fromCloud(r); });
            // إلحاق الأسطر
            var byEntry = {};
            (lines || []).forEach(function (l) { byEntry[l.entry_id] = byEntry[l.entry_id] || []; byEntry[l.entry_id].push(l); });
            W.journalEntries.forEach(function (en) {
              var eid = (W.idMap.journal_entries || {})[Number(en.id)];
              bySorted(byEntry[eid] || []).forEach(function (l) { en.lines.push(META.journal_entries.itemFromCloud(l)); });
            });
            // 🆕 بناء 134: إجمالي القيد (مدين/دائن) مش عمود في journal_entries — بيطلع من أسطره.
            // من غير الجمع ده أي قيد (يدوي أو متترحّل من فاتورة) بيبان «0.00» في جدول
            // «القيود اليومية» بعد أي إعادة تشغيل، لأن fromCloud بيحط debit/credit = صفر
            // لحد ما تلحق الأسطر. الناحية دي قراءة بس — مافيش أي كتابة على السحابة.
            W.journalEntries.forEach(function (en) {
              var d = 0, c = 0;
              (en.lines || []).forEach(function (l) { d += Number(l.debit) || 0; c += Number(l.credit) || 0; });
              en.debit = Math.round(d * 100) / 100;
              en.credit = Math.round(c * 100) / 100;
            });
            return;
          });
        }
        var out = (rows || []).map(function (r) { return META[n].fromCloud(r); }).filter(function (x) { return x.id != null; });
        W[n] = out;
      });
    });
    return Promise.all(tasks).then(function () {
      // إلحاق الأصناف بالفواتير والمرتجعات — بالرقم السحابي الحقيقي للأب (مش مشتق)
      return Promise.all(["sales", "purchases", "sale_returns", "purchase_returns"].map(function (n) {
        var itemsTable = META[n].itemsTable;
        var parentField = PARENT_OF[itemsTable];
        return DATA.loadLazy(itemsTable).then(function (rows) {
          rememberIds(itemsTable, rows);
          var arr = W[n] || [];
          var byParent = {};
          (rows || []).forEach(function (r) {
            var parentId = r[parentField];
            byParent[parentId] = byParent[parentId] || [];
            byParent[parentId].push(r);
          });
          arr.forEach(function (doc) {
            var pid = (W.idMap[n] || {})[Number(doc.id)] || detUuid(n, doc.id);
            bySorted(byParent[pid] || []).forEach(function (it) {
              doc.items.push(META[n].itemFromCloud(it));
            });
          });
        }).catch(function (e) { syncFailed(itemsTable, e); });
      }));
    });
  }

  // ترتيب أسطر الصنف زي ما هي في الفاتورة الأصلية (الأقدم الأول)
  function bySorted(rows) {
    return rows.slice().sort(function (a, b) {
      return (Number(a.local_id) % 1000) - (Number(b.local_id) % 1000);
    });
  }

  // 🔢 تسلسل أرقام الفواتير لكل شركة (على السحابة) — الدوال مشتقة org من التوكن (current_org())
  function _sb() { return (DATA.client && DATA.client()) || null; }
  function _online() { return !!(DATA.isOnline && DATA.isOnline()) && !!_sb(); }

  function bumpInvoiceSeq(kind, value) {
    if (!_online()) return Promise.resolve();
    return Promise.resolve(_sb().rpc("mizan_bump_invoice_seq", { p_kind: String(kind), p_value: Number(value) || 0 }))
      .then(function (r) { if (r && r.error) console.warn("bumpInvoiceSeq", r.error.message); })
      .catch(function (e) { console.warn("bumpInvoiceSeq", e && e.message); });
  }
  function getInvoiceSeq() {
    if (!_online()) return Promise.resolve(null);
    return Promise.resolve(_sb().rpc("mizan_get_invoice_seq"))
      .then(function (r) {
        if (r && r.error) { console.warn("getInvoiceSeq", r.error.message); return null; }
        var out = {}; (r.data || []).forEach(function (row) { out[row.kind] = Number(row.last_value) || 0; });
        return out;
      }).catch(function () { return null; });
  }
  function nextInvoiceNo(kind) {
    if (!_online()) return Promise.resolve(null);
    return Promise.resolve(_sb().rpc("mizan_next_invoice_no", { p_kind: String(kind) }))
      .then(function (r) {
        if (r && r.error) { console.warn("nextInvoiceNo", r.error.message); return null; }
        return Number(r.data) || null;
      }).catch(function () { return null; });
  }

  // 🛡 بناء 119: الرصيد الافتتاحي للخزينة — كتابة مباشرة لسطره هو فقط، ثم قراءة للتأكيد.
  // ليه دالة مستقلة؟ لأن الرفع الجماعي (syncOne) بيبعت الجدول كامل من لقطة الجهاز،
  // فأي جهاز تاني لسه ماسك رقم قديم كان بيرجع يكتبه فوق تعديل المستخدم
  // (شكوى المالك: يخلي البنك صفر → «تم الحفظ» → يرجع 50,000).
  // بنستخدم نفس هوية السطر (detUuid + local_id + org_id) عشان upsert يحدّث سطره هو
  // وما ينشأش سطر تاني، وبعدين بنقري العمود من السحابة نفسها: لو المرجّع غير الرقم
  // ⇒ ok:false والواجهة ترجّع القيمة القديمة وتقول للمستخدم بصراحة (ممنوع «تم الحفظ» كاذبة).
  function setTreasuryOpening(row, value) {
    if (!_online()) return Promise.resolve({ ok: true, skipped: true });
    if (!row || !DATA.orgId()) return Promise.resolve({ ok: false, error: "لا يوجد حساب متصل بالسحابة" });
    var amt = Math.round((Number(value) || 0) * 100) / 100;
    var payload = META.treasury.toCloud(row);
    payload.opening_balance = amt;
    return Promise.resolve(_sb().from("treasury").upsert([payload], { onConflict: "id" }))
      .then(function (u) {
        if (u && u.error) return { ok: false, error: (u.error.message || String(u.error)) };
        return Promise.resolve(_sb().from("treasury")
          .select("local_id, opening_balance")
          .eq("org_id", DATA.orgId()).eq("local_id", Number(row.id)))
          .then(function (s) {
            if (s && s.error) return { ok: false, error: (s.error.message || String(s.error)) };
            var rows = (s && s.data) || [];
            if (!rows.length) return { ok: false, error: "السحابة ما رجّعتش السطر" };
            for (var i = 0; i < rows.length; i++) {
              if (Math.abs(Number(rows[i].opening_balance) - amt) > 0.001) {
                return { ok: false, error: "السحابة رجّعت " + Number(rows[i].opening_balance) + " بدل " + amt };
              }
            }
            return { ok: true, value: amt };
          });
      })
      .catch(function (e) { return { ok: false, error: (e && e.message) || String(e) }; });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 💬 بناء 125 — الدردشة الداخلية (بند 16)
  //
  // القاعدة الذهبية هنا: **البوابة كلها في السحابة (RLS)**، والكود ده عميل بس.
  //   · «محدش يقدر يشوف رسايل مش مبعوته له» → سياسة SELECT على سطر الرسالة نفسها.
  //   · «محدش يقدر يشوف عضوات شركة مش شركته» → mizan_chat_peers بتطبّق نفس الميزان.
  //   يعني حتى لو واحد عدّل الكود في الكونسول، الشبكة نفسها ما ترجّعش حاجة ملكوش.
  //
  // كمان: الرسايل **ما تدخلش** أي تخزين محلي ولا لقطة ديسك ولا نسخة احتياطية
  // (قرار المالك: «الدردشة لا تدخل النسخ الاحتياطي») — عشان كده مافيش هنا كتابة
  // على W أو localStorage، وكل حاجة بتتقرأ من السحابة وقت ما الشاشة مفتوحة.
  //
  // ليه polling مش Realtime؟ مقياس 02/10: صفر جدول في publication
  // `supabase_realtime` ⇒ الاشتراك اللحظي محتاج تنفيذ سحابي تاني (مستني أمر المالك).
  // ═══════════════════════════════════════════════════════════════════════

  // البداية = true: لحد ما الفحص يثبت إن الجدول اتعمل، الواجهة ما تظهرش أي حاجة
  // (أمان كاذب أحسن من شاشة فاضية بتوحي إن الدردشة اشتغلت).
  var CHAT_TABLE_MISSING = true;
  var CHAT_LAST_ERROR = "";
  var UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  function isUuid(v) { return !!v && UUID_RE.test(String(v)); }
  function chatFail(err) {
    CHAT_LAST_ERROR = String((err && (err.message || err.code)) || err || "");
  }
  function chatMeId() {
    var p = null;
    try { p = (DATA.me && DATA.me()) || (DATA.getProfile && DATA.getProfile()); } catch (e) { p = null; }
    return (p && p.id) || null;
  }
  // «الجدول/الدالة مش موجودين» بس هي اللي بتقفل الدردشة بهدوء — أي زعلة تانية بتظهر.
  function isChatNotDeployedError(err) {
    var msg = String((err && (err.message || err.code || err.details)) || err || "");
    return /42P01|PGRST205|PGRST202|42883|does not exist|not found|schema cache/i.test(msg);
  }
  function probeChatTable() {
    if (!_online() || !_sb()) return Promise.resolve(false);
    return Promise.resolve()
      .then(function () { return _sb().from("messages").select("id").limit(1); })
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) CHAT_TABLE_MISSING = true;
          else { CHAT_TABLE_MISSING = false; chatFail(r.error); }
          return false;
        }
        CHAT_TABLE_MISSING = false; CHAT_LAST_ERROR = ""; return true;
      })
      .catch(function (e) {
        if (isChatNotDeployedError(e)) CHAT_TABLE_MISSING = true;
        else { CHAT_TABLE_MISSING = false; chatFail(e); }
        return false;
      });
  }
  function chatReady() { return _online() && !!_sb() && !CHAT_TABLE_MISSING; }
  function chatNotDeployed() { return CHAT_TABLE_MISSING; }
  function chatLastError() { return CHAT_LAST_ERROR; }

  // مخاطَبون = اللي بيقبلونّي في ميزان الخصوصية (من نفس دوال peer على السحابة)
  function chatPeers() {
    if (!chatReady()) return Promise.resolve({ ok: true, missing: true, peers: [] });
    return Promise.resolve(_sb().rpc("mizan_chat_peers"))
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) { CHAT_TABLE_MISSING = true; return { ok: true, missing: true, peers: [] }; }
          chatFail(r.error); return { ok: false, error: CHAT_LAST_ERROR, peers: [] };
        }
        return { ok: true, peers: r.data || [] };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: CHAT_LAST_ERROR, peers: [] }; });
  }

  // محادثة واحدة: رسايلنا أنا وصديقي بس — والسحابة ما ترجّعش غير كده أصلًا.
  function chatThread(peerId, limit) {
    if (!chatReady()) return Promise.resolve({ ok: true, missing: true, rows: [] });
    var me = chatMeId();
    if (!isUuid(me) || !isUuid(peerId)) return Promise.resolve({ ok: false, error: "حساب غير مكتمل", rows: [] });
    var n = Math.max(1, Math.min(500, Number(limit) || 200));
    var filt = "and(from_user.eq." + me + ",to_user.eq." + peerId + ")," +
               "and(from_user.eq." + peerId + ",to_user.eq." + me + ")";
    return Promise.resolve(_sb().from("messages").select("*").or(filt)
      .order("created_at", { ascending: false }).limit(n))
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) { CHAT_TABLE_MISSING = true; return { ok: true, missing: true, rows: [] }; }
          chatFail(r.error); return { ok: false, error: CHAT_LAST_ERROR, rows: [] };
        }
        return { ok: true, rows: (r.data || []).slice().reverse() };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: CHAT_LAST_ERROR, rows: [] }; });
  }

  // كل الرسائل اللي لسه ما قريتهاش — للعدّاد والتجميع لكل مخاطَب
  function chatUnread() {
    if (!chatReady()) return Promise.resolve({ ok: true, missing: true, rows: [] });
    var me = chatMeId();
    if (!isUuid(me)) return Promise.resolve({ ok: false, error: "حساب غير مكتمل", rows: [] });
    return Promise.resolve(_sb().from("messages").select("id,from_user,created_at")
      .eq("to_user", me).is("read_at", null).limit(500))
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) { CHAT_TABLE_MISSING = true; return { ok: true, missing: true, rows: [] }; }
          chatFail(r.error); return { ok: false, error: CHAT_LAST_ERROR, rows: [] };
        }
        return { ok: true, rows: r.data || [] };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: CHAT_LAST_ERROR, rows: [] }; });
  }

  // تعليم «مقروءة» بالدالة (ممنوع UPDATE على الجدول) — والحد في السحابة: أنا المستلم.
  function chatMarkRead(ids) {
    if (!chatReady()) return Promise.resolve({ ok: true, missing: true });
    var list = (ids || []).filter(isUuid).slice(0, 100);
    if (!list.length) return Promise.resolve({ ok: true, sent: 0 });
    var sbk = _sb();
    return list.reduce(function (chain, id) {
      return chain.then(function () {
        return Promise.resolve(sbk.rpc("mizan_chat_read", { p_id: id }))
          .then(function (r) {
            if (r && r.error && !isChatNotDeployedError(r.error)) chatFail(r.error);
            if (r && r.error && isChatNotDeployedError(r.error)) CHAT_TABLE_MISSING = true;
          }).catch(function (e) { chatFail(e); });
      });
    }, Promise.resolve()).then(function () { return { ok: true, sent: list.length }; });
  }

  // الإرسال: org_id مش بعتة هنا — العمود ليه default current_org() في السحابة،
  // وسياسة INSERT بترفض أي قيمة تانية، فمسار التزوير مقفول من الطرفين.
  function chatSend(peerId, body, isPrivate) {
    if (!chatReady()) return Promise.resolve({ ok: false, missing: true, error: "الدردشة لسه مش متاحة" });
    var me = chatMeId();
    if (!isUuid(me) || !isUuid(peerId)) return Promise.resolve({ ok: false, error: "حساب غير مكتمل" });
    var txt = String(body == null ? "" : body).trimEnd();
    if (!txt.trim()) return Promise.resolve({ ok: false, error: "اكتب الرسالة الأول" });
    if (txt.length > 4000) return Promise.resolve({ ok: false, error: "الرسالة أطول من المسموح" });
    return Promise.resolve(_sb().from("messages").insert([{
      from_user: me, to_user: peerId, body: txt, is_private: !!isPrivate
    }]).select())
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) { CHAT_TABLE_MISSING = true; return { ok: false, missing: true, error: "الدردشة لسه مش متاحة على السحابة" }; }
          // رفض RLS (مش مسموح تبايع الحد ده) = رسالة ودّية مش تشخيص تقني
          chatFail(r.error);
          return { ok: false, error: "الرسالة ما وصلتش — اتأكد إنك تبايع حساب من شركتك" };
        }
        return { ok: true, row: (r.data && r.data[0]) || null };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: "الرسالة ما وصلتش" }; });
  }

  // سويتش المالك: أصحاب المؤسسات (افتراضي) أو كل المستخدمين
  function chatSetScope(scope) {
    if (!chatReady()) return Promise.resolve({ ok: false, missing: true, error: "الدردشة لسه مش متاحة" });
    var s = (scope === "all") ? "all" : "owners";
    return Promise.resolve(_sb().rpc("mizan_chat_set_scope", { p_scope: s }))
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) { CHAT_TABLE_MISSING = true; return { ok: false, missing: true }; }
          chatFail(r.error); return { ok: false, error: CHAT_LAST_ERROR };
        }
        return { ok: true, scope: r.data || s };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: CHAT_LAST_ERROR }; });
  }

  // ═════════ 🆕 بناء 136 — الوصول اللحظي (ترقية ٤٨) + بث المالك (ترقية ٤٧) ═════════

  /* 🪤 **الدرس اللي اتقيد بالقياس على السلك (04/10):** في realtime-js 2.117.1 مافيش
     overload لـ `on(type, cb)` — الوسيط التاني **دايمًا** هو الفلتر. فـ
       `.on("postgres_changes", cb)`   ⇒ binding.callback = undefined + الدالة بتتبعت كـ filter
     والنتيجة `CHANNEL_ERROR: mismatch between server and client bindings for postgres changes`
     من **العميل** (مش من القاعدة)، وأي رسالة `system` بتقع بـ `TypeError: bind.callback is not a function`.
     ⇒ الصيغة الصح اللي تحت: **فلتر صريح** في `on` + نفس الفلتر في `config` عشان الاتنين يطابقوا
     ردّ الخادم (اللي بيرجع `{event:'INSERT', schema:'public', table:'messages', filter:'{..}'}).
     أي تغيير هنا لازم يتعاير على السلك قبل النشر (spike48d.js / wire_probe_48.js). */
  var CHAT_RT_FILTER = { event: "INSERT", schema: "public", table: "messages" };
  var CHAT_RT = { ch: null, key: "", status: "off", tries: 0 };

  function chatRealtimeStatus() { return CHAT_RT.status; }

  // اشتراك واحد لكل جلسة: «INSERT على messages» — والـ RLS على السحابة بتفلتر قبل ما يوصّل أي سطر،
  // فمافيش هنا أي فلترة «رحمة»: اللي يوصلني هو اللي أنا فيه to_user أو from_user بس.
  function chatSubscribe(onRow, onStatus) {
    if (!chatReady()) return false;
    var me = chatMeId();
    if (!isUuid(me)) return false;
    if (CHAT_RT.ch && CHAT_RT.key === String(me)) {          // نفس الجلسة ⇒ نعيد استخدام القناة
      if (onStatus) { try { onStatus(CHAT_RT.status); } catch (e) { } }
      return true;
    }
    chatUnsubscribe();
    var sbk = _sb();
    if (!sbk || typeof sbk.channel !== "function") return false;
    try {
      var ch = sbk.channel("mizan-chat-messages:" + me, {
        config: { postgres_changes: [CHAT_RT_FILTER] }
      });
      // ⚠️ الوسيط التاني = الفلتر، والتالت = الدالة (ممنوع `.on(type, cb)`)
      ch.on("postgres_changes", CHAT_RT_FILTER, function (payload) {
        var row = payload && (payload.new || payload.record);
        if (row && typeof row === "object" && row.id) { try { onRow && onRow(row); } catch (e) { } }
      });
      ch.subscribe(function (status) {
        CHAT_RT.status = String(status || "unknown");
        if (onStatus) { try { onStatus(CHAT_RT.status); } catch (e) { } }
      });
      CHAT_RT.ch = ch; CHAT_RT.key = String(me);
      return true;
    } catch (e) {
      chatFail(e);
      CHAT_RT.status = "error";
      return false;
    }
  }

  function chatUnsubscribe() {
    if (!CHAT_RT.ch) { CHAT_RT.status = "off"; return; }
    var ch = CHAT_RT.ch; CHAT_RT.ch = null; CHAT_RT.key = ""; CHAT_RT.status = "off";
    try {
      if (typeof ch.unsubscribe === "function") ch.unsubscribe();
      var sbk = _sb();
      if (sbk && typeof sbk.removeChannel === "function") sbk.removeChannel(ch);
    } catch (e) { }
  }

  // بث المالك (ترقية ٤٧): دالة على السحابة بترفض أي حساب مش المالك العام، وبتفتح سطر مستقل
  // لكل مستلم في نفس الدائرة — فميزان الخصوصية ما بيتلمسش ومافيش أي رسالة «للكل» بتخترق حد.
  function chatBroadcast(body, isPrivate) {
    if (!chatReady()) return Promise.resolve({ ok: false, missing: true, error: "الدردشة لسه مش متاحة" });
    var txt = String(body == null ? "" : body).trim();
    if (!txt) return Promise.resolve({ ok: false, error: "اكتب الرسالة الأول" });
    if (txt.length > 4000) return Promise.resolve({ ok: false, error: "الرسالة أطول من المسموح" });
    return Promise.resolve(_sb().rpc("mizan_chat_broadcast", { p_body: txt, p_private: !!isPrivate }))
      .then(function (r) {
        if (r && r.error) {
          if (isChatNotDeployedError(r.error)) {
            return { ok: false, missing: true, error: "البث لسه مش متاح على السحابة" };
          }
          // رسالة ودّية: رفض السحابة (مش المالك / الدائرة فاضية) بيتحوّل لكلمة تفيد المستخدم
          var m = String(r.error.message || "");
          var friendly = /مافيش مخاطَب/.test(m) ? "مافيش حد في الدائرة دي دلوقتي — قلّب العرض أو ابعت لشخص"
            : /رسالة المالك/.test(m) ? "البث ده لحساب المالك — ابعت رسالتك لشخص واحد"
              : /أطول من المسموح|اكتب الرسالة/.test(m) ? m
                : "الرسالة ما وصلتش — جرّب تاني";
          chatFail(r.error);
          return { ok: false, error: friendly, raw: m };
        }
        return { ok: true, sent: Number(r.data) || 0 };
      })
      .catch(function (e) { chatFail(e); return { ok: false, error: "الرسالة ما وصلتش — جرّب تاني" }; });
  }

  window.CLOUD = {
    push: push,
    chatPeers: chatPeers,
    chatThread: chatThread,
    chatUnread: chatUnread,
    chatMarkRead: chatMarkRead,
    chatSend: chatSend,
    chatSetScope: chatSetScope,
    chatReady: chatReady,
    chatNotDeployed: chatNotDeployed,
    chatLastError: chatLastError,
    probeChatTable: probeChatTable,
    chatMyId: chatMeId,
    // 🆕 بناء 136
    chatSubscribe: chatSubscribe,
    chatUnsubscribe: chatUnsubscribe,
    chatRealtimeStatus: chatRealtimeStatus,
    chatBroadcast: chatBroadcast,
    setTreasuryOpening: setTreasuryOpening,
    pushRows: pushRows,
    loadAll: loadAll,
    detUuid: detUuid,
    bumpInvoiceSeq: bumpInvoiceSeq,
    getInvoiceSeq: getInvoiceSeq,
    nextInvoiceNo: nextInvoiceNo,
    state: W,
    META: META,
    needsSeed: function () {
      return Object.keys(W.pendingLocalIds || {}).length > 0;
    }
  };
})();