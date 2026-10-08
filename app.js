/* ================================================================
   برنامج ميزان - نسخة الويب | صفحة دليل العملاء
   By Adel Samir - واتس: 01002655282
   نسخة تجريبية: البيانات محفوظة في متصفحك (localStorage)
   ================================================================ */

(function () {
  "use strict";

  // رقم الإصدار المعروض للمستخدم — مصدره window.MIZAN_VERSION في index.html (تعديل هناك بس)
  const APP_VERSION = window.MIZAN_VERSION || "1.4.1";
  /* 🔴 07/10 أمر المالك الحرفي: «و كل ما تحدث تغير ال V للرقم الجديد» ⇒ الختم المعروض
     **مش** رقم المنتج لحاله، ده `window.mizanVerLabel()` بتاعة index.html (رقم المنتج +
     عدّاد النشر) — وديماً بقراءة حيّة وقت الرسم، فلو السكربت اتأخر أو اتغيّر المصدر
     الشاشة بتكتب الرقم الصحيح لنفس البناء اللي اتحمّل. المرجع الوحيد للزيادة هو
     `window.MIZAN_BUILD` في index.html ⇒ كل نشر بيشيل رقمه معاه لوحده. */
  const verLabel = () =>
    (typeof window.mizanVerLabel === "function") ? window.mizanVerLabel() : APP_VERSION;

  /* ================== التخزين ================== */
  const LS_CUSTOMERS = "mizan_customers_v1";
  const LS_TXS = "mizan_txs_v1";
  const LS_PRODUCTS = "mizan_products_v1";
  const LS_ACTIVITY = "mizan_activity_v1";
  const LS_SALES = "mizan_sales_v1";
  const LS_TREASURY = "mizan_treasury_v1";
  const LS_SUPPLIERS = "mizan_suppliers_v1";
  const LS_SUP_TXS = "mizan_sup_txs_v1";
  const LS_PURCHASES = "mizan_purchases_v1";
  const LS_ACCOUNTS = "mizan_accounts_v1";
  const LS_JOURNAL = "mizan_journal_v1";
  const LS_USERS = "mizan_users_v1";
  const LS_VOUCHERS = "mizan_vouchers_v1";
  // المرتجعات (بناء 108): جدول لكل نوع — وأصناف كل مرتجع محفوظة جواه (items).
  const LS_SALE_RETURNS = "mizan_sale_returns_v1";
  const LS_PURCHASE_RETURNS = "mizan_purchase_returns_v1";
  const LS_SETTINGS = "mizan_settings_v1";
  // 🆕 بناء 115: الحضور والانصراف
  const LS_EMPLOYEES = "mizan_employees_v1";
  const LS_ATTENDANCE = "mizan_attendance_v1";
  const LS_ATT_SETTINGS = "mizan_att_settings_v1";
  // 🆕 مهمة 98: سجل الأصول الثابتة (غير المتداولة / غير الملموسة)
  const LS_FIXED_ASSETS = "mizan_fixed_assets_v1";
  /* 🧮 بناء 145 → 146: ورق «الجرد بالباركود» على جهاز العميل بس (مافيش جدول سحابي ومافيش ترقية).
     ⚠️ المفتاح **بره** `LS_ALL_KEYS` عندنا عمدًا، والسبب مقاس حيًّا (طلب المالك 06/10 ≈23:50:
     «مش بيحفظ ورقة الجرد»): `guardOrgSwitch()` بينادي `wipeLocalTables()` اللي بتمسح **كل**
     مفتاح في `LS_ALL_KEYS`، و`showLogin()` بتمسح ختم الحالة (`LS_STATE_ORG`) ⇒ أي **خروج ثم
     دخول لنفس الشركة** كان بيشيل الورق المحفوظ («حفظتها ولقيتها راحت»).
     العزل اللي كان سبب المسح ده بقى متحقّق **بالمفتاح نفسه**: كل شركة ليها مفتاح
     `mizan_sc_sheets_v1:<orgId>` ⇒ ورق شركة ما بيبانشش في شركة تانية أبدًا، ومش محتاج
    مسحه عند التبديل. المنطق كله في `scOrgKey`/`scSheetsRead`/`scSheetsWrite`. */
  const LS_STOCK_SHEETS = "mizan_sc_sheets_v1";
  // كل مفاتيح البيانات المحلية (مشتركة بين كل الحسابات في نفس المتصفح)
  const LS_ALL_KEYS = [
    LS_CUSTOMERS, LS_TXS, LS_PRODUCTS, LS_ACTIVITY, LS_SALES, LS_TREASURY,
    LS_SUPPLIERS, LS_SUP_TXS, LS_PURCHASES, LS_ACCOUNTS, LS_JOURNAL,
    LS_USERS, LS_VOUCHERS, LS_SALE_RETURNS, LS_PURCHASE_RETURNS, LS_SETTINGS,
    LS_EMPLOYEES, LS_ATTENDANCE, LS_ATT_SETTINGS, LS_FIXED_ASSETS
  ];
  // 🛡 عزل الشركات: أي مفتاح آخر كتبته بيانات شركة معينة
  // (لو دخل حساب من شركة تانية → البيانات القديمة تُمسح قبل التحميل)
  const LS_SRC_ORG = "mizan_src_org";
  // 🆕 بناء 119: «الملكية» الفعلية للحالة المحلية الحالية — مين كتب اللي في المتصفح ده.
  // بتتدمغ فقط داخل جلسة سحابية بعد الدمج، فأي حالة مجهولة المصدر (وضع تجريبي،
  // لقطة ديسك، أو جهاز كان شغال لحساب تاني) تتمسح قبل ما شركة جديدة تسحب بياناتها.
  const LS_STATE_ORG = "mizan_state_org_v1";

  // 🛡 حالة وجود مفاتيح localStorage لحظة بداية الإقلاع (قبل loadData).
  // تُستخدم في loadFromLocalDisk للتمييز بين "origin جديد/كاش اتمسح"
  // (المفتاح كان غايب → البيانات الحالية seed → يُفضَّل استرجاع الديسك)
  // وبين "بيانات محلية حقيقية" (المفتاح كان موجود → لا ندهسها بديسك أقدم).
  let bootLsPresent = {};

  const TAX = { enabled: true, rate: 0.14 };
  function getTaxPercent() {
    return Math.round((TAX.rate || 0) * 100);
  }
  function updatePosTaxUI() {
    const en = Boolean(TAX.enabled);
    const pct = getTaxPercent();
    const thPrice = $("#thPosPrice");
    if (thPrice) thPrice.textContent = en ? "السعر (قبل الضريبة)" : "السعر";
    const thTax = $("#thPosTax");
    if (thTax) {
      thTax.style.display = en ? "" : "none";
      thTax.classList.toggle("tax-hidden", !en);
      thTax.textContent = en ? ("الضريبة (" + pct + "%)") : "";
    }
    const thTotal = $("#thPosTotal");
    if (thTotal) thTotal.textContent = en ? "الإجمالي شامل الضريبة" : "الإجمالي";
    const lblTax = $("#lblPosTax");
    if (lblTax) {
      lblTax.style.display = en ? "" : "none";
      lblTax.hidden = !en;
    }
    const thPPPrice = $("#thPPPrice");
    if (thPPPrice) thPPPrice.textContent = en ? "السعر (قبل الضريبة)" : "السعر";
    const thPPTax = $("#thPPTax");
    if (thPPTax) {
      thPPTax.style.display = en ? "" : "none";
      thPPTax.classList.toggle("tax-hidden", !en);
      thPPTax.textContent = en ? ("الضريبة (" + pct + "%)") : "";
    }
    const thPPTotal = $("#thPPTotal");
    if (thPPTotal) thPPTotal.textContent = en ? "الإجمالي شامل الضريبة" : "الإجمالي";
    const lblPPTax = $("#lblPPTax");
    if (lblPPTax) {
      lblPPTax.style.display = en ? "" : "none";
      lblPPTax.hidden = !en;
    }
  }
  function applyTaxSettings(enabled, rawRate) {
    TAX.enabled = Boolean(enabled);
    const r = parseFloat(rawRate) || 0;
    TAX.rate = r > 1 ? r / 100 : (r > 0 ? r : 0);
    settings.taxEnabled = TAX.enabled;
    settings.taxRate = TAX.rate;
    saveSettings();
    updatePosTaxUI();
    if (typeof posRecalc === "function") posRecalc();
    if (typeof renderPosItems === "function") renderPosItems();
    if (typeof ppRecalc === "function") ppRecalc();
    if (typeof renderPPItems === "function") renderPPItems();
  }

  /* ================== البيانات التجريبية ================== */
  const seedCustomers = [
    {
      id: 1, code: "1", nameAr: "العميل النقدي (كاش)",
      phone: "", secondaryPhone: "", walletPhone: "", address: "", notes: "عميل نقدي محمي بالنظام",
      openingBalance: 0, currentBalance: 0, protected: true
    },
    {
      id: 2, code: "CUST-0001", nameAr: "أحمد محمد السيد",
      phone: "01000112233", secondaryPhone: "", walletPhone: "01009998877",
      address: "جسر السويس - القاهرة", notes: "",
      openingBalance: 2500, currentBalance: 2000, protected: false
    },
    {
      id: 3, code: "CUST-0002", nameAr: "شركة النور للتجارة",
      phone: "01123456789", secondaryPhone: "01011111111", walletPhone: "",
      address: "العباسية - القاهرة", notes: "حساب الشركة",
      openingBalance: 0, currentBalance: 0, protected: false
    },
    {
      id: 4, code: "CUST-0003", nameAr: "مصطفى عبد الله",
      phone: "01234567890", secondaryPhone: "", walletPhone: "",
      address: "مدينة نصر - القاهرة", notes: "",
      openingBalance: 1250.75, currentBalance: 1250.75, protected: false
    }
  ];

  const seedTxs = [
    { id: 1, customerId: 2, date: "2026-08-01", desc: "رصيد افتتاحي (أول المدة)", debit: 2500, credit: 0 },
    { id: 2, customerId: 2, date: "2026-08-25", desc: "تحصيل دفعة نقداً من حساب العميل", debit: 0, credit: 500 },
    { id: 3, customerId: 4, date: "2026-08-01", desc: "رصيد افتتاحي (أول المدة)", debit: 1250.75, credit: 0 }
  ];

  const seedProducts = [
    { id: 1, code: "PRD-001", barcode: "6252025001231", nameAr: "لبن جهينة 1 لتر", nameEn: "Juhayna Milk 1L", category: "ألبان", unit: "عبوة", defaultWarehouse: "المخزن الرئيسي", purchasePrice: 32, weightedAvgCost: 32, salePrice: 37, discountPercent: 0, discountStart: "", discountEnd: "", qty: 120, reorder: 50, isActive: true },
    { id: 2, code: "PRD-002", barcode: "6223002001534", nameAr: "عيش فينو", nameEn: "Fino Bread", category: "مخبوزات", unit: "حبة", defaultWarehouse: "المخزن الرئيسي", purchasePrice: 1.5, weightedAvgCost: 1.5, salePrice: 2, discountPercent: 0, discountStart: "", discountEnd: "", qty: 15, reorder: 40, isActive: true },
    { id: 3, code: "PRD-003", barcode: "6221039717754", nameAr: "زيت عباد الشمس 1.5 لتر", nameEn: "Sunflower Oil 1.5L", category: "زيوت", unit: "عبوة", defaultWarehouse: "المخزن الرئيسي", purchasePrice: 90, weightedAvgCost: 90, salePrice: 100, discountPercent: 5, discountStart: "2026-09-01", discountEnd: "2026-09-30", qty: 8, reorder: 20, isActive: true },
    { id: 4, code: "PRD-004", barcode: "6224001940157", nameAr: "سكر 1 كجم", nameEn: "Sugar 1Kg", category: "سكريات", unit: "كيس", defaultWarehouse: "المخزن الرئيسي", purchasePrice: 42, weightedAvgCost: 42, salePrice: 48, discountPercent: 0, discountStart: "", discountEnd: "", qty: 300, reorder: 60, isActive: true },
    { id: 5, code: "PRD-005", barcode: "6222012000232", nameAr: "شاي العروسة", nameEn: "El Arosa Tea", category: "مشروبات", unit: "علبة", defaultWarehouse: "المخزن الرئيسي", purchasePrice: 85, weightedAvgCost: 85, salePrice: 95, discountPercent: 3, discountStart: "2026-09-10", discountEnd: "2026-09-20", qty: 12, reorder: 25, isActive: true }
  ];

  /* 🆕 بناء 145 — قرار المالك الحيّ 07/10 بحرفه:
     «عايزك تضيف افتراضى لكل الشركات الجديدة فى التصنيفات كيلو قطعه دسته كرتونه و تكون فى كل
     الشركات الجديدة ثابتة لحين اضافه اى تصنيف اخر من طرف المستخدم و مش عايزه يتمسح»
     «المستودعات مكتوب للشركات الجديدة مستودعين تجريبى بينزلوا افتراضى مع انشاء شركة تقريبا
     الزقازيق منهم صلح ده» + «امسح المستودعين دول المنصورة و الزقازيق من كل الشركات الموجوده».
     ⇒ القوائم الافتراضية بقت **حقول نظام** مش بيانات تجريبية:
       · أربع وحدات محمية (`DEFAULT_UNITS`) تنزل لكل شركة جديدة، واللي يزيد عليها المستخدم يتعدّل
         ويمسح، لكن دول **ممنوع مسحهم** (في الواجهة وفي الحمولة اللي بترفع للسحابة).
       · مخزن واحد «المخزن الرئيسي» — «مخزن المنصورة» و«مخزن الزقازيق» اتشالوا من أساس التعريف،
         فأي شركة جديدة أو شركة محذوف قوائمها مابقاش فيها مستودع وهمي.
       · التصنيفات الافتراضية = «عام» بس (مافيش أصناف ألبان/مخبوزات تجريبية تفتح مع شركة جديدة).
     ⚠️ قياس القاعدة الحيّة 07/10: `public.warehouses` = **صفر سطر** في كل الشركات ⇒ الأسماء
     التجريبية كانت بتيجي من السطر ده في الكود (`warehouseList()` بترجع الثابت لو القائمة
     المحفوظة فاضية) — مش من القاعدة. */
  const DEFAULT_UNITS = ["كيلو", "قطعة", "دسته", "كرتونة"];
  const CATEGORIES = ["عام"];
  const UNITS = DEFAULT_UNITS.slice();
  const WAREHOUSES = ["المخزن الرئيسي"];
  // «ثابتة» = الوحدة دي مش بتتمسح ولا بتمسح نفسها من الحمولة: مطابقة الاسم بعد تنضيف المسافات
  function isProtectedUnit(n) {
    const s = String(n || "").trim();
    return !!s && DEFAULT_UNITS.some((d) => d === s);
  }
  // أي قائمة units (محفوظة أو معلّقة أو حمولة هتترفع) لازم تبدأ بالأربع المحمية بلا تكرار
  function withProtectedUnits(list) {
    const norm = (u) => (u && typeof u === "object")
      ? Object.assign({}, u, { name: String(u.name || u.symbol || "").trim() })
      : { name: String(u || "").trim(), symbol: "" };
    // 1) تنظيف + إزالة التكرار من المدخول (نفس قرار 145 بالحرف)
    const rows = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((u) => {
      const r = norm(u);
      if (!r.name || seen.has(r.name)) return;
      seen.add(r.name);
      rows.push(r);
    });
    // 2) الأربع المحمية أول القائمة — و⚠️ **بسطر المحفوظ نفسه** لو كان موجود (رمزه «ق» وهويته).
    //    تصحيح 146: نسخة 145 كانت بتحط {name, symbol:""} الأول وتتشاور على السطر المحفوظ
    //    (`has(d)` بيبقى true) ⇒ أي شركة كاتبهة «قطعة / ق» كان رمزها بيمسح نفسه من السحابة
    //    أول ما الحفظ يمشي. المنطق ده بيطابق قياس `D:/_work/temp/_pu_probe.js` قبل/بعد.
    const out = [];
    DEFAULT_UNITS.forEach((d) => {
      const hit = rows.find((r) => r.name === d);
      out.push(hit || { name: d, symbol: "" });
    });
    rows.forEach((r) => { if (DEFAULT_UNITS.indexOf(r.name) === -1) out.push(r); });
    return out;
  }


  const seedActivity = [
    { ts: "09:12:44", user: "admin", action: "تسجيل دخول", desc: "دخول مالك الشركة" },
    { ts: "09:30:10", user: "admin", action: "فاتورة مبيعات", desc: "فاتورة POS #INV-1001" },
    { ts: "10:05:22", user: "admin", action: "تحصيل مديونية", desc: "دفعة من أحمد محمد السيد 500 ج.م" },
    { ts: "11:40:05", user: "admin", action: "إضافة صنف", desc: "إضافة صنف جديد" },
    { ts: "12:15:48", user: "admin", action: "فاتورة مشتريات", desc: "فاتورة مشتريات #PINV-2001" }
  ];

  // الشركات الجديدة تبدأ "بيور": صندوق نقدي واحد برصيد صفر — لا بنوك ولا محافظ ولا أرصدة.
  // صاحب الشركة يضيف حساباته بنفسه من إعدادات مؤسسته.
  const seedTreasury = [
    { id: 1, name: "الصندوق الرئيسي (نقدي)", type: "cash", balance: 0 }
  ];

  const seedSuppliers = [
    {
      id: 1, code: "1", nameAr: "المورد النقدي (كاش)", phone: "", walletPhone: "",
      address: "", notes: "مورد نقدي محمي بالنظام", openingBalance: 0, currentBalance: 0, protected: true
    },
    {
      id: 2, code: "SUPP-0001", nameAr: "شركة جهينة للصناعات الغذائية", phone: "0227654000", walletPhone: "",
      address: "6 أكتوبر - الجيزة", notes: "توريد ألبان ومنتجات ألبان", openingBalance: 0, currentBalance: 0, protected: false
    },
    {
      id: 3, code: "SUPP-0002", nameAr: "مؤسسة الخير للبقالة", phone: "0403311222", walletPhone: "01008887766",
      address: "المنصورة - الدقهلية", notes: "توريد بقالة ومواد غذائية", openingBalance: 0, currentBalance: 0, protected: false
    }
  ];

  const seedSupplierTxs = [];

  const seedPurchases = [];

  const seedAccounts = [
    { id: 1, code: "1", nameAr: "الأصول", type: "asset", parentId: 0, openingBalance: 0, isActive: true },
    { id: 2, code: "1.1", nameAr: "الأصول المتداولة", type: "asset", parentId: 1, openingBalance: 0, isActive: true },
    { id: 3, code: "1.1.1", nameAr: "الصناديق النقدية", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 4, code: "1.1.2", nameAr: "البنوك والحسابات البنكية", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 5, code: "1.1.3", nameAr: "المحافظ الإلكترونية", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 6, code: "1.1.4", nameAr: "المخزون (بضاعة)", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 7, code: "1.1.5", nameAr: "مديونيات العملاء", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 8, code: "1.3", nameAr: "الأصول الثابتة", type: "asset", parentId: 1, openingBalance: 0, isActive: true },
    { id: 9, code: "1.3.1", nameAr: "المباني والمعدات", type: "asset", parentId: 8, openingBalance: 0, isActive: true },
    { id: 10, code: "2", nameAr: "الالتزامات", type: "liability", parentId: 0, openingBalance: 0, isActive: true },
    { id: 11, code: "2.1", nameAr: "الالتزامات المتداولة", type: "liability", parentId: 10, openingBalance: 0, isActive: true },
    { id: 12, code: "2.1.1", nameAr: "مستحقات الموردين", type: "liability", parentId: 11, openingBalance: 0, isActive: true },
    { id: 13, code: "2.1.2", nameAr: "ضريبة المبيعات المستحقة", type: "liability", parentId: 11, openingBalance: 0, isActive: true },
    { id: 14, code: "3", nameAr: "حقوق الملكية", type: "equity", parentId: 0, openingBalance: 0, isActive: true },
    { id: 15, code: "3.1", nameAr: "رأس المال", type: "equity", parentId: 14, openingBalance: 0, isActive: true },
    { id: 16, code: "3.2", nameAr: "الأرباح المحتجزة", type: "equity", parentId: 14, openingBalance: 0, isActive: true },
    { id: 17, code: "4", nameAr: "الإيرادات", type: "revenue", parentId: 0, openingBalance: 0, isActive: true },
    { id: 18, code: "4.1", nameAr: "إيرادات المبيعات", type: "revenue", parentId: 17, openingBalance: 0, isActive: true },
    { id: 19, code: "5", nameAr: "المصروفات", type: "expense", parentId: 0, openingBalance: 0, isActive: true },
    { id: 20, code: "5.1", nameAr: "مصروفات عمومية وإدارية", type: "expense", parentId: 19, openingBalance: 0, isActive: true },
    { id: 21, code: "5.2", nameAr: "إيجارات وما شابه", type: "expense", parentId: 19, openingBalance: 0, isActive: true }
  ];

  const seedJournal = [];

  const seedUsers = [
    { id: 1, username: "admin", fullName: "مالك الشركة", password: "123456", role: "admin", branch: "الفرع الرئيسي", isActive: true, lastSeen: "" }
  ];

  const seedVouchers = [];

  const defaultSettings = {
    orgName: "مؤسستي التجارية",
    orgPhone: "",
    orgAddress: "",
    orgVat: "",
    orgNote: "شكراً لتعاملكم معنا - جميع الأسعار شاملة الضريبة",
    taxEnabled: TAX.enabled,
    taxRate: TAX.rate,
    plan: "فردي (مستخدم واحد)",
    planEnd: "",
    planStatus: "تجربة 🧪"
  };

  /* ================== 🛡 بناء 119: شركة جديدة = بيور ================== */
  // البيانات التجريبية (seed) للعرض المحلي بدون حساب فقط. قبل أي دخول على شركة سحابية
  // أي صف مطابق حرفيًا لسطر تجريبي يُشال من الذاكرة والكاش، فلا يظهر للعميل ولا يُرفع
  // للسحابة (شكوى المالك 01/10: شركة «امين» الجديدة ظهرت فيها «شركة جهينة» و«مؤسسة الخير»).
  // البيانات الحقيقية اللي أدخلها المستخدم بنفسه ما تتلمسش: المطابقة بكل الأعمدة المميزة،
  // والعميل/المورد النقدي المحمي (رصيد صفر) يفضل لأنه كيان نظامي مش محتوى تجريبي.
  const SEED_SIGN_FIELDS = {
    customers: ["code", "nameAr", "phone", "openingBalance"],
    suppliers: ["code", "nameAr", "phone", "openingBalance"],
    products: ["code", "barcode", "nameAr", "purchasePrice", "salePrice"],
    txs: ["customerId", "date", "desc", "debit", "credit"],
    // 🛡 بناء 122: مستخدم admin وسجل النشاط التجريبيين لهما توقيع كمان — عشان
    // «شركة حقيقية = فاضية ١٠٠٪» تغطي كل المحتوى التجريبي مش أربع جداول بس.
    users: ["username", "fullName", "password", "role", "branch"],
    activity: ["user", "action", "desc"]
  };
  const SEED_ROWS = {
    customers: seedCustomers, suppliers: seedSuppliers, products: seedProducts, txs: seedTxs,
    users: seedUsers, activity: seedActivity
  };
  function isSystemCashRow(row) {
    if (!row) return false;
    if (row.protected === true) return true;
    if (String(row.code || "").trim() === "1") return true;
    return /نقدي|كاش/.test(String(row.nameAr || ""));
  }
  function seedSignature(table, row) {
    const fields = SEED_SIGN_FIELDS[table] || [];
    return fields.map((f) => {
      const v = row ? row[f] : null;
      if (v === null || v === undefined || v === "") return "∅";
      const n = Number(v);
      return (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())))
        ? "n:" + (isNaN(n) ? 0 : n)
        : "s:" + String(v).trim();
    }).join("|");
  }
  function stripSeedRows(table, arr) {
    const seed = SEED_ROWS[table];
    if (!Array.isArray(arr) || !seed || !seed.length) return Array.isArray(arr) ? arr : [];
    const dict = {};
    seed.forEach((r) => { dict[seedSignature(table, r)] = 1; });
    return arr.filter((r) => isSystemCashRow(r) || !dict[seedSignature(table, r)]);
  }
  // يشيل الأسطر التجريبية من الذاكرة والكاش (بلا أي رفع للسحابة) — يرجع عدد المحذوف
  function purgeDemoForCloudSession() {
    // 🛡 بناء 122: النطاق بقى كامل — جداول المحتوى الأربعة + مستخدم admin التجريبي
    // وسجل النشاط التجريبي. الكيانات المحمية (العميل/المورد النقدي) ما تتشالش.
    const names = ["customers", "suppliers", "products", "txs", "users", "activity"];
    const keys = { customers: LS_CUSTOMERS, suppliers: LS_SUPPLIERS, products: LS_PRODUCTS,
      txs: LS_TXS, users: LS_USERS, activity: LS_ACTIVITY };
    const get = { customers: () => customers, suppliers: () => suppliers, products: () => products,
      txs: () => txs, users: () => users, activity: () => activity };
    const set = { customers: (v) => { customers = v; }, suppliers: (v) => { suppliers = v; },
      products: (v) => { products = v; }, txs: (v) => { txs = v; },
      users: (v) => { users = v; }, activity: (v) => { activity = v; } };
    let removed = 0;
    A.cleaning = true;   // منع أي رفع أثناء التنظيف (pushTable بيرجع أول حاجة)
    try {
      names.forEach((name) => {
        const cur = get[name]() || [];
        const arr = stripSeedRows(name, cur);
        removed += Math.max(0, cur.length - arr.length);
        set[name](arr);
        try { localStorage.setItem(keys[name], JSON.stringify(arr)); } catch (e) { }
      });
      mirror();
    } finally { A.cleaning = false; }
    return removed;
  }

  // مين كتب الحالة المحلية في المتصفح ده؟ (null = مجهولة/تجريبية)
  function localStateOrg() { try { return localStorage.getItem(LS_STATE_ORG); } catch (e) { return null; } }
  function stampStateOrg(org) { try { localStorage.setItem(LS_STATE_ORG, org || ""); } catch (e) { } }

  /* ============ 🛡 بناء 122: قاعدة المالك — شركة حقيقية = فاضية ١٠٠٪ ============ */
  // قرار المالك (02/10): «اعمل القاعده ان اى شركه تنشا فيما بعد تكون فاضية 100%
  // لكن متحذفش بيانات موجوده». المحتوى التجريبي (أحمد محمد / شركة النور / مصطفى
  // عبد الله / جهينة / مؤسسة الخير / PRD-00x / حركة 2026-08 / سجل admin / مستخدم
  // admin) يبقى **للعرض المحلي بدون حساب فقط**. أي متصفح فيه دليل على شركة سحابية
  // حقيقية يبدأ من الأساس النظامي وحده: العميل والمورد النقدي المحميّان + صندوق
  // برصيد صفر + شجرة الحسابات، وكل جداول المحتوى فاضية.
  function realCloudCompanyEvidence() {
    if (A.online) return true;
    if (localStateOrg()) return true;                                  // ختم ملكية الحالة (بناء 119)
    try { if (localStorage.getItem(LS_SRC_ORG)) return true; } catch (e) { }
    try { if (localStorage.getItem("mizan_session_v1")) return true; } catch (e) { } // جلسة محفوظة
    try { if (window.DATA && DATA.org && DATA.org()) return true; } catch (e) { }
    try { if (window.DATA && DATA.email && DATA.email()) return true; } catch (e) { }
    return false;
  }
  // العرض التجريبي مسموح به بس في المتصفح اللي مافيش فيه أي أثر لحساب سحابي
  function demoAllowedHere() { return !realCloudCompanyEvidence(); }
  // الأساس النظامي لوحده (الكيانات المحمية بدون أي سطر تجريبي) — نسخة مستقلة
  // عشان التعديل بعدها على المصفوفة ما يغيّش قالب الـ seed نفسه.
  function systemOnlyRows(rows) {
    try { return JSON.parse(JSON.stringify((rows || []).filter(isSystemCashRow))); } catch (e) { return []; }
  }

  // 🛡 بناء 119: الصفر الحقيقي لشركة جديدة — نمسح كل الجداول من الذاكرة والكاش
  // (بلا أي رفع للسحابة: A.cleaning بيطفّئ pushTable) قبل سحب بيانات الشركة.
  // ده الحل الجذري مش حارس تطابق: السطور اللي مش تبع الشركة — لا تجريبية ولا
  // بتاعت حساب تاني ولا لقطة ديسك — مابقاش لها وجود وقت الدمج، فـ adoptCloud
  // ما يلاقيش «سطور محلية زيادة» يرفعها للشركة الجديدة.
  function wipeLocalTables() {
    A.cleaning = true;
    try {
      LS_ALL_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { } });
      customers = []; txs = []; products = []; activity = []; sales = [];
      treasury = []; suppliers = []; supplierTxs = []; purchases = [];
      accounts = []; journalEntries = []; users = []; vouchers = [];
      saleReturns = []; purchaseReturns = []; employees = []; attendance = [];
      attSettings = defaultAttSettings(); fixedAssets = [];
      scSheets = []; scSheetCur = null;
      // 🧮 بناء 145: ورق الجرد على القرص **ما اتمسحش** (مفتاحه بره LS_ALL_KEYS عمدًا)، بس
      // الذاكرة اتفضّت ⇒ لازم «آخر مفتاح قرينا منه» يمسح هو كمان. بدون ده `scResyncOrg()`
      // تلاقي المفتاح زي ما هو وترجع مصفوفة فاضية، والورق يبان ضايع رغم إنه على الجهاز
      // («ورقة الجرد مش بتنزل» — نفس الشكوى، مسار مختلف: خروج ودخول **لنفس الشركة**).
      scLoadedKey = null;
      openingBaseline = null;
      // خريطة معرّفات السحابة بتاعت الشركة السابقة لو فضلت ممكن تُنسب سطر جديد
      // لـ uuid قديم من شركة تانية — تفضى معاهم.
      if (window.MIZAN_STATE) window.MIZAN_STATE.idMap = {};
      mirror();
    } finally { A.cleaning = false; }
  }

  /* ================== الحالة ================== */  let customers = [];
  let txs = [];
  let products = [];
  let activity = [];
  let sales = [];
  let treasury = [];
  let suppliers = [];
  let supplierTxs = [];
  let purchases = [];
  let saleReturns = [];
  let purchaseReturns = [];
  let accounts = [];
  let journalEntries = [];
  let users = [];
  let vouchers = [];
  // 🆕 بناء 115: الحضور والانصراف (موظفون + سجل + مدة العمل)
  let employees = [];
  let attendance = [];
  let attSettings = null;   // كائن واحد لكل شركة: {id, workStart, workEnd, graceMin, lunchMin}
  // 🆕 مهمة 98: سجل الأصول الثابتة — لكل أصل: اسم/تصنيف (noncurrent|intangible)/فئة/تاريخ/تكلفة/إهلاك
  let fixedAssets = [];
  // 🧮 بناء 145: «الجرد بالباركود» — ورق الجرد على **جهاز العميل بس** (قرار المالك 05/10):
  // `scSheets` = كل الورق المحفوظ على الجهاز ده، `scSheetCur` = الورقة اللي العدّاد واقف عليها.
  // مافيش جدول سحابي ومافيش ترقية: المفتاح في localStorage وبره mirror()/pushTable().
  let scSheets = [];
  let scSheetCur = null;
  let settings = {};
  let editingId = null;

  /* ================== أدوات ================== */
  const $ = (sel) => document.querySelector(sel);

  /* ================== الأدوات الأونلاين ================== */
  const DB = window.MIZAN_STATE;
  const A = { online: false, uid: null, adopting: false, cleaning: false };
  let planWatchTimer = null;
  let presenceTimer = null;

  
  function ensureCashEntities() {
    if (Array.isArray(customers) && customers.length) {
      let cashCust = customers.find((c) => c.id === 1 || c.code === "1" || c.code === "CASH" || c.protected === true || (c.nameAr && c.nameAr.includes("العميل النقدي")));
      if (cashCust) {
        cashCust.code = "1";
        cashCust.protected = true;
        if (!cashCust.nameAr || !cashCust.nameAr.includes("نقدي")) cashCust.nameAr = "العميل النقدي (كاش)";
      } else {
        customers.unshift({
          id: 1,
          code: "1",
          nameAr: "العميل النقدي (كاش)",
          phone: "",
          secondaryPhone: "",
          walletPhone: "",
          address: "",
          notes: "عميل نقدي محمي بالنظام",
          openingBalance: 0,
          currentBalance: 0,
          protected: true
        });
      }
    }
    if (Array.isArray(suppliers) && suppliers.length) {
      let cashSupp = suppliers.find((s) => s.id === 1 || s.code === "1" || s.code === "SUPP-001" || s.protected === true || (s.nameAr && s.nameAr.includes("المورد النقدي")));
      if (cashSupp) {
        cashSupp.code = "1";
        cashSupp.protected = true;
        if (!cashSupp.nameAr || !cashSupp.nameAr.includes("نقدي")) cashSupp.nameAr = "المورد النقدي (كاش)";
      } else {
        suppliers.unshift({
          id: 1,
          code: "1",
          nameAr: "المورد النقدي (كاش)",
          phone: "",
          walletPhone: "",
          address: "",
          notes: "مورد نقدي محمي بالنظام",
          openingBalance: 0,
          currentBalance: 0,
          protected: true
        });
      }
    }
  }

  // 🆕 بناء 118: الجداول الكبيرة (حركة العملاء/الموردين...) بتنزل بعد EAGER في loadLazyAll.
  // أي إعادة حساب للرصيد الآجل قبل ما جدول الحركة يوصل = تصفير رصيد حقيقي بالصمت
  // (فاتورة مشتريات آجلة تختفي من «مستحقات الموردين» في المركز المالي ومن الدليل).
  // فإعادة الحساب بتمتنع لحد ما التنزيل يكتمل، واللي مسجّل بيتحافظ زي ما هو.
  function bigDataLoaded(name) {
    const lt = window.MIZAN_STATE && window.MIZAN_STATE.loadedTables;
    if (!lt) return true;                 // وضع الديسك/المحلي: مافيش تنزيل ناقص أصلًا
    return lt[name] === true;
  }

  function recalculateCustomerBalances() {
    ensureCashEntities();
    if (!customers || !txs) return false;
    if (!bigDataLoaded("customer_txs")) return false;   // 🔒 الحركة لسه ما نزلتش — مافيش تصفير
    customers.forEach((c) => {
      const custTxs = txs.filter((t) => Number(t.customerId) === Number(c.id));
      let bal = 0;
      const hasOpeningTx = custTxs.some((t) => (t.desc || "").includes("افتتاحي") || (t.desc || "").includes("أول المدة"));
      if (!hasOpeningTx && Number(c.openingBalance || 0) > 0) {
        bal += Number(c.openingBalance || 0);
      }
      custTxs.forEach((t) => {
        bal += (Number(t.debit) || 0) - (Number(t.credit) || 0);
      });
      c.currentBalance = Math.round(bal * 100) / 100;
    });
    return true;
  }

  function recalculateSupplierBalances() {
    if (!suppliers || !supplierTxs) return false;
    if (!bigDataLoaded("supplier_txs")) return false;   // 🔒 نفس الحصانة للموردين
    suppliers.forEach((s) => {
      const sTxs = supplierTxs.filter((t) => Number(t.supplierId) === Number(s.id));
      let bal = 0;
      const hasOpeningTx = sTxs.some((t) => (t.desc || "").includes("افتتاحي") || (t.desc || "").includes("أول المدة"));
      if (!hasOpeningTx && Number(s.openingBalance || 0) > 0) {
        bal += Number(s.openingBalance || 0);
      }
      sTxs.forEach((t) => {
        bal += (Number(t.debit) || 0) - (Number(t.credit) || 0);
      });
      s.currentBalance = Math.round(bal * 100) / 100;
    });
    return true;
  }

  function syncTreasuryItemToSett(tr) {
    if (!tr) return;
    const norm = (s) => (s || "").replace(/[\s\-_()]/g, "").toLowerCase();
    const trName = norm(tr.name);
    [csetData, ssetData].forEach((src) => {
      if (!src) return;
      const list = tr.type === "bank" ? src.banks : tr.type === "wallet" ? src.wallets : null;
      if (Array.isArray(list)) {
        // 🆕 بناء 119: الهوية أولًا (local_id) — المطابقة بالاسم احتياطية للقديم بس
        const byId = Number(tr.id) > 0 ? list.find((x) => Number(x.local_id) === Number(tr.id)) : null;
        const item = byId || list.find((x) => {
          const xn = norm(x.name);
          return xn === trName || (x.account_no && tr.accountNo && norm(x.account_no) === norm(tr.accountNo)) || (xn && trName && (xn.includes(trName) || trName.includes(xn)));
        });
        if (item) {
          item.balance = tr.balance;
          // 🛡 بناء 119: الرصيد الافتتاحي كمان. كان الجاري بس هو اللي بيتمرّ، فسطر
          // «إعدادات مؤسستك» يفضل ماسك 50,000 و syncTreasuryFromSett (الضبط هو المرجع
          // للافتتاحي) كان بيرجع يكتبه فوق الرقم اللي المستخدم صيّره صفر — ده جذر
          // الشكوى: «خليت رصيد البنك صفر وحفظت، لما رجعت لقيته 50,000».
          if (tr.openingBalance != null) item.opening_balance = Math.round((Number(tr.openingBalance) || 0) * 100) / 100;
        }
      }
    });
  }

  function reconcileTreasuryWithTxs() {
    if (!Array.isArray(txs) || !Array.isArray(vouchers) || !Array.isArray(treasury)) return;
    let changed = false;
    txs.forEach((t) => {
      if (Number(t.credit || 0) <= 0) return;
      if ((t.desc || "").includes("افتتاحي") || (t.desc || "").includes("أول المدة")) return;
      // حركة مرتجع (خصم من رصيد العميل) ليست تحصيل — ما ينفعش تولّد سند قبض (بناء 108)
      if ((t.desc || "").includes("مرتجع")) return;
      const hasVoucher = vouchers.some((v) => (v.refType === "customer_tx" && v.refId === t.id) || (v.refId === t.id));
      if (hasVoucher) return;

      let targetTr = null;
      if (t.treasuryId) {
        targetTr = treasury.find((x) => Number(x.id) === Number(t.treasuryId));
      }
      if (!targetTr && t.desc) {
        const d = normalizeAr(t.desc);
        targetTr = treasury.find((x) => d.includes(normalizeAr(x.name)) || (x.accountNo && d.includes(x.accountNo)));
      }
      if (!targetTr && t.desc && (t.desc.includes("بنك") || t.desc.includes("أهلي") || t.desc.includes("اهلي"))) {
        targetTr = treasury.find((x) => x.type === "bank");
      }
      if (!targetTr && t.desc && (t.desc.includes("نقدي") || t.desc.includes("كاش"))) {
        targetTr = treasury.find((x) => x.type === "cash") || treasury[0];
      }
      if (!targetTr) return;

      const cust = (customers || []).find((c) => Number(c.id) === Number(t.customerId));
      vouchers.push({
        id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
        type: "in",
        treasuryId: targetTr.id,
        date: t.date || todayISO(),
        amount: Number(t.credit),
        desc: "تحصيل من عميل: " + (cust ? cust.nameAr : "") + (t.desc ? " (" + t.desc + ")" : ""),
        refType: "customer_tx",
        refId: t.id
      });
      changed = true;
    });

    (supplierTxs || []).forEach((t) => {
      if (Number(t.credit || 0) <= 0) return;
      if ((t.desc || "").includes("افتتاحي") || (t.desc || "").includes("أول المدة")) return;
      // حركة مرتجع مشتريات (خصم من مستحق المورد) ليست سدادًا — ما تولّدش سند صرف (بناء 108)
      if ((t.desc || "").includes("مرتجع")) return;
      const hasVoucher = vouchers.some((v) => (v.refType === "supplier_tx" && v.refId === t.id) || (v.refId === t.id));
      if (hasVoucher) return;

      let targetTr = null;
      if (t.treasuryId) {
        targetTr = treasury.find((x) => Number(x.id) === Number(t.treasuryId));
      }
      if (!targetTr && t.desc) {
        const d = normalizeAr(t.desc);
        targetTr = treasury.find((x) => d.includes(normalizeAr(x.name)) || (x.accountNo && d.includes(x.accountNo)));
      }
      if (!targetTr && t.desc && (t.desc.includes("بنك") || t.desc.includes("أهلي") || t.desc.includes("اهلي"))) {
        targetTr = treasury.find((x) => x.type === "bank");
      }
      if (!targetTr && t.desc && (t.desc.includes("نقدي") || t.desc.includes("كاش"))) {
        targetTr = treasury.find((x) => x.type === "cash") || treasury[0];
      }
      if (!targetTr) return;

      const supp = (suppliers || []).find((s) => Number(s.id) === Number(t.supplierId));
      vouchers.push({
        id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
        type: "out",
        treasuryId: targetTr.id,
        date: t.date || todayISO(),
        amount: Number(t.credit),
        desc: "سداد لمورد: " + (supp ? supp.nameAr : "") + (t.desc ? " (" + t.desc + ")" : ""),
        refType: "supplier_tx",
        refId: t.id
      });
      changed = true;
    });

    if (changed) {
      saveVouchers();
    }
  }

  function recalculateTreasuryBalances() {
    if (!Array.isArray(treasury)) return;
    reconcileTreasuryWithTxs();
    treasury.forEach((tr) => {
      if (tr.openingBalance == null) {
        tr.openingBalance = Number(tr.balance || 0);
      }
      const tid = Number(tr.id);
      let bal = Number(tr.openingBalance || 0);

      (sales || []).filter((s) => Number(s.treasuryId) === tid && s.paymentMethod !== "آجل").forEach((s) => {
        bal += Number(s.grandTotal || 0);
      });

      (purchases || []).filter((p) => Number(p.treasuryId) === tid && p.paymentMethod !== "آجل").forEach((p) => {
        bal -= Number(p.grandTotal || 0);
      });

      (vouchers || []).filter((v) => Number(v.treasuryId) === tid).forEach((v) => {
        if (v.type === "in" || v.kind === "in") bal += Number(v.amount || 0);
        else bal -= Number(v.amount || 0);
      });

      tr.balance = Math.round(bal * 100) / 100;
      syncTreasuryItemToSett(tr);
    });
    saveTreasury();
  }

  let diskSyncTimer = null;
  function syncToLocalDisk() {
    clearTimeout(diskSyncTimer);
    diskSyncTimer = setTimeout(() => {
      try {
        if (!window.location.origin.includes("localhost") && !window.location.origin.includes("127.0.0.1") && !window.location.origin.includes("0.0.0.0")) return;
        const payload = {
          customers,
          txs,
          products,
          activity,
          sales,
          treasury,
          suppliers,
          supplierTxs,
          purchases,
          saleReturns,
          purchaseReturns,
          accounts,
          journalEntries,
          users,
          vouchers,
          employees,
          attendance,
          attSettings,
          fixedAssets,
          settings,
          // 🛡 بناء 119: اللقطة المحلية ملك شركة واحدة — بدون ختم الأصل كان ملف
          // الديسك (مش متقسّم على الشركات) يرجّع أرصدة شركة قديمة لشركة جديدة.
          orgId: (DATA && DATA.org && DATA.org() ? DATA.org().id : null),
          savedAt: new Date().toISOString()
        };
        fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => { });
      } catch (e) { }
    }, 500);
  }

  function loadFromLocalDisk() {
    try {
      if (!window.location.origin.includes("localhost") && !window.location.origin.includes("127.0.0.1") && !window.location.origin.includes("0.0.0.0")) return;
      fetch("/api/load")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          // 🛡 بناء 119: الجلسة السحابية شغالة ⇒ السحابة هي المرجع، ولقطة الديسك
          // القديمة ما ترجّعش رصيدًا عدّله المستخدم فعلًا (شكوى: الرصيد الافتتاحي
          // صفر → يرجع 50,000). كمان اللقطة لازم تكون لنفس الشركة.
          if (A.online) return;
          const nowOrg = (DATA && DATA.org && DATA.org() ? DATA.org().id : null) || localStateOrg();
          // 🛡 بناء 122: شركة حقيقية ما تقبلش لقطة ديسك مش مختومة بيها — اللقطة اللي
          // ملهاش ختم (كتابة قديمة قبل بناء 119، أو لقطة وضع العرض المحلي) أصلًا مش
          // ملك حد، فلازم ما تدخلش جداول شركة سحابية (كان بيكفي «لو فيها orgId»).
          // وضع العرض المحلي البحت (nowOrg فاضي) لسه بيرجّع لقطة الديسك كما هي.
          if (nowOrg && String(data.orgId || "") !== String(nowOrg)) {
            console.log("mizan: لقطة الديسك مش مختومة بشركة هذا المتصفح — تتجاهل (بناء 122)");
            return;
          }
          // 🛡 الاسترجاع من ملف الديسك (مخزن مستقل عن المتصفح/الـ origin):
          // نُحمّل الجدول من الديسك فقط لو الحالة الحالية في الذاكرة فاضية
          // أو لسه بيانات تجريبية (seed) — عشان ما ندهسش بيانات حقيقية أحدث.
          // وبعد الاسترجاع نُثبّت في localStorage حتى لا تُفقد عند إعادة الفتح
          // على نفس الـ origin. (pushTable داخل دوال الحفظ no-op في الوضع المحلي.)
          let restored = false;
          // 🛡 بناء 122: جدول المحتوى → مفتاح الـ localStorage (لإسقاط أي سطر تجريبي
          // من لقطة الديسك قبل ما يدخل ذاكرة شركة حقيقية — لقطة قديمة من وضع العرض
          // المحلي كانت ممكن ترجّع «جهينة/مؤسسة الخير» لشركة سحابية والنت فاصل).
          const SEED_TABLE_BY_KEY = {};
          Object.keys(SEED_ROWS).forEach((t) => {
            if (t === "customers") SEED_TABLE_BY_KEY[LS_CUSTOMERS] = t;
            if (t === "suppliers") SEED_TABLE_BY_KEY[LS_SUPPLIERS] = t;
            if (t === "products") SEED_TABLE_BY_KEY[LS_PRODUCTS] = t;
            if (t === "txs") SEED_TABLE_BY_KEY[LS_TXS] = t;
          });
          const take = (diskArr, key, inMem, seedRef, assign, persist) => {
            if (!Array.isArray(diskArr) || !diskArr.length) return;
            // 🛡 شركة حقيقية؟ أي سطر مطابق للتجريبى يتشال من اللقطة قبل الاسترجاع
            const seedTable = key ? SEED_TABLE_BY_KEY[key] : null;
            if (seedTable && realCloudCompanyEvidence()) diskArr = stripSeedRows(seedTable, diskArr);
            if (!diskArr.length) return;
            // لو المفتاح كان غايب لحظة الإقلاع → البيانات الحالية seed (مش شغل
            // مستخدم حقيقي) → يُفضَّل استرجاع الديسك. ده أصلب من مقارنة المرجع
            // لأن ensureCashEntities/الحفظ قد يعيد بناء المصفوفة فيفقد التطابق.
            const wasAbsentAtBoot = !!(key && bootLsPresent[key] === false);
            const emptyOrSeed = !inMem || !inMem.length || wasAbsentAtBoot || (seedRef !== undefined && inMem === seedRef);
            if (!emptyOrSeed) return;
            assign(diskArr);
            persist();
            restored = true;
          };
          take(data.sales, LS_SALES, sales, undefined, (v) => { sales = v; }, saveSales);
          take(data.customers, LS_CUSTOMERS, customers, seedCustomers, (v) => { customers = v; }, saveCustomers);
          take(data.txs, LS_TXS, txs, seedTxs, (v) => { txs = v; }, saveTxs);
          take(data.treasury, LS_TREASURY, treasury, seedTreasury, (v) => { treasury = v; }, saveTreasury);
          take(data.suppliers, LS_SUPPLIERS, suppliers, seedSuppliers, (v) => { suppliers = v; }, saveSuppliers);
          take(data.supplierTxs, LS_SUP_TXS, supplierTxs, seedSupplierTxs, (v) => { supplierTxs = v; }, saveSupplierTxs);
          take(data.purchases, LS_PURCHASES, purchases, seedPurchases, (v) => { purchases = v; }, savePurchases);
          take(data.saleReturns, LS_SALE_RETURNS, saleReturns, undefined, (v) => { saleReturns = v; }, saveSaleReturns);
          take(data.purchaseReturns, LS_PURCHASE_RETURNS, purchaseReturns, undefined, (v) => { purchaseReturns = v; }, savePurchaseReturns);
          take(data.products, LS_PRODUCTS, products, seedProducts, (v) => { products = v; }, saveProducts);
          take(data.accounts, LS_ACCOUNTS, accounts, seedAccounts, (v) => { accounts = v; }, saveAccounts);
          take(data.vouchers, LS_VOUCHERS, vouchers, seedVouchers, (v) => { vouchers = v; }, saveVouchers);
          take(data.journalEntries, LS_JOURNAL, journalEntries, seedJournal, (v) => { journalEntries = v; }, persistJournal);
          // 🆕 بناء 115: استرجاع الحضور من الديسك (نفس شرط الفارغ/التجريبي)
          take(data.employees, LS_EMPLOYEES, employees, undefined, (v) => { employees = v; }, saveEmployees);
          take(data.attendance, LS_ATTENDANCE, attendance, undefined, (v) => { attendance = v; }, saveAttendance);
          // 🆕 مهمة 98: استرجاع سجل الأصول من الديسك (نفس شرط الفارغ/التجريبي)
          take(data.fixedAssets, LS_FIXED_ASSETS, fixedAssets, undefined, (v) => { fixedAssets = v; }, saveFixedAssets);
          if (data.attSettings && typeof data.attSettings === "object" && (!attSettings || bootLsPresent[LS_ATT_SETTINGS] === false)) {
            attSettings = data.attSettings; saveAttSettings(); restored = true;
          }
          if (!restored) return;
          // اللقطة المحلية فيها الحركة كاملة ⇒ حصانة بناء 118 ما تمنعش إعادة الحساب هنا
          try {
            const LT = (window.MIZAN_STATE.loadedTables = window.MIZAN_STATE.loadedTables || {});
            ["customer_txs", "supplier_txs", "sales", "purchases", "vouchers", "journal_entries"].forEach((t) => { LT[t] = true; });
          } catch (e) { }
          recalculateCustomerBalances();
          recalculateSupplierBalances();
          recalculateTreasuryBalances();
          if (typeof renderTable === "function") renderTable();
          if (typeof renderTreasury === "function") renderTreasury();
          if (typeof renderInvoiceQuery === "function") renderInvoiceQuery();
        })
        .catch(() => { });
    } catch (e) { }
  }

  function mirror() {
    DB.customers = customers;
    DB.products = products;
    DB.suppliers = suppliers;
    DB.treasury = treasury;
    DB.accounts = accounts;
    DB.sales = sales;
    DB.purchases = purchases;
    DB.sale_returns = saleReturns;
    DB.purchase_returns = purchaseReturns;
    DB.supplier_txs = supplierTxs;
    DB.customer_txs = txs;
    DB.vouchers = vouchers;
    DB.journalEntries = journalEntries;
    // 🆕 بناء 115: الحضور والانصراف — att_settings سطر واحد نلفّه مصفوفة للمزامنة
    DB.employees = employees;
    DB.attendance = attendance;
    DB.att_settings = attSettings ? [Object.assign({}, attSettings)] : [];
    // 🆕 مهمة 98: الأصول الثابتة
    DB.fixed_assets = fixedAssets;
  }

  function pushTable(name) {
    // الحفظ محلي أولًا دائمًا؛ الرفع للسحابة بيتم بس لو متصل (من غير طابور أوفلاين).
    if (!A.online || A.adopting || A.cleaning) return;
    if (!window.CLOUD) return;
    mirror();
    window.CLOUD.push(name).catch((e) => console.warn("push", name, e.message));
  }

  function setDbStatus(txt) {
    const el = $("#dbStatus");
    if (el) el.textContent = txt;
  }
  function setUserInfo(txt) {
    const el = $("#userInfo");
    if (el) el.textContent = txt;
  }
  function setSubInfo(acc) {
    const el = $("#subInfo");
    if (!el) return;
    // 🛡 بند 17: حساب المالك (عادل) ما يشوفش شريط «نهاية الاشتراك» أبدًا
    if (acc && acc.is_superadmin) { el.hidden = true; return; }
    if (!acc || !acc.plan_end) { el.hidden = true; return; }
    let end;
    try { end = new Date(acc.plan_end + "T00:00:00"); } catch (e) { el.hidden = true; return; }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.round((end - now) / 86400000);
    if (end.getTime() - now.getTime() < 0) { el.hidden = true; return; }
    const fmt = end.getFullYear() + "/" + String(end.getMonth() + 1).padStart(2, "0") + "/" + String(end.getDate()).padStart(2, "0");
    const arNums = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
    const toAr = (s) => String(s).replace(/[0-9]/g, (d) => arNums[+d]);
    el.textContent = "نهاية الاشتراك يوم " + toAr(fmt) + " (باقي " + toAr(days) + " يوم)";
    el.hidden = false;
  }

  // مراقبة الاشتراك لحظيًا: لو غيّر المالك التاريخ أو قفل الشركة يظهر فورًا للعميل
  function checkPlanNow() {
    if (planWatchTimer === null) return Promise.resolve();
    return DATA.requestAccess().then((acc) => {
      setSubInfo(acc);
      setDbStatus("🟢 متصل بالسحابة");
      if (!acc) return;
      if (!accessGranted(acc)) {
        showDeny(acc);
      } else if (!$("#denyScreen").hidden) {
        // كان العميل على شاشة "لا يمكنك الدخول" وأصبح الاشتراك مفعّلًا → ندخله فورًا
        DATA.loadEagerAll().finally(() => {
          $("#denyScreen").hidden = true;
          hideScreens();
          initApp();
          setDbStatus("🟢 متصل بالسحابة");
        });
      }
    }).catch(() => {});
  }
  function startPlanWatch() {
    stopPlanWatch();
    planWatchTimer = setInterval(checkPlanNow, 30000);
    checkPlanNow();
  }
  function stopPlanWatch() {
    if (planWatchTimer !== null) {
      clearInterval(planWatchTimer);
      planWatchTimer = null;
    }
  }
  // ---- الحضور (من فاتح التطبيق الآن) ----
  function isPresenceEligible() {
    return A.online && window.DATA && DATA.isOnline() && !DATA.accessInfo().locked;
  }
  function startPresence() {
    stopPresence();
    if (!isPresenceEligible()) return;
    presenceTimer = setInterval(() => {
      // 🆕 بناء 119: الشركة تتقفل أو اشتراكها ينتهي ⇒ النبض يقطع في نفس اللحظة،
      // فبطاقة «متصلون الآن» ما تضلش خضرا على حساب شركة مامشيهاش.
      if (!isPresenceEligible()) { stopPresence(); return; }
      DATA.presenceHeartbeat().catch(() => {});
    }, 15000);
    DATA.presenceHeartbeat().catch(() => {});
  }
  function stopPresence() {
    if (presenceTimer !== null) {
      clearInterval(presenceTimer);
      presenceTimer = null;
    }
  }
  // 🆕 بناء 119: لوحة الإدارة بتتحدث كل 5 ثوانٍ — البطاقات + جدول الشركات + بطاقة المتصلين.
  // كان 15 ثانية بيحدّث البطاقة وحدها، فجدول الشركات كان بيفضل «🟢 متصل الآن» بعد ما
  // المستخدم يقفل البرنامج (شكوى المالك: «التحديث مش لحظي»). نافذة «متصل» على السحابة
  // نفسها 110 ثانية (ترحيل ٢٢) ⇒ الشركة المقفولة بتتحول للأحمر خلال دقيقتين على الأكثر.
  let presenceViewTimer = null;
  function startPresenceView() {
    stopPresenceView();
    presenceViewTimer = setInterval(() => {
      const av = document.getElementById("viewAdmin");
      if (!av || av.hidden) return;
      refreshAdminLive();
    }, 5000);
  }
  // جلب جديد للشركات ورسمه مكان القديم (صناديق البحث بره الجدول، فالكتابة ما تتكسرش)
  function refreshAdminLive() {
    if (!DATA || !DATA.adminOrgs) return;
    DATA.adminOrgs().then((orgs) => {
      const list = orgs || [];
      renderAdminStats(list);        // بتنادي refreshPresenceCard جوه
      try { renderAdminAlerts(list); } catch (e) {}
      paintAdminOrgTable(list);
    }).catch(() => {});
  }
  function stopPresenceView() {
    if (presenceViewTimer !== null) {
      clearInterval(presenceViewTimer);
      presenceViewTimer = null;
    }
  }

  function normalizeProduct(p) {
    const g = Object.assign({
      barcode: "",
      nameEn: "",
      category: "عام",
      unit: "حبة",
      defaultWarehouse: "المخزن الرئيسي",
      purchasePrice: 0,
      weightedAvgCost: 0,
      salePrice: 0,
      discountPercent: 0,
      discountStart: "",
      discountEnd: "",
      qty: 0,
      reorder: 50,
      isActive: true
    }, p);
    migrateProductStock(g);
    return g;
  }

  function migrateProductStock(p) {
    if (!p.stock || typeof p.stock !== "object") p.stock = {};
    if (Object.keys(p.stock).length === 0 && Number(p.qty || 0) > 0) {
      p.stock[p.defaultWarehouse || WAREHOUSES[0]] = Number(p.qty);
    }
    let total = 0;
    Object.keys(p.stock).forEach((k) => total += Number(p.stock[k]) || 0);
    p.qty = Math.round(total * 100) / 100;
  }

  function stockAt(p, wh) {
    if (!p) return 0;
    if (!p.stock || typeof p.stock !== "object") return Number(p && p.qty) || 0;
    const specific = wh ? (Number(p.stock[wh]) || 0) : NaN;
    if (!isNaN(specific) && specific > 0) return specific;
    // إذا لم توجد كمية في المستودع المحدد (اسم مختلف/قديم) بينما الكمية موجودة في مخازن أخرى
    // نعود إلى الإجمالي بدلًا من منع البيع ظنًا بأن المخزون صفر.
    let total = 0;
    Object.keys(p.stock).forEach((k) => total += Number(p.stock[k]) || 0);
    if (total > 0) return total;
    return isNaN(specific) ? 0 : specific;
  }

  function setStockAt(p, wh, v) {
    if (!p.stock) p.stock = {};
    p.stock[wh] = Math.round(v * 100) / 100;
    let total = 0;
    Object.keys(p.stock).forEach((k) => total += Number(p.stock[k]) || 0);
    p.qty = Math.round(total * 100) / 100;
  }

  function addStockAt(p, wh, v) {
    setStockAt(p, wh, stockAt(p, wh) + v);
  }

  function loadData() {
    // 🛡 بناء 122: المحتوى التجريبي للعرض المحلي بدون حساب فقط — في متصفح فيه أثر
    // لشركة سحابية حقيقية تبدأ الجداول من الأساس النظامي (فاضية عدا الكيانات المحمية).
    const demo = demoAllowedHere();
    try {
      customers = JSON.parse(localStorage.getItem(LS_CUSTOMERS)) || (demo ? seedCustomers : systemOnlyRows(seedCustomers));
      txs = JSON.parse(localStorage.getItem(LS_TXS)) || (demo ? seedTxs : []);
      products = (JSON.parse(localStorage.getItem(LS_PRODUCTS)) || []).map(normalizeProduct);
      activity = JSON.parse(localStorage.getItem(LS_ACTIVITY)) || (demo ? seedActivity : []);
      sales = JSON.parse(localStorage.getItem(LS_SALES)) || [];
      treasury = JSON.parse(localStorage.getItem(LS_TREASURY)) || seedTreasury;
      suppliers = JSON.parse(localStorage.getItem(LS_SUPPLIERS)) || (demo ? seedSuppliers : systemOnlyRows(seedSuppliers));
      supplierTxs = JSON.parse(localStorage.getItem(LS_SUP_TXS)) || seedSupplierTxs;
      purchases = JSON.parse(localStorage.getItem(LS_PURCHASES)) || seedPurchases;
      accounts = JSON.parse(localStorage.getItem(LS_ACCOUNTS)) || seedAccounts;
      journalEntries = JSON.parse(localStorage.getItem(LS_JOURNAL)) || seedJournal;
      users = JSON.parse(localStorage.getItem(LS_USERS)) || (demo ? seedUsers : []);
      vouchers = JSON.parse(localStorage.getItem(LS_VOUCHERS)) || seedVouchers;
      saleReturns = JSON.parse(localStorage.getItem(LS_SALE_RETURNS)) || [];
      purchaseReturns = JSON.parse(localStorage.getItem(LS_PURCHASE_RETURNS)) || [];
      // 🆕 بناء 115: الحضور والانصراف — بدون بيانات تجريبية (شركة جديدة = قائمة فاضية)
      employees = JSON.parse(localStorage.getItem(LS_EMPLOYEES)) || [];
      attendance = JSON.parse(localStorage.getItem(LS_ATTENDANCE)) || [];
      attSettings = JSON.parse(localStorage.getItem(LS_ATT_SETTINGS)) || defaultAttSettings();
      // 🆕 مهمة 98: سجل الأصول الثابتة — شركة جديدة تبدأ بقائمة فاضية (مافيش بيانات تجريبية)
      fixedAssets = JSON.parse(localStorage.getItem(LS_FIXED_ASSETS)) || [];
      // 🧮 بناء 145: ورق «الجرد بالباركود» — على الجهاز ده وبالشركة دي بس (مافيش زرع تجريبي)
      scSheets = scSheetsRead();
      scSheetCur = null;
      settings = Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(LS_SETTINGS)) || {});
      TAX.enabled = settings.taxEnabled == null ? TAX.enabled : Boolean(settings.taxEnabled);
      if (settings.taxRate != null) {
        const r = parseFloat(settings.taxRate) || 0;
        TAX.rate = r > 1 ? r / 100 : r;
      }
    } catch (e) {
      customers = demo ? seedCustomers : systemOnlyRows(seedCustomers);
      txs = demo ? seedTxs : [];
      products = [];
      activity = demo ? seedActivity : [];
      sales = [];
      treasury = seedTreasury;
      suppliers = demo ? seedSuppliers : systemOnlyRows(seedSuppliers);
      supplierTxs = seedSupplierTxs;
      purchases = seedPurchases;
      accounts = seedAccounts;
      journalEntries = seedJournal;
      users = demo ? seedUsers : [];
      vouchers = seedVouchers;
      saleReturns = [];
      purchaseReturns = [];
      employees = [];
      attendance = [];
      attSettings = defaultAttSettings();
      fixedAssets = [];
      scSheets = []; scSheetCur = null; scLoadedKey = null;   // المتصفح رفض القراءة ⇒ أساس الذاكرة راح
      settings = Object.assign({}, defaultSettings);
    }
    // 🛡 بناء 122: ذيل «أثبّت الفاضي على القرص» ما يقعّش الإقلاع. في متصفح بيرفض
    // لمس localStorage (وضع خاص قديم / iframe محجوب الكوكيز) كان بيطير Exception من
    // هنا وتفضل الشاشة بيضاء. البيانات في الذاكرة تكون اتبنيت فعلًا فوق، فالمزامنة
    // السحابية والحفظ العادي بيكملوا شغلهم — والفشل هنا محلي بحت ومش صامت (console).
    try {
      if (!localStorage.getItem(LS_CUSTOMERS)) saveCustomers();
      if (!localStorage.getItem(LS_TXS)) saveTxs();
      if (!localStorage.getItem(LS_PRODUCTS)) saveProducts();
      if (!localStorage.getItem(LS_ACTIVITY)) saveActivity();
      if (!localStorage.getItem(LS_SALES)) saveSales();
      if (!localStorage.getItem(LS_TREASURY)) saveTreasury();
      if (!localStorage.getItem(LS_SUPPLIERS)) saveSuppliers();
      if (!localStorage.getItem(LS_SUP_TXS)) saveSupplierTxs();
      if (!localStorage.getItem(LS_PURCHASES)) savePurchases();
      if (!localStorage.getItem(LS_ACCOUNTS)) saveAccounts();
      if (!localStorage.getItem(LS_JOURNAL)) persistJournal();
      if (!localStorage.getItem(LS_USERS)) saveUsers();
      if (!localStorage.getItem(LS_VOUCHERS)) saveVouchers();
      if (!localStorage.getItem(LS_SALE_RETURNS)) saveSaleReturns();
      if (!localStorage.getItem(LS_PURCHASE_RETURNS)) savePurchaseReturns();
      if (!localStorage.getItem(LS_EMPLOYEES)) saveEmployees();
      if (!localStorage.getItem(LS_ATTENDANCE)) saveAttendance();
      if (!localStorage.getItem(LS_ATT_SETTINGS)) saveAttSettings();
      if (!localStorage.getItem(LS_FIXED_ASSETS)) saveFixedAssets();
      if (!localStorage.getItem(LS_SETTINGS)) saveSettings();
    } catch (e) {
      console.warn("mizan: المتصفح رفض تثبيت الحالة على القرص — البرنامج شغال في الذاكرة", e && e.message);
    }
  }

  function saveProducts() {
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));
    pushTable("products"); syncToLocalDisk();
  }

  function saveSales() {
    localStorage.setItem(LS_SALES, JSON.stringify(sales));
    pushTable("sales"); syncToLocalDisk();
  }

  function saveTreasury() {
    localStorage.setItem(LS_TREASURY, JSON.stringify(treasury));
    pushTable("treasury"); syncToLocalDisk();
  }

  /* ================== 🆕 بناء 115: حفظ الحضور والانصراف ================== */
  function defaultAttSettings() {
    return { id: 1, workStart: "09:00", workEnd: "17:00", graceMin: 10, lunchMin: 0 };
  }
  function saveEmployees() {
    localStorage.setItem(LS_EMPLOYEES, JSON.stringify(employees));
    pushTable("employees"); syncToLocalDisk();
  }
  function saveAttendance() {
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
    pushTable("attendance"); syncToLocalDisk();
  }
  function saveAttSettings() {
    localStorage.setItem(LS_ATT_SETTINGS, JSON.stringify(attSettings));
    pushTable("att_settings"); syncToLocalDisk();
  }

  /* ================== 🆕 مهمة 98: حفظ سجل الأصول الثابتة ================== */
  // نفس مسار بقية الجداول: محلي أولًا (ما يضيعش)، ثم رفع للسحابة لو متصل، ثم لقطة الديسك.
  function saveFixedAssets() {
    localStorage.setItem(LS_FIXED_ASSETS, JSON.stringify(fixedAssets));
    pushTable("fixed_assets"); syncToLocalDisk();
  }

  function saveSuppliers() {
    localStorage.setItem(LS_SUPPLIERS, JSON.stringify(suppliers));
    pushTable("suppliers"); syncToLocalDisk();
  }

  function saveSupplierTxs() {
    localStorage.setItem(LS_SUP_TXS, JSON.stringify(supplierTxs));
    pushTable("supplier_txs"); syncToLocalDisk();
  }

  function savePurchases() {
    localStorage.setItem(LS_PURCHASES, JSON.stringify(purchases));
    pushTable("purchases"); syncToLocalDisk();
  }

  // المرتجعات (بناء 108) — نفس مسار الحفظ: محلي أولًا ثم رفع للسحابة ثم لقطة الديسك
  function saveSaleReturns() {
    localStorage.setItem(LS_SALE_RETURNS, JSON.stringify(saleReturns));
    pushTable("sale_returns"); syncToLocalDisk();
  }

  function savePurchaseReturns() {
    localStorage.setItem(LS_PURCHASE_RETURNS, JSON.stringify(purchaseReturns));
    pushTable("purchase_returns"); syncToLocalDisk();
  }

  function saveAccounts() {
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
    pushTable("accounts"); syncToLocalDisk();
  }

  function persistJournal() {
    localStorage.setItem(LS_JOURNAL, JSON.stringify(journalEntries));
    pushTable("journal_entries"); syncToLocalDisk();
  }

  function saveUsers() {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  }

  function saveVouchers() {
    localStorage.setItem(LS_VOUCHERS, JSON.stringify(vouchers));
    pushTable("vouchers"); syncToLocalDisk();
  }

  function saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }

  function saveActivity() {
    localStorage.setItem(LS_ACTIVITY, JSON.stringify(activity));
  }

  function addActivity(action, desc) {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    activity.unshift({
      ts: p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()),
      user: "admin",
      action: action,
      desc: desc
    });
    if (activity.length > 200) activity.length = 200;
    saveActivity();
  }

  function saveCustomers() {
    localStorage.setItem(LS_CUSTOMERS, JSON.stringify(customers));
    pushTable("customers"); syncToLocalDisk();
  }

  function saveTxs() {
    localStorage.setItem(LS_TXS, JSON.stringify(txs));
    pushTable("customer_txs"); syncToLocalDisk();
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* 🆕 بناء 118: قارئ المبالغ اللي في الخانات.
   * المشكلة الأصلية: الخانات دي بتتملأ بـ fmt() اللي بيفصل الآلاف بفاصلة («1,200.00»)،
   * وparseFloat بياقرأ لحد أول فاصلة بس ⇒ «1,200.00» كان بيترجع 1، و«25,000.00» بيرجع 25.
   * يعني أي تعديل على صنف أو خزينة أو عميل كان بيرمّ المبلغ لأقل من قيمته بصمت.
   * moneyVal بيشفّ الفواصل وبيطبّع الأرقام العربية، وبيرجع العدد مقسّط لخانتين. */
  function parseMoney(s) {
    const t = String(s == null ? "" : s)
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[\s,\u060C\u202B\u202C]/g, "")
      .replace(/[^\d.\-]/g, "")
      .trim();
    const n = Number(t);
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }
  function moneyVal(selId) {
    const el = typeof selId === "string" ? $(selId) : selId;
    return parseMoney(el ? el.value : "");
  }
  // نص مبلغ نضيف للحانات اللي المستخدم بيكتب فيها (بلا فواصل — عشان fmt+parseFloat كانا باگ)
  function moneyStr(n) {
    return String(Math.round((Number(n) || 0) * 100) / 100);
  }

  /* ================== 🆕 بناء 123: قاعدة «الإيراد أخضر والمصروف أحمر» ==================
   * طلب المالك: «عايز قاعدة في البرنامج: أي إيراد المبلغ يكون لونه أخضر وأي مصروف
   * المبلغ يكون لونه أحمر». وقراره 02/10: القاعدة دي على **الشاشات المالية بس** —
   * فواتير العميل/المورد وطباعةاتهم ما بتلمسهاش — ورق العميل يفضل زي ما هو.
   *
   * القاعدة كلها في مصدر واحد (moneyDirOf) عشان أي شاشة تسمّي الإيراد/المصروف بنفس
   * المعنى، ومفيش أي دالة تانية تكرّر التسمية:
   *   • سند / حركة خزينة:  type|kind = "in" / "out"
   *   • حساب من الدليل:    type = "revenue" / "expense"  أو كود شجرة 4 / 5
   *   • قيد يومية:         من أسطره (jrnDir) — واللي فيه الإيراد والمصروف بنفس الحجم
   *                        ما يتلونش: مافيش لون على تخمين.
   *   • نص عربي/إنجليزي:   "إيراد" / "مصروف" / "in" / "out" */
  function moneyDirOf(sig) {
    if (!sig) return "";
    if (typeof sig === "string") {
      const t = String(sig).trim().toLowerCase();
      if (t === "in" || t === "income" || t === "revenue" || t === "إيراد" || t === "مقبوضات") return "in";
      if (t === "out" || t === "expense" || t === "مصروف" || t === "مدفوعات") return "out";
      return "";
    }
    const ty = String(sig.type || "").trim().toLowerCase();
    if (ty === "in" || ty === "income" || ty === "revenue") return "in";
    if (ty === "out" || ty === "expense") return "out";
    const kd = String(sig.kind || "").trim().toLowerCase();
    if (kd === "in") return "in";
    if (kd === "out") return "out";
    const code = String(sig.code || "").trim();
    if (code === "4" || code.indexOf("4.") === 0) return "in";
    if (code === "5" || code.indexOf("5.") === 0) return "out";
    return "";
  }
  // اسم الكلاس اللي يلوّن الخلية (فاضي = ما تلونش — الشاشات التانية زي ما هي)
  function amtCls(sig) {
    const d = moneyDirOf(sig);
    return d === "in" ? "amt-in" : d === "out" ? "amt-out" : "";
  }
  // خلية مبلغ في جدول: نفس fmt بالضبط، و«-» وقت الصفر لو الطلب (زي ما الشاشات كانت تعرض)
  // الصفر ما يتلونش: مافيش حركة اتقالت، فالاتجاه مجهول مش «إيراد» ولا «مصروف».
  function amtTd(val, sig, zeroDash) {
    const n = Number(val) || 0;
    const zero = Math.abs(n) < 0.005;
    const c = zero ? "" : amtCls(sig);
    const txt = (zero && zeroDash) ? "-" : fmt(n);
    return "<td" + (c ? ' class="' + c + '"' : "") + ">" + txt + "</td>";
  }
  // تلوين خانة إدخال أو كارت (بـ classList — ما بيشيلش الكلاسات القديمة ولا بيكسر الستايل)
  function paintDir(sel, sig) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (!el || !el.classList) return;
    el.classList.remove("amt-in", "amt-out");
    const c = amtCls(sig);
    if (c) el.classList.add(c);
  }
  // اتجاه القيد من أسطره: كل سطر على شجرة الإيرادات بيزوّد كفة، وكل سطر على المصروفات بيزوّد كفة
  function jrnDir(j) {
    let inSum = 0, outSum = 0;
    ((j && j.lines) || []).forEach((l) => {
      const a = accounts.find((x) => Number(x.id) === Number(l && l.accountId));
      const d = moneyDirOf(a);
      const amt = (Number(l && l.debit) || 0) + (Number(l && l.credit) || 0);
      if (!d || amt <= 0) return;
      if (d === "in") inSum += amt; else outSum += amt;
    });
    if (inSum > 0 && outSum === 0) return "in";
    if (outSum > 0 && inSum === 0) return "out";
    if (Math.abs(inSum - outSum) >= 0.005) return inSum > outSum ? "in" : "out";
    return "";
  }

  function normalizeAr(s) {
    return (s || "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .trim()
      .toLowerCase();
  }

  function nextCustomerId() {
    return customers.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  }

  function nextTxId() {
    return txs.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  }

  function nextCustomerCode() {
    let max = 0;
    customers.forEach((c) => {
      const m = /^CUST-(\d+)$/.exec(c.code || "");
      if (m) max = Math.max(max, +m[1]);
    });
    // الأرقام المتقاعدة (عملاء محذوفون لهم مستندات) لا تُعاد أبدًا
    max = Math.max(max, retiredMaxNum("customer"));
    return "CUST-" + String(max + 1).padStart(4, "0");
  }

  function nextSupplierId() {
    return suppliers.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  }

  function nextSupplierCode() {
    let max = 0;
    suppliers.forEach((s) => {
      const m = /^SUPP-(\d+)$/.exec(s.code || "");
      if (m) max = Math.max(max, +m[1]);
    });
    max = Math.max(max, retiredMaxNum("supplier"));
    return "SUPP-" + String(max + 1).padStart(4, "0");
  }

  /* ================== التنبيهات ================== */
  let toastTimer = null;
  function toast(msg, type) {
    const el = $("#toast");
    el.className = "toast " + (type || "info");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3500);
  }

  /* ===== فشل المزامنة السحابية: رسالة ودّية للعميل (من غير مصطلحات تقنية) =====
     cloud.js بيندهّي الدالة دي لو أي جدول ما قدرش يترفع على السحابة.
     القاعدة: واجهة العميل تفضل نظيفة بالعربي — التشخيص التقني يروح للـ console بس. */
  const SYNC_FRIENDLY_NAMES = {
    sales: "الفواتير", sale_items: "أصناف فواتير البيع",
    purchases: "فواتير المشتريات", purchase_items: "أصناف فواتير المشتريات",
    sale_returns: "مرتجعات البيع", sale_return_items: "أصناف مرتجعات البيع",
    purchase_returns: "مرتجعات المشتريات", purchase_return_items: "أصناف مرتجعات المشتريات",
    customers: "العملاء", suppliers: "الموردين", products: "الأصناف",
    treasury: "الخزائن", accounts: "حسابات الشجرة", vouchers: "السندات",
    journal_entries: "القيود المحاسبية", journal_lines: "أسطر القيود",
    customer_txs: "حركة العملاء", supplier_txs: "حركة الموردين", settings: "ضبط الشركة",
    employees: "الموظفون", attendance: "سجل الحضور", att_settings: "مدة العمل",
    fixed_assets: "الأصول الثابتة"
  };
  let lastSyncWarnAt = 0;
  DATA.onSyncError = function (what, err) {
    try { console.warn("ميزان — المزامنة وقفت عند:", what, err && (err.message || err)); } catch (e) { }
    // إحنا أوفلاين؟ الموضوع طبيعي ومش محتاج تنبيه
    if (typeof DATA.isOnline === "function" && !DATA.isOnline()) return;
    const now = Date.now();
    if (now - lastSyncWarnAt < 60000) return;   // رسالة واحدة في الدقيقة مش أكتر
    lastSyncWarnAt = now;
    const label = SYNC_FRIENDLY_NAMES[what] || "البيانات";
    toast("رفع «" + label + "» للسحابة مكملش دلوقتي. بياناتك على الجهاز محفوظة عادي — " +
      "اتأكد من الإنترنت وبعدها احفظ أي تعديل صغير وهيتبعت كله.");
  };
  // حارس «المسح الكامل»: البرنامج وقف مسح كبير على السحابة لأن بيانات الجهاز كانت ناقصة
  DATA.onWipeBlocked = function (what, cloudCount) {
    try { console.warn("ميزان — حارس الحدى بيحمي:", what, cloudCount); } catch (e) { }
    const now = Date.now();
    if (now - lastSyncWarnAt < 60000) return;
    lastSyncWarnAt = now;
    const label = SYNC_FRIENDLY_NAMES[what] || "البيانات";
    toast("برنامجك لقى " + (cloudCount || "") + " سجل على السحابة من «" + label + "» وهو ناقص عندك،" +
      " فمسحش حاجة نهائي. أقفل البرنامج وافتحه تاني وهترجع بياناتك.");
  };

  /* ================== النوافذ ================== */
  function showModal(id) {
    $("#" + id).hidden = false;
  }

  function hideModal(id) {
    $("#" + id).hidden = true;
  }

  /* ========== «انشر على الفاتورة» — اختيار صاحب الشركة (ترحيل ٣٣) ========== */
  const INV_FIELD_KEYS = ["name", "address", "phone", "tax_number"];
  const INV_FIELD_DEFAULT = { name: true, address: true, phone: true, tax_number: true };

  function normalizeInvFields(raw) {
    const src = raw || {};
    const out = {};
    INV_FIELD_KEYS.forEach((k) => {
      const v = src[k];
      out[k] = (v === undefined || v === null)
        ? INV_FIELD_DEFAULT[k]
        : (v === true || v === "true" || v === 1 || v === "1");
    });
    return out;
  }

  // المصدر: بيانات الشركة من الضبط (سحابية إن وجدت) ← مرآة settings.invFields ← الافتراضي
  function invoicePublishFields() {
    let raw = null;
    try { raw = orgSettValue("invoice_fields", null); } catch (e) { raw = null; }
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
    if (!raw || typeof raw !== "object") raw = (settings && settings.invFields) || null;
    return normalizeInvFields(raw && typeof raw === "object" ? raw : null);
  }

  // اسم المنشأة للمطبوعات (نفس ترتيب printSection القديم)
  function invOrgName() {
    const settOrg = (csetData && csetData.org) || (ssetData && ssetData.org);
    return (settOrg && settOrg.name) || (settings && settings.orgName) ||
      (DATA.org && DATA.org() && DATA.org().name) || "مؤسستي التجارية";
  }

  // تعبئة ترويسة الفاتورة ببيانات المنشأة حسب الصناديق المختارة
  function fillInvoiceOrgHead(prefix) {
    const f = invoicePublishFields();
    const ids = prefix === "inv"
      ? { name: "invOrgName", address: "invOrgAddress", phone: "invOrgPhone", vat: "invOrgVat" }
      : { name: "ppOrgName", address: "ppOrgAddress", phone: "ppOrgPhone", vat: "ppOrgVat" };
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set(ids.name, f.name ? String(invOrgName()) : "");
    const addr = f.address ? String(orgSettValue("address", (settings && settings.orgAddress) || "") || "").trim() : "";
    const phone = f.phone ? String(orgSettValue("phone", (settings && settings.orgPhone) || "") || "").trim() : "";
    const vat = f.tax_number ? String(orgSettValue("tax_number", (settings && settings.orgVat) || "") || "").trim() : "";
    set(ids.address, addr ? "العنوان: " + addr : "");
    set(ids.phone, phone ? "هاتف: " + phone : "");
    set(ids.vat, vat ? "الرقم الضريبي: " + vat : "");
    return f;
  }

  // ملاحظات وشروط تطبع أسفل الفاتورة (سطر المنشأة + الضمان)
  function invNotesHtml(isSale) {
    const note = String(orgSettValue("org_note", (settings && settings.orgNote) || "") || "").trim();
    const warranty = String(orgSettValue("warranty_terms", (settings && settings.orgWarranty) || "") || "").trim();
    let h = "";
    if (note) h += '<p><span class="inv-notes-title">ملاحظات: </span>' + esc(note) + '</p>';
    if (warranty) h += '<p><span class="inv-notes-title">شروط الضمان: </span>' + esc(warranty) + '</p>';
    if (!h) h = '<p class="inv-empty">' + (isSale ? "شكراً لتعاملكم معنا." : "رجاءً التأكد من البضاعة عند الاستلام.") + '</p>';
    return h;
  }

  // بلوك الإجماليات (بدل سطر « | » القديم)
  function invTotalsHtml(rows) {
    return rows.map((r) =>
      '<div class="inv-total-row' + (r.grand ? " grand" : "") + '"><span>' + esc(r.label) +
      '</span><b>' + r.value + '</b></div>').join("");
  }

  function invTotalRows(isSale, inv) {
    const taxLabel = String(orgSettValue("tax_title", "") || "الضريبة").trim() || "الضريبة";
    const rows = [{ label: "المجموع", value: fmt(inv.subTotal) + " ج.م" }];
    if (Number(inv.discountAmount)) rows.push({ label: "الخصم الإضافي", value: fmt(inv.discountAmount) + " ج.م" });
    if ((inv.taxAmount > 0) || (TAX.enabled && TAX.rate > 0)) rows.push({ label: taxLabel, value: fmt(inv.taxAmount) + " ج.م" });
    const rt = retTotalsFor(isSale, inv);
    if (rt.count) {
      rows.push({ label: "الصافي النهائي", value: fmt(inv.grandTotal) + " ج.م" });
      rows.push({ label: "المرتجعات (" + rt.count + ")", value: fmt(rt.value) + " ج.م" });
      rows.push({ label: "الصافي بعد المرتجعات", value: fmt(Math.max(0, (Number(inv.grandTotal) || 0) - rt.value)) + " ج.م", grand: true });
    } else {
      rows.push({ label: "الصافي النهائي", value: fmt(inv.grandTotal) + " ج.م", grand: true });
    }
    return rows;
  }

  /* ===== حجم ورق الطباعة من الضبط (A4 / A5 / حراري 80mm) ===== */
  function printPaperSize() {
    let p = "";
    try { p = String(orgSettValue("paper_size", (settings && settings.paperSize) || "A4") || "A4").toLowerCase().trim(); } catch (e) { p = "a4"; }
    if (p === "a5") return "a5";
    if (p.indexOf("thermal") === 0 || p.indexOf("حراري") === 0 || p === "80mm") return "thermal";
    return "a4";
  }

  function applyPrintPaper(el) {
    const z = printPaperSize();
    el.classList.remove("paper-a4", "paper-a5", "paper-thermal");
    el.classList.add("paper-" + z);
    let st = document.getElementById("mizanPrintPageSize");
    if (!st) { st = document.createElement("style"); st.id = "mizanPrintPageSize"; document.head.appendChild(st); }
    // هامش فوق/تحت 5mm عمدًا: كروم/إيدچ بيحتاجوا ≈7mm فوق وتحت عشان يرسموا «رأس وتذييل الصفحة»
    // (العنوان/التاريخ/عنوان الموقع/أرقام الصفحات) — بأقل من كده ما بيظهروش على الورقة خالص.
    // التعويض الرأسي بيحصل جوه المستند نفسه (padding في styles.css) عشان الشكل ما يتأثرش.
    st.textContent = z === "a5" ? "@page { size: A5; margin: 5mm 8mm; }"
      : z === "thermal" ? "@page { size: 80mm auto; margin: 3mm; }"
      : "@page { size: A4; margin: 5mm 10mm; }";
    return z;
  }

  // 🚫 متصفحات كروم/إيدچ «رأس وتذييل الصفحة» (متفعّل افتراضيًا) بتطبع document.title على الورقة.
  // لذلك وقت الطباعة بنستبدل العنوان باسم نوع المستند (نظيف) ونرجّعه أول ما تخلص —
  // وعبر beforeprint/afterprint كمان عشان مسار Ctrl+P من المتصفح بدون زرار البرنامج.
  // عشان اسم المبرمج ورقمه وتوقيع البرنامج ما يطلعوش على ورقة العميل أبدًا (قاعدة المالك: البراند على الشاشات بس).
  const PRINT_DOC_TITLES = {
    invoicePage: "فاتورة بيع",
    purchasePage: "فاتورة شراء",
    statementPage: "كشف حساب",
    stockPage: "تقرير المخزون",
    stockCountPage: "الجرد بالباركود",
    balancePage: "كشف الأرصدة",
    treStmtPage: "كشف الخزينة",
    attReportPage: "تقرير الحضور والانصراف",
    fixedAssetsPage: "سجل الأصول الثابتة",
    barcodePage: "ملصقات الباركود",
  };
  const PAPER_TITLE_FALLBACK = "مستند"; // بلا اسم منتج ولا اسم شخص
  let screenDocTitle = "";
  let paperDocTitle = "";
  let paperTitleOn = false;

  function enterPaperTitle(docId) {
    if (paperTitleOn) return;
    try { screenDocTitle = document.title; } catch (e) { screenDocTitle = ""; }
    paperDocTitle = (docId && PRINT_DOC_TITLES[docId]) || PAPER_TITLE_FALLBACK;
    document.title = paperDocTitle;
    paperTitleOn = true;
  }
  function exitPaperTitle() {
    if (!paperTitleOn) return;
    if (document.title === paperDocTitle) document.title = screenDocTitle;
    paperTitleOn = false;
  }
  // يغطّي كمان Ctrl+P من المتصفح مباشرة (من غير زرار الطباعة في البرنامج)
  window.addEventListener("beforeprint", function () { enterPaperTitle(null); });
  window.addEventListener("afterprint", exitPaperTitle);

  function printSection(el) {
    if (!el) return;
    // اسم الشركة من الضبط (لكل شركة على حدة) يظهر في كل صفحات الطباعة
    // ملاحظة: صفحتا الفاتورة (بيع/شراء) تملآن ترويستهما بنفسها احترامًا لصناديق «على الفاتورة».
    const org = invOrgName();
    [["stmOrgName"], ["skOrgName"], ["blpOrgName"], ["trpOrgName"], ["bcpOrgName"], ["sckOrgName"]].forEach(([id]) => {
      const x = document.getElementById(id);
      if (x) x.textContent = org;
    });
    applyPrintPaper(el);
    document.querySelectorAll(".print-only").forEach((s) => s.classList.remove("print-target"));
    el.classList.add("print-target");
    document.body.classList.add("printing");
    enterPaperTitle(el.id); // عنوان نظيف طول فترة الطباعة، ويرجع عنوان الشاشة أول ما تخلص

    const cleanup = () => {
      exitPaperTitle();
      el.classList.remove("print-target");
      el.classList.remove("paper-a4", "paper-a5", "paper-thermal");
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1200);
  }

  /* ================== الروترة بين الشاشات ================== */
  const BUILT_VIEWS = ["dashboard", "customers", "products", "sales", "purchases", "suppliers", "returns", "returnsReg", "treasury", "accounts", "journal", "balance", "treasuryStatements", "reports", "users", "audit", "settings", "clientSettings", "attendance",
    // 🆕 بناء 125: دول كانوا **ناقصين من القائمة** فزرار «كشف حساب الحسابات»
    // (build 117) وزرار «الأصول الثابتة» (build 117) كانوا بيرموا «قيد التطوير»
    // بدل ما يفتحوا الشاشة — باگ حيّ على 124، اتصلّح هنا وبالحارس الثابت.
    "accStatement", "fixedAssets", "stockCount",
    // 💬 الدردشة الداخلية (بند 16)
    "chat"];

  // حساب المستخدم الحالي — المصدر الموثوق هو mizan_access (فيه role + is_superadmin)
  // لأن getProfile() قد يكون null أو ناقصًا لحظة الدخول.
  function currentAcct() {
    var DE = window.DATA || {};
    var a = DE.accessInfo ? DE.accessInfo() : null;
    if (a && a.role) return a;
    var p = DE.getProfile ? DE.getProfile() : null;
    if (p && p.role) return p;
    return a || p || null;
  }

  /* ══════ 🧭 التعريف القانوني الوحيد لـ «مالك الشركة» (بناء 126) ══════
     قرار المالك الحرفي (03/10): «البرنامج بيعرّف صاحب الشركة بـ«مدير مش مالك».
     إما يتوحّد على تعريف البرنامج» ⇒ التعريف المتَّفق عليه = **تعريف البرنامج نفسه**:
         مالك الشركة = الحساب اللي `role === "admin"` وليس `is_superadmin`.
     ممنوع أي سطر تاني يعيد كتابة الشرط ده أو يخترع تعريفًا بديلًا — كل الأبواب
     (الشاشات، الحذف، تغيير الرقم السري، شاشة الحسابات، الدردشة) بتنادي الدالة دي.
     (السحابة فيها `organizations.owner_id` = عمود تاني، وعلى البيانات الحالية كله
      عادل ⇒ ما يصلحش تعريفًا للواجهة؛ الفرع السحابي بيتوحّد في ترقية ٤٦ بنفس المعنى.) */
  function isCompanyOwnerRow(r) {
    return !!(r && r.role === "admin" && !r.is_superadmin);
  }
  // صاحب الشركة = role admin وليس سوبر أدمن (الحساب الحالي)
  function isCompanyOwnerAcct() {
    return isCompanyOwnerRow(currentAcct());
  }
  /* التسمية العربية الوحيدة للصلاحية في أي مكان يظهر للعميل — لا «مدير»، لا «admin» الخام.
     قاعدة الواجهة (memory: ممنوع نص تقني مخيف للعميل): المستخدم ما يشوفش الكلمة الإنجليزية. */
  function roleLabel(r) {
    if (r && r.is_superadmin) return "مالك البرنامج";
    if (isCompanyOwnerRow(r)) return "مالك الشركة";
    return "عضو";
  }
  function isSuperAcct() {
    var r = currentAcct();
    if (r && r.is_superadmin) return true;
    // 🛡 بناء 121 (طلب المالك: لوحة الإدارة «متختفيش ابدا من عندي»):
    // لحظة الدخول ممكن مصدر واحد (mizan_access) يوصل ناقص العمود، فالمالك يتعرّف
    // من أي مصدر **سحابي** تاني بنفس العلم — والمصادر دي كلها جاية من القاعدة
    // (access / profile / me)، مش من أي إدخال أو localStorage بتاع المستخدم.
    var DE = window.DATA || {};
    try {
      var a = DE.accessInfo ? DE.accessInfo() : null;
      if (a && a.is_superadmin) return true;
      var p = DE.getProfile ? DE.getProfile() : null;
      if (p && p.is_superadmin) return true;
      var me = DE.me ? DE.me() : null;
      if (me && me.is_superadmin) return true;
    } catch (e) { }
    return false;
  }

  // 🔓 قرار المالك النهائي (build 119): حساب عادل = المالك — كل الصلاحيات دائمًا،
  // ومفيش أي شاشة أو تبويب يقفل عليه بسبب قفل الشركة أو انتهاء الاشتراك أو قائمة المزايا.
  // دي بوابة الواجهة فقط: عزل البيانات على السحابة (RLS/current_org) ما اتغيرش.
  function ownerHasAllAccess() { return isSuperAcct(); }

  /* 🔑 بناء 133 — «الإعدادات (المالك)» مش صلاحية تتداول: لمالك البرنامج ولحسابات شركة ميزان.
     أمر المالك الحرفي (04/10): «اعدادات المالك موجوده ليه فى اختيارات مزايا الشركات
     انا مش عايزها تظهر فى اختيارات الصلاحيات لانها تخص مالك البرنامج عادل فقط
     عايزها تظهر فقط عن اعضاء شركة ميزان فقط حساب عادل المالك و حسابات شركة ميزان فقط»
     ⇒ (١) مفتاح `settings` اتشال من **كل** نوافذ الاختيار (مزايا الشركة / صلاحيات حساب /
        حساب جديد) ومن ملخص المزايا ⇒ مافيش صاحب شركة يفتحه أو يقفله لحد، ومافيش «مكان فاضي»
        مكانه (بناء 132)؛
     (٢) البوابة الوحيدة = `ownerSettingsAllowed()`: مالك البرنامج (سوبر أدمن) أو حساب شركته «ميزان»؛
     (٣) **اللي مابيدّلش:** لوحة الإدارة (`admin`) وتبويب/أزرار **النسخ الاحتياطي** (`sbak` +
        `btnBackupAll/2`) فضلا **لمالك البرنامج وحده** — قراراته السابقة (build 94: «النسخ
        الاحتياطي للمالك adel فقط»، و121: «لوحة الإدارة متظهرش عند حد تاني ابدا») سارية.
     ⚠️ المفتاح المحفوظ في `organizations.features`/`profiles.features` ما يتلمّش (بيفضل زي ما
        هو ويتنقل في أي حفظ جديد) — بس بقى **بلا معنى** في الواجهة، فمافيش migration ولا مسح بيانات. */
  const OWNER_ONLY_FEATS = ["settings"];
  const MIZAN_ORG_ID = "72597c1b-90e5-40d2-a318-fc9c426e1dc2"; // «mizan» = شركة المالك على القاعدة الحيّة
  function arnNorm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[ً-ْـ]/g, "")                        // حركات + تطويل
      .replace(/[\s\-_/().،,]+/g, "")                 // فواصل
      .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
  }
  function isMizanOrgName(name) {
    var n = arnNorm(name);
    if (!n) return false;
    return n === "mizan" || n === "ميزان" || n.indexOf("mizan") === 0 || n.indexOf("ميزان") === 0;
  }
  // org الحالي من **مصادر سحابية** بس (mizan_access / org / profile / me) — بلا localStorage
  function acctOrgRef() {
    var DE = window.DATA || {}, out = { id: null, name: null };
    try { var a = DE.accessInfo ? DE.accessInfo() : null; if (a) { out.id = a.org_id || null; out.name = a.org_name || null; } } catch (e) { }
    try { var o = DE.org ? DE.org() : null; if (o) { if (!out.id) out.id = o.id || null; if (!out.name) out.name = o.name || null; } } catch (e) { }
    if (!out.id) { try { var p = DE.getProfile ? DE.getProfile() : null; if (p) out.id = p.org_id || null; } catch (e) { } }
    if (!out.id) { try { var m = DE.me ? DE.me() : null; if (m) out.id = m.org_id || null; } catch (e) { } }
    return out;
  }
  function inMizanOrg() {
    var r = acctOrgRef();
    if (r.id && r.id === MIZAN_ORG_ID) return true;
    return isMizanOrgName(r.name);
  }
  // البوابة الوحيدة لـ «الإعدادات (المالك)»
  function ownerSettingsAllowed() { return isSuperAcct() || inMizanOrg(); }
  // القوائم اللي تعرض للعميل اختيارات: دايماً من غير المفاتيح المحجوزة للمالك
  function chooserFeatures() {
    return ADMIN_FEATURES.filter(function (row) { return OWNER_ONLY_FEATS.indexOf(row[0]) === -1; });
  }
  // أي حفظ جديد لازم يعدي المفتاح المحفوظ زي ما هو (صفر تغيير في بيانات موجودة)
  function carryOwnerOnlyFeats(target, stored) {
    var s = (stored && typeof stored === "object") ? stored : {};
    OWNER_ONLY_FEATS.forEach(function (k) { if (k in s) target[k] = s[k]; });
    return target;
  }
  // 🔑 بناء 133: «النسخ الاحتياطي الشامل» و«الاستعادة» و«مسح البيانات» يفضلوا **للمالك وحده**
  // (قرار build 94)، فأي حساب تاني في شركة ميزان بقى يفتح شاشة «الضبط» ما يلمّش النسخ.
  // دي طبقة تانية جوه الدوال نفسها — مش الاعتماد على إن الزرار مخفي.
  function requireSuperOwner(what) {
    if (ownerHasAllAccess() || !!window.__isOwner) return true;
    toast(what + " لحساب مالك البرنامج فقط", "error");
    return false;
  }

  // هل الوصول مُسمح بهيكلة الواجهة؟ المالك استثناء ثابت من القفل/الانتهاء.
  function accessGranted(acc) {
    return !!(acc && (acc.allowed || acc.is_superadmin));
  }

  /* 🔐 بناء 131 — «اللي أحدده بيتنفّذ وما بيرجعش»: مصدر واحد للحظر الصريح.
   * السبب الجذري لشكوى المالك: كان في كام طبقة بتبلّع قراره —
   *  (أ) `canUseView` كان بيقول «صاحب الشركة = كل حاجة مفتوحة» قبل ما يقرأ قرار الشركة،
   *  (ب) مزامنة `mizan_access()` بتدمج `profiles.features || organizations.features`
   *      فقرار مستوى الحساب بيمحي لو مستوى الشركة قائل «أيوه» على نفس المفتاح،
   *  (ج) نافذة «⚙️ المزايا» كانت بتفتح وكل الصناديق معلّمة ⇒ أي حفظ جديد كان بيرجّع
   *      الشركة «كل الصلاحيات» (وده اللي كان بيشوفه «بيترجع تاني»).
   * القاعدة هنا: **أي «لأ» صريحة في أي مستوى = مقفول**، وأدرج المالك (عادل) محصّن
   * فوق ده كلها بـ `ownerHasAllAccess()` (قراره في build 119 ما اتغيرش).
   */
  const VIEW_FEAT_KEY = { returnsReg: "returnsManager", accStatement: "journal", stockCount: "products" };
  function featKeyOf(viewName) { return VIEW_FEAT_KEY[viewName] || viewName; }
  function permExplicitlyOff(viewName) {
    var DE = window.DATA || {};
    var k = featKeyOf(viewName);
    var acc = null;
    try { acc = DE.accessInfo ? DE.accessInfo() : null; } catch (e) { acc = null; }
    var merged = (acc && acc.features) || {};
    if (merged[k] === false) return true;      // قرار مستوى الشركة (تحديده في لوحة الإدارة)
    var prof = null;
    try { prof = DE.getProfile ? DE.getProfile() : null; } catch (e) { prof = null; }
    var own = (prof && prof.features) || {};
    return own[k] === false;                   // قرار مستوى الحساب (تحديد صاحب الشركة لموظفيه)
  }

  /* 🧭 بناء 131: الزرار المقابل في القائمة الجانبية — بتاع `showView` العام.
   * ليه مش أي معرّف؟ لأن الشاشات اللي مالهاش زرار (لوحة الإدارة/النوافذ) ليها
   * بواباتها الخاصة فوق، والحظر العام عليها ممكن يقفل حاجة مش مفروض تقفل.
   */
  function navBtnOf(viewName) {
    try { return document.querySelector('.nav-btn[data-view="' + viewName + '"]'); } catch (e) { return null; }
  }
  function viewHasNavEntry(viewName) { return !!navBtnOf(viewName); }
  function navLabelOf(viewName) {
    var b = navBtnOf(viewName);
    // ننزع الإيموجي اللي قبل الاسم (الرسالة للعميل بالعربي، مش أيقونات)
    var t = b ? (b.textContent || "").replace(/\s+/g, " ").trim() : "";
    return t.replace(/^[^؀-ۿA-Za-z]+/, "").trim();
  }

  // 🔑 زر تغيير الرقم السري في الشريط العلوي — لصاحب الشركة والسوبر أدمن
  function enforceChangePwBtn() {
    var btn = document.getElementById("btnChangePw");
    if (!btn) return;
    var show = isSuperAcct() || isCompanyOwnerAcct();
    btn.hidden = !show;
    if (show) {
      btn.title = isSuperAcct()
        ? "الرقم السري لحسابك في البرنامج"
        : "الرقم السري لحساب صاحب الشركة — سيظهر الجديد عند مالك البرنامج";
    }
  }

  // هل يُسمح بعرض هذه الشاشة لهذا الحساب؟
  // «إعدادات مؤسستك» و«المرتجعات» استثناءً: يجب أن يفعّلها صاحب الشركة **صريحًا** (opt-in).
  // المالك العام وصاحب الشركة مسموح لهما دائمًا لأن البيانات شركتهما.
  function canUseView(name) {
    var DE = window.DATA || {};
    // 💬 الدردشة (بناء 125): الاستثناء الوحيد من «المالك يفتح أي شاشة» هنا — ومش
    // قفل على المالك، دي حالة إن جدول الرسايل نفسه لسه مش على السحابة (ترقية ٤٥
    // مستنية أمره الصريح). إظهار تبويب فاضي = أمان كاذب، فالتبويب بيظهر لوحده
    // أول ما الفحص السحابي يلاقي الجدول — لأي حساب بما فيهم المالك نفسه.
    if (name === "chat") return chatAvailable();
    // 🔓 المالك (عادل) يفتح أي شاشة بلا استثناء — قرار المالك build 119
    if (ownerHasAllAccess()) return true;
    // 🔑 بناء 133: «إعدادات المالك» خارج التداول — قرارها مش من قوائم المزايا ولا من
    // قرار صاحب الشركة؛ الحساب اللي شركة اسمها «ميزان» يفتحها، وغير كده لأ (source of truth
    // واحد: `ownerSettingsAllowed()`) — علشان كده الفحص ده **قبل** `permExplicitlyOff`.
    if (name === "settings") return ownerSettingsAllowed();
    // 🆕 بناء 131: أي «لأ» صريحة (من مستوى الشركة أو مستوى الحساب) بتقطع هنا —
    // قبل أي اختصار «صاحب الشركة»، فقرار التحديد ما بيرجعش «كل الصلاحيات».
    if (permExplicitlyOff(name)) return false;
    if (name === "clientSettings") {
      if (isSuperAcct() || isCompanyOwnerAcct()) return true;
      if (!DE.featureFlag) return true; // احتياطي: لو الدالة غير موجودة نسمح
      return DE.featureFlag("clientSettings") === true;
    }
    // 🔁 شاشة المرتجعات: صلاحية مستقلة opt-in (بناء 108)
    if (name === "returnsReg") {
      if (isSuperAcct() || isCompanyOwnerAcct()) return true;
      if (!DE.featureFlag) return false;
      return DE.featureFlag("returnsManager") === true;
    }
    // 🆕 بناء 115: الحضور والانصراف — صلاحية مستقلة opt-in بنفس نمط المرتجعات
    if (name === "attendance") {
      if (isSuperAcct() || isCompanyOwnerAcct()) return true;
      if (!DE.featureFlag) return false;
      return DE.featureFlag("attendance") === true;
    }
    // 🆕 مهمة 98: سجل الأصول الثابتة — نفس نمط الحضور: المالك وصاحب الشركة دائمًا، والعضو عند التفعيل الصريح
    if (name === "fixedAssets") {
      if (isSuperAcct() || isCompanyOwnerAcct()) return true;
      if (!DE.featureFlag) return false;
      return DE.featureFlag("fixedAssets") === true;
    }
    // 🆕 بناء 115: القيود اليومية (اليدوي المحاسبي + التسجيل المبسط) — لصاحب الشركة والمالك فقط
    if (name === "journal") return isSuperAcct() || isCompanyOwnerAcct();
    // 🆕 شاشة «كشف حساب الحسابات» (من القيود اليومية) — نفس بوابة القيود بالظبط
    if (name === "accStatement") return isSuperAcct() || isCompanyOwnerAcct();
    // 🛡 بناء 121 (طلب المالك: لوحة الإدارة «متظهرش عند حد تاني ابدا»):
    // لوحة الإدارة = لحساب المالك (سوبر أدمن) **حصريًا** — لا قائمة مزايا الشركة
    // ولا دور «مالك شركة» ولا تفعيل صريح يقدر يفتحها لغيره. (المالك وصلها فوق بـ ownerHasAllAccess)
    if (name === "admin") return isSuperAcct();
    return DE.featureEnabled ? DE.featureEnabled(name) : true;
  }

  // صلاحية تسجيل/حذف المرتجعات (نفس بوابة الشاشة + فحص ثانٍ جوه الدوال)
  function canManageReturns() { return canUseView("returnsReg"); }
  // 🆕 بناء 115: صلاحية الحضور والانصراف (بوابة الشاشة + فحص ثانٍ جوه دوال التسجيل/التعديل)
  function canManageAttendance() { return canUseView("attendance"); }
  // 🆕 مهمة 98: صلاحية «سجل الأصول الثابتة» (بوابة الشاشة + فحص ثانٍ جوه دوال التسجيل/الحذف)
  function canManageFixedAssets() { return canUseView("fixedAssets"); }
  // التعديل اليدوي لوقت/حالة سجل موجود يحتاج صلاحية مستقلة «attendanceEdit» (opt-in).
  // التسجيل اليومي العادي ياخد وقت النظام تلقائيًا من غير إدخال.
  // كل تعديل يدوي بيعدي عبر mizan_att_edit فيتنفَّذ على السحابة ويُسجَّل بالقديم/الجديد/السبب.
  function canEditAttendance() {
    // 🆕 بناء 131: نفس قاعدة الحظر الصريح (مش بس للشاشة — للتعديل اليدوي كمان)
    if (!isSuperAcct() && permExplicitlyOff("attendanceEdit")) return false;
    if (isSuperAcct() || isCompanyOwnerAcct()) return true;
    var DE = window.DATA || {};
    if (!DE.featureFlag) return false;
    return DE.featureFlag("attendanceEdit") === true;
  }

  // 🔓 «الضبط الخاص بيا» + «💾 النسخ الاحتياطي»: يظهران لحساب المالك دائمًا وأبدًا،
  // ولا يراهما أي حساب تاني إطلاقًا (طلب المالك 2026-10-01).
  // بتتردّد بعد كل بوابة/تبويب/دخول، فمافيش مسار يخفيهم تاني.
  // الحسابات التانية: التبويب مش بس مخفي — متشال من الـ DOM (سياسة build 94).
  //
  // 🛡 بناء 120 (طلب المالك: «ميختفيش من عندي أبدًا زي ما حصل قبل كده»):
  // بنحتفظ بـ **مرجع نفس العقدة** مش نسخة منها — فلما أي كود (حالي أو مستقبلي)
  // يخفيها أو يفصلها من الشجرة، re-attach بمرجعها بيرجعها بكل الـ listeners
  // الملزوقة فيها (لو بنيت عقدة جديدة من الصفر كان التبويب هيطلع فاضي).
  // وسياسة الإظهار مختلفة لكل عقدة: أزرار الشريط = دايمًا ظاهرة، لكن اللوحات
  // (bkPane / viewSettings) بتكون hidden بالتصميم وقت ما تبويب تاني نشيط —
  // دول بنرجعهم بس لو اتفصلوا، أو لو تبويبهم نفسه هو النشيط.
  const OWNER_TAB_NODES = [];
  // 🛡 بناء 121: عقد «لوحة الإدارة» اللي مفروض **تفضل ظاهرة** للمالك وهو واقف على اللوحة
  // (شريط الأزرار + صناديق المحتوى). اللوحات اللي بتتفتح بالزرار — adminSubs / adminDetail /
  // adminAccounts / adminPwBox — **مش** في القائمة دي عمدًا: الإخفاء بتاعها مشروّع لحد ما
  // المالك يضغط زرارها، فالحارس ما يعاندش فتح/قفل اللوحات.
  const ADMIN_PANEL_NODES = ["btnAdminRefresh", "btnAdminAddOrg", "btnAdminSubs",
    "btnAdminAccounts", "btnAdminPw", "btnAdminLog", "adminStats", "adminAlerts", "adminList"];
  // 🛡 بناء 121: آخر شاشة مفتوحة فعلًا — الحارس بيفهم منها إن «لوحة الإدارة»
  // مفروض ظاهرة دلوقتي (لأنها بتتخفي مشروّع لما أي شاشة تانية تتفتح).
  let ownerCurrentView = "";
  function rememberOwnerNode(node, parent, label, mode) {
    if (!node || !parent) return;
    if (!OWNER_TAB_NODES.some((r) => r.label === label)) {
      OWNER_TAB_NODES.push({ node: node, parent: parent, label: label, mode: mode || "show" });
    }
  }
  function ownerNodeIsHurt(rec) {
    if (!rec) return false;
    const el = rec.node;
    if (el.parentNode !== rec.parent) return true;                       // اتفصلت من الشجرة
    if (el.style && (el.style.display === "none" || el.style.visibility === "hidden")) return true;
    if (rec.mode !== "attach" && el.hidden) return true;                 // مخفية وهي مفروض دايمًا ظاهرة
    if (rec.mode === "attach" && el.hidden && rec.label === "bkPane") {
      const t = document.querySelector('#setTabs .tab-btn[data-tab="sbak"]');
      return !!(t && t.classList.contains("active"));                    // تبويبها نشيط واللوحة مخفية
    }
    if (rec.mode === "attach" && el.hidden && rec.label === "viewSettings") {
      const n = document.querySelector('.nav-btn[data-view="settings"]');
      return !!(n && n.classList.contains("active"));                    // واقف على الضبط والشاشة مخفية
    }
    // 🛡 لوحة الإدارة (بناء 121): المالك واقف عليها والشاشة اتخفت = أذى.
    // أما وهي شاشة تانية مفتوحة فالإخفاء مشروّع (كود showView نفسه).
    if (rec.mode === "attach" && el.hidden && rec.label === "viewAdmin") {
      return ownerCurrentView === "admin";
    }
    return false;
  }
  function ownerSettingsNeedsRepair() {
    return OWNER_TAB_NODES.some((rec) => ownerNodeIsHurt(rec));
  }
  function showOwnerNode(el) {
    if (!el) return;
    if (el.hidden) el.hidden = false;
    if (el.style) {
      if (el.style.display === "none") el.style.display = "";
      if (el.style.visibility === "hidden") el.style.visibility = "";
    }
  }
  function restoreOwnerNode(rec) {
    if (!rec) return;
    if (rec.node.parentNode !== rec.parent) {
      try { rec.parent.appendChild(rec.node); } catch (e) { return; }
    }
    // «attach» = اللوحة: الإظهار بيحكمه التبويب النشيط، فنرجعها بس لو مكسورة فعلًا
    if (rec.mode === "attach") { if (ownerNodeIsHurt(rec)) showOwnerNode(rec.node); }
    else showOwnerNode(rec.node);
  }
  function restoreOwnerNodeByLabel(label) {
    const rec = OWNER_TAB_NODES.filter((r) => r.label === label)[0];
    if (rec) restoreOwnerNode(rec);
  }
  // 🔑 بناء 133: «الشيل من الشجرة» لازم يبقى قابل للتراجع **في نفس الصفحة**.
  // سياسة build 94/132 بتعمل removeChild للحساب اللي مالوش القسم، والـ logout ما
  // بيعملش reload (زي 9862) ⇒ لو صاحب شركة «ناجي» خرج ودخل بحساب عادل من غير ما
  // الصفحة تتحمّل من جديد، الزرار كان يفضل مفقود للأبد — وهي نفس شكوى build 120/121
  // («متختفيش من عندي أبدا»). فبنخزّن العقدة ومكانها قبل الشيل، ونرجّعها لمين؟
  // **للمسموح له بس** (`canSet`) — الإرجاع مش في قائمة `OWNER_TAB_NODES` عشان
  // فرع المالك/الحارس الحيّ ما يرجّعوش لحساب مرفوض.
  const DETACHED_OWNERS = {};
  function detachOwnerNode(key, node) {
    if (!node || !node.parentNode) return;
    if (!DETACHED_OWNERS[key]) {
      DETACHED_OWNERS[key] = { node: node, parent: node.parentNode, next: node.nextSibling };
    }
    try { node.parentNode.removeChild(node); } catch (e) { }
  }
  function attachOwnerNode(key) {
    const d = DETACHED_OWNERS[key];
    if (!d) return;
    if (d.node.parentNode === d.parent) { delete DETACHED_OWNERS[key]; return; }
    try {
      d.parent.insertBefore(d.node, (d.next && d.next.parentNode === d.parent) ? d.next : null);
    } catch (e) { return; }
    delete DETACHED_OWNERS[key];
  }
  function enforceOwnerSettings() {
    const isOwner = ownerHasAllAccess() || !!window.__isOwner;
    // 🔑 بناء 133: «الضبط» بقى له تعريف نفسه: المالك + حسابات شركة «ميزان» (أمره الحرفي).
    // بس **لوحة الإدارة** و**النسخ الاحتياطي** (تبويب + لوحة + الزرارين) فضلا للمالك وحده —
    // قراراته السابقة (build 94 «النسخ الاحتياطي لadel فقط» و121 «لوحة الإدارة متظهرش عند حد تاني») سارية.
    const canSet = ownerSettingsAllowed();
    // المرجع يتقفل أول ما نرجّع العقدة لمكانها، وإلا `svNav` تحت بيرجع null
    // لدورة مسموحة جاية بعد شيل في دورة مرفوضة على نفس الصفحة.
    if (canSet) attachOwnerNode("nav");
    const setTabs = document.getElementById("setTabs");
    const vSet = document.getElementById("viewSettings");
    const svNav = document.querySelector('.nav-btn[data-view="settings"]');
    const bkTabEl = document.querySelector('#setTabs .tab-btn[data-tab="sbak"]');
    const bkPaneEl = document.querySelector('#viewSettings .sett-pane[data-pane="sbak"]');
    // 🧱 بناء 132: أبوها بيتقاس منها مش «السايدبار» — الزرار بقى جوّه قائمة منسدلة،
    // فلو الحارس يرجّعها لأبو قديم كانت هتتنقل بره القسم وتسيبه فاضي.
    if (canSet) {
      rememberOwnerNode(svNav, svNav && svNav.parentNode, "nav", "show");
      rememberOwnerNode(vSet, vSet && vSet.parentNode, "viewSettings", "attach");
    }
    if (isOwner) {
      rememberOwnerNode(bkTabEl, setTabs, "bkTab", "show");
      rememberOwnerNode(bkPaneEl, vSet, "bkPane", "attach");
    }
    const btnAd = document.getElementById("btnAdmin");
    if (isOwner) rememberOwnerNode(btnAd, btnAd && btnAd.parentNode, "btnAdmin", "show");
    // 🛡 بناء 121 (طلب المالك: «تحصين لوحة الإدارة ضروري حالا… متختفيش ابدا من عندي»):
    // شاشة اللوحة نفسها + أزرارها + محتواها — بنفس مبدأ «مرجع العقدة الحيّ» بتاع 120.
    // اللوحة attach (بتتخفي مشروّع لما شاشة تانية تتفتح)، والأزرار/المحتوى show.
    const vAd = document.getElementById("viewAdmin");
    if (isOwner) rememberOwnerNode(vAd, vAd && vAd.parentNode, "viewAdmin", "attach");
    if (isOwner) ADMIN_PANEL_NODES.forEach((id) => {
      const b = document.getElementById(id);
      rememberOwnerNode(b, b && b.parentNode, id, "show");
    });
    if (isOwner) ["btnBackupAll", "btnBackupAll2"].forEach((id) => {
      const b = document.getElementById(id);
      rememberOwnerNode(b, b && b.parentNode, id, "show");
    });

    if (!canSet) {
      // سياسة build 94: الحساب اللي القسم ده مالوش عنده — بيتشال من الشجرة مش مخفي بس
      // (وبخزّن مكانه في `DETACHED_OWNERS` عشان دورة مسموحة بعد كده على نفس الصفحة ترجّعه)
      detachOwnerNode("nav", document.querySelector('.nav-btn[data-view="settings"]'));
      if (vSet) vSet.hidden = true;
    }
    if (!isOwner) {
      const ba0 = document.getElementById("btnAdmin"); if (ba0) ba0.hidden = true;
      // 🛡 بناء 121: «متظهرش عند حد تاني ابدا» — اللوحة وأزرارها ومحتواها تُقفل
      // لكل حساب غير المالك (ولو أي كود مستقبلي فتحها بالغلط، الحارس ده بيردها مقفولة).
      const va0 = document.getElementById("viewAdmin"); if (va0) va0.hidden = true;
      ADMIN_PANEL_NODES.forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = true; });
      try { if (typeof stopPresenceView === "function") stopPresenceView(); } catch (e) { }
      ["btnBackupAll", "btnBackupAll2"].forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = true; });
      // 🔑 بناء 133: النسخ الاحتياطي للمالك وحده — حتى لو الحساب من شركة ميزان
      if (bkTabEl) bkTabEl.hidden = true;
      if (bkPaneEl) bkPaneEl.hidden = true;
      // حساب ميزان (مش مالك): زرار «الضبط» وشاشته بس هم اللي يرجعوا، والحارس يراقبهم
      if (canSet) {
        restoreOwnerNodeByLabel("nav");
        restoreOwnerNodeByLabel("viewSettings");
        armOwnerSettingsGuard();
      }
      return false;
    }

    OWNER_TAB_NODES.forEach(restoreOwnerNode);
    const ba = document.getElementById("btnAdmin");
    if (ba) ba.hidden = false;
    const bkTab = document.querySelector('#setTabs .tab-btn[data-tab="sbak"]');
    if (bkTab) bkTab.hidden = false;
    ["btnBackupAll", "btnBackupAll2"].forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = false; });
    armOwnerSettingsGuard();
    return true;
  }

  // 🛡 الحارس الحيّ: أي تغيير في الشريط/التبويبات/شاشة الضبط = إعادة فحص في نفس
  // الدورة (debounce بـ timeout 0 عشان موجة التعديلات المتتالية تتلم فيمرة واحدة).
  // بيشتغل مرة واحدة في الجلسة، وعلى حساب المالك بس، وبلا أي loop: إعادة التظبيط
  // تكتب في الـ DOM بس لما تكون محتاجة فعلًا (ownerSettingsNeedsRepair).
  let ownerGuardArmed = false, ownerGuardQueued = false;
  function armOwnerSettingsGuard() {
    if (ownerGuardArmed || typeof MutationObserver !== "function") return;
    const vAdR = document.getElementById("viewAdmin");
    const btnAdR = document.getElementById("btnAdmin");
    const roots = [document.querySelector(".sidebar"), document.getElementById("setTabs"),
      document.getElementById("viewSettings"),
      // 🛡 بناء 121: لوحة الإدارة تحت مراقبة نفس الحارس الحيّ. بنراقب **أبوها** مش هي بس:
      // لو كود شال اللوحة من الشجرة فالطفرة بتحصل على الأب (مراقبتها على اللوحة نفسها
      // ما تشالش حالة الفصل) — ونفس المنطق على زرار اللوحة اللي في الهيدر بره الـ sidebar.
      (vAdR && vAdR.parentNode), (btnAdR && btnAdR.parentNode)].filter(Boolean);
    if (!roots.length) return;
    ownerGuardArmed = true;
    try {
      const mo = new MutationObserver(() => {
        if (ownerGuardQueued) return;
        ownerGuardQueued = true;
        setTimeout(() => {
          ownerGuardQueued = false;
          // 🔑 بناء 133: الحارس الحيّ بيشتغل على اللي ليه «الضبط» فعلًا (المالك + حسابات ميزان)
          if (!ownerSettingsAllowed()) return;
          if (ownerSettingsNeedsRepair()) enforceOwnerSettings();
        }, 0);
      });
      roots.forEach((r) => mo.observe(r, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"]
      }));
    } catch (e) { /* المتصفح ما يدعمش؟ الحارس الكلاسيكي بعد كل بوابة لسه شغال */ }
  }

  // إخفاء أزرار الشاشات غير المفعّلة في اشتراك الشركة الحالية
  function applyFeatureGating() {
    enforceOwnerSettings();
    var fe = window.DATA && window.DATA.featureEnabled;
    if (fe) {
      document.querySelectorAll(".nav-btn").forEach((b) => {
        const n = b.dataset.view;
        b.hidden = !canUseView(n);
      });
      // 🔓 حصانة أخيرة: ضبط المالك مانلغيش عنه بـ featureEnabled مهما حصل
      // 🔑 بناء 133: نفس الحصانة لحسابات شركة «ميزان» (اللي بقى ليهم القسم ده)
      const own = ownerSettingsAllowed();
      const svO = document.querySelector('.nav-btn[data-view="settings"]');
      if (svO && own) svO.hidden = false;
      // لو الشاشة الحالية أصبحت معطّلة → عد للوحة
      const cur = document.querySelector(".view:not([hidden])");
      if (cur && !canUseView(cur.dataset.id)) showView("dashboard");
    }
    // 🧱 بناء 132: بعد ما الأزرار اتحدّدت، الأقسام اللي شاشاتها كلها مقفولة تتشال من
    // الشريط العلوي (طلب المالك: «متظهرش من الأساس، ولا مكانها فاضي»).
    applySectionVisibility();
  }

  function showView(name) {
    // 📷 بناء 144: البائع يسيب الفاتورة ويروح شاشة تانية ⇒ الكاميرا تقفل والمسدس ياخد
    // عادي. القفل هنا مش في الزرار بس — أي خروج من الشاشة (شريط/قائمة/برمجي) بيقفلها.
    if (scanCam.on) scanCamClose();
    // حماية: تبويب «إعدادات ونسخ احتياطي المالك» لحسابات شركة المالك (بناء 133)
    // أي حساب تاني — حتى لو حاول فتحه برمجيًا — يتحوّل لـ«إعدادات مؤسستك».
    const isOwner = ownerHasAllAccess() || !!window.__isOwner;
    if (name === "settings" && !ownerSettingsAllowed()) {
      name = "clientSettings";
      toast("القسم ده لحسابات شركة ميزان فقط", "error");
    }
    // 🛡 بناء 121 (طلب المالك: لوحة الإدارة «متظهرش عند حد تاني ابدا»):
    // أي حساب غير المالك — حتى لو نادى showView("admin") برمجيًا أو من الكونسول —
    // بيرجع للوحة التحكم، واللوحة ما بتترسمش أصلًا (openAdmin بيرفض قبل أي نداء).
    if (name === "admin" && !isOwner) {
      name = "dashboard";
      toast("لوحة الإدارة لحساب المالك فقط", "error");
    }
    // «إعدادات مؤسستك» لا تُفتح إلا لمن فعّلها صاحب الشركة (أو المالك/صاحب الشركة)
    if (name === "clientSettings" && !canUseView("clientSettings")) {
      toast("صلاحية «إعدادات مؤسستك» غير مفعّلة لحسابك", "error");
      name = "dashboard";
    }
    // 🔁 «المرتجعات» نفس النمط: صلاحية مستقلة opt-in لحساب العضو
    if (name === "returnsReg" && !canManageReturns()) {
      toast("صلاحية «إدارة المرتجعات» غير مفعّلة لحسابك", "error");
      name = "dashboard";
    }
    // 🆕 بناء 115: «الحضور والانصراف» — نفس نمط البوابة
    if (name === "attendance" && !canManageAttendance()) {
      toast("صلاحية «الحضور والانصراف» غير مفعّلة لحسابك", "error");
      name = "dashboard";
    }
    // 🆕 مهمة 98: «الأصول الثابتة» — نفس نمط بوابة الحضور
    if (name === "fixedAssets" && !canManageFixedAssets()) {
      toast("صلاحية «الأصول الثابتة» غير مفعّلة لحسابك", "error");
      name = "dashboard";
    }
    // 🆕 شاشة «كشف حساب الحسابات» — لصاحب الشركة والمالك فقط (زي شاشة القيود)
    if (name === "accStatement" && !canUseView("accStatement")) {
      toast("شاشة «كشف حساب الحسابات» متاحة لصاحب الشركة والمالك فقط", "error");
      name = "dashboard";
    }
    // 🆕 بناء 115: «القيود اليومية» لصاحب الشركة والمالك فقط (طلب المالك: مش أي حد يسجل قيود)
    if (name === "journal" && !canUseView("journal")) {
      toast("شاشة «القيود اليومية» متاحة لصاحب الشركة والمالك فقط", "error");
      name = "dashboard";
    }
    // 🆕 بناء 125: «الدردشة الداخلية» — لأي حساب غير سحابي، أو قبل ما ترقية ٤٥
    // تتنفّذ على السحابة، الشاشة مش بتفتح أصلًا (حتى لو حد ناداها من الكونسول).
    if (name === "chat" && !chatAvailable()) {
      toast("الدردشة الداخلية مش متاحة على هذا الحساب دلوقتي", "error");
      name = "dashboard";
    }
    // 🛡 بناء 131 (طلب المالك: «بحدد لهم صلاحيات بترجع تانى كل الصلاحيات لهم»):
    // البوابات اللي فوقها اسم-بس لكل شاشة على حدة؛ باقي الشاشات (فواتير المبيعات،
    // دليل العملاء، الخزينة، التقارير…) ما كانش ليها بوابة جوّه `showView`، فأي نداء
    // برمجي كان بيفتحها رغم إن صاحب الشركة قفلها. القاعدة العامة هنا: الشاشة اللي ليها
    // زرار في القائمة الجانبية ما تتفتحش إلا لو `canUseView` قالت أيوه.
    // لوحة التحكم (`dashboard`) مستثناه عمدًا: لو انفتحت على نفسها كان هيقفل على المستخدم.
    if (name !== "dashboard" && viewHasNavEntry(name) && !canUseView(name)) {
      const lbl131 = navLabelOf(name);
      toast((lbl131 ? "شاشة «" + lbl131 + "» " : "الشاشة دي ") +
        "مقفولة على حسابك — صاحب الشركة هو اللي بيحدّد الصلاحيات", "error");
      name = "dashboard";
    }
    document.querySelectorAll(".view[data-id]").forEach((v) => {
      v.hidden = v.dataset.id !== name;
    });
    // 🛡 بناء 121: الحارس الحيّ لازم يعرف المالك واقف على أنهي شاشة، عشان
    // «لوحة الإدارة» (والوحات المخفية بالتصميم) ما يعاندش إخفاءها المشروّع.
    ownerCurrentView = name;
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === name);
    });
    // 🧱 بناء 132: الشريط العلوي يقفل أي قائمة مفتوحة ويميّز القسم اللي فيه الشاشة الحالية
    closeSections();
    paintSectionActive();
    if (name === "dashboard") renderDashboard();
    if (name === "customers") renderTable();
    if (name === "products") renderProducts();
    if (name === "sales") {
      updatePosTaxUI();
      if (!posInitialized) {
        posInitialized = true;
        posNewInvoice();
      } else {
        renderPosItems();
        posRecalc();
      }
      renderSalesLookups();
    }
    if (name === "purchases") {
      updatePosTaxUI();
      if (!ppInitialized) {
        ppInitialized = true;
        ppNewInvoice();
      } else {
        renderPPItems();
        ppRecalc();
      }
      renderPurchasesLookups();
    }
    if (name === "suppliers") renderSuppliers();
    if (name === "returns") renderInvoiceQuery();
    if (name === "returnsReg") renderReturns();
    if (name === "treasury") { syncTreasuryFromSett(); recalculateTreasuryBalances(); renderTreasury(); renderTreMoves(); }
    if (name === "accounts") renderAccounts();
    if (name === "journal") { renderJournal(); renderLedger(); } // 🆕 بناء 115: + دفتر الحركة
    if (name === "accStatement") renderAccStatementView();      // 🆕 كشف حساب الحسابات (من القيود)
    if (name === "balance") renderBalance();
    // 🆕 مهمة 98: سجل الأصول الثابتة — الربط مرة واحدة ثم الرسم
    if (name === "fixedAssets") { fixedBindOnce(); renderFixedAssets(); }
    // 🧮 بناء 145: الجرد بالباركود — المخزن + الورقة الحالية + حساب الفروق، وكلها من الجهاز
    if (name === "stockCount") scOpenView();
    if (name === "treasuryStatements") { recalculateTreasuryBalances(); renderTreStmt(); }
    if (name === "reports") renderReports();
    if (name === "attendance") renderAttendanceView();
    if (name === "users") renderUsers();
    if (name === "audit") renderAudit();
    if (name === "settings") loadSettingsForm();
    if (name === "clientSettings") loadClientSettingsForm();
    // 🆕 بناء 125: الدردشة — الـ polling بيبدأ مع فتح الشاشة وبيرجع أول ما تتقفل
    // (مافيش Realtime على السحابة، وبنرفض نفضل نخبط على قاعدة كل ١٢ ثانية وإحنا
    // واقفين على شاشة تانية).
    if (name === "chat") renderChat();
    if (name !== "chat") chatStopPoll();
    // 🆕 بناء 119: كان الشرط بيقرأ window.refreshPresenceCard (محدّتش معروفة) ⇒ السطر
    // ده كان ما ينفّذش حاجة. الدالتين في نفس النطاق، فنناديهم على طول.
    if (name === "admin") { startPresenceView(); refreshPresenceCard(); }
    if (name !== "admin") stopPresenceView();
  }

  /* ================== لوحة التحكم ================== */
  /* 📊 بناء 135 (سطر ٧ للمالك): «صافي ربح الشهر» بنفس تعريف «صافي ربح اليوم» — مصدر واحد الاتنين.
     التعريف (قراره المسجّل في بناء 92/96 و108 حرفيًا): مجموع (سعر البيع − سعر الشراء) × الكمية
     لأسطر فواتير البيع، **ناقص** نفس الهامش لمرتجعات البيع. والبره بالقرار: الضريبة (أمانة مش
     إيراد) · المشتريات والمصروفات والسندات (ده هامش بيع مش صرف مخزني).
     `within(تاريخ)` = المجال الزمني: اليوم ⇒ كارت اللوحة، الشهر ⇒ كارت اللوحة التاني —
     فممنوع يبقى في البرنامج اتنين منطقتين حسابيتين للرقم الواحد. */
  function profitMarginOf(items) {
    return (items || []).reduce((mm, it) => {
      const pr = products.find((x) => Number(x.id) === Number(it.productId));
      const cost = pr ? (Number(pr.purchasePrice) || Number(pr.weightedAvgCost) || 0) : 0;
      return mm + (Number(it.qty) || 0) * ((Number(it.price) || 0) - cost);
    }, 0);
  }
  function netSaleProfit(within) {
    const sold = sales.filter((s) => within(s.invoiceDate)).reduce((m, s) => m + profitMarginOf(s.items), 0);
    const returned = saleReturns.filter((r) => within(retDateOf(r))).reduce((m, r) => m + profitMarginOf(r.items), 0);
    return Math.round((sold - returned) * 100) / 100;
  }

  function renderDashboard() {
    const today = todayISO();
    const isToday = (d) => (d || "").slice(0, 10) === today;
    const monthKey = today.slice(0, 7);
    const isThisMonth = (d) => (d || "").slice(0, 7) === monthKey;
    // 🔁 بناء 108: المرتجعات بت تخصم من أرقام اليوم (والسندات اللي منها ما تتحسبش مصروف/إيراد)
    const isRetVoucher = (v) => String((v && v.refType) || "").indexOf("_return") !== -1;
    const retSaleToday = saleReturns.filter((r) => isToday(retDateOf(r))).reduce((m, r) => m + (Number(r.grandTotal) || 0), 0);
    const retPurToday = purchaseReturns.filter((r) => isToday(retDateOf(r))).reduce((m, r) => m + (Number(r.grandTotal) || 0), 0);
    const salesToday = sales.filter((s) => isToday(s.invoiceDate)).reduce((m, s) => m + (s.grandTotal || 0), 0) - retSaleToday;
    const purToday = purchases.filter((p) => isToday(p.invoiceDate)).reduce((m, p) => m + (p.grandTotal || 0), 0) - retPurToday;
    const expToday = vouchers.filter((v) => v.type === "out" && isToday(v.date) && !isRetVoucher(v)).reduce((m, v) => m + (v.amount || 0), 0);
    const revToday = vouchers.filter((v) => v.type === "in" && isToday(v.date) && !isRetVoucher(v)).reduce((m, v) => m + (v.amount || 0), 0);
    const treTotal = treasury.reduce((m, t) => m + (t.balance || 0), 0);

    $("#kSales").textContent = fmt(salesToday) + " ج.م";
    $("#kPurchases").textContent = fmt(purToday) + " ج.م";
    $("#kExpenses").textContent = fmt(expToday) + " ج.م";
    // صافي ربح اليوم = (سعر البيع − سعر الشراء) × الكمية لأصناف فواتير اليوم − مرتجعات اليوم
    // 📊 بناء 135: الحساب بقى في مصدر واحد (`netSaleProfit`) مشترك مع كارت الشهر.
    const profitToday = netSaleProfit(isToday);
    // 🎨 بناء 123 (بند 5): المبلغ أخضر للمدخل / أحمر للمخرج — الشاشات المالية بس.
    //    كارت «الرصيد المتاح» ما يتلونش: ده رصيد مش إيراد ولا مصروف.
    paintDir("#kSales", "in");
    paintDir("#kPurchases", "out");
    paintDir("#kExpenses", "out");
    $("#kProfit").textContent = fmt(Math.round(profitToday * 100) / 100) + " ج.م";
    paintDir("#kProfit", profitToday > 0 ? "in" : profitToday < 0 ? "out" : "");
    // 📆 بناء 135 (سطر ٧): نفس الهامش على **شهر التقويم الحالي** — فاتورة الشهر اللي فات ما تدخلش.
    const profitMonth = netSaleProfit(isThisMonth);
    $("#kMonthProfit").textContent = fmt(profitMonth) + " ج.م";
    paintDir("#kMonthProfit", profitMonth > 0 ? "in" : profitMonth < 0 ? "out" : "");
    $("#kTreasury").textContent = fmt(treTotal) + " ج.م";

    const low = products.filter((pr) => pr.qty <= pr.reorder);
    $("#kLowStock").textContent = low.length.toString();

    const tLow = $("#dgvLowStock tbody");
    tLow.innerHTML = "";
    low.forEach((pr) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(pr.code) + '</td>' +
        '<td>' + esc(pr.nameAr) + '</td>' +
        '<td>' + esc(pr.category) + '</td>' +
        '<td>' + esc(Number(pr.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + esc(Number(pr.reorder).toLocaleString("en-US")) + '</td>';
      tLow.appendChild(tr);
    });

    const tAct = $("#dgvActivity tbody");
    tAct.innerHTML = "";
    activity.slice(0, 12).forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(a.ts) + '</td>' +
        '<td>' + esc(a.user) + '</td>' +
        '<td>' + esc(a.action) + '</td>' +
        '<td style="text-align:right">' + esc(a.desc) + '</td>';
      tAct.appendChild(tr);
    });
  }

  /* ================== الجدول ================== */
  function renderTable() {
    recalculateCustomerBalances();
    const tbody = $("#dgvCustomers tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtCustomerSearch").value);

    customers
      .filter((c) => !c.protected && c.code !== "1" && c.id !== 1 && !(c.nameAr && c.nameAr.includes("العميل النقدي")))
      .filter((c) => {
        if (!q) return true;
        return (
          normalizeAr(c.code).includes(q) ||
          normalizeAr(c.nameAr).includes(q) ||
          normalizeAr(c.phone).includes(q) ||
          normalizeAr(c.secondaryPhone).includes(q) ||
          normalizeAr(c.address).includes(q) ||
          normalizeAr(c.notes).includes(q) ||
          fmt(c.currentBalance).includes(q)
        );
      })
      .forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(c.code) + '</td>' +
          '<td>' + esc(c.nameAr) + '</td>' +
          '<td>' + esc(c.phone || "-") + '</td>' +
          '<td>' + esc(c.secondaryPhone || "-") + '</td>' +
          '<td title="' + esc(c.address || "") + '">' + esc(c.address || "-") + '</td>' +
          '<td title="' + esc(c.notes || "") + '">' + esc(c.notes || "-") + '</td>' +
          '<td class="' + (c.currentBalance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(c.currentBalance) + ' ج.م</td>';
        tr.dataset.id = c.id;
        tr.addEventListener("dblclick", () => openActions(c));
        tr.addEventListener("click", () => {
          tbody.querySelectorAll("tr.selected").forEach((r) => r.classList.remove("selected"));
          tr.classList.add("selected");
        });
        tbody.appendChild(tr);
      });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ================== نافذة: إضافة / تعديل ================== */
  function openAddEdit(customer) {
    editingId = customer ? customer.id : null;
    if (customer) {
      $("#addEditTitle").textContent = "تعديل بيانات العميل";
      $("#btnSaveCustomer").textContent = "💾 حفظ التعديلات";
      $("#fCode").value = customer.code;
      $("#fCode").disabled = true;
      $("#fName").value = customer.nameAr;
      $("#fPhone").value = customer.phone || "";
      $("#fSecPhone").value = customer.secondaryPhone || "";
      $("#fWallet").value = customer.walletPhone || "";
      $("#fAddress").value = customer.address || "";
      $("#fNotes").value = customer.notes || "";
      $("#fBalance").value = moneyStr(customer.openingBalance);
      $("#fBalance").disabled = true;
    } else {
      $("#addEditTitle").textContent = "إضافة عميل جديد";
      $("#btnSaveCustomer").textContent = "💾 إضافة العميل";
      $("#fCode").value = nextCustomerCode();
      prefetchNextCode("customer", "fCode"); // دمج الأرقام المتقاعدة من السيرفر
      $("#fCode").disabled = false;
      $("#fName").value = "";
      $("#fPhone").value = "";
      $("#fSecPhone").value = "";
      $("#fWallet").value = "";
      $("#fAddress").value = "";
      $("#fNotes").value = "";
      $("#fBalance").value = "0";
      $("#fBalance").disabled = false;
    }
    showModal("mAddEdit");
    $("#fName").focus();
  }

  function saveCustomer() {
    const name = $("#fName").value.trim();
    if (!name) {
      toast("يرجى كتابة اسم العميل.", "warning");
      return;
    }

    const bal = moneyVal("#fBalance") || 0;

    if (editingId == null) {
      const cust = {
        id: nextCustomerId(),
        code: $("#fCode").value.trim(),
        nameAr: name,
        phone: $("#fPhone").value.trim(),
        secondaryPhone: $("#fSecPhone").value.trim(),
        walletPhone: $("#fWallet").value.trim(),
        address: $("#fAddress").value.trim(),
        notes: $("#fNotes").value.trim(),
        openingBalance: bal,
        currentBalance: bal,
        protected: false
      };
      customers.push(cust);
      if (bal > 0) {
        txs.push({ id: nextTxId(), customerId: cust.id, date: todayISO(), desc: "رصيد افتتاحي (أول المدة)", debit: bal, credit: 0 });
      }
      saveCustomers();
      saveTxs();
      toast("تمت إضافة العميل بنجاح.", "success");
    } else {
      const cust = customers.find((c) => c.id === editingId);
      cust.nameAr = name;
      cust.phone = $("#fPhone").value.trim();
      cust.secondaryPhone = $("#fSecPhone").value.trim();
      cust.walletPhone = $("#fWallet").value.trim();
      cust.address = $("#fAddress").value.trim();
      cust.notes = $("#fNotes").value.trim();
      saveCustomers();
      toast("تم حفظ التعديلات بنجاح.", "success");
    }
    hideModal("mAddEdit");
    renderTable();
  }

  /* ================== نافذة: تحصيل مديونية ================== */
  let payPreselected = null;

  function openPayDebt(customer) {
    payPreselected = customer || null;
    const sel = $("#pCust");
    sel.innerHTML = "";
    customers
      .filter((c) => !c.protected && c.code !== "1" && c.id !== 1 && !(c.nameAr && c.nameAr.includes("العميل النقدي")))
      .forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nameAr + " (المديونية: " + fmt(c.currentBalance) + " ج.م)";
        sel.appendChild(opt);
      });
    if (payPreselected) {
      sel.value = String(payPreselected.id);
    }
    $("#pMethod").value = "نقداً 💵";
    $("#pAmount").value = "";
    $("#pNotes").value = "تحصيل دفعة نقداً من حساب العميل";
    applyTreasuryFilter();
    updateWalletFields();
    showModal("mPayDebt");
  }

  function applyTreasuryFilter() {
    const method = $("#pMethod").value;
    const type = method.includes("بنكي") ? "bank" : method.includes("محفظة") ? "wallet" : "cash";
    const sel = $("#pTreasury");
    sel.innerHTML = "";
    treasury.filter((t) => t.type === type).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
  }

  function updateWalletFields() {
    const isWallet = $("#pMethod").value.includes("محفظة");
    $("#lblWalletFrom").hidden = !isWallet;
    $("#pWalletFrom").hidden = !isWallet;
    $("#lblWalletTo").hidden = !isWallet;
    $("#pWalletTo").hidden = !isWallet;
    if (isWallet) {
      $("#pWalletFrom").value = "01002655282";
      const cid = parseInt($("#pCust").value, 10);
      const c = customers.find((x) => x.id === cid);
      $("#pWalletTo").value = (c && c.walletPhone) ? c.walletPhone : "";
    }
  }

  function savePay() {
    const cid = parseInt($("#pCust").value, 10);
    if (!cid) {
      toast("يرجى اختيار العميل.", "warning");
      return;
    }
    const amount = moneyVal("#pAmount");
    if (!(amount > 0)) {
      toast("يرجى كتابة مبلغ صحيح أكبر من الصفر.", "warning");
      return;
    }
    if ($("#pMethod").value.includes("محفظة")) {
      if (!$("#pWalletFrom").value.trim() || !$("#pWalletTo").value.trim()) {
        toast("يرجى تعبئة رقم المحفظة المرسِل منها والمرسَل إليها.", "warning");
        return;
      }
    }

    let notes = $("#pNotes").value.trim();
    if ($("#pMethod").value.includes("محفظة")) {
      notes += " | محفظة: من " + $("#pWalletFrom").value.trim() + " إلى " + $("#pWalletTo").value.trim();
    }

    const cust = customers.find((c) => c.id === cid);
    cust.currentBalance = Math.round((cust.currentBalance - amount) * 100) / 100;
    const trId = parseInt($("#pTreasury").value, 10);
    const tr = treasury.find((x) => x.id === trId);
    if (tr) {
      tr.balance = Math.round((tr.balance + amount) * 100) / 100;
      saveTreasury();
      syncTreasuryItemToSett(tr);
    }
    const txId = nextTxId();
    txs.push({
      id: txId,
      customerId: cid,
      treasuryId: tr ? tr.id : (trId || null),
      paymentMethod: $("#pMethod").value,
      date: todayISO(),
      desc: notes,
      debit: 0,
      credit: amount
    });
    vouchers.push({
      id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      type: "in",
      treasuryId: tr ? tr.id : trId,
      date: todayISO(),
      amount: amount,
      desc: "تحصيل من عميل: " + (cust ? cust.nameAr : "") + (notes ? " (" + notes + ")" : ""),
      refType: "customer_tx",
      refId: txId
    });
    saveCustomers();
    saveTxs();
    saveVouchers();
    hideModal("mPayDebt");
    addActivity("تحصيل مديونية", "تحصيل مبلغ " + fmt(amount) + " ج.م من " + (cust ? cust.nameAr : "") + (tr ? " (" + tr.name + ")" : ""));
    toast("تم تسجيل السداد بنجاح وتحديث رصيد الحساب.", "success");
    renderTable();
    if (typeof renderTreasury === "function") renderTreasury();
    if (typeof renderTreMoves === "function") renderTreMoves();
  }

  function todayISO() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ================== نافذة: خيارات العميل ================== */
  let actionsCust = null;
  let statementCtx = null;
  let stmFilter = { from: "", to: "" }; // 🆕 مهمة 96: فترة كشف الحساب (فاضي = بالكامل)

  function openActions(cust) {
    actionsCust = cust;
    $("#actTitle").textContent = "👤 إدارة العميل: " + cust.nameAr + " (" + cust.code + ") - By Adel Samir - واتس: 01002655282";
    const canD105 = canManageDocs();
    $("#actDocScan").hidden = !canD105; $("#actDocPick").hidden = !canD105; $("#actDocList").hidden = !canD105;
    $("#actName").textContent = "👤 العميل: " + cust.nameAr;
    $("#actDetails1").textContent = "الكود: " + cust.code + " | الهاتف: " + (cust.phone || "-") + " | هاتف آخر: " + (cust.secondaryPhone || "-");
    $("#actDetails2").textContent = "العنوان: " + (cust.address || "-") + " | ملاحظات: " + (cust.notes || "-");
    const bal = $("#actBalance");
    bal.textContent = "الرصيد الحالي (المديونية): " + fmt(cust.currentBalance) + " ج.م";
    bal.className = "act-bal " + (cust.currentBalance > 0 ? "balance-debit" : "balance-credit");
    const isCash = cust.protected || cust.code === "1" || cust.id === 1;
    const btnDel = $("#actDelete");
    if (btnDel) {
      btnDel.disabled = isCash;
      btnDel.title = isCash ? "لا يمكن حذف العميل النقدي (كاش) - محمي بالنظام" : "";
      btnDel.style.opacity = isCash ? "0.4" : "1";
      btnDel.style.cursor = isCash ? "not-allowed" : "pointer";
    }
    showModal("mActions");
  }

  /* ================== كشف الحساب ================== */
  function getStatement(cust) {
    // 🔁 بناء 108: مرتجعات «رد قيمة المرتجع» ملهاش حركة على الحساب — سطر توضيحي ما يغيّرش الرصيد
    const memoRows = saleReturns
      .filter((r) => r.settlement === "refund" && Number(r.customerId) === Number(cust.id))
      .map((r) => {
        const tr = treasury.find((x) => Number(x.id) === Number(r.treasuryId));
        return {
          date: retDateOf(r),
          desc: "↩️ مرتجع مبيعات رقم " + retNo(r) + " — رد" + (tr ? " من " + tr.name : "") + " بقيمة " + fmt(r.grandTotal) + " ج.م",
          debit: 0, credit: 0
        };
      });
    const rows = txs
      .filter((t) => Number(t.customerId) === Number(cust.id))
      .concat(memoRows)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let run = 0;
    return rows.map((t) => {
      run = Math.round((run + t.debit - t.credit) * 100) / 100;
      return {
        date: t.date,
        desc: t.desc,
        debit: t.debit,
        credit: t.credit,
        balance: run,
        // 🔁 بناء 119: السطر التوضيحي (مرتجع) ملوش id ومانحذفوش من هنا
        id: t.id == null ? null : t.id,
        paymentMethod: t.paymentMethod || "",
        treasuryId: t.treasuryId == null ? null : t.treasuryId
      };
    });
  }

  function fillStatementTable(tbodyEl, cust) {
    // 🆕 مهمة 96: طباعة صفحة الكشف تحترم فلتر الفترة لو مضبوط
    renderStmRows(tbodyEl, stmVisibleRows(getStatement(cust)), "لا توجد حركات على حساب هذا العميل في هذه الفترة.");
  }

  function dateRange() {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const p = (x) => String(x).padStart(2, "0");
    return (
      p(from.getDate()) + "/" + p(from.getMonth() + 1) + "/" + from.getFullYear() +
      " - " +
      p(new Date().getDate()) + "/" + p(new Date().getMonth() + 1) + "/" + new Date().getFullYear()
    );
  }

  /* ================== 🆕 مهمة 96: فلترة كشف الحساب بالفترة (من/إلى) أو بالكامل ==================
     الرصيد الجاري في كل سطر محسوب من أول السجل — الفلترة تعرض سطور الفترة فقط،
     ولو «من» موجودة بنضيف سطر «رصيد مرحّل» برصيد آخر حركة قبل البداية عشان الرقم يفضل مفهوم.
     ما بيتغيرش أي سلوك لما الفترة فاضية (الافتراضي = عرض بالكامل زي زمان). */
  function stmPeriodLabel() {
    const p = (x) => String(x).padStart(2, "0");
    const ar = (iso) => { const d = new Date(iso); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };
    if (!stmFilter.from && !stmFilter.to) return "بلا فلترة (كامل السجل)";
    if (stmFilter.from && stmFilter.to) return "من " + ar(stmFilter.from) + " إلى " + ar(stmFilter.to);
    if (stmFilter.from) return "من " + ar(stmFilter.from) + " وحتى اليوم";
    return "من أول السجل إلى " + ar(stmFilter.to);
  }

  function stmVisibleRows(rows) {
    const from = stmFilter.from, to = stmFilter.to;
    if (!from && !to) return rows;
    const out = rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    if (from) {
      const before = rows.filter((r) => r.date < from);
      if (before.length) {
        out.unshift({
          date: from,
          desc: "▷ رصيد مرحّل من قبل هذه الفترة",
          debit: 0, credit: 0,
          balance: before[before.length - 1].balance
        });
      }
    }
    return out;
  }

  function stmRowsNow() {
    if (!statementCtx) return [];
    const all = statementCtx.type === "supplier"
      ? getSupplierStatement(statementCtx.obj)
      : getStatement(statementCtx.obj);
    return stmVisibleRows(all);
  }

  // 🔁 بناء 119 (طلب المالك): عمود «إجراءات» اختياري — يظهر على الشاشة بس.
  // الطباعة (fillStatementTable) بتنادي من غير actKind ⇒ الورقة بتفضل 5 أعمدة بالحرف.
  function actKindForStm() {
    if (!statementCtx) return "";
    if (!isSuperAcct() && !isCompanyOwnerAcct()) return ""; // نفس بوابة حذف الفاتورة
    return statementCtx.type === "supplier" ? "supplier" : "customer";
  }
  function stmRowDeletable(r) { return !!(r && r.id != null && r.paymentMethod); }
  function stmRowWhyLocked(r) {
    if (!r || r.id == null) return "سطر توضيحي لمرتجع — بيتشال من شاشة المرتجعات.";
    if (/رصيد افتتاحي/.test(String(r.desc || ""))) return "الرصيد الافتتاحي بيتعدّل من بطاقة العميل/المورد نفسه، مش بيتم حذفه من الكشف.";
    return "دي حركة جاية من فاتورة — تتحذف من زر 🗑️ في الفاتورة نفسها علشان المخزون والقيود تتراجع صح.";
  }
  function renderStmRows(tbodyEl, rows, emptyMsg, actKind) {
    tbodyEl.innerHTML = "";
    const cols = actKind ? 6 : 5;
    if (!rows.length) {
      tbodyEl.innerHTML = '<tr><td colspan="' + cols + '">' + emptyMsg + '</td></tr>';
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(r.date) + '</td>' +
        '<td style="text-align:right">' + esc(r.desc) + '</td>' +
        '<td>' + (r.debit ? fmt(r.debit) : "-") + '</td>' +
        '<td>' + (r.credit ? fmt(r.credit) : "-") + '</td>' +
        '<td class="' + (r.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(r.balance) + '</td>';
      if (actKind) {
        const td = document.createElement("td");
        td.className = "stm-act";
        if (stmRowDeletable(r)) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "btn small red stm-del-btn";
          b.textContent = "🗑️ حذف";
          b.title = "حذف حركة " + (actKind === "supplier" ? "الدفع للمورد" : "السداد من العميل") +
            " («" + (r.paymentMethod || "") + "» " + fmt(Math.max(r.debit, r.credit)) + " ج.م) — ترجّع المبلغ للخزينة/الحساب.";
          b.addEventListener("click", () => window.__stmDelTx(actKind, r.id));
          td.appendChild(b);
        } else {
          const s = document.createElement("span");
          s.className = "stm-act-locked";
          s.title = stmRowWhyLocked(r);
          s.textContent = "🔒";
          td.appendChild(s);
        }
        tr.appendChild(td);
      }
      tbodyEl.appendChild(tr);
    });
  }

  // 🔁 بناء 119: حذف حركة سداد/دفع نقدية من كشف الحساب — مع سندها المرتبط،
  // وإعادة حساب أرصدة العميل/المورد والخزائن، وبعدها حفظ ورفع للسحابة.
  window.__stmDelTx = function (kind, txId) {
    if (!isSuperAcct() && !isCompanyOwnerAcct()) {
      toast("حذف حركات العملاء والموردين لصاحب الشركة والمالك فقط.", "error");
      return;
    }
    const isSup = kind === "supplier";
    const pool = isSup ? supplierTxs : txs;
    const idx = pool.findIndex((t) => Number(t.id) === Number(txId));
    if (idx < 0) { toast("الحركة مش موجودة — حدّث الصفحة.", "warning"); return; }
    const tx = pool[idx];
    if (!stmRowDeletable(tx)) { toast(stmRowWhyLocked(tx), "warning"); return; }
    const party = isSup
      ? suppliers.find((s) => Number(s.id) === Number(tx.supplierId))
      : customers.find((c) => Number(c.id) === Number(tx.customerId));
    const partyName = party ? party.nameAr : (isSup ? "المورد" : "العميل");
    const accName = (() => {
      const tr = treasury.find((x) => Number(x.id) === Number(tx.treasuryId));
      return tr ? tr.name : null;
    })();
    const amount = Math.max(Number(tx.debit) || 0, Number(tx.credit) || 0);
    const msg = "تحذف حركة «" + (tx.desc || (isSup ? "دفع نقدي للمورد" : "سداد نقدي من العميل")) + "»؟\n\n" +
      "الحساب: " + partyName + "\nالمبلغ: " + fmt(amount) + " ج.م" + (accName ? ("\nالحساب: " + accName) : "") +
      "\nالتاريخ: " + (tx.date || "") +
      "\n\nالمبلغ هيرجع لرصيد «" + (accName || "الحساب") + "»، والسند المرتبط بيتحذف معاه.";
    if (!confirm(msg)) return;
    // السند المرتبط بنفس الحركة (customer_tx / supplier_tx)
    const vBefore = vouchers.length;
    vouchers = vouchers.filter((v) => !(v.refType === (isSup ? "supplier_tx" : "customer_tx") && Number(v.refId) === Number(tx.id)));
    pool.splice(idx, 1);
    if (isSup) {
      recalculateSupplierBalances();
      addActivity("حذف حركة مورد", "حذف حركة " + tx.desc + " — " + fmt(amount) + " ج.م (" + partyName + ")");
    } else {
      recalculateCustomerBalances();
      addActivity("حذف حركة عميل", "حذف حركة " + tx.desc + " — " + fmt(amount) + " ج.م (" + partyName + ")");
    }
    recalculateTreasuryBalances();
    // حفظ (الحفظ هو اللي بيرفع للسحابة)
    if (isSup) { saveSupplierTxs(); saveVouchers(); saveSuppliers(); }
    else { saveTxs(); saveVouchers(); saveCustomers(); }
    saveTreasury();
    toast("تم حذف الحركة — " + fmt(amount) + " ج.م رجع لـ«" + (accName || "الحساب") + "»." +
      (vBefore !== vouchers.length ? " والسند المرتبط اتشال معاه." : ""), "success");
    // تحديث الشاشات المفتوحة
    try { if (statementCtx) refreshStatementView(); } catch (e) { }
    try { if (isSup) renderSuppliers(); else renderTable(); } catch (e) { }
    try { renderTreasury(); } catch (e) { }
    try { renderDashboard(); } catch (e) { }
  };

  function refreshStatementView() {
    if (!statementCtx) return;
    const o = statementCtx.obj;
    $("#stmHeadMini").innerHTML =
      "الكود: <b>" + esc(o.code) + "</b> | الفترة: <b>" + stmPeriodLabel() + "</b> | " +
      "الرصيد الحالي: <b class=\"" + (o.currentBalance > 0 ? "balance-debit" : "balance-credit") + "\">" + fmt(o.currentBalance) + " ج.م</b>";
    const rows = stmRowsNow();
    // 🔁 بناء 119: عمود الإجراءات على الشاشة فقط (المالك/صاحب الشركة)، والورقة 5 أعمدة
    const canAct = !!actKindForStm();
    renderStmRows($("#stmBodyMini"), rows, "لا توجد حركات على هذا الحساب في هذه الفترة.", canAct);
    const th = document.querySelector("#stmBodyMini") &&
      document.querySelector("#stmBodyMini").closest("table").querySelector("thead th.stm-act");
    if (th) th.hidden = !canAct;
    const moves = rows.filter((r) => String(r.desc).indexOf("رصيد مرحّل") === -1).length;
    $("#stmPeriodInfo").textContent = (!stmFilter.from && !stmFilter.to)
      ? (moves + " حركة")
      : (moves + " حركة في الفترة المحددة");
  }

  function applyStmFilter() {
    const f = $("#stmFrom").value || "";
    const t = $("#stmTo").value || "";
    if (f && t && f > t) {
      toast("تاريخ البداية «" + f + "» بعد تاريخ النهاية «" + t + "» — صحّح الفترة علشان الفلترة تتظبط.", "warning");
      return;
    }
    stmFilter = { from: f, to: t };
    refreshStatementView();
  }

  function resetStmFilter() {
    stmFilter = { from: "", to: "" };
    if ($("#stmFrom")) $("#stmFrom").value = "";
    if ($("#stmTo")) $("#stmTo").value = "";
    if ($("#stmPeriodInfo")) $("#stmPeriodInfo").textContent = "";
  }

  function openStatement(cust) {
    statementCtx = { type: "customer", obj: cust };
    resetStmFilter(); // 🆕 مهمة 96: كل كشف يفتح بفلتر نظيف (بالكامل)
    $("#stmTitle").textContent = "📋 كشف حساب تفصيلي: " + cust.nameAr;
    refreshStatementView();
    showModal("mStatement");
  }

  function printStatement(cust) {
    $("#stmName").textContent = cust.nameAr;
    $("#stmCode").textContent = cust.code;
    $("#stmRange").textContent = stmPeriodLabel(); // 🆕 مهمة 96: الفترة المعروضة = الفلتر الفعلي
    const bal = $("#stmBal");
    bal.textContent = fmt(cust.currentBalance);
    bal.className = cust.currentBalance > 0 ? "balance-debit" : "balance-credit";
    fillStatementTable($("#stmBody"), cust);
    printSection($("#statementPage"));
  }

  /* ══════════════════════════════════════════════════════════════════════
     🔳 الباركود — بناء 139 (CODE 128 · Set B · دولجين في المتصفح)
     ══════════════════════════════════════════════════════════════════════
     أمر المالك الحرفي (04/10): «توليد الباركود للأصناف (إضافة + الموجودين)
     + زرار طباعة الباركود قدام كل صنف بالمخزون».
     ليه من غير مكتبة: الحزمة المنشورة على GitHub Pages بتضل ملفات العشرة
     بتوعها بالظبط (مافيش dependency خارجي ولا CDN)، وجدول CODE-128 قياسي
     ومغلق: 107 رمز فقط ⇒ يبقى سطرًا في الكود بدل مكتبة.
     حصانة البيانات (قاعدة المالك «متحذفش بيانات موجودة»): أي صنف ليه باركود
     مصنع ⇒ **ممنوع لمسه**. التوليد بيملّى الفراغ بس، وممنوع أي رقم يتكرر
     جوه نفس الشركة (الرقم المكرّر بيخلّي الإسكانر ما يفرّقش بين صنفين) ⇒
     الحفظ يرفض برسالة ودّية باسم الصنف التاني.
     رقم «ميزان» الداخلي: ‹200› + رقم الصنف (9 أرقام) + رقم تحقق GS1 = 13 رقم.
     ‹200› اختياري لأن GS1 سيّس النطاق 200-299 للاستخدام الداخلي للمحلات،
     فمستحيل يصطدم مع باركود مصنع حقيقي؛ ورقم التحقق بيخلي الإسكانر يرفض
     أي قراءة ناقصة أو غلط قبل ما تدخل الفاتورة. */
  const BC128_BARS = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
    "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
    "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
    "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
    "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
    "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
    "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
    "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
    "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
    "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
    "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
    "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
    "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
    "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
    "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
    "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
    "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
    "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
    "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
    "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
    "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
    "11010011100", "1100011101011"
  ];
  const BC128_START_B = 104;     // بداية Set B
  const BC128_STOP = 106;        // رمز الوقوف (13 وحدة — أطول من باقي الرموز)
  const BC128_MODULO = 103;      // قالب رقم المراجعة
  const BC128_MIN_CH = 32;       // Set B = ASCII 32..126 (أرقام + حروف إنجليزي + رموز)
  const BC128_MAX_CH = 126;
  const BC_PREFIX = "200";       // الاستخدام الداخلي (GS1)
  const BC_ID_DIGITS = 9;        // 3 + 9 + 1 = 13 خانة
  const BC_LABELS_MAX = 60;      // سقف الملصقات في الطباعة الواحدة

  // قيمة الرمز في Set B = رقم الـ ASCII مطروح منه 32
  function bc128Value(ch) {
    const c = ch.charCodeAt(0);
    if (c < BC128_MIN_CH || c > BC128_MAX_CH) return -1;
    return c - BC128_MIN_CH;
  }

  /* سلسلة الوحدات (1 = أسود / 0 = أبيض): بداية + البيانات + المراجعة + وقوف.
     أي حرف خارج Set B ⇒ رجوع فاضي — ممنوع تخمين أو إبدال حرف بصورته. */
  function bc128Bits(text) {
    const s = String(text == null ? "" : text);
    if (!s.length) return "";
    let bits = "", sum = BC128_START_B, pos = 1;
    for (let i = 0; i < s.length; i++) {
      const v = bc128Value(s.charAt(i));
      if (v < 0) return "";
      bits += BC128_BARS[v];
      sum += v * pos;
      pos++;
    }
    return BC128_BARS[BC128_START_B] + bits + BC128_BARS[sum % BC128_MODULO] + BC128_BARS[BC128_STOP];
  }

  // رسم SVG: مستطيل لكل مجموعة «1» متتالية ⇒ حاد على أي مقاس ورق وبلا أي صورة
  function barcodeSvg(text, o) {
    const bits = bc128Bits(text);
    if (!bits) return "";
    const opts = o || {};
    const mw = Number(opts.mw) > 0 ? Number(opts.mw) : 0.26;   // عرض الوحدة (mm)
    const h = Number(opts.h) > 0 ? Number(opts.h) : 10;        // ارتفاع الخطوط (mm)
    const qz = Number(opts.qz) >= 0 ? Number(opts.qz) : 10;    // منطقة الصمت يمين وشمال
    const units = bits.length + qz * 2;
    let rects = "", k = 0;
    while (k < bits.length) {
      if (bits.charAt(k) === "1") {
        let e = k;
        while (e < bits.length && bits.charAt(e) === "1") e++;
        rects += '<rect x="' + (qz + k) + '" y="0" width="' + (e - k) + '" height="' + h + '"/>';
        k = e;
      } else k++;
    }
    return '<svg class="bc-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="باركود" ' +
      'viewBox="0 0 ' + units + ' ' + h + '" width="' + (units * mw).toFixed(2) + 'mm" height="' + h + 'mm" ' +
      'preserveAspectRatio="none" fill="#000" shape-rendering="crispEdges">' + rects + '</svg>';
  }

  // رقم التحقق GS1 (mod 10): الوزن 3 بيتحسب **من اليمين** — الخانة اللي على شمال
  // رقم التحقق ضرب 3، وبعدين 1 و3 بالتبادل وهي طالع للشمال. الفرق مش شكلي: في GTIN-13
  // (12 خانة بيانات) أول خانة شمال وزنها 1، وفي EAN-8 (7 خانات) أول خانة وزنها 3.
  // لو حسبتها من الشمال غلط، الأرقام بتاعتنا تبان «باركود غير صحيح» لأي إسكانر أو
  // برنامج بيحقق رقم التحقق، وده كان هيضرب في المسح بالباركود (بناء 140).
  function gs1CheckDigit(body) {
    const s = String(body == null ? "" : body);
    if (!/^[0-9]+$/.test(s)) return "";
    let sum = 0;
    for (let i = 0; i < s.length; i++) {
      const weight = ((s.length - 1 - i) % 2 === 0) ? 3 : 1;
      sum += Number(s.charAt(i)) * weight;
    }
    return String((10 - (sum % 10)) % 10);
  }

  /* رقم «ميزان» الداخلي للصنف — مشتق من `id` لأنه هو الهوية العابرة للأجهزة
     (cloud.js بيشحن local_id = id)، فالرقم بيطلع نفسه على كل جهاز وبيفضل ثابت. */
  function internalBarcode(id) {
    const n = Number(id);
    if (!Number.isFinite(n) || Math.floor(n) !== n || n < 1 || n > 999999999) return "";
    const body = BC_PREFIX + String(n).padStart(BC_ID_DIGITS, "0");
    const cd = gs1CheckDigit(body);
    if (!cd) return "";
    return body + cd;
  }

  /* تنضيف الرقم: أرقام عربية → إنجليزي + شيل المسافات وعلامات الاتجاه.
     **ممنوع normalizeAr هنا** — هو بيرجّل الحروف لإنجليزي صغير، وCODE-128
     بيحسّ بالفرق بين «A» و«a» ⇒ رقم المصنع كان بيتغير ومينفعش إسكانر يقرأه. */
  function bcDigits(v) {
    let s = String(v == null ? "" : v);
    s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
    s = s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
    s = s.replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, "");
    return s.replace(/\s+/g, "");
  }

  function productHasBarcode(p) {
    return !!(p && bcDigits(p.barcode) !== "");
  }

  // الصنف التاني اللي شايل نفس الرقم (ممنوع تكرار الباركود جوه الشركة)
  function barcodeConflictOf(code, exceptId) {
    const b = bcDigits(code);
    if (!b) return null;
    return products.find((p) => p.id !== exceptId && bcDigits(p.barcode) === b) || null;
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     بناء 143 — المسح الضوئي لباركود الصنف (فاتورة البيع + فاتورة الشراء + إدخال الصنف)
     طلب المالك (③ من خطته + تعديله الحرفي 05/10): «الإسكانر يقرأ ⇒ يتعرّف على الصنف
     ويختاره والمالك يكتب الكمية»، و«ممكن اكتب صنف عادى يدوى، ممكن ميكونش له باركود أو
     ممكن يكون البائع ليس لديه ماكينة قراءة الباركود».
     ⇒ المسح **طريقة زيادة مش بديلة**: الكتابة اليدوية بالاسم أو الكود سايبة زي ما هي تمامًا.

     كل الإسكانرات (1D ليزر و2D بيقرا حتى المربع QR) بتشتغل keyboard wedge: بتـ«تكتب»
     النص اللي جوه الكود حرف بحرف وبعدين تدوس Enter. فالمطلوب من عندنا اتنين:
       (١) **نضّف** النص (CR/LF/TAB + أرقام عربية) — `scanClean`
       (٢) **نميّز** الإسكانر عن الصابع البشري — `scanKey` مع كل حرف + `scanIsBurst` عند Enter
           — عشان نعرف هل Enter ده «إنهاء مسح» (نختار الصنف ونقفل على خانة الكمية) ولا
           «إنهاء كتابة» (السلوك القديم: يضيف السطر على طول).
     مطابقة المسح **حرفية** (باركود ⇐ كود)، ومع تسامح الأصفار اللي على الشمال بس
     (UPC-12 = EAN-13 بنفس الرقم). ممنوع المطابقة الجزئية في الأرقام: «1234» لو
     دخلت على findProductFlexible كانت هتجيب أي صنف بيحتويها ⇒ سطر غلط على الفاتورة.
     ══════════════════════════════════════════════════════════════════════════════ */

  // الإسكانر بيرمي الرقم + CR/LF؛ bcDigits بتشيل المسافات والعربي، وعلامات التحكم هنا.
  function scanClean(raw) {
    return bcDigits(raw).replace(/[\u0000-\u001F\u007F\u00A0]/g, "");
  }

  /* الإسكانر بيخلص سلسلة حروفه في أقل من ~50ms/حرف، والصابع البشري فوق 150ms دايمًا.
     90ms = حدود أمان في نص الطريق (الاتنين بيوصلوا لنفس السطر في الآخر، الفرق Enter زيادة). */
  const SCAN_MAX_GAP_MS = 90;
  const SCAN_MIN_LEN = 4;
  const SCAN_BURST_CHARS = 3;
  const scanTrace = {};
  /* ═══ 145: الساعة بتقرأ **وقت وصول الحرف**، مش «وقت ما المعالج فات» ═══
     القياس الحيّ (كروم، ١٤ صنف مزروع، أول مسحة بعد فتح الفاتورة): أول حرف بيشغّل أول
     رسم للوحة الاقتراح ⇒ الفارق بين أول معالج وتاني معالج اتقيس **85ms** (وفي الرحلة
     الكاملة عدّى 90) ⇒ `gap > SCAN_MAX_GAP_MS` ⇒ السلسلة بتبتدي من الحرف التاني ⇒ ذيل
     المسحة «2000000000114» بقى «000000000114» ⇒ «🔍 ملقتش صنف بالرقم …» والسطر ما ينزلش.
     دي مش بطء الإسكانر — الماسح بيرمي حروفه كل ~10ms، والمتصفح بيأخّر اللي وراه في
     الطابور وهو بيرسم الاقتراحات، فالوقت الحقيقي للوصول محفوظ في الحدث نفسه (`event.timeStamp`).
     الصابع البشري برده بيتقاس من وصول الحرف (فوق 150ms)، فحدّ الأمان 90ms ما اتغيّرش. */
  function scanArrival(ev) {
    try {
      const to = performance && performance.timeOrigin;
      const ts = ev && ev.timeStamp;
      if (typeof to === "number" && to > 1e11 && typeof ts === "number" && isFinite(ts) && ts >= 0) return to + ts;
    } catch (e) { /* متصفح قديم بلا `timeOrigin` ⇒ رجوع لساعة النظام (سلوك 143 بالأحرف) */ }
    return Date.now();
  }
  /* ⚠️ تُنادى مع **كل حرف** يدخل الخانة (من مستمع `input`)، مش عند Enter.
     لو نناديها عند Enter بس ⇒ السلسلة ما تتقاسش خالص (streak يفضل 1) والإسكانر
     يتعامل معاملة الصابع. الدالة دي بتكتب الطابع الزمني وبتعدّ السلسلة.
     الوسيط التاني (`ev`) = الحدث اللي جاب الحرف، ومنه بنقرا وقت الوصول؛ ولو اتنادت
     من غير حدث (اللصق/الماسح البارد) بتقع على ساعة النظام. */
  function scanKey(fieldId, ev) {
    const now = scanArrival(ev);
    const t = scanTrace[fieldId];
    const gap = t ? now - t.last : 0;
    scanTrace[fieldId] = { last: now, streak: t && gap >= 0 && gap <= SCAN_MAX_GAP_MS ? t.streak + 1 : 1 };
  }
  // بتقرأ السلسلة بس — ممنوع تكتب حاجة (الكتابة شغل scanKey)
  function scanIsBurst(fieldId, len) {
    const t = scanTrace[fieldId];
    return len >= SCAN_MIN_LEN && !!t && t.streak >= SCAN_BURST_CHARS;
  }
  /* ═══ مصدر قرار «ده مسح» الوحيد: **الزنة + الشكل** ═══
     `scanIsBurst` لوحدها بتقيس السرعة بس ⇒ الكتابة السريعة بالإيد كانت بتتحوّل لمسار
     الباركود: البائع اللي بيكتب «تيل خلفي» في خانة الاسم (25ms بين الحرفين = أسرع من
     حد الأمان) كان بياخد «🔍 ملقتش صنف بالرقم تيلخلفي» بدل ما يتعدّى بالإيد — والرفض
     بيخلي الكلمة قدامه والسطر ما ينزلش (باگ حيّ مقاس في قيادة 145، وعادي كان بيحصل
     في فاتورة البيع والشراء كمان من بناء 143).
     القرار بقى نفس قاعدة اللصق (`scanPasteRun` كان بيعملها حرفيًا): **رقم يشبه باركود
     ⇒ مسح، وكلام ⇒ مسار الكتابة اليدوي**. ممنوع أي نداء «ده مسح» يقيس السرعة وحدها. */
  function scanBurstOf(fieldId, raw) {
    const cleaned = scanClean(raw);
    return scanLooksCode(cleaned) && scanIsBurst(fieldId, cleaned.length);
  }
  /* «ذيل المسحة» — نفس قرار `coldFlush` بس في الخانة المركّز عليها:
     لو الإسكانر مرّر مسحة جديدة والخانة لسه شايلة رقم مرفوض من مسحة قبلها (الرفض **بيمدي**
     الرقم قدام البائع بالعمد عشان يصلّح الكمية ويدوس Enter)، الرقم الجديد كان بيركّب وراه
     ⇒ «ملقتش صنف بالرقم 2000000000021200000000039» للأبد، وكل مسحة بعدها بتبقى أسوأ.
     `scanTrace[fieldId].streak` = كام حرف جايين من الماكينة في آخر سلسلة سريعة (نفس
     العدّاد اللي `scanIsBurst` بيقراه — مافيش ساعة تانية)، فاللي قبله صابع بيتساب.
     السلسلة القصيرة (`< SCAN_MIN_LEN`) أو الخانة اللي فيها المسحة كلها ⇒ بلا قصّ خالص.
     ⚠️ القصّ بيبدأ من **المؤشر** (`selectionStart`) مش من آخر الخانة: الماكينة بتكتب عند
     المؤشر، واللي بيختار خانة بفأرة بيوصل المؤشر في **نص** الرقم اللي قبلها ⇒ المسحة
     بتنغرس في النص («2000000» + «0000021» + «039»). لو قصّينا من الآخر كان بيبقى
     «0039000000021» — رقم مش حقيقي لحد في الخانة، وبيرفض للأبد (مقاس في قيادة 145 على
     الخانات التلاتة: الجرد والبيع والشراء). المؤشر براRange أو ناقص ⇒ رجوع لآخر الخانة
     (سلوك بناء 143 حرفيًا، فأي مسحة تخلص في الآخر ما بيتغيّرش قرارها). */
  function scanTailOf(fieldId, raw) {
    const all = String(raw == null ? "" : raw);
    const t = scanTrace[fieldId];
    const run = t ? Math.min(all.length, Number(t.streak) || 0) : 0;
    if (run < SCAN_MIN_LEN || run >= all.length) return all;
    let caret = all.length;
    try {
      const el = document.getElementById(fieldId);
      const s = el && el.selectionStart;
      if (typeof s === "number" && s >= run && s <= all.length) caret = s;
    } catch (e) { /* خانة ما بتنقّlush المؤشر (contenteditable قديم) ⇒ آخر الخانة */ }
    return all.slice(caret - run, caret);
  }
  /* نفس `scanTailOf` بس **بيظبّط الخانة** كمان. السبب: الرفض بيمدي الرقم قدام البائع
     بالعمد عشان يصلّح الكمية ويدوس Enter — لوسابيناه متلخبط («2000000» + «0000021» + «039»
     = ٢٦ رقم) كان هيفضل قدامه للأبد وكل مسحة تنغرس فيه من تاني. اللي يظهر في الخانة بقى
     = اللي الرسالة بتتكلم عليه بالضبط. مافيش كتابة خالص لو الذيل هو الخانة نفسها. */
  function scanTailNorm(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return "";
    const all = String(el.value == null ? "" : el.value);
    const tail = scanTailOf(fieldId, all);
    if (tail !== all) {
      el.value = tail;
      try { el.setSelectionRange(tail.length, tail.length); } catch (e) { /* خانة بلا مؤشر */ }
    }
    return tail;
  }
  /*الثالث اللي بيقدر يكتب في `scanTrace`: **طمس** الطابع (مش مسح). السبب الحقيقي:
     الطابع بيفضل في الخانة بعد أي مسح، فالفعل التالي لو بشري (لصق اسم بدل رقم، أو الدوس
     على رقم من الاقتراح) كان بيسرق المسار القديم بقرار من مسح **قديم**. كل استعمال ليها
     بيجي في لحظة بشرية مؤكدة ⇒ المسار يرجع للصابع، والكمية تبقى 1 زي الأول. */
  function scanTraceClear(fieldId) {
    scanTrace[fieldId] = { last: 0, streak: 0 };
  }

  /* ══ زنة «مسدس الباركود» (طلب المالك 05/10 ≈18:05: «يظهر صوت الماكينة المسدس عند تعرفه على الصنف») ══
     النغمة بتتولّد في المتصفح نفسه (`AudioContext` + oscillator) ⇒ **مافيش ملف صوت ولا أي طلب
     إنترنت**. وبتتنادى **بعد** قرار التعريف مش قبله ⇒ الصمت معناه مافيش صنف اتعرف.
     أي زعلة من المتصفح (موبايل قبل أول لمسة، أو مافيش `AudioContext`) بتبلع نفسها في صمت:
     **ممنوع أي خطأ يقطع المسح أو يطلّع أي حاجة للعميل.** */
  const SCAN_BEEP_OK = [[2100, 55, 0], [2550, 60, 80]];   // صنف موجود اتعرف وضاف = بيب ضغيين (زي الماكينة)
  const SCAN_BEEP_NEW = [[1850, 110, 0]];                  // رقم جديد بيتسجّل صنف = بيب واحد حاد
  const SCAN_BEEP_NO = [[190, 150, 0]];                    // مرفوض (موقوف/مكرر/ملوش صنف/كمية ناقصة) = طنين واطي
  let scanAudio = null;
  function scanTone(freq, durMs, delayMs, peak) {
    const ctx = scanAudio;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + delayMs / 1000;
    osc.type = "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durMs / 1000 + 0.02);
  }
  function scanBeep(kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!scanAudio) scanAudio = new AC();
      if (scanAudio.state === "suspended" && scanAudio.resume) scanAudio.resume().catch(() => {});
      const notes = kind === "no" ? SCAN_BEEP_NO : kind === "new" ? SCAN_BEEP_NEW : SCAN_BEEP_OK;
      const peak = kind === "no" ? 0.05 : 0.07;
      notes.forEach((n) => scanTone(n[0], n[1], n[2], peak));
    } catch (e) { /* المتصفح رفض الصوت — الشغل كله بيتم من غير زعلة */ }
  }

  /* ══ إسكانرات بت**تلصق** (paste) بدل ما تكتب حرفًا حرفًا ══
     فئة حقيقية من الماكينات (وبالذات تطبيقات المسح على الموبايل) بتسلّم الرقم دفعة واحدة
     في الحافظة. الطلب: «يتعرف على اي نوع سكان» ⇒ بنختم نفس ختم السلسلة وبعدها نكمّل
     **نفس** مسار Enter (مافيش طريق تاني للإضافة). `paste` بيسبق تحديث القيمة ⇒ `setTimeout(0)`.
     ⚠️ دي **التانية** اللي بتكتب في `scanTrace` (الأولى `scanKey` — و`scanIsBurst` قارئة بس،
     والثالثة `scanTraceClear` بتطمس)، وبتكتب **بس** لو اللي اتلصق بيبدو رقم صنف
     (`scanLooksCode`) ⇒ لصق اسم عربي بيرجع للمسار اليدوي القديم حرفيًا، وما بيختارش صنف
     ومن ما بيضيفش سطر. */
  function scanLooksCode(s) {
    if (s.length < SCAN_MIN_LEN) return false;
    return /^[0-9A-Za-z][0-9A-Za-z.\-_]*$/.test(s) && /[0-9]/.test(s);
  }
  function scanPasteRun(fieldId, then) {
    setTimeout(() => {
      const v = scanClean($("#" + fieldId).value);
      if (scanLooksCode(v)) {
        scanTrace[fieldId] = { last: Date.now(), streak: Math.max(SCAN_BURST_CHARS, v.length) };
      } else {
        // اللي اتلصق اسم (مش رقم صنف) ⇒ فعل بشري ⇒ نطمس أي طابع مسح قديم ونمشي المسار القديم
        scanTraceClear(fieldId);
      }
      then();
    }, 0);
  }

  /* «لو الكود فيه مسافة يبقى باركود منتج، ولو من غير مسافة يكون كود الصنف» (طلب 05/10 ≈18:05).
     المسافة جوه الرقم بتيجي من الإسكانرات اللي بتنقّ الباركود لمجموعات (6221 0863 0001 2)،
     و**كودات ميزان مالهاش مسافة خالص** ⇒ المسافة علامة موثوقة إن الرقم ده باركود مصنع ⇒
     المطابقة بتبقى على عمود `barcode` **حصريًا** (لا خانة «الكود»، ولا البحث بالاسم).
     ⚠️ المسح بيتقاس على `raw` قبل `scanClean` (هي اللي بتشيل المسافات). */
  function scanHadSpace(raw) {
    return /[ \t\u00A0]/.test(String(raw == null ? "" : raw));
  }

  // حدود الإكمال اليدوي: من **رقم واحد** (طلب 06/10 حرفيًا: «لما بكتب … رقم 2») لسقف ٦ أرقام
  // في القائمة عشان الشاشة ما تبقىش ضجيج.
  const SCAN_SUGGEST_MIN = 1;
  const SCAN_SUGGEST_MAX = 6;

  // كل مطابقات الرقم الممسوح، مرتّبة بالدقة: 1 باركود · 2 كود · 3/4 بنفس الرقم بلا أصفار
  // `bcOnly=true` (رقم فيه مسافة ⇒ باركود مصنع) ⇒ الطبقتين 2 و 4 بتتشالوا: كود الصنف
  // مالوش مسافة خالص، فممنوع رقم باركود يطيح على كود صنف تاني بالصدفة.
  function scanMatches(s, bcOnly) {
    const out = [];
    if (!s) return out;
    const up = s.toUpperCase();
    const bare = up.replace(/^0+/, "");
    products.forEach((p) => {
      const b = bcDigits(p.barcode).toUpperCase();
      const c = String(p.code == null ? "" : p.code).trim().toUpperCase();
      if (b && b === up) { out.push({ p: p, tier: 1 }); return; }
      if (!bcOnly && c && c === up) { out.push({ p: p, tier: 2 }); return; }
      // الأصفار على الشمال بتترفع من **الجهتين** (UPC-12 و EAN-13 رقم واحد):
      // «012345678905» المخزّن و«12345678905» الممسوح — أو العكس. كل صنف بيرجع مرة
      // واحدة بس (الـ return فوق)، فمافيش تكرار في الطبقات.
      if (bare) {
        if (b && b.replace(/^0+/, "") === bare) { out.push({ p: p, tier: 3 }); return; }
        if (!bcOnly && c && c.replace(/^0+/, "") === bare) { out.push({ p: p, tier: 4 }); return; }
      }
    });
    return out;
  }

  /* ══ «كل ما اكتب رقم من الباركود يبحث في المخزون ويكمّلي الرقم» (طلب 05/10 ≈18:20) ══
     الكتابة اليدوية في خانة الكود بتنزّل **قائمة منسدلة تحت الخانة** فيها أرقام الأصناف
     اللي **بتنتهي** باللي كتبه (وبعدين اللي بتبدأ بيه)، من **رقم واحد**، بحد `SCAN_SUGGEST_MAX`.
     ⚠️ سبب تقديم «النهاية» (طلب 06/10 بحرفه: «لما بكتب رقم 2 بيطلع لى تليفزيون… فالمفروض
     تنزل قائمه من الخانة بها الارقام اللى بتنتهى بالرقم اللى انا كاتبه»): أرقام ميزان
     الداخلية كلها بتبدأ بـ«200» ⇒ البادئة «2» مطابقة لكل الأصناف تقريبًا، والفرق الحقيقي
     في آخر الرقم. الاختيار بيزوّد الخانة الرقم كامل ومن ما بيضيفش سطر: المالك لسه يتأكد
     ويدوس ➕. و«ممنوع» الإسكانر يلاقي شريط اقتراح واقف أمامه ⇒ `scanIsBurst` بتنضّف وترجع false.
     ⚠️ ممنوع `datalist`: في RTL بيخطف Enter ويغير مسار الإسكانر ⇒ القائمة بتاعتنا بأزرار
     `data-scan-pick` في لوحة `.scan-drop` مربوطة بنفس الخانة. */
  function scanSuggestItems(raw) {
    const q = scanClean(raw).toUpperCase();
    if (q.length < SCAN_SUGGEST_MIN) return [];
    const tail = [], head = [];
    products.forEach((p) => {
      if (!p.isActive) return;
      const b = bcDigits(p.barcode).toUpperCase();
      const c = String(p.code == null ? "" : p.code).trim().toUpperCase();
      const ends = (n) => !!n && n.length >= q.length && n.slice(-q.length) === q;
      const starts = (n) => !!n && n.indexOf(q) === 0;
      // «بتنتهي» أولًا، وبعدها «بتبدأ» — والرقم اللي في الخانة يبقى هو الرقم الكامل للصنف
      if (ends(b)) tail.push({ p: p, full: bcDigits(p.barcode), bc: true });
      else if (ends(c)) tail.push({ p: p, full: c, bc: false });
      else if (starts(b)) head.push({ p: p, full: bcDigits(p.barcode), bc: true });
      else if (starts(c)) head.push({ p: p, full: c, bc: false });
    });
    const order = (arr) => arr.sort((x, y) => (x.full.length - y.full.length) ||
      String(x.p.nameAr || x.p.code).localeCompare(String(y.p.nameAr || y.p.code), "ar"));
    return order(tail).concat(order(head)).slice(0, SCAN_SUGGEST_MAX);
  }

  // html القائمة — فاضية لو مافيش حاجة تطابق (واللوحة بتتقفل، مش يفضل عفا عليه الزمن)
  function scanSuggestHtml(raw) {
    const list = scanSuggestItems(raw);
    if (!list.length) return "";
    const q = scanClean(raw);
    return "💡 الأصناف اللي أرقامها بتنتهي بـ <b class='scan-code'>" + esc(q) + "</b> — دوس على الرقم يكمّل في الخانة:" +
      "<span class='scan-picks'>" + list.map((it) =>
        "<button type='button' class='scan-act' data-scan-pick='" + esc(it.full) + "'>" +
        esc(it.full) + (it.bc ? "" : " (كود)") + " — " + esc(it.p.nameAr || it.p.code) + "</button>"
      ).join("") + "</span>";
  }

  /* اللوحة المنسدلة نفسها: مكانها تحت الخانة بالظبط (طلب «تنزل قائمه من الخانة»).
     كل خانة كود ليها لوحتها (`#scanDrop-txtPosCode` / `#scanDrop-txtPPCode`) — واللوحة
     مستحيل تبقى «شبح» من خانة تانية لأن اسمها بيتبنى من الـ fieldId نفسه.
     ⚠️ `HINT_DROP_FIELD` = قرار واحد: أي رسالة مسح (نجاح / رفض / تصفير) **بتقفل** قائمة
     الأرقام المرتبطة بيها، فمستحيل العميل يشوف قائمة قدام رسالة «اتضاف» أو العكس.
     بناء 145 (الجرد بالباركود) بيضيف سطره هنا لما لوحة `#scanDrop-txtScCode` تدخل. */
  const HINT_DROP_FIELD = { "#posScanHint": "txtPosCode", "#ppScanHint": "txtPPCode", "#scScanHint": "txtScCode" };
  function scanDropSel(fieldId) { return "#scanDrop-" + fieldId; }
  function scanDropHide(fieldId) {
    const el = $(scanDropSel(fieldId));
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }
  function scanDropOfHint(hintSel) {
    const fieldId = HINT_DROP_FIELD[hintSel];
    if (fieldId) scanDropHide(fieldId);
  }

  /* بتنادي الاقتراح بعد أي كتابة يدوية. بترجع true لو عرض حاجة (واللوحة مليانة)،
     false لو الإسكانر بيكتب أو مافيش مطابق (فاللوحة والـ hint بيتنضّفوا). */
  function scanSuggestShow(hintSel, fieldId, raw) {
    // الإسكانر شغال ⇒ مافيش اقتراح، **واقتراح الكتابة السابقة يتنضّف**. من غير السطر ده
    // لو المالك كان بيكتب رقم بإيده (واللوحة تحتة مليانة أرقام) وإسكانر اتوهّط على نفس
    // الخانة، اللوحة كانت بيفضل معلق قدام العميل طول المسح لحد Enter.
    if (scanBurstOf(fieldId, raw)) { scanHint(hintSel); scanDropHide(fieldId); return false; }
    const html = scanSuggestHtml(raw);
    if (!html) { scanHint(hintSel); scanDropHide(fieldId); return false; }
    // الكتابة من الصابع قرار جديد ⇒ رسالة المسح القديمة تتشال الأول (`scanHint` بتقفل
    // اللوحة كمان بالـ map فوق)، وبعدين اللوحة تتملأ وتظهر — فالترتيب part من القرار.
    scanHint(hintSel);
    const el = $(scanDropSel(fieldId));
    if (el) { el.className = "scan-drop"; el.innerHTML = html; el.hidden = false; }
    return true;
  }

  /* رقم ناقص (مش مطابق كامل) ⇒ ممنوع نقفل على صنف ونعرض رصيده. ده السبب الجذري لشكوى
     06/10: «2» كانت بتلمس أول صنف بالبحث الجزئي («تليفزيون» + رصيده) واللي يقصد صنف تاني.
     الأرقام الخالصة اللي مالهاش مطابقة حرفية بتستنى الاختيار من القائمة؛ أي حاجة فيها
     حروف (اسم عربي ملصوق أو مكتوب) بتمشي على المسار القديم بالحرف. */
  function scanPartialNumber(q) {
    const s = scanClean(q);
    if (!s || !/^[0-9]+$/.test(s)) return false;
    return scanMatches(s, false).length === 0;
  }


  // الدوس على رقم في القائمة ⇒ يمشي كامل في الخانة + يتعرّف على الصنف (بدون إضافة)
  function scanSuggestPick(hintSel, fieldId, raw, onFilled) {
    const el = $("#" + fieldId);
    if (!el) return false;
    el.value = scanClean(raw);
    // الدوس بالإصبع = فعل بشري ⇒ أي طابع مسح قديم في نفس الخانة لازم يطمس، وإلا
    // Enter الجاي بيتعامل كمسح (كمية مطلوبة + 🧮) بدل المسار القديم (يضيف بالكمية 1).
    scanTraceClear(fieldId);
    scanHint(hintSel);
    // الرقم اكتمل ⇒ القائمة اللي تحت الخانة اتحلت غرضها، تتقفل فورًا (مش قدام عين العميل)
    scanDropHide(fieldId);
    if (onFilled) onFilled();
    el.focus();
    return true;
  }

  /* دايمًا كائن واحد: { prod, code, why, others, off } — `why` هو اللي بيحدّد الرسالة
     الودّية (ممنوع أي اصطلاح تقني يظهر للعميل). الأرقام اللي مالهاش مطابقة حرفية
     **بتترفض** مش بتتخمن؛ النصوص فيها حروف ترجع لطريقة الكتابة القديمة. */
  function findProductByScan(raw) {
    const code = scanClean(raw);
    if (!code) return { prod: null, code: "", why: "empty" };
    const bcOnly = scanHadSpace(raw);
    const hits = scanMatches(code, bcOnly);
    if (hits.length) {
      let best = hits[0];
      hits.forEach((h) => { if (h.tier < best.tier) best = h; });
      const rivals = hits.filter((h) => h.tier === best.tier && h.p.id !== best.p.id);
      if (rivals.length) {
        /* `hits` كائنات مطابقة {tier,p} مش أصناف: كان `concat(rivals)` بيزقّ الكائن في
           others، و`scanFailText` بتقرا p.nameAr ⇒ الاسم التاني كان بيفضل فاضي حرفيًا
           في رسالة العميل («(كازورة · )» — قياس الحارس 143). لازم نفكّ `.p` الأول. */
        return { prod: null, code: code, why: "ambiguous", others: [best.p].concat(rivals.map((h) => h.p)) };
      }
      const p = best.p;
      if (!p.isActive) return { prod: null, code: code, why: "inactive", off: p };
      return { prod: p, code: code, why: "ok" };
    }
    if (/^[0-9]+$/.test(code)) return { prod: null, code: code, why: "notfound" };
    const p = findProductFlexible(code);
    if (!p) return { prod: null, code: code, why: "notfound" };
    if (!p.isActive) return { prod: null, code: code, why: "inactive", off: p };
    return { prod: p, code: code, why: "ok" };
  }

  // الطبقة دي بتكتب الرسالة الودّية اللي تحت خانة الكود (مش توست عابر عشان العميل يقدر يقرا)
  function scanHint(sel, kind, html) {
    const el = $(sel);
    if (!el) return;
    // 📷 بناء 144: رسالة المسح والقائمة المنسدلة **قرار واحد** — أي رسالة (أو تصفير)
    // بتقفل قائمة الأرقام المرتبطة بخانتها، فمافيش قائمة قديمة تفضل قدام العميل.
    scanDropOfHint(sel);
    if (!html) { el.hidden = true; el.innerHTML = ""; el.className = "scan-hint"; return; }
    el.className = "scan-hint " + (kind || "info");
    el.innerHTML = html;
    el.hidden = false;
  }

  // ممنوع أي HTML في الرقم الممسوح ⇒ بيتمشى في الرسالة كنص صافي
  function scanMsg(code, extra) {
    return "<b class='scan-code'>" + esc(code || "") + "</b>" + (extra ? " " + extra : "");
  }

  /* الرسالة بكل حالاتها — كلها ودّية وبتدلّ على الخطوة الجاية، وممنوع فيها
     (barcode/RLS/RPC/42501/Invalid) أو أي مصطلح تقني. */
  function scanFailText(res) {
    if (res.why === "empty") return "📷 مافيش رقم وصل — قلّب الإسكانر على الخانة، أو اكتب الكود/الاسم بنفسك.";
    if (res.why === "inactive") return "🚫 الصنف (" + esc(res.off.nameAr || res.off.code) + ") متوقف للبيع — فعّله من «دليل الأصناف» الأول.";
    if (res.why === "ambiguous") return "⚠️ الرقم ده مسجّل عند أكتر من صنف (" +
      res.others.map((p) => esc(p.nameAr || p.code)).join(" · ") +
      ") — اختار الصنف اللي تقصده بكتابة اسمه في خانة الاسم.";
    return "🔍 ملقتش صنف بالرقم " + scanMsg(res.code) +
      " — تقدر تكتب اسم الصنف في خانة الاسم، أو تسجّله صنف جديد بالرقم ده.";
  }

  /* ══════════════════════════════════════════════════════════════════════════
     📷 بناء 144 — «لما بضغط على زرار مسح المفروض يفتح لى الكاميرا فى الجزء العلوى
     من الشاشة لعمل سكان للباركود» (طلب المالك بحرفه 06/10، البند «اولا»).

     ⇒ زرار «📷 مسح» في رأس فاتورة البيع والشراء بقى يفتح **لوحة كاميرا فوق الشاشة**،
       والكاميرا تقرأ لوحدها ⇒ الرقم يروح لنفس `posHandleScan`/`ppHandleScan` **بالحرف**
       (نفس المسار اللي الإسكانر بيمشيه: الصنف يتعرّف ويختار نفسه، والكمية من يد البائع،
       وممنوع أي مسحة — كاميرا أو إسكانر — تضيف سطرًا من نفسها).

     القراءة بتحصل بطريقتين، والاتنين مقاسين في الحارس:
       (أ) لو المتصفح عنده قارئ باركود جاهز (كروم على الموبايل) بيتقدّم ويُستخدم.
       (ب) وإلا **الفكّ بتاعنا**: نفس جدول `BC128_BARS` اللي ببنائي بيطبع بيه الملصقات
           (بناء 142) + جداول EAN-13 ⇒ أي ملصق «ميزان» مطبوع، وأي باركود مصنع ١٣ خانة.
     ⚠️ رقم التحقق بوّابة (**mod-103** في CODE-128 و**GS1 mod-10** في EAN-13): أي شبه
        قراءة غلط = مافيش إضافة خالص، مش إضافة ناقصة. وممنوع رقم يتسجّل مرتين في نفس
        المرور (`CAM_DEDUPE_MS`) ⇒ الكاميرا ساقعة قدام الصنف ما تضاعفش الكمية.
     ⚠️ اللوحة ما بتقفلش الشاشة: أي خروج أو تغيير شاشة أو Esc بيقفل الكاميرا فعلًا
        و**بيوقف العدّاد بتاعها وبيطفي الـ track** (الكاميرا ما يفضلش شغالة وخلفها حد).
     ══════════════════════════════════════════════════════════════════════════ */
  const CAM_W = 640;          // عرض لقطة الالتقاط (كافية للخطوط وبتطلع سريع)
  const CAM_H = 360;          // ارتفاعها
  const CAM_ROWS = 13;        // عدد السطور الأفقية اللي بتتفحص في كل لقطة
  const CAM_MIN_RUNS = 24;    // أقل عدد خطوط في السطر = باركود محتمل
  const CAM_MIN_CONTRAST = 40; // أقل فرق بين الفاتح والغامق في السطر (نور كفاية)
  const CAM_DEDUPE_MS = 1400;  // نفس الرقم متسجلش مرتين في نفس المرور
  const CAM_MAX_BITS = 420;    // سقف سلسلة الوحدات (أكبر باركود مشنّاه هنا 178)

  /* جداول EAN-13: الـ L منشور، والـ R = عكسه بيت-ببيت، والـ G = أرجوعي R (نفس تعريف
     المواصفة). بنشتقهم بدل ما نكتبهم يدوي ⇒ مستحيل يحصل خطأ نسخ في دول. */
  const CAM_EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011"];
  const CAM_EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
    "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
  function camBitsNot(s) {
    let o = "";
    for (let i = 0; i < s.length; i++) o += s.charAt(i) === "1" ? "0" : "1";
    return o;
  }
  function camBitsRev(s) { return s.split("").reverse().join(""); }
  const CAM_EAN_R = CAM_EAN_L.map(camBitsNot);
  const CAM_EAN_G = CAM_EAN_R.map(camBitsRev);
  // «ميزان» بيطبع CODE-128 من نفس الجدول ⇒ انعكاسه كمان جاهز من نفس المصدر
  const CAM_BC_REV = (function () {
    const m = {};
    BC128_BARS.forEach((b, i) => { m[b] = i; });
    return m;
  })();

  // حالة اللوحة — كائن واحد عشان الإيقاف الكامل يبقى سطر واحد (ممنوع track ضل شغال)
  const scanCam = { on: false, stream: null, raf: 0, fieldId: "", det: null, ctx: null,
    detBusy: false, last: "", lastAt: 0, frames: 0, ticking: false };

  /* الخانة اللي الكاميرا بتخدمها: البيع والشراء (والجرد بيلحقهم في 145).
     `run` = نفس دالة المسح بالضبط — مافيش نسخة ثانية من المنطق. */
  function scanCamRoute(fieldId) {
    if (fieldId === "txtPosCode") return { hint: "#posScanHint", run: posHandleScan, focus: "#numPosQty" };
    if (fieldId === "txtPPCode") return { hint: "#ppScanHint", run: ppHandleScan, focus: "#numPPQty" };
    // 🧮 بناء 145: الجرد بالباركود — نفس اللوحة ونفس مسار المسح، والتركيز بعد القراءة على «عدد كل مسحة»
    if (fieldId === "txtScCode") return { hint: "#scScanHint", run: scHandleScan, focus: "#numScQty" };
    return null;
  }

  // «الكاميرا متاحة؟» = المتصفح نفسه يسمح (https أو 127.0.0.1) وفيه جهاز تصوير
  function camAvailable() {
    return !!(window.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  // «القارئ الجاهز موجود؟» = مقاس مش مفترض: ديسكتوب كروم/إدچ مالهمش، وموبايل كروم عنده
  function camNativeReader() {
    return (typeof window.BarcodeDetector === "function");
  }

  /* الكاميرا **للموبايل والتابلت بس** — بأمر المالك الحرفي (06/10):
     «كاميرا الموبايل هى المقصوده لكن الكمبيوتر و اللاب هيشتغل بجهاز مسدس الماسح الضوئى
     للباركود».
     التعريف بقى مقاس مش اسم: جهاز بلمس ومافيش مؤشر عائم (pointer: coarse + hover: none)،
     أو متصفح موبايل صريح ⇒ الكاميرا. ماوس/ديسكتوب ⇒ الزرار يجهّز الخانة للمسدس وبلا أي
     محاولة كاميرا خالص (ممنوع getUserMedia على اللاب). */
  function camIsHandheld() {
    const ua = (window.navigator && navigator.userAgent) || "";
    if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
    try {
      return !!(window.matchMedia && matchMedia("(pointer: coarse) and (hover: none)").matches);
    } catch (e) { return false; }
  }

  function camSay(html, kind) {
    const el = $("#camLast");
    if (!el) return;
    el.className = "cam-last" + (kind ? " " + kind : "");
    el.innerHTML = html;
  }
  function camState(txt) {
    const el = $("#camState");
    if (el) el.textContent = txt;
  }

  /* ── فتح الكاميرا ── */
  async function scanCamOpen(fieldId) {
    const route = scanCamRoute(fieldId);
    const panel = $("#scanCam");
    if (!route || !panel) return false;
    if (scanCam.on && scanCam.fieldId === fieldId) { scanCamClose(); return false; }
    if (scanCam.on) scanCamClose();
    panel.hidden = false;
    panel.className = "cam-panel";
    scanCam.on = true;      // اللوحة مفتوحة من دلوقتي — العدّاد يلحق لما الستريم يوصل
    scanCam.fieldId = fieldId;
    const v = $("#camVideo");
    if (!camAvailable()) {
      camState("مافيش كاميرا هنا");
      if (v) v.hidden = true;
      // ممنوع نص يقوله لموبايل «أنت على كمبيوتر» — السبب هنا إن المتصفح ما بيسمحش
      // بالكاميرا إلا على النسخة المنشورة (https)، فالمخرج الآمن واحد: المسدس أو الكتابة.
      camSay("الكاميرا محتاجة اتصال آمن عشان تشتغل — استعمل الماسح الضوئي أو اكتب الرقم، " +
        "والقائمة اللي تحت الخانة شغّالة زي ما هي.", "warn");
      const b = $("#camRetry");
      if (b) b.hidden = true;
      scanCam.on = true;   // اللوحة مفتوحة (رسالتها ودّية) بس مافيش العدّاد
      return true;
    }
    camState("بفتّح الكاميرا…");
    camSay("👀 وجه الكاميرا على الباركود — القراءة بتتم لوحدها.");
    try {
      scanCam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: CAM_W }, height: { ideal: CAM_H } },
        audio: false
      });
    } catch (e) {
      camState("الكاميرا مقفولة");
      if (v) v.hidden = true;
      // ممنوع أي اصطلاح تقني (NotAllowedError/Constraint...) — عربي يدلّ على الخطوة
      camSay("مقدرتش أفتح الكاميرا — لو المتصفح سأل عن إذن اختار «السماح»، " +
        "ولو الكمبيوتر مالوش كاميرا استعمل الماسح أو اكتب الرقم.", "warn");
      const b = $("#camRetry");
      if (b) b.hidden = false;
      scanCam.on = true;
      return true;
    }
    scanCam.on = true;
    scanCam.last = ""; scanCam.lastAt = 0; scanCam.frames = 0;
    camState("الكاميرا شغّالة");
    if (v) {
      v.hidden = false;
      v.srcObject = scanCam.stream;
      v.setAttribute("playsinline", "");
      try { await v.play(); } catch (e) { /* متصفح بيرحم التشغيل الذاتي — العدّاد شغال كمان */ }
    }
    // القارئ الجاهز (لو موجود) — والإضافة عليه اختيارية، مش شرط
    scanCam.det = camNativeReader() ? new window.BarcodeDetector({ formats: ["code_128", "ean_13"] }) : null;
    // ضوء الفلاش لو الجهاز بيدّيه (موبايل فيض)
    const tb = $("#camTorch");
    if (tb) {
      const trk = scanCam.stream.getVideoTracks()[0];
      const caps = trk && trk.getCapabilities ? trk.getCapabilities() : {};
      tb.hidden = !(caps && caps.torch);
    }
    const r = $("#camRetry");
    if (r) r.hidden = true;
    scanCamLoop();
    return true;
  }

  function scanCamClose() {
    if (scanCam.raf) cancelAnimationFrame(scanCam.raf);
    scanCam.raf = 0;
    scanCam.ticking = false;
    if (scanCam.stream) {
      scanCam.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });
    }
    scanCam.stream = null;
    const v = $("#camVideo");
    if (v) { try { v.pause(); } catch (e) {} v.srcObject = null; }
    scanCam.det = null;
    scanCam.detBusy = false;
    scanCam.on = false;
    scanCam.fieldId = "";
    scanCam.last = ""; scanCam.lastAt = 0;
    const panel = $("#scanCam");
    if (panel) { panel.hidden = true; panel.className = "cam-panel"; }
  }

  function scanCamToggle(fieldId) {
    if (scanCam.on) { scanCamClose(); return; }
    if (!camIsHandheld()) return;      // اللاب/الكمبيوتر = المسدس، وممنوع أي نداء كاميرا
    scanCamOpen(fieldId);
  }

  /* رسالة الزرار بتتقاس من الحالة نفسها — مش نص ثابت: الموبايل فيه كاميرا مفتوحة/مقفولة،
     والديسكتوب فيه المسدس. ممنوع أي اصطلاح تقني (getUserMedia/matchMedia/barcode). */
  function camArmHint(sel, fieldId) {
    if (!camIsHandheld()) {
      scanHint(sel, "info", "👉 الخانة جاهزة للماسح الضوئي — مرّيه على الباركود، أو اكتب الكود/الاسم بنفسك.");
      return;
    }
    const open = scanCam.on && scanCam.fieldId === fieldId;
    scanHint(sel, "info", open
      ? "📷 الكاميرا شغّالة فوق — وجّهها على الباركود والصنف يختار نفسه، والكمية من يدك."
      : "📷 الكاميرا اتقفلت — دوس «📷 مسح» تاني ترجع، والمسح بالمسدس شغال في الحالتين.");
  }

  /* ── العدّاد: لقطة ⇒ أسطر ⇒ فكّ ── */
  function scanCamLoop() {
    if (!scanCam.on) return;
    scanCam.raf = requestAnimationFrame(scanCamLoop);
    const v = $("#camVideo"), g = $("#camGrab");
    if (!scanCam.stream || !v || !g || v.hidden) return;      // لوحة بلا كاميرا = بلا عدّاد
    if (v.readyState < 2 || !v.videoWidth) return;
    if (g.width !== CAM_W) { g.width = CAM_W; g.height = CAM_H; }
    if (!scanCam.ctx) scanCam.ctx = g.getContext("2d", { willReadFrequently: true });
    const cx = scanCam.ctx;
    if (!cx) return;
    cx.drawImage(v, 0, 0, CAM_W, CAM_H);
    scanCam.frames++;
    // (أ) القارئ الجاهز — مرة كل لقطتين عشان الموبايل ما يسخنش
    if (scanCam.det && !scanCam.detBusy && scanCam.frames % 2 === 0) {
      scanCam.detBusy = true;
      scanCam.det.detect(v).then((list) => {
        scanCam.detBusy = false;
        if (list && list.length) scanCamGot(String(list[0].rawValue || ""));
      }).catch(() => { scanCam.detBusy = false; });
    }
    // (ب) فكّنا — دايمًا، حتى لو القارئ الجاهز موجود (ملصق ميزان على بعد شوية)
    let img = null;
    try { img = cx.getImageData(0, 0, CAM_W, CAM_H); } catch (e) { return; }
    for (let k = 0; k < CAM_ROWS; k++) {
      const y = Math.floor(CAM_H * (k + 1) / (CAM_ROWS + 1));
      const code = camDecodeRow(img, y);
      if (code) { scanCamGot(code); return; }
    }
  }

  /* الرقم وصل من أي مصدر ⇒ بوّابة التكرار، وبعدين **نفس** دالة المسح.
     لو الصنف اتعرّف فعلًا اللوحة تتقفل (البائع يكتب الكمية في هدوء)، ولو لأ تفضل
     مفتوحة وتقول الخطوة الجاية — مقاس بـ `findProductByScan` (قراءة فقط، ما بيضيفش حاجة). */
  function scanCamGot(raw) {
    const code = bcDigits(raw);
    if (!scanCam.on || !code) return false;
    const now = Date.now();
    if (code === scanCam.last && (now - scanCam.lastAt) < CAM_DEDUPE_MS) return false;
    scanCam.last = code; scanCam.lastAt = now;
    const route = scanCamRoute(scanCam.fieldId);
    if (!route) return false;
    const res = findProductByScan(code);
    route.run(code);
    if (res && res.prod) {
      camSay("✅ " + esc(res.prod.nameAr || res.prod.code) + " — اتعرّف، اكتب الكمية.", "ok");
      camState("اتقرأ");
      // اللوحة تقفل والكمية تتكتب من غير ما العميل يدور على زرار
      scanCamClose();
      const q = $(route.focus);
      if (q) { try { q.focus(); if (q.select) q.select(); } catch (e) {} }
      return true;
    }
    camSay("؟ ملقتش صنف بالرقم " + scanMsg(code) + " — قرّب الكاميرا أو امسح بإيدك.", "warn");
    return false;
  }

  // إضاءة نقطة (0..255) من ImageData — اللوما بدل RGB (الكاميرات بترجع YUV أصلًا)
  function camLum(img, x, y) {
    const i = (y * img.width + x) * 4;
    const d = img.data;
    return (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  /* أسطر السطر: أول خط غامق … آخر خط غامق ⇒ عدّفات متناوبة (العدّفات دي اللي بتتحول
     لوحدات). مرفوض أي سطر إضاءته واحدة (نور كفاية؟ مافيش باركود في السطر ده). */
  function camRowRuns(img, y) {
    const w = img.width;
    let mn = 255, mx = 0;
    for (let x = 0; x < w; x++) { const v = camLum(img, x, y); if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn < CAM_MIN_CONTRAST) return null;
    const th = (mn + mx) / 2;
    let a = 0;
    while (a < w && camLum(img, a, y) >= th) a++;
    if (a >= w) return null;
    let b = w - 1;
    while (b > a && camLum(img, b, y) >= th) b--;
    const runs = [];
    let dark = true, len = 0;
    for (let x = a; x <= b; x++) {
      const isDark = camLum(img, x, y) < th;
      if (isDark === dark) { len++; continue; }
      runs.push({ dark: dark, len: len });
      dark = isDark; len = 1;
    }
    runs.push({ dark: dark, len: len });
    if (runs.length < CAM_MIN_RUNS) return null;
    return { runs: runs, width: b - a + 1 };
  }

  // تحويل العدّفات لوحدات **بإصلاح الانحراف**: بنقارن الموضع التراكمي مش كل عدفة على حدة
  function camModules(runs, m) {
    if (!(m > 0.7)) return null;
    let acc = 0, done = 0, out = [];
    for (let i = 0; i < runs.length; i++) {
      acc += runs[i].len;
      const n = Math.round(acc / m) - Math.round(done / m);
      if (n < 1) return null;
      out.push(n); done = acc;
    }
    return out;
  }
  function camModsToBits(mods) {
    let bits = "";
    for (let i = 0; i < mods.length; i++) {
      for (let k = 0; k < mods[i]; k++) bits += (i % 2 === 0) ? "1" : "0";
      if (bits.length > CAM_MAX_BITS) return "";
    }
    return bits;
  }

  /* CODE-128: بداية A/B + رموز بيانات ١١ وحدة + رمز مراجعة + وقوف ١٣ وحدة.
     رقم المراجعة (mod 103) لازم يطابق ⇒ أي سلسلة ناقصة أو مقروبة غلط بترجع فاضية. */
  function camDecodeC128(bits) {
    if (bits.length < 57) return "";
    if (bits.slice(-13) !== BC128_BARS[BC128_STOP]) return "";
    const s = CAM_BC_REV[bits.slice(0, 11)];
    if (s !== 103 && s !== 104) return "";
    const body = bits.slice(11, bits.length - 13);
    if (!body.length || body.length % 11 !== 0) return "";
    const vals = [];
    for (let i = 0; i < body.length; i += 11) {
      const v = CAM_BC_REV[body.slice(i, i + 11)];
      if (v === undefined || v > 102) return "";    // 103..105 رموز بداية/تحويل — ممنوع في الجسم
      vals.push(v);
    }
    if (vals.length < 2) return "";
    const check = vals.pop();
    let sum = s;
    for (let i = 0; i < vals.length; i++) sum += vals[i] * (i + 1);
    if (sum % BC128_MODULO !== check) return "";
    let text = "";
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] > 95) return "";                   // خارج الحروف المطبوعة
      text += String.fromCharCode(vals[i] + BC128_MIN_CH);
    }
    if (!/^[0-9A-Za-z\-]{3,}$/.test(text)) return "";
    return text;
  }

  /* EAN-13: ٩٥ وحدة بالظبط — وحده = عرض الخطوط ÷ ٩٥ (ده اللي بيخلي القياس مستقر).
     أول خانة بتيجي من نقشة L/G النصف الشمال، ورقم التحقق GS1 بوّابة أخيرة. */
  function camDecodeEan13(bits) {
    if (bits.length !== 95) return "";
    if (bits.slice(0, 3) !== "101") return "";
    if (bits.slice(45, 50) !== "01010") return "";
    if (bits.slice(90, 95) !== "101") return "";
    const left = bits.slice(3, 45), right = bits.slice(50, 90);
    let pat = "", out = "";
    for (let i = 0; i < 6; i++) {
      const ch = left.slice(i * 7, i * 7 + 7);
      const li = CAM_EAN_L.indexOf(ch), gi = CAM_EAN_G.indexOf(ch);
      if (li >= 0 && gi >= 0) return "";             // غامضة ⇒ مرفوضة (ممنوع التخمين)
      if (gi >= 0) { pat += "G"; out += String(gi); }
      else if (li >= 0) { pat += "L"; out += String(li); }
      else return "";
    }
    const first = CAM_EAN_PARITY.indexOf(pat);
    if (first < 0) return "";
    out = String(first) + out;
    for (let i = 0; i < 6; i++) {
      const ri = CAM_EAN_R.indexOf(right.slice(i * 7, i * 7 + 7));
      if (ri < 0) return "";
      out += String(ri);
    }
    if (gs1CheckDigit(out.slice(0, 12)) !== out.charAt(12)) return "";
    return out;
  }

  // السطر كامل: عدّفات ⇒ مرشّحات عرض الوحدة ⇒ CODE-128 أو EAN-13
  function camDecodeRow(img, y) {
    const r = camRowRuns(img, y);
    if (!r) return "";
    let mn = 999;
    for (let i = 0; i < r.runs.length; i++) if (r.runs[i].len < mn) mn = r.runs[i].len;
    const cands = [r.width / 95, r.width / 95 * 1.02, r.width / 95 * 0.98,
      mn, mn * 1.06, mn * 0.94, mn * 1.12];
    for (let i = 0; i < cands.length; i++) {
      const mods = camModules(r.runs, cands[i]);
      if (!mods) continue;
      const bits = camModsToBits(mods);
      if (!bits) continue;
      const c = camDecodeC128(bits);
      if (c) return c;
      const e = camDecodeEan13(bits);
      if (e) return e;
    }
    return "";
  }

  // الفلاش (لو الجهاز بيدّيه) — أي رفض يتبلع بلا رسالة تقنية
  function scanCamTorch() {
    const tb = $("#camTorch");
    if (!scanCam.stream || !tb) return;
    const trk = scanCam.stream.getVideoTracks()[0];
    if (!trk || !trk.applyConstraints) return;
    const on = tb.getAttribute("data-on") !== "1";
    trk.applyConstraints({ advanced: [{ torch: on }] }).then(() => {
      tb.setAttribute("data-on", on ? "1" : "0");
      tb.textContent = on ? "🔦 نور شغال" : "🔦 نور";
    }).catch(() => { tb.hidden = true; });
  }

  function scanCamRetry() {
    const f = scanCam.fieldId;
    scanCamClose();
    if (f) scanCamOpen(f);
  }

  /* التوليد الجماعي: اللي ملوش باركود بس ⇒ ياخد رقم ميزان.
     الموجود ما بيتلمسش، والمكرّر بيتسجّل في `skipped` عشان يظهر في الرسالة. */
  function generateMissingBarcodes() {
    const made = [], skipped = [];
    const used = new Set();
    products.forEach((p) => { const b = bcDigits(p.barcode); if (b) used.add(b); });
    products.forEach((p) => {
      if (bcDigits(p.barcode) !== "") return;
      const cand = internalBarcode(p.id);
      if (!cand) { skipped.push(p); return; }
      if (used.has(cand)) { skipped.push(p); return; }
      p.barcode = cand;
      used.add(cand);
      made.push(p);
    });
    return { made: made, skipped: skipped };
  }

  function doGenerateBarcodes() {
    const r = generateMissingBarcodes();
    if (!r.made.length) {
      toast(r.skipped.length
        ? ("مافيش صنف اتغيّر — " + r.skipped.length + " صنف محتاج رقم باركود مختلف (اكتبه من تعديل الصنف).")
        : "كل الأصناف عندها باركود فعلًا — مافيش حاجة اتغيّرت.", r.skipped.length ? "warning" : "info");
      return;
    }
    saveProducts();
    renderProducts();
    addActivity("باركود", "توليد رقم باركود لـ " + r.made.length + " صنف (أي باركود موجود ما اتلمسش)");
    toast("تم توليد باركود لـ " + r.made.length + " صنف." +
      (r.skipped.length ? " و" + r.skipped.length + " صنف محتاج رقم مختلف — اكتبه من «تعديل الصنف»." : ""),
      r.skipped.length ? "warning" : "success");
  }

  // معاينة الباركود جوه نافذة الصنف (حيّ مع الكتابة)
  function renderBarcodePreview() {
    const box = $("#bcPreviewBox");
    if (!box) return;
    const code = bcDigits($("#fPBarcode").value);
    if (!code) {
      box.innerHTML = '<span class="bc-preview-empty">لما تكتب رقم أو تضغط «توليد»، الباركود بيظهر هنا.</span>';
      return;
    }
    const svg = barcodeSvg(code, { mw: 0.2, h: 8 });
    box.innerHTML = svg
      ? svg + '<span class="bc-hrt">' + esc(code) + '</span>'
      : '<span class="bc-none">الرقم ده ما بيتحوّرش لباركود — يستخدم أرقام أو حروف إنجليزي بس.</span>';
  }

  /* زرار «🔳 توليد» جوه النافذة: بيملّى الخانة الفاضية بس.
     لو فيه رقم مكتوب ⇒ ما يتغيّرش (احترام باركود المصنع) والرسالة بتقول تمسحه لو عايز. */
  function generateBarcodeInDialog() {
    const cur = bcDigits($("#fPBarcode").value);
    if (cur) {
      toast("الخانة فيها رقم باركود فعلًا — «ميزان» ما يغيّرش على رقم مكتوب. امسحها لو عايز رقم ميزان.", "info");
      return;
    }
    const id = editingProductId == null ? nextProductId() : editingProductId;
    const cand = internalBarcode(id);
    if (!cand) {
      toast("مقدرش أعمل رقم باركود دلوقتي — اكتب رقمًا بدل كده.", "warning");
      return;
    }
    const clash = barcodeConflictOf(cand, editingProductId);
    if (clash) {
      toast("الرقم ده بقى مستخدم في صنف تاني: " + (clash.nameAr || clash.code) + " — اكتب رقم مختلف.", "warning");
      return;
    }
    $("#fPBarcode").value = cand;
    renderBarcodePreview();
    toast("ده رقم باركود «ميزان» للصنف — بيتحفظ مع حفظ الصنف.", "success");
  }

  /* ══════════════════════════════════════════════════════════════════════════
     بناء 143 — مسح باركود المصنع **بالإسكانر** وقت إدخال الصنف في المخزن
     (طلب المالك بحرفه 05/10: «محتاج عند ادخال الاصناف فى المخزن انه يدينى امكانية
     مسح ضوئى لباركود المصنع»).
     الخانة `#fPBarcode` بترقب الإسكانر زي ما بترقب الصابع: بيكتب الرقم ودوس Enter ⇒
     بننضّف الرقم، نوريه في المعاينة، ونقول للمستخدم الخطوة الجاية. **ممنوع** إن Enter
     يقفل النافذة أو يحفظ قبل ما المالك يكتب الاسم والسعر — فبنعمل preventDefault.
     الفحص اللي بيمنع المكرر ويمنع غير القابل للتشفير لسه في `saveProduct` (مسار واحد).
     ══════════════════════════════════════════════════════════════════════════ */
  function bcScanHint(kind, html) { scanHint("#bcScanHint", kind, html); }

  function barcodeFieldScan() {
    const code = scanClean($("#fPBarcode").value);
    $("#fPBarcode").value = code;
    renderBarcodePreview();
    if (!code) {
      scanBeep("no");
      bcScanHint("warn", "📷 مافيش رقم وصل في الخانة — قلّب الإسكانر على الباركود، أو اكتب الرقم بنفسك.");
      return false;
    }
    if (bc128Bits(code) === "") {
      scanBeep("no");
      bcScanHint("warn", "⚠️ الرقم " + scanMsg(code) + " ما بيتقراش كود — يستخدم أرقام أو حروف إنجليزي بس.");
      return false;
    }
    const clash = barcodeConflictOf(code, editingProductId);
    if (clash) {
      scanBeep("no");
      bcScanHint("warn", "⚠️ الرقم " + scanMsg(code) + " مسجّل قبل كده لصنف تاني: " +
        esc(clash.nameAr || clash.code) + " — غيّير رقم واحد فيهم قبل الحفظ.");
      return false;
    }
    // رقم مصنع فيه 13 خانة ورقم التحقق بتاعه غلط ⇒ ممكن الإسكانر قرا نص رقم. تنبيه مش رفض.
    const warn = /^[0-9]{13}$/.test(code) && gs1CheckDigit(code.slice(0, 12)) !== code.charAt(12)
      ? "<span class='scan-sub'>رقم التحقق مش مطابق — لو تقدر امسّح تاني أحسن (الحفظ لسه بيقبله).</span>" : "";
    // «صنف جديد» (طلب 05/10): الرقم مالوش صاح في الدليل ⇒ زنة مختلفة عن المسح المعتاد
    scanBeep(products.some((p) => Number(p.id) === Number(editingProductId)) ? "ok" : "new");
    bcScanHint("ok", "📷 اتقرا الرقم " + scanMsg(code) + " — اكتب اسم الصنف وسعّره ودوس «حفظ الصنف»." + warn);
    return true;
  }

  // زرار «📷 مسح» = يجهّز الخانة (فوكس + تحديد) عشان الإسكانر يكتب فيها على طول
  function barcodeFieldArm() {
    const el = $("#fPBarcode");
    if (!el) return;
    el.focus();
    el.select();
    bcScanHint("info", "👉 الخانة جاهزة — مرّر الإسكانر على الباركود، أو اكتب الرقم بنفسك.");
  }

  /* ══ طباعة ملصقات الباركود ══ */
  let bcPrintProduct = null;

  // مقاس الخط على الورق: A4 عادي، A5 أضيق، والحراري ضيق جدًا
  function bcLabelScale() {
    const z = printPaperSize();
    return z === "thermal" ? { mw: 0.2, h: 8 } : z === "a5" ? { mw: 0.22, h: 9 } : { mw: 0.26, h: 10 };
  }

  function bcLabelNode(p, code, org) {
    const d = document.createElement("div");
    d.className = "bc-label";
    d.innerHTML =
      '<div class="bc-org">' + esc(org) + '</div>' +
      '<div class="bc-name">' + esc(p.nameAr || p.code || "") + '</div>' +
      '<div class="bc-meta">' + esc(String(p.code || "")) + " · " + esc(String(p.unit || "")) + " · " + esc(fmt(Number(p.salePrice) || 0)) + '</div>' +
      '<div class="bc-bars">' + barcodeSvg(code, bcLabelScale()) + '</div>' +
      '<div class="bc-hrt">' + esc(code) + '</div>';
    return d;
  }

  /* زرار 🏷️ قدام كل صنف: لو ملوش باركود بيتولّدله واحد (الفراغ بس) وبعدها
     تفتح نافذة الطباعة بعدد الملصقات. */
  function openBarcodePrint(p) {
    if (!p) return;
    if (!productHasBarcode(p)) {
      const cand = internalBarcode(p.id);
      if (!cand || barcodeConflictOf(cand, p.id)) {
        toast("الصنف ده ملوش باركود سليم — اكتب له رقم في «تعديل الصنف» الأول.", "warning");
        openProductDialog(p);
        return;
      }
      p.barcode = cand;
      saveProducts();
      renderProducts();
      addActivity("باركود", "توليد رقم باركود للطباعة للصنف: " + (p.nameAr || p.code) + " (" + p.code + ")");
    }
    const code = bcDigits(p.barcode);
    const svg = barcodeSvg(code, { mw: 0.2, h: 8 });
    bcPrintProduct = p;
    $("#bcPrintName").textContent = p.nameAr || p.code || "";
    $("#bcPrintMeta").textContent = "الكود " + (p.code || "—") + " · " + (p.unit || "—") + " · " + fmt(Number(p.salePrice) || 0);
    $("#bcPrintValue").textContent = code;
    $("#bcPrintPreview").innerHTML = svg
      ? svg + '<span class="bc-hrt">' + esc(code) + '</span>'
      : '<span class="bc-none">الرقم ده ما بيتحوّرش لباركود — يستخدم أرقام أو حروف إنجليزي بس.</span>';
    $("#bcQty").value = "1";
    showModal("mBarcodePrint");
    $("#bcQty").select();
  }

  function printBarcodeLabels() {
    const p = bcPrintProduct;
    if (!p) { toast("اقفل النافذة وافتح الطباعة من زرار «🏷️ طباعة» قدام الصنف.", "warning"); return; }
    const code = bcDigits(p.barcode);
    if (!bc128Bits(code)) {
      toast("الرقم «" + (code || "فاضي") + "» ما بيتحوّرش لباركود — يستخدم أرقام أو حروف إنجليزي بس.", "warning");
      return;
    }
    // bcDigits بتحوّل الأرقام العربية/الفارسية لإنجليزي وتشيل علامات الاتجاه
    // (نفس تسامح خانات المبالغ في بناء 118 ⇒ «٣» تطلع 3 ملصقات مش رسالة غلط).
    const n = parseInt(bcDigits($("#bcQty").value).replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(n) || n < 1) { toast("اكتب عدد الملصقات: 1 أو أكتر.", "warning"); return; }
    if (n > BC_LABELS_MAX) { toast("أقصى عدد في الطباعة الواحدة " + BC_LABELS_MAX + " ملصق — كمّل الباقي في طباعة تانية.", "warning"); return; }
    const d = new Date(), z = (x) => String(x).padStart(2, "0");
    $("#bcpItemName").textContent = p.nameAr || p.code || "";
    $("#bcpMeta").textContent = "الكود " + (p.code || "—") + " · " + (p.unit || "—") + " · " + fmt(Number(p.salePrice) || 0) +
      " · عدد الملصقات: " + n;
    $("#bcpDate").textContent = z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() + " " + z(d.getHours()) + ":" + z(d.getMinutes());
    const box = $("#bcpLabels");
    box.innerHTML = "";
    const org = invOrgName();
    for (let i = 0; i < n; i++) box.appendChild(bcLabelNode(p, code, org));
    $("#bcpFoot").innerHTML = "الباركود ده بتاع «" + esc(org) + "» للاستخدام الداخلي، وبيقرأ بأي إسكانر.";
    hideModal("mBarcodePrint");
    renderProducts();
    printSection($("#barcodePage"));
  }

  /* ================== شاشة الأصناف والمخزون ================== */
  let editingProductId = null;

  function nextProductId() {
    return products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }

  function nextProductCode() {
    const used = new Set();
    products.forEach((p) => {
      const m = /(\d+)\s*$/.exec((p.code || "").trim());
      if (m) used.add(parseInt(m[1], 10));
    });
    let n = 1;
    while (used.has(n)) n++;
    return String(n);
  }

  function settListByName(key) {
    const out = [];
    [csetData, ssetData].forEach((src) => {
      if (src && Array.isArray(src[key])) {
        src[key].forEach((it) => {
          const n = (it && (typeof it === "string" ? it : (it.name || it.symbol))) || it;
          if (n && out.indexOf(n) === -1) out.push(n);
        });
      }
    });
    return out;
  }

  function categoryList() {
    const l = settListByName("categories");
    return l.length ? l : CATEGORIES.slice();
  }

  function warehouseList() {
    const l = settListByName("warehouses");
    return l.length ? l : WAREHOUSES.slice();
  }

  function orgSettValue(field, fallback) {
    const src = (csetData && csetData.org) || (ssetData && ssetData.org);
    const v = src && src[field];
    return (v !== undefined && v !== null && v !== "") ? v : fallback;
  }

  function ensureSettData() {
    if (csetData || !(A.online && DATA && DATA.clientSett)) {
      if (csetData) syncTreasuryFromSett();
      return Promise.resolve(csetData);
    }
    return DATA.clientSett().then((p) => {
      if (p) {
        csetData = p;
        csetData.__online = true;
        if (p.org) {
          // بيانات المنشأة (بما فيها «انشر على الفاتورة») تتخزن محليًا كمرآة سريعة للمطبوعات
          try { mirrorOrgToSettings(p.org); } catch (e) {
            if (p.org.name) settings.orgName = p.org.name;
          }
        }
      }
      applyTaxSettingsFromSett(p);
      syncTreasuryFromSett();
      return csetData;
    }).catch(() => csetData);
  }

  function applyTaxSettingsFromSett(p) {
    if (p && p.org && p.org.tax_enabled !== undefined && p.org.tax_enabled !== null) {
      applyTaxSettings(p.org.tax_enabled === true || p.org.tax_enabled === 1 || p.org.tax_enabled === "1", p.org.tax_rate);
    }
  }

  function fillCatSelect(sel, current) {
    const apply = (catsArr) => {
      const l = [];
      (catsArr || []).forEach((c) => {
        const n = (c && (typeof c === "string" ? c : c.name)) || c;
        if (n && l.indexOf(n) === -1) l.push(n);
      });
      if (current && l.indexOf(current) === -1) l.push(current);
      fillSelect(sel, l.length ? l : CATEGORIES.slice(), current && l.indexOf(current) !== -1 ? current : undefined);
    };
    apply((csetData && csetData.categories) || (ssetData && ssetData.categories));
    if (A.online && DATA && DATA.clientSett && !csetData) {
      DATA.clientSett().then((p) => {
        if (p && p.categories) { csetData = p; apply(p.categories); }
      }).catch(() => {});
    }
  }

  function fillWhSelect(sel, current) {
    const apply = (whsArr) => {
      const l = [];
      (whsArr || []).forEach((w) => {
        const n = (w && (typeof w === "string" ? w : w.name)) || w;
        if (n && l.indexOf(n) === -1) l.push(n);
      });
      if (current && l.indexOf(current) === -1) l.push(current);
      fillSelect(sel, l.length ? l : WAREHOUSES.slice(), current && l.indexOf(current) !== -1 ? current : undefined);
    };
    apply((csetData && csetData.warehouses) || (ssetData && ssetData.warehouses));
    if (A.online && DATA && DATA.clientSett && !csetData) {
      DATA.clientSett().then((p) => {
        if (p && p.warehouses) { csetData = p; apply(p.warehouses); }
      }).catch(() => {});
    }
  }

  function productCategories() {
    const set = new Set(categoryList());
    set.add("");
    products.map((p) => p.category).filter(Boolean).forEach((c) => set.add(c));
    set.delete("");
    return [...set];
  }

  function fillSelect(sel, items, selected) {
    const el = $(sel);
    el.innerHTML = "";
    items.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
    if (selected != null) el.value = selected;
  }

  function productUnits() {
    const list = [];
    // 🆕 145: الأربع الوحدات الأساسية دايمًا موجودين (شركة جديدة = جاهزة، وممنوع القائمة تفضل فاضية)
    DEFAULT_UNITS.forEach((d) => { if (list.indexOf(d) === -1) list.push(d); });
    [csetData, ssetData].forEach((src) => {
      if (src && Array.isArray(src.units)) {
        src.units.forEach((u) => {
          const n = (u && (typeof u === "string" ? u : (u.name || u.symbol))) || u;
          if (n && list.indexOf(n) === -1) list.push(n);
        });
      }
    });
    return list;
  }

  function fillUnitSelect(sel, current) {
    const apply = (unitsArr) => {
      const list = [];
      /* 🆕 145: الوحدات المحمية الأربعة بتتنزّل أول حاجة في القائمة ⇒ خانة «الوحدة» في
         الصنف والفاتورة ما تبqاش فاضية في شركة جديدة (كانت بتعتمد على اللي محفوظ فقط). */
      withProtectedUnits(unitsArr).forEach((u) => {
        const n = (u && (typeof u === "string" ? u : (u.name || u.symbol))) || u;
        if (n && list.indexOf(n) === -1) list.push(n);
      });
      if (current && list.indexOf(current) === -1) list.push(current);
      fillSelect(sel, list, current != null && list.indexOf(current) !== -1 ? current : (list[0] || ""));
    };
    apply((csetData && csetData.units) || (ssetData && ssetData.units));
    if (A.online && DATA && DATA.clientSett && !csetData) {
      DATA.clientSett().then((p) => {
        if (p && p.units) { csetData = p; apply(p.units); }
      }).catch(() => {});
    }
  }

  // 🆕 إصلاح «خانة الوحدة فاضية في الفاتورة»: الوحدة بتتحل بالترتيب —
  // سطر الفاتورة نفسه ← الصنف بالكود/الآيدي/الاسم. (السبب الجذري: طبقة السحابة
  // كانت بترجّع products بدون عمود وحدة، فكل صنف بيصبح unit:"" وكل فاتورة جديدة بتطبع فاضي.)
  function lineUnit(it) {
    const direct = String((it && it.unit) || "").trim();
    if (direct) return direct;
    let p = null;
    if (it && it.productId !== undefined && it.productId !== null && it.productId !== "") {
      p = products.filter((x) => String(x.id) === String(it.productId))[0] || null;
    }
    if (!p && it && it.code) p = products.filter((x) => String(x.code) === String(it.code))[0] || null;
    if (!p && it && it.nameAr) p = products.filter((x) => String((x.nameAr || "").trim()) === String(it.nameAr).trim())[0] || null;
    return (p && p.unit) ? String(p.unit).trim() : "";
  }
  // على الورقة والشاشة: الخانة ما تفضلش بيضا — لو مفيش وحدة مسجلة خالص تظهر «—»
  function lineUnitText(it) { return lineUnit(it) || "—"; }

  function discountStatusText(p) {
    const pct = Number(p.discountPercent) || 0;
    if (pct <= 0) return "بدون خصم";
    if (p.discountStart && p.discountEnd) {
      const now = new Date();
      const s = new Date(p.discountStart + "T00:00:00");
      const e = new Date(p.discountEnd + "T00:00:00");
      if (now >= s && now <= e) return pct + " % (نشط)";
      return pct + " %";
    }
    return pct + " %";
  }

  function renderProducts() {
    fillSelect("#cmbProductCategory", ["الكل"].concat(productCategories()), $("#cmbProductCategory").value || "الكل");

    const q = normalizeAr($("#txtProductSearch").value);
    const cat = $("#cmbProductCategory").value;
    const tbody = $("#dgvProducts tbody");
    tbody.innerHTML = "";

    const filtered = products.filter((p) => {
      if (cat !== "الكل" && p.category !== cat) return false;
      if (!q) return true;
      return (
        normalizeAr(p.code).includes(q) ||
        normalizeAr(p.barcode || "").includes(q) ||
        normalizeAr(p.nameAr).includes(q) ||
        normalizeAr(p.nameEn || "").includes(q) ||
        normalizeAr(p.category).includes(q) ||
        normalizeAr(p.unit).includes(q) ||
        normalizeAr(p.defaultWarehouse).includes(q) ||
        Number(p.purchasePrice || 0).toString().includes(q) ||
        Number(p.weightedAvgCost || 0).toString().includes(q) ||
        Number(p.salePrice || 0).toString().includes(q) ||
        (p.isActive ? "نشط" : "معطل").includes(q)
      );
    });

    filtered.forEach((p) => {
      const tr = document.createElement("tr");
      const disc = discountStatusText(p);
      const discBadge = p.discountPercent > 0
        ? '<span class="badge badge-discount">' + esc(disc) + '</span>'
        : '<span class="badge badge-none">' + esc(disc) + '</span>';
      const stBadge = p.isActive
        ? '<span class="badge badge-active">نشط 🟢</span>'
        : '<span class="badge badge-inactive">معطل 🔴</span>';
      const stockDetail = WAREHOUSES.map((w) => Number(stockAt(p, w)).toLocaleString("en-US") + "@" + w).join("   ");
      tr.innerHTML =
        '<td>' + esc(p.code) + '</td>' +
        '<td class="cell-barcode">' + (bcDigits(p.barcode)
          ? '<span class="bc-num">' + esc(bcDigits(p.barcode)) + '</span>'
          : '<span class="bc-missing">— بلا باركود</span>') + '</td>' +
        '<td>' + esc(p.nameAr) + '<div class="stk-mini">' + esc(stockDetail) + '</div></td>' +
        '<td>' + esc(p.category) + '</td>' +
        '<td>' + esc(p.unit) + '</td>' +
        '<td>' + esc(Number(p.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(p.purchasePrice) + '</td>' +
        '<td>' + fmt(p.weightedAvgCost) + '</td>' +
        '<td>' + fmt(p.salePrice) + '</td>' +
        '<td>' + discBadge + '</td>' +
        '<td>' + stBadge + '</td>' +
        '<td class="cell-actions"><button class="btn small blue" type="button" data-action="edit">✏️ تعديل</button>' +
        ' <button class="btn small red" type="button" data-action="del">🗑️ حذف</button>' +
        ' <button class="btn small teal" type="button" data-action="bc" title="طباعة ملصق الباركود">🏷️ طباعة</button></td>';
      tr.dataset.id = p.id;
      tr.querySelector('[data-action="edit"]').addEventListener("click", () => openProductDialog(p));
      tr.querySelector('[data-action="del"]').addEventListener("click", () => deleteProduct(p));
      tr.querySelector('[data-action="bc"]').addEventListener("click", () => openBarcodePrint(p));
      tr.addEventListener("dblclick", () => openProductDialog(p));
      tbody.appendChild(tr);
    });
  }

  /* ---- حذف صنف: مسموح فقط إذا كان رصيده صفر في كل المستودعات ---- */
  function deleteProduct(p) {
    if (!p) return;
    let total = 0;
    if (p.stock && typeof p.stock === "object") {
      Object.keys(p.stock).forEach((k) => { total += Number(p.stock[k]) || 0; });
    } else {
      total = Number(p.qty) || 0;
    }
    total = Math.round(total * 100) / 100;
    if (total !== 0) {
      toast("لا يمكن حذف صنف له رصيد بالمخزن", "warning");
      return;
    }
    const ok = confirm('هل تريد حذف الصنف "' + (p.nameAr || p.code) + '" نهائيًا؟\nالرصيد صفر والحذف لا يمكن التراجع عنه.');
    if (!ok) return;
    products = products.filter((x) => x.id !== p.id);
    saveProducts();
    renderProducts();
    addActivity("حذف صنف", "تم حذف الصنف: " + (p.nameAr || p.code) + " (الكود " + p.code + ")");
    toast("تم حذف الصنف بنجاح", "success");
  }

  /* ---- نافذة إضافة / تعديل صنف ---- */
  function openProductDialog(product) {
    editingProductId = product ? product.id : null;
    fillCatSelect("#fPCategory", product ? product.category : null);
    fillUnitSelect("#fPUnit", product ? product.unit : null);
    fillWhSelect("#fPWarehouse", product ? product.defaultWarehouse : null);

    if (product) {
      $("#productModalTitle").textContent = "✏️ تعديل صنف (" + product.nameAr + ")";
      $("#btnSaveProduct").textContent = "💾 حفظ التعديلات";
      $("#fPCode").value = product.code;
      $("#fPCode").disabled = true;
      $("#fPBarcode").value = product.barcode || "";
      $("#fPNameAr").value = product.nameAr;
      $("#fPNameEn").value = product.nameEn || "";
      $("#fPPurchase").value = moneyStr(product.purchasePrice);
      $("#fPSale").value = moneyStr(product.salePrice);
      $("#fPStock").value = Number(product.qty).toLocaleString("en-US");
      $("#fPStock").disabled = true;
      $("#fPDiscount").value = moneyStr(product.discountPercent || 0);
      $("#fPDiscStart").value = product.discountStart || "";
      $("#fPDiscEnd").value = product.discountEnd || "";
      $("#fPStatus").value = product.isActive ? "1" : "0";
    } else {
      $("#productModalTitle").textContent = "➕ إضافة صنف جديد للمخزن";
      $("#btnSaveProduct").textContent = "💾 حفظ الصنف";
      $("#fPCode").value = nextProductCode();
      $("#fPCode").disabled = true;
      $("#fPBarcode").value = "";
      $("#fPNameAr").value = "";
      $("#fPNameEn").value = "";
      $("#fPPurchase").value = "0";
      $("#fPSale").value = "0";
      $("#fPStock").value = "0";
      $("#fPStock").disabled = false;
      $("#fPDiscount").value = "0";
      $("#fPDiscStart").value = "";
      $("#fPDiscEnd").value = "";
      $("#fPStatus").value = "1";
    }
    showModal("mProduct");
    renderBarcodePreview();   // 🔳 بناء 139: معاينة الباركود أول ما النافذة تفتح
    scanHint("#bcScanHint");  // 📷 بناء 143: رسالة مسح قديمة من صنف تاني ما تفضلش معروضة
    $("#fPNameAr").focus();
  }

  function saveProduct() {
    const nameAr = $("#fPNameAr").value.trim();
    if (!nameAr) {
      toast("يرجى كتابة اسم الصنف بالعربية.", "warning");
      return;
    }
    const category = $("#fPCategory").value;
    const unit = $("#fPUnit").value;
    if (!category) {
      toast("يرجى اختيار تصنيف الصنف (التصنيف إجباري).", "warning");
      return;
    }
    if (!unit) {
      toast("يرجى اختيار وحدة قياس للصنف (إجبارية).", "warning");
      return;
    }

    const dStart = $("#fPDiscStart").value;
    const dEnd = $("#fPDiscEnd").value;
    if (dStart && dEnd && dStart > dEnd) {
      toast("تاريخ نهاية فترة الخصم لا يمكن أن يكون سابقاً لتاريخ البداية.", "warning");
      return;
    }

    const purchase = moneyVal("#fPPurchase") || 0;
    const sale = moneyVal("#fPSale") || 0;
    const opening = parseFloat(String($("#fPStock").value).replace(/,/g, "")) || 0;
    const discount = moneyVal("#fPDiscount") || 0;
    const status = $("#fPStatus").value === "1";

    /* 🔳 بناء 139: رقم الباركود بيتنضّف (أرقام عربية → إنجليزي، بلا مسافات) و**ممنوع
       يتكرر جوه نفس الشركة** — لو صنف تاني شايل نفس الرقم الحفظ يقف برسالة باسمه،
       لأن الإسكانر ما يفرّقش بين صنفين بنفس الرقم. الفحص على **اللي بيتغيّر بس**:
       بيانات قديمة غريبة ما تمنعش حد إنه يعدّل اسم صنفه (قاعدة «متحذفش بيانات موجودة»). */
    const prevProduct = editingProductId == null ? null : products.find((p) => p.id === editingProductId);
    const prevBarcode = prevProduct ? bcDigits(prevProduct.barcode) : "";
    const typedBarcode = bcDigits($("#fPBarcode").value);
    if (typedBarcode && typedBarcode !== prevBarcode) {
      const clash = barcodeConflictOf(typedBarcode, editingProductId);
      if (clash) {
        toast("الباركود ده مستخدم في صنف تاني: " + (clash.nameAr || clash.code) + " — غيّير رقم واحد فيهم.", "warning");
        return;
      }
      if (bc128Bits(typedBarcode) === "") {
        toast("الباركود ده ما بيتحوّرش لباركود — يستخدم أرقام أو حروف إنجليزي بس.", "warning");
        return;
      }
    }

    if (editingProductId == null) {
      const pr = {
        id: nextProductId(),
        code: nextProductCode(),
        barcode: typedBarcode,
        nameAr: nameAr,
        nameEn: $("#fPNameEn").value.trim(),
        category: category,
        unit: unit,
        defaultWarehouse: $("#fPWarehouse").value || WAREHOUSES[0],
        purchasePrice: purchase,
        weightedAvgCost: purchase,
        salePrice: sale,
        discountPercent: discount,
        discountStart: dStart,
        discountEnd: dEnd,
        stock: { [($("#fPWarehouse").value || WAREHOUSES[0])]: opening },
        qty: opening,
        reorder: 50,
        isActive: status
      };
      // 🔳 بناء 139: الصنف الجديد بياخد رقم باركود «ميزان» من أول ثانية (الخانة الفاضية بس)
      if (!pr.barcode) pr.barcode = internalBarcode(pr.id);
      products.push(pr);
      saveProducts();
      addActivity("إضافة صنف", "إضافة صنف جديد: " + pr.nameAr + " (" + pr.code + ")");
      toast("تمت إضافة الصنف بنجاح.", "success");
    } else {
      const pr = products.find((p) => p.id === editingProductId);
      pr.barcode = typedBarcode;
      pr.nameAr = nameAr;
      pr.nameEn = $("#fPNameEn").value.trim();
      pr.category = category;
      pr.unit = unit;
      pr.defaultWarehouse = $("#fPWarehouse").value || pr.defaultWarehouse;
      pr.purchasePrice = purchase;
      pr.salePrice = sale;
      pr.discountPercent = discount;
      pr.discountStart = dStart;
      pr.discountEnd = dEnd;
      pr.isActive = status;
      saveProducts();
      addActivity("تعديل صنف", "تعديل بيانات الصنف: " + pr.nameAr + " (" + pr.code + ")");
      toast("تم حفظ تعديلات الصنف بنجاح.", "success");
    }
    hideModal("mProduct");
    renderProducts();
  }

  /* ---- جرد المخزون لكل مستودع ---- */
  function openStockTake() {
    fillWhSelect("#stkWarehouse", null);
    renderStockTake();
    showModal("mStockTake");
  }

  function renderStockTake() {
    const wh = $("#stkWarehouse").value;
    const tbody = $("#dgvStockTake tbody");
    tbody.innerHTML = "";
    const lines = products.filter((p) => p.defaultWarehouse === wh || stockAt(p, wh) > 0);
    lines.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(p.code) + '</td>' +
        '<td>' + esc(p.nameAr) + '</td>' +
        '<td>' + esc(Number(stockAt(p, wh)).toLocaleString("en-US")) + '</td>' +
        '<td><input class="stk-qty-input" type="text" data-id="' + p.id + '" autocomplete="off" /></td>' +
        '<td class="stk-diff diff-zero">-</td>';
      tbody.appendChild(tr);
    });
    $("#stkSummary").textContent = "إجمالي عدد الأصناف: " + lines.length.toLocaleString("en-US");
  }

  function computeStockDiff(inputEl) {
    const tr = inputEl.closest("tr");
    const sysCell = tr.cells[2];
    const diffCell = tr.cells[4];
    const sys = parseFloat(String(sysCell.textContent).replace(/,/g, "")) || 0;
    const act = parseFloat(inputEl.value.replace(/,/g, ""));
    if (isNaN(act)) {
      diffCell.textContent = "-";
      diffCell.className = "stk-diff diff-zero";
      return;
    }
    const diff = Math.round((act - sys) * 100) / 100;
    diffCell.textContent = Number(diff).toLocaleString("en-US");
    diffCell.className = "stk-diff " + (diff > 0 ? "diff-pos" : diff < 0 ? "diff-neg" : "diff-zero");
  }

  function saveStockTake() {
    const wh = $("#stkWarehouse").value;
    const rows = $("#dgvStockTake tbody").querySelectorAll("tr");
    const items = [];
    rows.forEach((tr) => {
      const inp = tr.querySelector(".stk-qty-input");
      const pid = parseInt(inp.dataset.id, 10);
      const sys = parseFloat(String(tr.cells[2].textContent).replace(/,/g, "")) || 0;
      const act = parseFloat(inp.value.replace(/,/g, ""));
      if (isNaN(act)) return;
      if (Math.abs(act - sys) >= 0.0001) items.push({ id: pid, qty: act });
    });

    if (items.length === 0) {
      toast("لم يُدخَل أي «عدد معدود» مختلف عن رصيد النظام بعد، وعليه لم تتم أي تسوية.", "warning");
      return;
    }

    if (!confirm("سيتم اعتماد جرد مخزن (" + wh + ") وتسوية فروق عدد (" + items.length + ") صنف.\n\nهل أنت متأكد من المتابعة؟")) return;

    items.forEach((it) => {
      const pr = products.find((p) => p.id === it.id);
      if (pr) {
        setStockAt(pr, wh, it.qty);
        pr.weightedAvgCost = pr.weightedAvgCost || pr.purchasePrice;
      }
    });
    saveProducts();
    addActivity("اعتماد جرد", "جرد مخزن (" + wh + ") وتسوية " + items.length + " صنف");
    hideModal("mStockTake");
    toast("تم اعتماد الجرد وتسوية الفروق بنجاح.", "success");
    renderProducts();
  }

  function exportStockTakeCSV() {
    const rows = $("#dgvStockTake tbody").querySelectorAll("tr");
    if (rows.length === 0) {
      toast("لا توجد أصناف للتصدير.", "warning");
      return;
    }
    const lines = [];
    lines.push("كود الصنف,اسم الصنف,العدد الفعلي على البرنامج,العدد المعدود,الفرق");
    rows.forEach((tr) => {
      const q = (s) => '"' + String(s || "").replace(/"/g, '""') + '"';
      lines.push([q(tr.cells[0].textContent), q(tr.cells[1].textContent), tr.cells[2].textContent, q(tr.querySelector(".stk-qty-input").value || ""), tr.cells[4].textContent].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "جرد_مخزون_" + Date.now() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("تم تصدير جدول الجرد إلى CSV (يفتح في Excel).", "success");
  }

  function printStockTake() {
    const rows = $("#dgvStockTake tbody").querySelectorAll("tr");
    const wh = $("#stkWarehouse").value;
    $("#skWh").textContent = wh;
    const p = (x) => String(x).padStart(2, "0");
    const d = new Date();
    $("#skDate").textContent = d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    $("#skCount").textContent = rows.length.toLocaleString("en-US");
    const tb = $("#skBody");
    tb.innerHTML = "";
    rows.forEach((tr) => {
      const tr2 = document.createElement("tr");
      tr2.innerHTML =
        '<td>' + esc(tr.cells[0].textContent) + '</td>' +
        '<td>' + esc(tr.cells[1].textContent) + '</td>' +
        '<td>' + esc(tr.cells[2].textContent) + '</td>' +
        '<td>' + esc(tr.querySelector(".stk-qty-input").value || "") + '</td>' +
        '<td>' + esc(tr.cells[4].textContent) + '</td>';
      tb.appendChild(tr2);
    });
    printSection($("#stockPage"));
  }

  /* ══════════════════════════════════════════════════════════════════════════════
     🧮 بناء 145 — «الجرد بالباركود» (سطر ٤ من خطة المالك / بند 18)

     قراره الحرفي (05/10 ≈17:20): «عايز الجرد اللى بالباركود يكون زى الجرد التانى فى ان
     يكون جمب عدد كل صنف تم جرده بالباركود عدد الموجود منه فى المخازن و امكانية اعتماد
     الجرد فيتغير الموجود فى البرنامج لو صاحب الشركه اختار اعتماد الجرد»
     ⇒ خمس قرارات متسجّلة، وكل واحدة ليها فحص مسمّى في `check_stocktake_scan_145.js`:
       (١) **نفس الأعمدة الخمسة** بتاعة الجرد اليدوي بالترتيب (كود · اسم · العدد الفعلي
           على البرنامج · العدد المعدود · الفرق). عمود الـ ✕ للإلغاء بس — مافيش بيانات.
       (٢) **المسح = زيادة مش بديلة** (نفس قاعدة بناء 143): كل مسحة بتزوّد «المعدود»
           بمقدار «عدد كل مسحة»، والخانة يدوية كمان. ونجاح المسحة = «المعدود» **زاد
           فعلًا** (نفس روح `invoiceQtyOf`) — مش «الرقم لقى صنف».
       (٣) **العدد الفعلي على البرنامج حيّ من مصدر واحد**: `stockAt(p, wh)` وقت الرسم
           ووقت الاعتماد ⇒ مستحيل الشاشة تقول رقم والاعتماد يطبّق رقم تاني (لو حصلت
          بيعة في نص الجرد الرقم على الشاشة بيتحدّث والمسافة تتحسب من الجديد).
       (٤) **الاعتماد لصاحب الشركة ومالك البرنامج بس** (زرار مخفي عن الباقي + بوابة
           تانية جوّه الدالة)، و**يعدّل الموجود في البرنامج ويكتب قيد فروق** بنفس بدائل
           بناء 134 (`nextJournalId` + `settleJrnLines` + `refType/refId` لمنع التكرار).
       (٥) **الأصناف اللي ما اتلمستش = قرار سطر-سطر** في نافذة `#mScZero`: ممنوع تصفير
           تلقائي جملي، وممنوع تسريبهم بلا سؤال — اللي ما تتعلّمش عليه صح بيفضل برصيد
           زي ما هو.
     الورق كله على **جهاز العميل بس**: مفتاح `mizan_sc_sheets_v1:<orgId>` (بناء 146 — بره
     `LS_ALL_KEYS` عمدًا، شوف السبب المقيّس تحت عند التعريف) ⇒ **مافيش جدول `stock_counts` على
     السحابة ومافيش ترقية ٥١**، وممنوع إدخال المفتاح في `mirror()` أو `pushTable()`.
     ══════════════════════════════════════════════════════════════════════════════ */

  /* ---- الورق على الجهاز (مافيش رفع سحابي خالص) ---- */
  /* 🔴 باگ حيّ مقاس (06/10 ≈23:50 — «مش بيحفظ ورقة الجرد»): الورق كان على مفتاح عام
     داخل `LS_ALL_KEYS`، و`guardOrgSwitch()` بيمسح كل مفتاح في القائمة عند أي دخول ختمه
     مش مطابق — و`showLogin()` بيشيل الختم ⇒ **خروج ودخول لنفس الشركة = الورق راح**.
     الإصلاح: المفتاح يتقفل **بمعرّف الشركة** (`…:orgId`) ⇒ العزل بقى في اسم المفتاح
     نفسه، فمفيش سبب يمسحه، وورق شركة ما بيبانش في شركة تانية أبدًا. */
  let scLoadedKey = null;      // المفتاح اللي آخر قراءة فعلًا جاية منه (null = ما قريانش)
  function scOrgId() {
    try {
      const o = window.DATA && typeof DATA.org === "function" ? DATA.org() : null;
      if (o && o.id) return String(o.id);
    } catch (e) { /* DATA لسه ما اتعملهاش init */ }
    try { const l = localStateOrg(); if (l) return String(l); } catch (e) { /* مافيش ختم */ }
    return "";
  }
  function scOrgKey() {
    const id = scOrgId();
    return id ? LS_STOCK_SHEETS + ":" + id : LS_STOCK_SHEETS;
  }
  function scSheetsRead() {
    scLoadedKey = scOrgKey();
    try {
      const raw = JSON.parse(localStorage.getItem(scLoadedKey));
      if (!Array.isArray(raw)) return [];
      // ورقة بلا `lines` مصفوفة = كتابة قديمة/تالفة ⇒ تتجاهلها أحسن من شاشة فاضية أو زعلة
      return raw.filter((s) => s && typeof s === "object" && Array.isArray(s.lines));
    } catch (e) { return []; }
  }
  // مافيش `pushTable` ومافيش `syncToLocalDisk`: الورقة أداة عدّ على الجهاز ده، مش بيانات شركة.
  function scSheetsWrite() {
    try {
      scLoadedKey = scOrgKey();
      localStorage.setItem(scLoadedKey, JSON.stringify(scSheets));
    } catch (e) {
      toast("المتصفح رفض يحفظ الورقة على الجهاز — العدّاد شغال في الذاكرة، بس الورقة ما بتفضلش بعد قفل الصفحة.", "warning");
    }
  }
  /* الورق بيتقري وقت `loadData()` (مرة عند الإقلاع/الدخول)، بس المعرّف الحقيقي للشركة
     ممكن يتعرّف بعد كده أو يتبدّل ⇒ أي نداء لشاشة الجرد لازم يتأكد إن اللي في الذاكرة
     جاي من **مفتاح الشركة دي**. لو المفتاح مختلف: نعيد القراءة من القرص (ولو لسه ما
     اتقريتش خالص: نقري أول مرة). بدون ده الزرار «📂 فتح» بيلاقي القائمة فاضية ⇒
     «ورقة الجرد مش بتنزل» زي ما اشتكى المالك. */
  function scResyncOrg() {
    const k = scOrgKey();
    if (scLoadedKey === k) return false;
    scSheets = scSheetsRead();
    scSheetCur = null;
    return true;
  }
  function scNewNo() {
    let m = 0;
    scSheets.forEach((s) => {
      const n = parseInt(String((s && s.no) || "").replace(/^SC-?/i, ""), 10);
      if (isFinite(n) && n > m) m = n;
    });
    return "SC-" + String(m + 1).padStart(4, "0");
  }
  function scNewSheet() {
    const el = $("#scWarehouse");
    const wh = el && el.value ? el.value : WAREHOUSES[0];
    scSheetCur = { no: scNewNo(), wh: wh, date: todayISO(), createdAt: new Date().toISOString(), savedAt: "", lines: [], diffAcc: "", appliedAt: "", appliedJrn: "" };
    scPersist();
    return scSheetCur;
  }
  // كل تعديل في العدّاد بيتقفل على الجهاز فورًا (ممنوع «عدّيت ٤٠ صنف والصفحة اتقفلت»)
  function scPersist() {
    const sh = scSheetCur;
    if (!sh) return;
    sh.savedAt = new Date().toISOString();
    const i = scSheets.findIndex((s) => s && s.no === sh.no);
    if (i >= 0) scSheets[i] = sh; else scSheets.push(sh);
    scSheetsWrite();
  }
  function scCur() {
    scResyncOrg();   // 🔴 «ورقة الجرد مش بتنزل» (06/10 ≈23:50): الذاكرة لازم تبقى بتاعة الشركة دي
    if (!scSheetCur) scNewSheet();
    return scSheetCur;
  }
  function scWh() {
    const el = $("#scWarehouse");
    const v = el && el.value ? el.value : (scSheetCur && scSheetCur.wh) || WAREHOUSES[0];
    if (scSheetCur) scSheetCur.wh = v;
    return v;
  }

  /* ---- سطور الورقة ---- */
  function scLine(sh, pid, make) {
    const id = Number(pid);
    const i = sh.lines.findIndex((l) => Number(l.id) === id);
    if (i >= 0) return sh.lines[i];
    if (!make) return null;
    const l = { id: id, counted: 0, tally: 0 };
    sh.lines.push(l);
    return l;
  }
  function scProductOf(line) {
    return products.find((p) => Number(p.id) === Number(line && line.id)) || null;
  }
  function scCountedOf(sh, pid) {
    const l = scLine(sh, pid, false);
    return l ? (Number(l.counted) || 0) : 0;
  }
  // المصدر الوحيد ل«العدد الفعلي على البرنامج» — نفس `stockAt` اللي بتاعه اليدوي والفاتورة
  function scSys(p, wh) { return Number(stockAt(p, wh)) || 0; }
  function scSysOf(p) { return scSys(p, scWh()); }
  function scNum(n) { return Number(n || 0).toLocaleString("en-US"); }
  function scCostOf(p) { return round2(Number(p.weightedAvgCost) || Number(p.purchasePrice) || 0); }

  // «عدد كل مسحة»: فاضي = ١ (مسحة صنف واحد)، رقم موجب = كما هو، حاجة تانية = مرفوض
  // ⚠️ هنا الخانة اسمها «عدد كل مسحة» وقيمتها قرار البائع نفسه ⇒ المسحة بتنفّذ اللي
  //    مكتوب، والفاضي = ١. وده نفس قرار الفاتورة بعد 06/10 ≈22:15 (المسحة تنزّل السطر
  //    بكمية ١، والكتابة اليدوية تُحرم) — الفرق: في الجرد الرقم بيتجمّع في عمود «المعدود»
  //    مش في سطر فاتورة.
  function scPerScan() {
    const el = $("#numScQty");
    const s = String(el && el.value != null ? el.value : "").trim();
    if (s === "") return 1;
    const n = parseFloat(s.replace(/,/g, ""));
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  /* الزيادة نفسها — والمقياس الوحيد للنجاح إن «المعدود» بقى أكبر من قبل كده.
     لو المسح ما زادش حاجة (كمية صفر أو صنف اتشال) السطر الوهمي بيتشال، فالورقة
     ما تبانش فيها صنف «اتمسح» وعدّاده صفر. */
  function scCountAdd(pid, qty) {
    const sh = scCur();
    const before = scCountedOf(sh, pid);
    const isNew = !scLine(sh, pid, false);
    const line = scLine(sh, pid, true);
    line.counted = round2((Number(line.counted) || 0) + qty);
    line.tally = (Number(line.tally) || 0) + 1;
    const ok = scCountedOf(sh, pid) > before;
    if (!ok) {
      line.counted = before;
      if (isNew) {
        const i = sh.lines.findIndex((l) => Number(l.id) === Number(pid));
        if (i >= 0) sh.lines.splice(i, 1);
      }
      return false;
    }
    scPersist();
    renderStockCount();
    return true;
  }

  /* ---- المسح (نفس مسار الإسكانر/الكاميرا في الفاتورة — مافيش نسخة تانية) ---- */
  function scHandleScan(raw) {
    const res = findProductByScan(raw);
    if (!res.prod) {
      scanBeep("no");
      scanHint("#scScanHint", "warn", scanFailText(res) +
        " <span class='scan-sub'>أو اكتب اسم الصنف في خانة الاسم ودوس «عدّ ➕».</span>");
      return;
    }
    const p = res.prod;
    const qty = scPerScan();
    if (qty == null) {
      scanBeep("no");
      scanHint("#scScanHint", "warn", "🧮 (" + esc(p.nameAr || p.code) + ") اتعرّف — بس «عدد كل مسحة» مش رقم. اكتب عدد صحيح أكبر من صفر (أو سيّبه فاضي = صنف واحد) ومرّر الماسح تاني.");
      const q = $("#numScQty");
      if (q) { q.focus(); if (q.select) q.select(); }
      return;
    }
    $("#txtScSearch").value = "";
    const before = scCountedOf(scCur(), p.id);
    const ok = scCountAdd(p.id, qty);
    const after = scCountedOf(scCur(), p.id);
    if (!ok) {
      scanBeep("no");
      scanHint("#scScanHint", "warn", "⚠️ (" + esc(p.nameAr || p.code) + ") ما اتعدّش — جرّب تاني أو اكتب العدد بإيدك في الخانة.");
      return;
    }
    /* ✅ النجاح = خانة الباركود **تتفرّغ** والتركيز يفضل فيها.
       الفرق عن الفاتورة (بناء 143): هناك الخطوة الجاية خانة الكمية فالرقم اللي في خانة
       الكود ما بيضرّش؛ هنا البائع بيمرّر الماسح صنف ورا صنف من نفس الخانة، ولو الرقم
       القديم فضل مكتوب ⇒ المسحة الجاية تركّب وراه («200…011» + «200…021» = ٢٦ رقم)
       وتترفض بـ «ملقتش صنف». القياس: حارس 145 (مسحتين ورا بعض = سطر واحد معدوده ٢).
       ⚠️ أي **رفض** (كمية غلط / صنف ملوش / ما اتعدّش) بيخلي الرقم في الخانة كما هو —
       عشان قدام البائع يصلّح «عدد كل مسحة» ويدوس Enter على نفس الرقم من غير ما يعيد المسح. */
    $("#txtScCode").value = "";
    const cc = $("#txtScCode");
    if (cc) cc.focus();
    scanBeep("ok");
    const sys = scSysOf(p);
    const d = round2(after - sys);
    scanHint("#scScanHint", "ok", "📷 " + esc(p.nameAr || p.code) + " — اتعدّ +" + scNum(qty) +
      " ⇒ المعدود " + scNum(after) + " " + esc(p.unit || "") +
      "<span class='scan-sub'>العدد الفعلي على البرنامج: " + scNum(sys) + " · الفرق: " +
      (d > 0 ? "+" : "") + scNum(d) + " — امسّح الصنف اللي بعده.</span>");
  }

  /* Enter في خانة الكود — في البيع والشراء كان بيفرّق (الإسكانر = اختيار، والصابع =
     إضافة السطر). هنا القرار واحد بطبيعته: **اللي في الخانة = اللي يتعدّ**، سواء جاي من
     الماسح أو مكتوب بإيدك. والمسار واحد (`scHandleScan` → `findProductByScan`) فمستحيل
     المسح والكتابة يطلّعوا نتيجتين مختلفتين لنفس الرقم. */
  /* Enter في خانة الكود = «عدّ الرقم اللي آخر مسحة». `scanTailOf` بتاخد **ذيل السلسلة
     السريعة** بس، فالرقم اللي سابته مسحة مرفوضة قبل كده (بيتساب بالعمد عشان البائع
     يعدّل الكمية) ما يدخلش في رقم المسحة الجاية ويروّعه. */
  function scCodeEnter() {
    const raw = $("#txtScCode").value;
    scHandleScan(scanTailNorm("txtScCode"));
  }

  /* العد بالإيد (لو مافيش ماكينة، أو الصنف ملوش باركود): خانة الاسم + «عدّ ➕».
     كل ضغطة = واحدة، فاللي يعدّ ٧ قطع بإيده يدوس ٧ مرات — ونفس السطر بيتزوّد.
     الصنف الموقوف بيُعدّ هنا (على عكس المسح اللي بيرفضه): الجرد بيشوف الموجود في
     المخزن فعلًا، والرفض في المسح سببه إن «موقوف» مش للبيع — مش إن مش موجود. */
  function scManualAdd() {
    const raw = $("#txtScSearch").value;
    if (!String(raw || "").trim()) {
      toast("اكتب اسم الصنف أو كوده في خانة الاسم الأول، وبعدين دوس «عدّ ➕».", "warning");
      return;
    }
    const p = findProductFlexible(raw);
    if (!p) {
      scanBeep("no");
      scanHint("#scScanHint", "warn", "🔍 ملقتش صنف بـ («" + esc(raw) + "») — جرّب جزء من الاسم، أو امسّح باركوده.");
      return;
    }
    const ok = scCountAdd(p.id, 1);
    const after = scCountedOf(scCur(), p.id);
    if (!ok) {
      scanBeep("no");
      scanHint("#scScanHint", "warn", "⚠️ (" + esc(p.nameAr || p.code) + ") ما اتعدّش — جرّب تاني.");
      return;
    }
    scanBeep("ok");
    scanHint("#scScanHint", "ok", "✍️ " + esc(p.nameAr || p.code) + " — اتعدّ بالإيد ⇒ المعدود " + scNum(after) +
      " " + esc(p.unit || "") +
      "<span class='scan-sub'>العدد الفعلي على البرنامج: " + scNum(scSysOf(p)) +
      (!p.isActive ? " · الصنف موقوف عن البيع بس لسه موجود في المخزن، فبيتعدّ طبيعي." : "") + "</span>");
  }

  function scRemove(pid) {
    const sh = scCur();
    const i = sh.lines.findIndex((l) => Number(l.id) === Number(pid));
    if (i < 0) return;
    const p = scProductOf(sh.lines[i]);
    sh.lines.splice(i, 1);
    scPersist();
    renderStockCount();
    scanHint("#scScanHint", "info", "🗑 سطر (" + esc((p && p.nameAr) || "الصنف") + ") اتشال من الورقة — المخزون ما اتلمستش.");
  }

  // كتابة العدد يدويًا في الخانة = قرار نهائي (مش زيادة)
  function scSetCountFromInput(pid, raw) {
    const sh = scCur();
    const s = String(raw == null ? "" : raw).trim();
    const line = scLine(sh, pid, !!s);
    if (!line) return false;
    const n = parseFloat(s.replace(/,/g, ""));
    if (s !== "" && (!isFinite(n) || n < 0)) {
      renderStockCount();     // الخانة ترجع لآخر عدد صحيح بدل ما تستقبل نص غلط
      toast("اكتب عددًا صحيحًا (٠ أو أكبر) في خانة «العدد المعدود»، أو سيّبها فاضية.", "warning");
      return false;
    }
    line.counted = s === "" ? 0 : round2(n);
    scPersist();
    renderStockCount();
    return true;
  }

  /* ---- الرسم ---- */
  function renderStockCount() {
    const tb = $("#dgvStockCount tbody");
    if (!tb) return;
    const sh = scCur();
    const wh = scWh();
    tb.innerHTML = "";
    sh.lines.forEach((l) => {
      const p = scProductOf(l);
      const counted = Number(l.counted) || 0;
      const sys = p ? scSys(p, wh) : 0;
      const diff = round2(counted - sys);
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(p ? p.code : "—") + '</td>' +
        '<td>' + (p ? esc(p.nameAr) : "<span class='diff-neg'>صنف اتشال من الدليل</span>") + '</td>' +
        '<td>' + scNum(sys) + '</td>' +
        '<td><input class="stk-qty-input sc-count-input" type="text" data-id="' + Number(l.id) + '" value="' + (counted ? scNum(counted) : "") + '" autocomplete="off" /></td>' +
        '<td class="stk-diff ' + (diff > 0 ? "diff-pos" : diff < 0 ? "diff-neg" : "diff-zero") + '">' +
        (diff ? (diff > 0 ? "+" : "") + scNum(diff) : "-") + '</td>' +
        '<td><button type="button" class="btn red small" data-sc-del="' + Number(l.id) + '" title="شيل السطر من الورقة (المخزون ما بيتلمنش)">✕</button></td>';
      tb.appendChild(tr);
    });
    scPaintSummary();
    scFillDiffAcc();
    scFillSheetList();
  }

  /* الأرقام دي بتتحسب من نفس `scSys`/`stockAt` اللي بترسم الخانات، وبتتنادى بعد كل مسحة
     وبعد كل كتابة في الخانة — فالملخص والسطر والقيد ما يختلفوش أبدًا (درس بناء 135:
     «مصدر واحد للحساب» أحسن من أي التزام بالتوازي). */
  function scTotalsOf(sh) {
    const wh = scWh();
    let tallies = 0, over = 0, under = 0, valueSum = 0;
    (sh.lines || []).forEach((l) => {
      const p = scProductOf(l);
      const diff = round2((Number(l.counted) || 0) - (p ? scSys(p, wh) : 0));
      tallies += Number(l.tally) || 0;
      if (diff > 0) over++; else if (diff < 0) under++;
      if (p) valueSum += round2(diff * scCostOf(p));
    });
    return { tallies: tallies, over: over, under: under, valueSum: round2(valueSum) };
  }
  function scPaintSummary() {
    const sh = scCur();
    const t = scTotalsOf(sh);
    const sum = $("#scSummary");
    if (sum) {
      sum.textContent = sh.lines.length
        ? ("📋 أصناف معدودة: " + scNum(sh.lines.length) + " · مسحات وعدّات: " + scNum(t.tallies) +
          " · زيادة: " + scNum(t.over) + " · نقص: " + scNum(t.under) +
          " · قيمة الفروق (تقديري بالتكلفة): " + fmt(t.valueSum) + " ج.م")
        : "📋 الورقة لسه فاضية — مرّر الماسح على الأصناف، أو اكتب الاسم ودوس «عدّ ➕».";
    }
    const note = $("#scStateNote");
    if (note) {
      note.textContent = (sh.appliedAt ? "✅ الورقة " + sh.no + " اتاعتمدت" + (sh.appliedJrn ? " (قيد " + sh.appliedJrn + ")" : "") : "🟢 الورقة " + sh.no + " شغّالة") +
        " — مخزن («" + scWh() + "») · محفوظة على الجهاز" + (sh.savedAt ? " الساعة " + scClock(sh.savedAt) : "");
    }
    // «اعتماد الجرد» = صاحب الشركة ومالك البرنامج بس (قرار المالك) — والعدّ والطباعة للكل
    const ap = $("#btnScApply");
    if (ap) ap.hidden = !scCanApprove();
  }

  /* الكتابة في «العدد المعدود» بتحدّث **السطر والملخص بس** — ممنوع إعادة رسم الجدول
     أثناء الكتابة: التركيز بيطير من الخانة وكل حرف بيدوّر الجدول من الأول (فالفارق بين
     `scLiveFromInput` و`scSetCountFromInput` هو اللحظة، مش النتيجة). */
  function scLiveFromInput(inp) {
    const sh = scCur();
    const line = scLine(sh, Number(inp.dataset.id), false);
    if (!line) return;
    const s = String(inp.value == null ? "" : inp.value).trim();
    const n = parseFloat(s.replace(/,/g, ""));
    const valid = (s === "") || (isFinite(n) && n >= 0);
    /* «abc» أثناء الكتابة = مش عدد، **وممنوع تصفّر صنف عدّه البائع قبل كده** (الغلطة الحيّة
       اللي قاستها رحلة J4: «17» ⇒ كتب «abc» ⇒ المعدود بقى ٠ والفرق -40 والرقم ضاع).
       فالحالة دي: العدد اللي في الورقة يفضل آخر عدد سليم، والفرق والملخص يتحسبوا منه،
       والخانة نفسها تستنى `change` (`scSetCountFromInput`) يرجّعها للرقم ده. */
    if (valid) line.counted = (s === "") ? 0 : round2(n);
    const tr = inp.closest("tr");
    if (tr && tr.cells[4]) {
      const p = scProductOf(line);
      const diff = round2(line.counted - (p ? scSys(p, scWh()) : 0));
      tr.cells[4].textContent = diff ? (diff > 0 ? "+" : "") + scNum(diff) : "-";
      tr.cells[4].className = "stk-diff " + (diff > 0 ? "diff-pos" : diff < 0 ? "diff-neg" : "diff-zero");
    }
    if (valid) scPersist();
    scPaintSummary();
  }

  // «📦 رصيد: -» تحت خانة الاسم — بيتحدّث مع الكتابة عشان البائع يعرف عدّ أنهي صنف
  function scShowStock() {
    const el = $("#scStockHint");
    if (!el) return;
    const raw = $("#txtScSearch") ? $("#txtScSearch").value : "";
    if (!String(raw || "").trim()) { el.className = "stock-hint"; el.textContent = "📦 رصيد: -"; return; }
    const p = findProductFlexible(raw);
    if (!p) { el.className = "stock-hint"; el.textContent = "📦 رصيد: - (ملقاش صنف بالاسم ده)"; return; }
    el.className = "stock-hint";
    el.textContent = "📦 " + (p.nameAr || p.code) + " — رصيد البرنامج في («" + scWh() + "»): " +
      scNum(scSysOf(p)) + " " + (p.unit || "") + " · المعدود في الورقة: " + scNum(scCountedOf(scCur(), p.id));
  }

  /* زرار «📷 مسح» في رأس شاشة الجرد = يجهّز الخانة، وللموبايل يفتح الكاميرا فوق
     (نفس `posScanArm`/`ppScanArm` حرفيًا — مافيش منطق كاميرا تاني للجرد). */
  function scScanArm() {
    const el = $("#txtScCode");
    if (!el) return;
    el.focus();
    el.select();
    scanCamToggle("txtScCode");
    camArmHint("#scScanHint", "txtScCode");
  }

  // ورقة جديدة = عدّاد فاضي + خانتين ناضفتين + نفس المخزن اللي واقف عليه
  function scStartNew() {
    scNewSheet();
    $("#txtScCode").value = "";
    $("#txtScSearch").value = "";
    $("#numScQty").value = "1";
    $("#scStockHint").className = "stock-hint";
    $("#scStockHint").textContent = "📦 رصيد: -";
    scanHint("#scScanHint");
    renderStockCount();
    $("#txtScCode").focus();
    toast("ورقة جرد جديدة (" + scSheetCur.no + ") في مخزن («" + scWh() + "») — ابدأ المسح.", "success");
  }

  function scClock(iso) {
    try {
      const d = new Date(iso);
      const p = (x) => String(x).padStart(2, "0");
      return p(d.getHours()) + ":" + p(d.getMinutes());
    } catch (e) { return ""; }
  }

  function scOpenView() {
    fillWhSelect("#scWarehouse", scSheetCur ? scSheetCur.wh : null);
    scCur();
    renderStockCount();
    const el = $("#txtScCode");
    if (el) el.focus();
  }

  /* ---- ورق الجهاز: فتح/حذف/حفظ ---- */
  function scFillSheetList() {
    const sel = $("#scSheetList");
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    scSheets.slice().sort((a, b) => String(b.no).localeCompare(String(a.no))).forEach((s) => {
      const o = document.createElement("option");
      o.value = s.no;
      o.textContent = s.no + " — " + (s.wh || "-") + " — " + scNum((s.lines || []).length) +
        " صنف" + (s.appliedAt ? " (اتاعتمدت)" : "");
      sel.appendChild(o);
    });
    const cur = scSheetCur && scSheetCur.no;
    if (cur && scSheets.some((s) => s.no === cur)) sel.value = cur;
    else if (prev) sel.value = prev;
  }
  function scLoadSheet() {
    const no = $("#scSheetList").value;
    const s = scSheets.find((x) => x && x.no === no);
    if (!s) { toast("اختار ورقة من القائمة الأول.", "warning"); return; }
    scSheetCur = s;
    fillWhSelect("#scWarehouse", s.wh || null);
    const el = $("#scWarehouse");
    if (el && s.wh) el.value = s.wh;
    renderStockCount();
    scanHint("#scScanHint", "info", "📂 الورقة " + s.no + " (مخزن «" + esc(s.wh || "-") + "») اتفتحت — " +
      scNum((s.lines || []).length) + " صنف. (ساعة ما تتلمسش الأصناف دي؟ رجّع المخزن في القائمة قبل ما تعدّ)");
  }
  function scDeleteSheet() {
    const no = $("#scSheetList").value;
    if (!no) { toast("اختار الورقة اللي عايز تمسحها الأول.", "warning"); return; }
    const s = scSheets.find((x) => x && x.no === no);
    if (!s) return;
    if (s.appliedAt && !confirm("الورقة " + no + " **اتاعتمدت** والقيد بتاعها (" + (s.appliedJrn || "-") + ") مسجّل في القيود.\n\nمسح الورقة من الجهاز ما بيرجّعش القيد ولا المخزون — متأكد؟")) return;
    else if (!confirm("مسح ورقة الجرد " + no + " من على هذا الجهاز؟")) return;
    scSheets = scSheets.filter((x) => x.no !== no);
    scSheetsWrite();
    if (scSheetCur && scSheetCur.no === no) scSheetCur = null;
    if (!scSheetCur) scNewSheet();
    renderStockCount();
    toast("الورقة " + no + " اتمسحت من الجهاز.", "success");
  }
  function scSaveSheet() {
    const sh = scCur();
    scPersist();
    renderStockCount();
    toast("ورقة الجرد " + sh.no + " محفوظة على هذا الجهاز (بره السحابة — مافيش أي رفع).", "success");
  }

  /* ---- التصدير والطباعة ---- */
  function scExportCSV() {
    const sh = scCur();
    const wh = scWh();
    if (!sh.lines.length) { toast("الورقة لسه فاضية — مافيش حاجة تتصدّر.", "warning"); return; }
    const rows = [["كود الصنف", "اسم الصنف", "العدد الفعلي على البرنامج", "العدد المعدود", "الفرق"]];
    sh.lines.forEach((l) => {
      const p = scProductOf(l);
      const counted = Number(l.counted) || 0;
      const sys = p ? scSys(p, wh) : 0;
      const diff = round2(counted - sys);
      rows.push([p ? p.code : "—", p ? p.nameAr : "صنف اتشال من الدليل", scNum(sys), scNum(counted), (diff > 0 ? "+" : "") + scNum(diff)]);
    });
    downloadCSV("جرد_بالباركود_" + sh.no + ".csv", rows);
    toast("تم تصدير ورقة الجرد إلى CSV (يفتح في Excel).", "success");
  }

  function scPrintSheet() {
    const sh = scCur();
    const wh = scWh();
    $("#sckWh").textContent = wh;
    $("#sckNo").textContent = sh.no;
    const p = (x) => String(x).padStart(2, "0");
    const d = new Date();
    $("#sckDate").textContent = d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    $("#sckCount").textContent = scNum(sh.lines.length);
    let over = 0, under = 0;
    sh.lines.forEach((l) => {
      const pr = scProductOf(l);
      const diff = round2((Number(l.counted) || 0) - (pr ? scSys(pr, wh) : 0));
      if (diff > 0) over++; else if (diff < 0) under++;
    });
    $("#sckMeta").textContent = "زيادة: " + scNum(over) + " صنف · نقص: " + scNum(under) +
      " صنف · الحالة: " + (sh.appliedAt ? ("اتاعتمدت" + (sh.appliedJrn ? " بقيد " + sh.appliedJrn : "") ) : "لسه معتمدة") +
      " · الجرد بالإسكانر على جهاز العميل";
    const tb = $("#sckBody");
    tb.innerHTML = "";
    sh.lines.forEach((l) => {
      const pr = scProductOf(l);
      const counted = Number(l.counted) || 0;
      const sys = pr ? scSys(pr, wh) : 0;
      const diff = round2(counted - sys);
      const tr2 = document.createElement("tr");
      tr2.innerHTML =
        '<td>' + esc(pr ? pr.code : "—") + '</td>' +
        '<td>' + esc(pr ? pr.nameAr : "صنف اتشال من الدليل") + '</td>' +
        '<td>' + scNum(sys) + '</td>' +
        '<td>' + scNum(counted) + '</td>' +
        '<td>' + (diff ? (diff > 0 ? "+" : "") + scNum(diff) : "-") + '</td>';
      tb.appendChild(tr2);
    });
    printSection($("#stockCountPage"));
  }

  /* ---- الصلاحية + حساب الفروق ---- */
  function scCanApprove() { return isSuperAcct() || isCompanyOwnerAcct(); }

  // حسابات الفروق = أي حساب طرفي تحت «مصروفات» (5…)، أو أي طرفي اسمه «فروق جرد».
  // الحسابات اللي تحت الإيراد (4… وبينها 4.1) **خارج القائمة خالص**: فرق الجرد مش بيع.
  function scDiffOptions() {
    const out = [];
    accounts.forEach((a) => {
      if (!a || a.isActive === false) return;
      const code = String(a.code || "");
      if (!/^[0-9]/.test(code)) return;
      const leaf = !accounts.some((x) => x && x !== a && String(x.code || "").indexOf(code + ".") === 0);
      if (!leaf) return;
      if (/^4(\.|$)/.test(code)) return;
      const isCost = /^5(\.|$)/.test(code);
      const named = String(a.nameAr || "").indexOf("فروق جرد") >= 0;
      if (isCost || named) out.push(a);
    });
    out.sort((x, y) => String(x.code).localeCompare(String(y.code), "en"));
    return out;
  }
  function scFillDiffAcc() {
    const sel = $("#scDiffAcc");
    if (!sel) return;
    const list = scDiffOptions();
    const sh = scSheetCur;
    const want = String((sh && sh.diffAcc) || sel.value || "");
    sel.innerHTML = "";
    list.forEach((a) => {
      const o = document.createElement("option");
      o.value = String(a.code);
      o.textContent = a.code + " — " + (a.nameAr || "");
      sel.appendChild(o);
    });
    if (!list.length) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "مافيش حساب فروق في دليلك — ضيفه من «الحسابات»";
      sel.appendChild(o);
      return;
    }
    let pick = list.find((a) => String(a.code) === want) || list.find((a) => String(a.code) === "5.1") || list[0];
    sel.value = String(pick.code);
    if (sh) sh.diffAcc = String(pick.code);
  }
  function scDiffAccount() {
    const sel = $("#scDiffAcc");
    const code = sel ? String(sel.value || "") : "";
    return accByCode(code, "فروق جرد") || accByCode("5.1", "فروق جرد") || null;
  }

  // الأصناف اللي ليها رصيد في المخزن ده والورقة ما انمسحتش عليها ⇒ قرار التصفير سطر-سطر
  function scUntouched() {
    const sh = scCur();
    const wh = scWh();
    const ids = {};
    sh.lines.forEach((l) => { ids[Number(l.id)] = true; });
    return products.filter((p) => !ids[Number(p.id)] && scSys(p, wh) > 0);
  }

  /* ---- خطة القيد (قراءة فقط — ما تغيّرش حاجة) ---- */
  function scJrnRef() { return "جرد بالباركود"; }
  function scJrnKey(no) { const s = String(no || "").trim(); return s ? "SC:" + s : ""; }
  function scJrnOf(no) {
    const key = scJrnKey(no);
    if (!key) return null;
    const ref = scJrnRef();
    return journalEntries.find((j) => j && String(j.refId || "") === key && (j.refType === ref || j.ref === ref)) || null;
  }
  function scMissText(err) {
    if (err === "1.1.4") return "حساب «المخزون» (1.1.4) مش موجود في دليل حساباتك";
    if (err === "diff") return "مافيش حساب طرفي للفروقات في دليل حساباتك — ضيف حسابًا باسم «فروق جرد» تحت المصروفات (مثل 5.1) من شاشة «الحسابات»";
    return "فيه حساب ناقص في دليل حساباتك";
  }
  function scDiffPlan(sh, zeroIds) {
    const wh = sh.wh;
    const rows = [];
    sh.lines.forEach((l) => {
      const p = scProductOf(l);
      if (!p) return;                       // سطر يتيم (صنف اتشال) — ما يدخلش القيد
      const counted = Number(l.counted) || 0;
      const sys = scSys(p, wh);
      const diff = round2(counted - sys);
      if (!diff) return;
      const cost = scCostOf(p);
      rows.push({ id: p.id, nameAr: p.nameAr, code: p.code, unit: p.unit || "", sys: sys, counted: counted, diff: diff, cost: cost, value: round2(diff * cost), set: counted });
    });
    (zeroIds || []).forEach((pid) => {
      if (rows.some((r) => Number(r.id) === Number(pid))) return;
      const p = products.find((x) => Number(x.id) === Number(pid));
      if (!p) return;
      const sys = scSys(p, wh);
      if (!(sys > 0)) return;
      const cost = scCostOf(p);
      rows.push({ id: p.id, nameAr: p.nameAr, code: p.code, unit: p.unit || "", sys: sys, counted: 0, diff: round2(-sys), cost: cost, value: round2(-sys * cost), set: 0 });
    });
    const total = round2(rows.reduce((m, r) => m + r.value, 0));
    const stock = accByCode("1.1.4", "المخزون");
    const diffAcc = scDiffAccount();
    if (Math.abs(total) > 0.0001) {
      if (!stock) return { error: "1.1.4" };
      if (!diffAcc) return { error: "diff" };
    }
    const lines = [];
    if (Math.abs(total) > 0.0001) {
      const abs = round2(Math.abs(total));
      if (total > 0) {
        lines.push({ accountId: Number(stock.id), debit: abs, credit: 0 });
        lines.push({ accountId: Number(diffAcc.id), debit: 0, credit: abs });
      } else {
        lines.push({ accountId: Number(diffAcc.id), debit: abs, credit: 0 });
        lines.push({ accountId: Number(stock.id), debit: 0, credit: abs });
      }
    }
    return { rows: rows, total: total, lines: lines, stock: stock, diffAcc: diffAcc,
      debit: round2(lines.reduce((m, l) => m + (Number(l.debit) || 0), 0)),
      credit: round2(lines.reduce((m, l) => m + (Number(l.credit) || 0), 0)) };
  }

  /* ---- الاعتماد ---- */
  function scApply() {
    if (!scCanApprove()) {
      toast("«اعتماد الجرد» وتسوية الفروق لصاحب الشركة ومالك البرنامج فقط — العدّ والطباعة والتصدير شغالين لباقي الحسابات.", "error");
      return;
    }
    const sh = scCur();
    if (!sh.lines.length) {
      toast("الورقة لسه فاضية — امسّح أصناف أو عدّها بإيدك الأول، وبعدها اعتمد الجرد.", "warning");
      return;
    }
    if (scJrnOf(sh.no)) {
      const j = scJrnOf(sh.no);
      toast("ورقة الجرد " + sh.no + " اتاعتمدت قبل كده (قيد " + (j.number || "-") + ") — عايز تعتمد مرة تانية اعمل «ورقة جرد جديدة».", "warning");
      return;
    }
    const ut = scUntouched();
    if (ut.length) { openScZeroModal(ut); return; }   // قرار التصفير سطر-سطر، وبعدها يكمل
    scFinishApply(sh, []);
  }

  let scZeroPending = false;
  function openScZeroModal(untouched) {
    const sh = scCur();
    const tb = $("#dgvScZero tbody");
    tb.innerHTML = "";
    untouched.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td><input type="checkbox" class="sc-zero-chk" data-id="' + Number(p.id) + '" /></td>' +
        '<td>' + esc(p.code) + '</td>' +
        '<td>' + esc(p.nameAr) + '</td>' +
        '<td>' + scNum(scSysOf(p)) + '</td>' +
        '<td>' + esc(p.unit || "") + '</td>';
      tb.appendChild(tr);
    });
    $("#scZeroLead").textContent = "في " + scNum(untouched.length) + " صنف ليهم رصيد في مخزن («" + sh.wh + "») والورقة ما انمسحتش عليها. الجرد ما بيكملش غير بقرارك فيهم واحد واحد:";
    $("#scZeroFoot").textContent = "✔️ اللي تعلّم عليه = تعدّه صفر (يسجّل فرق في القيد زي باقي الأصناف). اللي ما تعلّمش عليه = يفضل برصيد زي ما هو تمامًا، ومافيش أي تصفير تلقائي.";
    scZeroPending = true;
    showModal("mScZero");
  }
  function scZeroIds() {
    const out = [];
    document.querySelectorAll("#dgvScZero tbody .sc-zero-chk").forEach((c) => { if (c.checked) out.push(Number(c.dataset.id)); });
    return out;
  }
  function scZeroMarkAll() {
    const list = document.querySelectorAll("#dgvScZero tbody .sc-zero-chk");
    let allOn = list.length > 0;
    list.forEach((c) => { if (!c.checked) allOn = false; });
    list.forEach((c) => { c.checked = !allOn; });
    $("#btnScZeroMarkAll").textContent = allOn ? "☑️ علّم الكل" : "⬜ سيّب الكل";
  }
  function scZeroCancel() {
    hideModal("mScZero");
    scZeroPending = false;
    toast("الاعتماد اتلغى — الورقة والمخزون زي ما هما تمامًا، ما اتغيّرش حاجة.", "info");
  }
  function scZeroApply() {
    const ids = scZeroIds();
    hideModal("mScZero");
    scZeroPending = false;
    scFinishApply(scCur(), ids);
  }

  /* النفاذ الحقيقي: يتأكد إن مافيش تكرار، يعدّل المخزون، وبعدين يكتب القيد — والاتنين
     من نفس الأرقام اللي على الشاشة (`scSys`/`stockAt`)، ولا رقم بيتحسب من لقطة قديمة. */
  function scFinishApply(sh, zeroIds) {
    if (!scCanApprove()) {
      toast("«اعتماد الجرد» وتسوية الفروق لصاحب الشركة ومالك البرنامج فقط.", "error");
      return;
    }
    if (!sh || !sh.lines.length) { toast("الورقة لسه فاضية.", "warning"); return; }
    const dup = scJrnOf(sh.no);
    if (dup) { toast("ورقة الجرد " + sh.no + " اتاعتمدت قبل كده (قيد " + (dup.number || "-") + ") — ممنوع اعتماد نفس الورقة مرتين.", "warning"); return; }
    const plan = scDiffPlan(sh, zeroIds || []);
    if (plan.error) {
      toast("اعتماد الجرد ما كملش لأن " + scMissText(plan.error) + ". الورقة سليمة والمخزون ما اتلمستش — ضيف الحساب من شاشة «الحسابات» وبعدها اعتمد.", "error");
      return;
    }
    if (!plan.rows.length) {
      toast("مافيش فرق بين «العدد المعدود» و«العدد الفعلي على البرنامج» في الورقة دي، وعليه مافيش حاجة تتعدّل.", "info");
      return;
    }
    let over = 0, under = 0;
    plan.rows.forEach((r) => { if (r.diff > 0) over++; else under++; });
    const msg = "سيتم اعتماد ورقة الجرد " + sh.no + " في مخزن («" + sh.wh + "»):\n\n" +
      "• أصناف تتسوّى: " + plan.rows.length + " (زيادة " + over + " · نقص " + under + ")\n" +
      "• قيمة الفروق بالتكلفة: " + fmt(plan.total) + " ج.م\n" +
      "• القيد: " + (plan.lines.length ? (plan.total > 0 ? "مدين «المخزون» (" + fmt(plan.total) + ") / دائن «" + (plan.diffAcc.nameAr || plan.diffAcc.code) + "»" :
        "مدين «" + (plan.diffAcc.nameAr || plan.diffAcc.code) + "» (" + fmt(Math.abs(plan.total)) + ") / دائن «المخزون»") : "مافيش قيد — الفروق متزنينة") + "\n\nهل أنت متأكد من المتابعة؟";
    if (!confirm(msg)) return;

    // ١) المخزون يتعدّل أول — بنفس أرقام الخطة اللي اتعرضت
    plan.rows.forEach((r) => {
      const p = products.find((x) => Number(x.id) === Number(r.id));
      if (!p) return;
      setStockAt(p, sh.wh, r.set);
      if (!(Number(p.weightedAvgCost) > 0)) p.weightedAvgCost = Number(p.purchasePrice) || 0;
    });
    saveProducts();
    try { renderProducts(); } catch (e) { }

    // ٢) قيد الفروق — نفس بدائل بناء 134 (تسوية سطر-سطر + refId يمنع التكرار)
    let jrnNo = "";
    if (plan.lines.length) {
      const j = {
        id: nextJournalId(),
        number: "JRN-" + String(journalEntries.length + 1).padStart(4, "0"),
        date: todayISO(),
        desc: scJrnRef() + " ورق " + sh.no + " — مخزن («" + sh.wh + "») — " + plan.rows.length + " صنف — فروق " + fmt(plan.total) + " ج.م",
        ref: scJrnRef(),
        refType: scJrnRef(),
        refId: scJrnKey(sh.no),
        debit: plan.debit,
        credit: plan.credit,
        lines: plan.lines
      };
      settleJrnLines(j.lines, 1);
      journalEntries.push(j);
      persistJournal();
      saveAccounts();
      jrnNo = j.number;
      try { renderJournal(); } catch (e) { }
    }
    sh.appliedAt = new Date().toISOString();
    sh.appliedJrn = jrnNo;
    sh.diffAcc = $("#scDiffAcc") ? String($("#scDiffAcc").value || "") : sh.diffAcc;
    scPersist();
    addActivity("اعتماد جرد بالباركود", "ورق " + sh.no + " — مخزن («" + sh.wh + "») — " + plan.rows.length + " صنف — فروق " + fmt(plan.total) + " ج.م" + (jrnNo ? " — قيد " + jrnNo : " — بلا قيد"));
    renderStockCount();
    try { renderDashboard(); } catch (e) { }
    toast("✅ اعتمدنا الجرد: " + plan.rows.length + " صنف اتسوّى في («" + sh.wh + "»)" +
      (jrnNo ? " و اتكتب القيد " + jrnNo : " (الفروق متزنينة — مافيش قيد)") + ".", "success");
  }

  /* ---- نقل الأصناف بين المخازن ---- */
  function openTransferModal() {
    fillWhSelect("#trFrom", null);
    fillTransferTarget();
    fillTransferProducts();
    $("#trQty").value = "1";
    showModal("mTransfer");
  }

  function fillTransferTarget() {
    const from = $("#trFrom").value;
    const others = WAREHOUSES.filter((w) => w !== from);
    const sel = $("#trTo");
    const prev = sel.value;
    sel.innerHTML = "";
    others.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    });
    if (prev && others.includes(prev)) sel.value = prev;
  }

  function fillTransferProducts() {
    const from = $("#trFrom").value;
    const sel = $("#trProduct");
    const prev = sel.value;
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "0";
    opt0.textContent = "-- اختر صنفاً للنقل --";
    sel.appendChild(opt0);
    products.filter((p) => p.isActive && stockAt(p, from) > 0).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = "[" + p.code + "] " + p.nameAr + " (رصيده في " + from + ": " + Number(stockAt(p, from)).toLocaleString("en-US") + " " + p.unit + ")";
      sel.appendChild(opt);
    });
    sel.value = "0";
  }

  function doStockTransfer() {
    const from = $("#trFrom").value;
    const to = $("#trTo").value;
    const pid = parseInt($("#trProduct").value, 10);
    if (!from || !to || from === to) {
      toast("اختر مخزنين مختلفين.", "warning");
      return;
    }
    const p = products.find((x) => x.id === pid);
    if (!p) {
      toast("اختر الصنف المراد نقله.", "warning");
      return;
    }
    const avail = stockAt(p, from);
    const qty = parseFloat(String($("#trQty").value).replace(/,/g, ""));
    if (!(qty > 0)) {
      toast("اكتب كمية صحيحة أكبر من صفر.", "warning");
      return;
    }
    if (qty > avail) {
      toast("الكمية المطلوبة أكبر من الرصيد المتاح في " + from + ".\nالمتاح: " + Number(avail).toLocaleString("en-US") + " " + p.unit, "warning");
      return;
    }
    if (!confirm("نقل " + qty + " " + p.unit + " من صنف («" + p.nameAr + "»)\nمن مخزن (" + from + ") إلى مخزن (" + to + ").\n\nهل أنت متأكد؟")) return;
    addStockAt(p, from, -qty);
    addStockAt(p, to, qty);
    saveProducts();
    addActivity("نقل مخزون", "نقل " + qty + " من «" + p.nameAr + "» من (" + from + ") إلى (" + to + ")");
    fillTransferProducts();
    $("#trQty").value = "1";
    fillPosDatalist();
    fillPPDatalist();
    renderProducts();
    renderSalesLookups();
    posUpdateBadge(p);
    toast("تم نقل " + qty + " " + p.unit + " من («" + p.nameAr + "») بنجاح.", "success");
  }

  /* ================== شاشة فواتير المبيعات (POS) ================== */
  let posItems = [];
  let posInitialized = false;
  let ppItems = [];
  let ppInitialized = false;

  // 🔢 ترقيم الفواتير: عدد صحيح لكل شركة يبدأ من ١ بلا حروف ولا يتكرر.
  // الأساس = أعلى رقم مستخدم فعليًا في بيانات الشركة الحالية (sales/purchases)،
  // مدموجًا مع عدّاد محفوظ في settings.invSeq (مرآته على السحابة لكل شركة عشان
  // الأجهزة المتعددة). عند الحفظ بنثبّت الرقم ونرفع الحد الأعلى للسحابة.
  function parseInvNo(r) {
    if (!r) return 0;
    const s = String(r.invoiceNumber != null ? r.invoiceNumber : (r.invoiceNo != null ? r.invoiceNo
      : (r.returnNumber != null ? r.returnNumber : (r.returnNo != null ? r.returnNo : ""))));
    const m = s.match(/\d+/g);
    if (!m || !m.length) return 0;
    // آخر مجموعة أرقام هي رقم الفاتورة (يتجاهل الأرقام داخل أي بادئة تاريخ)
    return parseInt(m[m.length - 1], 10) || 0;
  }
  function seqBase(kind) {
    const arr = (kind === "purchase" ? purchases
      : kind === "sale_return" ? saleReturns
      : kind === "purchase_return" ? purchaseReturns
      : sales) || [];
    let localMax = 0;
    arr.forEach(function (r) { const n = parseInvNo(r); if (n > localMax) localMax = n; });
    const stored = Number((settings && settings.invSeq && settings.invSeq[kind])) || 0;
    return Math.max(localMax, stored);
  }
  function commitInvoiceSeq(kind, n) {
    n = Number(n) || 0;
    if (!settings.invSeq || typeof settings.invSeq !== "object") settings.invSeq = {};
    if (n > (Number(settings.invSeq[kind]) || 0)) settings.invSeq[kind] = n;
    saveSettings();
    syncToLocalDisk();
    // مرآة الحد الأعلى على السحابة (لكل شركة) — عشان جهاز تاني ما يعيدش نفس الرقم
    if (A.online && window.CLOUD && window.CLOUD.bumpInvoiceSeq) {
      try { Promise.resolve(window.CLOUD.bumpInvoiceSeq(kind, n)).catch(function () { }); } catch (e) { }
    }
  }
  // عند الدخول: ارجع الحد الأعلى من السحابة وارفع العدّاد المحلي عليه
  function syncInvoiceSeqFromCloud() {
    if (!(A.online && window.CLOUD && window.CLOUD.getInvoiceSeq)) return;
    Promise.resolve(window.CLOUD.getInvoiceSeq()).then(function (map) {
      if (!map) return;
      if (!settings.invSeq || typeof settings.invSeq !== "object") settings.invSeq = {};
      let dirty = false;
      ["sale", "purchase", "sale_return", "purchase_return"].forEach(function (k) {
        const c = Number(map[k]) || 0;
        if (c > (Number(settings.invSeq[k]) || 0)) { settings.invSeq[k] = c; dirty = true; }
      });
      if (dirty) { saveSettings(); syncToLocalDisk(); }
    }).catch(function () { });
  }
  function nextInvoiceNumber() {
    return String(seqBase("sale") + 1);
  }
  // رقم المرتجع: تسلسل مستقل لكل نوع (بيع/شراء) على نفس عدّاد السحابة
  function nextReturnNumber(kind) {
    return String(seqBase(kind || "sale_return") + 1);
  }

  function activeDiscountPct(p) {
    const pct = Number(p.discountPercent) || 0;
    if (pct <= 0) return 0;
    if (p.discountStart && p.discountEnd) {
      const now = new Date();
      const s = new Date(p.discountStart + "T00:00:00");
      const e = new Date(p.discountEnd + "T23:59:59");
      return now >= s && now <= e ? pct : 0;
    }
    return pct;
  }

  function findProductFlexible(q) {
    const n = normalizeAr(q);
    if (!n) return null;
    return products.find((p) => normalizeAr(p.code) === n || (p.barcode && normalizeAr(p.barcode) === n))
      || products.find((p) => normalizeAr(p.code).includes(n) || normalizeAr(p.nameAr).includes(n) || (p.barcode && normalizeAr(p.barcode).includes(n)))
      || null;
  }

  function renderSalesLookups() {
    recalculateCustomerBalances();
    const custSel = $("#cmbPosCustomer");
    const prevCust = custSel.value;
    custSel.innerHTML = "";
    customers.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nameAr;
      custSel.appendChild(opt);
    });
    if (prevCust && custSel.querySelector('option[value="' + prevCust + '"]')) {
      custSel.value = prevCust;
    } else {
      posSelectDefaultCustomer();
    }

    const whSel = $("#cmbPosWarehouse");
    const prevWh = whSel.value;
    whSel.innerHTML = "";
    warehouseList().forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      whSel.appendChild(opt);
    });
    if (prevWh) whSel.value = prevWh;

    fillPosDatalist();
  }

  function fillPosDatalist() {
    const dl = $("#posProductsList");
    dl.innerHTML = "";
    products.filter((p) => p.isActive).forEach((p) => {
      [p.nameAr, p.code, p.barcode].forEach((v) => {
        if (!v) return;
        const o = document.createElement("option");
        o.value = v;
        dl.appendChild(o);
      });
    });
  }

  function posSelectDefaultCustomer() {
    const sel = $("#cmbPosCustomer");
    const def = customers.find((c) => c.code === "1") || customers.find((c) => c.id === 1) || customers.find((c) => c.protected) || customers.find((c) => (c.nameAr || "").includes("كاش") || (c.nameAr || "").includes("نقدي")) || customers[0];
    if (def) sel.value = String(def.id);
  }

  function posUpdateBadge(p) {
    const hint = $("#posStockHint");
    if (!p) {
      hint.textContent = "📦 رصيد: -";
      return;
    }
    const wh = $("#cmbPosWarehouse").value || WAREHOUSES[0];
    hint.textContent =
      "🏷️ " + p.nameAr +
      " | 📦 الرصيد في " + wh + ": " + Number(stockAt(p, wh)).toLocaleString("en-US") + " " + p.unit +
      " | 💰 سعر البيع: " + fmt(p.salePrice) + " ج.م";
  }

  /* 🔧 طلب المالك الحيّ 06/10 ≈23:20 — بحرفه: «اخر كمية … لسه موجودة معلقة في الفاتورة
     الجديدة». السبب الجذري: `posNewInvoice` كانت بتمسّح الخانات بس، و**حالة الماسح**
     (`posQtyTyped` + `lastPosScan` + نافذة الباركود + رسالة المسح + عدّاد السلسلة الباردة)
     كانت بتتصفّر في `posNewInvoiceClean` **وحدها** — بينما الحفظ («فاتورة اتسجلت وفتحت
     الجديدة») و«فتح فاتورة باسم عميل» وإقلاع الشاشة بينادوا `posNewInvoice` الخام
     ⇒ المسحة الجاية بتلاقي كمية/صنف/رسالة من الفاتورة اللي فاتت معلقة.
     الحل: **مصدر واحد** — التصفير الكامل يدخل جوه `posNewInvoice` نفسها فأي مسار
     «فاتورة جديدة» بيمسح كل أثر للماسح، والـ Clean يفضل غلاف (تصفير + فوكس). */
  function posScanStateClear() {
    lastPosScan = "";
    posQtyTyped = false;
    coldReset();
    scanHint("#posScanHint");      /* بتمسّ الرسالة وتقفل لوحة الباركود مع بعض (3156) */
  }

  function posNewInvoice() {
    posItems = [];
    $("#txtInvoiceNo").value = nextInvoiceNumber();
    $("#dtpDate").value = todayISO();
    $("#cmbPaymentMethod").value = "نقداً";
    $("#txtPosDiscount").value = "0";
    $("#txtPosSearch").value = "";
    $("#txtPosCode").value = "";
    $("#numPosQty").value = "1";
    $("#txtPosPrice").value = "";
    posScanStateClear();
    posSelectDefaultCustomer();
    posPaymentVisibility();
    posUpdateBadge(null);
    renderPosItems();
    posRecalc();
  }

  function posPaymentVisibility() {
    const m = $("#cmbPaymentMethod").value;
    const isBank = m.includes("بنكي");
    const isWallet = m.includes("محفظة") || m.includes("محافظ");
    $("#fldPosBank").hidden = !isBank;
    $("#fldPosWallet").hidden = !isWallet;
    const fill = (sel, type) => {
      const s = $(sel);
      s.innerHTML = "";
      treasury.filter((t) => t.type === type).forEach((t) => {
        const o = document.createElement("option");
        o.value = t.id;
        o.textContent = t.name;
        s.appendChild(o);
      });
    };
    if (isBank) fill("#cmbPosBank", "bank");
    if (isWallet) fill("#cmbPosWallet", "wallet");
  }

  function posOnSearch() {
    // مثل ديسك توب: بمجرد مطابقة المنتج يُملأ سعر البيع تلقائيًا من بياناته في المخزن
    const q = $("#txtPosSearch").value.trim();
    if (!q) return;
    const p = findProductFlexible(q);
    if (p) {
      posUpdateBadge(p);
      const input = $("#txtPosPrice");
      if (input) input.value = moneyStr(p.salePrice);
    }
  }

  function posOnCode() {
    const q = $("#txtPosCode").value.trim();
    if (!q) return;
    // طلب 06/10: «رقم 2 بيطلّع تليفزيون في عدد الموجود بالمخزن» ⇒ رقم ناقص مالوش مطابقة
    // حرفية **ممنوع** يقفل على صنف بالبحث الجزئي — القائمة المنسدلة تحت الخانة هي اللي
    // بتكمّله. أي كتابة فيها حروف (اسم/كود حرفي) بتفضل على المسار القديم بالحرف.
    if (scanPartialNumber(q)) { posUpdateBadge(null); return; }
    const p = findProductFlexible(q);
    if (p) {
      posUpdateBadge(p);
      const input = $("#txtPosPrice");
      if (input) input.value = moneyStr(p.salePrice);
    } else {
      posUpdateBadge(null);
    }
  }

  let posAddSource = "search";

  function posAddItem() {
    let q = $("#txtPosSearch").value.trim();
    let prod = q ? findProductFlexible(q) : null;
    if (!prod) {
      const code = $("#txtPosCode").value.trim();
      if (code) prod = findProductFlexible(code);
    }
    if (!prod) {
      toast("لم يتم العثور على صنف يطابق الاسم أو الكود المكتوب.\nيمكنك استخدام زر (➕ إضافة صنف جديد للمخزن).", "warning");
      return;
    }
    if (!prod.isActive) {
      toast("الصنف (" + prod.nameAr + ") معطل وغير متاح للبيع.", "warning");
      return;
    }
    const wh = $("#cmbPosWarehouse").value || WAREHOUSES[0];
    const availableStock = stockAt(prod, wh);
    if (!(availableStock > 0)) {
      posUpdateBadge(prod);
      toast("المنتج (" + prod.nameAr + ") غير متوفر في مخزن (" + wh + ").", "warning");
      return;
    }
    let qty = parseFloat(String($("#numPosQty").value).replace(/,/g, ""));
    if (!(qty > 0)) qty = 1;
    const alreadyInInvoice = posItems.reduce((s, it) => s + (it.productId === prod.id ? it.qty : 0), 0);
    if (qty + alreadyInInvoice > availableStock) {
      toast("الكمية المطلوبة أكبر من المتوفر في مخزن (" + wh + ").\nالمتوفر: " + Number(availableStock - alreadyInInvoice).toLocaleString("en-US") + " " + prod.unit, "warning");
      return;
    }
    let price = moneyVal("#txtPosPrice");
    if (isNaN(price) || price <= 0) {
      toast("اكتب سعر البيع المتفق عليه مع العميل في خانة «سعر البيع».", "warning");
      $("#txtPosPrice").focus();
      return;
    }

    const pct = activeDiscountPct(prod);
    const existing = posItems.find((it) => it.productId === prod.id);
    if (existing) {
      existing.qty = Math.round((existing.qty + qty) * 100) / 100;
      if (pct > 0) existing.discount = Math.round(existing.qty * existing.price * pct / 100 * 100) / 100;
    } else {
      posItems.push({
        productId: prod.id,
        code: prod.code,
        nameAr: prod.nameAr,
        unit: prod.unit,
        qty: qty,
        price: price,
        discount: pct > 0 ? Math.round(qty * price * pct / 100 * 100) / 100 : 0,
        tax: 0,
        total: 0
      });
    }
    $("#txtPosSearch").value = "";
    $("#txtPosCode").value = "";
    $("#numPosQty").value = "1";
    $("#txtPosPrice").value = "";
    /* 🔧 طلب المالك الحيّ 06/10 ≈23:20 (#217 قطعة ٢ — بحرفه: «كمان سعات الكميه الموجوده
       فى المخزن بتكون معلقه حتى بعد ما ادوس انتر»). الشارة **للمطابقة قبل الإضافة**:
       بتقول «الرصيد والسعر» عشان البائع يختار صح. أول ما السطر ينزل الجدول، الرقم
       بقى جوه السطر ⇒ الشارة لازم تمشي، وإلا تضلّ «معلّقة فوق» باسم الصنف اللي قبله.
       الرجوع لها محترم ومفاجئ: الوقوف بالمؤشر على أي سطر في الجدول بيهّطها تاني
       (`mouseenter` في `renderPosItems`)، فمافيش معلومة ضاعت — وممنوع إعادة `posUpdateBadge(prod)`. */
    posUpdateBadge(null);
    renderPosItems();
    posRecalc();
    if (posAddSource === "code") $("#txtPosCode").focus();
    else $("#txtPosSearch").focus();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     بناء 143 — المسح الضوئي في **فاتورة البيع**
     الإسكانر (1D أو 2D بيقرا المربع كمان) بيكتب الرقم في خانة «كود الصنف» ودوس Enter.
     المسار ده **بينتهي عند نفس posAddItem** اللي الكتابة اليدوية بتستخدمها — يعني
     المخزون والسعر والخصم والضمة والربط بالعميل كله من مصدر واحد (ممنوع مسارين).
     والكتابة اليدوية ما اتلمستش: لو الحروف جت بسرعة بشرية ⇒ السلوك القديم حرفيًا.
     ══════════════════════════════════════════════════════════════════════════ */
  let lastPosScan = "";

  /* ══ «المسحة تنزّل السطر على طول» — قرار المالك الحيّ 06/10 ≈22:15 (بيطال جزء 05/10) ══
     القرار القديم (05/10 ≈18:05: «لا يتم ادخال كمية 1، والمفروض انه لازم يكتب الكمية»)
     كان يقصد **ممنوع تختلق رقم**، والماكينة نفّذت ده برفض الإضافة لحد ما يكتب — وده اللي
     اشتكى منه النهارده: «مش بينزلها في الفاتورة إلا لما اكتب الكمية وأضغط انتر».
     ⇒ النشيط `posQtyTyped` لسه له نفس المعنى (المالك لمس خانة الكمية فعلًا)، بس النتيجة
     اتقلبت: **لو مكتوب كمية ⇒ تُحرم بالحرف؛ ولو مش مكتوب ⇒ المسحة = وحدة واحدة (١)**
     والسطر ينزل فورًا، وكل مسحة لنفس الصنف تزوّد نفس السطر +١.
     ⚠️ المسار اليدوي سايب زي ما هو حرفيًا: زرار ➕ وEnter بعد الكتابة بياخدوا 1 لو
     الخانة فاضية (`posAddItem`)، و`posNewInvoice` لسه بيملّي «1» زي الأول. */
  let posQtyTyped = false;
  let ppQtyTyped = false;

  /* المسح: نخلّي الخانة تحمل **الرقم القانوني** للصنف (باركوده، أو كوده لو باركود
     المصنع اتقرا بتسامح الأصفار) ⇒ posAddItem يلاقيه بالطابقة الحرفية ديغني، وبعدين
     تناديه. بعد الإضافة بنرجّع التركيز لنفس الخانة عشان المسح المتتابع يشتغل بلا clicks.
     الزنة (`scanBeep`) بتتنادى **بعد** القرار: ok = صنف اتضاف · no = مرفوض/مافيش صنف. */
  /* القياس الوحيد ل«السطر نزل»: كمية الصنف دي كام في الفاتورة دلوقتي (البيع والشراء
     بيعدّوا من نفس السطور — مش من رسالة ولا من «اسم الصنف موجود ولا لأ»، لأندها بيصدق
     على سطر قديم والإضافة الجديدة تكون اترفضت). */
  function invoiceQtyOf(list, p) {
    let s = 0;
    list.forEach((it) => { if (Number(it.productId) === Number(p.id)) s += Number(it.qty) || 0; });
    return s;
  }

  function posHandleScan(raw) {
    const res = findProductByScan(raw);
    if (!res.prod) {
      lastPosScan = res.code;
      scanBeep("no");
      posUpdateBadge(null);   // #217/٢: مافيش صنف اتعرّف ⇒ مافيش شارة تضلّ من صنف قبله
      scanHint("#posScanHint", "warn", scanFailText(res) +
        (res.why === "notfound"
          ? " <button type='button' class='scan-act' data-scan-new='1'>➕ سجّله صنف جديد</button>" : ""));
      return;
    }
    const p = res.prod;
    const wh = $("#cmbPosWarehouse").value || WAREHOUSES[0];
    const have = Number(stockAt(p, wh)) || 0;
    $("#txtPosSearch").value = "";
    $("#txtPosCode").value = bcDigits(p.barcode) || String(p.code || "");
    posAddSource = "code";
    // ⚠️ «خانة السعر» read-only من قبل 143 (مقاس على f856a4b) ⇒ اللي فيها جايبه الدليل
    // دايمًا، مش إيد المالك. فلو سبناها بقت سعر صنف **سابق** (المالك كان بيكتب اسم صنف
    // تاني في خانة الاسم ⇒ `posOnSearch` ملّى الخانة بيه) ⇒ المسح ينزل الصنف ده بثمن
    // صنف تاني على فاتورة العميل. ⇒ المسح بيمسك **سعر الصنف الممسوح** حرفيًا.
    $("#txtPosPrice").value = moneyStr(p.salePrice);
    const price = moneyVal("#txtPosPrice");
    const typed = moneyVal("#numPosQty");
    /* 🔧 طلب المالك الحيّ 06/10 ≈22:15 — بحرفه: «لما بعمل مسح للباركود مش بينزلها في
       الفاتورة إلا لما اكتب الكمية وأضغط انتر وانا قلت لك تغيرها».
     القرار الجديد: **كل مسحة = وحدة واحدة ⇒ السطر ينزل فورًا**. الخانة الفاضية أو الصفر
     بقوا «كمية ١» مش «رفض»؛ ولو المالك كاتب كمية بإيده قبل المسحة تُحرم بالحرف (ممنوع
     أي رقم مخترع). المسح لنفس الصنف تاني بيزوّد نفس السطر +١ (بيجمع `posAddItem`
     أصلًا) — وده نفس منطق الجرد بالباركود في 145 اللي اختاره المالك هناك حرفيًا.
     ⚠️ الخانة بتتقفّل على «١» قبل الإضافة في الوضع ده عشان الرسالة اللي بتقول
     «١ × السعر» تبقى **صادقة** على اللي نزل فعلاً، مش على قيمة قديمة في الخانة. */
    const autoQty = !(posQtyTyped && typed > 0);
    const qty = autoQty ? 1 : typed;
    if (autoQty) $("#numPosQty").value = "1";
    /* 🔴 كمية المالك ما تمسحش إلا لما الإضافة تنجح فعلًا (قياس حيّ ٠٦/١٠: مسحة بكمية
       أكبر من المتوفر ⇒ `posAddItem` بترفض، لكن السطور القديمة كانت بتمسح الخانة
       وتقول «اتضاف» لأن الحكم كان «الصنف موجود في الفاتورة» — وده بيصدق حتى لو السطر
       ده من مسحة قبلها). المقياس الصح: **كمية الصنف في الفاتورة زادت**. وبعد النجاح
       الخانة ترجع فاضية والنشيط يتشال، فمسحة تانية ما تضيفش بكمية الصنف اللي قبلها. */
    const qtyBefore = invoiceQtyOf(posItems, p);
    posAddItem();
    const added = invoiceQtyOf(posItems, p) > qtyBefore;
    if (added) {
      $("#numPosQty").value = "";
      posQtyTyped = false;
      scanBeep("ok");
      /* 🔧 طلب المالك الحيّ 06/10 ≈23:45 (بحرفه): «بلاش تكتب دي … والسعر الإجمالي عايزه
         واضح». ⇒ النص التعليمي («المسحة تنزّل السطر على طول…») اتشال خالص، والرسالة بقت
         **الرقم نفسه**: سعر الصنف الممسوح + إجمالي الفاتورة بعد السطر ده (من `posRecalc`
         مصدر الحساب الوحيد، فاللي في الرسالة = اللي في الفوتر حرفيًا). */
      const tot = posRecalc();
      scanHint("#posScanHint", "ok", "📷 " + esc(p.nameAr || p.code) + " — " +
        qty + " × " + fmt(price) + " = <b class='scan-line-total'>" + fmt(Math.round(qty * price * 100) / 100) + " ج.م</b>" +
        " · 🧾 إجمالي الفاتورة: <b class='scan-line-total'>" + fmt(tot.grand) + " ج.م</b>");
    } else if (!(have > 0)) {
      scanBeep("no");
      scanHint("#posScanHint", "warn", "📦 الصنف (" + esc(p.nameAr || p.code) +
        ") مافيش منه في مخزن («" + esc(wh) + "») — غيّر المخزن أو زوّد الرصيد من «المخزون».");
    } else if (!(price > 0)) {
      scanBeep("no");
      scanHint("#posScanHint", "warn", "🏷️ الصنف (" + esc(p.nameAr || p.code) +
        ") ملوش سعر بيع مسجّل — حدّدوله في «دليل الأصناف» وبعدين امسّحوه تاني.");
    } else {
      scanBeep("no");
      scanHint("#posScanHint", "warn", "📦 المتوفر من (" + esc(p.nameAr || p.code) +
        ") في («" + esc(wh) + "») = " + have + " " + esc(p.unit || "") + " — أقل من الكمية اللي طلبتها.");
    }
    /* #217/٢ — **بوابة واحدة بعد قرار التعارف**: سواء السطر نزل أو اترفض، الرسالة اللي
       فوق فيها الرقم المطلوب (الإجمالي / المتوفر / السعر)، فالشارة ما تضلّش معلّقة تحت
       الرأس باسم الصنف الممسوح. (المسار اليدوي بيمسّيها جوه `posAddItem` عند النجاح،
       و`posOnCode`/`posOnSearch` بيهّطوها تاني وقت المطابقة قبل الإضافة.) */
    posUpdateBadge(null);
  }

  // Enter في خانة الكود: إمّا إنهاء مسح (سريع) ⇒ نختار الصنف، أو إنهاء كتابة ⇒ المسار القديم
  /* 🔴 باگ حيّ مقاس 06/10 ≈23:55 (بحرفه: «المسح بيتعرّف على الأصناف وبيضيفها وبيخطّي
     في الرسالة خطأ وبيقول ادخل اسم الصنف»): الإسكانر بيرسل **Enter بعد الحروف**، وفي
     فئة من الماكينات الرقم بيوصل/ينفّذ قبل الـ Enter ⇒ النجاح بيفرّغ خانة الكود
     (`posAddItem` سطر 5545) والـ Enter بيجي على **خانة فاضية** ⇒ `posAddVia` ⇒
     `posAddItem` بتقول «لم يتم العثور على صنف يطابق الاسم أو الكود». الصنف كان نزل
     فعلًا، والرسالة كدّابة. ⇒ **الخانة الفاضية = مافيش حاجة تتنفّذ** (ممنوع رفض صامت
     للكتابة الحقيقية: أي حرف في الخانة بيمشي المسار القديم بالحرف). */
  function posCodeEnter() {
    const raw = $("#txtPosCode").value;
    if (!String(raw || "").trim()) return;
    if (scanBurstOf("txtPosCode", raw)) { posHandleScan(scanTailNorm("txtPosCode")); return; }
    posAddVia("code");
  }

  // الإسكانر بيتوّه أحيانًا على خانة الاسم — بنستقبله هناك بنفس الذكاء
  function posSearchEnter() {
    const raw = $("#txtPosSearch").value;
    if (!String(raw || "").trim()) return;   // نفس باب الفاتورة فوق: الخانة فاضية ⇒ Enter مالوش موضوع
    if (scanBurstOf("txtPosSearch", raw)) { posHandleScan(scanTailNorm("txtPosSearch")); return; }
    posAddVia("search");
  }

  function posAddVia(src) {
    posAddSource = src;
    posAddItem();
    // الإضافة اليدوية خلّت الخانة «1» مكتوبة بالـ JS ⇒ النشيط يتشال، والمسح الجاي
    // يطلب كمية من المالك (ممنوع مسحة تضيف بـ 1 ما حدش كتبها)
    posQtyTyped = false;
    scanHint("#posScanHint");
  }

  function posNewInvoiceClean() {
    posNewInvoice();
    lastPosScan = "";
    posQtyTyped = false;
    coldReset();
    scanHint("#posScanHint");
    $("#txtPosCode").focus();
  }

  /* زرار «📷 مسح» في **رأس فاتورة البيع** (طلب 05/10 ≈18:05: «عايز زرار لتشغيل الماسح
     اللى بيقرا الباركود بجانب راس الفاتورة»): الماكينات بتكتب في الخانة المركّزة عليها،
     فالزرار وظيفته **تجهيز** الخانة (فوكس + تحديد) ورسالة تدلّ على الخطوة — **مافيش أي
     كتابة في البيانات ولا أي إضافة**. نفس `barcodeFieldArm` بتاعة نافذة الصنف بالحرف. */
  function posScanArm() {
    const el = $("#txtPosCode");
    if (!el) return;
    el.focus();
    el.select();
    scanCamToggle("txtPosCode");
    camArmHint("#posScanHint", "txtPosCode");
  }

  // نفس الزرار في رأس فاتورة الشراء
  function ppScanArm() {
    const el = $("#txtPPCode");
    if (!el) return;
    el.focus();
    el.select();
    scanCamToggle("txtPPCode");
    camArmHint("#ppScanHint", "txtPPCode");
  }

  /* ══ المسح «بلا زرار» (تفسير لنفس طلب الزرار، قاله المالك 05/10 ≈20:40 بحرفه:
     «حتى لو البائع او المشترى لم يضغط عليه فمجرد ان قارئ الباركود يقرا صنف يضيفه ايضا
     حتى لو لم يضغط على زرار القارى») ═════════════════════════════════════════════════
     الإسكانر لوحة-مفاتيح: بيرمي حروفه على اللي عليه Focus. لو Focus على جسم الصفحة أو
     زرار أو جدول (البائع ما دوسش على أي خانة) ⇒ الحروف كانت بتضيع والماكينة تبان مكسورة.
     الطبقة دي بتلتقط من `document` في مرحلة الالتقاط **وتوجّه لنفس الدالة القديمة**
     (`posHandleScan` / `ppHandleScan`) ⇒ مافيش مسار تاني للمسح، ونفس قاعدة الكمية
     الجديدة (المسحة تنزّل السطر فورًا: الكمية اللي البائع كاتبها، أو ١ لو مافيش)
     ونفس الرسائل والزنة.
     تنحّي الطبقة (كل شرط مقاس، أي واحدة false ⇒ مافيش أي تدخل في الكيبورد):
       (١) شاشة البيع أو الشراء هي الظاهرة (`showView` بتسيب `v.hidden = v.dataset.id !== name`)
       (٢) مافيش نافذة مفتوحة (`.modal-overlay` بلا `hidden`) — النافذة ليها خانتها ومسارها
       (٣) اللي عليه Focus مش خانة بيكتب فيها البائع حالًا (كود/اسم ⇒ مستمعها القديم شغال)
       (٤) السلسلة سريعة فعلًا (`scanKey("cold")` + `scanIsBurst`) ⇒ الصابع البشري ما يتسرقش
     والإسكانرات اللي ما ترسلش Enter بتتوجه بعد صمت `COLD_SCAN_QUIET_MS` — البائع ما يستناشش. */
  const COLD_SCAN_VIEWS = [["viewSales", "pos"], ["viewPurchases", "pp"], ["viewStockCount", "sc"]];
  const COLD_SCAN_QUIET_MS = 400;
  /* 🔴 درس القياس الحيّ (كيبورد حقيقي على الحزمة المنشورة، ٠٦/١٠): البائع اللي بيكتب
     الكمية بإيده على النمرات بيسبق الإسكانر في نفس الخانة — فـ «السلسلة السريعة» لوحدها
     ما تفرّقش: «١٢٠٠» بسرعة الصابع بتبقى ٤ حروف بفواصل < ٩٠ms. ⇒ في الوضع الرجّاع
     ("type" = خانة كمية/سعر بيكتب فيها المالك) لازم الرقم يبقى **بطول باركود** قبل ما
     يتحوّل لمسحة. باركودات EAN-8 وUPC وEAN-13 كلها ≥ ٨ خانات، فما فيكمش كمية ولا سعر
     حقيقي يتكتب ٨ خانات بسرعة ٩٠ms ويضيع. */
  const COLD_SCAN_TYPE_MIN = 8;
  // الحروف اللي ماكينة الباركود بترميها (أرقام لاتينية/عربية + حرف + شرطة + نقطة + مسافة)
  const COLD_SCAN_CHR = /^[0-9A-Za-z٠-٩۰-۹\-.\s]$/;
  /* الخانات اللي البائع بيكتب فيها وبعدها بيمرّر الماسح وهو لسه واقف عليها ⇒ رقم الإسكانر
     بيوقع فيها. نتعامل معاتها بالحرف زي خانة الاسم: سيّب الحروف تعدى (عشان لو كان صابع
    فضل زي ما هو)، ولو اتأكد إنه إسكانر **ارجّع الخانة لقيمتها قبل السلسلة** ووجّه الرقم. */
  const COLD_SCAN_REVERT = ["numPosQty", "numPPQty", "txtPPPrice", "numScQty"];
  let coldBuf = "";
  let coldMode = null;      // "type" (خانة رجّاعة) | "capture" (مافيش كتابة)
  let coldEl = null;
  let coldBase = "";
  let coldQuiet = null;

  function coldModalOpen() {
    const list = document.querySelectorAll(".modal-overlay");
    for (let i = 0; i < list.length; i++) { if (!list[i].hidden) return true; }
    return false;
  }

  // "pos" | "pp" | null — الفاتورة الظاهرة دلوقتي
  function coldInvoice() {
    if (coldModalOpen()) return null;
    for (let i = 0; i < COLD_SCAN_VIEWS.length; i++) {
      const el = document.getElementById(COLD_SCAN_VIEWS[i][0]);
      if (el && !el.hidden) return COLD_SCAN_VIEWS[i][1];
    }
    return null;
  }

  /* null ⇒ البائع بيكتب حالًا (ما نلمشش كتابته) · "type" ⇒ خانة رقم بس نرجّعها ·
     "capture" ⇒ مافيش تركيز على كتابة ⇒ نمنع الحروف تضيع وتنفّذ أي زرار عليها */
  function coldFocusMode() {
    const el = document.activeElement;
    if (!el) return "capture";
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || el.isContentEditable === true) {
      if (el.readOnly || el.disabled) return "capture";
      if (COLD_SCAN_REVERT.indexOf(el.id) >= 0) return "type";
      return null;
    }
    return "capture";
  }

  /* «ده إسكانر» مقاس من نفس الختم الزمني — بس بنطاق حسب الوضع:
       capture ⇒ `SCAN_MIN_LEN` (مافيش كتابة أصلًا، فأي سلسلة سريعة مسحة)
       type    ⇒ `COLD_SCAN_TYPE_MIN` (الخانة دي البائع بيكتب فيها رقمه بإيده)
     `scanIsBurst` دالة قراءة صرفة (ممنوع إسناد/`Date.now` فيها — مقاس في الحارس). */
  function coldBurstOf(mode, raw) {
    const n = scanClean(raw).length;
    if (n < SCAN_MIN_LEN) return false;
    if (mode === "type" && n < COLD_SCAN_TYPE_MIN) return false;
    return scanLooksCode(scanClean(raw)) && scanIsBurst("cold", n);
  }

  function coldReset() {
    coldBuf = ""; coldMode = null; coldEl = null; coldBase = "";
    if (coldQuiet) { clearTimeout(coldQuiet); coldQuiet = null; }
    scanTraceClear("cold");
  }

  function coldArmQuiet() {
    if (coldQuiet) clearTimeout(coldQuiet);
    coldQuiet = setTimeout(coldFlush, COLD_SCAN_QUIET_MS);
  }

  /* التوجيه — مصدر واحد لكل لحظتين (Enter والصمت): يتأكد إنه إسكانر، ينضّف الخانة لو
     اتوهّط عليها، وبعدين ينادي **نفس** دالة المسح القديمة بحرفيتها. */
  function coldFlush() {
    if (coldQuiet) { clearTimeout(coldQuiet); coldQuiet = null; }
    const all = coldBuf, mode = coldMode, el = coldEl, typed = coldBase, inv = coldInvoice();
    /* 🔴 الفاصل بين «رقم البائع» و«مسحة الإسكانر» — من **نفس مصدر القرار**، بس في آخر لحظة.
       البائع بيكتب الكمية بإيده (١٦٠ms+) وبعدها بيمرّر الماسح على طول قبل ما عدّاد الصمت
       ٤٠٠ms يخلص ⇒ الوعاء بيقعّ الرقمين فوق بعض: "2" + ١٣ خانة ⇒ «ملقتش صنف بالرقم
       22000000000015» (مقاس حيًّا ٠٦/١٠ في ص-٣ب البيع و ص-٦ج الشراء).
       `scanKey("cold")` بيعدّي السلسلة السريعة بكل حرف (بنفس `SCAN_MAX_GAP_MS` اللي
       `scanIsBurst` بيفرّق بيها) ⇒ «طول آخر سلسلة» حرفيًا = كام حرف من الوعاء جايين من
       الماكينة. اللي قبلهم صابع ⇒ بيفضلوا في الخانة (أساس جديد = المكتوب + المتسيّب)
       وما يدخلوش الرقم. ممنوع ساعة تانية أو عتبة تانية — وممنوع قصّ في نص المسحة:
       السلسلة القصيرة (`< SCAN_MIN_LEN`) ما بتتقصّش خالص. */
    const run = Math.min(all.length, (scanTrace.cold || {}).streak || 0);
    const raw = run >= SCAN_MIN_LEN && run < all.length ? all.slice(all.length - run) : all;
    const base = typed + all.slice(0, all.length - raw.length);
    const isScan = raw !== "" && coldBurstOf(mode, raw);
    coldReset();
    if (!isScan || !inv) return;                       // صابع بطيئة أو شاشة تانية ⇒ مافيش أثر
    const code = scanClean(raw);
    if (!code) return;
    if (mode === "type" && el) {
      el.value = base;                                  // رقم الإسكانر ما ينفعش يبقى كمية/سعر
      if (el.id === "numPosQty") posQtyTyped = base !== "";
      else if (el.id === "numPPQty") ppQtyTyped = base !== "";
    }
    if (inv === "pos") posHandleScan(code);
    else if (inv === "sc") scHandleScan(code);
    else ppHandleScan(code);
  }

  function coldScanKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;     // أي اختصار حقيقي مالوش دعوى بالمسح
    const k = e.key;
    /* 🔴 باگ حيّ مقاس 07/10 (بحرفه: «لما بكتب صنف فى الفاتوره بتطلع الرساله دى» +
       `TypeError: Cannot read properties of undefined (reading 'length') coldScanKey`):
       في ماكينات/لوحات (سكانرات وطرق إدخال) بترسل `keydown` **بلا `key` خالص** (بلا `keyCode`
       بس، أو حدث مولّد من طبقة إدخال) ⇒ السطر اللي بيقرا `k.length` كان بيرمي TypeError
       على شاشة البائع. الطبقة دي تعنيها **الحروف المقروءة بس** (مسحة الباركود)، فأي حدث
       مالوش سلسلة حروف = مش مسح ⇒ سيّبه يعدي لمسار الخانة القديم بلا أي تدخل (ممنوع رفض
       صامت للكتابة الحقيقية: أي حرف فعلي بيمشي زي الأول بالحرف). */
    if (typeof k !== "string" || !k) return;
    const inv = coldInvoice();
    if (!inv) { if (coldBuf) coldReset(); return; }     // بره الفاتورتين ⇒ الكيبورد صاحبه زي الأول
    if (k === "Enter") {
      if (!coldBuf) return;                             // مافيش رقم عندنا ⇒ ما نلغيش Enter حد تاني
      /* 🔴 درس القياس الحيّ (٠٦/١٠): البائع بيكتب الكمية بإيده في «الكمية» وبعدها بدوس
         Enter على طول — والقديم كان بياكل الـ Enter دايمًا طالما عنده حرف واحد، فالسطر
         ما بيتضافش والمهمّة تنصف. ⇒ الـ Enter بيتبلّع **لما تكون السلسلة إسكانر فعلًا**
         (`coldBurstOf`)؛ غير كده دي كتابة المالك وراحت لمسار الخانة القديم بلا أي تدخل. */
      if (!coldBurstOf(coldMode, coldBuf)) { coldReset(); return; }
      e.preventDefault(); e.stopPropagation();
      coldFlush();
      return;
    }
    if (k === "Tab" || k === "Escape" || k === "Backspace") { if (coldBuf) coldReset(); return; }
    if (k.length !== 1 || !COLD_SCAN_CHR.test(k)) return;
    const mode = coldFocusMode();
    if (!mode) return;
    if (!coldBuf) {
      coldMode = mode;
      coldEl = document.activeElement;
      coldBase = coldEl && typeof coldEl.value === "string" ? coldEl.value : "";
    }
    if (mode === "capture") { e.preventDefault(); e.stopPropagation(); }
    coldBuf += k;
    scanKey("cold", e);
    coldArmQuiet();
  }

  /* رقم باركود اتقرا وما كانش ليها صنف ⇒ النافذة تفتح **والخانة مملّأة بيه**، فالمالك
     يكتب الاسم والسعر بس (طلبه 05/10: «محتاج عند ادخال الاصناف فى المخزن انه يدينى
     امكانية مسح ضوئى لباركود المصنع»). */
  function openProductDialogForScan(raw) {
    const code = scanClean(raw);
    openProductDialog(null);
    if (code) {
      scanBeep("new");   // «صنف جديد» — الرقم اتعرّف عليه ومالوش صاحب في الدليل
      $("#fPBarcode").value = code;
      renderBarcodePreview();
      bcScanHint("ok", "📷 باركود المصنع " + scanMsg(code) +
        " اتحط في الخانة — اكتب اسم الصنف وسعّره ودوس «حفظ الصنف».");
    }
    $("#fPNameAr").focus();
  }

  function posCalcRow(idx) {
    const it = posItems[idx];
    const sub = Math.max(it.qty * it.price - it.discount, 0);
    it.tax = TAX.enabled ? Math.round(sub * TAX.rate * 100) / 100 : 0;
    it.total = Math.round((sub + it.tax) * 100) / 100;
  }

  function posRecalc() {
    let sub = 0, tax = 0;
    posItems.forEach((it, i) => {
      posCalcRow(i);
      sub += it.qty * it.price - it.discount;
      tax += it.tax;
    });
    sub = Math.round(sub * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const extra = parseFloat(String($("#txtPosDiscount").value).replace(/,/g, "")) || 0;
    let grand = Math.round((sub + tax - extra) * 100) / 100;
    if (grand < 0) grand = 0;
    const pct = getTaxPercent();
    $("#lblPosSubTotal").textContent = (TAX.enabled ? "المجموع: " : "الإجمالي: ") + fmt(sub) + " ج.م";
    $("#lblPosTax").textContent = TAX.enabled ? ("ضريبة المبيعات (" + pct + "%): " + fmt(tax) + " ج.م") : "";
    $("#lblPosTax").style.display = TAX.enabled ? "" : "none";
    $("#lblPosTax").hidden = !TAX.enabled;
    $("#lblPosTotal").textContent = (TAX.enabled ? "الصافي النهائي: " : "الصافي: ") + fmt(grand) + " ج.م";
    return { sub: sub, tax: tax, extra: extra, grand: grand };
  }

  function renderPosItems() {
    const tbody = $("#dgvItems tbody");
    tbody.innerHTML = "";
    posItems.forEach((it, i) => {
      posCalcRow(i);
      const tr = document.createElement("tr");
      tr.dataset.idx = i;
      tr.innerHTML =
        '<td>' + esc(it.code) + '</td>' +
        '<td style="text-align:right">' + esc(it.nameAr) + '</td>' +
        '<td>' + esc(lineUnitText(it)) + '</td>' +
        '<td><input class="cell-input" data-f="qty" type="text" value="' + esc(it.qty) + '" /></td>' +
        '<td class="c-fixed">' + fmt(it.price) + '</td>' +
        '<td><input class="cell-input" data-f="discount" type="text" value="' + fmt(it.discount) + '" /></td>' +
        '<td class="c-tax' + (TAX.enabled ? '' : ' tax-hidden') + '"' + (TAX.enabled ? '' : ' style="display:none"') + '>' + fmt(it.tax) + '</td>' +
        '<td class="c-total">' + fmt(it.total) + '</td>' +
        '<td class="cell-actions"><button class="btn small red" type="button" data-f="del">❌</button></td>';
      tr.addEventListener("mouseenter", () => posUpdateBadge(products.find((p) => Number(p.id) === Number(it.productId)) || null));
      tbody.appendChild(tr);
    });
  }

  function savePosInvoice() {
    if (posItems.length === 0) {
      toast("يرجى إضافة أصناف إلى الفاتورة أولاً.", "warning");
      return;
    }
    const methods = ["نقداً", "آجل", "تحويل بنكي", "محافظ إلكترونية"];
    const payment = methods[$("#cmbPaymentMethod").selectedIndex] || "نقداً";
    const custId = parseInt($("#cmbPosCustomer").value, 10);
    const cust = customers.find((c) => c.id === custId);
    if (!cust) {
      toast("يرجى اختيار العميل.", "warning");
      return;
    }
    if (payment === "آجل" && cust.protected) {
      toast("الرجاء اختيار عميل حقيقي للبيع الآجل (لا يمكن ترحيلها للعميل النقدي).", "warning");
      return;
    }
    const warehouse = $("#cmbPosWarehouse").value;
    if (!warehouse) {
      toast("يرجى اختيار المستودع.", "warning");
      return;
    }

    const shortages = posItems
      .map((it) => {
        const p = products.find((x) => Number(x.id) === Number(it.productId));
        const avail = p ? stockAt(p, warehouse) : 0;
        return p && avail >= it.qty ? null : it.nameAr + " (المتاح: " + Number(avail).toLocaleString("en-US") + ")";
      })
      .filter(Boolean);
    if (shortages.length > 0) {
      toast("لا يوجد رصيد كافٍ للأصناف التالية:\n" + shortages.join("\n"), "warning");
      return;
    }

    const t = posRecalc();
    const invNo = $("#txtInvoiceNo").value || nextInvoiceNumber();
    const invDate = $("#dtpDate").value || todayISO();
    const invoice = {
      id: sales.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      invoiceNumber: invNo,
      invoiceNo: invNo,
      invoiceDate: invDate,
      date: invDate,
      customerId: cust.id,
      customerName: cust.nameAr,
      customer: cust.nameAr,
      warehouse: warehouse,
      store: warehouse,
      paymentMethod: payment,
      treasuryId: null,
      discountAmount: t.extra,
      discount: t.extra,
      taxAmount: t.tax,
      tax: t.tax,
      subTotal: t.sub,
      grandTotal: t.grand,
      items: posItems.map((it, idx) => ({
        id: idx + 1,
        productId: it.productId,
        code: it.code,
        nameAr: it.nameAr,
        unit: lineUnit(it),          // 🆕 الوحدة بتتحل من الصنف لو السطر فاضي — بتُخزن على الفاتورة نفسها
        qty: it.qty,
        price: it.price,
        discount: it.discount,
        tax: it.tax,
        total: it.total
      })),
      status: "posted"
    };

    let paidTreasury = null;               // 🆕 بناء 134: الحساب اللي القبض دخل فيه (للقيد لو كان آجل = null)

    if (payment === "آجل") {
      cust.currentBalance = Math.round(((cust.currentBalance || 0) + t.grand) * 100) / 100;
      txs.push({
        id: nextTxId(),
        customerId: cust.id,
        date: invoice.invoiceDate,
        desc: "فاتورة مبيعات آجلة رقم " + invoice.invoiceNumber,
        debit: t.grand,
        credit: 0
      });
      recalculateCustomerBalances();
      saveCustomers();
      saveTxs();
    } else {
      const isBank = payment === "تحويل بنكي" || payment.includes("بنك");
      const isWallet = payment === "محافظ إلكترونية" || payment.includes("محفظ");
      const type = isBank ? "bank" : isWallet ? "wallet" : "cash";
      let selId = null;
      if (isBank) {
        selId = parseInt($("#cmbPosBank").value, 10);
      } else if (isWallet) {
        selId = parseInt($("#cmbPosWallet").value, 10);
      }
      const tr = (selId && treasury.find((x) => x.id === selId))
        || treasury.find((x) => x.type === type)
        || treasury.find((x) => x.type === "cash")
        || treasury[0];
      if (tr) {
        tr.balance = Math.round(((tr.balance || 0) + t.grand) * 100) / 100;
        invoice.treasuryId = tr.id;
        paidTreasury = tr;                 // 🆕 بناء 134: الطرف المقابل في القيد هو نفس الحساب اللي القبض دخل فيه
        saveTreasury();
        syncTreasuryItemToSett(tr);
      }
    }

    posItems.forEach((it) => {
      const p = products.find((x) => Number(x.id) === Number(it.productId));
      if (p) addStockAt(p, warehouse, -it.qty);
    });
    saveProducts();

    sales.push(invoice);
    saveSales();
    commitInvoiceSeq("sale", parseInvNo(invoice));
    // 🆕 بناء 134: الفاتورة تترحّل أوتوماتيك للقيود اليومية (قيد متزن، بلا سند — انظر رأس القسم)
    const postedJ = postInvoiceJournal("sale", invoice, paidTreasury);
    addActivity("فاتورة مبيعات", "فاتورة " + invoice.invoiceNumber + " - " + cust.nameAr + " - " + fmt(t.grand) + " ج.م (" + payment + ")" +
      (postedJ && postedJ.j ? " - قيد " + postedJ.j.number : ""));

    toast("تم حفظ وتأكيد فاتورة المبيعات بنجاح برقم (" + invoice.invoiceNumber + ")" +
      (postedJ && postedJ.j ? " وترحيلها للقيود (" + postedJ.j.number + ")" : "") + ".", "success");
    printInvoice(invoice);
    fillPosDatalist();
    posNewInvoice();
  }

  function printInvoice(inv) {
    $("#invNoPrint").textContent = inv.invoiceNumber;
    $("#invDatePrint").textContent = inv.invoiceDate;
    $("#invCustPrint").textContent = inv.customerName;
    $("#invWhPrint").textContent = inv.warehouse;
    $("#invPayPrint").textContent = inv.paymentMethod;
    const hasTax = (inv.taxAmount > 0) || (TAX.enabled && TAX.rate > 0);
    const thTax = $("#thPrintTax");
    if (thTax) thTax.style.display = hasTax ? "" : "none";
    const tb = $("#invBodyPrint");
    tb.innerHTML = "";
    inv.items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(it.code) + '</td>' +
        '<td style="text-align:right">' + esc(it.nameAr) + returnedBadge(true, inv.id, it) + '</td>' +
        '<td>' + esc(lineUnitText(it)) + '</td>' +
        '<td>' + esc(Number(it.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(it.price) + '</td>' +
        '<td>' + fmt(it.discount) + '</td>' +
        (hasTax ? ('<td>' + fmt(it.tax) + '</td>') : '') +
        '<td>' + fmt(it.total) + '</td>';
      tb.appendChild(tr);
    });
    fillInvoiceOrgHead("inv");
    const nt = $("#invNotesPrint");
    if (nt) nt.innerHTML = invNotesHtml(true);
    $("#invFootPrint").innerHTML = invTotalsHtml(invTotalRows(true, inv));
    printSection($("#invoicePage"));
  }

  function openSalesForCustomer(cust) {
    showView("sales");
    posNewInvoice();
    $("#cmbPosCustomer").value = String(cust.id);
    toast("تم فتح فاتورة مبيعات جديدة باسم العميل (" + cust.nameAr + ").", "info");
  }

  /* ---- إضافة سريعة: صنف ---- */
  function openQuickProduct() {
    fillCatSelect("#qCat", null);
    fillUnitSelect("#qUnit", null);
    $("#qCode").value = nextProductCode();
    $("#qCode").disabled = true;
    $("#qName").value = "";
    $("#qQty").value = "10";
    $("#qCost").value = "100";
    $("#qSale").value = "150";
    $("#qDisc").value = "0";
    showModal("mQuickProduct");
    $("#qName").focus();
  }

  function saveQuickProduct() {
    const nameAr = $("#qName").value.trim();
    if (!nameAr) {
      toast("اسم الصنف مطلوب.", "warning");
      return;
    }
    const purchase = moneyVal("#qCost") || 0;
    const sale = moneyVal("#qSale") || 0;
    const qty = moneyVal("#qQty") || 0;
    const disc = moneyVal("#qDisc") || 0;
    const p = {
      id: nextProductId(),
      code: nextProductCode(),
      barcode: "",
      nameAr: nameAr,
      nameEn: "",
      category: $("#qCat").value,
      unit: $("#qUnit").value,
      defaultWarehouse: $("#cmbPosWarehouse").value || WAREHOUSES[0],
      purchasePrice: purchase,
      weightedAvgCost: purchase,
      salePrice: sale,
      discountPercent: disc,
      discountStart: "",
      discountEnd: "",
      stock: { [($("#cmbPosWarehouse").value || WAREHOUSES[0])]: qty },
      qty: qty,
      reorder: 50,
      isActive: true
    };
    // 🔳 بناء 139: الإضافة السريعة من شاشة البيع كمان تاخد رقم باركود (الفراغ بس، وبلا تكرار)
    let bcAssigned = true;
    if (!p.barcode) {
      const cand = internalBarcode(p.id);
      if (cand && !barcodeConflictOf(cand, p.id)) p.barcode = cand;
      else bcAssigned = false;
    }
    products.push(p);
    saveProducts();
    addActivity("إضافة صنف", "إضافة صنف سريع من شاشة المبيعات: " + p.nameAr + " (" + p.code + ")");
    hideModal("mQuickProduct");
    fillPosDatalist();
    fillPPDatalist();
    $("#txtPosSearch").value = p.nameAr;
    $("#txtPosPrice").value = moneyStr(p.salePrice);
    posUpdateBadge(p);
    toast("تم حفظ الصنف (" + p.nameAr + ") برصيد " + qty + " في المخزن." +
      (bcAssigned ? "" : " ملوش باركود — اكتب رقمًا من «تعديل الصنف»."), "success");
  }

  /* ---- إضافة سريعة: عميل ---- */
  function openQuickCustomer() {
    $("#qCCode").value = nextCustomerCode();
    prefetchNextCode("customer", "qCCode");
    $("#qCName").value = "";
    $("#qCPhone").value = "";
    $("#qCWallet").value = "";
    showModal("mQuickCustomer");
    $("#qCName").focus();
  }

  function saveQuickCustomer() {
    const nameAr = $("#qCName").value.trim();
    if (!nameAr) {
      toast("اسم العميل مطلوب.", "warning");
      return;
    }
    const c = {
      id: nextCustomerId(),
      code: $("#qCCode").value.trim(),
      nameAr: nameAr,
      phone: $("#qCPhone").value.trim(),
      secondaryPhone: "",
      walletPhone: $("#qCWallet").value.trim(),
      address: "",
      notes: "",
      openingBalance: 0,
      currentBalance: 0,
      protected: false
    };
    customers.push(c);
    saveCustomers();
    addActivity("إضافة عميل", "إضافة عميل سريع من شاشة المبيعات: " + c.nameAr + " (" + c.code + ")");
    hideModal("mQuickCustomer");
    renderSalesLookups();
    $("#cmbPosCustomer").value = String(c.id);
    toast("تمت إضافة العميل (" + c.nameAr + ") وتحديده في الفاتورة.", "success");
  }

  /* ================== فواتير المشتريات (التوريد) ================== */
  function nextPurchaseInvoiceNumber() {
    return String(seqBase("purchase") + 1);
  }

  function renderPurchasesLookups() {
    const supSel = $("#cmbPosSupplier");
    const prevSup = supSel.value;
    supSel.innerHTML = "";
    suppliers.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nameAr;
      supSel.appendChild(opt);
    });
    if (prevSup && supSel.querySelector('option[value="' + prevSup + '"]')) {
      supSel.value = prevSup;
    } else {
      ppSelectDefaultSupplier();
    }

    const whSel = $("#cmbPPWarehouse");
    const prevWh = whSel.value;
    whSel.innerHTML = "";
    warehouseList().forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      whSel.appendChild(opt);
    });
    if (prevWh && whSel.querySelector('option[value="' + prevWh + '"]')) whSel.value = prevWh;

    fillPPDatalist();
  }

  function fillPPDatalist() {
    const dl = $("#ppProductsList");
    dl.innerHTML = "";
    products.filter((p) => p.isActive).forEach((p) => {
      [p.nameAr, p.code, p.barcode].forEach((v) => {
        if (!v) return;
        const o = document.createElement("option");
        o.value = v;
        dl.appendChild(o);
      });
    });
  }

  function ppSelectDefaultSupplier() {
    const sel = $("#cmbPosSupplier");
    const def = suppliers.find((s) => s.code === "1") || suppliers.find((s) => s.id === 1) || suppliers.find((s) => s.protected) || suppliers.find((s) => (s.nameAr || "").includes("كاش") || (s.nameAr || "").includes("نقدي")) || suppliers[0];
    if (def) sel.value = String(def.id);
  }

  function ppUpdateBadge(p) {
    const hint = $("#ppStockHint");
    if (!p) {
      hint.textContent = "📦 رصيد: -";
      return;
    }
    const wh = $("#cmbPPWarehouse").value || WAREHOUSES[0];
    hint.textContent =
      "🏷️ " + p.nameAr +
      " | 📦 الرصيد في " + wh + ": " + Number(stockAt(p, wh)).toLocaleString("en-US") + " " + p.unit +
      " | 💰 سعر الشراء: " + fmt(p.purchasePrice) + " ج.م";
  }

  /* نفس مصدر التصفير الوحيد في فاتورة الشراء (انظر `posScanStateClear` فوق). */
  function ppScanStateClear() {
    lastPpScan = "";
    ppQtyTyped = false;
    coldReset();
    scanHint("#ppScanHint");
  }

  function ppNewInvoice() {
    ppItems = [];
    $("#txtPInvNo").value = nextPurchaseInvoiceNumber();
    $("#dtpPDate").value = todayISO();
    $("#cmbPPaymentMethod").value = "نقداً";
    $("#txtPPDiscount").value = "0";
    $("#txtPPSearch").value = "";
    $("#txtPPCode").value = "";
    $("#numPPQty").value = "1";
    $("#txtPPPrice").value = "";
    ppScanStateClear();
    ppSelectDefaultSupplier();
    ppPaymentVisibility();
    ppUpdateBadge(null);
    renderPPItems();
    ppRecalc();
  }

  function ppPaymentVisibility() {
    const m = $("#cmbPPaymentMethod").value;
    const isBank = m.includes("بنكي");
    const isWallet = m.includes("محفظة") || m.includes("محافظ");
    $("#fldPPBank").hidden = !isBank;
    $("#fldPPWallet").hidden = !isWallet;
    const fill = (sel, type) => {
      const s = $(sel);
      s.innerHTML = "";
      treasury.filter((t) => t.type === type).forEach((t) => {
        const o = document.createElement("option");
        o.value = t.id;
        o.textContent = t.name;
        s.appendChild(o);
      });
    };
    if (isBank) fill("#cmbPPBank", "bank");
    if (isWallet) fill("#cmbPPWallet", "wallet");
  }

  function ppOnSearch() {
    const q = $("#txtPPSearch").value.trim();
    if (!q) return;
    const p = findProductFlexible(q);
    if (p) {
      ppUpdateBadge(p);
    }
  }

  function ppOnCode() {
    const q = $("#txtPPCode").value.trim();
    if (!q) return;
    // نفس قرار البيع بالحرف: رقم ناقص ⇒ القائمة المنسدلة بتكمّله، مش القفل على صنف بالبحث الجزئي
    if (scanPartialNumber(q)) { ppUpdateBadge(null); return; }
    const p = findProductFlexible(q);
    if (p) {
      ppUpdateBadge(p);
    } else {
      ppUpdateBadge(null);
    }
  }

  let ppAddSource = "search";

  function ppAddItem() {
    let q = $("#txtPPSearch").value.trim();
    let prod = q ? findProductFlexible(q) : null;
    if (!prod) {
      const code = $("#txtPPCode").value.trim();
      if (code) prod = findProductFlexible(code);
    }
    if (!prod) {
      toast("لم يتم العثور على صنف يطابق الاسم أو الكود المكتوب.\nيمكنك استخدام زر (➕ إضافة صنف جديد للمخزن).", "warning");
      return;
    }
    if (!prod.isActive) {
      toast("الصنف (" + prod.nameAr + ") معطل وغير متاح للتوريد.", "warning");
      return;
    }
    let qty = parseFloat(String($("#numPPQty").value).replace(/,/g, ""));
    if (!(qty > 0)) qty = 1;
    let price = parseFloat(String($("#txtPPPrice").value).replace(/,/g, ""));
    if (!(price > 0)) {
      price = Number(prod.purchasePrice) || 0;
    }
    if (!(price > 0)) {
      toast("اكتب سعر الشراء في خانة (سعر الشراء) قبل إضافة الصنف.", "warning");
      return;
    }

    const existing = ppItems.find((it) => it.productId === prod.id);
    if (existing) {
      existing.qty = Math.round((existing.qty + qty) * 100) / 100;
    } else {
      ppItems.push({
        productId: prod.id,
        code: prod.code,
        nameAr: prod.nameAr,
        unit: prod.unit,
        qty: qty,
        price: price,
        discount: 0,
        tax: 0,
        total: 0
      });
    }
    $("#txtPPSearch").value = "";
    $("#txtPPCode").value = "";
    $("#numPPQty").value = "1";
    $("#txtPPPrice").value = "";
    ppUpdateBadge(null);   // #217/٢ — نفس باب البيع: السطر نزل ⇒ الشارة تمشي (الوقوف على السطر يهّطها)
    renderPPItems();
    ppRecalc();
    if (ppAddSource === "code") $("#txtPPCode").focus();
    else $("#txtPPSearch").focus();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     بناء 143 — المسح الضوئي في **فاتورة الشراء** (نفس منطق البيع، بالاسم التاني)
     طلب المالك: المسح في «فاتورة البيع والشراء» — والتعديل الحرفي بتاعه: الكتابة
     اليدوية تفضل متاحة («ممكن ميكونش له باركود أو ممكن يكون البائع ليس لديه ماكينة»).
     ══════════════════════════════════════════════════════════════════════════ */
  let lastPpScan = "";

  function ppHandleScan(raw) {
    const res = findProductByScan(raw);
    if (!res.prod) {
      lastPpScan = res.code;
      scanBeep("no");
      ppUpdateBadge(null);   // #217/٢: مافيش صنف اتعرّف ⇒ مافيش شارة تضلّ من صنف قبله
      scanHint("#ppScanHint", "warn", scanFailText(res) +
        (res.why === "notfound"
          ? " <button type='button' class='scan-act' data-scan-new='1'>➕ سجّله صنف جديد</button>" : ""));
      return;
    }
    const p = res.prod;
    $("#txtPPSearch").value = "";
    $("#txtPPCode").value = bcDigits(p.barcode) || String(p.code || "");
    ppAddSource = "code";
    // ⚠️ **الفرق المقصود عن البيع** (مقاس على الأساس f856a4b، مش تخمين): خانة «سعر البيع»
    // `readonly` ⇒ اللي فيها من الدليل، فالبيع بيمسك سعر الصنف الممسوح دايمًا. أما
    // «سعر الشراء» **مفتوحة للمالك بإيده** و`ppOnCode` ما تلمسهاش خالص ⇒ أي رقم فيها
    // قرار منه ⇒ المسح يحترمه، وملء الدليل بس لما تكون فاضية (`ppAddItem` كمان بيقبلها).
    if (!(moneyVal("#txtPPPrice") > 0)) $("#txtPPPrice").value = moneyStr(p.purchasePrice);
    const price = moneyVal("#txtPPPrice");
    const typed = moneyVal("#numPPQty");
    /* 🔧 نفس طلب المالك الحيّ (06/10 ≈22:15) ونفس القرار بالحرف في الشراء:
       **كل مسحة = وحدة واحدة ⇒ السطر ينزل فورًا**، والكتابة اليدوية تُحرم بالحرف،
       والمسحة الجاي بتزوّد نفس السطر. الخانة بتتقفّل على «١» في الوضع الآلي عشان
       الرسالة تقول العدد اللي نزل فعلًا. */
    const autoQty = !(ppQtyTyped && typed > 0);
    const qty = autoQty ? 1 : typed;
    if (autoQty) $("#numPPQty").value = "1";
    // نفس قياس البيع بالحرف: كمية المالك ما تتمسحش إلا لو السطر نزل فعلًا (٠٦/١٠)
    const qtyBefore = invoiceQtyOf(ppItems, p);
    ppAddItem();
    const added = invoiceQtyOf(ppItems, p) > qtyBefore;
    if (added) {
      $("#numPPQty").value = "";
      ppQtyTyped = false;
      scanBeep("ok");
      /* 🔧 نفس طلب المالك الحيّ 06/10 ≈23:45 في البيع (بحرفه: «بلاش تكتب دي … والسعر
         الإجمالي عايزه واضح») — والشراء نفس الباب بنفس الرسالة: **الرقم نفسه** بدل النص
         التعليمي، والإجمالي من `ppRecalc` مصدر الحساب الوحيد. */
      const tot = ppRecalc();
      scanHint("#ppScanHint", "ok", "📷 " + esc(p.nameAr || p.code) + " — " +
        qty + " × " + fmt(price) + " = <b class='scan-line-total'>" + fmt(Math.round(qty * price * 100) / 100) + " ج.م</b>" +
        " · 🧾 إجمالي فاتورة الشراء: <b class='scan-line-total'>" + fmt(tot.grand) + " ج.م</b>");
    } else if (!(price > 0)) {
      scanBeep("no");
      scanHint("#ppScanHint", "warn", "🏷️ الصنف (" + esc(p.nameAr || p.code) +
        ") ملوش سعر شراء مسجّل — حدّدوله في «دليل الأصناف» أو اكتب السعر في خانة «سعر الشراء».");
    } else {
      scanBeep("no");
      scanHint("#ppScanHint", "warn", "⚠️ (" + esc(p.nameAr || p.code) +
        ") ما اتضافش — شوف الرسالة اللي فوق وكمّل.");
    }
    ppUpdateBadge(null);   // #217/٢ — بوابة واحدة بعد قرار التعارف: الشارة ما تضلّش معلّقة
  }

  function ppCodeEnter() {
    const raw = $("#txtPPCode").value;
    if (!String(raw || "").trim()) return;   // نفس باب البيع: Enter على خانة فاضية = مافيش موضوع
    if (scanBurstOf("txtPPCode", raw)) { ppHandleScan(scanTailNorm("txtPPCode")); return; }
    ppAddVia("code");
  }

  function ppSearchEnter() {
    const raw = $("#txtPPSearch").value;
    if (!String(raw || "").trim()) return;
    if (scanBurstOf("txtPPSearch", raw)) { ppHandleScan(scanTailNorm("txtPPSearch")); return; }
    ppAddVia("search");
  }

  function ppAddVia(src) {
    ppAddSource = src;
    ppAddItem();
    // نفس سطر البيع بالحرف: الإضافة اليدوية خلّت «1» مكتوبة بالـ JS ⇒ النشيط يتشال،
    // والمسح الجاي يطلب كمية من المالك (ممنوع مسحة تضيف بـ 1 ما حدش كتبها)
    ppQtyTyped = false;
    scanHint("#ppScanHint");
  }

  function ppNewInvoiceClean() {
    ppNewInvoice();
    lastPpScan = "";
    ppQtyTyped = false;
    coldReset();
    scanHint("#ppScanHint");
    $("#txtPPCode").focus();
  }

  function ppCalcRow(idx) {
    const it = ppItems[idx];
    const sub = Math.max(it.qty * it.price - it.discount, 0);
    it.tax = TAX.enabled ? Math.round(sub * TAX.rate * 100) / 100 : 0;
    it.total = Math.round((sub + it.tax) * 100) / 100;
  }

  function ppRecalc() {
    let sub = 0, tax = 0;
    ppItems.forEach((it, i) => {
      ppCalcRow(i);
      sub += it.qty * it.price - it.discount;
      tax += it.tax;
    });
    sub = Math.round(sub * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const extra = parseFloat(String($("#txtPPDiscount").value).replace(/,/g, "")) || 0;
    let grand = Math.round((sub + tax - extra) * 100) / 100;
    if (grand < 0) grand = 0;
    const pct = getTaxPercent();
    $("#lblPPSubTotal").textContent = (TAX.enabled ? "المجموع: " : "الإجمالي: ") + fmt(sub) + " ج.م";
    $("#lblPPTax").textContent = TAX.enabled ? ("ضريبة المبيعات (" + pct + "%): " + fmt(tax) + " ج.م") : "";
    $("#lblPPTax").style.display = TAX.enabled ? "" : "none";
    $("#lblPPTax").hidden = !TAX.enabled;
    $("#lblPPTotal").textContent = (TAX.enabled ? "الصافي النهائي: " : "الصافي: ") + fmt(grand) + " ج.م";
    return { sub: sub, tax: tax, extra: extra, grand: grand };
  }

  function renderPPItems() {
    const tbody = $("#dgvPItems tbody");
    tbody.innerHTML = "";
    ppItems.forEach((it, i) => {
      ppCalcRow(i);
      const tr = document.createElement("tr");
      tr.dataset.idx = i;
      tr.innerHTML =
        '<td>' + esc(it.code) + '</td>' +
        '<td style="text-align:right">' + esc(it.nameAr) + '</td>' +
        '<td>' + esc(lineUnitText(it)) + '</td>' +
        '<td><input class="cell-input" data-f="qty" type="text" value="' + esc(it.qty) + '" /></td>' +
        '<td><input class="cell-input" data-f="price" type="text" value="' + fmt(it.price) + '" /></td>' +
        '<td><input class="cell-input" data-f="discount" type="text" value="' + fmt(it.discount) + '" /></td>' +
        '<td class="c-tax' + (TAX.enabled ? '' : ' tax-hidden') + '"' + (TAX.enabled ? '' : ' style="display:none"') + '>' + fmt(it.tax) + '</td>' +
        '<td class="c-total">' + fmt(it.total) + '</td>' +
        '<td class="cell-actions"><button class="btn small red" type="button" data-f="del">❌</button></td>';
      tr.addEventListener("mouseenter", () => ppUpdateBadge(products.find((p) => Number(p.id) === Number(it.productId)) || null));
      tbody.appendChild(tr);
    });
  }

  function savePurchaseInvoice() {
    if (ppItems.length === 0) {
      toast("يرجى إضافة أصناف إلى الفاتورة أولاً.", "warning");
      return;
    }
    const methods = ["نقداً", "آجل", "تحويل بنكي", "محافظ إلكترونية"];
    const payment = methods[$("#cmbPPaymentMethod").selectedIndex] || "نقداً";
    const supId = parseInt($("#cmbPosSupplier").value, 10);
    const supplier = suppliers.find((s) => s.id === supId);
    if (!supplier) {
      toast("يرجى اختيار المورد.", "warning");
      return;
    }
    if (payment === "آجل" && supplier.protected) {
      toast("الرجاء اختيار مورد حقيقي للشراء الآجل (لا يمكن ترحيلها للمورد النقدي).", "warning");
      return;
    }
    const warehouse = $("#cmbPPWarehouse").value;
    if (!warehouse) {
      toast("يرجى اختيار المستودع.", "warning");
      return;
    }

    const t = ppRecalc();
    const invNo = $("#txtPInvNo").value || nextPurchaseInvoiceNumber();
    const invDate = $("#dtpPDate").value || todayISO();
    const invoice = {
      id: purchases.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      invoiceNumber: invNo,
      invoiceNo: invNo,
      invoiceDate: invDate,
      date: invDate,
      supplierId: supplier.id,
      supplierName: supplier.nameAr,
      supplier: supplier.nameAr,
      warehouse: warehouse,
      store: warehouse,
      paymentMethod: payment,
      treasuryId: null,
      discountAmount: t.extra,
      discount: t.extra,
      taxAmount: t.tax,
      tax: t.tax,
      subTotal: t.sub,
      grandTotal: t.grand,
      items: ppItems.map((it, idx) => ({
        id: idx + 1,
        productId: it.productId,
        code: it.code,
        nameAr: it.nameAr,
        unit: lineUnit(it),          // 🆕 الوحدة تتحل من الصنف لو السطر فاضي — بتُخزن على الفاتورة نفسها
        qty: it.qty,
        price: it.price,
        discount: it.discount,
        tax: it.tax,
        total: it.total
      })),
      status: "posted"
    };

    let paidTreasury = null;               // 🆕 بناء 134: الحساب اللي الصرف خرج منه (للقيد لو آجل = null)

    if (payment === "آجل") {
      supplier.currentBalance = Math.round(((supplier.currentBalance || 0) + t.grand) * 100) / 100;
      supplierTxs.push({
        id: supplierTxs.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
        supplierId: supplier.id,
        date: invoice.invoiceDate,
        desc: "فاتورة مشتريات آجلة رقم " + invoice.invoiceNumber,
        debit: t.grand,
        credit: 0
      });
      recalculateSupplierBalances();
      saveSuppliers();
      saveSupplierTxs();
    } else {
      const isBank = payment === "تحويل بنكي" || payment.includes("بنك");
      const isWallet = payment === "محافظ إلكترونية" || payment.includes("محفظ");
      const type = isBank ? "bank" : isWallet ? "wallet" : "cash";
      let selId = null;
      if (isBank) {
        selId = parseInt($("#cmbPPBank").value, 10);
      } else if (isWallet) {
        selId = parseInt($("#cmbPPWallet").value, 10);
      }
      const tr = (selId && treasury.find((x) => x.id === selId))
        || treasury.find((x) => x.type === type)
        || treasury.find((x) => x.type === "cash")
        || treasury[0];
      if (tr) {
        tr.balance = Math.round(((tr.balance || 0) - t.grand) * 100) / 100;
        invoice.treasuryId = tr.id;
        paidTreasury = tr;                 // 🆕 بناء 134: الطرف المقابل في القيد = نفس حساب الصرف
        saveTreasury();
        syncTreasuryItemToSett(tr);
      }
    }

    ppItems.forEach((it) => {
      const p = products.find((x) => Number(x.id) === Number(it.productId));
      if (!p) return;
      const oldQty = Number(p.qty) || 0;
      const oldCost = Number(p.weightedAvgCost) || 0;
      const newQty = oldQty + it.qty;
      p.weightedAvgCost = Math.round(((oldCost * oldQty) + (it.price * it.qty)) / newQty * 100) / 100;
      addStockAt(p, warehouse, it.qty);
      p.purchasePrice = it.price;
    });
    saveProducts();

    purchases.push(invoice);
    savePurchases();
    commitInvoiceSeq("purchase", parseInvNo(invoice));
    // 🆕 بناء 134: فاتورة المشتريات تترحّل أوتوماتيك للقيود (مخزون + ضريبة مقابل الحساب/المورد)
    const postedJ = postInvoiceJournal("purchase", invoice, paidTreasury);
    addActivity("فاتورة مشتريات", "فاتورة " + invoice.invoiceNumber + " - " + supplier.nameAr + " - " + fmt(t.grand) + " ج.م (" + payment + ")" +
      (postedJ && postedJ.j ? " - قيد " + postedJ.j.number : ""));

    toast("تم حفظ وتأكيد فاتورة المشتريات بنجاح برقم (" + invoice.invoiceNumber + ")" +
      (postedJ && postedJ.j ? " وترحيلها للقيود (" + postedJ.j.number + ")" : "") + ".", "success");
    printPurchaseInvoice(invoice);
    fillPPDatalist();
    ppNewInvoice();
  }

  function printPurchaseInvoice(inv) {
    $("#ppInvNo").textContent = inv.invoiceNumber;
    $("#ppDate").textContent = inv.invoiceDate;
    $("#ppSuppPrint").textContent = inv.supplierName;
    $("#ppWhPrint").textContent = inv.warehouse;
    $("#ppPayPrint").textContent = inv.paymentMethod;
    const hasTax = (inv.taxAmount > 0) || (TAX.enabled && TAX.rate > 0);
    const thTax = $("#thPPPrintTax");
    if (thTax) thTax.style.display = hasTax ? "" : "none";
    const tb = $("#ppBody");
    tb.innerHTML = "";
    inv.items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(it.code) + '</td>' +
        '<td style="text-align:right">' + esc(it.nameAr) + returnedBadge(false, inv.id, it) + '</td>' +
        '<td>' + esc(lineUnitText(it)) + '</td>' +
        '<td>' + esc(Number(it.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(it.price) + '</td>' +
        '<td>' + fmt(it.discount) + '</td>' +
        (hasTax ? ('<td>' + fmt(it.tax) + '</td>') : '') +
        '<td>' + fmt(it.total) + '</td>';
      tb.appendChild(tr);
    });
    fillInvoiceOrgHead("pp");
    const pnt = $("#ppNotesPrint");
    if (pnt) pnt.innerHTML = invNotesHtml(false);
    $("#ppFoot").innerHTML = invTotalsHtml(invTotalRows(false, inv));
    printSection($("#purchasePage"));
  }

  /* ---- إضافة سريعة: مورد ---- */
  function openQuickSupplier() {
    $("#qSCode").value = nextSupplierCode();
    prefetchNextCode("supplier", "qSCode");
    $("#qSName").value = "";
    $("#qSPhone").value = "";
    $("#qSWallet").value = "";
    showModal("mQuickSupplier");
    $("#qSName").focus();
  }

  function saveQuickSupplier() {
    const nameAr = $("#qSName").value.trim();
    if (!nameAr) {
      toast("اسم المورد مطلوب.", "warning");
      return;
    }
    const s = {
      id: nextSupplierId(),
      code: $("#qSCode").value.trim(),
      nameAr: nameAr,
      phone: $("#qSPhone").value.trim(),
      walletPhone: $("#qSWallet").value.trim(),
      address: "",
      notes: "",
      openingBalance: 0,
      currentBalance: 0,
      protected: false
    };
    suppliers.push(s);
    saveSuppliers();
    addActivity("إضافة مورد", "إضافة مورد سريع من شاشة المشتريات: " + s.nameAr + " (" + s.code + ")");
    hideModal("mQuickSupplier");
    renderPurchasesLookups();
    $("#cmbPosSupplier").value = String(s.id);
    toast("تمت إضافة المورد (" + s.nameAr + ") وتحديده في الفاتورة.", "success");
  }

  /* ================== أدوات عامة ================== */
  function downloadCSV(filename, rows) {
    const csv = rows.map((r) => r.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printStatementDoc(opts) {
    $("#stmName").textContent = opts.name;
    $("#stmCode").textContent = opts.code;
    $("#stmRange").textContent = opts.range;
    const bal = $("#stmBal");
    bal.textContent = fmt(opts.balance);
    bal.className = opts.balance > 0 ? "balance-debit" : "balance-credit";
    const tb = $("#stmBody");
    tb.innerHTML = "";
    if (!opts.rows || opts.rows.length === 0) {
      tb.innerHTML = '<tr><td colspan="5">لا توجد حركات على هذا الحساب.</td></tr>';
    } else {
      opts.rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + esc(r.date) + '</td>' +
          '<td style="text-align:right">' + esc(r.desc) + '</td>' +
          '<td>' + (r.debit ? fmt(r.debit) : "-") + '</td>' +
          '<td>' + (r.credit ? fmt(r.credit) : "-") + '</td>' +
          '<td class="' + (r.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(r.balance) + '</td>';
        tb.appendChild(tr);
      });
    }
    printSection($("#statementPage"));
  }

  /* ================== دليل الموردين ================== */
  let suppEditingId = null;
  let actionsSupp = null;
  let paySuppPreselected = null;

  function renderSuppliers() {
    const tbody = $("#dgvSuppliers tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtSupplierSearch").value);
    suppliers
      .filter((s) => !s.protected && s.code !== "1" && s.id !== 1 && !(s.nameAr && s.nameAr.includes("المورد النقدي")))
      .filter((s) => {
        if (!q) return true;
        return (
          normalizeAr(s.code).includes(q) ||
          normalizeAr(s.nameAr).includes(q) ||
          normalizeAr(s.phone).includes(q) ||
          normalizeAr(s.walletPhone).includes(q) ||
          normalizeAr(s.address).includes(q) ||
          normalizeAr(s.notes).includes(q) ||
          fmt(s.currentBalance).includes(q)
        );
      })
      .forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(s.code) + '</td>' +
          '<td>' + esc(s.nameAr) + '</td>' +
          '<td>' + esc(s.phone || "-") + '</td>' +
          '<td>' + esc(s.walletPhone || "-") + '</td>' +
          '<td title="' + esc(s.address || "") + '">' + esc(s.address || "-") + '</td>' +
          '<td class="' + (s.currentBalance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(s.currentBalance) + ' ج.م</td>';
        tr.dataset.sid = s.id;
        tr.addEventListener("dblclick", () => openSuppActions(s));
        tr.addEventListener("click", () => {
          document.querySelectorAll("#dgvSuppliers tbody tr").forEach((r) => r.classList.remove("sel"));
          tr.classList.add("sel");
        });
        tbody.appendChild(tr);
      });
  }

  function openSuppAddEdit(supplier) {
    suppEditingId = supplier ? supplier.id : null;
    $("#suppAddEditTitle").textContent = supplier ? "✏️ تعديل بيانات المورد" : "إضافة مورد جديد";
    $("#fSCode").value = supplier ? supplier.code : nextSupplierCode();
    if (!supplier) prefetchNextCode("supplier", "fSCode");
    $("#fSName").value = supplier ? supplier.nameAr : "";
    $("#fSPhone").value = supplier ? (supplier.phone || "") : "";
    $("#fSWallet").value = supplier ? (supplier.walletPhone || "") : "";
    $("#fSAddress").value = supplier ? (supplier.address || "") : "";
    $("#fSNotes").value = supplier ? (supplier.notes || "") : "";
    $("#fSOpening").value = supplier ? moneyStr(supplier.openingBalance || 0) : "0";
    showModal("mSuppAddEdit");
    $("#fSName").focus();
  }

  function saveSupplier() {
    const name = $("#fSName").value.trim();
    if (!name) {
      toast("اسم المورد مطلوب.", "warning");
      return;
    }
    if (suppEditingId) {
      const s = suppliers.find((x) => x.id === suppEditingId);
      s.code = $("#fSCode").value.trim();
      s.nameAr = name;
      s.phone = $("#fSPhone").value.trim();
      s.walletPhone = $("#fSWallet").value.trim();
      s.address = $("#fSAddress").value.trim();
      s.notes = $("#fSNotes").value.trim();
      s.openingBalance = moneyVal("#fSOpening") || 0;
      saveSuppliers();
      addActivity("تعديل مورد", "تعديل بيانات المورد: " + s.nameAr);
      toast("تم حفظ التعديلات بنجاح.", "success");
    } else {
      const opening = moneyVal("#fSOpening") || 0;
      const s = {
        id: nextSupplierId(),
        code: $("#fSCode").value.trim() || nextSupplierCode(),
        nameAr: name,
        phone: $("#fSPhone").value.trim(),
        walletPhone: $("#fSWallet").value.trim(),
        address: $("#fSAddress").value.trim(),
        notes: $("#fSNotes").value.trim(),
        openingBalance: opening,
        currentBalance: opening,
        protected: false
      };
      suppliers.push(s);
      if (opening > 0) {
        supplierTxs.push({ id: supplierTxs.reduce((m, x) => Math.max(m, x.id), 0) + 1, supplierId: s.id, date: todayISO(), desc: "رصيد افتتاحي (مستحق للمورد)", debit: opening, credit: 0 });
        saveSupplierTxs();
      }
      saveSuppliers();
      addActivity("إضافة مورد", "إضافة مورد جديد: " + s.nameAr + " (" + s.code + ")");
      toast("تمت إضافة المورد بنجاح.", "success");
    }
    hideModal("mSuppAddEdit");
    renderSuppliers();
  }

  function getSupplierStatement(sup) {
    // 🔁 بناء 108: سطر توضيحي لمرتجعات المشتريات اللي اتسلّمت فلوسها (رد من الخزينة)
    const memoRows = purchaseReturns
      .filter((r) => r.settlement === "refund" && Number(r.supplierId) === Number(sup.id))
      .map((r) => ({
        date: retDateOf(r),
        desc: "↩️ مرتجع مشتريات رقم " + retNo(r) + " — استلام نقدية بقيمة " + fmt(r.grandTotal) + " ج.م",
        debit: 0, credit: 0
      }));
    const rows = supplierTxs
      .filter((t) => Number(t.supplierId) === Number(sup.id))
      .concat(memoRows)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let run = (parseFloat(sup.openingBalance) || 0);
    return rows.map((t) => {
      run = Math.round((run + t.debit - t.credit) * 100) / 100;
      // 🔁 بناء 119: نفس كشف العميل — id + وسيلة الدفع عشان سطر «الدفع النقدي» يتحذف
      return { date: t.date, desc: t.desc, debit: t.debit, credit: t.credit, balance: run,
        id: t.id == null ? null : t.id, paymentMethod: t.paymentMethod || "",
        treasuryId: t.treasuryId == null ? null : t.treasuryId };
    });
  }

  function openSuppActions(s) {
    actionsSupp = s;
    $("#sactTitle").textContent = "📦 إدارة المورد: " + s.nameAr + " (" + s.code + ")";
    const canS105 = canManageDocs();
    $("#sactDocScan").hidden = !canS105; $("#sactDocPick").hidden = !canS105; $("#sactDocList").hidden = !canS105;
    $("#sactName").textContent = "📦 المورد: " + s.nameAr;
    $("#sactDetails1").textContent = "الكود: " + s.code + " | الهاتف: " + (s.phone || "-");
    $("#sactDetails2").textContent = "العنوان: " + (s.address || "-") + " | ملاحظات: " + (s.notes || "-");
    const bal = $("#sactBalance");
    bal.textContent = "الرصيد الحالي (المستحق): " + fmt(s.currentBalance) + " ج.م";
    bal.className = "act-bal " + (s.currentBalance > 0 ? "balance-debit" : "balance-credit");
    const isCash = s.protected || s.code === "1" || s.id === 1;
    const btnDel = $("#sactDelete");
    if (btnDel) {
      btnDel.disabled = isCash;
      btnDel.title = isCash ? "لا يمكن حذف المورد النقدي (كاش) - محمي بالنظام" : "";
      btnDel.style.opacity = isCash ? "0.4" : "1";
      btnDel.style.cursor = isCash ? "not-allowed" : "pointer";
    }
    showModal("mSuppActions");
  }

  function openSupplierStatement(s) {
    statementCtx = { type: "supplier", obj: s };
    resetStmFilter(); // 🆕 مهمة 96: كل كشف يفتح بفلتر نظيف (بالكامل)
    $("#stmTitle").textContent = "📋 كشف حساب تفصيلي: " + s.nameAr;
    refreshStatementView(); // 🆕 مهمة 96: رندر مشترك بين العميل والمورد مع احترام فلتر الفترة
    showModal("mStatement");
  }

  function printSupplierStatement(s) {
    printStatementDoc({
      name: s.nameAr,
      code: s.code,
      range: stmPeriodLabel(), // 🆕 مهمة 96: الفترة على الورقة = الفلتر الفعلي
      balance: s.currentBalance,
      rows: stmVisibleRows(getSupplierStatement(s)) // 🆕 مهمة 96: الطباعة تحترم فلتر الفترة
    });
  }

  function openPaySuppDebt(supplier) {
    paySuppPreselected = supplier || null;
    const sel = $("#psSupplier");
    sel.innerHTML = "";
    suppliers
      .filter((s) => !s.protected && s.code !== "1" && s.id !== 1 && !(s.nameAr && s.nameAr.includes("المورد النقدي")))
      .forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.nameAr + " (المستحق: " + fmt(s.currentBalance) + " ج.م)";
        sel.appendChild(opt);
      });
    if (paySuppPreselected) sel.value = String(paySuppPreselected.id);
    $("#psMethod").value = "نقداً 💵";
    $("#psAmount").value = "";
    $("#psNotes").value = "سداد دفعة نقداً من حساب المورد";
    applyTreasuryFilterSupp();
    showModal("mPaySuppDebt");
  }

  function applyTreasuryFilterSupp() {
    const method = $("#psMethod").value;
    const type = method.includes("بنكي") ? "bank" : method.includes("محفظة") ? "wallet" : "cash";
    const sel = $("#psTreasury");
    sel.innerHTML = "";
    treasury.filter((t) => t.type === type).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
  }

  function savePaySupplement() {
    const sid = parseInt($("#psSupplier").value, 10);
    if (!sid) {
      toast("يرجى اختيار المورد.", "warning");
      return;
    }
    const amount = moneyVal("#psAmount");
    if (!(amount > 0)) {
      toast("يرجى كتابة مبلغ صحيح أكبر من الصفر.", "warning");
      return;
    }
    const supp = suppliers.find((s) => s.id === sid);
    supp.currentBalance = Math.round((supp.currentBalance - amount) * 100) / 100;
    const trId = parseInt($("#psTreasury").value, 10);
    const tr = treasury.find((x) => x.id === trId);
    if (tr) {
      tr.balance = Math.round((tr.balance - amount) * 100) / 100;
      saveTreasury();
      syncTreasuryItemToSett(tr);
    }
    const txId = supplierTxs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    supplierTxs.push({
      id: txId,
      supplierId: sid,
      treasuryId: tr ? tr.id : (trId || null),
      paymentMethod: $("#psMethod").value,
      date: todayISO(),
      desc: $("#psNotes").value.trim() || "سداد مستحقات مورد",
      debit: 0,
      credit: amount
    });
    vouchers.push({
      id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      type: "out",
      treasuryId: tr ? tr.id : trId,
      date: todayISO(),
      amount: amount,
      desc: "سداد لمورد: " + (supp ? supp.nameAr : "") + " (" + ($("#psNotes").value.trim() || "سداد مستحقات") + ")",
      refType: "supplier_tx",
      refId: txId
    });
    saveSuppliers();
    saveSupplierTxs();
    saveVouchers();
    hideModal("mPaySuppDebt");
    addActivity("سداد مورد", "سداد مستحقات " + supp.nameAr + " بمبلغ " + fmt(amount) + " ج.م" + (tr ? " من " + tr.name : ""));
    toast("تم تسجيل السداد بنجاح وتحديث رصيد الحساب.", "success");
    renderSuppliers();
    if (typeof renderTreasury === "function") renderTreasury();
    if (typeof renderTreMoves === "function") renderTreMoves();
  }

  /* ================== استعلام عن الفواتير ================== */
  // صلاحية حذف الفواتير: حساب صاحب الشركة + حساب مالك البرنامج (سوبر أدمن) فقط —
  // الحسابات الفرعية للأعضاء ما بيشفوش الزرار ولا يقدروا يستدعوا الحذف.
  function canDeleteInvoices() { return isCompanyOwnerAcct() || isSuperAcct(); }

  function renderInvoiceQuery() {
    const fromS = $("#dtpFromS").value || "2000-01-01";
    const toS = $("#dtpToS").value || "2999-12-31";
    const fromP = $("#dtpFromP").value || "2000-01-01";
    const toP = $("#dtpToP").value || "2999-12-31";
    const canDel = canDeleteInvoices();
    const canRet = canManageReturns();

    const inRange = (d, from, to) => (d || "") >= from && (d || "") <= to;

    const fill = (tbody, list, isSales) => {
      tbody.innerHTML = "";
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7">لا توجد فواتير في هذه الفترة.</td></tr>';
        return;
      }
      list.forEach((inv) => {
        const hasRet = invoiceHasReturns(isSales, inv);
        const allRet = hasRet && invoiceAllReturned(isSales, inv);
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(inv.invoiceNumber || inv.invoiceNo || "-") +
          (hasRet ? (' <span class="ret-tag' + (allRet ? ' ret-tag-done' : '') + '">↩️ مرتجع' + (allRet ? " كامل" : "") + '</span>') : '') + '</td>' +
          '<td>' + esc(inv.invoiceDate || inv.date || "-") + '</td>' +
          '<td>' + esc(isSales ? (inv.customerName || inv.customer || "-") : (inv.supplierName || inv.supplier || "-")) + '</td>' +
          '<td>' + fmt(inv.grandTotal) + ' ج.م</td>' +
          '<td>' + esc(inv.paymentMethod) + '</td>' +
          '<td class="cell-actions"><button class="btn small sky" type="button" data-act="print">🖨️ طباعة</button>' +
          (canRet && !allRet ? ' <button class="btn small green" type="button" data-act="ret">🔁 مرتجع</button>' : '') +
          (canDel ? ' <button class="btn small red" type="button" data-act="del">🗑️ حذف</button>' : '') + '</td>';
        tr.dataset.iid = inv.id;
        tr.dataset.typ = isSales ? "s" : "p";
        tbody.appendChild(tr);
      });
    };

    const qs = normalizeAr($("#txtSearchInvS").value);
    const qp = normalizeAr($("#txtSearchInvP").value);
    const match = (inv, q, name) => {
      if (!q) return true;
      return normalizeAr(inv.invoiceNumber).includes(q) || normalizeAr(name).includes(q) || normalizeAr(inv.paymentMethod).includes(q) || fmt(inv.grandTotal).includes(q);
    };

    fill($("#dgvInvS tbody"), sales.filter((i) => inRange(i.invoiceDate || i.date, fromS, toS)).filter((i) => match(i, qs, i.customerName || i.customer)), true);
    fill($("#dgvInvP tbody"), purchases.filter((i) => inRange(i.invoiceDate || i.date, fromP, toP)).filter((i) => match(i, qp, i.supplierName || i.supplier)), false);
  }

  // حذف فاتورة (بيع/شراء) بتراجع كامل: المخزون + أثر الدفع (خزينة أو أرصدة وقيود) + السطر نفسه.
  // مسموح لحساب صاحب الشركة وللمالك (سوبر أدمن) فقط — فحص ثانٍ جوه الدالة حتى لو استُدّت من غير الزرار.
  function deleteInvoiceQuery(inv, isSales) {
    if (!canDeleteInvoices()) { toast("صلاحية حذف الفواتير لصاحب الشركة ومالك البرنامج فقط.", "error"); return; }
    if (!inv) return;
    // 🔁 الفاتورة اللي عليها مرتجعات محمية: المرتجع مستند مستقل لازم يتلغى الأول (بناء 108)
    if (invoiceHasReturns(isSales, inv)) {
      toast("الفاتورة دي عليها مرتجعات مسجّلة في تبويب «🔁 المرتجعات» — احذف المرتجع أولًا، وبعدها تقدر تحذف الفاتورة.", "warning");
      return;
    }
    const kind = isSales ? "مبيعات" : "مشتريات";
    const who = isSales ? (inv.customerName || inv.customer || "-") : (inv.supplierName || inv.supplier || "-");
    const wh = inv.warehouse || inv.store || "";
    const items = inv.items || [];
    // حذف فاتورة شراء بيرجع كميتها من المخزن — ممنوع لو المخزن هيطلع أقل من صفر
    if (!isSales) {
      const negs = items.filter((it) => {
        const p = products.find((x) => Number(x.id) === Number(it.productId));
        return p && stockAt(p, wh) - (Number(it.qty) || 0) < 0;
      });
      if (negs.length) {
        toast("لا يمكن حذف الفاتورة: المخزن أقل من كميات أصنافها (" + negs.map((n) => n.nameAr).join("، ") + ") — سجّل مرتجع عليها أولًا.", "warning");
        return;
      }
    }
    const num = String(inv.invoiceNumber || inv.invoiceNo || "-");
    const amt = Math.round((Number(inv.grandTotal) || 0) * 100) / 100;
    if (!confirm("متأكد إنك عايز تحذف فاتورة الـ" + kind + " رقم (" + num + ") الخاصة بـ " + who + " بمبلغ " + fmt(amt) + " ج.م؟\n\nالحذف بيتراجع عن كل أثرها: الأصناف للمخزن، وأثر الدفع (الخزينة أو الرصيد وقيده). الخطوة دي ما ينفعش الرجوع عليها بعد التنفيذ.")
    ) {
      toast("تم الإلغاء — الفاتورة كما هي.", "warning");
      return;
    }
    // 1) المخزون: فاتورة بيع → الكميات ترجع، فاتورة شراء → الكميات تتنقص
    items.forEach((it) => {
      const p = products.find((x) => Number(x.id) === Number(it.productId));
      if (p) addStockAt(p, wh, isSales ? (Number(it.qty) || 0) : -(Number(it.qty) || 0));
    });
    saveProducts();
    // 2) الأثر المالي
    const pm = String(inv.paymentMethod || "");
    if (pm === "آجل") {
      if (isSales) {
        for (let i = txs.length - 1; i >= 0; i--) {
          const t = txs[i];
          if (t && Number(t.customerId) === Number(inv.customerId)
            && Math.round((Number(t.debit) || 0) * 100) / 100 === amt
            && String(t.desc || "").includes("فاتورة مبيعات آجلة")
            && String(t.desc || "").includes(num)) { txs.splice(i, 1); break; }
        }
        recalculateCustomerBalances();
        saveCustomers();
        saveTxs();
      } else {
        for (let i = supplierTxs.length - 1; i >= 0; i--) {
          const t = supplierTxs[i];
          if (t && Number(t.supplierId) === Number(inv.supplierId)
            && Math.round((Number(t.debit) || 0) * 100) / 100 === amt
            && String(t.desc || "").includes("فاتورة مشتريات آجلة")
            && String(t.desc || "").includes(num)) { supplierTxs.splice(i, 1); break; }
        }
        recalculateSupplierBalances();
        saveSuppliers();
        saveSupplierTxs();
      }
    } else {
      // نقدي/بنك/محفظة: انعكاس حركة الخزينة اللي اتسجلت بيها الفاتورة
      let tr = treasury.find((x) => x.id === inv.treasuryId);
      if (!tr) {
        const isBank = pm.includes("بنك") || pm.includes("تحويل");
        const isWallet = pm.includes("محفظ");
        const type = isBank ? "bank" : isWallet ? "wallet" : "cash";
        tr = treasury.find((x) => x.type === type) || treasury.find((x) => x.type === "cash") || treasury[0];
      }
      if (tr) {
        tr.balance = Math.round(((tr.balance || 0) + (isSales ? -amt : amt)) * 100) / 100;
        saveTreasury();
        syncTreasuryItemToSett(tr);
      }
    }
    // 🆕 بناء 134: القيد اللي اتترحّل مع الفاتورة بيرجع معاه (تسوية الأرصدة بتلغى سطر-سطر)
    const goneJ = removeInvoiceJournal(isSales ? "sale" : "purchase", inv);
    // 3) حذف الفاتورة نفسها + سجل النشاط + تحديث الاستعلام
    if (isSales) { sales = sales.filter((x) => x.id !== inv.id); saveSales(); }
    else { purchases = purchases.filter((x) => x.id !== inv.id); savePurchases(); }
    addActivity("حذف فاتورة", "حذف فاتورة " + kind + " رقم (" + num + ") - " + who + " - بمبلغ " + fmt(amt) +
      " ج.م (تراجع كامل للمخزون والأرصدة" + (goneJ ? " والقيد " + goneJ.number : "") + ")");
    toast("تم حذف فاتورة (" + num + ") بنجاح وتراجع أثرها بالكامل" +
      (goneJ ? " بما فيه القيد (" + goneJ.number + ")" : "") + ".", "success");
    renderInvoiceQuery();
  }

  /* ================== 🔁 المرتجعات (بناء 108) ================== */
  // كل مرتجع (بيع أو شراء) مستند مستقل في جدول خاص: الفاتورة الأصلية بتفضل زي ما هي،
  // والمستخدم يستدعي الفاتورة ويكتب الكمية المرتجعة بس — باقي البيانات بتيجي منها.
  // القيود العكسية: المخزون + التسوية (خصم من الرصيد أو رد نقدية من الخزينة).
  let retDraft = null;          // { isSales, inv, isAjali, lines:[...] }
  let retPickIsSales = true;
  let retActiveTab = "s";

  function retList(isSales) { return isSales ? saleReturns : purchaseReturns; }
  function retDocs(isSales) { return isSales ? sales : purchases; }
  function retKind(isSales) { return isSales ? "sale_return" : "purchase_return"; }
  function retWord(isSales) { return isSales ? "مبيعات" : "مشتريات"; }
  function retNo(r) { return String((r && (r.returnNumber || r.returnNo)) || (r && r.id) || "-"); }
  function retDateOf(r) { return (r && (r.returnDate || r.date)) || todayISO(); }
  function retParty(r, isSales) {
    if (!r) return "-";
    return isSales ? (r.customerName || r.customer || "-") : (r.supplierName || r.supplier || "-");
  }
  function retLinkedId(r, isSales) {
    if (!r) return 0;
    const v = isSales
      ? (r.saleId != null ? r.saleId : r.sale_local_id)
      : (r.purchaseId != null ? r.purchaseId : r.purchase_local_id);
    return Number(v) || 0;
  }
  function retInvoiceOf(r, isSales) { return retDocs(isSales).find((x) => Number(x.id) === retLinkedId(r, isSales)) || null; }
  function retItemKey(it) {
    if (!it) return "";
    const pid = (it.productId != null && it.productId !== "") ? it.productId : it.product_id;
    if (pid != null && pid !== "") return "p" + String(pid);
    return "n" + String(it.nameAr || it.product_name || it.code || "");
  }
  function retInvoiceNo(inv) { return String((inv && (inv.invoiceNumber || inv.invoiceNo)) || "-"); }

  // كمية + تواريخ كل صنف اترجّع من الفاتورة (أكثر من مرتجع بيتجمعوا)
  function returnedMap(isSales, invId) {
    const out = {};
    retList(isSales).forEach((r) => {
      if (retLinkedId(r, isSales) !== Number(invId)) return;
      (r.items || []).forEach((it) => {
        const k = retItemKey(it);
        const q = Number(it.qty) || 0;
        if (!out[k]) out[k] = { qty: 0, notes: [] };
        out[k].qty += q;
        out[k].notes.push({ no: retNo(r), date: retDateOf(r), qty: q });
      });
    });
    return out;
  }
  function returnedQtyOf(isSales, invId, it) {
    const m = returnedMap(isSales, invId)[retItemKey(it)];
    return m ? m.qty : 0;
  }
  // الوسم اللي بيظهر قدام الصنف في الفاتورة الأصلية (طباعة + استعلام)
  function returnedBadge(isSales, invId, it) {
    const m = returnedMap(isSales, invId)[retItemKey(it)];
    if (!m || !m.qty) return "";
    const parts = m.notes.map((n) => (n.date || "—") + " (" + Number(n.qty).toLocaleString("en-US") + ")");
    return ' <span class="ret-tag">↩️ تم استرجاعه بتاريخ ' + esc(parts.join(" ، ")) + '</span>';
  }
  function returnableQty(isSales, inv, line) {
    const sold = Number(line.qty) || 0;
    const already = returnedQtyOf(isSales, inv.id, line);
    return Math.max(0, Math.round((sold - already) * 1e6) / 1e6);
  }
  function invoiceHasReturns(isSales, inv) {
    if (!inv) return false;
    return retList(isSales).some((r) => retLinkedId(r, isSales) === Number(inv.id));
  }
  function invoiceAllReturned(isSales, inv) {
    const items = (inv && inv.items) || [];
    if (!items.length) return false;
    return items.every((it) => returnableQty(isSales, inv, it) <= 0);
  }
  // قيمة المرتجع: نصيب الكمية من إجمالي الصنف (شامل خصمه وضريبته) − نصيبه من خصم الفاتورة
  function retLineValue(inv, line, qty) {
    const sold = Number(line.qty) || 0;
    const q = Number(qty) || 0;
    if (!sold || !q) return 0;
    const ratio = Math.min(q / sold, 1);
    const lineTotal = Number(line.total) || ((Number(line.price) || 0) * sold);
    const base = lineTotal * ratio;
    const items = (inv && inv.items) || [];
    const invGross = items.reduce((s, x) => s + (Number(x.total) || ((Number(x.price) || 0) * (Number(x.qty) || 0))), 0);
    const extra = Number(inv && (inv.discountAmount != null ? inv.discountAmount : inv.discount)) || 0;
    const share = (invGross > 0 && extra > 0) ? (base * extra) / invGross : 0;
    return Math.max(0, Math.round((base - share) * 100) / 100);
  }
  function retSettleText(r) {
    if (r && r.settlement === "refund") {
      const tr = treasury.find((x) => Number(x.id) === Number(r.treasuryId));
      return tr ? "رد من " + tr.name : "رد قيمة المرتجع";
    }
    return "خصم من الرصيد";
  }
  // إجمالي مرتجعات الفاتورة (عدد المستندات + قيمة + كمية) — للملاحظة أسفل الأصلية
  function retTotalsFor(isSales, inv) {
    const out = { count: 0, value: 0, qty: 0 };
    if (!inv) return out;
    retList(isSales).forEach((r) => {
      if (retLinkedId(r, isSales) !== Number(inv.id)) return;
      out.count++;
      out.value += Number(r.grandTotal) || 0;
      (r.items || []).forEach((it) => { out.qty += Number(it.qty) || 0; });
    });
    out.value = Math.round(out.value * 100) / 100;
    return out;
  }
  // سطر المرتجعات في تذييل الطباعة: "مرتجعات: 150.00 ج.م — الصافي بعد المرتجعات: 850.00 ج.م"
  function retFootNote(isSales, inv) {
    const t = retTotalsFor(isSales, inv);
    if (!t.count) return "";
    return ' | المرتجعات (<b>' + t.count + '</b>): <b>' + fmt(t.value) + ' ج.م</b> | الصافي بعد المرتجعات: <b>' +
      fmt(Math.max(0, (Number(inv.grandTotal) || 0) - t.value)) + ' ج.م</b>';
  }
  function nextReturnId(isSales) {
    return retList(isSales).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
  }

  /* ---- عرض جدول المرتجعات ---- */
  function renderReturns() {
    const fill = (sel, isSales) => {
      const tbody = $(sel + " tbody");
      if (!tbody) return;
      const from = $("#" + (isSales ? "dtpFromRS" : "dtpFromRP")).value || "2000-01-01";
      const to = $("#" + (isSales ? "dtpToRS" : "dtpToRP")).value || "2999-12-31";
      const q = normalizeAr($("#" + (isSales ? "txtSearchRetS" : "txtSearchRetP")).value || "");
      const canDel = canDeleteInvoices();
      const list = retList(isSales).filter((r) => {
        const d = retDateOf(r);
        if (d < from || d > to) return false;
        if (!q) return true;
        const inv = retInvoiceOf(r, isSales);
        return normalizeAr(retNo(r)).includes(q)
          || normalizeAr(retInvoiceNo(inv)).includes(q)
          || normalizeAr(retParty(r, isSales)).includes(q)
          || fmt(r.grandTotal).includes(q);
      });
      tbody.innerHTML = "";
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8">لا توجد مرتجعات في هذه الفترة.</td></tr>';
        return;
      }
      list.slice().sort((a, b) => String(retDateOf(b)).localeCompare(String(retDateOf(a)))).forEach((r) => {
        const inv = retInvoiceOf(r, isSales);
        const itemsTxt = (r.items || []).map((it) => (it.nameAr || it.product_name || "-") + " ×" + Number(it.qty || 0).toLocaleString("en-US")).join("، ");
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(retNo(r)) + '</td>' +
          '<td>' + esc(retDateOf(r)) + '</td>' +
          '<td>' + esc(retInvoiceNo(inv)) + '</td>' +
          '<td>' + esc(retParty(r, isSales)) + '</td>' +
          '<td class="ret-items-cell">' + esc(itemsTxt || "-") + '</td>' +
          '<td>' + fmt(r.grandTotal) + ' ج.م</td>' +
          '<td class="cell-actions"><span class="ret-settle">' + esc(retSettleText(r)) + '</span> ' +
          '<button class="btn small sky" type="button" data-act="inv">🧾 الفاتورة</button>' +
          (canDel ? ' <button class="btn small red" type="button" data-act="del">🗑️ حذف</button>' : '') + '</td>';
        tr.dataset.rid = r.id;
        tr.dataset.typ = isSales ? "s" : "p";
        tbody.appendChild(tr);
      });
    };
    fill("#dgvRetS", true);
    fill("#dgvRetP", false);
  }

  /* ---- استدعاء الفاتورة ---- */
  function openRetPick(isSales) {
    if (!canManageReturns()) { toast("صلاحية «إدارة المرتجعات» غير مفعّلة لحسابك.", "warning"); return; }
    retPickIsSales = !!isSales;
    retActiveTab = isSales ? "s" : "p";
    $("#retPickTitle").textContent = isSales
      ? "🔁 اختار فاتورة البيع اللي عليها المرتجع"
      : "🔁 اختار فاتورة الشراء اللي عليها المرتجع";
    $("#retPickSearch").value = "";
    renderRetPick();
    showModal("mRetPick");
    $("#retPickSearch").focus();
  }

  function renderRetPick() {
    const isSales = retPickIsSales;
    const q = normalizeAr($("#retPickSearch").value || "");
    const tbody = $("#dgvRetPick tbody");
    const all = retDocs(isSales);
    const list = all.filter((inv) => {
      if (!q) return true;
      return normalizeAr(retInvoiceNo(inv)).includes(q) || normalizeAr(retParty(inv, isSales)).includes(q) || fmt(inv.grandTotal).includes(q);
    });
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">' + (all.length ? "لا توجد نتائج مطابقة للبحث." : "مفيش فواتير مسجّلة بعد.") + '</td></tr>';
      return;
    }
    list.slice().sort((a, b) => String(b.invoiceDate || b.date || "").localeCompare(String(a.invoiceDate || a.date || ""))).forEach((inv) => {
      const done = invoiceAllReturned(isSales, inv);
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td hidden></td>' +
        '<td>' + esc(retInvoiceNo(inv)) + '</td>' +
        '<td>' + esc(inv.invoiceDate || inv.date || "-") + '</td>' +
        '<td>' + esc(retParty(inv, isSales)) + '</td>' +
        '<td>' + fmt(inv.grandTotal) + ' ج.م</td>' +
        '<td class="cell-actions">' + (done
          ? '<span class="ret-muted">✅ كل الأصناف مرجّعة</span>'
          : '<button class="btn small green" type="button" data-act="pick">اختيار</button>') + '</td>';
      tr.dataset.iid = inv.id;
      tbody.appendChild(tr);
    });
  }

  /* ---- نافذة تسجيل المرتجع: الفاتورة مستدعاة والكمية بس اللي بتتكتب ---- */
  function openRetFor(isSales, inv) {
    if (!canManageReturns()) { toast("صلاحية «إدارة المرتجعات» غير مفعّلة لحسابك.", "warning"); return; }
    if (!inv) return;
    const lines = (inv.items || []).map((it) => {
      const rem = returnableQty(isSales, inv, it);
      return {
        line: it,
        key: retItemKey(it),
        nameAr: it.nameAr || it.product_name || "-",
        sold: Number(it.qty) || 0,
        already: returnedQtyOf(isSales, inv.id, it),
        remaining: rem,
        price: Number(it.price) || 0,
        qty: 0,
        value: 0
      };
    });
    if (!lines.length) { toast("الفاتورة دي مسجّل عليها مرتجع كامل.", "warning"); return; }
    if (!lines.some((l) => l.remaining > 0)) { toast("أصناف الفاتورة دي اترجّعت كلها قبل كده.", "warning"); return; }
    const isAjali = String(inv.paymentMethod || "").includes("آجل");
    retDraft = { isSales: !!isSales, inv: inv, isAjali: isAjali, lines: lines };

    hideModal("mRetPick");
    $("#retTitle").textContent = isSales ? "🔁 مرتجع على فاتورة مبيعات" : "🔁 مرتجع على فاتورة مشتريات";
    const lbl = document.querySelector('#mRetAddBox label[for="retParty"]');
    if (lbl) lbl.textContent = isSales ? "العميل:" : "المورد:";
    $("#retInv").value = "رقم " + retInvoiceNo(inv) + " — " + (inv.invoiceDate || inv.date || "-") + " — " + (inv.warehouse || inv.store || "-");
    $("#retParty").value = retParty(inv, isSales) + " (" + (inv.paymentMethod || "-") + ")";
    $("#retDate").value = todayISO();
    $("#retNotes").value = "";
    const optRefund = $("#retSettle").querySelector('option[value="refund"]');
    if (optRefund) optRefund.disabled = isAjali;
    $("#retSettle").value = isAjali ? "balance" : "refund";
    const pm = String(inv.paymentMethod || "");
    $("#retMethod").value = (pm.includes("بنك") || pm.includes("تحويل"))
      ? "تحويل بنكي 🏛️"
      : (pm.includes("محفظ") ? "محفظة إلكترونية 📱" : "نقداً 💵");
    applyRetSettleUI();
    renderRetItems();
    recalcRetTotal();
    showModal("mRetAdd");
  }

  function retMethodType() {
    const m = String($("#retMethod").value || "");
    if (m.includes("بنك")) return "bank";
    if (m.includes("محفظ")) return "wallet";
    return "cash";
  }

  function fillRetTreasury() {
    const sel = $("#retTreasury");
    if (!sel) return;
    const wantType = retMethodType();
    const prev = sel.value;
    sel.innerHTML = "";
    // 🆕 تسوية المرتجع: الخزينة والبنوك والمحافظ كلها معروضة ومجمّعة، والطريقة المختارة بتحدد الافتراضي
    const trById = (v) => treasury.find((t) => String(t.id) === String(v));
    const trType = (t) => (t && t.type) || "cash";
    const groups = [["cash", "💵 الخزينة (نقدية)"], ["bank", "🏛️ البنوك"], ["wallet", "📱 المحافظ الإلكترونية"]];
    groups.forEach(function (g) {
      const rows = treasury.filter((t) => trType(t) === g[0]);
      if (!rows.length) return;
      const og = document.createElement("optgroup");
      og.label = g[1];
      rows.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name + " (" + fmt(t.balance) + " ج.م)";
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
    if (!sel.options.length) return;
    // الاختيار: يحترم السابق لو من نوع الطريقة، وإلا أول حساب مطابق، وإلا أول حساب متاح
    let target = (prev && trById(prev) && trType(trById(prev)) === wantType) ? prev : null;
    if (!target) {
      const first = treasury.find((t) => trType(t) === wantType);
      if (first) target = String(first.id);
    }
    if (!target && prev && trById(prev)) target = prev;
    if (!target) target = String(sel.options[0].value);
    const found = Array.prototype.slice.call(sel.options).some((o) => o.value === target);
    if (found) sel.value = target;
  }

  // اختيار الحساب يحدد طريقة الرد تلقائيًا (نقدي/بنكي/محفظة) — فيفضل السند والقيود متسقة
  function syncRetMethodFromTreasury() {
    const sel = $("#retTreasury");
    if (!sel || sel.hidden) return;
    const t = treasury.find((x) => String(x.id) === String(sel.value));
    if (!t) return;
    const typ = t.type || "cash";
    const m = $("#retMethod");
    if (m) m.value = typ === "bank" ? "تحويل بنكي 🏛️" : typ === "wallet" ? "محفظة إلكترونية 📱" : "نقداً 💵";
  }

  function applyRetSettleUI() {
    const refund = $("#retSettle").value === "refund";
    const show = refund && !(retDraft && retDraft.isAjali);
    $("#lblRetMethod").hidden = !show;
    $("#retMethod").hidden = !show;
    $("#lblRetTreasury").hidden = !show;
    $("#retTreasury").hidden = !show;
    const hint = $("#retSettleHint");
    if (hint) {
      const partyLbl = (retDraft && retDraft.isSales) ? "العميل" : (retDraft ? "المورد" : "الطرف");
      hint.textContent = show
        ? "المبلغ هينزل فعليًا من الحساب اللي هتختاره (خزينة أو بنك أو محفظة)."
        : (retDraft && retDraft.isAjali
          ? "الفاتورة آجلة — قيمة المرتجع بتتخصم من رصيد " + partyLbl + "."
          : "قيمة المرتجع بتتخصم من رصيد " + partyLbl + " وتظهر في كشف حسابه.");
    }
    if (show) fillRetTreasury();
  }

  function renderRetItems() {
    const tbody = $("#dgvRetItems tbody");
    if (!tbody || !retDraft) return;
    tbody.innerHTML = "";
    retDraft.lines.forEach((l, i) => {
      const canPart = l.remaining > 0;
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="text-align:right">' + esc(l.nameAr) + (l.already > 0 ? ' <span class="ret-tag">↩️ اترجّع ' + Number(l.already).toLocaleString("en-US") + '</span>' : '') + '</td>' +
        '<td>' + Number(l.sold).toLocaleString("en-US") + '</td>' +
        '<td>' + fmt(l.price) + '</td>' +
        '<td>' + (canPart ? Number(l.remaining).toLocaleString("en-US") : '<span class="ret-muted">خلص</span>') + '</td>' +
        '<td>' + (canPart
          ? '<input type="number" class="ret-qty-inp" data-idx="' + i + '" min="0" max="' + l.remaining + '" step="any" value="0" autocomplete="off" />'
          : '<span class="ret-muted">0</span>') + '</td>' +
        '<td data-val="' + i + '">' + fmt(0) + ' ج.م</td>';
      tbody.appendChild(tr);
    });
  }

  function readRetLines() {
    if (!retDraft) return;
    document.querySelectorAll("#dgvRetItems .ret-qty-inp").forEach((inp) => {
      const i = Number(inp.dataset.idx);
      const l = retDraft.lines[i];
      if (!l) return;
      let v = parseFloat(String(inp.value).replace(/,/g, "")) || 0;
      if (v < 0) { v = 0; inp.value = 0; }   // السالب مالوش معنى — يتصفّر من غير رسالة
      // بناء 113: الكمية الزيادة ما تتقصّش في صمت — بتفضل زي ما كتبها المستخدم،
      // والتحذير + قفل زرار الحفظ هما اللي بيمنعوا التنفيذ لحد ما يعدّلها بنفسه.
      l.qty = v;
    });
  }

  // الأسطر اللي كميتها المكتوبة أكبر من المتبقي للرجوع من الفاتورة (بناء 113)
  function retOverLines() {
    if (!retDraft) return [];
    return retDraft.lines.filter((l) => (Number(l.qty) || 0) > (Number(l.remaining) || 0) + 1e-9);
  }
  const retQfmt = (n) => Number(n || 0).toLocaleString("en-US");
  function retOverLineMsg(l) {
    return "⚠️ صنف «" + l.nameAr + "»: الكمية في الفاتورة " + retQfmt(l.sold) +
      (l.already > 0 ? "، اترجّع منها قبل كده " + retQfmt(l.already) : "") +
      "، فالمتبقي للرجوع " + retQfmt(l.remaining) + " — والمكتوب دلوقتي " + retQfmt(l.qty) + ". عدّل الكمية الأول.";
  }
  // تلوين الأسطر الزيادة + لافتة التحذير جوه النافذة + قفل زرار الحفظ (بناء 113)
  function paintRetOver() {
    const over = retOverLines();
    document.querySelectorAll("#dgvRetItems .ret-qty-inp").forEach((inp) => {
      const l = retDraft ? retDraft.lines[Number(inp.dataset.idx)] : null;
      const tr = inp.closest ? inp.closest("tr") : null;
      const bad = !!l && (Number(l.qty) || 0) > (Number(l.remaining) || 0) + 1e-9;
      if (tr) tr.classList.toggle("ret-over", bad);
      inp.classList.toggle("ret-over-inp", bad);
    });
    const ban = $("#retOverWarn");
    if (ban) {
      if (over.length) {
        ban.innerHTML = "الكمية المرتجعة أكبر من الكمية المتبقية من الفاتورة — المرتجع مش هيتسجل غير لما تعدّل الكمية:<br>" +
          over.map(retOverLineMsg).join("<br>");
        ban.hidden = false;
      } else {
        ban.innerHTML = "";
        ban.hidden = true;
      }
    }
    const btn = $("#btnRetSave");
    if (btn) btn.disabled = over.length > 0;
    return over;
  }

  function recalcRetTotal() {
    readRetLines();
    let total = 0;
    if (retDraft) {
      retDraft.lines.forEach((l, i) => {
        const bad = (Number(l.qty) || 0) > (Number(l.remaining) || 0) + 1e-9;
        // السطر الزيادة: قيمته «—» وما يدخلش في الإجمالي — عشان مفيش أي رقم على الشاشة
        // يوحي إن المرتجع هيتنفذ بالكمية الغلط (بناء 113)
        const v = bad ? 0 : retLineValue(retDraft.inv, l.line, l.qty);
        l.value = v;
        if (!bad) total += v;
        const cell = document.querySelector('#dgvRetItems td[data-val="' + i + '"]');
        if (cell) cell.textContent = bad ? "—" : fmt(v) + " ج.م";
      });
    }
    const t = $("#retTotal");
    if (t) t.textContent = "قيمة المرتجع: " + fmt(total) + " ج.م";
    paintRetOver();
  }

  /* ---- تسجيل المرتجع + القيود العكسية ---- */
  function saveReturn() {
    if (!canManageReturns()) { toast("صلاحية «إدارة المرتجعات» غير مفعّلة لحسابك.", "error"); return; }
    if (!retDraft || !retDraft.inv) { toast("استدعي الفاتورة الأول.", "warning"); return; }
    const isSales = retDraft.isSales;
    const inv = retDraft.inv;
    readRetLines();
    const chosen = retDraft.lines.filter((l) => l.qty > 0);
    if (!chosen.length) { toast("اكتب الكمية المرتجعة قدام صنف واحد على الأقل.", "warning"); return; }
    const over = retOverLines().filter((l) => (Number(l.qty) || 0) > 0);
    if (over.length) {
      // حصانة ثانية (بناء 113): لو لأي سبب اللافتة ما ظهرتش، التنفيذ بالكمية الزيادة ممنوع نهائيًا
      paintRetOver();
      toast("مش هيتسجل المرتجع: الكمية المرتجعة أكبر من المتبقي من الفاتورة في: " +
        over.map((l) => "«" + l.nameAr + "» (المتبقي للرجوع " + retQfmt(l.remaining) + " والمكتوب " + retQfmt(l.qty) + ")").join("، ") +
        " — عدّل الكمية الأول.", "warning");
      return;
    }

    const wh = inv.warehouse || inv.store || WAREHOUSES[0];
    const date = ($("#retDate").value || todayISO());
    const notes = ($("#retNotes").value || "").trim();
    let settle = $("#retSettle").value === "refund" ? "refund" : "balance";
    if (retDraft.isAjali) settle = "balance";

    // ---- تحققات قبل أي تنفيذ (من غير لمس البيانات) ----
    const partyId = Number(isSales ? inv.customerId : inv.supplierId);
    const party = isSales
      ? customers.find((c) => Number(c.id) === partyId)
      : suppliers.find((s) => Number(s.id) === partyId);
    if (settle === "balance" && !party) {
      toast("ما لقيناش حساب " + (isSales ? "العميل" : "المورد") + " المرتبط بالفاتورة — اختار «رد قيمة المرتجع» أو سجّل الحساب الأول.", "warning");
      return;
    }
    let tr = null;
    if (settle === "refund") {
      tr = treasury.find((x) => Number(x.id) === Number($("#retTreasury").value));
      if (!tr) { toast("اختار الخزينة أو الحساب اللي هيتم الرد منه.", "warning"); return; }
    }
    if (!isSales) {
      const negs = chosen.filter((l) => {
        const p = products.find((x) => Number(x.id) === Number(l.line.productId));
        return p && stockAt(p, wh) - l.qty < 0;
      });
      if (negs.length) {
        toast("رصيد المخزن (" + wh + ") أقل من الكمية المرتجعة في: " + negs.map((n) => n.nameAr).join("، "), "warning");
        return;
      }
    }

    const items = chosen.map((l, idx) => ({
      id: idx + 1,
      productId: l.line.productId,
      code: l.line.code,
      nameAr: l.nameAr,
      unit: lineUnit(l.line),        // 🆕 المرتجع ياخد نفس وحدة سطر الفاتورة (متحلة من الصنف لو فاضية)
      qty: l.qty,
      price: l.price,
      total: retLineValue(inv, l.line, l.qty)
    }));
    const amt = Math.round(items.reduce((s, x) => s + (Number(x.total) || 0), 0) * 100) / 100;
    if (amt <= 0) { toast("قيمة المرتجع طلعت صفر — راجع أسعار الأصناف.", "warning"); return; }

    const no = nextReturnNumber(retKind(isSales));
    const id = nextReturnId(isSales);
    const rec = {
      id: id,
      returnNumber: no,
      returnNo: no,
      returnDate: date,
      date: date,
      settlement: settle,
      paymentMethod: settle === "refund" ? ($("#retMethod").value || "نقداً 💵") : "خصم من الرصيد",
      treasuryId: settle === "refund" ? tr.id : null,
      warehouse: wh,
      store: wh,
      notes: notes,
      grandTotal: amt,
      items: items,
      status: "posted",
      txId: null,
      voucherId: null
    };
    if (isSales) {
      rec.saleId = inv.id;
      rec.customerId = partyId;
      rec.customerName = retParty(inv, true);
      rec.customer = retParty(inv, true);
    } else {
      rec.purchaseId = inv.id;
      rec.supplierId = partyId;
      rec.supplierName = retParty(inv, false);
      rec.supplier = retParty(inv, false);
    }

    // 1) المخزون عكسي: مرتجع البيع بيرجّع الكمية للمخزن، ومرتجع المشتريات بينقصها
    items.forEach((it) => {
      const p = products.find((x) => Number(x.id) === Number(it.productId));
      if (p) addStockAt(p, wh, isSales ? (Number(it.qty) || 0) : -(Number(it.qty) || 0));
    });
    saveProducts();

    // 2) التسوية: رد نقدية = حركة خزينة (سند)، خصم من الرصيد = حركة على الحساب
    if (settle === "refund") {
      const v = {
        id: vouchers.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1,
        type: isSales ? "out" : "in",
        treasuryId: tr.id,
        date: date,
        amount: amt,
        desc: (isSales ? "رد قيمة مرتجع مبيعات رقم " : "استلام قيمة مرتجع مشتريات رقم ") + no,
        refType: isSales ? "sale_return" : "purchase_return",
        refId: id
      };
      vouchers.push(v);
      saveVouchers();
      recalculateTreasuryBalances();
      rec.voucherId = v.id;
    } else {
      const desc = "مرتجع " + retWord(isSales) + " رقم " + no + " — خصم من الرصيد";
      let tx;
      if (isSales) {
        tx = { id: nextTxId(), customerId: partyId, date: date, desc: desc, debit: 0, credit: amt };
        txs.push(tx);
        recalculateCustomerBalances();
        saveCustomers();
        saveTxs();
      } else {
        tx = { id: supplierTxs.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1, supplierId: partyId, date: date, desc: desc, debit: 0, credit: amt };
        supplierTxs.push(tx);
        recalculateSupplierBalances();
        saveSuppliers();
        saveSupplierTxs();
      }
      rec.txId = tx.id;
    }

    // 3) الحفظ + التسلسل + سجل النشاط
    retList(isSales).push(rec);
    if (isSales) saveSaleReturns(); else savePurchaseReturns();
    commitInvoiceSeq(retKind(isSales), Number(no) || 0);
    addActivity("مرتجع " + retWord(isSales),
      "مرتجع رقم (" + no + ") على فاتورة " + retInvoiceNo(inv) + " - " + retParty(inv, isSales) +
      " - " + items.map((x) => x.nameAr + " ×" + Number(x.qty)).join("، ") +
      " - بقيمة " + fmt(amt) + " ج.م (" + rec.paymentMethod + ")");

    retDraft = null;
    hideModal("mRetAdd");
    renderReturns();
    renderInvoiceQuery();
    renderDashboard();
    renderTreasury();
    renderTreMoves();
    renderTable();
    renderSuppliers();
    toast("تم تسجيل المرتجع رقم (" + no + ") وتحديث المخزون" + (settle === "refund" ? " وحساب الرد (" + tr.name + ")" : " والرصيد") + " — الفاتورة الأصلية فضلت موجودة.", "success");
  }

  /* ---- حذف المرتجع: تراجع كل القيود العكسية ---- */
  function deleteReturn(r, isSales) {
    if (!canManageReturns() || !canDeleteInvoices()) {
      toast("حذف المرتجع لصاحب الشركة ومالك البرنامج فقط.", "error");
      return;
    }
    if (!r) return;
    const no = retNo(r);
    const amt = Math.round((Number(r.grandTotal) || 0) * 100) / 100;
    const inv = retInvoiceOf(r, isSales);
    const wh = r.warehouse || r.store || (inv ? (inv.warehouse || inv.store) : "") || WAREHOUSES[0];
    const items = r.items || [];
    // حذف مرتجع البيع = الكميات هتخرج من المخزن تاني — ممنوع لو هيطلع سالب
    if (isSales) {
      const negs = items.filter((it) => {
        const p = products.find((x) => Number(x.id) === Number(it.productId));
        return p && stockAt(p, wh) - (Number(it.qty) || 0) < 0;
      });
      if (negs.length) {
        toast("لا يمكن حذف المرتجع: المخزن (" + wh + ") أقل من الكميات المرتجعة في: " + negs.map((n) => n.nameAr || n.product_name || "-").join("، "), "warning");
        return;
      }
    }
    if (!confirm("متأكد إنك عايز تحذف مرتجع الـ" + retWord(isSales) + " رقم (" + no + ") الخاص بـ " + retParty(r, isSales) + " بقيمة " + fmt(amt) + " ج.م؟\n\nالحذف بيتراجع عن كل أثره: الأصناف للمخزن، والتسوية (الرصيد أو الخزينة).")) {
      toast("تم الإلغاء — المرتجع كما هو.", "warning");
      return;
    }
    // 1) عكس المخزون
    items.forEach((it) => {
      const p = products.find((x) => Number(x.id) === Number(it.productId));
      if (p) addStockAt(p, wh, isSales ? -(Number(it.qty) || 0) : (Number(it.qty) || 0));
    });
    saveProducts();
    // 2) عكس التسوية
    if (r.settlement === "refund") {
      const vIdx = vouchers.findIndex((v) =>
        (String(v.refType || "") === (isSales ? "sale_return" : "purchase_return") && Number(v.refId) === Number(r.id)) ||
        (String(v.desc || "").includes("رجع مبيعات رقم " + no) || String(v.desc || "").includes("رجع مشتريات رقم " + no)));
      if (vIdx !== -1) { vouchers.splice(vIdx, 1); saveVouchers(); }
      recalculateTreasuryBalances();
      renderTreasury();
      renderTreMoves();
    } else if (isSales) {
      let i = txs.findIndex((t) => Number(t.id) === Number(r.txId));
      if (i === -1) i = txs.findIndex((t) => Number(t.customerId) === Number(r.customerId) && String(t.desc || "").includes("مرتجع مبيعات رقم " + no));
      if (i !== -1) txs.splice(i, 1);
      recalculateCustomerBalances();
      saveCustomers();
      saveTxs();
    } else {
      let i = supplierTxs.findIndex((t) => Number(t.id) === Number(r.txId));
      if (i === -1) i = supplierTxs.findIndex((t) => Number(t.supplierId) === Number(r.supplierId) && String(t.desc || "").includes("مرتجع مشتريات رقم " + no));
      if (i !== -1) supplierTxs.splice(i, 1);
      recalculateSupplierBalances();
      saveSuppliers();
      saveSupplierTxs();
    }
    // 3) حذف السطر نفسه
    if (isSales) { saleReturns = saleReturns.filter((x) => x.id !== r.id); saveSaleReturns(); }
    else { purchaseReturns = purchaseReturns.filter((x) => x.id !== r.id); savePurchaseReturns(); }
    addActivity("حذف مرتجع", "حذف مرتجع " + retWord(isSales) + " رقم (" + no + ") - " + retParty(r, isSales) + " - بقيمة " + fmt(amt) + " ج.م (تراجع كامل)");
    toast("تم حذف المرتجع (" + no + ") وتراجع أثره بالكامل.", "success");
    renderReturns();
    renderInvoiceQuery();
    renderDashboard();
    renderTable();
    renderSuppliers();
  }

  /* ================== الخزينة والمصروفات ================== */
  let treasuryEditingId = null;
  let voucherMode = "in";

  // الضبط هو المرجع: نبني قائمة الخزائن من بيانات الضبط (بنوك + محافظ) مع إبقاء
  // الخزائن النقدية الموجودة، ونحافظ على معرفات الأصناف الشبيهة حتى لا تنكسر الفواتير.
  // إن لم تصل بيانات ضبط فعلية من السحابة (غير محمّلة/فارغة) نحتفظ بالقائمة الحالية دون مساس.
  // 🆕 ترحيل ٣٤: أول رقم محلي فاضي لخزينة جديدة (بينظر لأرقام الخزائن الحالية
  // وأرقام تبويب البنوك/المحافظ في شاشة الضبط — عملة واحدة عشان ما نتصادمش).
  function nextTreasuryLocalId(prefix) {
    let max = 0;
    const bump = (v) => { const n = Number(v); if (isFinite(n) && n > max) max = n; };
    if (prefix !== "s") (treasury || []).forEach((t) => bump(t && t.id));
    const p = settPayload(prefix);
    if (p) ["banks", "wallets"].forEach((k) => (p[k] || []).forEach((r) => bump(r && r.local_id)));
    return max + 1;
  }

  function syncTreasuryFromSett() {
    try {
      const banks = (csetData && csetData.banks) || null;
      const wallets = (csetData && csetData.wallets) || null;
      if (!csetData || csetData.__online !== true) return false;
      const hasBankData = Array.isArray(banks) && banks.length;
      const hasWalletData = Array.isArray(wallets) && wallets.length;
      if (!hasBankData && !hasWalletData) {
        return false;
      }
      let nextId = treasury.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
      const built = [];
      const used = {};
      let changed = false;
      const norm = (s) => (s || "").replace(/[\s\-_()]/g, "").toLowerCase();
      // 🆕 ترحيل ٣٤: رقم السطر (uuid) المحلي الثابت — نفس اللي بستخدمه طبقة المزامنة،
      //    فسطر الضبط الجديد ورفعة للسحابة يبقى ليهم رقم واحد (مافيش سطر تاني بمقابلوه).
      const uuidFor = (n) => {
        try { return (window.CLOUD && CLOUD.detUuid) ? CLOUD.detUuid("treasury", n) : null; } catch (e) { return null; }
      };
      // 🆕 ترحيل ٣٤: الهوية أولًا. لو سطر الضبط جايب local_id، ده هو نفس حساب الخزينة
      //    بالرقم ده — الاسم ممكن يتبدّل لكن الرقم ما بيتبدّلش. المطابقة بالاسم بقت
      //    احتياطية للقديم بس، لأن كانت هي سبب التكرار (٧ محافظ بنفس الاسم في «المجد»).
      const byIdentity = (localId) => {
        const n = Number(localId);
        if (!isFinite(n) || n <= 0) return null;
        return treasury.find((t) => Number(t.id) === n && !used[t.id] && t.type !== "cash") || null;
      };
      const byName = (type, name, acct) => {
        const nName = norm(name);
        const nAcct = norm(acct);
        for (const t of treasury) {
          if (used[t.id]) continue;
          if (t.type !== type) continue;
          const tnName = norm(t.name);
          const tnAcct = norm(t.accountNo);
          if (t.name === name || tnName === nName) return t;
          if (nAcct && tnAcct && (nAcct === tnAcct || tnName.includes(nAcct))) return t;
          if (tnName && nName && (tnName.includes(nName) || nName.includes(tnName))) return t;
        }
        return null;
      };
      const claim = (row) => { if (row) used[row.id] = true; return row; };

      // بناء قائمة محلية من تبويب (بنوك أو محافظ) + تنقية الحمولة من أي تكرار بنفس الرقم
      const place = (list, key, type) => {
        if (!Array.isArray(list)) return list;
        const out = [];
        const takenUuid = {};
        list.forEach((row) => {
          if (!row) return;
          const name = (row.name || "").trim();
          const uuidKey = String(row.id || "").toLowerCase();
          if (uuidKey && takenUuid[uuidKey]) { changed = true; return; }   // سطر مكرر بنفس الرقم → نسخة واحدة
          if (!name) { out.push(row); return; }
          let prev = claim(byIdentity(row.local_id)) || claim(byName(type, name, row.account_no));
          if (!prev) { prev = { id: nextId++, type: type, balance: null, openingBalance: 0, accountNo: "" }; changed = true; }
          if (uuidKey) takenUuid[uuidKey] = 1;
          // نرجّع الهوية للحمولة نفسها: كده «حفظ الضبط» بيكتب local_id والرقم الصح على السحابة
          if (Number(row.local_id) !== Number(prev.id)) { row.local_id = prev.id; changed = true; }
          if (!row.id) { row.id = uuidFor(prev.id); changed = true; }
          if (prev.type !== type) { prev.type = type; changed = true; }
          const liveBal = prev.balance != null ? Number(prev.balance) : (row.balance != null ? Number(row.balance) : Number(row.opening_balance || 0));
          row.balance = liveBal;
          // 🛡 بناء 119: الافتتاحي صفر = قيمة مقصودة، مش «ناقص». القديم كان
          // `row.opening_balance || prev.openingBalance || 0` ⇒ الصفر كان بيقع
          // ويرجع الرقم القديم اللي في الضبط (50,000). دلوقتي الصفر بيتحترم،
          // ولو سطر الضبط مالوش افتتاحي أصلًا بنثبّت فيه رقم الخزينة الحالي.
          const settOp = (row.opening_balance != null && isFinite(Number(row.opening_balance))) ? Number(row.opening_balance) : null;
          const prevOp = (prev.openingBalance != null && isFinite(Number(prev.openingBalance))) ? Number(prev.openingBalance) : null;
          const openFinal = settOp != null ? settOp : (prevOp != null ? prevOp : 0);
          if (Number(row.opening_balance) !== openFinal) { row.opening_balance = openFinal; changed = true; }
          built.push({
            id: prev.id,
            name: name,
            type: type,
            accountNo: (row.account_no || "").trim(),
            openingBalance: openFinal,
            balance: liveBal,
            isActive: row.is_active !== false
          });
          out.push(row);
        });
        if (out.length !== list.length) csetData[key] = out;
        return out;
      };

      place(banks, "banks", "bank");
      place(wallets, "wallets", "wallet");

      treasury.forEach((t) => {
        if (used[t.id]) return;
        built.push(t);
      });
      treasury = built;
      // 🆕 ترحيل ٣٤: لو وصلنا هوية أو نقّينا تكرار، نثبّت ده على القرص ونرفعه للسحابة
      //    (بالمفتاح الجديد في cloud.js نفس السطر بيتحدّث ما بيتضايفش).
      if (changed) {
        try { saveTreasury(); } catch (e) {}
        try { pushTable("treasury"); } catch (e) {}
      }
      return true;
    } catch (e) { return false; }
  }

  function renderTreasury() {
    const tbody = $("#dgvTreasury tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtTreSearch").value);
    const totals = treasuryAmounts();
    treasury
      .filter((t) => {
        if (!q) return true;
        return normalizeAr(t.name).includes(q) || normalizeAr(t.accountNo || "").includes(q);
      })
      .forEach((t) => {
        const tr = document.createElement("tr");
        const typeName = t.type === "cash" ? "صندوق نقدي 💵" : t.type === "bank" ? "حساب بنكي 🏛️" : "محفظة 📱";
        const tTotals = totals[t.id] || { in: 0, out: 0 };
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(t.name) + '</td>' +
          '<td>' + typeName + '</td>' +
          '<td>' + esc(t.accountNo || (t.type === "bank" ? "—" : t.type === "wallet" ? (t.phone || "—") : "—")) + '</td>' +
          '<td class="' + (t.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(t.balance) + ' ج.م</td>' +
          amtTd(tTotals.in, "in") +
          amtTd(tTotals.out, "out") +
          '<td class="cell-actions"><button class="btn small blue" type="button" data-act="edit">✏️</button></td>';
        tr.dataset.tid = t.id;
        tbody.appendChild(tr);
      });
  }

  function treasuryAmounts() {
    const map = {};
    treasury.forEach((t) => (map[t.id] = { in: 0, out: 0 }));
    sales.filter((s) => s.treasuryId && s.paymentMethod !== "آجل").forEach((s) => {
      const k = Number(s.treasuryId);
      if (map[k]) map[k].in += Number(s.grandTotal || 0);
      else if (map[s.treasuryId]) map[s.treasuryId].in += Number(s.grandTotal || 0);
    });
    purchases.filter((p) => p.treasuryId && p.paymentMethod !== "آجل").forEach((p) => {
      const k = Number(p.treasuryId);
      if (map[k]) map[k].out += Number(p.grandTotal || 0);
      else if (map[p.treasuryId]) map[p.treasuryId].out += Number(p.grandTotal || 0);
    });
    vouchers.forEach((v) => {
      const k = Number(v.treasuryId);
      const target = map[k] || map[v.treasuryId];
      if (target) {
        if (v.type === "in" || v.kind === "in") target.in += Number(v.amount || 0);
        else target.out += Number(v.amount || 0);
      }
    });
    Object.keys(map).forEach((k) => { map[k].in = Math.round(map[k].in * 100) / 100; map[k].out = Math.round(map[k].out * 100) / 100; });
    return map;
  }

  function openTreasuryDialog(t) {
    treasuryEditingId = t ? t.id : null;
    $("#treasuryModalTitle").textContent = t ? "✏️ تعديل الخزينة" : "➕ إضافة خزينة / حساب";
    $("#tName").value = t ? t.name : "";
    $("#tType").value = t ? t.type : "cash";
    $("#tAccountNo").value = t ? (t.accountNo || "") : "";
    $("#tOpening").value = t ? moneyStr(t.openingBalance || 0) : "0";
    showModal("mTreasury");
    $("#tName").focus();
  }

  // 🛡 بناء 119: جزّة «إعدادات مؤسستك» (بنوك/محافظ) مع نفس رقم الخزينة.
  // الضبط هو المصدر اللي بيبني منه جدول الخزينة (syncTreasuryFromSett)، فلو ضلّ
  // فيه رقم قديم كان بيرجع يكتبه فوق الرصيد اللي المستخدم عدّله.
  function saveSettMirrorForTreasury(t) {
    if (!A.online || !csetData || csetData.__online !== true) return Promise.resolve(true);
    const key = t.type === "bank" ? "banks" : t.type === "wallet" ? "wallets" : null;
    if (!key || !Array.isArray(csetData[key])) return Promise.resolve(true);
    syncTreasuryItemToSett(t);
    const payload = {}; payload[key] = csetData[key];
    return DATA.saveClientSett(payload).then(() => true).catch((e) => {
      toast("تعذّر تحديث «إعدادات مؤسستك»: " + (e.message || e), "warning");
      return false;
    });
  }

  // 🛡 بناء 119: الرصيد الافتتاحي يتكتب على السحابة بسطره هو، ثم يُقري منها للتأكيد.
  // لو المراجعة ما طابقتش ⇒ نرجّع القيمة القديمة ونصارح المستخدم بالرقم اللي رجعت
  // به السحابة (ممنوع «تم الحفظ» اللي بتبقى كاذبة).
  function verifyTreasuryOpening(t, oldOp, newOp) {
    if (!A.online || !window.CLOUD || !CLOUD.setTreasuryOpening) return;
    const nm = t.name;
    CLOUD.setTreasuryOpening(t, newOp).then((res) => {
      if (res && res.ok) {
        if (openingBaseline) openingBaseline[Number(t.id)] = newOp;   // المرجع يتثبّت على الرقم الجديد
        toast("تم حفظ الرصيد الافتتاحي لـ «" + nm + "» = " + fmt(newOp) + " ج.م، وتأكدنا منه على السحابة.", "success");
        return;
      }
      const back = treasury.find((x) => x.id === t.id) || t;
      back.openingBalance = oldOp;
      if (openingBaseline) openingBaseline[Number(t.id)] = oldOp;
      recalculateTreasuryBalances();
      saveTreasury();
      syncTreasuryItemToSett(back);
      renderTreasury();
      toast("مقدرناش نحفظ الرصيد الافتتاحي على السحابة" + (res && res.error ? " (" + res.error + ")" : "") +
        " — رجّعناه لـ " + fmt(oldOp) + " ج.م زي ما كان. اتأكد من الاتصال وحاول تاني.", "error");
    });
  }

  // 🛡 بناء 119: مواءمة الأرصدة الافتتاحية مع السحابة بعد أي تعديل من تبويب
  // «إعدادات مؤسستك» (بنوك/محافظ) — بنكتب بس السطور اللي المستخدم غيّرها فعلًا.
  // ليه مش كل اختلاف؟ لأن الجهاز اللي فتح التبويب من بدري ولسه ماسك رقم قديم
  // لازم مايرفعوش فوق رقم جهاز تاني. بنقارن بـ«مرجع اللحظة اللي فتح فيها التبويب»
  // (openingBaseline)، وبنحدّث المرجع بعد كل كتابة ناجحة.
  let openingBaseline = null;
  function captureOpeningBaseline() {
    openingBaseline = {};
    (treasury || []).forEach((t) => {
      openingBaseline[Number(t.id)] = Math.round((Number(t.openingBalance) || 0) * 100) / 100;
    });
  }
  function syncOpeningsWithCloud() {
    if (!A.online || !window.CLOUD || !CLOUD.setTreasuryOpening) return Promise.resolve({ fixed: 0 });
    if (!DATA || !DATA.client || !DATA.client() || !DATA.orgId()) return Promise.resolve({ fixed: 0 });
    if (!openingBaseline) { captureOpeningBaseline(); return Promise.resolve({ fixed: 0, first: true }); }
    const jobs = [];
    (treasury || []).forEach((t) => {
      const localOp = Math.round((Number(t.openingBalance) || 0) * 100) / 100;
      const baseOp = openingBaseline[Number(t.id)];
      if (baseOp != null && Math.abs(baseOp - localOp) <= 0.001) return;  // ما اتغيّرش ⇒ مافيش كتابة
      jobs.push(CLOUD.setTreasuryOpening(t, localOp)
        .then((res) => { if (res && res.ok) openingBaseline[Number(t.id)] = localOp; return res && res.ok ? 1 : 0; }));
    });
    if (!jobs.length) return Promise.resolve({ fixed: 0 });
    return Promise.all(jobs).then((oks) => ({ fixed: oks.reduce((a, b) => a + b, 0) }));
  }

  function saveTreasuryModal() {
    const name = $("#tName").value.trim();
    if (!name) {
      toast("اسم الخزينة مطلوب.", "warning");
      return;
    }
    const type = $("#tType").value;
    // 🆕 بناء 118: الرصيد الافتتاحي كان بيتمر في التعديل (الخانة بتتعرض بـ fmt و«تم حفظ
    // التعديلات» بتقول نجاح، بس الرقم ما كان بيتخزنش) ⇒ صاحب الخزينة كان فاكر إن فيها
    // فلوس والبرنامج بيحسب من صفر — وده بالظبط سبب تحذير «رصيد الخزينة أقل من المصروف» الكاذب.
    const opening = moneyVal("#tOpening");
    if (treasuryEditingId) {
      const t = treasury.find((x) => x.id === treasuryEditingId);
      const oldOp = Math.round((Number(t.openingBalance) || 0) * 100) / 100;
      const opChanged = Math.abs(oldOp - opening) > 0.001;
      t.name = name;
      t.type = type;
      t.accountNo = $("#tAccountNo").value.trim();
      if (opChanged) t.openingBalance = opening;
      saveTreasury();
      // الرصيد الجاري = الافتتاحي + الحركة: أي تغيير في الافتتاحي لازم يعيد الحساب فورًا
      if (opChanged) recalculateTreasuryBalances();
      syncTreasuryItemToSett(t);
      addActivity("تعديل خزينة", "تعديل بيانات الخزينة: " + name +
        (opChanged ? " — الرصيد الافتتاحي من " + fmt(oldOp) + " إلى " + fmt(opening) + " ج.م" : ""));
      if (opChanged) {
        // 🛡 بناء 119: الحفظ في تلات أماكن (الخزينة / تبويب الضبط / سطر السحابة)
        // والمراجعة من السحابة هي اللي بتقول «تم» — مش الكلام قبل ما نتأكد.
        saveSettMirrorForTreasury(t);
        if (A.online) {
          toast("بنحدّث الرصيد الافتتاحي على السحابة…", "info");
          verifyTreasuryOpening(t, oldOp, opening);
        } else {
          toast(opChanged
            ? "تم حفظ التعديلات، والرصيد بقى " + fmt((treasury.find((x) => x.id === treasuryEditingId) || {}).balance) + " ج.م."
            : "تم حفظ التعديلات بنجاح.", "success");
        }
      } else {
        toast("تم حفظ التعديلات بنجاح.", "success");
      }
    } else {
      const t = {
        id: treasury.reduce((m, x) => Math.max(m, x.id), 0) + 1,
        name: name,
        type: type,
        accountNo: $("#tAccountNo").value.trim(),
        openingBalance: opening,
        balance: opening
      };
      treasury.push(t);
      saveTreasury();
      syncTreasuryItemToSett(t);
      addActivity("إضافة خزينة", "إضافة خزينة جديدة: " + name);
      // 🛡 بناء 119: الافتتاحي مالوش مكان في الرفع الجماعي ⇒ كتابة مباشرة لسطره هو
      if (A.online && Math.abs(opening) > 0.001) {
        saveSettMirrorForTreasury(t);
        verifyTreasuryOpening(t, 0, opening);
      } else toast("تمت إضافة الخزينة بنجاح.", "success");
    }
    hideModal("mTreasury");
    renderTreasury();
  }

  function openVoucher(mode) {
    voucherMode = mode;
    $("#voucherTitle").textContent = mode === "in" ? "➕ سند قبض (إيراد)" : "➖ سند صرف (مصروف)";
    fillTreasurySelect("#vTreasury"); // 🆕 بناء 118: الأرصدة تبان في القائمة (النقدية أولًا) بدل اسم بس
    $("#vDate").value = todayISO();
    $("#vAmount").value = "";
    $("#vDesc").value = mode === "in" ? "إيراد (سند قبض)" : "مصروف (سند صرف)";
    $("#vHint").textContent = mode === "in"
      ? "✅ المبلغ هينزل في الحساب اللي هتختاره، والرصيد بيتحدّث تلقائيًا."
      : "✅ المبلغ هيطلع من الحساب اللي هتختاره، والرصيد بيتحدّث تلقائيًا.";
    rememberHintBase("#vHint");
    wireLiveBalanceHint("voucher", [{ amount: "#vAmount", treasury: "#vTreasury", hint: "#vHint", mode: () => (voucherMode === "in" ? "income" : "expense") }]);
    liveBalanceHint("#vAmount", "#vTreasury", "#vHint", voucherMode === "in" ? "income" : "expense");
    showModal("mVoucher");
    $("#vAmount").focus();
  }

  function saveVoucher() {
    const tid = parseInt($("#vTreasury").value, 10);
    const amount = moneyVal("#vAmount");
    if (!tid) {
      toast("يرجى اختيار الخزينة.", "warning");
      return;
    }
    if (!(amount > 0)) {
      toast("يرجى كتابة مبلغ صحيح أكبر من الصفر.", "warning");
      return;
    }
    const t = treasury.find((x) => x.id === tid);
    if (!t) { toast("اختار الحساب: خزينة نقدية أو بنك أو محفظة.", "warning"); return; }
    // 🆕 بناء 118: سند الصرف كباقي الشاشات — تحذير بالأرقام قبل ما الرصيد يروح بالسالب
    if (voucherMode !== "in") {
      const bal = round2(t.balance);
      if (amount > bal) {
        if (!confirm(shortfallText(t, amount) + "\n\nهل تريد تسجيل سند الصرف من «" + t.name + "» رغم ذلك؟")) return;
      }
    }
    const sign = voucherMode === "in" ? 1 : -1;
    t.balance = round2(t.balance + sign * amount);
    vouchers.push({
      id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      type: voucherMode,
      treasuryId: tid,
      date: $("#vDate").value || todayISO(),
      amount: Math.round(amount * 100) / 100,
      desc: $("#vDesc").value.trim() || (voucherMode === "in" ? "إيراد" : "مصروف")
    });
    saveTreasury();
    syncTreasuryItemToSett(t);
    saveVouchers();
    hideModal("mVoucher");
    addActivity(voucherMode === "in" ? "سند قبض" : "سند صرف", (voucherMode === "in" ? "قبض إيراد" : "صرف مصروف") + " بمبلغ " + fmt(amount) + " ج.م (" + t.name + ")");
    toast("تم حفظ السند بنجاح.", "success");
    renderTreasury();
    renderTreMoves();
  }

  function renderTreMoves() {
    const moves = [];
    sales.filter((s) => s.treasuryId && s.paymentMethod !== "آجل").forEach((s) => moves.push({ date: s.invoiceDate || s.date || todayISO(), name: (treasury.find((t) => Number(t.id) === Number(s.treasuryId)) || {}).name || "-", desc: "فاتورة مبيعات " + (s.invoiceNumber || s.invoiceNo), in: s.grandTotal, out: 0 }));
    purchases.filter((p) => p.treasuryId && p.paymentMethod !== "آجل").forEach((p) => moves.push({ date: p.invoiceDate || p.date || todayISO(), name: (treasury.find((t) => Number(t.id) === Number(p.treasuryId)) || {}).name || "-", desc: "فاتورة مشتريات " + (p.invoiceNumber || p.invoiceNo), in: 0, out: p.grandTotal }));
    vouchers.forEach((v) => moves.push({ date: v.date, name: (treasury.find((t) => Number(t.id) === Number(v.treasuryId)) || {}).name || "-", desc: v.desc || (v.type === "in" ? "إيراد (سند قبض)" : "مصروف (سند صرف)"), in: (v.type === "in" || v.kind === "in") ? v.amount : 0, out: (v.type === "out" || v.kind === "out") ? v.amount : 0 }));
    moves.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = $("#dgvTreMoves tbody");
    tbody.innerHTML = "";
    moves.slice(0, 60).forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(m.date) + '</td>' +
        '<td>' + esc(m.name) + '</td>' +
        '<td style="text-align:right">' + esc(m.desc) + '</td>' +
        amtTd(m.in, "in", true) +
        amtTd(m.out, "out", true);
      tbody.appendChild(tr);
    });
    if (!moves.length) tbody.innerHTML = '<tr><td colspan="5">لا توجد حركات بعد.</td></tr>';
  }

  /* ================== دليل الحسابات ================== */
  let editingAccountId = null;

  function nextAccountId() {
    return accounts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  }

  function nextAccountCode() {
    return "ACC-" + String(accounts.length + 1).padStart(3, "0");
  }

  function renderAccounts() {
    const tbody = $("#dgvAccounts tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtAccountSearch").value);
    accounts
      .filter((a) => {
        if (!q) return true;
        return normalizeAr(a.code).includes(q) || normalizeAr(a.nameAr).includes(q) || normalizeAr(a.type).includes(q);
      })
      .forEach((a) => {
        const parent = accounts.find((p) => p.id === a.parentId);
        const typeName = a.type === "asset" ? "أصل" : a.type === "liability" ? "التزام" : a.type === "equity" ? "حقوق ملكية" : a.type === "revenue" ? "إيراد" : "مصروف";
        const debit = a.type === "asset" || a.type === "expense";
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(a.code) + '</td>' +
          '<td>' + esc(a.nameAr) + '</td>' +
          '<td>' + typeName + '</td>' +
          '<td>' + esc(parent ? parent.nameAr : "—") + '</td>' +
          '<td class="' + (debit ? "balance-debit" : "balance-credit") + '">' + fmt(a.openingBalance || 0) + (debit ? " (مدين)" : " (دائن)") + '</td>' +
          '<td>' + (a.isActive ? "نشط 🟢" : "غير نشط 🔴") + '</td>';
        tr.dataset.aid = a.id;
        tr.addEventListener("dblclick", () => openAccountDialog(a));
        tbody.appendChild(tr);
      });
  }

  function openAccountDialog(a) {
    editingAccountId = a ? a.id : null;
    $("#accountModalTitle").textContent = a ? "✏️ تعديل الحساب" : "➕ إضافة حساب";
    $("#aCode").value = a ? a.code : nextAccountCode();
    $("#aName").value = a ? a.nameAr : "";
    $("#aType").value = a ? a.type : "asset";
    const sel = $("#aParent");
    sel.innerHTML = '<option value="0">— بدون حساب أب —</option>';
    accounts.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.code + " - " + p.nameAr;
      sel.appendChild(opt);
    });
    sel.value = a ? String(a.parentId || 0) : "0";
    $("#aOpening").value = a ? moneyStr(a.openingBalance || 0) : "0";
    $("#aActive").value = a ? (a.isActive ? "1" : "0") : "1";
    showModal("mAccount");
    $("#aName").focus();
  }

  function saveAccount() {
    const name = $("#aName").value.trim();
    if (!name) {
      toast("اسم الحساب مطلوب.", "warning");
      return;
    }
    const type = $("#aType").value;
    const opening = moneyVal("#aOpening") || 0;
    if (editingAccountId) {
      const a = accounts.find((x) => x.id === editingAccountId);
      a.code = $("#aCode").value.trim();
      a.nameAr = name;
      a.type = type;
      a.parentId = parseInt($("#aParent").value, 10) || 0;
      a.openingBalance = opening;
      a.isActive = $("#aActive").value === "1";
      saveAccounts();
      toast("تم حفظ التعديلات بنجاح.", "success");
    } else {
      accounts.push({
        id: nextAccountId(),
        code: $("#aCode").value.trim() || nextAccountCode(),
        nameAr: name,
        type: type,
        parentId: parseInt($("#aParent").value, 10) || 0,
        openingBalance: opening,
        isActive: $("#aActive").value === "1"
      });
      saveAccounts();
      toast("تمت إضافة الحساب بنجاح.", "success");
    }
    hideModal("mAccount");
    renderAccounts();
  }

  /* ================== القيود اليومية ================== */
  let jrnLines = [];
  let journalEditingId = null;

  function renderJournal() {
    const tbody = $("#dgvJournal tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtJournalSearch").value);
    const list = journalEntries.filter((j) => {
      if (!q) return true;
      return normalizeAr(j.number).includes(q) || normalizeAr(j.desc).includes(q) || normalizeAr(j.ref).includes(q);
    });
    list.forEach((j) => {
      const tr = document.createElement("tr");
      // 🆕 بناء 123: القيد اللي على شجرة الإيرادات أخضر، واللي على المصروفات أحمر،
      // والاختلاط المتوازن ما يتلونش (مافيش لون على تخمين)
      const jdir = jrnDir(j);
      tr.innerHTML =
        '<td hidden></td>' +
        '<td>' + esc(j.number) + '</td>' +
        '<td>' + esc(j.date) + '</td>' +
        '<td style="text-align:right">' + esc(j.desc) + '</td>' +
        amtTd(j.debit, jdir) +
        amtTd(j.credit, jdir) +
        '<td>' + esc(j.ref) + '</td>';
      tr.addEventListener("dblclick", () => {
        if (confirm("هل تريد طباعة كشف القيد رقم (" + j.number + ")؟")) {
          printStatementDoc({
            name: "قيد يومية " + j.number,
            code: j.ref,
            range: j.date,
            balance: 0,
            rows: [
              { date: j.date, desc: "إجمالي المديون (قيد " + j.number + ")", debit: j.debit, credit: 0, balance: j.debit },
              { date: j.date, desc: "إجمالي الدائن (قيد " + j.number + ")", debit: 0, credit: j.credit, balance: 0 }
            ]
          });
        }
      });
      tbody.appendChild(tr);
    });
    if (!list.length) tbody.innerHTML = '<tr><td colspan="7">لا توجد قيود بعد.</td></tr>';
  }

  function openJournal() {
    journalEditingId = null;
    $("#jDate").value = todayISO();
    $("#jDesc").value = "";
    $("#jRef").value = "قيد يدوي";
    jrnLines = [{ accountId: "0", accountText: "", debit: "", credit: "" }, { accountId: "0", accountText: "", debit: "", credit: "" }];
    renderJrnLines();
    showModal("mJournal");
    $("#jDesc").focus();
  }

  function renderJrnLines() {
    const box = $("#jrnLines");
    box.innerHTML = "";
    // datalist مشترك لكل أسطر القيد يعرض كل الحسابات النشطة
    let dlId = "jrnAccountsList";
    let dl = document.getElementById(dlId);
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = dlId;
      document.body.appendChild(dl);
    }
    dl.innerHTML = "";
    accounts.filter((a) => a.parentId !== 0 && a.isActive).forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.code + " - " + a.nameAr;
      dl.appendChild(opt);
    });
    jrnLines.forEach((line, i) => {
      const div = document.createElement("div");
      div.className = "jrn-line";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.dataset.i = i;
      inp.dataset.f = "accountId";
      inp.autocomplete = "off";
      inp.placeholder = "اكتب كود أو اسم الحساب...";
      inp.setAttribute("list", dlId);
      inp.value = line.accountText || (line.accountId && line.accountId !== "0" ? (accounts.find((a) => a.id === parseInt(line.accountId, 10)) || {}).nameAr || "" : "");
      inp.addEventListener("input", () => {
        jrnLines[i].accountId = "0";
        jrnLines[i].accountText = inp.value;
        $("#jrnSum").textContent = jrnSummary();
      });
      const dIn = document.createElement("input");
      dIn.dataset.i = i; dIn.dataset.f = "debit"; dIn.type = "text"; dIn.value = line.debit;
      dIn.addEventListener("input", () => { jrnLines[i].debit = dIn.value; $("#jrnSum").textContent = jrnSummary(); });
      const dOut = document.createElement("input");
      dOut.dataset.i = i; dOut.dataset.f = "credit"; dOut.type = "text"; dOut.value = line.credit;
      dOut.addEventListener("input", () => { jrnLines[i].credit = dOut.value; $("#jrnSum").textContent = jrnSummary(); });
      const btn = document.createElement("button");
      btn.className = "btn small red"; btn.type = "button"; btn.textContent = "❌";
      btn.addEventListener("click", () => {
        jrnLines.splice(i, 1);
        if (!jrnLines.length) jrnLines.push({ accountId: "0", accountText: "", debit: "", credit: "" });
        renderJrnLines();
      });
      div.appendChild(inp); div.appendChild(dIn); div.appendChild(dOut); div.appendChild(btn);
      box.appendChild(div);
    });
    $("#jrnSum").textContent = jrnSummary();
  }

  // حسم نص الحساب المكتوب إلى حساب فعلي (كود أو اسم أو جزء من الاسم)
  function resolveJournalAccount(text) {
    const q = String(text || "").trim();
    if (!q) return null;
    const list = accounts.filter((a) => a.parentId !== 0 && a.isActive);
    let hit = list.find((a) => String(a.code) === q) || list.find((a) => a.code && q.startsWith(a.code) && q.slice(a.code.length).trim().startsWith("-"));
    if (hit) return hit;
    hit = list.find((a) => a.nameAr === q);
    if (hit) return hit;
    hit = list.find((a) => (a.nameAr || "").indexOf(q) !== -1);
    if (hit) return hit;
    return null;
  }

  function jrnSummary() {
    let d = 0, c = 0;
    jrnLines.forEach((l) => {
      d += parseFloat(l.debit) || 0;
      c += parseFloat(l.credit) || 0;
    });
    d = Math.round(d * 100) / 100; c = Math.round(c * 100) / 100;
    const ok = Math.abs(d - c) < 0.01;
    return "المديون: " + fmt(d) + " | الدائن: " + fmt(c) + " | " + (ok ? "✓ متوازن" : "✗ غير متوازن (الفرق " + fmt(Math.abs(d - c)) + ")");
  }

  function saveJournal() {
    const desc = $("#jDesc").value.trim();
    if (!desc) {
      toast("بيان القيد مطلوب.", "warning");
      return;
    }
    let d = 0, c = 0;
    for (const l of jrnLines) {
      let aid = parseInt(l.accountId, 10);
      if (!aid && l.accountText) {
        const hit = resolveJournalAccount(l.accountText);
        if (hit) { aid = hit.id; l.accountId = String(hit.id); }
      }
      if (!aid) {
        toast("يرجى اختيار حساب لكل سطر (اكتب كود أو اسم الحساب).", "warning");
        return;
      }
      d += parseFloat(l.debit) || 0;
      c += parseFloat(l.credit) || 0;
    }
    d = Math.round(d * 100) / 100; c = Math.round(c * 100) / 100;
    if (d <= 0 && c <= 0) {
      toast("أدخل مبالغ للقيد.", "warning");
      return;
    }
    if (Math.abs(d - c) > 0.01) {
      toast("القيد غير متوازن: المديون " + fmt(d) + " والدائن " + fmt(c) + ".", "warning");
      return;
    }
    const j = {
      id: journalEntries.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      number: "JRN-" + String(journalEntries.length + 1).padStart(4, "0"),
      date: $("#jDate").value || todayISO(),
      desc: desc,
      ref: $("#jRef").value.trim() || "قيد يدوي",
      debit: d,
      credit: c,
      lines: jrnLines.map((l) => ({ accountId: parseInt(l.accountId, 10), debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 }))
    };
    const dAccount = accounts.find((a) => a.id === j.lines[0].accountId);
    const cAccount = accounts.find((a) => a.id === j.lines[j.lines.length - 1].accountId);
    if (dAccount) dAccount.openingBalance = Math.round(((dAccount.openingBalance || 0) + d) * 100) / 100;
    if (cAccount && cAccount.id !== dAccount.id) cAccount.openingBalance = Math.round(((cAccount.openingBalance || 0) - c) * 100) / 100;
    journalEntries.push(j);
    persistJournal();
    saveAccounts();
    hideModal("mJournal");
    addActivity("قيد يومية", "قيد " + j.number + " - " + j.desc + " - " + fmt(d) + " ج.م");
    toast("تم حفظ القيد بنجاح (" + j.number + ").", "success");
    renderJournal();
  }

  /* ================== 🆕 بناء 115: تبسيط القيود اليومية ==================
     أزرار «تسجيل مصروفات / تسجيل إيرادات / تحويل من حساب إلى حساب» يترجمها
     البرنامج تلقائيًا إلى: سند خزينة (out/in) + قيد يومية بسطرين + تسوية
     أرصدة دليل الحسابات — بنفس آليات saveVoucher/saveJournal القديمة تمامًا،
     بدون تعديل أي دالة موجودة. البند = حساب ورقي تحت جذر المصروفات/الإيرادات،
     فبيتزامن مع كل أجهزة الشركة وبيدخل النسخ الاحتياطي من غير جداول جديدة. */

  let simpleMode = "expense"; // "expense" | "income"

  // البوابة الثانية جوه الدوال نفسها (نمط المرتجعات/الحضور): حصانة حتى لو اتنادت الدالة مباشرة
  function canUseSimpleJournal() {
    return isSuperAcct() || isCompanyOwnerAcct();
  }
  function simpleGate(msg) {
    if (canUseSimpleJournal()) return true;
    toast(msg || "التسجيل في القيود متاح لصاحب الشركة والمالك فقط.", "error");
    return false;
  }

  // أوراق المصروفات/الإيرادات (بنود التسجيل المبسط): نوعها expense/revenue، ليست جذرًا ولا أبًا لحساب آخر
  function leafItemAccounts(type) {
    return accounts.filter((a) => a.type === type && a.parentId !== 0 && a.isActive &&
      !accounts.some((x) => Number(x.parentId) === Number(a.id)));
  }

  // جذر شجرة الإيرادات (4) أو المصروفات (5): حساب النوع بدون أب
  function itemRootAccount(type) {
    return accounts.find((a) => a.type === type && Number(a.parentId) === 0) || null;
  }

  // كود جديد تحت الأب (5 → 5.3 مثلًا): أكبر لاحقة عددية مستخدمة + 1
  function nextItemCode(parent) {
    const base = String(parent.code || (parent.type === "revenue" ? "4" : "5"));
    let n = 1;
    accounts.forEach((a) => {
      if (Number(a.parentId) !== Number(parent.id)) return;
      const c = String(a.code || "");
      if (c.indexOf(base + ".") !== 0) return;
      const num = parseInt(c.slice(base.length + 1), 10);
      if (!isNaN(num) && num >= n) n = num + 1;
    });
    return base + "." + n;
  }

  // خزينة → حساب الدليل المقابل (نقدية 1.1.1 / بنك 1.1.2 / محفظة 1.1.3) مع احتياطي بالاسم ثم بالنقدية
  function accForTreasuryAcc(t) {
    const byCode = { cash: "1.1.1", bank: "1.1.2", wallet: "1.1.3" };
    const byName = { cash: "صناديق", bank: "البنوك", wallet: "المحافظ" };
    const key = t && byCode[t.type] ? t.type : "cash";
    let a = accounts.find((x) => String(x.code) === byCode[key] && x.isActive);
    if (a) return a;
    a = accounts.find((x) => x.type === "asset" && Number(x.parentId) !== 0 && x.isActive && (x.nameAr || "").includes(byName[key]));
    if (a) return a;
    return accounts.find((x) => String(x.code) === "1.1.1" && x.isActive) || null;
  }

  // قائمة خزائن بملصق الرصيد، والنقدية أولًا (المفضل) ثم البنوك فالمحافظ
  function fillTreasurySelect(selId) {
    const el = $(selId);
    el.innerHTML = "";
    const ORD = { cash: 0, bank: 1, wallet: 2 };
    const rank = (t) => (ORD[t.type] !== undefined ? ORD[t.type] : 3);
    const list = treasury.slice().sort((a, b) => rank(a) - rank(b) || String(a.name || "").localeCompare(String(b.name || ""), "ar"));
    list.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      const typeLbl = t.type === "bank" ? "بنك" : t.type === "wallet" ? "محفظة" : "نقدية";
      opt.textContent = t.name + " (" + typeLbl + ") — رصيد " + fmt(t.balance || 0) + " ج.م";
      el.appendChild(opt);
    });
    return list;
  }

  /* 🆕 بناء 118: شفافية نقص الرصيد (بأمر المالك: «قال لي الرصيد أقل مع إن الخزينة فيها فلوس أعلى»).
   * الرسالة القديمة كانت بتقول اسم حساب واحد ورصيد وحيد — فلو الفلوس في حساب تاني أو لو
   * الخانة كانت بترّم المبلغ (باگ الفواصل اللي اتصلّح) كانت بتبان غلط.
   * الدالة دي بتلمّ الأرقام اللي العميل محتاجها: رصيد الحساب المختار + أعلى حسابات فيها فلوس + إجمالي الكل. */
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  function treasuryTypeLabel(t) {
    return (t && t.type) === "bank" ? "بنك" : (t && t.type) === "wallet" ? "محفظة" : "نقدية";
  }

  // الحسابات التانية اللي فيها فلوس (بالترتيب النزولي) + إجمالي أرصدة كل الحسابات
  function fundedAccounts(excludeId, limit) {
    const rows = treasury.filter((t) => Number(t.id) !== Number(excludeId) && round2(t.balance) > 0);
    rows.sort((a, b) => round2(b.balance) - round2(a.balance));
    const total = treasury.reduce((s, t) => s + round2(t.balance), 0);
    return { list: rows.slice(0, limit || 3), others: rows.length, total: round2(total) };
  }

  function linesForFunded(f) {
    if (!f.list.length) return [];
    return f.list.map((x) => "• " + x.name + " (" + treasuryTypeLabel(x) + ") — " + fmt(round2(x.balance)) + " ج.م");
  }

  // نص تحذير نقص الرصيد — ودّي بالعربي ومحمّل بالأرقام، من غير أي تشخيص تقني للعميل
  function shortfallText(t, amount, verb) {
    const bal = round2(t.balance);
    const f = fundedAccounts(t.id, 3);
    const v = verb === "transfer" ? "التحويل" : "الصرف";
    const out = ["رصيد «" + t.name + "» (" + treasuryTypeLabel(t) + ") حاليًا " + fmt(bal) + " ج.م، والمبلغ المطلوب " + fmt(amount) + " ج.م."];
    const lines = linesForFunded(f);
    if (lines.length) {
      out.push("", "حسابات تانية فيها فلوس:", lines.join("\n"));
      out.push("", "مجموع أرصدة كل الحسابات: " + fmt(f.total) + " ج.م");
    } else {
      out.push("", "مافيش حساب تاني فيه رصيد حاليًا — مجموع أرصدة كل الحسابات " + fmt(f.total) + " ج.م");
    }
    out.push("", "لو الفلوس دي كانت داخلة الشركة، ممكن تكون مسجّلة في حساب تاني أو جوه الرصيد الافتتاحي.");
    out.push(lines.length
      ? "تقدر تختار الحساب المناسب من القائمة، أو تكمّل من «" + t.name + "» فيفضل رصيدها " + fmt(round2(bal - amount)) + " ج.م بعد " + v + "."
      : "لو كمّلت من «" + t.name + "» هيكون رصيدها " + fmt(round2(bal - amount)) + " ج.م بعد " + v + ".");
    return out.join("\n");
  }

  // اللايف hint: يتحدّث وهو بيكتب — والنص الأصلي للنافذة بيرجع لما مافيش سبب للتحذير
  function rememberHintBase(hintSelId) {
    const h = $(hintSelId);
    if (h) h.dataset.base = h.textContent || "";
  }

  function liveBalanceHint(amountSelId, treasurySelId, hintSelId, mode) {
    const hint = $(hintSelId);
    const m = typeof mode === "function" ? mode() : mode;
    // 🎨 بناء 123 (بند 5): خانة المبلغ بتاخد اتجاه العملية (قبض أخضر / صرف أحمر).
    //    التحويل «مافيش عليه لون»: المبلغ مش إيراد ولا مصروف، ده بنقل بين حسابات الشركة.
    paintDir(amountSelId, m === "income" ? "in" : m === "expense" ? "out" : "");
    if (!hint) return;
    const base = hint.dataset.base !== undefined ? hint.dataset.base : (hint.textContent || "");
    const amount = round2(moneyVal(amountSelId));
    const tid = parseInt((($(treasurySelId) || {})).value, 10);
    const t = treasury.find((x) => Number(x.id) === tid);
    if (!(amount > 0) || !t) { hint.style.color = ""; hint.textContent = base; return; }
    const bal = round2(t.balance);
    if (m === "income") {
      hint.style.color = "";
      hint.textContent = "✅ رصيد «" + t.name + "» " + fmt(bal) + " ج.م — بعد القبض يبقى " + fmt(round2(bal + amount)) + " ج.م.";
      return;
    }
    if (amount <= bal) {
      hint.style.color = "";
      hint.textContent = "✅ رصيد «" + t.name + "» " + fmt(bal) + " ج.م — " +
        (m === "transfer" ? "بعد التحويل يبقى " : "بعد الصرف يبقى ") + fmt(round2(bal - amount)) + " ج.م.";
      return;
    }
    const f = fundedAccounts(t.id, 3);
    let msg = "⚠️ «" + t.name + "» رصيدها " + fmt(bal) + " ج.م والمبلغ " + fmt(amount) + " ج.م.";
    if (f.list.length) {
      msg += " أكتر حساب فيه فلوس: «" + f.list[0].name + "» (" + fmt(round2(f.list[0].balance)) + " ج.م) — تقدر تختاره من القائمة.";
    } else {
      msg += " مافيش حساب تاني فيه رصيد حاليًا.";
    }
    msg += " مجموع أرصدة كل الحسابات " + fmt(f.total) + " ج.م.";
    msg += " ولو كمّلت منها هيكون رصيدها " + fmt(round2(bal - amount)) + " ج.م.";
    hint.style.color = "#c0392b";
    hint.textContent = msg;
  }

  // ربط ليزنرات اللايف مرة واحدة بس لكل نافذة (العناصر ثابتة في DOM)
  const LIVE_HINT_DONE = {};
  function wireLiveBalanceHint(key, specs) {
    if (LIVE_HINT_DONE[key]) return;
    LIVE_HINT_DONE[key] = true;
    specs.forEach((sp) => {
      [sp.amount, sp.treasury].forEach((selId) => {
        const el = $(selId);
        if (!el) { LIVE_HINT_DONE[key] = false; return; }
        el.addEventListener("input", () => liveBalanceHint(sp.amount, sp.treasury, sp.hint, sp.mode));
        el.addEventListener("change", () => liveBalanceHint(sp.amount, sp.treasury, sp.hint, sp.mode));
      });
    });
  }

  // datalist حيّ لأي حقل نصي (بنود / حسابات دفتر الحركة)
  function ensureDatalist(dlId, values) {
    let dl = document.getElementById(dlId);
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = dlId;
      document.body.appendChild(dl);
    }
    dl.innerHTML = "";
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
    });
    return dl;
  }

  function openSimpleEntry(mode) {
    if (!simpleGate()) return;
    simpleMode = mode === "income" ? "income" : "expense";
    const income = simpleMode === "income";
    const type = income ? "revenue" : "expense";
    $("#simpleTitle").textContent = income ? "➕ تسجيل إيرادات" : "➖ تسجيل مصروفات";
    $("#lblSimpleItem").textContent = income ? "بند الإيراد: *" : "البند المنصرف عليه: *";
    $("#lblSimpleTreasury").textContent = income ? "قبض في: *" : "دفع من: *";
    $("#simpleItem").value = "";
    $("#simpleAmount").value = "";
    $("#simpleNotes").value = "";
    $("#simpleDate").value = todayISO();
    ensureDatalist("simpleItemList", leafItemAccounts(type).map((a) => a.nameAr));
    $("#simpleItem").setAttribute("list", "simpleItemList");
    fillTreasurySelect("#simpleTreasury");
    $("#simpleHint").textContent = income
      ? "✅ المبلغ هينزل فعليًا في الحساب اللي هتختاره، والبرنامج يسجّل السند والقيد والترحيل تلقائيًا."
      : "✅ المبلغ هيطلع فعليًا من الحساب اللي هتختاره (المُفضّل النقدية، ويتغير لبنك أو محفظة)، والبرنامج يسجّل السند والقيد والترحيل تلقائيًا.";
    rememberHintBase("#simpleHint");
    wireLiveBalanceHint("simple", [{ amount: "#simpleAmount", treasury: "#simpleTreasury", hint: "#simpleHint", mode: () => simpleMode }]);
    liveBalanceHint("#simpleAmount", "#simpleTreasury", "#simpleHint", income ? "income" : "expense");
    showModal("mSimpleEntry");
    $("#simpleItem").focus();
  }

  // حسم نص البند إلى حساب بنود صحيح من نوعه؛ بند جديد تمامًا ⇒ اقتراح إضافته تلقائيًا
  function resolveItemAccount(text, type) {
    const q = String(text || "").trim();
    if (!q) return null;
    const leaves = leafItemAccounts(type);
    let hit = leaves.find((a) => normalizeAr(a.nameAr) === normalizeAr(q)) ||
      leaves.find((a) => normalizeAr(a.nameAr).includes(normalizeAr(q))) ||
      leaves.find((a) => normalizeAr(q).includes(normalizeAr(a.nameAr)));
    return hit || null;
  }

  function saveSimpleEntry() {
    if (!simpleGate()) return;
    const income = simpleMode === "income";
    const type = income ? "revenue" : "expense";
    const date = $("#simpleDate").value || todayISO();
    const amount = Math.round((moneyVal("#simpleAmount") || 0) * 100) / 100;
    const itemText = $("#simpleItem").value.trim();
    const tid = parseInt($("#simpleTreasury").value, 10);
    const t = treasury.find((x) => Number(x.id) === tid);
    if (!itemText) { toast("اكتب اسم البند أو اختاره من القائمة.", "warning"); return; }
    if (!(amount > 0)) { toast("اكتب مبلغًا صحيحًا أكبر من الصفر.", "warning"); return; }
    if (!t) { toast("اختار الحساب: خزينة نقدية أو بنك أو محفظة.", "warning"); return; }

    let itemAcc = resolveItemAccount(itemText, type);
    if (!itemAcc) {
      const root = itemRootAccount(type);
      const lbl = income ? "إيراد" : "مصروف";
      if (!root) { toast("لا يوجد حساب جذر لـ" + (income ? "الإيرادات" : "المصروفات") + " في دليل الحسابات — أضفه من شاشة الحسابات أولًا.", "error"); return; }
      if (!confirm("البند «" + itemText + "» مش ضمن بنود الـ" + lbl + " الموجودة.\nإضافه كبند جديد تحت «" + root.nameAr + "»؟")) return;
      itemAcc = {
        id: nextAccountId(),
        code: nextItemCode(root),
        nameAr: itemText,
        type: type,
        parentId: root.id,
        openingBalance: 0,
        isActive: true
      };
      accounts.push(itemAcc);
      saveAccounts();
    }

    const cashAcc = accForTreasuryAcc(t);
    if (!cashAcc) { toast("لا يوجد حساب خزينة مطابق في دليل الحسابات.", "error"); return; }

    // تحذير الرصيد: بالأرقام الكاملة (رصيد الحساب + الحسابات اللي فيها فلوس + الإجمالي)
    // والمالك قرر الحفظ يتم بعد موافقته (يروح بالسالب) — بلا أي قصّ صامت
    if (!income) {
      const bal = round2(t.balance);
      if (amount > bal) {
        if (!confirm(shortfallText(t, amount) + "\n\nهل تريد المتابعة من «" + t.name + "» رغم ذلك؟")) return;
      }
    }

    const note = $("#simpleNotes").value.trim();
    const vDesc = (income ? "إيراد: " : "مصروف: ") + itemAcc.nameAr + (note ? " — " + note : "");
    vouchers.push({
      id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      type: income ? "in" : "out",
      treasuryId: Number(t.id),
      date: date,
      amount: amount,
      desc: vDesc
    });
    saveVouchers();
    recalculateTreasuryBalances(); // نفس معادلة الأرصدة القديمة: السند اتضاف فبيتحسب تلقائيًا

    const lines = income
      ? [{ accountId: cashAcc.id, debit: amount, credit: 0 }, { accountId: itemAcc.id, debit: 0, credit: amount }]
      : [{ accountId: itemAcc.id, debit: amount, credit: 0 }, { accountId: cashAcc.id, debit: 0, credit: amount }];
    const j = {
      id: journalEntries.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      number: "JRN-" + String(journalEntries.length + 1).padStart(4, "0"),
      date: date,
      desc: vDesc,
      ref: income ? "تسجيل إيرادات" : "تسجيل مصروفات",
      debit: amount,
      credit: amount,
      lines: lines
    };
    // نفس تسوية saveJournal لأرصدة الدليل: الطرف المدين +، والدائن − (لو الحسابان مختلفان)
    const dAcc = accounts.find((a) => Number(a.id) === lines[0].accountId);
    const cAcc = accounts.find((a) => Number(a.id) === lines[lines.length - 1].accountId);
    if (dAcc) dAcc.openingBalance = Math.round(((dAcc.openingBalance || 0) + amount) * 100) / 100;
    if (cAcc && Number(cAcc.id) !== Number(dAcc.id)) cAcc.openingBalance = Math.round(((cAcc.openingBalance || 0) - amount) * 100) / 100;
    journalEntries.push(j);
    persistJournal();
    saveAccounts();

    hideModal("mSimpleEntry");
    addActivity(j.ref, vDesc + " (" + t.name + ")");
    toast("تم التسجيل (" + j.number + ") وترحيله على حساب «" + t.name + "\".", "success");
    renderJournal();
    renderLedger();
    renderCItems();
    try { renderTreasury(); renderTreMoves(); } catch (e) { }
  }

  function openTransferEntry() {
    if (!simpleGate()) return;
    $("#trAmount").value = "";
    $("#trNotes").value = "";
    $("#trDate").value = todayISO();
    const list = fillTreasurySelect("#trAccFrom");
    fillTreasurySelect("#trAccTo");
    if (list[1]) $("#trAccTo").value = list[1].id;
    else if (list[0]) $("#trAccTo").value = list[0].id;
    $("#trHint").textContent = "💡 التحويل بين حسابات الخزينة (نقدية / بنك / محفظة) يُسجَّل كسند صرف وسند قبض بنفس المبلغ مع قيد واحد — فرصيد كل حساب بيتحدّث تلقائيًا.";
    rememberHintBase("#trHint");
    wireLiveBalanceHint("transfer", [{ amount: "#trAmount", treasury: "#trAccFrom", hint: "#trHint", mode: "transfer" }]);
    liveBalanceHint("#trAmount", "#trAccFrom", "#trHint", "transfer");
    showModal("mSimpleTransfer");
    $("#trAmount").focus();
  }

  function saveTransfer() {
    if (!simpleGate()) return;
    const fromId = parseInt($("#trAccFrom").value, 10);
    const toId = parseInt($("#trAccTo").value, 10);
    const amount = Math.round((moneyVal("#trAmount") || 0) * 100) / 100;
    const date = $("#trDate").value || todayISO();
    const from = treasury.find((x) => Number(x.id) === fromId);
    const to = treasury.find((x) => Number(x.id) === toId);
    if (!from || !to) { toast("اختار الحساب المنقول منه والحساب المنقول إليه.", "warning"); return; }
    if (Number(from.id) === Number(to.id)) { toast("لا يمكن التحويل من الحساب إلى نفس الحساب.", "warning"); return; }
    if (!(amount > 0)) { toast("اكتب مبلغًا صحيحًا أكبر من الصفر.", "warning"); return; }
    const bal = round2(from.balance);
    if (amount > bal) {
      if (!confirm(shortfallText(from, amount, "transfer") + "\n\nهل تريد تنفيذ التحويل من «" + from.name + "» رغم ذلك؟")) return;
    }
    const note = $("#trNotes").value.trim();
    const tag = "تحويل من «" + from.name + "» إلى «" + to.name + "»" + (note ? " — " + note : "");
    const baseId = vouchers.reduce((m, x) => Math.max(m, x.id), 0);
    // سندان مرتبطان بنفس الوصف: صرف من الأول وقبض في التاني — معادلة recalculateTreasuryBalances بتمشي زي ما هي
    vouchers.push({ id: baseId + 1, type: "out", treasuryId: Number(from.id), date: date, amount: amount, desc: "سند صرف — " + tag });
    vouchers.push({ id: baseId + 2, type: "in", treasuryId: Number(to.id), date: date, amount: amount, desc: "سند قبض — " + tag });
    saveVouchers();
    recalculateTreasuryBalances();

    let jNumber = "";
    const aFrom = accForTreasuryAcc(from);
    const aTo = accForTreasuryAcc(to);
    if (aFrom && aTo) {
      const lines = [{ accountId: aTo.id, debit: amount, credit: 0 }, { accountId: aFrom.id, debit: 0, credit: amount }];
      const j = {
        id: journalEntries.reduce((m, x) => Math.max(m, x.id), 0) + 1,
        number: "JRN-" + String(journalEntries.length + 1).padStart(4, "0"),
        date: date,
        desc: tag,
        ref: "تحويل بين الحسابات",
        debit: amount,
        credit: amount,
        lines: lines
      };
      const dAcc = accounts.find((a) => Number(a.id) === lines[0].accountId);
      const cAcc = accounts.find((a) => Number(a.id) === lines[lines.length - 1].accountId);
      if (dAcc) dAcc.openingBalance = Math.round(((dAcc.openingBalance || 0) + amount) * 100) / 100;
      if (cAcc && Number(cAcc.id) !== Number(dAcc.id)) cAcc.openingBalance = Math.round(((cAcc.openingBalance || 0) - amount) * 100) / 100;
      journalEntries.push(j);
      persistJournal();
      saveAccounts();
      jNumber = j.number;
    }
    hideModal("mSimpleTransfer");
    addActivity("تحويل بين الحسابات", tag + " بمبلغ " + fmt(amount) + " ج.م");
    toast("تم التحويل" + (jNumber ? " (قيد " + jNumber + ")" : "") + " بين «" + from.name + "» و«" + to.name + "\".", "success");
    renderJournal();
    renderLedger();
    try { renderTreasury(); renderTreMoves(); } catch (e) { }
  }

  /* ================== 🆕 بناء 134: الفواتير تترحّل أوتوماتيك للقيود ==================
     أمر المالك الحرفي (04/10): «وبعدها تبدأ بترحيل المبيعات و المشتريات اللى كنا قلنا
     عليها الفواتير تترحّل أوتوماتيك للقيود».
     القرارات المحاسبية (نفس عرف saveJournal/saveSimpleEntry/saveTransfer الموجود):
       • **قيد بس، بلا سند خزينة:** رصيد الحساب بيتحسب فعلًا من الفاتورة نفسها جوه
         recalculateTreasuryBalances (sales + purchases + vouchers) ⇒ أي سند جديد كان بيعدّي المبلغ **مرتين**.
       • **الطرف المقابل حسب نوع الدفع:** نقدية/بنك/محفظة = حسابها في الدليل (1.1.1/1.1.2/1.1.3
         عن طريق accForTreasuryAcc) · آجل (بيع) = «مديونيات العملاء» 1.1.5 · آجل (شراء) = «مستحقات الموردين» 2.1.1.
       • **الضريبة سطر مستقل** في «ضريبة المبيعات المستحقة» 2.1.2 (دائن في البيع، مدين في الشراء) —
         وبتتشال خالص لو الشركة مش شغالة بالضريبة (taxAmount = صفر).
       • **التسوية:** openingBalance هو الرصيد الجاري (درس build 117/118)، فكل سطر بيزيد حسابَه المدين
         بينقص حسابَه الدائن — وإلا دفتر الحركة (computeLedger) بيرجع «رصيد افتتاحي» غلط.
       • **منع التكرار:** refType («فاتورة مبيعات» / «فاتورة مشتريات») + refId (رقم الفاتورة) —
         الاتنين بيتخزنوا على السحابة (journal_entries.ref_type / ref_id) فأي جهاز تاني
         ما يرحّش نفس الفاتورة، والحفظ المتكرر لنفس الرقم مستحيل أصلًا (تسلسل الفواتير).
       • **بلا ترحيل بأثر رجعي:** فواتير ما قبل Build 134 ما تتلمسش (قرار المالك «ممنوع أي تعديل
         بأثر رجعي في فواتير mizan») — الترحيل بيحصل لحظة حفظ الفاتورة الجديدة وبس.
       • **الفاتورة ما تلغيش لو الترحيل تعثّر:** لو دليل الحسابات ناقش حساب (شركة جديدة فاضية)،
         الفاتورة تتحفظ وتظهر رسالة ودّية بالخطوة اللي تنفع — صفر فشل صامت وصفر فقدان بيانات. */

  // ما نعيدش استخدام id قيد اتشال (detUuid على السحابة=based on local id)
  let JRN_ID_FLOOR = 0;
  function nextJournalId() {
    return Math.max(JRN_ID_FLOOR, journalEntries.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0)) + 1;
  }
  function invoiceJrnRef(kind) { return kind === "sale" ? "فاتورة مبيعات" : "فاتورة مشتريات"; }
  // مفتاح منع التكرار: نوع الفاتورة + رقمها (الرقم تسلسلي لكل شركة وثابت على كل الأجهزة)
  function invoiceJrnKey(kind, inv) {
    const no = String((inv && (inv.invoiceNumber || inv.invoiceNo)) || "").trim();
    return no ? (kind === "sale" ? "S:" : "P:") + no : "";
  }
  function invoiceJrnOf(kind, inv) {
    const key = invoiceJrnKey(kind, inv);
    if (!key) return null;
    const ref = invoiceJrnRef(kind);
    return journalEntries.find((j) => j && String(j.refId || "") === key &&
      (j.refType === ref || j.ref === ref)) || null;
  }
  // حساب بالدليل من كوده، وباحتياطي بالاسم لو الشركة عدّلت الكود
  function accByCode(code, nameHint) {
    let a = accounts.find((x) => String(x.code) === String(code) && x.isActive !== false);
    if (a) return a;
    if (nameHint) a = accounts.find((x) => x.isActive !== false && String(x.nameAr || "").indexOf(nameHint) >= 0);
    return a || null;
  }
  // أطراف القيد: بيع = مدين (حساب الدفع أو مديونيات العملاء) / دائن (إيراد + ضريبة)
  //               شراء = مدين (مخزون + ضريبة) / دائن (حساب الدفع أو مستحقات الموردين)
  function invoiceJrnPlan(kind, inv, tr) {
    if (!inv) return { error: "nofact" };
    const total = round2(inv.grandTotal);
    const tax = round2(inv.taxAmount);
    const net = round2(total - tax);
    if (!(total > 0)) return { error: "amount" };
    if (net < 0) return { error: "amount" };
    const ajal = String(inv.paymentMethod || "") === "آجل";
    const lines = [];
    if (kind === "sale") {
      const due = ajal ? accByCode("1.1.5", "مديونيات العملاء") : accForTreasuryAcc(tr);
      const rev = accByCode("4.1", "إيرادات المبيعات");
      if (!due) return { error: ajal ? "1.1.5" : "cash" };
      if (!rev) return { error: "4.1" };
      lines.push({ accountId: Number(due.id), debit: total, credit: 0 });
      lines.push({ accountId: Number(rev.id), debit: 0, credit: net });
      if (tax > 0) {
        const tx = accByCode("2.1.2", "ضريبة");
        if (!tx) return { error: "2.1.2" };
        lines.push({ accountId: Number(tx.id), debit: 0, credit: tax });
      }
    } else {
      const stock = accByCode("1.1.4", "المخزون");
      const pay = ajal ? accByCode("2.1.1", "مستحقات الموردين") : accForTreasuryAcc(tr);
      if (!stock) return { error: "1.1.4" };
      if (!pay) return { error: ajal ? "2.1.1" : "cash" };
      lines.push({ accountId: Number(stock.id), debit: net, credit: 0 });
      if (tax > 0) {
        const tx = accByCode("2.1.2", "ضريبة");
        if (!tx) return { error: "2.1.2" };
        lines.push({ accountId: Number(tx.id), debit: tax, credit: 0 });
      }
      lines.push({ accountId: Number(pay.id), debit: 0, credit: total });
    }
    const d = round2(lines.reduce((m, l) => m + (Number(l.debit) || 0), 0));
    const c = round2(lines.reduce((m, l) => m + (Number(l.credit) || 0), 0));
    if (Math.abs(d - c) > 0.01) return { error: "unbalanced" };
    return { lines: lines, debit: d, credit: c };
  }
  // تسوية أرصدة الدليل سطر-سطر (مدين +/دائن −) — نفس عرف saveJournal، وبيصح مع 3 أسطر
  function settleJrnLines(lines, sign) {
    (lines || []).forEach((l) => {
      const a = accounts.find((x) => Number(x.id) === Number(l.accountId));
      if (!a) return;
      const netLine = ((Number(l.debit) || 0) - (Number(l.credit) || 0)) * sign;
      a.openingBalance = round2((Number(a.openingBalance) || 0) + netLine);
    });
  }
  // النص الودّي اللي يشرح إيه الناقش (بلا أي مصطلح تقني للعميل)
  function invoiceJrnMissText(err) {
    if (err === "4.1") return "حساب «إيرادات المبيعات» (4.1) مش موجود في دليل حساباتك";
    if (err === "1.1.4") return "حساب «المخزون» (1.1.4) مش موجود في دليل حساباتك";
    if (err === "1.1.5") return "حساب «مديونيات العملاء» (1.1.5) مش موجود في دليل حساباتك";
    if (err === "2.1.1") return "حساب «مستحقات الموردين» (2.1.1) مش موجود في دليل حساباتك";
    if (err === "2.1.2") return "حساب «ضريبة المبيعات المستحقة» (2.1.2) مش موجود في دليل حساباتك";
    if (err === "cash") return "حساب النقدية/البنك/المحفظة مش موجود في دليل حساباتك";
    if (err === "amount") return "مبلغ الفاتورة مش صالح للترحيل";
    if (err === "unbalanced") return "الطرفان مش متزنيين";
    return "فيه حساب ناقص في دليل حساباتك";
  }
  // الترحيل نفسه: بيسبقه منع تكرار، وبعده قيد متزن + تسوية + حفظ
  function postInvoiceJournal(kind, inv, tr) {
    if (!inv) return null;
    const done = invoiceJrnOf(kind, inv);
    if (done) return { j: done, already: true };
    const plan = invoiceJrnPlan(kind, inv, tr);
    if (plan.error) {
      toast("الفاتورة اتحفظت تمام. الترحيل التلقائي للقيود ما كملش لأن " +
        invoiceJrnMissText(plan.error) + " — ضيفه من شاشة الحسابات وبعدها سجّل القيد من «القيود اليومية».", "warning");
      return null;
    }
    const no = String(inv.invoiceNumber || inv.invoiceNo || "");
    const who = kind === "sale" ? (inv.customerName || inv.customer || "-") : (inv.supplierName || inv.supplier || "-");
    const tax = round2(inv.taxAmount);
    const desc = invoiceJrnRef(kind) + " رقم " + no + " — " + who + " — " + fmt(round2(inv.grandTotal)) + " ج.م" +
      (tax > 0 ? " (منها ضريبة " + fmt(tax) + ")" : "");
    const j = {
      id: nextJournalId(),
      number: "JRN-" + String(journalEntries.length + 1).padStart(4, "0"),
      date: inv.invoiceDate || inv.date || todayISO(),
      desc: desc,
      ref: invoiceJrnRef(kind),
      refType: invoiceJrnRef(kind),
      refId: invoiceJrnKey(kind, inv),
      debit: plan.debit,
      credit: plan.credit,
      lines: plan.lines
    };
    settleJrnLines(j.lines, 1);
    journalEntries.push(j);
    persistJournal();
    saveAccounts();
    try { renderJournal(); } catch (e) { }
    return { j: j, already: false };
  }
  // حذف الفاتورة = تراجع القدها كمان (المخزون والأرصدة بترجع قبل كده في deleteInvoiceQuery)
  function removeInvoiceJournal(kind, inv) {
    const j = invoiceJrnOf(kind, inv);
    if (!j) return null;
    settleJrnLines(j.lines, -1);
    const i = journalEntries.findIndex((x) => x === j);
    if (i >= 0) journalEntries.splice(i, 1);
    JRN_ID_FLOOR = Math.max(JRN_ID_FLOOR, Number(j.id) || 0);
    persistJournal();
    saveAccounts();
    try { renderJournal(); } catch (e) { }
    return j;
  }

  /* ---- دفتر حركة الحسابات: كل الحركات اللي تمت جوه أي حساب ---- */
  function computeLedger() {
    const el = $("#txtLedgerAcc");
    const text = el ? String(el.value || "").trim() : "";
    if (!text) return null;
    const acc = resolveJournalAccount(text);
    if (!acc) return null;
    const rows = [];
    journalEntries.slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (Number(a.id) - Number(b.id)))
      .forEach((j) => {
        (j.lines || []).forEach((l) => {
          if (Number(l.accountId) === Number(acc.id)) {
            rows.push({ date: j.date, number: j.number, desc: j.desc, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 });
          }
        });
      });
    let net = 0;
    rows.forEach((r) => { net += r.debit - r.credit; });
    // النمود القديم بيحدّث openingBalance مع كل قيد (هو الرصيد الجاري فعليًا) —
    // فالافتتاحي الصحيح = الجاري − محصل كل القيود، وبعدها الجاري من جديد سطر بسطر بلا ازدواج.
    let run = Math.round((Number(acc.openingBalance || 0) - net) * 100) / 100;
    const opening = run;
    rows.forEach((r) => { run = Math.round((run + r.debit - r.credit) * 100) / 100; r.run = run; });
    return { acc: acc, rows: rows, opening: opening, final: run };
  }

  function renderLedger() {
    const tbody = $("#dgvJLedger tbody");
    if (!tbody) return;
    const info = $("#ledgerInfo");
    const text = ($("#txtLedgerAcc").value || "").trim();
    if (!text) {
      tbody.innerHTML = '<tr><td colspan="6">اكتب كود أو اسم الحساب لعرض كل الحركات اللي تمت جوه.</td></tr>';
      if (info) info.textContent = "";
      return;
    }
    const led = computeLedger();
    if (!led) {
      tbody.innerHTML = '<tr><td colspan="6">الحساب غير موجود في دليل الحسابات.</td></tr>';
      if (info) info.textContent = "";
      return;
    }
    tbody.innerHTML = "";
    if (led.opening) {
      const tr0 = document.createElement("tr");
      tr0.innerHTML = '<td>—</td><td>—</td><td style="text-align:right">رصيد افتتاحي</td><td>-</td><td>-</td><td>' + fmt(led.opening) + '</td>';
      tbody.appendChild(tr0);
    }
    // 🆕 بناء 123: دفتر حركة حساب إيراد (شجرة 4) أو مصروف (شجرة 5) — حركته تتلون باتجاه الحساب
    const ldir = moneyDirOf(led.acc);
    led.rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(r.date) + '</td>' +
        '<td>' + esc(r.number) + '</td>' +
        '<td style="text-align:right">' + esc(r.desc) + '</td>' +
        amtTd(r.debit, ldir, true) +
        amtTd(r.credit, ldir, true) +
        '<td>' + fmt(r.run) + '</td>';
      tbody.appendChild(tr);
    });
    if (!led.rows.length) tbody.innerHTML = '<tr><td colspan="6">لا توجد حركات على هذا الحساب بعد.</td></tr>';
    if (info) info.textContent = "الحساب: " + led.acc.nameAr + " (" + led.acc.code + ") — الحركات: " + led.rows.length + " — الرصيد النهائي: " + fmt(led.final) + " ج.م";
  }

  function printLedger() {
    if (!simpleGate("الاستعلام عن حركة الحسابات متاح لصاحب الشركة والمالك فقط.")) return;
    const led = computeLedger();
    if (!led) { toast("اختار حسابًا صحيحًا من دليل الحسابات أولًا.", "warning"); return; }
    if (!confirm("هل تريد طباعة كشف حساب «" + led.acc.nameAr + "»؟")) return;
    printStatementDoc({
      name: "كشف حساب: " + led.acc.nameAr,
      code: led.acc.code,
      range: led.rows.length ? led.rows[0].date + " ← " + led.rows[led.rows.length - 1].date : todayISO(),
      balance: led.final,
      rows: led.rows.map((r) => ({ date: r.date, desc: r.number + " — " + r.desc, debit: r.debit, credit: r.credit, balance: r.run }))
    });
  }

  /* ---- تبويب «بنود المصروفات والإيرادات» في إعدادات مؤسستك (بناء 115) ---- */
  function renderCItems() {
    const box = $("#cGridItems");
    if (!box) return;
    const usedCount = {};
    journalEntries.forEach((j) => {
      (j.lines || []).forEach((l) => {
        const k = Number(l.accountId);
        usedCount[k] = (usedCount[k] || 0) + 1;
      });
    });
    box.innerHTML = "";
    const tbl = document.createElement("table");
    tbl.className = "dgv";
    tbl.innerHTML = '<thead><tr><th style="width:12%">الكود</th><th style="width:40%">البند</th><th style="width:14%">النوع</th><th style="width:16%">مستخدم في قيود</th><th style="width:18%">حذف</th></tr></thead>';
    const tb = document.createElement("tbody");
    const items = accounts.filter((a) => (a.type === "expense" || a.type === "revenue") && Number(a.parentId) !== 0 &&
      !accounts.some((x) => Number(x.parentId) === Number(a.id)));
    items.forEach((a) => {
      const tr = document.createElement("tr");
      const n = usedCount[Number(a.id)] || 0;
      tr.innerHTML = '<td>' + esc(a.code) + '</td><td style="text-align:right">' + esc(a.nameAr) + (a.isActive ? '' : ' 🔴') + '</td><td>' + (a.type === "revenue" ? "إيراد" : "مصروف") + '</td><td>' + (n ? n + " حركة" : "—") + '</td>';
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "btn small red"; btn.type = "button"; btn.textContent = "🗑️ حذف";
      btn.addEventListener("click", () => {
        if (!simpleGate()) return;
        const uses = journalEntries.reduce((m, j) => m + ((j.lines || []).some((l) => Number(l.accountId) === Number(a.id)) ? 1 : 0), 0);
        if (uses) { toast("ممنوع حذف بند مستخدم في القيود («" + a.nameAr + "» عليه " + uses + " قيد).", "error"); return; }
        if (!confirm("حذف البند «" + a.nameAr + "»؟ لن يؤثر على أي قيد محفوظ.")) return;
        const idx = accounts.findIndex((x) => Number(x.id) === Number(a.id));
        if (idx >= 0) accounts.splice(idx, 1);
        saveAccounts();
        renderCItems();
        toast("تم حذف البند «" + a.nameAr + "\".", "success");
      });
      td.appendChild(btn);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    box.appendChild(tbl);
    if (!items.length) {
      const note = document.createElement("p");
      note.className = "stk-hint";
      note.textContent = "لا توجد بنود بعد — أضف بندًا من الزرار فوق، أو سجّل مصروفًا/إيرادًا باسم جديد والبرنامج يقترح إضافته.";
      box.appendChild(note);
    }
  }

  function addCItem() {
    if (!simpleGate()) return;
    const name = ($("#cItemNewName").value || "").trim();
    const kind = $("#cItemNewKind").value === "revenue" ? "revenue" : "expense";
    if (!name) { toast("اكتب اسم البند.", "warning"); return; }
    const dup = accounts.find((a) => (a.type === "expense" || a.type === "revenue") && Number(a.parentId) !== 0 && normalizeAr(a.nameAr) === normalizeAr(name));
    if (dup) { toast("البند «" + dup.nameAr + "» (" + (dup.type === "revenue" ? "إيراد" : "مصروف") + ") موجود بالفعل.", "info"); return; }
    const root = itemRootAccount(kind);
    if (!root) { toast("لا يوجد حساب جذر لـ" + (kind === "revenue" ? "الإيرادات" : "المصروفات") + " في دليل الحسابات.", "error"); return; }
    accounts.push({ id: nextAccountId(), code: nextItemCode(root), nameAr: name, type: kind, parentId: root.id, openingBalance: 0, isActive: true });
    saveAccounts();
    $("#cItemNewName").value = "";
    renderCItems();
    toast("تمت إضافة البند «" + name + "» وهو متاح الآن في التسجيل المبسط.", "success");
  }

  /* ================== 🆕 مهمة 98: سجل الأصول الثابتة ================== */
  /* طلب المالك: «تسجيل أرصدة الأصول الثابتة (غير المتداولة)».
   * - سجل مستقل لكل أصل: اسم + تصنيف (غير متداولة / غير ملموسة) + فئة + تاريخ شراء + تكلفة + إهلاك تراكمي.
   * - صافي الدفتر = التكلفة − الإهلاك التراكمي (محسوب دائمًا، مش مخزّن) عشان التعديل ما ينساش.
   * - يغذي قسميه في «قائمة المركز المالي» (مهمة 97). والسجل الفاضي = نفس سلوك الدليل القديم (مافيش رجوع للوراء).
   * - مافيش قصّ صامت (درس build 113): لو الإهلاك أكبر من التكلفة → لافتة بالأرقام + قفل الحفظ،
   *   والقيمة تفضل زي ما كتبها المستخدم لحد ما يعدّلها بنفسه.
   * - الصلاحية: صاحب الشركة والمالك دائمًا، والعضو لما تتفعّل له «🏭 الأصول الثابتة» (نفس نمط الحضور).
   */
  const FA_CLASS_TITLES = { noncurrent: "أصول غير متداولة", intangible: "أصول غير ملموسة" };
  const FA_CATEGORIES = ["أراضٍ", "مباني", "معدات", "سيارات", "أثاث", "إلكترونيات", "آلات", "علامة تجارية", "براءة اختراع", "امتياز", "أخرى"];
  let editingFixedId = null;
  let fixedBound = false;

  const faClass = (a) => (a && a.assetClass === "intangible" ? "intangible" : "noncurrent");
  const faLive = () => (Array.isArray(fixedAssets) ? fixedAssets.filter((a) => a && a.deleted !== true) : []);
  const faById = (id) => faLive().filter((a) => String(a.id) === String(id))[0];
  const faNextLocalId = () => (Array.isArray(fixedAssets) ? fixedAssets.reduce((m, x) => Math.max(m, Number(x && x.id) || 0), 0) : 0) + 1;
  // الصافي محسوب مش مخزّن: أي تعديل في التكلفة أو الإهلاك يبان فورًا في القائمة والكشف
  const faNet = (a) => bsRound((Number(a && a.cost) || 0) - (Number(a && a.accumDep) || 0));
  const faNetText = (a) => {
    const cost = Number(a && a.cost) || 0, dep = Number(a && a.accumDep) || 0;
    if (dep > cost) return "—";            // رفضنا نقصّ في صمت: السالب المخبّى ما يطلعش رقم
    return fmt(faNet(a));
  };
  function faTotals(cls) {
    const l = faLive().filter((a) => faClass(a) === cls);
    return {
      count: l.length,
      cost: bsRound(l.reduce((m, a) => m + (Number(a.cost) || 0), 0)),
      dep: bsRound(l.reduce((m, a) => m + (Number(a.accumDep) || 0), 0)),
      net: bsRound(l.reduce((m, a) => m + faNet(a), 0))
    };
  }
  // بنود السجل لقسم في قائمة المركز المالي — [] معناه «السجل فاضي» والقائمة تستخدم حسابات الدليل
  function faBalanceRows(cls) {
    return faLive().filter((a) => faClass(a) === cls)
      .sort((a, b) => String(a.nameAr || "").localeCompare(String(b.nameAr || ""), "ar"))
      .map((a) => [(a.nameAr || "أصل") + (a.category ? " — " + a.category : ""), faNet(a)]);
  }
  // الإهلاك أكبر من التكلفة = خطأ إدخال (الصافي هيبقى سالب) — بنمنع الحفظ وبنوضّح الأرقام
  function faOverDep() {
    const cost = moneyVal("#fxFCost");
    const dep = moneyVal("#fxFDep");
    if (isNaN(cost) || isNaN(dep)) return null;
    if (dep <= cost) return null;
    return { cost: bsRound(cost), dep: bsRound(dep), over: bsRound(dep - cost) };
  }
  function paintFixedOver() {
    const over = faOverDep(), box = $("#fixedOverWarn"), btn = $("#btnFixedSave");
    if (over) {
      box.hidden = false;
      box.innerHTML = "⚠️ الإهلاك التراكمي <b>" + fmt(over.dep) + "</b> ج.م أكبر من التكلفة <b>" + fmt(over.cost) +
        "</b> ج.م (الزيادة " + fmt(over.over) + " ج.م)، فصافي الدفتر هيبقى بالسالب.<br>" +
        "عدّل واحدًا منهم — الحفظ مقفول لحد ما الأرقام تستقيم.";
      $("#fxFNet").value = "—";
      $("#fxFDep").classList.add("input-bad");
      btn.disabled = true;
    } else {
      box.hidden = true; box.innerHTML = "";
      $("#fxFNet").value = fmt(faNet({ cost: moneyVal("#fxFCost") || 0, accumDep: moneyVal("#fxFDep") || 0 }));
      $("#fxFDep").classList.remove("input-bad");
      btn.disabled = false;
    }
  }
  function faFilterGate() { return canManageFixedAssets(); }
  // حصانة ثانية جوه الدوال: العضو حتى لو نادى الدالة مباشرة ما يسجلش
  function faGate() {
    if (faFilterGate()) return true;
    toast("صلاحية «الأصول الثابتة» غير مفعّلة لحسابك", "error");
    return false;
  }

  function faFiltered() {
    const q = normalizeAr(String($("#txtFixedSearch").value || "")).trim();
    const rows = faLive();
    if (!q) return rows;
    return rows.filter((a) => [a.nameAr, a.category, FA_CLASS_TITLES[faClass(a)], a.purchaseDate,
      String(a.cost || ""), String(a.accumDep || ""), a.notes]
      .map((v) => normalizeAr(String(v == null ? "" : v))).join(" ").indexOf(q) >= 0);
  }

  function renderFixedAssets() {
    const tb = $("#dgvFixedAssets tbody");
    tb.innerHTML = "";
    const rows = faFiltered().slice().sort((a, b) => {
      const c = faClass(a).localeCompare(faClass(b));
      return c !== 0 ? c : String(a.nameAr || "").localeCompare(String(b.nameAr || ""), "ar");
    });
    const can = faFilterGate();
    rows.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td hidden>' + esc(a.id) + '</td>' +
        '<td>' + esc(a.nameAr || "") + '</td>' +
        '<td>' + esc(FA_CLASS_TITLES[faClass(a)]) + '</td>' +
        '<td>' + esc(a.category || "أخرى") + '</td>' +
        '<td>' + esc(a.purchaseDate || "—") + '</td>' +
        '<td>' + fmt(Number(a.cost) || 0) + '</td>' +
        '<td>' + fmt(Number(a.accumDep) || 0) + '</td>' +
        '<td>' + faNetText(a) + '</td>' +
        '<td>' + (a.isActive === false ? "⏸ متوقف" : "▶️ في الخدمة") + '</td>' +
        '<td>' + (can ? '<button class="btn tiny gray" type="button" data-edit-fixed="' + esc(a.id) + '">✏️ تعديل</button>' : "") + '</td>';
      tb.appendChild(tr);
    });
    if (!rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="10" class="bal-empty">' +
        (faLive().length ? "لا نتائج للبحث الحالي" : "لم تُسجَّل أصول بعد — اضغط «➕ تسجيل أصل ثابت» وابدأ بالمبنى أو المعدات") + '</td>';
      tb.appendChild(tr);
    }
    const t1 = faTotals("noncurrent"), t2 = faTotals("intangible");
    $("#fixedSummary").textContent =
      "الأصول غير المتداولة: " + t1.count + " أصل — تكلفة " + fmt(t1.cost) + " | إهلاك " + fmt(t1.dep) + " | صافي " + fmt(t1.net) +
      "  •  الأصول غير الملموسة: " + t2.count + " أصل — تكلفة " + fmt(t2.cost) + " | إهلاك " + fmt(t2.dep) + " | صافي " + fmt(t2.net) +
      "  •  إجمالي الصافي " + fmt(bsRound(t1.net + t2.net)) + " ج.م";
    $("#btnAddFixed").disabled = !can;
    $("#txtFixedSearch").disabled = false;
    $("#fxCategoryList").innerHTML = FA_CATEGORIES.map((c) => '<option value="' + esc(c) + '"></option>').join("");
  }

  function openFixedModal(a) {
    if (!faFilterGate()) { toast("صلاحية «الأصول الثابتة» غير مفعّلة لحسابك", "error"); return; }
    editingFixedId = a ? a.id : null;
    $("#mFixedEditTitle").textContent = a ? "✏️ تعديل بيانات أصل" : "➕ تسجيل أصل ثابت جديد";
    $("#fxFName").value = a ? (a.nameAr || "") : "";
    $("#fxFClass").value = a ? faClass(a) : "noncurrent";
    $("#fxFCategory").value = a ? (a.category || "") : "";
    $("#fxFDate").value = a ? (a.purchaseDate || "") : "";
    $("#fxFCost").value = a ? (Number(a.cost) || 0) : "";
    $("#fxFDep").value = a ? (Number(a.accumDep) || 0) : "";
    $("#fxFActive").value = a ? (a.isActive === false ? "0" : "1") : "1";
    $("#fxFNotes").value = a ? (a.notes || "") : "";
    $("#btnFixedDelete").hidden = !a;
    paintFixedOver();
    showModal("mFixedAddEdit");
    $("#fxFName").focus();
  }
  function closeFixedModal() { hideModal("mFixedAddEdit"); editingFixedId = null; }

  function saveFixedFromModal() {
    if (!faGate()) return;
    const name = String($("#fxFName").value || "").trim();
    if (!name) { toast("اكتب اسم الأصل أولًا (مثال: مبنى المستودع).", "error"); return; }
    const costRaw = String($("#fxFCost").value || "").trim();
    const cost = parseFloat(costRaw);
    if (costRaw === "" || isNaN(cost) || cost < 0) {
      toast("التكلفة لازم رقم أكبر من صفر — دي أساس حساب صافي الأصل.", "error"); return;
    }
    const depRaw = String($("#fxFDep").value || "").trim();
    const dep = depRaw === "" ? 0 : parseFloat(depRaw);
    if (isNaN(dep) || dep < 0) { toast("الإهلاك التراكمي لازم رقمًا (اكتب 0 لو مفيش إهلاك بعد).", "error"); return; }
    if (dep > cost) {
      const over = { cost: bsRound(cost), dep: bsRound(dep), over: bsRound(dep - cost) };
      toast("الإهلاك " + fmt(over.dep) + " أكبر من التكلفة " + fmt(over.cost) + " (الزيادة " + fmt(over.over) +
        ") — عدّل الرقم الأول، الأصل ما يسجلش وهو كده.", "error");
      paintFixedOver();
      return;
    }
    const key = normalizeAr(name).trim();
    const dup = faLive().filter((a) => String(a.id) !== String(editingFixedId) && normalizeAr(String(a.nameAr || "")).trim() === key)[0];
    if (dup) {
      toast("فيه أصل مسجّل بالفعل باسم «" + dup.nameAr + "» — عدّله بدل ما تكرّره، أو وضّح الاسم (مثال: «سيارة نقل ٢»).", "error");
      return;
    }
    const rec = {
      nameAr: name,
      assetClass: $("#fxFClass").value === "intangible" ? "intangible" : "noncurrent",
      category: String($("#fxFCategory").value || "").trim() || "أخرى",
      purchaseDate: String($("#fxFDate").value || "").trim(),
      cost: bsRound(cost), accumDep: bsRound(dep),
      isActive: $("#fxFActive").value !== "0",
      notes: String($("#fxFNotes").value || "").trim()
    };
    if (editingFixedId != null) {
      const a = faById(editingFixedId);
      if (!a) { toast("لم يتم العثور على الأصل — ممكن اتحذف.", "error"); return; }
      Object.keys(rec).forEach((k) => { a[k] = rec[k]; });
      addActivity("تعديل أصل ثابت", rec.nameAr + " — صافي " + faNetText(a));
      toast("✔ تم حفظ بيانات «" + rec.nameAr + "»", "success");
    } else {
      rec.id = faNextLocalId();
      fixedAssets.push(rec);
      addActivity("إضافة أصل ثابت", rec.nameAr + " (" + FA_CLASS_TITLES[rec.assetClass] + ") — " + fmt(rec.cost));
      toast("✔ تمت إضافة «" + rec.nameAr + "» وصافي دفتره " + fmt(faNet(rec)) + " ج.م", "success");
    }
    saveFixedAssets();
    closeFixedModal();
    renderFixedAssets();
  }

  function deleteFixedAsset(id) {
    if (!faGate()) return;
    const a = faById(id);
    if (!a) { toast("لم يتم العثور على الأصل.", "error"); return; }
    if (!confirm("هل أنت متأكد من حذف الأصل «" + (a.nameAr || "") + "» نهائيًا؟\n" +
      "الصافي " + faNetText(a) + " ج.م هيتشيل من قائمة المركز المالي.")) return;
    fixedAssets = fixedAssets.filter((x) => String(x.id) !== String(a.id));
    saveFixedAssets();
    addActivity("حذف أصل ثابت", (a.nameAr || "") + " (" + fmt(Number(a.cost) || 0) + ")");
    toast("🗑 تم حذف «" + (a.nameAr || "") + "» — راجع قائمة المركز المالي", "success");
    if (String(editingFixedId) === String(a.id)) closeFixedModal();
    renderFixedAssets();
  }

  function toggleFixedActive(id) {
    if (!faGate()) return;
    const a = faById(id);
    if (!a) return;
    a.isActive = a.isActive === false;
    saveFixedAssets();
    addActivity(a.isActive ? "تشغيل أصل ثابت" : "إيقاف أصل ثابت", a.nameAr || "");
    toast(a.isActive ? "▶️ «" + a.nameAr + "» رجع في الخدمة" : "⏸ تم إيقاف «" + a.nameAr +
      "» — هو محسوب في صافي الأصول لحد ما تصرف فيه (بالحذف)", "success");
    renderFixedAssets();
  }

  function printFixedAssets() {
    const t1 = faTotals("noncurrent"), t2 = faTotals("intangible");
    const d = new Date(), p = (x) => String(x).padStart(2, "0");
    $("#fxpOrgName").textContent = settings.orgName || "مؤسستي";
    $("#fxpOrg").textContent = settings.orgName || "مؤسستي";
    $("#fxpDate").textContent = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
    const tb = $("#fxpBody");
    tb.innerHTML = "";
    const addRow = (html, cls) => {
      const tr = document.createElement("tr");
      if (cls) tr.className = cls;
      tr.innerHTML = html;
      tb.appendChild(tr);
    };
    const section = (cls, title, tot) => {
      addRow('<td colspan="6"><b>' + esc(title) + '</b></td>', "bal-group");
      const rows = faBalanceRows(cls);
      if (!rows.length) { addRow('<td colspan="6" class="bal-empty">لم تُسجَّل أصول في هذا القسم بعد</td>'); return; }
      faLive().filter((a) => faClass(a) === cls)
        .sort((x, y) => String(x.nameAr || "").localeCompare(String(y.nameAr || ""), "ar"))
        .forEach((a) => addRow('<td>' + esc(a.nameAr || "") + '</td><td>' + esc(a.category || "أخرى") + '</td>' +
          '<td>' + esc(a.purchaseDate || "—") + '</td><td>' + fmt(Number(a.cost) || 0) + '</td>' +
          '<td>' + fmt(Number(a.accumDep) || 0) + '</td><td>' + faNetText(a) + '</td>'));
      addRow('<td colspan="3">إجمالي ' + esc(title) + '</td><td>' + fmt(tot.cost) + '</td><td>' + fmt(tot.dep) +
        '</td><td><b>' + fmt(tot.net) + '</b></td>', "bal-sub");
    };
    section("noncurrent", "أصول غير متداولة", t1);
    section("intangible", "أصول غير ملموسة", t2);
    addRow('<td colspan="5"><b>إجمالي صافي الأصول الثابتة</b></td><td><b>' + fmt(bsRound(t1.net + t2.net)) +
      '</b></td>', "bal-total");
    $("#fxpFoot").innerHTML = "صافي الدفتر = التكلفة − الإهلاك التراكمي. الأصل المتوقف يفضل محسوبًا لحد ما يُتصرَّف فيه.";
    printSection($("#fixedAssetsPage"));
  }

  function fixedBindOnce() {
    if (fixedBound) return;
    fixedBound = true;
    $("#btnAddFixed").addEventListener("click", function () { openFixedModal(null); });
    $("#btnPrintFixed").addEventListener("click", printFixedAssets);
    $("#txtFixedSearch").addEventListener("input", renderFixedAssets);
    $("#btnFixedCancel").addEventListener("click", closeFixedModal);
    $("#btnFixedSave").addEventListener("click", saveFixedFromModal);
    $("#btnFixedDelete").addEventListener("click", function () {
      if (editingFixedId != null) deleteFixedAsset(editingFixedId);
    });
    ["fxFCost", "fxFDep"].forEach((id) => $("#" + id).addEventListener("input", paintFixedOver));
    $("#viewFixedAssets").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-edit-fixed]");
      if (b) { openFixedModal(faById(b.dataset.editFixed)); return; }
      const t = ev.target.closest("[data-toggle-fixed]");
      if (t) toggleFixedActive(t.dataset.toggleFixed);
    });
  }

  /* ================== قائمة المركز المالي ================== */
  /* 🆕 مهمة 97: قائمة المركز المالي بثلاثة أقسام بتفاصيلها + تحقق معادلة الميزانية
   * (1) الأصول: متداولة (نقدية/بنوك/محافظ/مخزون/عملاء) + غير متداولة (أراضٍ/مباني/معدات/سيارات) + غير ملموسة (علامة/براءة/امتياز)
   * (2) الالتزامات: متداولة (موردون/ضريبة/قروض قصيرة) + غير متداولة (قروض طويلة الأجل)
   * (3) حقوق الملكية: رأس المال + الأرباح المحتجزة + أرباح الدورة
   * البنود اللي ليها مصدر حركي (خزائن/عملاء/موردون/مخزون/ضريبة) بتتحسب من الحركة نفسها، وحسابات الدليل
   * المقابلة ليها (BS_OPERATIONAL) بتتاستنى من المجموع عشان العد مرتين ما يحصلش.
   */
  const BS_OPERATIONAL = ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "1.1.5", "2.1.1", "2.1.2"];
  const bsRound = (n) => Math.round((Number(n) || 0) * 100) / 100;
  // في النموذج الحالي openingBalance = الرصيد الجاري بعلامة المدين، فأرصدة الدائن بتترجع للإشارة الصح
  const bsLedgerValue = (a) => bsRound((a.openingBalance || 0) * (a.type === "asset" || a.type === "expense" ? 1 : -1));
  const bsHasChild = (a) => accounts.some((x) => Number(x.parentId) === Number(a.id));
  // مطابقة المجموعة على مستوى جزء كامل: "1.1" تاخد 1.1 و 1.1.x لكن ما تاخدش 1.10
  const bsInGroup = (code, groups) => groups.some((g) => code === g || String(code).indexOf(g + ".") === 0);

  // أوراق الدليل (من غير الحسابات الأب) لنوع معيّن داخل مجموعات الكود دي، مرتبة بالكود
  function bsLeaves(type, groups, restGroups) {
    const leaves = accounts.filter((a) => a.isActive && a.type === type && !bsHasChild(a) && BS_OPERATIONAL.indexOf(String(a.code || "")) < 0);
    const hit = leaves.filter((a) => bsInGroup(String(a.code || ""), groups));
    if (restGroups) {
      // أي ورقة خارج الأقسام المعروفة تنزل في القسم الافتراضي عشان مافيش بند يضيع من القائمة
      // (مع استبعاد اللي إحنا لحسنها في groups عشان البند ما يتحسبش مرتين)
      hit.push.apply(hit, leaves.filter((a) => !bsInGroup(String(a.code || ""), groups.concat(restGroups))));
    }
    return hit
      .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")))
      .map((a) => [a.nameAr + " (" + a.code + ")", bsLedgerValue(a)]);
  }

  function balanceSheetData() {
    const cash = bsRound(treasury.filter((t) => !t.type || t.type === "cash").reduce((m, t) => m + (t.balance || 0), 0));
    const bank = bsRound(treasury.filter((t) => t.type === "bank").reduce((m, t) => m + (t.balance || 0), 0));
    const wallet = bsRound(treasury.filter((t) => t.type === "wallet").reduce((m, t) => m + (t.balance || 0), 0));
    const custDebts = bsRound(customers.reduce((m, c) => m + Math.max(c.currentBalance || 0, 0), 0));
    const invValue = bsRound(products.reduce((m, pr) => m + (pr.qty || 0) * (pr.weightedAvgCost || 0), 0));
    const suppDebts = bsRound(suppliers.reduce((m, s) => m + Math.max(s.currentBalance || 0, 0), 0));
    const taxLiability = bsRound(sales.reduce((m, s) => m + (s.taxAmount || 0), 0) - purchases.reduce((m, p2) => m + (p2.taxAmount || 0), 0));
    const capital = bsRound(bsLeaves("equity", ["3.1"], ["3.2"]).reduce((m, r) => m + r[1], 0));
    const retained = bsRound(bsLeaves("equity", ["3.2"], null).reduce((m, r) => m + r[1], 0));
    const profits = bsRound(sales.reduce((m, s) => m + (s.grandTotal || 0), 0) - purchases.reduce((m, p2) => m + (p2.grandTotal || 0), 0) - vouchers.filter((v) => v.type === "out").reduce((m, v) => m + v.amount, 0) + vouchers.filter((v) => v.type === "in").reduce((m, v) => m + v.amount, 0));
    // 🆕 مهمة 98: سجل الأصول الثابتة لو فيه بيانات هو المرجع لقسميه؛ ولو فاضي يرجع لحسابات الدليل (سلوك 97)
    const faFix = faBalanceRows("noncurrent");
    const faInt = faBalanceRows("intangible");

    return {
      assets: [
        {
          key: "cur", title: "💵 أصول متداولة", short: "الأصول المتداولة",
          rows: [["الصناديق النقدية", cash], ["البنوك والحسابات البنكية", bank], ["المحافظ الإلكترونية", wallet],
            ["المخزون (بالتكلفة المرجحة)", invValue], ["مديونيات العملاء", custDebts]].concat(bsLeaves("asset", ["1.1"], ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]))
        },
        {
          key: "fix", title: "🏗️ أصول غير متداولة (أراضٍ ومباني ومعدات وسيارات)" + (faFix.length ? " — من سجل الأصول" : ""), short: "الأصول غير المتداولة",
          rows: faFix.length ? faFix : bsLeaves("asset", ["1.2", "1.3"], null), empty: "لم تُسجَّل أصول غير متداولة بعد"
        },
        {
          key: "int", title: "🧠 أصول غير ملموسة (علامة تجارية / براءة اختراع / امتياز)" + (faInt.length ? " — من سجل الأصول" : ""), short: "الأصول غير الملموسة",
          rows: faInt.length ? faInt : bsLeaves("asset", ["1.4", "1.5", "1.6"], null), empty: "لم تُسجَّل أصول غير ملموسة بعد"
        }
      ],
      liabs: [
        {
          key: "cur", title: "📉 التزامات متداولة", short: "الالتزامات المتداولة",
          rows: [["مستحقات الموردين", suppDebts], ["ضريبة المبيعات المستحقة", Math.max(taxLiability, 0)]].concat(bsLeaves("liability", ["2.1"], ["2.1", "2.2", "2.3", "2.4"]))
        },
        {
          key: "non", title: "🏦 التزامات غير متداولة (قروض طويلة الأجل)", short: "الالتزامات غير المتداولة",
          rows: bsLeaves("liability", ["2.2", "2.3", "2.4"], null), empty: "لم تُسجَّل التزامات غير متداولة بعد"
        }
      ],
      equity: [
        {
          key: "eq", title: "🏧 حقوق الملكية", short: "حقوق الملكية",
          rows: [["رأس المال", capital], ["الأرباح المحتجزة", retained], ["أرباح الدورة (محققة)", profits]]
        }
      ]
    };
  }

  // رسم قسم كامل بنفس الشكل على الشاشة والورقة: عنوان المجموعة + بنوده + إجماليه، ثم الإجمالي العام
  function fillBalTable(tbId, groups, grandLabel) {
    const tb = $(tbId);
    tb.innerHTML = "";
    const addRow = (html, cls) => {
      const tr = document.createElement("tr");
      if (cls) tr.className = cls;
      tr.innerHTML = html;
      tb.appendChild(tr);
    };
    groups.forEach((g) => {
      addRow('<td colspan="2"><b>' + esc(g.title) + '</b></td>', "bal-group");
      if (!g.rows.length) addRow('<td colspan="2" class="bal-empty">' + esc(g.empty || "لا توجد بنود في هذا القسم") + '</td>');
      g.rows.forEach((r) => addRow('<td>' + esc(r[0]) + '</td><td>' + fmt(r[1]) + '</td>'));
      g.total = bsRound(g.rows.reduce((m, r) => m + r[1], 0));
      // لو القسم مجموعة واحدة، إجمالي المجموعة هو الإجمالي العام — سطر واحد كفاية
      if (groups.length > 1) addRow('<td>إجمالي ' + esc(g.short) + '</td><td><b>' + fmt(g.total) + '</b></td>', "bal-sub");
    });
    const total = bsRound(groups.reduce((m, g) => m + (g.total || 0), 0));
    addRow('<td><b>' + esc(grandLabel) + '</b></td><td><b>' + fmt(total) + '</b></td>', "bal-total");
    return total;
  }

  // معادلة الميزانية بالأرقام، ولو فيه فرق يظهر بلغة ودّية من غير تشخيص تقني
  function balFormulaText(ta, tl, te) {
    if (Math.abs(ta - (tl + te)) < 0.01) return "الميزان متوازن ✓ — الأصول " + fmt(ta) + " = الالتزامات " + fmt(tl) + " + حقوق الملكية " + fmt(te) + " ج.م";
    return "الأصول " + fmt(ta) + " ج.م، والالتزامات مع حقوق الملكية " + fmt(bsRound(tl + te)) +
      " ج.م — الفرق " + fmt(Math.abs(ta - tl - te)) + " ج.م. تقدر تضبطه من شاشة القيود اليومية (➖ مصروفات / ➕ إيرادات / 🔁 تحويل / قيد يدوي).";
  }

  function renderBalance() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    $("#balDate").textContent = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();

    const bs = balanceSheetData();
    const ta = fillBalTable("#dgvBalAssets tbody", bs.assets, "إجمالي الأصول");
    const tl = fillBalTable("#dgvBalLiab tbody", bs.liabs, "إجمالي الالتزامات");
    const te = fillBalTable("#dgvBalEquity tbody", bs.equity, "إجمالي حقوق الملكية");

    $("#balResult").textContent = balFormulaText(ta, tl, te);
    $("#balResult").className = "ft-total " + (Math.abs(ta - (tl + te)) < 0.01 ? "balance-credit" : "balance-debit");
  }

  function printBalance() {
    $("#blpOrg").textContent = settings.orgName || "مؤسستي";
    $("#blpDate").textContent = $("#balDate").textContent;
    $("#blpAssets").innerHTML = $("#dgvBalAssets tbody").innerHTML;
    $("#blpLiab").innerHTML = $("#dgvBalLiab tbody").innerHTML;
    $("#blpEquity").innerHTML = $("#dgvBalEquity tbody").innerHTML;
    $("#blpFoot").innerHTML = $("#balResult").textContent;
    printSection($("#balancePage"));
  }
  /* ================== 🆕 شاشة «كشف حساب الحسابات» ==================
   * طلب المالك (01-10): «عايز خانة بكود الحساب وخانة اسم لما أكتب تتحدث عشان أبحث عن
   * الحساب اللي عايز أعمله كشف حساب — ويشوفه ويطبعه». المقصود كشف حساب الحسابات المسجّلة
   * في القيود اليومية (مش دليل العملاء، ومش سجل الحضور).
   * - الحساب الأب بيجمع حركاته + حركات كل فروعه (مطابقة على مستوى الجزء: 2 تاخد 2.1 و2.1.1
   *   وما تاخدش 2.10) — عشان كود "2" يرجّع الالتزامات بحركاتها كاملة.
   * - نفس رياضيات دفتر الحركة في شاشة القيود: الرصيد الجاري في openingBalance، فالافتتاحي =
   *   الجاري − محصل قيود الحساب (مجموع على كل الحسابات داخل المجموعة).
   * - الفلترة بالفترة (من/إلى) بـ «رصيد مرحّل» زي مهمة 96، والافتراضي = كامل السجل.
   * - الصلاحيات زي «القيود اليومية»: صاحب الشركة والمالك فقط + حصانة جوه الدوال.
   * - مافيش أي تعديل على دوال شاشة القيود أو كشف العميل/المورد (الحراس القديمة فضلت خضرا).
   */
  let acsSelected = null;      // كود الحساب المختار
  let acsFilter = { from: "", to: "" };
  let acsBound = false;

  function acsGate() {
    if (canUseView("accStatement")) return true;
    toast("شاشة «كشف حساب الحسابات» متاحة لصاحب الشركة والمالك فقط", "error");
    return false;
  }
  const acsAll = () => accounts.filter((a) => a && a.isActive !== false);
  const acsChildCount = (a) => accounts.filter((x) => Number(x.parentId) === Number(a.id)).length;
  // كل أكواد المجموعة (النفس + الفروع) على مستوى جزء كامل
  function acsGroupAccounts(acc) {
    const code = String(acc.code || "");
    return accounts.filter((a) => a && (String(a.code) === code || String(a.code).indexOf(code + ".") === 0));
  }
  function acsAccountName(id) {
    const a = accounts.filter((x) => Number(x.id) === Number(id))[0];
    return a ? (a.nameAr || "") : "";
  }
  // البحث: الكود من أوله (Prefix) + الاسم في أي موضع — الاتنين اختياريين وبيتحدّثوا live
  function acsMatches() {
    const code = String($("#acsCode").value || "").trim();
    const name = normalizeAr(String($("#acsName").value || "")).trim();
    let list = acsAll();
    if (code) list = list.filter((a) => String(a.code || "").indexOf(code) === 0);
    if (name) list = list.filter((a) => normalizeAr(String(a.nameAr || "")).indexOf(name) >= 0);
    return list.sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true }));
  }
  // الحركات الكاملة للحساب (أو المجموعة) بترتيب التاريخ — بدون فلترة فترة
  function acsAllRows(acc) {
    const ids = acsGroupAccounts(acc).map((a) => Number(a.id));
    const many = ids.length > 1;
    const rows = [];
    journalEntries.slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (Number(a.id) - Number(b.id)))
      .forEach((j) => {
        (j.lines || []).forEach((l) => {
          if (ids.indexOf(Number(l.accountId)) < 0) return;
          rows.push({
            date: j.date, number: j.number,
            desc: String(j.desc || "") + (many ? " — " + acsAccountName(l.accountId) : ""),
            debit: Number(l.debit) || 0, credit: Number(l.credit) || 0
          });
        });
      });
    // الجاري (openingBalance) = بعد كل القيود، فالافتتاحي = الجاري − محصل القيود لكل حساب
    const net = rows.reduce((m, r) => m + r.debit - r.credit, 0);
    const current = acsGroupAccounts(acc).reduce((m, a) => m + (Number(a.openingBalance) || 0), 0);
    let run = Math.round((current - net) * 100) / 100;
    const opening = run;
    rows.forEach((r) => { run = Math.round((run + r.debit - r.credit) * 100) / 100; r.balance = run; });
    return { acc: acc, rows: rows, opening: opening, current: Math.round(current * 100) / 100, members: ids.length };
  }
  // نفس منطق مهمة 96: سطور الفترة + «رصيد مرحّل» قبل أول حركة لو فيه ما قبل البداية
  function acsVisibleRows(led) {
    const from = acsFilter.from, to = acsFilter.to;
    if (!from && !to) return led.rows;
    const out = led.rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    if (from) {
      const before = led.rows.filter((r) => r.date < from);
      if (before.length) {
        out.unshift({
          date: from, number: "—", desc: "▷ رصيد مرحّل من قبل هذه الفترة",
          debit: 0, credit: 0, balance: before[before.length - 1].balance
        });
      }
    }
    return out;
  }
  function acsPeriodLabel() {
    const p = (x) => String(x).padStart(2, "0");
    const ar = (iso) => { const d = new Date(iso); return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); };
    if (!acsFilter.from && !acsFilter.to) return "بلا فلترة (كامل السجل)";
    if (acsFilter.from && acsFilter.to) return "من " + ar(acsFilter.from) + " إلى " + ar(acsFilter.to);
    if (acsFilter.from) return "من " + ar(acsFilter.from) + " وحتى اليوم";
    return "من أول السجل إلى " + ar(acsFilter.to);
  }
  function acsRenderList() {
    const sel = $("#acsList");
    const list = acsMatches();
    const keep = acsSelected;
    sel.innerHTML = "";
    list.forEach((a) => {
      const op = document.createElement("option");
      const kids = acsChildCount(a);
      op.value = String(a.code);
      op.textContent = a.code + " — " + (a.nameAr || "") + (kids ? "  (📂 " + kids + " فرع)" : "") +
        "  |  الجاري " + fmt(Number(a.openingBalance) || 0);
      if (String(a.code) === String(keep)) op.selected = true;
      sel.appendChild(op);
    });
    $("#acsCount").textContent = list.length
      ? (list.length + " حساب مطابق — اختار واحد أو دبل كليك عليه")
      : "لا يوجد حساب مطابق — عدّل الكود أو الاسم";
    if (!list.length) { acsSelected = null; acsRender(); return; }
    if (!keep || !list.filter((a) => String(a.code) === String(keep)).length) {
      acsSelected = list.length === 1 ? String(list[0].code) : null;   // نتيجة واحدة = اتاختارت لوحدها
      if (acsSelected) {
        Array.prototype.forEach.call(sel.options, (o) => { o.selected = (o.value === acsSelected); });
      }
    }
    acsRender();
  }
  function acsCurrentAccount() {
    if (!acsSelected) return null;
    return acsAll().filter((a) => String(a.code) === String(acsSelected))[0] || null;
  }
  function acsRender() {
    const tbody = $("#dgvAcs tbody");
    const info = $("#acsInfo"), head = $("#acsHead");
    const acc = acsCurrentAccount();
    if (!acc) {
      tbody.innerHTML = '<tr><td colspan="6" class="bal-empty">اكتب كود الحساب أو اسمه في الخانات فوق، واختار الحساب من القائمة — حركاته من القيود اليومية هتظهر هنا.</td></tr>';
      if (info) info.textContent = "";
      if (head) head.textContent = "اختار حسابًا من القائمة — أو اكتب كوده في خانة الكود.";
      return;
    }
    const led = acsAllRows(acc);
    const rows = acsVisibleRows(led);
    if (head) {
      head.innerHTML = "الكود: <b>" + esc(acc.code) + "</b> — " + esc(acc.nameAr || "") +
        " | الفترة: <b>" + esc(acsPeriodLabel()) + "</b>" +
        (led.members > 1 ? " | <b>مع الفروع</b> (" + led.members + " حساب)" : "") +
        " | الرصيد الحالي: <b class=\"" + (led.current >= 0 ? "balance-debit" : "balance-credit") + "\">" + fmt(led.current) + " ج.م</b>";
    }
    tbody.innerHTML = "";
    if (led.opening) {
      const tr0 = document.createElement("tr");
      tr0.innerHTML = '<td>—</td><td>—</td><td style="text-align:right">رصيد افتتاحي</td><td>-</td><td>-</td><td>' + fmt(led.opening) + '</td>';
      tbody.appendChild(tr0);
    }
    // 🆕 بناء 123: كشف حساب حساب من شجرة الإيرادات (4) ⇒ حركاته خضرا، ومن المصروفات (5) ⇒ حمرا
    const adir = moneyDirOf(acc);
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(r.date) + '</td>' +
        '<td>' + esc(r.number == null ? "—" : r.number) + '</td>' +
        '<td style="text-align:right">' + esc(r.desc) + '</td>' +
        amtTd(r.debit, adir, true) +
        amtTd(r.credit, adir, true) +
        '<td class="' + (r.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(r.balance) + '</td>';
      tbody.appendChild(tr);
    });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="bal-empty">لا توجد حركات على هذا الحساب' +
        (acsFilter.from || acsFilter.to ? " في هذه الفترة — جرّب «📅 عرض بالكامل»" : " بعد — سجل قيدًا من شاشة القيود اليومية وهيبان هنا") + '.</td></tr>';
    }
    const moves = rows.filter((r) => String(r.desc).indexOf("رصيد مرحّل") === -1).length;
    if (info) {
      const hasPeriod = !!(acsFilter.from || acsFilter.to);
      const lastVisible = rows.length ? rows[rows.length - 1].balance : null;
      let txt = "الحركات المعروضة: " + moves + (hasPeriod ? " (في الفترة)" : " (كامل السجل)");
      if (hasPeriod) {
        // في الفترة: آخر سطور الكشف غير الرصيد الحالي (اللي بيكمل بعد نهاية الفترة)
        if (lastVisible !== null) txt += " — رصيد نهاية الفترة: " + fmt(lastVisible) + " ج.م";
        txt += " | الرصيد الحالي (كل السجل): " + fmt(led.current) + " ج.م";
      } else {
        txt += " — الرصيد النهائي: " + fmt(led.current) + " ج.م";
      }
      info.textContent = txt;
    }
  }
  function acsApplyPeriod() {
    const f = $("#acsFrom").value || "", t = $("#acsTo").value || "";
    if (f && t && f > t) {
      toast("تاريخ البداية «" + f + "» بعد تاريخ النهاية «" + t + "» — صحّح الفترة علشان الكشف يطلع صح.", "warning");
      return;
    }
    acsFilter = { from: f, to: t };
    acsRender();
  }
  function acsClearPeriod() {
    acsFilter = { from: "", to: "" };
    $("#acsFrom").value = "";
    $("#acsTo").value = "";
    acsRender();
  }
  function acsClearSearch() {
    $("#acsCode").value = "";
    $("#acsName").value = "";
    acsSelected = null;
    acsClearPeriod();
    acsRenderList();
    toast("🧹 اتمسح البحث — اكتب كود أو اسم الحساب من جديد", "success");
  }
  function acsPrint() {
    if (!acsGate()) return;
    const acc = acsCurrentAccount();
    if (!acc) { toast("اختار حسابًا من القائمة الأول عشان تطبع كشف حسابه.", "warning"); return; }
    const led = acsAllRows(acc);
    const rows = acsVisibleRows(led);
    printStatementDoc({
      name: "كشف حساب: " + (acc.nameAr || ""),
      code: acc.code + (led.members > 1 ? " (مع الفروع)" : ""),
      range: acsPeriodLabel(),
      balance: led.current,
      rows: rows.map((r) => ({
        date: r.date, desc: (r.number && r.number !== "—" ? r.number + " — " : "") + r.desc,
        debit: r.debit, credit: r.credit, balance: r.balance
      }))
    });
    addActivity("طباعة كشف حساب", acc.code + " — " + (acc.nameAr || "") + " (" + rows.length + " حركة)");
  }
  function acsBindOnce() {
    if (acsBound) return;
    acsBound = true;
    $("#acsCode").addEventListener("input", () => { acsSelected = null; acsRenderList(); });
    $("#acsName").addEventListener("input", () => { acsSelected = null; acsRenderList(); });
    $("#acsList").addEventListener("change", function () {
      const o = this.options[this.selectedIndex];
      if (o) { acsSelected = o.value; acsRender(); }
    });
    $("#acsList").addEventListener("dblclick", function () {
      const o = this.options[this.selectedIndex];
      if (o) { acsSelected = o.value; acsRender(); acsPrint(); }
    });
    $("#acsFrom").addEventListener("change", acsApplyPeriod);
    $("#acsTo").addEventListener("change", acsApplyPeriod);
    $("#btnAcsAll").addEventListener("click", acsClearPeriod);
    $("#btnAcsRefresh").addEventListener("click", acsRenderList);
    $("#btnAcsClear").addEventListener("click", acsClearSearch);
    $("#btnAcsPrint").addEventListener("click", acsPrint);
  }
  function renderAccStatementView() {
    if (!acsGate()) return;
    acsBindOnce();
    acsRenderList();
  }
  // من «حركة حساب داخل القيود» في شاشة القيود → نفس الحساب في الكشف الكامل بالفترة
  function openAccStatementFor(text) {
    if (!acsGate()) return;
    const q = String(text || "").trim();
    let hit = null;
    if (q) {
      const nq = normalizeAr(q);
      // 1) كود مطابق بالظبط 2) كود من أوله على مستوى الجزء (2 → 2 و2.1 لكن ما ياخدش 2.10)
      hit = acsAll().filter((a) => String(a.code) === q)[0] ||
        acsAll().filter((a) => { const c = String(a.code || ""); return c === nq || c.indexOf(nq + ".") === 0; })[0];
      // 3) اسم مطابق 4) اسم contains (بالترتيب ده عشان كود "2" ما يطيّش على حساب باسم فيه 2)
      if (!hit) hit = acsAll().filter((a) => normalizeAr(String(a.nameAr || "")) === nq)[0];
      if (!hit) hit = acsAll().filter((a) => normalizeAr(String(a.nameAr || "")).indexOf(nq) >= 0)[0];
    }
    acsSelected = hit ? String(hit.code) : null;
    $("#acsCode").value = "";
    $("#acsName").value = "";
    showView("accStatement");
    if (!hit && q) toast("لقيت «" + q + "» في حركة القيود السريعة، بس مش في دليل الحسابات — جرّب تبحث بالكود أو الاسم هنا.", "warning");
  }

  /* ================== كشوف حسابات الخزائن ================== */
  function renderTreStmt() {
    const sel = $("#cmbTreStmt");
    const prev = sel.value;
    sel.innerHTML = "";
    treasury.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    if (prev && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
    const tid = parseInt(sel.value, 10) || (treasury[0] ? treasury[0].id : 0);
    const t = treasury.find((x) => x.id === tid);
    if (!t) {
      $("#dgvTreStmt tbody").innerHTML = '<tr><td colspan="5">لا توجد خزائن.</td></tr>';
      $("#treStmtBal").textContent = "";
      return;
    }

    const moves = [];
    moves.push({ date: "بداية", desc: "الرصيد الافتتاحي", in: t.openingBalance > 0 ? t.openingBalance : 0, out: 0 });
    sales.filter((s) => Number(s.treasuryId) === Number(tid) && s.paymentMethod !== "آجل").forEach((s) => moves.push({ date: s.invoiceDate || s.date || "—", desc: "فاتورة مبيعات " + (s.invoiceNumber || s.invoiceNo), in: s.grandTotal, out: 0 }));
    purchases.filter((p) => Number(p.treasuryId) === Number(tid) && p.paymentMethod !== "آجل").forEach((p) => moves.push({ date: p.invoiceDate || p.date || "—", desc: "فاتورة مشتريات " + (p.invoiceNumber || p.invoiceNo), in: 0, out: p.grandTotal }));
    vouchers.filter((v) => Number(v.treasuryId) === Number(tid)).forEach((v) => moves.push({ date: v.date, desc: v.desc || (v.type === "in" ? "سند قبض" : "سند صرف"), in: (v.type === "in" || v.kind === "in") ? v.amount : 0, out: (v.type === "out" || v.kind === "out") ? v.amount : 0 }));
    moves.sort((a, b) => (a.date === "بداية" ? -1 : b.date === "بداية" ? 1 : new Date(a.date) - new Date(b.date)));

    let run = 0;
    const rows = moves.map((m) => {
      run = Math.round((run + (m.in || 0) - (m.out || 0)) * 100) / 100;
      return { date: m.date, desc: m.desc, in: m.in, out: m.out, run: run };
    });

    const tb = $("#dgvTreStmt tbody");
    tb.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(r.date) + '</td>' +
        '<td style="text-align:right">' + esc(r.desc) + '</td>' +
        amtTd(r.in, "in", true) +
        amtTd(r.out, "out", true) +
        '<td class="' + (r.run > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(r.run) + '</td>';
      tb.appendChild(tr);
    });
    $("#treStmtBal").textContent = " | الرصيد الحالي: " + fmt(t.balance) + " ج.م";
  }

  function printTreStmt() {
    const t = treasury.find((x) => x.id === parseInt($("#cmbTreStmt").value, 10));
    if (!t) return;
    $("#trpName").textContent = t.name;
    $("#trpBase").textContent = t.type === "cash" ? "صندوق نقدي" : t.type === "bank" ? "حساب بنكي" : "محفظة إلكترونية";
    $("#trpBal").textContent = fmt(t.balance);
    $("#trpBody").innerHTML = $("#dgvTreStmt tbody").innerHTML;
    $("#trpFoot").innerHTML = "الرصيد الحالي: <b>" + fmt(t.balance) + " ج.م</b>";
    printSection($("#treStmtPage"));
  }

  /* ================== التقارير ================== */
  function renderReports() {
    const from = $("#dtpRepFrom").value || "2000-01-01";
    const to = $("#dtpRepTo").value || "2999-12-31";
    const inRange = (d) => (d || "") >= from && (d || "") <= to;
    // 🔁 بناء 108: التقارير صافي بعد المرتجعات (الكمية والقيمة بيتخصم منهم)
    const retByItem = (isSales) => {
      const map = new Map();
      retList(isSales).filter((r) => inRange(retDateOf(r))).forEach((r) => {
        (r.items || []).forEach((it) => {
          const key = it.nameAr || it.product_name;
          const cur = map.get(key) || { qty: 0, val: 0 };
          cur.qty += Number(it.qty) || 0;
          cur.val += Number(it.total) || 0;
          map.set(key, cur);
        });
      });
      return map;
    };
    const retByParty = (isSales) => {
      const map = new Map();
      retList(isSales).filter((r) => inRange(retDateOf(r))).forEach((r) => {
        const key = retParty(r, isSales);
        const cur = map.get(key) || { count: 0, val: 0 };
        cur.count += 1;
        cur.val += Number(r.grandTotal) || 0;
        map.set(key, cur);
      });
      return map;
    };
    const rmS = retByItem(true), rmP = retByItem(false);
    const rpS = retByParty(true), rpP = retByParty(false);

    const agg = (list, isSales) => {
      const rm = isSales ? rmS : rmP;
      const map = new Map();
      list.filter((i) => inRange(i.invoiceDate)).forEach((inv) => {
        (inv.items || []).forEach((it) => {
          const key = it.nameAr;
          const cur = map.get(key) || { qty: 0, val: 0 };
          cur.qty += it.qty;
          cur.val += it.total;
          map.set(key, cur);
        });
      });
      map.forEach((v, key) => {
        const back = rm.get(key);
        if (back) { v.qty -= back.qty; v.val -= back.val; }
      });
      return [...map.entries()]
        .map(([name, v]) => ({ name: name, qty: Math.round(v.qty * 100) / 100, val: Math.round(v.val * 100) / 100 }))
        .filter((r) => r.qty > 0 || r.val > 0)
        .sort((a, b) => b.val - a.val);
    };

    const aggParty = (list, isSales) => {
      const rp = isSales ? rpS : rpP;
      const map = new Map();
      list.filter((i) => inRange(i.invoiceDate)).forEach((inv) => {
        const name = isSales ? inv.customerName : inv.supplierName;
        const cur = map.get(name) || { count: 0, val: 0 };
        cur.count += 1;
        cur.val += inv.grandTotal;
        map.set(name, cur);
      });
      rp.forEach((back, name) => {
        const cur = map.get(name) || { count: 0, val: 0 };
        cur.val -= back.val;
        map.set(name, cur);
      });
      return [...map.entries()]
        .map(([name, v]) => ({ name: name, count: v.count, val: Math.round(v.val * 100) / 100 }))
        .sort((a, b) => b.val - a.val);
    };

    const fill = (tbodyId, rows, cols, dir) => {
      const tb = $(tbodyId);
      tb.innerHTML = "";
      if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="' + cols + '">لا توجد بيانات.</td></tr>';
        return;
      }
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        // 🆕 بناء 123: عمود القيمة في التقارير — المبيعات/العملاء = إيراد (أخضر)، المشتريات/الموردين = مصروف (أحمر)
        tr.innerHTML = '<td>' + esc(r.name) + '</td><td>' + esc(r.qty != null ? Number(r.qty).toLocaleString("en-US") : r.count) + '</td>' + amtTd(r.val, dir);
        tb.appendChild(tr);
      });
    };

    fill("#dgvRepSales tbody", agg(sales, true).slice(0, 15), 3, "in");
    fill("#dgvRepPurch tbody", agg(purchases, false).slice(0, 15), 3, "out");
    fill("#dgvRepCust tbody", aggParty(sales, true), 3, "in");
    fill("#dgvRepSupp tbody", aggParty(purchases, false), 3, "out");

    const sTot = sales.filter((i) => inRange(i.invoiceDate)).reduce((m, i) => m + (i.grandTotal || 0), 0);
    const pTot = purchases.filter((i) => inRange(i.invoiceDate)).reduce((m, i) => m + (i.grandTotal || 0), 0);
    const rSTot = saleReturns.filter((r) => inRange(retDateOf(r))).reduce((m, r) => m + (Number(r.grandTotal) || 0), 0);
    const rPTot = purchaseReturns.filter((r) => inRange(retDateOf(r))).reduce((m, r) => m + (Number(r.grandTotal) || 0), 0);
    let repSum = " | إجمالي المبيعات: " + fmt(Math.max(0, sTot - rSTot)) + " ج.م | إجمالي المشتريات: " + fmt(Math.max(0, pTot - rPTot)) + " ج.م";
    if (rSTot || rPTot) repSum += " | مرتجعات المبيعات: " + fmt(rSTot) + " ج.م | مرتجعات المشتريات: " + fmt(rPTot) + " ج.م";
    $("#repSummary").textContent = repSum;
  }

  function exportReports() {
    const from = $("#dtpRepFrom").value || "2000-01-01";
    const to = $("#dtpRepTo").value || "2999-12-31";
    const rows = [["صنف", "الكمية", "القيمة"]];
    // بناء 138: `$` = querySelector (عنصر واحد) ⇒ `$(...).forEach` كان بيرمي TypeError وما بينزّلش ملف.
    // التصدير لازم يمرّ على كل أسطر الجدول ⇒ querySelectorAll.
    document.querySelectorAll("#dgvRepSales tbody tr").forEach((tr) => rows.push([tr.cells[0].textContent, tr.cells[1].textContent, tr.cells[2].textContent]));
    downloadCSV("reports-" + from + "_" + to + ".csv", rows);
    toast("تم تنزيل ملف Excel للتقارير.", "success");
  }

  /* ================== المستخدمون والصلاحيات ================== */
  let editingUserId = null; // مستخدم محلي قديم (مستخدم في النسخ الاحتياطي فقط)

  // تبويب «المستخدمون والصلاحيات» — يعرض حسابات الشركة الحقيقية من Supabase
  // (نفس بيانات شاشة «تسجيل دخول شركة») بدل النظام المحلي الوهمي.
  var lastOrgMembers = null;
  function renderUsers(forceFetch) {
    const wrap = $("#usersListWrap");
    if (!wrap) return;
    const info = $("#usersOrgInfo");
    const q = normalizeAr($("#txtUserSearch") ? $("#txtUserSearch").value : "");

    const p0 = DATA.getProfile();
    const canManage = isOrgAdmin(p0) || !!(p0 && p0.is_superadmin);

    if (!A.online) {
      wrap.innerHTML = "<p class=\"login-sub\">هذا الجدول يعرض حسابات شركتك من السحابة. يلزم الدخول أونلاين.</p>";
      if (info) info.textContent = "";
      return;
    }

    // البحث يشتغل من الذاكرة بدون طلب جديد للسحابة
    if (lastOrgMembers && !forceFetch) {
      paintOrgMembers(wrap, info, lastOrgMembers, q, canManage);
      return;
    }

    wrap.innerHTML = "<p class=\"login-sub\">جارٍ التحميل...</p>";
    DATA.orgInfo().then((o) => {
      if (!o) throw new Error("لا يوجد حساب مرتبط بشركة");
      if (info) {
        info.textContent = "🏢 " + (o.org_name || "") + " — عدد الحسابات: " +
          (o.members_count || 0) + " من " + (o.max_members || 5);
      }
      return DATA.orgMembers(o.org_id);
    }).then((rows) => {
      lastOrgMembers = rows || [];
      paintOrgMembers(wrap, info, lastOrgMembers, q, canManage);
    }).catch((e) => {
      wrap.innerHTML = '<p class="login-msg err">' + (e.message || e) + "</p>";
    });
  }

  function paintOrgMembers(wrap, info, rows, q, canManage) {
    const list = (rows || []).filter((u) => {
      if (!q) return true;
      return normalizeAr(u.username || "").indexOf(q) >= 0 ||
             normalizeAr(u.full_name || "").indexOf(q) >= 0;
    });
    if (!list.length) {
      wrap.innerHTML = '<p class="login-sub">' +
        (rows && rows.length ? "لا توجد نتائج للبحث." : "لا توجد حسابات بعد.") +
        (canManage ? ' اضغط «➕ إنشاء حساب جديد» لإضافة موظف.' : "") + "</p>";
      return;
    }
    renderMemberList(list, canManage, wrap);
  }

  /* ================== سجل العمليات ================== */
  function renderAudit() {
    const tbody = $("#dgvAudit tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtAuditSearch").value);
    const list = activity.filter((a) => {
      if (!q) return true;
      return normalizeAr(a.ts).includes(q) || normalizeAr(a.user).includes(q) || normalizeAr(a.action).includes(q) || normalizeAr(a.desc).includes(q);
    });
    list.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(a.ts) + '</td>' +
        '<td>' + esc(a.user) + '</td>' +
        '<td>' + esc(a.action) + '</td>' +
        '<td style="text-align:right">' + esc(a.desc) + '</td>';
      tbody.appendChild(tr);
    });
    if (!list.length) tbody.innerHTML = '<tr><td colspan="4">لا توجد عمليات.</td></tr>';
  }

  function exportAudit() {
    const rows = [["الوقت", "المستخدم", "العملية", "البيان"]];
    // بناء 138: نفس العطب في زرار تصدير «سجل العمليات» — `$` بترجّع عنصر واحد فـ forEach بيموت.
    document.querySelectorAll("#dgvAudit tbody tr").forEach((tr) => rows.push(Array.from(tr.cells || []).map((c) => c.textContent)));
    downloadCSV("audit-log.csv", rows);
    toast("تم تنزيل سجل العمليات.", "success");
  }

  /* ================== الإعدادات والنسخ الاحتياطي (تبويبات ديسك توب) ================== */
  // حالة تبويبات الإعدادات: نفس الشكل (org + categories/units/warehouses/owners/wallets/banks)
  //  - العميل: csetData (بيانات شركته) ويحفظها عبر DATA.saveClientSett
  //  - المالك: ssetData (الشركة المحددة في القائمة) ويحفظها عبر DATA.adminSettSave
  let csetData = null;
  let ssetData = null;
  let ssetOrgs = [];

  const SETT_TYPES = {
    cat: { key: "categories", title: "تصنيف", fields: [["name", "اسم التصنيف"], ["description", "الوصف"]] },
    unit: { key: "units", title: "وحدة قياس", fields: [["name", "اسم الوحدة"], ["symbol", "الرمز"]] },
    wh: { key: "warehouses", title: "مستودع", fields: [["code", "الكود"], ["name", "اسم المستودع"], ["address", "العنوان"], ["is_active", "نشط (checkbox)"]] },
    wallet: { key: "wallets", title: "محفظة", fields: [["name", "الشركة / اسم المحفظة"], ["account_no", "رقم المحفظة"], ["opening_balance", "رصيد افتتاحي"], ["balance", "الرصيد الحالي"]] },
    bank: { key: "banks", title: "حساب بنكي", fields: [["name", "اسم البنك"], ["account_no", "رقم الحساب"], ["opening_balance", "رصيد افتتاحي"], ["balance", "الرصيد الحالي"]] },
    owner: { key: "owners", title: "مالك/شريك", fields: [["name", "الاسم"], ["phone", "الهاتف"], ["capital", "رأس المال"], ["withdrawals", "المسحوبات"], ["is_active", "نشط (checkbox)"]] }
  };
  const SETT_HEADERS = {
    categories: [["name", "الاسم"], ["description", "الوصف"]],
    units: [["name", "الاسم"], ["symbol", "الرمز"]],
    warehouses: [["code", "الكود"], ["name", "الاسم"], ["address", "العنوان"], ["is_active", "الحالة"]],
    wallets: [["name", "الشركة / المحفظة"], ["account_no", "رقم المحفظة"], ["balance", "الرصيد"]],
    banks: [["name", "اسم البنك"], ["account_no", "رقم الحساب"], ["balance", "الرصيد"]],
    owners: [["name", "الاسم"], ["phone", "الهاتف"], ["capital", "رأس المال"], ["withdrawals", "المسحوبات"], ["is_active", "الحالة"]]
  };

  function settPayload(prefix) { return prefix === "c" ? csetData : ssetData; }
  function settList(prefix, type) {
    const p = settPayload(prefix);
    if (!p) return [];
    const key = SETT_TYPES[type].key;
    return p[key] || [];
  }
  function settGridId(prefix, type) {
    return (prefix === "c" ? "cGrid" : "sGrid") + type.charAt(0).toUpperCase() + type.slice(1);
  }
  function settCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function fmtNumArrow(v) {
    const n = Number(v || 0);
    return (n < 0 ? "-" : "") + fmt(Math.abs(n)) + " ج.م";
  }

  // رسم جدول تبويب معيّن (العميل أو المالك)
  function renderSettGrid(prefix, type) {
    const box = document.getElementById(settGridId(prefix, type));
    if (!box) return;
    const key = SETT_TYPES[type].key;
    const rows = settList(prefix, type);
    const heads = SETT_HEADERS[key];
    let h = '<table class="data-table"><thead><tr>';
    heads.forEach(([, lbl]) => { h += "<th>" + lbl + "</th>"; });
    h += "<th>إجراءات</th></tr></thead><tbody>";
    rows.forEach((r, idx) => {
      h += "<tr>";
      heads.forEach(([f]) => {
        let v = r[f];
        if (f === "is_active") v = v === false || v === "false" ? "🔴 موقف" : "🟢 نشط";
        else if (f === "balance" || f === "opening_balance" || f === "capital" || f === "withdrawals") {
          v = f === "balance" ? (typeof v === "number" ? fmtNumArrow(v) : esc(v || "0")) : esc(Number(v || 0).toLocaleString("en-US"));
        }
        else v = esc(v || (f === "is_active" ? "🟢 نشط" : "-"));
        h += "<td>" + v + "</td>";
      });
      const lockedUnit = key === "units" && isProtectedUnit(r && (r.name || r.symbol));
      h += "<td>" +
        "<button class=\"btn small blue\" type=\"button\" onclick=\"window.__settEdit('" + prefix + "','" + type + "'," + idx + ")\">✏️</button> " +
        (lockedUnit
          ? "<button class=\"btn small\" type=\"button\" title=\"وحدة أساسية في ميزان — مافيش حذف\" disabled>🔒</button>"
          : "<button class=\"btn small red\" type=\"button\" onclick=\"window.__settDel('" + prefix + "','" + type + "'," + idx + ")\">🗑️</button>") +
        "</td></tr>";
    });
    if (!rows.length) h += '<tr><td colspan="' + (heads.length + 1) + '">لا توجد بيانات بعد.</td></tr>';
    h += "</tbody></table>";
    box.innerHTML = h;
  }

  // نافذة إضافة / تعديل سطر في أحد التبويبات (تخزين مؤقت حتى الضغط على حفظ)
  function settOpenEditor(prefix, type, idx) {
    const def = SETT_TYPES[type];
    const existing = idx != null ? settList(prefix, type)[idx] : null;
    // تنشئ نافذة التحرير ديناميكيًا (لا حاجة لعنصر ثابت في الصفحة)
    let root = document.getElementById("settEditorModal");
    if (!root) {
      const ov = document.createElement("div");
      ov.className = "modal-overlay";
      ov.id = "settEditorModal";
      ov.hidden = true;
      document.body.appendChild(ov);
      ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
      root = ov;
    }
    root.hidden = false;
    root.__prefix = prefix;
    root.__type = type;
    root.__idx = idx == null ? -1 : idx;
    let h = '<div class="modal-box"><div class="panel-title">' +
      (existing ? "✏️ تعديل " : "➕ إضافة ") + def.title + "</div>" +
      '<div class="form-grid" style="grid-template-columns:180px 1fr">';
    def.fields.forEach(([f, label]) => {
      let val = existing ? existing[f] : "";
      if (f === "is_active") {
        const on = val === false || val === "false" || val === undefined ? "1" : "0";
        h += '<label>' + label + ':</label><select id="setF_is_active"><option value="1">🟢 نشط</option><option value="0">🔴 موقف</option></select>';
      } else {
        h += '<label>' + label + ':</label><input id="setF_' + f + '" class="inp" autocomplete="off" value="' + esc(String(val == null ? "" : val)) + '" />';
      }
    });
    h += '</div>' +
      '<div class="sett-btns"><button class="btn green" type="button" id="settEditSave">💾 حفظ</button>' +
      '<button class="btn gray" type="button" id="settEditCancel">إلغاء</button></div></div>';
    root.innerHTML = h;
    root.querySelector("#settEditCancel").onclick = () => (root.hidden = true);
    root.querySelector("#settEditSave").onclick = () => {
      if (root.__type === "cat" && !document.getElementById("setF_name").value.trim()) {
        toast("اكتب اسم التصنيف أولًا.", "warning"); return;
      }
      if (root.__type === "unit" && !document.getElementById("setF_name").value.trim()) {
        toast("اكتب اسم الوحدة أولًا.", "warning"); return;
      }
      if (root.__type !== "wallet" && root.__type !== "bank") {
        const nm = document.getElementById("setF_name").value.trim();
        if (!nm) { toast("اكتب اسم " + SETT_TYPES[root.__type].title + " أولًا.", "warning"); return; }
      }
      const data = settPayload(root.__prefix);
      const key = SETT_TYPES[root.__type].key;
      const list = data[key] || [];
      const rec = existing ? Object.assign({}, existing) : { id: null, name: "", created_at: new Date().toISOString() };
      // 🆕 ترحيل ٣٤: الخزينة الجديدة بتاخد هويتها من الآن (رقم محلي + رقم سحابي ثابت).
      //    لو سِبناها فاضية، دالة الحفظ كانت بتعمل سطرًا بلا local_id ⇒ التطبيق يترقمه
      //    جديد ⇒ سطر تاني على السحابة ⇒ «فودافون كاش مكررة» + فشل رفع الخزائن.
      if (!existing && (root.__type === "wallet" || root.__type === "bank")) {
        const lid = nextTreasuryLocalId(root.__prefix);
        rec.local_id = lid;
        try { rec.id = (window.CLOUD && CLOUD.detUuid) ? CLOUD.detUuid("treasury", lid) : null; } catch (e) { rec.id = null; }
      }
      def.fields.forEach(([f]) => {
        if (f === "is_active") { rec[f] = document.getElementById("setF_is_active").value === "1"; return; }
        const el = document.getElementById("setF_" + f);
        const v = el ? el.value : "";
        // 🆕 بناء 119: المبالغ في تبويب الضبط كانت بتقري بـ parseFloat مباشرة ⇒
        // «50,000.00» بتبقى 50 (نفس عائلة خطأ بناء 118). parseMoney بتتنى الفواصل.
        if (f === "balance" || f === "opening_balance" || f === "capital" || f === "withdrawals") rec[f] = parseMoney(v);
        else rec[f] = v;
      });
      if (root.__idx >= 0) list[root.__idx] = rec; else list.push(rec);
      data[key] = list;
      root.hidden = true;
      renderSettGrid(root.__prefix, root.__type);
      // 🛡 بناء 124: التعديل كان «في الذاكرة بس» لحد ما المستخدم يضغط حفظ — يقفل
      // البرنامج يضيع. دلوقتي بيتخزن على الجهاز فورًا ويترفع للسحابة لو متاحة.
      settAutosave(root.__prefix, root.__type);
    };
  }

  window.__settEdit = function (prefix, type, idx) { settOpenEditor(prefix, type, idx); };
  window.__settDel = function (prefix, type, idx) {
    const data = settPayload(prefix);
    const key = SETT_TYPES[type].key;
    const list = data[key] || [];
    const rec = list[idx];
    const nm = rec ? (rec.name || "هذا السجل") : "هذا السجل";
    /* 🆕 145 — «مش عايزه يتمسح» (بحرفه): الأربع وحدات الأساسية ثابتة في كل شركة.
       بيظهر قفل 🔒 في الجدول بدل زرار الحذف، ولو حد نادى الدالة دي من غير الواجهة
       refuse هنا كمان — والرسالة ودّية بلا أي اصطلاح تقني. */
    if (key === "units" && isProtectedUnit(nm)) {
      toast("«" + nm + "» وحدة أساسية في ميزان ومافيهاش حذف — إضافة وحدات تانية ليك مفتوحة.", "warning");
      return;
    }
    if (type === "wallet" || type === "bank") {
      // الرصيد المرجعي: سجل الخزينة المرتبط (المحسوب فعليًا من الحركات) إن وجد،
      // وإلا الرصيد المكتوب في الإعدادات.
      let bal = Number(rec && (rec.balance != null ? rec.balance : rec.opening_balance) || 0) || 0;
      let linked = null;
      if (prefix === "c" && rec) {
        const norm = (s) => (s || "").replace(/[\s\-_()]/g, "").toLowerCase();
        const nName = norm(rec.name), nAcct = norm(rec.account_no);
        linked = (treasury || []).find((t) => t.type === type && (
          (t.name === rec.name) ||
          (nName && norm(t.name) === nName) ||
          (nAcct && norm(t.accountNo || "") === nAcct) ||
          (nAcct && norm(t.name || "").includes(nAcct))
        )) || null;
        if (linked) bal = Number(linked.balance || 0) || 0;
      }
      if (Math.round(Math.abs(bal) * 100) / 100 > 0) {
        toast("لا يمكن حذف الحساب لوجود رصيد به", "warning");
        return;
      }
      if (!confirm("حذف «" + nm + "»؟ رصيده صفر وسيُحذف نهائيًا بعد الحفظ.")) return;
      list.splice(idx, 1);
      data[key] = list;
      if (prefix === "c" && linked) {
        treasury = (treasury || []).filter((t) => t !== linked);
        saveTreasury();
        if (typeof renderTreasury === "function") { try { renderTreasury(); } catch (e) { } }
      }
      renderSettGrid(prefix, type);
      // 🛡 بناء 124: الحذف اتأكّد عليه المستخدم ⇒ يتخزن على الجهاز ويترفع فورًا
      settAutosave(prefix, type, { force: true });
      return;
    }
    if (!confirm("حذف «" + nm + "»؟")) return;
    list.splice(idx, 1);
    data[key] = list;
    renderSettGrid(prefix, type);
    settAutosave(prefix, type, { force: true });
  };

  // مُحوّل معرّفات حقول الضبط: شاشة العميل بادئتها «c» (csetOrgName) وشاشة المالك
  // بلا بادئة (setOrgName). المحاولة بالبادئة ثم بدونها تصلح الحقل في الشاشتين.
  function settFieldEl(prefix, name) {
    return document.getElementById(prefix + name) || document.getElementById(name);
  }

  // تعبئة حقول بيانات المنشأة / الضريبة من كائن org (سحابة)
  function settFillOrgFields(prefix) {
    const p = settPayload(prefix);
    const org = (p && p.org) || {};
    const en = org.tax_enabled === true || org.tax_enabled === "true" || org.tax_enabled === 1 || org.tax_enabled === "1";
    let rt = Number(org.tax_rate != null ? org.tax_rate : 0);
    if (rt > 0 && rt <= 1) rt = Math.round(rt * 100);
    else if (rt === 0 && settings.taxRate != null && en) {
      let sr = Number(settings.taxRate);
      rt = sr > 1 ? sr : Math.round(sr * 100);
    }
    const g = (name, val) => { const el = settFieldEl(prefix, name); if (el) el.value = val == null ? "" : String(val); };
    g("setOrgName", org.name || "");
    g("setOrgPhone", org.phone || "");
    g("setOrgAddress", org.address || "");
    g("setOrgVat", org.tax_number || "");
    g("setOrgNote", org.org_note || "");
    g("setTaxEnabled", en ? "1" : "0");
    g("setTaxRate", rt || (en ? "14" : "0"));
    g("setTaxTitle", org.tax_title || "");
    g("setPaper", org.paper_size || "A4");
    g("setWarranty", org.warranty_terms || "");
    // صناديق «على الفاتورة» (ترحيل ٣٣)
    const f = normalizeInvFields(org.invoice_fields);
    [["setInvName", "name"], ["setInvPhone", "phone"], ["setInvAddress", "address"], ["setInvVat", "tax_number"]]
      .forEach(([id, k]) => { const el = settFieldEl(prefix, id); if (el) el.checked = !!f[k]; });
  }

  // قراءة حقول بيانات المنشأة / الضريبة إلى كائن org (قبل الحفظ)
  function settReadOrgFields(prefix) {
    const p = settPayload(prefix);
    // 🛡 بناء 124: من غير حمولة (تحميل فشل) ما نبنيش org من الفراغ — كان بيرمي TypeError
    if (!p) return null;
    const org = p.org || {};
    const v = (name) => { const el = settFieldEl(prefix, name); return el ? el.value.trim() : null; };
    // لو الحقل مش موجود في الواجهة نترك القيمة كما هي (ولا نمسحها بإرسال فاضي)
    const put = (key, name) => { const val = v(name); if (val !== null) org[key] = val; };
    put("name", "setOrgName");
    put("phone", "setOrgPhone");
    put("address", "setOrgAddress");
    put("tax_number", "setOrgVat");
    put("org_note", "setOrgNote");
    const taxSel = v("setTaxEnabled");
    if (taxSel !== null) org.tax_enabled = (taxSel === "1");
    const rawRateStr = v("setTaxRate");
    if (rawRateStr !== null) org.tax_rate = parseFloat(String(rawRateStr).replace(/[^\d.-]/g, "")) || 0;
    put("tax_title", "setTaxTitle");
    const paper = v("setPaper");
    org.paper_size = paper || org.paper_size || "A4";
    put("warranty_terms", "setWarranty");
    const chk = (id) => { const el = settFieldEl(prefix, id); return el ? el.checked === true : true; };
    org.invoice_fields = {
      name: chk("setInvName"),
      address: chk("setInvAddress"),
      phone: chk("setInvPhone"),
      tax_number: chk("setInvVat")
    };
    p.org = org;
    return org;
  }

  // مرآة محلية داخل settings: أي جهاز يقرأ نفس الاختيار حتى من غير شبكة
  function mirrorOrgToSettings(org) {
    if (!org) return;
    if (org.name != null) settings.orgName = org.name;
    if (org.phone != null) settings.orgPhone = org.phone;
    if (org.address != null) settings.orgAddress = org.address;
    if (org.tax_number != null) settings.orgVat = org.tax_number;
    if (org.org_note != null) settings.orgNote = org.org_note;
    if (org.warranty_terms != null) settings.orgWarranty = org.warranty_terms;
    if (org.paper_size != null) settings.paperSize = org.paper_size;
    if (org.invoice_fields) settings.invFields = normalizeInvFields(org.invoice_fields);
    try { saveSettings(); } catch (e) {}
  }

  /* ============ 🛡 بناء 124: قوائم الضبط ما تضيعش وما تُمسحش (بلاغ «وحدات القياس بتتمسح») ============
   * المالك 02/10: «وحدات القياس للشركه بتتمسح بعد ما صاحب الشركه يقفل البرنامج صلح الخطا».
   * قياس القاعدة الحيّة (قراءة فقط، probe_units_wipe.js): شركة واحدة بس فيها وحدات
   * (المجد: 4 أسطر من 30/9)، وباقي الشركات **صفر** — مع إن أصنافها وفواتيرها بتستعمل
   * «قطعه» و«وحدة» (القاهرة: 3 أصناف و4 أسطر فاتورة). يعني الوحدات إمّا ما اتحفظتش
   * أبدًا أو اتمسحت. السببان الجذريان في الكود:
   *  (١) الإضافة/التعديل/الحذف في التبويبات كانت **في الذاكرة بس** لحد ما المستخدم
   *      يضغط «حفظ» — التوست «تم التعديل محليًا» بيختفي، يقفل البرنامج ⇒ يضيع كله.
   *  (٢) دوال الحفظ السحابية «استبدال كامل»: أي قائمة توصل غير null ⇒ delete + insert.
   *      و`payload.units || null` ما كانتش بتفرّق بين «مش موجود» و«فاضي» (`[]` truthy)،
   *      فالهيكل الفاضي اللي بيتبني وقت انقطاع الاتصال — أو لو رجعت السحابة null —
   *      كان بيتبعت كله ⇒ مسح جماعي للقوائم الستة.
   * القواعد الجديدة: (أ) أي تعديل يتخزن على الجهاز فورًا ويرجع يظهر بعد إعادة الفتح
   * لحد ما يترفع؛ (ب) **مفيش قائمة تترفع للسحابة إلا لو اتحمّلت منها فعلًا**؛
   * (ج) تفريغ قائمة فيها أسطر على السحابة محتاج تأكيدًا صريحًا بالعدد. */
  const SETT_LIST_KEYS = ["categories", "units", "warehouses", "owners", "wallets", "banks"];
  const SETT_LIST_AR = {
    categories: "التصنيفات", units: "وحدات القياس", warehouses: "المستودعات",
    owners: "الملاك والشركاء", wallets: "المحافظ الإلكترونية", banks: "الحسابات البنكية"
  };
  const SETT_PENDING_PREFIX = "mizan_sett_pending_v1_";
  // حالة تحميل كل جلسة: ok=true **بس** بعد ما الحمولة جت من السحابة فعلًا
  let settLoad = { c: { ok: false, err: "", at: null }, s: { ok: false, err: "", at: null, orgId: null } };
  // مرجع «كان فيه كام سطر على السحابة» وقت التحميل — بيه بنكشف محاولة التفريغ
  let settBaseline = { c: {}, s: {} };

  function settCurrentOrgId() {
    try { if (window.DATA && DATA.orgId) { const v = DATA.orgId(); if (v) return String(v); } } catch (e) { }
    try { const o = (window.DATA && DATA.org) ? DATA.org() : null; if (o && o.id) return String(o.id); } catch (e) { }
    try { const s = localStorage.getItem(LS_STATE_ORG); if (s) return String(s); } catch (e) { }
    return null;
  }
  // مفتاح التخزين المحلي **لكل شركة على حدة** — شركة تانية ما تقرأش ولا تمسحش تعديل دي
  function settPendingKey(prefix) {
    const id = prefix === "s"
      ? ("own_" + ((settLoad.s && settLoad.s.orgId) || "none"))
      : (settCurrentOrgId() || "local");
    return SETT_PENDING_PREFIX + id;
  }
  function settReadPending(prefix) {
    try {
      const raw = localStorage.getItem(settPendingKey(prefix));
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && typeof p === "object") ? p : null;
    } catch (e) { return null; }
  }
  function settWritePending(prefix, key, list) {
    try {
      const all = settReadPending(prefix) || {};
      all[key] = JSON.parse(JSON.stringify(list || []));
      all.__at = new Date().toISOString();
      localStorage.setItem(settPendingKey(prefix), JSON.stringify(all));
      return true;
    } catch (e) { return false; }
  }
  function settDropPending(prefix, key) {
    try {
      const k = settPendingKey(prefix);
      const all = settReadPending(prefix);
      if (!all) return;
      if (key) delete all[key];
      const left = SETT_LIST_KEYS.filter((x) => Array.isArray(all[x]));
      if (!key || !left.length) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(all));
    } catch (e) { }
  }
  function settPendingKeys(prefix) {
    const all = settReadPending(prefix) || {};
    return SETT_LIST_KEYS.filter((k) => Array.isArray(all[k]) && all[k].length);
  }

  function settMarkLoaded(prefix, payload, orgId) {
    settLoad[prefix] = prefix === "s"
      ? { ok: true, err: "", at: new Date().toISOString(), orgId: orgId || (settLoad.s && settLoad.s.orgId) || null }
      : { ok: true, err: "", at: new Date().toISOString() };
    /* 🆕 145: الأربع وحدات المحمية بتنضم للقائمة **وقت التحميل** (من السحابة أو من نسخة الجهاز)
       ⇒ شركة جديدة تلاقي «كيلو/قطعة/دسته/كرتونة» جاهزة، وأي شركة موجودة ما تنقصهاش وحدة منهم.
       عشان كده الأساس (baseline) بيتحسب **بعد** الضم، فـ«التفريغ» اللي بيطلب تأكيد ما يغلطش
       بين «اللي الجاي من السحابة» و«اللي إحنا زودناه». */
    if (payload) payload.units = withProtectedUnits(payload.units);
    const b = {};
    SETT_LIST_KEYS.forEach((k) => { b[k] = Array.isArray(payload && payload[k]) ? payload[k].length : 0; });
    settBaseline[prefix] = b;
    if (payload && payload.__online === undefined) payload.__online = true;
  }
  function settMarkFailed(prefix, err, orgId) {
    settLoad[prefix] = prefix === "s"
      ? { ok: false, err: String(err || ""), at: new Date().toISOString(), orgId: orgId || null }
      : { ok: false, err: String(err || ""), at: new Date().toISOString() };
    settBaseline[prefix] = {};
  }
  function settIsLoaded(prefix) { return !!(settLoad[prefix] && settLoad[prefix].ok); }

  /* القائمة اللي تتبعت للسحابة، أو null = «ما تبعتش خالص» (الدالة ما تلمسش الجدول).
   * بترفض لو الحمولة ما اتحمّلتش من السحابة، ولو هتفرّغ قائمة فيها أسطر بتطلب تأكيدًا. */
  function settSafeList(prefix, key, opts) {
    const why = (opts && opts.why) ? opts.why : null;
    const p = settPayload(prefix);
    if (!p || !Array.isArray(p[key])) { if (why) why.v = "nopayload"; return null; }
    if (!settIsLoaded(prefix)) { if (why) why.v = "notloaded"; return null; }
    const before = Number((settBaseline[prefix] || {})[key] || 0);
    const now = p[key].length;
    if (before > 0 && now === 0 && !(opts && opts.force)) {
      const label = SETT_LIST_AR[key] || key;
      const ok = (typeof confirm === "function")
        ? confirm("⚠️ قائمة «" + label + "» فيها " + before + (before < 11 ? " أسطر" : " سطرًا") +
          " محفوظة على السحابة، واللي هيتبعت دلوقتي فاضي.\n\nيعني هتتمسح كلها.\n\nلو متأكد اضغط «موافق»، ولو لأ اضغط «إلغاء» وسيب القائمة زي ما هي.")
        : false;
      if (!ok) { if (why) why.v = "cancelled"; return null; }
    }
    return p[key];
  }
  /* حمولة «حفظ جميع التبويبات» الآمنة: org دايمًا + القوائم اللي بس مسموح تبعتها،
   * وأي قائمة مرفوضة بتتسجل عشان نصارح المستخدم بدل ما تضيع في صمت. */
  function settSafePayload(prefix) {
    const src0 = settPayload(prefix);
    if (!src0) return { payload: {}, skipped: SETT_LIST_KEYS.slice(), noPayload: true };
    settReadOrgFields(prefix);
    const src = settPayload(prefix) || {};
    const out = {};
    const skipped = [];
    if (src.org) out.org = src.org;
    SETT_LIST_KEYS.forEach((k) => {
      if (!(k in src)) return;
      const v = settSafeList(prefix, k);
      if (v === null) { skipped.push(k); return; }
      out[k] = k === "units" ? withProtectedUnits(v) : v;
    });
    return { payload: out, skipped: skipped, noPayload: false };
  }
  function settSkipText(skipped) {
    if (!skipped || !skipped.length) return "";
    return "ملحوظة: " + skipped.map((k) => SETT_LIST_AR[k] || k).join("، ") +
      " ما اترفعتش لأن بياناتها ما اتحمّلتش من السحابة (منعًا لمسحها) — اضغط «🔄 تحديث» وبعدين احفظ تاني.";
  }

  function settRowSig(key, r) {
    if (!r) return "";
    if (r.id) return "id:" + r.id;
    const nm = String(r.name || "").trim();
    const extra = key === "units" ? String(r.symbol || "").trim()
      : key === "warehouses" ? String(r.code || "").trim()
        : String(r.account_no || "").trim();
    return "n:" + nm + "|" + extra;
  }
  /* بعد تحميل ناجح: أي تعديل اتخزن على الجهاز وما اترفعش يرجع يظهر (اتحاد بالهوية/الاسم)
   * بدل ما يضيع — وبنقول للمستخدم صراحةً إن فيه لسه ما اترفعش. */
  function settApplyPending(prefix) {
    const pend = settReadPending(prefix);
    const res = { added: {}, stale: [], left: [] };
    if (!pend) return res;
    const p = settPayload(prefix);
    if (!p) { res.left = settPendingKeys(prefix); return res; }
    SETT_LIST_KEYS.forEach((k) => {
      if (!Array.isArray(pend[k]) || !pend[k].length) return;
      if (!Array.isArray(p[k])) p[k] = [];
      const have = new Set(p[k].map((r) => settRowSig(k, r)));
      const names = new Set(p[k].map((r) => String((r && r.name) || "").trim()).filter(Boolean));
      let added = 0, missing = 0;
      pend[k].forEach((r) => {
        const sig = settRowSig(k, r);
        const nm = String((r && r.name) || "").trim();
        if (have.has(sig) || (nm && names.has(nm))) return;
        missing++;
        p[k].push(r);
        have.add(sig);
        if (nm) names.add(nm);
        added++;
      });
      if (added) res.added[k] = added;
      if (!missing) res.stale.push(k);        // كله موجود على السحابة ⇒ النسخة المحلية بقت قديمة
      else res.left.push(k);
    });
    res.stale.forEach((k) => settDropPending(prefix, k));
    return res;
  }
  // لافتة واحدة صريحة في شاشة الضبط (بدل التوست اللي بيختفي)
  function settNoticeBox(prefix) {
    return document.getElementById(prefix === "s" ? "settNoticeOwner" : "settNotice");
  }
  function settNotice(msg, kind, prefix) {
    const box = settNoticeBox(prefix);
    if (!box) return;
    box.textContent = "";
    box.hidden = !msg;
    box.className = "sett-notice" + (kind ? " " + kind : "");
    if (!msg) return;
    box.appendChild(document.createTextNode(msg));
  }
  function settNoticePending(prefix) {
    const left = settPendingKeys(prefix);
    if (!left.length) { settNotice("", "", prefix); return; }
    settNotice("⏳ فيه تعديلات محفوظة على الجهاز لسه ما اترفعتش للسحابة: " +
      left.map((k) => SETT_LIST_AR[k] || k).join("، ") +
      ". اضغط «💾 حفظ» في التبويب لرفعها — مش هتضيع لو قفلت البرنامج.", "warn", prefix);
  }
  /* وحدات مستعملة في الأصناف/الفواتير ومش موجودة في القائمة — بنعرضها كزرار اختياري
   * (بلا أي كتابة صامتة على السحابة): العميل يرجّع وحداته بضغطة بعد ما كانت بتضيع. */
  function settMissingUnits() {
    const p = csetData;
    const have = new Set(((p && Array.isArray(p.units)) ? p.units : [])
      .map((u) => String((u && (typeof u === "string" ? u : (u.name || u.symbol))) || "").trim())
      .filter(Boolean));
    const miss = [];
    const add = (v) => {
      const n = String(v || "").trim();
      if (!n || have.has(n) || miss.indexOf(n) >= 0) return;
      miss.push(n);
    };
    try { (products || []).forEach((x) => add(x && x.unit)); } catch (e) { }
    try {
      (sales || []).forEach((s) => (s && Array.isArray(s.items) ? s.items : []).forEach((it) => add(lineUnit(it))));
      (purchases || []).forEach((s) => (s && Array.isArray(s.items) ? s.items : []).forEach((it) => add(lineUnit(it))));
    } catch (e) { }
    return miss;
  }
  function settOfferMissingUnits() {
    const box = document.getElementById("settNotice");
    if (!box || !csetData || !settIsLoaded("c")) return;
    const miss = settMissingUnits();
    if (!miss.length) return;
    const old = box.querySelector("#btnFixUnits");
    if (old) old.remove();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnFixUnits";
    btn.className = "btn small blue";
    btn.style.marginTop = "6px";
    btn.textContent = "➕ أضف الوحدات المستعملة في الأصناف (" + miss.length + "): " + miss.join("، ");
    btn.addEventListener("click", function () {
      if (!Array.isArray(csetData.units)) csetData.units = [];
      miss.forEach((n) => {
        const dup = csetData.units.some((u) => String((u && (u.name || u.symbol)) || "").trim() === n);
        if (!dup) csetData.units.push({ id: null, name: n, symbol: "", created_at: new Date().toISOString() });
      });
      renderSettGrid("c", "unit");
      settWritePending("c", "units", csetData.units);
      settAutosave("c", "unit");
    });
    box.hidden = false;
    box.appendChild(document.createElement("br"));
    box.appendChild(btn);
  }
  /* التخزين الفوري على الجهاز + الرفع للسحابة أول ما يكون متاح.
   * دي النقطة اللي كانت بتضيّع الشغل: من غيرها أي إضافة كانت في الذاكرة بس. */
  function settAutosave(prefix, type, opts) {
    const def = SETT_TYPES[type];
    const key = def ? def.key : null;
    if (!key) return;
    const p = settPayload(prefix);
    const list = (p && Array.isArray(p[key])) ? p[key] : [];
    const stored = settWritePending(prefix, key, list);
    const canCloud = A.online && window.DATA && settIsLoaded(prefix) &&
      ((prefix === "c" && DATA.saveClientSett) || (prefix === "s" && DATA.adminSettSave));
    if (canCloud) { saveSettPane(prefix, type, opts); return; }
    if (stored) {
      settNoticePending(prefix);
      toast("اتحفظ «" + (def.title || "") + "» على جهازك ✓ — هيترفع للسحابة أول ما تفتح والنت شغال.", "info");
    } else {
      toast("تعذّر الحفظ على الجهاز. افتح الشبكة واضغط «💾 حفظ» قبل ما تقفل البرنامج.", "warning");
    }
  }

  // ================== العميل: تحميل وحفظ تبويبات شركته ==================
  function loadClientSettingsForm() {
    try { renderDocRootBox(); } catch (e) {} // build 105: صندوق مسار المستندات
    if (A.online && DATA && DATA.clientSett) {
      $("#csettTabs").disabled = true;
      DATA.clientSett().then((p) => {
        // 🛡 بناء 124: `p || skeleton` كان بيعلّم هيكلًا فاضيًا إنه «من السحابة» (__online)
        // ⇒ أي حفظ بعده كان بيمسح القوائم الستة. الحمولة الناقصة/null = **ما اتحمّلتش**.
        if (!p || typeof p !== "object") {
          settMarkFailed("c", "السحابة رجعت حمولة فاضية");
          csetData = null;
          renderAllSettPanes("c");
          settNotice("⚠️ تعذّر قراءة إعدادات مؤسستك من السحابة (رجعت فاضية). القوائم مقفولة للحفظ لحد ما تتحمّل — اضغط «🔄 تحديث». مافيش حاجة هتتمسح.", "err", "c");
          try { renderCItems(); } catch (e) {}
          return;
        }
        csetData = p;
        csetData.__online = true;
        settMarkLoaded("c", csetData);
        if (csetData && csetData.org) {
          if (csetData.org.tax_enabled !== undefined && csetData.org.tax_enabled !== null) {
            applyTaxSettings(csetData.org.tax_enabled, csetData.org.tax_rate);
          }
          // مرآة محلية: الفاتورة تقرأ بيانات المنشأة واختيار «على الفاتورة» من نفس المصدر
          try { mirrorOrgToSettings(csetData.org); } catch (e) {}
        }
        applySettFeatureGatingClient();
        // 🆕 ترحيل ٣٤: نصلّح الهويات وننقّي التكرار قبل الرسم، عشان العميل يشوف حسابه مرة واحدة
        syncTreasuryFromSett();
        // 🛡 بناء 119: المرجع اللي بنقارن بيه بعد كده = اللي ظهر قدام المستخدم الآن
        try { captureOpeningBaseline(); } catch (e) {}
        // 🛡 بناء 124: أي تعديل محفوظ على الجهاز وما اترفعش يرجع يظهر (مش يضيع)
        try {
          const merged = settApplyPending("c");
          const names = Object.keys(merged.added || {});
          if (names.length) {
            toast("رجّعنا تعديلاتك المحفوظة على الجهاز: " +
              names.map((k) => (SETT_LIST_AR[k] || k) + " (+" + merged.added[k] + ")").join("، ") +
              " — اضغط حفظ لرفعها.", "info");
          }
        } catch (e) {}
        renderAllSettPanes("c");
        renderCItems(); // 🆕 بناء 115: بنود المصروفات والإيرادات (من دليل الحسابات مش من payload الضبط)
        try { settNoticePending("c"); settOfferMissingUnits(); } catch (e) {}
      }).catch((e) => {
        // 🛡 بناء 124: فشل التحميل = القوائم **مش محمّلة** ⇒ الحفظ ما يرفعهاش خالص (منع المسح)
        settMarkFailed("c", (e && e.message) || e);
        toast("تعذّر تحميل إعدادات مؤسستك: " + (e.message || e), "error");
        settNotice("⚠️ تعذّر تحميل إعدادات مؤسستك من السحابة: " + ((e && e.message) || e) +
          ". القوائم مقفولة للحفظ لحد ما تتحمّل — اضغط «🔄 تحديث». مافيش حاجة هتتمسح.", "err", "c");
        try { renderAllSettPanes("c"); } catch (e2) {}
      });
      return;
    }
    // وضع بلا شبكة: هيكل محلي للقراءة/العرض فقط — **مش محمّل من السحابة** ⇒ ممنوع يترفع
    settMarkFailed("c", "لا يوجد اتصال بالسحابة");
    csetData = {
      org: { name: settings.orgName || "", phone: settings.orgPhone || "", address: settings.orgAddress || "", tax_number: settings.orgVat || "", org_note: settings.orgNote || "", tax_enabled: !!settings.taxEnabled, tax_rate: Math.round((settings.taxRate || 0) * 100), tax_title: "", paper_size: settings.paperSize || "A4", warranty_terms: settings.orgWarranty || "", invoice_fields: normalizeInvFields(settings.invFields) },
      categories: [], units: withProtectedUnits([]), warehouses: [], owners: [], wallets: [], banks: []
    };
    try {
      // الوحدات/القوائم المحفوظة على الجهاز تظهر حتى من غير شبكة (بدل شاشة فاضية)
      const merged = settApplyPending("c");
      renderAllSettPanes("c");
      if (settPendingKeys("c").length) settNoticePending("c");
      else if (Object.keys(merged.added || {}).length) renderAllSettPanes("c");
    } catch (e) {
      renderAllSettPanes("c");
    }
    renderCItems(); // 🆕 بناء 115
  }

  function gatherSettPayload(prefix) {
    settReadOrgFields(prefix);
    return settPayload(prefix);
  }

  function saveClientSettingsForm() {
    // 🛡 بناء 124: الحمولة الآمنة — القوائم اللي ما اتحمّلتش من السحابة ما تتبعتش خالص
    const safe = settSafePayload("c");
    const payload = safe.payload;
    if (safe.noPayload || !payload.org) {
      settNotice("⚠️ إعدادات مؤسستك لسه ما اتحمّلتش من السحابة، فالحفظ مقفول عشان ما نضيّعش حاجة. اضغط «🔄 تحديث» وجرّب تاني.", "err", "c");
      toast("تعذّر الحفظ: البيانات لسه ما اتحمّلتش. اضغط «🔄 تحديث».", "warning");
      return;
    }
    const doAfter = () => {
      applyTaxSettings(payload.org.tax_enabled, payload.org.tax_rate);
      mirrorOrgToSettings(payload.org);
      addActivity("إعدادات", "تعديل إعدادات المؤسسة");
      // اللي اترفع فعلًا يتشال من نسخة الجهاز، واللي لسه معلّق يفضل ظاهر في اللافتة
      SETT_LIST_KEYS.forEach((k) => { if (Array.isArray(payload[k])) settDropPending("c", k); });
      try {
        const left = settPendingKeys("c");
        if (left.length) settNoticePending("c");
        else { settNotice(safe.skipped.length ? settSkipText(safe.skipped) : "", safe.skipped.length ? "warn" : "", "c"); }
      } catch (e) { }
      toast("تم حفظ إعدادات مؤسستك بنجاح." + (safe.skipped.length ? " (" + settSkipText(safe.skipped) + ")" : ""), "success");
    };
    if (A.online && DATA && DATA.saveClientSett) {
      DATA.saveClientSett(payload).then(doAfter).catch((e) => {
        // الحفظ فشل ⇒ التعديلات تتخزن على الجهاز وتفضل مطالبة بالرفع (مش تضيع)
        try { SETT_LIST_KEYS.forEach((k) => { if (Array.isArray(payload[k])) settWritePending("c", k, payload[k]); }); settNoticePending("c"); } catch (e2) { }
        toast("خطأ في الحفظ: " + (e.message || e) + " — تعديلاتك محفوظة على الجهاز ومش هتضيع.", "error");
      });
    } else {
      // بلا شبكة: نخزن على الجهاز فورًا عشان قفل البرنامج ما يضيّعش الشغل
      try { SETT_LIST_KEYS.forEach((k) => { if (Array.isArray(payload[k])) settWritePending("c", k, payload[k]); }); } catch (e) { }
      doAfter();
      try { settNoticePending("c"); } catch (e) { }
    }
  }

  // بعد حفظ أي تبويب ضبط: تحدّث القوائم الحية المفتوحة (تصنيفات/وحدات/مستودعات) فورًا
  function syncOpenListsAfterSett() {
    try {
      if (document.getElementById("viewProducts") && !document.getElementById("viewProducts").hidden) {
        renderProducts();
      }
      if (document.getElementById("fPCategory")) fillCatSelect("#fPCategory", ($("#fPCategory") || {}).value || null);
      if (document.getElementById("fPUnit")) fillUnitSelect("#fPUnit", ($("#fPUnit") || {}).value || null);
      if (document.getElementById("fPWarehouse")) fillWhSelect("#fPWarehouse", ($("#fPWarehouse") || {}).value || null);
      if (document.getElementById("qCat")) fillCatSelect("#qCat", null);
      if (document.getElementById("qUnit")) fillUnitSelect("#qUnit", null);
      if (document.getElementById("cmbPosWarehouse")) {
        const w = $("#cmbPosWarehouse").value;
        const s = $("#cmbPosWarehouse");
        s.innerHTML = "";
        warehouseList().forEach((x) => { const o = document.createElement("option"); o.value = x; o.textContent = x; s.appendChild(o); });
        if (w) s.value = w;
      }
      if (document.getElementById("cmbPPWarehouse")) {
        const w = $("#cmbPPWarehouse").value;
        const s = $("#cmbPPWarehouse");
        s.innerHTML = "";
        warehouseList().forEach((x) => { const o = document.createElement("option"); o.value = x; o.textContent = x; s.appendChild(o); });
        if (w) s.value = w;
      }
      if (document.getElementById("stkWarehouse")) fillWhSelect("#stkWarehouse", ($("#stkWarehouse") || {}).value || null);
      if (document.getElementById("trFrom")) fillWhSelect("#trFrom", ($("#trFrom") || {}).value || null);
    } catch (e) {}
  }

  // حفظ تبويب واحد فقط (منفصل لكل قائمة): يرسل جزئه فقط دون المساس بالباقي
  function saveSettPane(prefix, type, opts) {
    const isOwner = prefix === "s";
    const ttl = type === "org" ? "بيانات المنشأة" : type === "tax" ? "الضريبة والفواتير" : (SETT_TYPES[type] ? SETT_TYPES[type].title : type);
    let payload = {};
    const paneKey = (type === "org" || type === "tax") ? null : (SETT_TYPES[type] ? SETT_TYPES[type].key : null);
    if (!paneKey) {
      // يقرأ حقول المنشأة/الضريبة الحالية من الواجهة ويحدّث كائن org فقط (لا يمسّ القوائم)
      const org = settReadOrgFields(prefix);
      if (!org) { toast("البيانات لسه ما اتحمّلتش — اضغط «🔄 تحديث».", "warning"); return; }
      payload.org = org;
    } else {
      // 🛡 بناء 124: القائمة ما تترفعش إلا لو اتحمّلت من السحابة فعلًا، وتفريغها محتاج تأكيدًا
      const why = {};
      const list = settSafeList(prefix, paneKey, { why: why, force: !!(opts && opts.force) });
      if (list === null) {
        if (why.v === "cancelled") { toast("تمام — سيبنا «" + ttl + "» زي ما هي وما مسحناش حاجة.", "info"); return; }
        // ما اتحمّلتش ⇒ نخزن على الجهاز (الشغل ما يضيعش) ونمنع الرفع
        try { settWritePending(prefix, paneKey, settList(prefix, type)); } catch (e) { }
        if (isOwner) { toast("اختر الشركة واستنى تحميل بياناتها قبل الحفظ.", "warning"); return; }
        settNoticePending(prefix);
        toast("تعذّر تحميل «" + ttl + "» من السحابة، فحفظناها على جهازك ومنعنا رفعها عشان ما تُمسحش. اضغط «🔄 تحديث» وبعدين احفظ.", "warning");
        return;
      }
      payload[paneKey] = paneKey === "units" ? withProtectedUnits(list) : list.slice();
    }
    const after = () => {
      if (payload.org) {
        applyTaxSettings(payload.org.tax_enabled, payload.org.tax_rate);
        // المرآة المحلية بتاعة الفاتورة بتاعة «شاشة العميل بشركته» بس —
        // مفيش منطق إن إعدادات شركة تانية تدخل في إعدادات المالك المحلي.
        if (prefix === "c") mirrorOrgToSettings(payload.org);
      }
      // 🛡 بناء 124: اللي اترفع للسحابة بنجاح يخرج من نسخة الجهاز المعلّقة
      if (paneKey) { try { settDropPending(prefix, paneKey); settNoticePending(prefix); } catch (e) { } }
      renderAllSettPanes(prefix);
      // الضبط هو المرجع → حدّث القوائم الحية بعد الحفظ مباشرة
      try {
        // 🆕 ترحيل ٣٤: دمج الجزء المحفوظ في الحمولة الحالية (بدل استبدالها بكائن ناقص
        // كان بيطير منه __online وبقية التبويبات)، وبعدين نصلّح الهويات ونعيد الرسم.
        if (prefix === "c" && csetData && payload && Object.keys(payload).length) {
          Object.keys(payload).forEach((k) => { csetData[k] = payload[k]; });
          csetData.__online = true;
        }
        syncTreasuryFromSett();
        // 🛡 بناء 119: الرصيد الافتتاحي اللي كتبه في التبويب يمشي للسحابة بسطره هو
        // (بعد ما يشال من الرفع الجماعي) — بس للسطور اللي غيّرها فعلًا.
        if (prefix === "c" && (type === "bank" || type === "wallet")) {
          try { syncOpeningsWithCloud(); } catch (e) {}
        }
        syncOpenListsAfterSett();
        renderAllSettPanes(prefix);
        if (!document.getElementById("viewTreasury").hidden) renderTreasury();
        if (prefix === "c" && paneKey === "units") { try { settOfferMissingUnits(); } catch (e) { } }
      } catch (e) {}
      addActivity("إعدادات", "حفظ تبويب «" + ttl + "»");
      toast("تم حفظ «" + ttl + "» على السحابة بنجاح ✓", "success");
    };
    // فشل الرفع ⇒ التعديل يفضل محفوظًا على الجهاز ومطلوب في اللافتة (ما يضيعش أبدًا)
    const onErr = (e) => {
      if (paneKey) { try { settWritePending(prefix, paneKey, payload[paneKey]); settNoticePending(prefix); } catch (e2) { } }
      toast("خطأ في الحفظ: " + ((e && e.message) || e) + " — تعديلاتك محفوظة على جهازك ومش هتضيع.", "error");
    };
    if (isOwner) {
      const orgId = $("#setOrgPicker") ? $("#setOrgPicker").value : null;
      if (!orgId || !ssetData) { toast("اختر الشركة أولًا.", "warning"); return; }
      DATA.adminSettSave(orgId, payload).then(() => {
        after();
        // لو عدّل اسم الشركة → يتحدث في شاشة الإدارة فورًا
        if (type === "org" && payload.org && payload.org.name) {
          const o = ssetOrgs.find((x) => x.org_id === orgId);
          if (o) o.org_name = payload.org.name;
          if (window.__admDbl) { /* سيُعاد الجلب عند فتح شاشة الإدارة */ }
        }
      }).catch(onErr);
      return;
    }
    if (!(A.online && DATA && DATA.saveClientSett)) { onErr("لا يوجد اتصال بالسحابة"); return; }
    DATA.saveClientSett(payload).then(after).catch(onErr);
  }

  // ================== المالك: تبويبات الشركة المحددة ==================
  function loadSettingsForm() {
    if (!(A.online && DATA && DATA.adminOrgs && DATA.adminSettLoad)) {
      toast("هذه الشاشة للسحابة فقط.", "warning");
      showView("dashboard");
      return;
    }
    DATA.adminOrgs().then((orgs) => {
      ssetOrgs = orgs || [];
      const cnt = $("#deployOrgCount");
      if (cnt) cnt.textContent = ssetOrgs.length
        ? "(ببيانات " + ssetOrgs.length + (ssetOrgs.length < 11 ? " شركات" : " شركة") + ")"
        : "(لا توجد شركات بعد — السيرفر فاضي)";
      const picker = $("#setOrgPicker");
      if (!picker) return;
      let prev = picker.value;
      picker.innerHTML = "";
      ssetOrgs.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.org_id;
        opt.textContent = o.org_name;
        if (!prev || !ssetOrgs.some((x) => x.org_id === prev)) prev = o.org_id;
        if (o.org_id === prev) opt.selected = true;
        picker.appendChild(opt);
      });
      // قوائم نطاق النسخ والاستعادة (الكل + كل شركة)
      const fillScope = (selId, extraRows) => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        sel.innerHTML = "";
        extraRows.forEach(([v, t]) => {
          const op = document.createElement("option");
          op.value = v;
          op.textContent = t;
          sel.appendChild(op);
        });
        ssetOrgs.forEach((o) => {
          const op = document.createElement("option");
          op.value = o.org_id;
          op.textContent = o.org_name;
          sel.appendChild(op);
        });
      };
      fillScope("setBackupScope", [["", "🔵 الكل (كل العملاء)"]]);
      fillScope("setRestoreScope", [["", "🔵 الكل (كل العملاء)"]]);
      loadSettForOrg((picker.value || prev));
    }).catch((e) => toast("تعذّر تحميل الشركات: " + (e.message || e), "error"));
  }

  function loadSettForOrg(orgId) {
    if (!orgId) return;
    DATA.adminSettLoad(orgId).then((p) => {
      // 🛡 بناء 124: نفس قاعدة العميل — حمولة ناقصة/null = «ما اتحمّلتش» ⇒ الحفظ ما يرفعش القوائم
      if (!p || typeof p !== "object") {
        settMarkFailed("s", "السحابة رجعت حمولة فاضية", orgId);
        ssetData = null;
        renderAllSettPanes("s");
        settNotice("⚠️ تعذّر قراءة إعدادات الشركة من السحابة. القوائم مقفولة للحفظ — اختر الشركة تاني. مافيش حاجة هتتمسح.", "err", "s");
        return;
      }
      ssetData = p;
      ssetData.__online = true;
      settMarkLoaded("s", ssetData, orgId);
      try { settApplyPending("s"); } catch (e) { }
      renderAllSettPanes("s");
      try { settNoticePending("s"); } catch (e) { }
      const o = ssetOrgs.find((x) => x.org_id === orgId);
      if (o) {
        const t = $("#viewSettings .view-title");
        if (t) t.textContent = "🛡️ إعدادات ونسخ احتياطي المالك — " + (o.org_name || "");
      }
    }).catch((e) => {
      settMarkFailed("s", (e && e.message) || e, orgId);
      toast("تعذّر تحميل إعدادات الشركة: " + (e.message || e), "error");
      settNotice("⚠️ تعذّر تحميل إعدادات الشركة: " + ((e && e.message) || e) + ". القوائم مقفولة للحفظ لحد ما تتحمّل. مافيش حاجة هتتمسح.", "err", "s");
    });
  }

  function saveSettingsForm() {
    const orgId = $("#setOrgPicker") ? $("#setOrgPicker").value : null;
    if (!orgId || !ssetData) { toast("اختر الشركة أولًا.", "warning"); return; }
    // 🛡 بناء 124: نفس قاعدة العميل — القوائم اللي ما اتحمّلتش ما تتبعتش (منع المسح الجماعي)
    const safe = settSafePayload("s");
    const payload = safe.payload;
    DATA.adminSettSave(orgId, payload).then(() => {
      addActivity("إعدادات", "تعديل إعدادات شركة (المالك)");
      SETT_LIST_KEYS.forEach((k) => { if (Array.isArray(payload[k])) settDropPending("s", k); });
      toast("تم حفظ تبويبات الشركة بنجاح." + (safe.skipped.length ? " (" + settSkipText(safe.skipped) + ")" : ""), "success");
      try { settNoticePending("s"); } catch (e) { }
      renderAllSettPanes("s");
    }).catch((e) => {
      try { SETT_LIST_KEYS.forEach((k) => { if (Array.isArray(payload[k])) settWritePending("s", k, payload[k]); }); settNoticePending("s"); } catch (e2) { }
      toast("خطأ في الحفظ: " + ((e && e.message) || e) + " — التعديلات محفوظة على الجهاز ومش هتضيع.", "error");
    });
  }

  // رسم كل ألواح التبويبات لجلسة معيّنة (c/s)
  function renderAllSettPanes(prefix) {
    settFillOrgFields(prefix);
    ["cat", "unit", "wh", "wallet", "bank", "owner"].forEach((t) => renderSettGrid(prefix, t));
  }

  // قفل تبويبات العميل المعطلة في الاشتراك (الميزات جديدة من لوحة الإدارة)
  function applySettFeatureGatingClient() {
    const featMap = { ccat: "catTab", cunit: "unitTab", cwh: "whTab", cwal: "walletTab", cbnk: "bankTab", cown: "ownerTab" };
    const root = document.getElementById("viewClientSettings");
    if (!root) return;
    root.querySelectorAll("#csettTabs .tab-btn").forEach((b) => {
      const pane = root.querySelector('.sett-pane[data-pane="' + b.dataset.tab + '"]');
      const feat = featMap[b.dataset.tab];
      const enabled = !feat || (window.DATA && DATA.featureEnabled(feat) !== false);
      if (!enabled) b.classList.add("locked");
      else b.classList.remove("locked");
      // التبويبات المعطلة تبقى مقفلة برسالة (لا يظهر فحواها)
      if (pane && pane.dataset.feat && !enabled) {
        const tl = pane.dataset.featLabel || "الميزة غير مفعلة في اشتراكك — تواصل مع المالك";
        pane.setAttribute("data-orig", pane.innerHTML);
        pane.innerHTML = '<div class="pane-locked"><span class="plk-icon">🔒</span><span>' + tl + "</span></div>";
        pane.hidden = true;
      } else if (pane && !enabled) {
        pane.hidden = true;
      }
    });
  }

  // ================== نسخة احتياطية واستعادة للعميل (شركته فقط) ==================
  function backupData() {
    if (A.online && DATA && DATA.clientExport) {
      toast("جارٍ تجهيز نسخة احتياطية من بيانات شركتك...", "info");
      DATA.clientExport().then((pack) => {
        if (!pack) throw new Error("لا توجد بيانات لشركتك");
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mizan-backup-" + todayISO() + ".json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        addActivity("نسخ احتياطي", "تصدير نسخة احتياطية من بيانات مؤسستي");
        toast("تم تنزيل نسخة احتياطية من بيانات شركتك (JSON).", "success");
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
      return;
    }
    const pack = {
      exportedAt: new Date().toISOString(),
      settings: settings,
      customers: customers,
      txs: txs,
      products: products,
      sales: sales,
      purchases: purchases,
      saleReturns: saleReturns,
      purchaseReturns: purchaseReturns,
      treasury: treasury,
      suppliers: suppliers,
      supplierTxs: supplierTxs,
      accounts: accounts,
      journalEntries: journalEntries,
      users: users,
      vouchers: vouchers,
      activity: activity
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mizan-web-backup-" + todayISO() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    addActivity("نسخ احتياطي", "تصدير نسخة احتياطية كاملة من البيانات");
    toast("تم تنزيل النسخة الاحتياطية (JSON).", "success");
  }

  // استعادة العميل: تحذير شديد + طلب كلمة مرور الدخول (والقاعدة تتحقق منها)
  function clientRestoreFile(jsonStr) {
    let payload;
    try { payload = JSON.parse(jsonStr); } catch (e) { toast("الملف غير صالح أو تالف.", "warning"); return; }
    if (!payload || typeof payload !== "object") { toast("ملف النسخة غير صحيح.", "warning"); return; }
    const w = confirm("تحذير شديد ⚠️⚠️⚠️\n\nسيتم استبدال جميع بيانات شركتك الحالية ببيانات هذا الملف نهائيًا.\nلا يمكن التراجع عن هذه العملية.\n\nهل أنت متأكد تمامًا؟");
    if (!w) { toast("تم إلغاء الاستعادة.", "info"); return; }
    const pass = prompt("لتنفيذ الاستعادة: أدخل كلمة مرور الدخول إلى النظام:\n(بدونها لن تتم الاستعادة)");
    if (!pass) { toast("أُلغيت الاستعادة — لم تُدخل كلمة المرور.", "warning"); return; }
    if (!(A.online && DATA && DATA.clientRestore)) {
      toast("الاستعادة السحابية غير متاحة حاليًا.", "error");
      return;
    }
    toast("جارٍ استعادة بيانات شركتك...", "info");
    DATA.clientRestore(pass, payload).then(() => {
      toast("تمت استعادة بيانات شركتك بنجاح.", "success");
      addActivity("استعادة", "استعادة نسخة احتياطية لبيانات مؤسستي");
      setTimeout(() => window.location.reload(), 1600);
    }).catch((e) => {
      const msg = e && e.message ? e.message : String(e);
      if (msg.indexOf("كلمة المرور") !== -1) toast("كلمة المرور غير صحيحة — لم تتم الاستعادة.", "error");
      else toast("خطأ في الاستعادة: " + (msg.length > 120 ? msg.slice(0, 120) : msg), "error");
    });
  }

  // النسخة الاحتياطية الشاملة للمالك (كل العملاء) أو لشركة محددة — حسب اختياره في القائمة
  // 🆕 بناء 124: بتتبني من mizan_admin_backup_full (٣٦ جدول) بدل export_all/export_one
  // (١٩ جدول) ⇒ المرتجعات والحضور والأصول الثابتة وأرقام الفواتير بقت داخل الملف
  function backupAllData() {
    // 🔑 بناء 133: النسخ الشامل للمالك وحده (الحساب التاني في شركة ميزان يفتح «الضبط» بس مش النسخ)
    if (!requireSuperOwner("النسخ الاحتياطي الشامل")) return;
    if (!DATA) return;
    const sel = document.getElementById("setBackupScope");
    const orgId = sel ? sel.value : "";
    const orgName = sel && sel.selectedOptions.length
      ? sel.selectedOptions[0].textContent.trim()
      : "الكل (كل العملاء)";
    toast("جارٍ تجهيز النسخة الاحتياطية (" + orgName + ")...", "info");
    const run = (prom) => prom.then((pack) => {
      if (!pack) throw new Error("لا توجد بيانات");
      const cov = backupCoverage(pack, orgId ? ORG_SCOPE : FULL_RESTORE_TABLES);
      const covTxt = coverageNote(cov);
      const done = (where) => {
        addActivity("نسخ احتياطي شامل", "تصدير نسخة احتياطية (" + orgName + ") — " + covTxt);
        if (cov.missing.length) toast("النسخة اتحفظت " + where + "، بس " + covTxt, "warning");
        else toast("تم حفظ النسخة الاحتياطية " + where + " — " + covTxt, "success");
      };
      const jsonStr = JSON.stringify(pack, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const name = (orgId ? "mizan-company-backup-" : "mizan-full-backup-") + todayISO() + ".json";
      const saveFile = (resolve) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        resolve(true);
      };
      if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
        }).then((handle) => {
          return handle.createWritable().then((w) => w.write(blob).then(() => w.close()));
        }).then(() => {
          done("في المكان الذي اخترته");
        }).catch((e) => {
          if (e && e.name === "AbortError") return;
          saveFile(() => done("في مجلد التنزيلات"));
        });
      } else {
        saveFile(() => done("في مجلد التنزيلات"));
      }
    }).catch((e) => {
      const msg = e && e.message ? e.message : String(e);
      toast("ما كانش ممكن النسخ الاحتياطي: " + (msg.length > 140 ? msg.slice(0, 140) : msg), "error");
    });
    run(ownerBackupPack(orgId));
  }

  // ============ نسخة النشر الكاملة (كود + سكيما + داتا) — ترحيل ٢٣ ============
  // مجلد واحد يشتغل على أي سيرفر: site/ + database.sql + data.json + README
  var DEPLOY_SITE_FILES = ["index.html", "app.js", "data.js", "cloud.js", "install.js",
    "lib_supabase.js", "manifest.webmanifest", "sw.js", "styles.css", "supabase.config.js",
    "icons/icon-1024.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
  var DEPLOY_DB_FILES = ["db/supabase-schema.sql",
    "db/supabase-upgrade-1.sql", "db/supabase-upgrade-2.sql", "db/supabase-upgrade-3.sql",
    "db/supabase-upgrade-4.sql", "db/supabase-upgrade-5.sql", "db/supabase-upgrade-6.sql",
    "db/supabase-upgrade-7.sql", "db/supabase-upgrade-8.sql", "db/supabase-upgrade-9.sql",
    "db/supabase-upgrade-10.sql", "db/supabase-upgrade-11.sql", "db/supabase-upgrade-12.sql",
    "db/supabase-upgrade-13.sql", "db/supabase-upgrade-14.sql", "db/supabase-upgrade-15.sql",
    "db/supabase-upgrade-16.sql", "db/supabase-upgrade-17.sql",
    "db/supabase-upgrade-18-role-delete-protection.sql", "db/supabase-upgrade-19-offline-multidevice.sql",
    "db/supabase-upgrade-20-invoice-seq.sql", "db/supabase-upgrade-21-admin-lastseen.sql",
    "db/supabase-upgrade-22-admin-online.sql", "db/supabase-upgrade-23-full-backup.sql",
    // 🆕 بناء 124: القائمة كانت واقفة عند الترحيل ٢٣ ⇒ نسخة النشر كانت بتنزل على سيرفر جديد
    // بلا جداول المرتجعات والحضور والأصول الثابتة. أي ترحيل جديد لازم ينضم هنا
    // (حارس check_backup_coverage_124.js بيقرأ مجلد db/ ويلزم القائمة بيها).
    "db/supabase-upgrade-24-subs.sql", "db/supabase-upgrade-25-docs.sql",
    "db/supabase-upgrade-26-returns.sql", "db/supabase-upgrade-27-supplier-txs-cols.sql",
    "db/supabase-upgrade-28-tx-time-and-item-indexes.sql", "db/supabase-upgrade-29-item-line-identity.sql",
    "db/supabase-upgrade-30-invoice-party-links.sql", "db/supabase-upgrade-31-item-line-details.sql",
    "db/supabase-upgrade-32-backup-returns.sql", "db/supabase-upgrade-33-invoice-fields.sql",
    "db/supabase-upgrade-34-treasury-identity.sql", "db/supabase-upgrade-35-attendance.sql",
    "db/supabase-upgrade-36-backup-attendance.sql", "db/supabase-upgrade-37-fixed-assets.sql",
    "db/supabase-upgrade-38-backup-fixed-assets.sql", "db/supabase-upgrade-39-product-unit.sql",
    "db/supabase-upgrade-42-owner-always-open.sql",
    // ترقية ٤٣ (تحصين دوال النسخ) اتنفّذت على السحابة 02/10 ≈12:00 بأمر المالك «نفّذ» ⇒ بقت جزء من نسخة النشر
    "db/supabase-upgrade-43-backup-hardening.sql",
    // ترقية 44 (منع الزرع التجريبي في دالة إنشاء الشركة: صندوق رئيسي وحساب رأس مال برصيد صفر فقط)
    // اتنفّذت على السحابة 02/10 بأمر المالك «نفذ منع الزرع» ⇒ جزء من نسخة النشر (سيرفر جديد = نفس القاعدة)
    "db/supabase-upgrade-44-no-demo-seed.sql",
    // ترقية ٤٥ (جدول messages + سياسات الدردشة) اتنفّذت على السحابة 03/10 ≈00:44 بأمر المالك الحرفي
    // «يلا، نفذ ترقية الدردشة دلوقتي» ⇒ بقت جزء من نسخة النشر (سيرفر جديد = نفس القاعدة).
    // رسالة الدردشة نفسها لسه **بره** النسخة: `messages` مش في DEPLOY_DATA_TABLES ولا في دوال النسخ.
    "db/supabase-upgrade-45-chat.sql",
    // ترقية ٤٦ (توحيد «صاحب المؤسسة» في دالة mizan_is_owner + peers بـ last_seen/is_online +
    // org_info بنفس التوقيع) اتنفّذت على السحابة 03/10 ≈13:44 بأمر المالك «من 1 الى 4 بالترتيب»
    // (سطر ٢) — إثبات 59/0 قراءة-فقط ⇒ بقت جزء من نسخة النشر. إعادة تشغيلها كما هو **ممنوعة**.
    "db/supabase-upgrade-46-chat-owners.sql",
    // ترقية ٤٧ (دالة البث mizan_chat_broadcast: «📢 رسالة للكل» من المالك، سطر مستقل لكل مستلم،
    // وبلا أي سياسة جديدة على messages) اتنفّذت على السحابة 04/10 ≈07:25 بأمر المالك
    // «من 1 الى 4 بالترتيب» (سطر ٣) — إثبات: لِنتر 21/0 + dry-run 29/0 + تمرين رجوع 9/0
    // + سلوكي 56/0 قبل و51/0 بعد ⇒ المخطط 66 → 67 دالة ⇒ جزء من نسخة النشر.
    // إعادة تشغيلها كما هو **ممنوعة** (بواباتها بقت قياس «بعد»).
    "db/supabase-upgrade-47-chat-broadcast.sql",
    // ترقية ٤٨ (لحظي الدردشة: messages دخلت publication العامة بس، والجدول لسه عليه RLS
    // فالخادم بيفلتر أسطر كل مستلم على مزاعمه) اتنفّذت على السحابة 04/10 ≈09:48 بأمر المالك
    // «من 1 الى 4 بالترتيب» (سطر ٤) — إثبات: عضوية الكتالوج 0→1 + بصمة أجسام الـ67 دالة
    // سايتة + مخطط 5/5 md5 قبل = بعد + 36/38 ملف بيانات بالبايت ⇒ جزء من نسخة النشر.
    // إعادة تشغيلها كما هو **ممنوعة** (بترفض نفسها ببوابات «قبل»).
    "db/supabase-upgrade-48-chat-realtime.sql",
    // التصحيح ٤٩ (سحب تنفيذ الدوال من «الزائر/أي حد» + تنظيف منح anon من 30 جدول) اتنفّذ على
    // السحابة 03/10 ≈11:05 بأمر المالك «من 1 الى 4 بالترتيب» — النطاق (ج) full ⇒ بقت جزء من نسخة النشر.
    // إعادة تشغيله كما هو **ممنوعة** (بوابة «قبل» بقت فشلًا متعمّدًا بعد السحب)، والملف هنا للسجل.
    "db/supabase-upgrade-49-access-grants.sql",
    // ترقية ٥٠ (قفل التسجيل العام في القاعدة: دوال الرموز الثلاثة + `create_org_and_profile` ما
    // بتقبلش إنشاء شركة بلا رمز دعوة + `join_org` بشروطه الجديدة) اتنفّذت على السحابة
    // 5/10 ≈01:29 بأمر المالك الحرفي «تمام ابدا فعلها على قاعدة البيانات» — المخطط 67 → 70 دالة
    // و400/93/119/112/38/37 ثابتة · 338 سطر بيانات قبل = بعد · الإثبات السلوكي 82✓/0✗ ⇒
    // جزء من نسخة النشر (سيرفر جديد = نفس القاعدة). إعادة تشغيلها كما هو **ممنوعة**
    // (بوابات «قبل» بقت فشلًا متعمّدًا بعد التنفيذ)، والملف هنا للسجل.
    "db/supabase-upgrade-50-signup-lock.sql"];
  // ملفات موجودة في db/ بس مش داخلة في نسخة النشر — كل واحد بسبب مكتوب، والحارس يرفض أي إضافة هنا من غير سبب
  // فاضية دلوقتي بالقياس: كل ملف في db/ اتنفّذ على السحابة ⇒ ينشر معه. أي استبعاد جديد لازم يكون
  // سببه المكتوب **حقيقي** (مش «خايف أنشره») — حارس check_backup_coverage_124.js بيسأل db/ مباشرة.
  // بناء 141: ترقية ٥ـ (قفل التسجيل + دوال الرموز) **اتنفّذت** 5/10 ≈01:29 ⇒ دخلت FILES فوق
  // وبره الاستبعاد زي أخواتها (٤٣→٤٩)، والقاعدة نفسها: أي ملف جديد لسه ما اتنفّذتش يتحط هنا بسبب.
  var DEPLOY_DB_EXCLUDE = {};
  var DEPLOY_DATA_TABLES = ["organizations", "profiles",
    "accounts", "audit_logs", "categories", "customer_txs", "customers",
    "employees", "attendance", "att_settings", "fixed_assets",
    "journal_entries", "journal_lines", "mizan_created_accounts", "mizan_invoice_seq",
    "mizan_pw_store", "owners", "password_changes", "presence", "products",
    "purchase_items", "purchases", "sale_items", "sales", "supplier_txs", "suppliers",
    "treasury", "units", "vouchers", "warehouses"];

  // ============ 🆕 بناء 124: تغطية النسخة الاحتياطية — مصدر واحد للحقيقة ============
  // الجداول اللي `mizan_admin_restore_full` بيفرّغها على السيرفر (ترقيات ٣٢ و٣٦ و٣٨).
  // لو ملف النسخة ما فيهوش مفتاح جدول من دول ⇒ بيانات الجدول ده تتمسح وقت الاستعادة،
  // فبنقري الملف قبل الزرار وبنقول للمالك بالحرف هيتمسح إيه.
  var FULL_RESTORE_TABLES = ["organizations", "profiles",
    "accounts", "audit_logs", "categories", "customer_txs", "customers",
    "journal_entries", "journal_lines", "mizan_created_accounts", "mizan_invoice_seq",
    "mizan_pw_store", "owners", "password_changes", "presence", "products",
    "purchase_items", "purchases", "sale_items", "sales", "supplier_txs", "suppliers",
    "treasury", "units", "vouchers", "warehouses",
    "sale_returns", "sale_return_items", "purchase_returns", "purchase_return_items",
    "mizan_documents", "mizan_retired_codes",
    "employees", "attendance", "att_settings", "fixed_assets"];
  // الجداول اللي مالهاش عمود org_id (مقيس على القاعدة الحيّة 02/10) — ما بتتقسّمش على شركة
  var ORG_SCOPED_EXCLUDE = ["organizations", "mizan_pw_store"];
  // نطاق نسخة «شركة واحدة»: كل الجداول ماعدا الحسابات العامة وكلمات المرور
  var ORG_SCOPE = FULL_RESTORE_TABLES.filter((t) => ORG_SCOPED_EXCLUDE.indexOf(t) === -1);
  // الجداول اللي `mizan_admin_restore_one` بيرجّعها فعلًا company-by-company (ترقية ١٢)
  var RESTORE_ONE_COVERS = ["sale_items", "sales", "purchase_items", "purchases", "supplier_txs",
    "customer_txs", "vouchers", "journal_lines", "journal_entries", "audit_logs", "treasury",
    "accounts", "owners", "warehouses", "units", "categories", "customers", "suppliers", "products"];

  // استكمال قائمة الجداول من اللقطة نفسها: أي مفتاح مصفوفة جديد على السيرفر
  // يدخل database.sql أوتوماتيك — عشان القائمة اليدوية ما سيّبتش تعديلات برّا النسخة (بند ٦)
  function deployTablesFor(dump) {
    const base = DEPLOY_DATA_TABLES.slice();
    const seen = {}; base.forEach((k) => { seen[k] = 1; });
    if (dump && typeof dump === "object") {
      Object.keys(dump).sort().forEach((k) => {
        if (seen[k] || k.charAt(0) === "_" || !Array.isArray(dump[k])) return;
        base.push(k); seen[k] = 1;
      });
    }
    return base;
  }

  // مقياس التغطية: كام جدول من المطلوب موجودة فعلاً في النسخة (المطلوب = الشامل أو نطاق شركة)
  function backupCoverage(dump, required) {
    const list = required || FULL_RESTORE_TABLES;
    const missing = !dump ? list.slice() : list.filter((t) => !Array.isArray(dump[t]));
    let rows = 0;
    if (dump) Object.keys(dump).forEach((k) => { if (Array.isArray(dump[k])) rows += dump[k].length; });
    return { total: list.length, covered: list.length - missing.length, missing: missing, rows: rows };
  }
  function coverageNote(cov) {
    if (!cov.missing.length) return "كل الجداول مغطاة: " + cov.covered + "/" + cov.total + " جدول، " + cov.rows + " سطر.";
    return "النسخة فيها " + cov.covered + "/" + cov.total + " جدول — الناقص: " + cov.missing.join("، ") + ".";
  }

  // نسخة شركة واحدة مبنية من اللقطة الشاملة (كل الجداول، مش ١٩ بس) — بتقبها
  // mizan_admin_restore_one لأن شكل organizations مدعوم عنده
  function sliceDumpForOrg(dump, orgId) {
    if (!dump || !orgId) return null;
    const orgs = (dump.organizations || []).filter((o) => o && String(o.id) === String(orgId));
    if (!orgs.length) return null;
    const out = { exported_at: new Date().toISOString(), source: "mizan_admin_backup_full", org: orgs[0], organizations: orgs };
    FULL_RESTORE_TABLES.forEach((t) => {
      if (ORG_SCOPED_EXCLUDE.indexOf(t) !== -1) return;
      out[t] = Array.isArray(dump[t]) ? dump[t].filter((r) => r && String(r.org_id) === String(orgId)) : [];
    });
    return out;
  }

  // النسخة الاحتياطية للمالك (للكل أو لشركة) بتتبني دلوقتي من mizan_admin_backup_full
  // بدل mizan_admin_export_all / export_one القدام (١٩ جدول بس) — بند ٦ بالحرف
  function ownerBackupPack(orgId) {
    if (!(A.online && DATA && DATA.adminBackupFull)) return Promise.reject(new Error("النسخة الاحتياطية غير متاحة."));
    return DATA.adminBackupFull().then((dump) => {
      if (!dump || !Array.isArray(dump.organizations)) throw new Error("لم تصل بيانات كاملة من السيرفر.");
      if (!orgId) return dump;
      const pack = sliceDumpForOrg(dump, orgId);
      if (!pack) throw new Error("الشركة المطلوبة مش في بيانات السيرفر.");
      return pack;
    });
  }

  // إيه اللي جوّه ملف النسخة قبل ما نستعيد — بالأسطر والجدول الناقصة
  function restoreBriefing(payload) {
    const single = !!(payload && payload.org && payload.org.id);
    const cov = backupCoverage(payload, single ? ORG_SCOPE : FULL_RESTORE_TABLES);
    const orgs = Array.isArray(payload && payload.organizations) ? payload.organizations.length : 0;
    const users = Array.isArray(payload && payload._auth_users) ? payload._auth_users.length : 0;
    const orgName = payload && payload.org && payload.org.name ? payload.org.name : "";
    const head = orgName ? ("شركة «" + orgName + "»") : (orgs + " شركة، " + users + " حساب دخول");
    return { orgs: orgs, users: users, orgName: orgName, missing: cov.missing, rows: cov.rows,
      covered: cov.covered, total: cov.total,
      text: "المحتوى: " + head + " — " + coverageNote(cov) };
  }

  // مقارنة أعداد الأسطر: الملف ↔ السيرفر بعد الاستعادة (قراءة فقط)
  function orgIdOfPayload(payload) {
    if (!payload) return null;
    if (payload.org && payload.org.id) return String(payload.org.id);
    const orgs = Array.isArray(payload.organizations) ? payload.organizations : [];
    return orgs.length === 1 && orgs[0] && orgs[0].id ? String(orgs[0].id) : null;
  }
  function restoreCountDiff(payload, live, orgId) {
    const diffs = []; let checked = 0;
    const keys = Object.keys(payload || {}).filter((k) => Array.isArray(payload[k]) && k !== "organizations");
    keys.forEach((k) => {
      const want = payload[k].length;
      if (!live || !Array.isArray(live[k])) { diffs.push({ t: k, want: want, got: null, restorable: true }); return; }
      const got = orgId ? live[k].filter((r) => r && String(r.org_id) === String(orgId)).length : live[k].length;
      checked++;
      if (got === want) return;
      diffs.push({ t: k, want: want, got: got, restorable: !orgId || RESTORE_ONE_COVERS.indexOf(k) !== -1 });
    });
    const mismatch = diffs.filter((d) => d.got !== null);
    const unavailable = diffs.filter((d) => d.got === null);
    return { checked: checked, matched: checked - mismatch.length, diffs: mismatch,
      unavailable: unavailable.length, orgId: orgId || null };
  }
  function verifyRestore(payload) {
    if (!(A.online && DATA && DATA.adminBackupFull)) return Promise.resolve(null);
    const orgId = orgIdOfPayload(payload);
    return DATA.adminBackupFull()
      .then((live) => (live && Array.isArray(live.organizations) ? restoreCountDiff(payload, live, orgId) : null))
      .catch(() => null);
  }
  function restoreVerifyNote(v) {
    if (!v) return "الاستعادة تمت. ما قدرناش نتحقق تلقائيًا من السيرفر دلوقتي — اتأكد بعد لحظات.";
    if (!v.diffs.length && !v.unavailable) {
      return "الاستعادة تمت والتحقق: " + v.matched + "/" + v.checked + " جدول مطابق للأرقام على السيرفر.";
    }
    const notYet = v.diffs.filter((d) => !d.restorable);
    let msg = "الاستعادة تمت. التحقق لقى فرق في " + v.diffs.length + " جدول";
    if (notYet.length) msg += " (" + notYet.length + " منها السيرفر لسه ما بيرجّعهاش شركة-بشركة)";
    if (v.unavailable) msg += "، و" + v.unavailable + " جدول ما كانش مقروء وقت التحقق";
    return msg + ". التفاصيل في سجل النشاط.";
  }

  function deployStamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  }

  function fetchSiteBlob(path) {
    return fetch(new URL(path, location.href).href, { cache: "no-store" })
      .then((res) => (res.ok ? res.blob() : null)).catch(() => null);
  }

  function sqlLit(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  // insert statements لجدول من مصفوفة صفوف JSON — مع تخطي الأعمدة المُولَّدة
  function genInserts(schema, table, rows, dropKeys) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const cols = Object.keys(rows[0]).filter((k) => (dropKeys || []).indexOf(k) === -1);
    let out = "-- " + schema + "." + table + " (" + rows.length + " صف)\n";
    const head = "insert into " + schema + "." + table + " (" +
      cols.map((c) => '"' + c + '"').join(",") + ") values (";
    rows.forEach((r) => {
      out += head + cols.map((c) => sqlLit(r[c])).join(",") + ") on conflict do nothing;\n";
    });
    return out + "\n";
  }

  function buildDeploySql(dump, includeData) {
    let sql = "-- ============================================================\n" +
      "-- ميزان — ملف قاعدة البيانات (مولّد " + new Date().toLocaleString("ar-EG") + ")\n" +
      "-- " + (includeData ? "نسخة كاملة: بنية + بيانات كل الشركات + حسابات الدخول" : "نسخة فارغة: بنية فقط — بلا أي شركات أو بيانات") + "\n" +
      "-- الاستخدام: مشروع Supabase جديد ← SQL Editor ← الصق الكل ← Run\n" +
      "-- ============================================================\n\n";
    return sql;
  }

  async function ownerDeployBackup(includeData) {
    // 🔑 بناء 133: نشر نسخة على السيرفر = للمالك وحده
    if (!requireSuperOwner("نسخة النشر على السيرفر")) return;
    if (!(A.online && DATA && DATA.adminBackupFull)) { toast("النسخة الاحتياطية غير متاحة.", "error"); return; }
    toast("جارٍ تجهيز نسخة النشر " + (includeData ? "الكاملة (ببيانات الشركات)..." : "الفارغة (سورس فقط)..."), "info");
    let dump;
    try { dump = await DATA.adminBackupFull(); }
    catch (e) { toast("خطأ في سحب البيانات: " + (e.message || e), "error"); return; }
    if (!dump || !Array.isArray(dump.organizations)) { toast("لم تصل بيانات كاملة من السيرفر.", "error"); return; }
    const cov = backupCoverage(dump);
    // 1) ملفات البنية (SQL) من نفس الموقع المنشور — أي ملف ناقص يعني النسخة على سيرفر جديد
    //    هتبقى أنقص من البرنامج نفسه، فبنرفض ونقول السبب بالحرف بدل ما نسكت (بند ٦)
    const schemaParts = []; const schemaMissing = [];
    for (const p of DEPLOY_DB_FILES) {
      const b = await fetchSiteBlob(p);
      if (b) schemaParts.push("-- ==== " + p + " ====\n" + await b.text());
      else schemaMissing.push(p);
    }
    if (schemaMissing.length) {
      const names = schemaMissing.slice(0, 3).map((p) => p.split("/").pop()).join("، ") + (schemaMissing.length > 3 ? "…" : "");
      toast("نسخة النشر موقوفة: " + schemaMissing.length + " ملف بنية مش موجود على الموقع المنشور (" + names +
        "). انشر النسخة الحالية الأول وبعدين اعمل النسخة.", "error");
      addActivity("نسخة نشر", "مرفوض: " + schemaMissing.length + " ملف بنية ناقص على الموقع المنشور — " + names);
      return;
    }
    if (!schemaParts.length) { toast("تعذّر سحب ملفات البنية (db/*.sql) من الموقع — حدّث النسخة المنشورة أولًا.", "error"); return; }
    // 2) ملفات الموقع (site/) — نفس المنطق: مافيش ملف يسقط في صمت
    const siteFiles = []; const siteMissing = [];
    for (const p of DEPLOY_SITE_FILES) {
      const b = await fetchSiteBlob(p);
      if (b) siteFiles.push({ name: "site/" + p, blob: b }); else siteMissing.push(p);
    }
    if (siteMissing.length) {
      toast("نسخة النشر موقوفة: " + siteMissing.length + " ملف موقع مش موجود على الموقع المنشور (" +
        siteMissing.slice(0, 3).join("، ") + (siteMissing.length > 3 ? "…" : "") + "). انشر النسخة الحالية الأول.", "error");
      addActivity("نسخة نشر", "مرفوض: " + siteMissing.length + " ملف موقع ناقص على الموقع المنشور");
      return;
    }
    if (!siteFiles.length) { toast("تعذّر سحب ملفات الموقع.", "error"); return; }
    // 3) database.sql = البنية (+ البيانات لو نسخة كاملة) — الجداول بتتكمّل من اللقطة نفسها
    //    فأي جدول جديد على السيرفر يدخل النسخة أوتوماتيك من غير ماحد ينسى يضيفه
    const dataTables = deployTablesFor(dump);
    let dbSql = buildDeploySql(dump, includeData) + "\n" + schemaParts.join("\n\n") + "\n";
    if (includeData) {
      dbSql += "\n-- ===== بيانات حسابات الدخول (كلمات المرور مشفرة bcrypt) =====\n" +
        genInserts("auth", "users", dump._auth_users, ["confirmed_at"]) +
        genInserts("auth", "identities", dump._auth_identities, ["email"]) +
        "\n-- ===== بيانات الشركات والباقي (ترتيب آمن للمفاتيح الأجنبية) =====\n";
      dataTables.forEach((t) => { dbSql += genInserts("public", t, dump[t], []); });
    } else {
      dbSql += "\n-- نسخة فارغة: لا توجد بيانات شركات ولا حسابات دخول.\n" +
        "-- أول مستخدم يسجّل من البرنامج يبقى صاحب شركته؛ ولتعيين مالك عام للنظام:\n" +
        "-- update public.profiles set is_superadmin = true where id = 'معرف المستخدم من auth.users';\n";
    }
    const files = [
      { name: "database.sql", blob: new Blob([dbSql], { type: "application/sql" }) },
      { name: "README.txt", blob: new Blob([deployReadme(includeData, dump)], { type: "text/plain;charset=utf-8" }) },
      { name: "manifest.json", blob: new Blob([JSON.stringify({
        kind: includeData ? "full" : "empty", at: new Date().toISOString(),
        app: "mizan", build: window.MIZAN_BUILD,
        companies: (dump.organizations || []).length,
        auth_users: (dump._auth_users || []).length,
        schema_files: DEPLOY_DB_FILES.length,
        coverage: { tables: cov.total, covered: cov.covered, missing: cov.missing, rows: cov.rows },
        counts: dataTables.reduce((a, t) => { a[t] = (dump[t] || []).length; return a; }, {})
      }, null, 2)], { type: "application/json" }) }
    ];
    siteFiles.forEach((f) => files.push(f));
    // 4) data.json للنسخة الكاملة (لزرار الاستعادة ♻️ على أي سيرفر تاني)
    if (includeData) files.push({ name: "data.json", blob: new Blob([JSON.stringify(dump)], { type: "application/json" }) });
    const baseName = "mizan-deploy-backup-" + (includeData ? "full" : "empty") + "-" + deployStamp();
    saveDeployBundle(files, baseName).then((how) => {
      addActivity("نسخة نشر", "نسخة " + (includeData ? "كاملة" : "فارغة") + " — " + how +
        " — تغطية: " + coverageNote(cov));
      if (cov.missing.length) {
        toast("النسخة اتحفظت، بس السيرفر ما رجّعش " + cov.missing.length + " جدول: " +
          cov.missing.join("، ") + ". اتأكد من نسخة السحابة الأول.", "warning");
      } else {
        toast("اتحفظت في " + baseName + " (" + files.length + " ملف) — " + coverageNote(cov), "success");
      }
    });
  }

  function deployReadme(includeData, dump) {
    return "ميزان — نسخة نشر (" + (includeData ? "كاملة ببيانات الشركات" : "فارغة — سورس فقط") + ")\n" +
      "تاريخ التجهيز: " + new Date().toLocaleString("ar-EG") + "\n\n" +
      "محتويات المجلد:\n" +
      "  site/        ملفات البرنامج كاملة (ليتنزل على أي استضافة)\n" +
      "  database.sql ملف قاعدة البيانات (البنية" + (includeData ? " + بيانات كل الشركات وحسابات الدخول" : " فقط — بلا بيانات") + ")\n" +
      (includeData ? "  data.json    بيانات قاعدة البيانات الخام (لزرار الاستعادة ♻️ داخل البرنامج)\n" : "") +
      "  manifest.json+README.txt\n\n" +
      "خطوات التشغيل على سيرفر جديد:\n" +
      "  1) Supabase.com → مشروع جديد (أي دولة).\n" +
      "  2) SQL Editor → New query → الصق محتوى database.sql كله → Run.\n" +
      "  3) Project Settings → API: انسخ Project URL و anon public key.\n" +
      "  4) ظلّف مجلد site/ على أي استضافة (GitHub Pages/Netlify/سيرفر خاص).\n" +
      "  5) عدّل ملف supabase.config.js في الاستضافة: حط الـ URL والـ anon الجديدين.\n" +
      "  6) افتح الموقع وسجّل الدخول" + (includeData ? " بنفس اليوزرات وكلمات المرور القديمة — كل الشركات والبيانات موجودة." : " — أنشئ شركتك الأولى عادي.") + "\n\n" +
      (includeData ? "لإرجاع البيانات لسيرفر فيه نظام شغال بدل خطوة (2): افتح إعدادات المالك → تبويب النسخ الاحتياطي → زر «♻️ استعادة من ملف data.json».\n\n" : "") +
      "تنبيه أمان" + (includeData ? ": النسخة الكاملة فيها حسابات دخول وكلمات مرور مشفرة — خزّنها في مكان آمن." : ": هذه نسخة بنية فقط بلا أي بيانات عملاء.") + "\n";
  }

  function saveDeployBundle(files, baseName) {
    const dl = () => {
      let i = 0;
      return new Promise((resolve) => {
        (function next() {
          if (i >= files.length) { resolve("مجلد التنزيلات (ملفات منفصلة)"); return; }
          const f = files[i++];
          const a = document.createElement("a");
          a.href = URL.createObjectURL(f.blob);
          a.download = baseName + "__" + f.name.replace(/\//g, "__");
          a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); next(); }, 250);
        })();
      });
    };
    if (!window.showDirectoryPicker) return dl();
    return window.showDirectoryPicker().then(async (root) => {
      const dir = await root.getDirectoryHandle(baseName, { create: true });
      for (const f of files) {
        const parts = f.name.split("/");
        const fname = parts.pop();
        let d = dir;
        for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
        const fh = await d.getFileHandle(fname, { create: true });
        const w = await fh.createWritable();
        await w.write(f.blob);
        await w.close();
      }
      return "المجلد اللي اخترته";
    }).catch((e) => {
      if (e && e.name === "AbortError") return "— (اتلغى)";
      return dl();
    });
  }

  // نشر باك أب من الجهاز على السيرفر الحالي — ذكي وآمن:
  //  1) ملف بيور (بلا شركات وبلا حسابات) → ما يلمس السيرفر نهائيًا.
  //  2) ملف كامل + سيرفر فاضي (جديد) → يُنشر مباشرة بلا تحذيرات.
  //  3) ملف كامل + سيرفر فيه بيانات → تأكيد صريح قبل الاستبدال (كتلة واحدة: خطأ = لا يتغير شيء).
  // 🆕 بناء 124: قبل الاستعادة بنقرأ الملف ونقول هيتمسح إيه (mizan_admin_restore_full
  // بيفرّغ ٣٦ جدول حتى اللي ملهاش مفتاح في الملف)، وبعدها بنقارن الأعداد على السيرفر.
  function ownerRestoreFullFile(jsonStr) {
    // 🔑 بناء 133: الاستعادة الكاملة على السيرفر = للمالك وحده
    if (!requireSuperOwner("الاستعادة من نسخة السيرفر")) return;
    let payload;
    try { payload = JSON.parse(jsonStr); } catch (e) { toast("الملف غير صالح أو تالف.", "warning"); return; }
    if (!payload || !Array.isArray(payload.organizations)) { toast("الملف ده مش نسخة نشر كاملة (لا توجد organizations).", "warning"); return; }
    const orgsInFile = payload.organizations.length;
    const usersInFile = (payload._auth_users || []).length;
    if (!orgsInFile && !usersInFile) {
      toast("النسخة دي «سورس بيور» — مفيهاش بيانات شركات عشان تُنشر، والسيرفر الحالي ما اتلمسش. لتنزيلها على سيرفر جديد اتبع خطوات README اللي جوه المجلد.", "info");
      return;
    }
    const brief = restoreBriefing(payload);
    const doRestore = (freshServer) => {
      toast(freshServer ? "جارٍ نشر النسخة على السيرفر الجديد..." : "جارٍ الاستعادة الكاملة...", "info");
      DATA.adminRestoreFull(payload).then((msg) => {
        toast(msg || "تم النشر بنجاح.", "success");
        addActivity("نسخة نشر", "نشر باك أب من الجهاز: " + orgsInFile + " شركة، " + usersInFile +
          " حساب دخول — " + brief.text);
        return verifyRestore(payload).then((v) => {
          const note = restoreVerifyNote(v);
          addActivity("تحقق الاستعادة", note + (v && v.diffs.length
            ? " — " + v.diffs.map((d) => d.t + " (الملف " + d.want + " / السيرفر " + (d.got === null ? "غير مقروء" : d.got) + ")").join("، ")
            : ""));
          toast(note, v && v.diffs.length ? "warning" : "success");
          setTimeout(() => window.location.reload(), 2200);
        });
      }).catch((e) => toast("خطأ في الاستعادة (لم يُمسح شيء): " + (e.message || e), "error"));
    };
    const afterServerCheck = (curOrgs) => {
      if (curOrgs === 0) { doRestore(true); return; }
      const w = confirm("السيرفر الحالي فيه بيانات (" + curOrgs + " شركة عاملة).\n\n" +
        brief.text + "\n\n" +
        "نشرها معناه استبدال بيانات السيرفر ببيانات الملف (لو حصل أي خطأ في الوسط لا يُمسح شيء — العملية كتلة واحدة).\n\nهل تريد الاستبدال فعلًا؟");
      if (!w) { toast("تم الإلغاء — لم يتغير أي شيء على السيرفر.", "info"); return; }
      if (brief.missing.length) {
        const hard = confirm("⚠️ الملف ده نسخة قديمة أو ناقصة: ما فيهوش " + brief.missing.length +
          " جدول (" + brief.missing.join("، ") + ").\n\nالسيرفر بيفرّغ كل الجداول قبل ما يزرع اللي في الملف،" +
          " فبيانات الجداول دي هتتمسح وما ترجعش.\n\nهل أنت متأكد إنك عايز تكمّل برضه؟");
        if (!hard) { toast("تم الإلغاء — لم يتغير أي شيء على السيرفر.", "info"); return; }
      }
      doRestore(false);
    };
    if (A.online && DATA && DATA.adminOrgs) {
      DATA.adminOrgs().then((list) => afterServerCheck(Array.isArray(list) ? list.length : 1))
        .catch(() => afterServerCheck(1));
    } else afterServerCheck(1);
  }

  // الجداول اللي فيها بيانات في الملف والسيرفر ما بيرجّعهاش company-by-company دلوقتي
  function restoreOneLimitNote(payload) {
    if (!payload) return "";
    const beyond = FULL_RESTORE_TABLES.filter((t) =>
      RESTORE_ONE_COVERS.indexOf(t) === -1 && t !== "organizations" && t !== "profiles" &&
      Array.isArray(payload[t]) && payload[t].length > 0);
    if (!beyond.length) return "";
    return "\n\nتنبيه: استعادة شركة-بشركة على السيرفر الحالي بترجّع ١٩ جدول بس. اللي موجود في الملف ومش هيرجع بالطريقة دي: " +
      beyond.join("، ") + " — عشان ترجّع دول company-by-company لازم ترقية على السيرفر توسّع استعادة الشركة (أمر بيجهّزها)، " +
      "أو استخدم «♻️ استعادة نسخة نشر كاملة» فهي بتشمل كل الجداول.";
  }

  // استعادة نسخة للمالك: يختار الشركة أولًا (أو الكل) من القائمة، بتحذير فقط — بدون باسورد
  function ownerRestoreFile(jsonStr) {
    // 🔑 بناء 133: الاستعادة من ملف = للمالك وحده
    if (!requireSuperOwner("الاستعادة من ملف نسخة")) return;
    let payload;
    try { payload = JSON.parse(jsonStr); } catch (e) { toast("الملف غير صالح أو تالف.", "warning"); return; }
    if (!payload || typeof payload !== "object") { toast("ملف النسخة غير صحيح.", "warning"); return; }
    const brief = restoreBriefing(payload);
    const sel = document.getElementById("setRestoreScope");
    // لو الملف نسخة شركة واحدة (يحتوي org) نستعيد الشركة مباشرة بمعرّفها من الملف نفسه
    // — فيعمل حتى لو كانت الشركة محذوفة من السحابة (تُعاد إنشاؤها بكل بياناتها)
    const singleOrgId = (payload.org && payload.org.id) || null;
    const orgId = singleOrgId || (sel ? sel.value : "");
    const scopeName = singleOrgId
      ? (payload.org.name || "شركة محذوفة") + " (من الملف)"
      : (sel && sel.selectedOptions.length ? sel.selectedOptions[0].textContent.trim() : "الكل (كل العملاء)");
    if (singleOrgId) {
      const again = confirm("أعد استعادة شركة «" + scopeName + "»؟\n" + brief.text +
        "\nستُعاد بياناتها المخزنة من الملف إلى السحابة (نفس الشركة — تُنشأ مجددًا إن كانت محذوفة)." +
        "\nملاحظة: حسابات أعضاء الشركة لا تُستعاد من الملف — ستعيد إنشاء حساب دخولها من شاشة الإدارة بعد الاستعادة." +
        restoreOneLimitNote(payload) +
        "\n\nهل أنت متأكد؟");
      if (!again) { toast("تم إلغاء الاستعادة.", "info"); return; }
      if (!DATA) { toast("وضع السحابة غير متاح.", "error"); return; }
      toast("جارٍ استعادة الشركة من الملف...", "info");
      DATA.adminRestoreOne(singleOrgId, payload).then(() => {
        addActivity("نسخ احتياطي شامل", "استعادة شركة واحدة من الملف (" + scopeName + ") — " + brief.text);
        toast("تمت استعادة الشركة بنجاح.", "success");
        return verifyRestore(payload).then((v) => {
          const note = restoreVerifyNote(v);
          addActivity("تحقق الاستعادة", note);
          if (v && v.diffs.length) toast(note, "warning");
          setTimeout(() => window.location.reload(), 2200);
        });
      }).catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        toast("خطأ في الاستعادة: " + (msg.length > 140 ? msg.slice(0, 140) : msg), "error");
      });
      return;
    }
    const w = confirm("تحذير شديد ⚠️⚠️⚠️\n\nستُستبدل بيانات: «" + scopeName + "»\nببيانات هذا الملف نهائيًا. لا يمكن التراجع.\n\n" +
      brief.text + restoreOneLimitNote(payload) + "\n\nهل أنت متأكد تمامًا؟");
    if (!w) { toast("تم إلغاء الاستعادة.", "info"); return; }
    if (!DATA) { toast("وضع السحابة غير متاح.", "error"); return; }
    toast("جارٍ استعادة النسخة...", "info");
    const prom = orgId ? DATA.adminRestoreOne(orgId, payload) : DATA.adminRestoreAll(payload);
    prom.then(() => {
      toast("تمت الاستعادة بنجاح.", "success");
      addActivity("نسخ احتياطي شامل", "استعادة نسخة (" + scopeName + ") — " + brief.text);
      return verifyRestore(payload).then((v) => {
        const note = restoreVerifyNote(v);
        addActivity("تحقق الاستعادة", note);
        if (v && v.diffs.length) toast(note, "warning");
        setTimeout(() => window.location.reload(), 2200);
      });
    }).catch((e) => {
      const msg = e && e.message ? e.message : String(e);
      toast("خطأ في الاستعادة: " + (msg.length > 140 ? msg.slice(0, 140) : msg), "error");
    });
  }

  function restoreData(jsonStr) {
    try {
      const o = JSON.parse(jsonStr);
      const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
      set(LS_SETTINGS, o.settings || defaultSettings);
      set(LS_CUSTOMERS, o.customers || []);
      set(LS_TXS, o.txs || []);
      set(LS_PRODUCTS, o.products || []);
      set(LS_SALES, o.sales || []);
      set(LS_PURCHASES, o.purchases || []);
      // نسخ قديمة (قبل بناء 108) مفيهاش مفاتيح المرتجعات → ما ندهسش الموجودش
      if (Array.isArray(o.saleReturns)) set(LS_SALE_RETURNS, o.saleReturns);
      if (Array.isArray(o.purchaseReturns)) set(LS_PURCHASE_RETURNS, o.purchaseReturns);
      set(LS_TREASURY, o.treasury || seedTreasury);
      set(LS_SUPPLIERS, o.suppliers || []);
      set(LS_SUP_TXS, o.supplierTxs || []);
      set(LS_ACCOUNTS, o.accounts || seedAccounts);
      set(LS_JOURNAL, o.journalEntries || []);
      set(LS_USERS, o.users || (demoAllowedHere() ? seedUsers : []));
      set(LS_VOUCHERS, o.vouchers || []);
      set(LS_ACTIVITY, o.activity || []);
      loadData();
      toast("تمت استعادة النسخة الاحتياطية بنجاح.", "success");
      showView("dashboard");
    } catch (e) {
      toast("الملف غير صالح أو تالف.", "warning");
    }
  }

  function resetData() {
    // 🔑 بناء 133: مسح البيانات = للمالك وحده
    if (!requireSuperOwner("مسح البيانات")) return;
    // محذوفة/معطّلة في السحابة: الأداة قديمة من عصر التخزين المحلي التجريبي ولا يجوز تشغيلها
    // لأنها تمسح localStorage ثم قد تدفع بيانات تجريبية إلى السحابة وتستبدل بيانات الشركات الحقيقية.
    if (A.online) {
      toast("محذوف العمليات في وضع السحابة حفاظًا على بيانات الشركات.", "warning");
      return;
    }
    if (!confirm("سيتم مسح جميع البيانات المحفوظة في المتصفح والعودة للبيانات التجريبية. هل أنت متأكد؟")) return;
    LS_ALL_KEYS.forEach((k) => localStorage.removeItem(k));
    loadData();
    toast("تم مسح البيانات والعودة للوضع التجريبي.", "success");
    showView("dashboard");
  }

  /* ================== الساعة ================== */
  function tickClock() {
    const d = new Date();
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const p = (x) => String(x).padStart(2, "0");
    $("#clock").textContent =
      days[d.getDay()] + "، " + p(d.getDate()) + " " + months[d.getMonth()] + " " + d.getFullYear() +
      "  -  " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ================== الربط ================== */
  function initApp() {
    applyFeatureGating();
    // 🧱 بناء 132: عدّاد الواردة على زرار الدردشة المستقل في الشريط العلوي
    chatStartBadgeTicker();
    // 🟢 بناء 136: الاشتراك اللحظي يعيش برضه والشاشة مقفولة — عشان الرسالة **تعمل صوت**
    // وتعدّ في الزرار لحظة ما تجي، من غير ما المستخدم يفتح الدردشة. (زرار الدردشة نفسه
    // في مكانه وبشكله — قرار المالك 04/10: «زرار الدردشة فى المكان ده كويس متغيرهوش».)
    chatRtStart();
    updatePosTaxUI();
    tickClock();
    setInterval(tickClock, 1000);
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    ["dtpFromS", "dtpFromP", "dtpRepFrom"].forEach((id) => { if ($("#" + id)) $("#" + id).value = iso(d30); });
    ["dtpToS", "dtpToP", "dtpRepTo"].forEach((id) => { if ($("#" + id)) $("#" + id).value = todayISO(); });
    showView("dashboard");

    $("#btnRefresh").addEventListener("click", renderDashboard);

    $("#btnAddCustomer").addEventListener("click", () => openAddEdit(null));
    $("#btnPayCustDebt").addEventListener("click", () => openPayDebt(null));
    $("#txtCustomerSearch").addEventListener("input", renderTable);

    $("#btnSaveCustomer").addEventListener("click", saveCustomer);
    $("#btnCancelAdd").addEventListener("click", () => hideModal("mAddEdit"));

    $("#pMethod").addEventListener("change", () => {
      applyTreasuryFilter();
      updateWalletFields();
    });
    $("#pCust").addEventListener("change", updateWalletFields);
    $("#btnSavePay").addEventListener("click", savePay);
    $("#btnCancelPay").addEventListener("click", () => hideModal("mPayDebt"));

    $("#actEdit").addEventListener("click", () => {
      hideModal("mActions");
      openAddEdit(actionsCust);
    });
    $("#actStatement").addEventListener("click", () => {
      hideModal("mActions");
      openStatement(actionsCust);
    });
    $("#actPay").addEventListener("click", () => {
      hideModal("mActions");
      openPayDebt(actionsCust);
    });
    $("#actInvoice").addEventListener("click", () => {
      hideModal("mActions");
      openSalesForCustomer(actionsCust);
    });
    $("#actDelete").addEventListener("click", () => {
      const cust = actionsCust;
      if (cust.protected || cust.code === "1" || cust.code === "CASH" || cust.id === 1 || (cust.nameAr && cust.nameAr.includes("العميل النقدي"))) {
        toast("لا يمكن حذف العميل النقدي (كاش) - محمي بالنظام.", "warning");
        return;
      }
      // 🟢 قرار المالك (build 119): الحذف بـ «الرصيد» مش بـ «الحركة».
      // العميل اللي رصيده صفر يتحذف حتى لو عليه فواتير وتحصيلات — لأن الاتفاق
      // «صفر = يتحذف»، والرسالة القديمة («لوجود حركات على حسابه») كانت ترفض
      // عميل سدد آخر مليم وقفله. الحركات والفواتير المستندية بتفضل محفوظة.
      const bal = Math.round((parseFloat(cust.currentBalance) || 0) * 100) / 100;
      if (Math.abs(bal) > 0.005) {
        toast("رصيد العميل «" + cust.nameAr + "» دلوقتي " + fmt(bal) +
          " ج.م — خلّص المديونية أو عدّل الحركة الأولى، وبعدين تحذفه. (الحذف برصيد صفر)", "warning");
        return;
      }
      const txCount = txs.filter((t) => Number(t.customerId) === Number(cust.id)).length;
      const invCount = sales.filter((s) => String(s.customerName || "").trim() === String(cust.nameAr || "").trim()).length;
      const extra = (txCount || invCount)
        ? "\n\nحركاته: " + txCount + " حركة | فواتير باسمه: " + invCount +
          "\nكلهم هيفضلوا محفوظات في السجلات وفي كشف الخزينة — اللي هيتم حذفه اسم العميل بس."
        : "";
      if (confirm("هل تحذف العميل «" + cust.nameAr + "» (رصيد صفر)؟" + extra)) {
        customers = customers.filter((c) => c.id !== cust.id);
        saveCustomers();
        // تقاعد الرقم: لا يُعاد استخدامه لعميل آخر (عشان مستندات Clients\<num>) + الملفات لا تُمس
        retireLocal("customer", cust.code);
        hideModal("mActions");
        toast("تم حذف العميل بنجاح — رقمه " + cust.code + " تقاعد ولن يُستخدم مرة أخرى، ومستنداته محفوظة.", "success");
        renderTable();
      }
    });
    $("#actClose").addEventListener("click", () => hideModal("mActions"));

    // build 105: مستندات العميل (مسح ضوئي / حفظ من الجهاز / استدعاء)
    $("#actDocScan").addEventListener("click", () => docScan(actionsCust, "customer"));
    $("#actDocPick").addEventListener("click", () => docPick(actionsCust, "customer"));
    $("#actDocList").addEventListener("click", () => openDocsModal(actionsCust, "customer"));

    $("#btnPrintStmt").addEventListener("click", () => {
      if (statementCtx && statementCtx.type === "supplier") {
        printSupplierStatement(statementCtx.obj);
      } else {
        printStatement(actionsCust);
      }
    });
    $("#btnCloseStmt").addEventListener("click", () => hideModal("mStatement"));

    // 🆕 مهمة 96: فلترة كشف الحساب بالفترة (من/إلى) أو بالكامل
    $("#stmFrom").addEventListener("change", applyStmFilter);
    $("#stmTo").addEventListener("change", applyStmFilter);
    $("#btnStmAll").addEventListener("click", () => { resetStmFilter(); refreshStatementView(); });

    $("#btnAddProduct").addEventListener("click", () => openProductDialog(null));
    $("#btnStockTake").addEventListener("click", openStockTake);
    $("#btnTransferStock").addEventListener("click", openTransferModal);
    $("#btnRefreshProducts").addEventListener("click", renderProducts);
    $("#txtProductSearch").addEventListener("input", renderProducts);
    $("#cmbProductCategory").addEventListener("change", renderProducts);

    $("#btnSaveProduct").addEventListener("click", saveProduct);
    $("#btnCancelProduct").addEventListener("click", () => hideModal("mProduct"));

    // 🔳 بناء 139: باركود الأصناف — توليد جماعي + توليد/معاينة جوه النافذة + طباعة الملصق
    $("#btnGenBarcodes").addEventListener("click", doGenerateBarcodes);
    $("#btnGenOneBarcode").addEventListener("click", generateBarcodeInDialog);
    $("#fPBarcode").addEventListener("input", () => { renderBarcodePreview(); scanHint("#bcScanHint"); });
    // 📷 بناء 143: الإسكانر بيكتب رقم باركود المصنع ودوس Enter ⇒ الرقم يدخل المعاينة والرسالة
    // توصّي بالخطوة الجاية، و**ممنوع** Enter يقفل النافذة أو يسبق كتابة الاسم والسعر.
    $("#fPBarcode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); barcodeFieldScan(); }
    });
    // 📷 نفس الخانة بتستقبل إسكانر «بيلصق» الرقم — وبنفس مسار Enter (مافيش طريق تاني)
    $("#fPBarcode").addEventListener("paste", () => scanPasteRun("fPBarcode", barcodeFieldScan));
    $("#btnFBarcodeScan").addEventListener("click", barcodeFieldArm);
    $("#btnPrintBarcode").addEventListener("click", printBarcodeLabels);
    $("#btnCancelBarcodePrint").addEventListener("click", () => hideModal("mBarcodePrint"));

    $("#trFrom").addEventListener("change", () => { fillTransferTarget(); fillTransferProducts(); });
    $("#trProduct").addEventListener("change", () => {
      const p = products.find((x) => x.id === parseInt($("#trProduct").value, 10));
      const hint = $("#trAvailHint");
      if (hint && p) hint.textContent = "المتوفر في " + $("#trFrom").value + ": " + Number(stockAt(p, $("#trFrom").value)).toLocaleString("en-US") + " " + p.unit;
    });
    $("#btnDoTransfer").addEventListener("click", doStockTransfer);
    $("#btnCancelTransfer").addEventListener("click", () => hideModal("mTransfer"));

    $("#stkWarehouse").addEventListener("change", renderStockTake);
    $("#btnStkReload").addEventListener("click", renderStockTake);
    $("#btnApplyStockTake").addEventListener("click", saveStockTake);
    $("#btnCloseStockTake").addEventListener("click", () => hideModal("mStockTake"));
    $("#btnExportStockTake").addEventListener("click", exportStockTakeCSV);
    $("#btnPrintStockTake").addEventListener("click", printStockTake);
    $("#dgvStockTake tbody").addEventListener("input", (e) => {
      if (e.target.classList.contains("stk-qty-input")) computeStockDiff(e.target);
    });

    $("#btnQuickAddProduct").addEventListener("click", openQuickProduct);
    $("#btnQuickAddCust").addEventListener("click", openQuickCustomer);
    $("#btnSaveQuickProduct").addEventListener("click", saveQuickProduct);
    $("#btnCancelQuickProduct").addEventListener("click", () => hideModal("mQuickProduct"));
    $("#btnSaveQuickCustomer").addEventListener("click", saveQuickCustomer);
    $("#btnCancelQuickCustomer").addEventListener("click", () => hideModal("mQuickCustomer"));

    $("#cmbPaymentMethod").addEventListener("change", posPaymentVisibility);
    // 📷 بناء 143: كل حرف بيمرّ على scanKey ⇒ السلسلة الزمنية بتتقاس **أثناء** الكتابة،
    // وبعدها Enter بيقرا النتيجة بس (من غير دي، الإسكانر كان بيتعامل معاملة الصابع).
    // + الإكمال اليدوي (طلب 05/10 ≈18:20: «كل ما اكتب رقم من الباركود يبحث في المخزون
    // علشان يكمل لى الرقم»): `scanSuggestShow` بترجع false أثناء المسح ⇒ الاقتراح ما
    // يعطّش رسالة الإسكانر ولا يقطع المسح المتتابع.
    $("#txtPosCode").addEventListener("input", (e) => {
      scanKey("txtPosCode", e);
      posOnCode();
      scanSuggestShow("#posScanHint", "txtPosCode", $("#txtPosCode").value);
    });
    // 📷 بناء 143: Enter من الإسكانر = «اختار الصنف»، ومن الصابع = «ضيف السطر» (المسار القديم)
    $("#txtPosCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posCodeEnter(); }
    });
    // 📷 إسكانر بيلصق الرقم دفعة واحدة (فئة من الماكينات + تطبيقات المسح على الموبايل)
    $("#txtPosCode").addEventListener("paste", () => scanPasteRun("txtPosCode", posCodeEnter));
    $("#txtPosSearch").addEventListener("input", (e) => { scanKey("txtPosSearch", e); posOnSearch(); });
    $("#txtPosSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posSearchEnter(); }
    });
    $("#txtPosSearch").addEventListener("paste", () => scanPasteRun("txtPosSearch", posSearchEnter));
    // 🧮 الكمية اللي «لازم تتكتب» (05/10 ≈18:05): `input` بيجي من الصابع بس — الكتابة
    // بالـ JS (posAddItem / posNewInvoice) ما بيشعلوش ⇒ النشيط يعني المالك لمس الخانة فعلًا.
    $("#numPosQty").addEventListener("input", () => { posQtyTyped = true; });
    $("#numPosQty").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddVia("search"); }
    });
    $("#txtPosPrice").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddVia("search"); }
    });
    $("#btnPosAdd").addEventListener("click", () => { posAddItem(); posQtyTyped = false; scanHint("#posScanHint"); });
    $("#btnPosNew").addEventListener("click", posNewInvoiceClean);
    // 📷 زر المسح في رأس الفاتورة (05/10 ≈18:05) = يجهّز الخانة + يفتح الكاميرا (بناء 144)
    $("#btnPosScanArm").addEventListener("click", posScanArm);
    // 📷 بناء 144: أزرار لوحة الكاميرا (الموبايل) — تقفلها من الزرار أو Escape
    $("#camClose").addEventListener("click", () => scanCamClose());
    $("#camRetry").addEventListener("click", scanCamRetry);
    $("#camTorch").addEventListener("click", scanCamTorch);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && scanCam.on) scanCamClose();
    });
    // 📷 بناء 144 (طلب 06/10 حرفيًا: «تنزل قائمه من الخانة»): القائمة بقت **لوحة تحت الخانة**
    // (`#scanDrop-txtPosCode`) مش رسالة في الشريط ⇒ الدوس بيتقاس عليها. `mousedown` بيمنع
    // الافتراضي عشان التركيز ما يسقطش من الخانة قبل `click`، و`blur` بيقفل اللوحة.
    $("#scanDrop-txtPosCode").addEventListener("mousedown", (e) => e.preventDefault());
    $("#scanDrop-txtPosCode").addEventListener("click", (e) => {
      const pk = e.target.closest("[data-scan-pick]");
      if (pk) scanSuggestPick("#posScanHint", "txtPosCode", pk.getAttribute("data-scan-pick"), posOnCode);
    });
    $("#txtPosCode").addEventListener("blur", () => scanDropHide("txtPosCode"));
    // 📷 لو الرقم الممسوح ملوش صنف ⇒ زرار في الرسالة يفتح نافذة الصنف والخانة مملانة بالرقم
    $("#posScanHint").addEventListener("click", (e) => {
      if (e.target.closest("[data-scan-new]")) { openProductDialogForScan(lastPosScan); return; }
    });

    /* ══ 🧮 بناء 145 — الجرد بالباركود ══
       الخانات دي بتستخدم **نفس** بدائل المسح اللي في الفاتورة (`scanKey` / `scanIsBurst` /
       `scanPasteRun` / `scanSuggestShow` / `scanSuggestPick` / `scanDropHide` / `scanCamToggle`)،
       فأي تظبيط في تمييز الإسكانر أو قائمة الأرقام بيصل للجرد من غير ما حد يلمس سطر هنا. */
    $("#btnScNew").addEventListener("click", scStartNew);
    $("#btnScSave").addEventListener("click", scSaveSheet);
    $("#btnScExport").addEventListener("click", scExportCSV);
    $("#btnScPrint").addEventListener("click", scPrintSheet);
    $("#btnScApply").addEventListener("click", scApply);
    $("#btnScScanArm").addEventListener("click", scScanArm);
    $("#btnScManualAdd").addEventListener("click", scManualAdd);
    $("#scWarehouse").addEventListener("change", () => { renderStockCount(); scShowStock(); });
    // كل حرف من الماسح بيمرّ على `scanKey` ⇒ السلسلة الزمنية بتتقاس أثناء الكتابة (درس 143)
    $("#txtScCode").addEventListener("input", (e) => {
      scanKey("txtScCode", e);
      scanSuggestShow("#scScanHint", "txtScCode", $("#txtScCode").value);
    });
    $("#txtScCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); scCodeEnter(); }
    });
    $("#txtScCode").addEventListener("paste", () => scanPasteRun("txtScCode", scCodeEnter));
    $("#txtScCode").addEventListener("blur", () => scanDropHide("txtScCode"));
    // قائمة الأرقام «اللي بتنتهي» بالمدخول (نفس لوحة 144) — الدوس يكمّل الخانة وما يعدّش
    $("#scanDrop-txtScCode").addEventListener("mousedown", (e) => e.preventDefault());
    $("#scanDrop-txtScCode").addEventListener("click", (e) => {
      const pk = e.target.closest("[data-scan-pick]");
      if (pk) scanSuggestPick("#scScanHint", "txtScCode", pk.getAttribute("data-scan-pick"), scShowStock);
    });
    $("#txtScSearch").addEventListener("input", (e) => { scanKey("txtScSearch", e); scShowStock(); });
    $("#txtScSearch").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const raw = $("#txtScSearch").value;
      if (scanBurstOf("txtScSearch", raw)) { scHandleScan(scanTailNorm("txtScSearch")); return; }
      scManualAdd();
    });
    $("#txtScSearch").addEventListener("paste", () => scanPasteRun("txtScSearch", () => {
      const raw = $("#txtScSearch").value;
      if (scanBurstOf("txtScSearch", raw)) { scHandleScan(scanTailNorm("txtScSearch")); return; }
      scManualAdd();
    }));
    /* Enter في «عدد كل مسحة»: لو خانة الكود لسه فيها رقم (بيفضل بعد أي رفض بالعمد) ⇒
       نفس Enter يعدّه على طول. ولو فاضية ⇒ يروح لخانة الكود يستنى المسحة الجاية.
       الهدف: البائع اللي كتب «١٠» غلط مسارها ما يحتاجش Enter مرتين. */
    $("#numScQty").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const pending = String($("#txtScCode").value || "").trim();
      if (pending) { scCodeEnter(); return; }
      $("#txtScCode").focus();
    });
    // حساب فروق الجرد بيتختار من الورقة وبيفضل معها (ولو ما اتختارش ⇒ الافتراضي الموثّق)
    $("#scDiffAcc").addEventListener("change", () => {
      const sh = scCur();
      sh.diffAcc = String($("#scDiffAcc").value || "");
      scPersist();
    });
    $("#btnScLoadSheet").addEventListener("click", scLoadSheet);
    $("#btnScDeleteSheet").addEventListener("click", scDeleteSheet);
    // «العدد المعدود» خانة يدوية: `input` يحدّث السطر والملخص بلا إعادة رسم، و`change`
    // (لما يسيب الخانة) ينضّف التنسيق. ممنوع نعيد رسم الجدول أثناء الكتابة — التركيز بيطير.
    $("#dgvStockCount").addEventListener("input", (e) => {
      const inp = e.target.closest(".sc-count-input");
      if (inp) scLiveFromInput(inp);
    });
    $("#dgvStockCount").addEventListener("change", (e) => {
      const inp = e.target.closest(".sc-count-input");
      if (inp) scSetCountFromInput(inp.dataset.id, inp.value);
    });
    $("#dgvStockCount").addEventListener("click", (e) => {
      const del = e.target.closest("[data-sc-del]");
      if (del) scRemove(Number(del.getAttribute("data-sc-del")));
    });
    // نافذة «أصناف ما انمسحتش»: التصفير سطر-سطر، و«إلغاء الاعتماد» بيرجّع الورقة كاملة
    $("#btnScZeroMarkAll").addEventListener("click", scZeroMarkAll);
    $("#btnScZeroCancel").addEventListener("click", scZeroCancel);
    $("#btnScZeroApply").addEventListener("click", scZeroApply);
    $("#btnPosSave").addEventListener("click", savePosInvoice);
    $("#txtPosDiscount").addEventListener("input", posRecalc);
    $("#cmbPosWarehouse").addEventListener("change", () => {
      const firstProd = products.find((p) => p.id === (posItems[0] && posItems[0].productId));
      posUpdateBadge(firstProd || null);
    });

    $("#dgvItems tbody").addEventListener("input", (e) => {
      const inp = e.target.closest(".cell-input");
      if (!inp) return;
      const tr = inp.closest("tr");
      const idx = parseInt(tr.dataset.idx, 10);
      const f = inp.dataset.f;
      const v = parseFloat(String(inp.value).replace(/,/g, ""));
      posItems[idx][f] = isNaN(v) ? 0 : v;
      posCalcRow(idx);
      tr.querySelector(".c-tax").textContent = fmt(posItems[idx].tax);
      tr.querySelector(".c-total").textContent = fmt(posItems[idx].total);
      posRecalc();
    });

    $("#dgvItems tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-f="del"]');
      if (!btn) return;
      const idx = parseInt(btn.closest("tr").dataset.idx, 10);
      posItems.splice(idx, 1);
      renderPosItems();
      posRecalc();
    });

    $("#btnPQuickAddProduct").addEventListener("click", openQuickProduct);
    $("#btnPQuickAddSupp").addEventListener("click", openQuickSupplier);
    $("#btnSaveQuickSupplier").addEventListener("click", saveQuickSupplier);
    $("#btnCancelQuickSupplier").addEventListener("click", () => hideModal("mQuickSupplier"));

    $("#cmbPPaymentMethod").addEventListener("change", ppPaymentVisibility);
    $("#cmbPPWarehouse").addEventListener("change", () => {
      const firstProd = products.find((p) => p.id === (ppItems[0] && ppItems[0].productId));
      ppUpdateBadge(firstProd || null);
    });
    $("#txtPPCode").addEventListener("input", (e) => {
      scanKey("txtPPCode", e);
      ppOnCode();
      scanSuggestShow("#ppScanHint", "txtPPCode", $("#txtPPCode").value);
    });
    // 📷 بناء 143: نفس منطق البيع — Enter من الإسكانر يختار الصنف، ومن الصابع يضيف السطر
    $("#txtPPCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppCodeEnter(); }
    });
    $("#txtPPCode").addEventListener("paste", () => scanPasteRun("txtPPCode", ppCodeEnter));
    $("#txtPPSearch").addEventListener("input", (e) => { scanKey("txtPPSearch", e); ppOnSearch(); });
    $("#txtPPSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppSearchEnter(); }
    });
    $("#txtPPSearch").addEventListener("paste", () => scanPasteRun("txtPPSearch", ppSearchEnter));
    // 🧮 نفس قاعدة البيع: الكمية تتكتب من الصابع، والمسح ما يخترعش 1
    $("#numPPQty").addEventListener("input", () => { ppQtyTyped = true; });
    $("#numPPQty").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddVia("search"); }
    });
    $("#txtPPPrice").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddVia("search"); }
    });
    $("#btnPPAdd").addEventListener("click", () => { ppAddItem(); ppQtyTyped = false; scanHint("#ppScanHint"); });
    $("#btnPPNew").addEventListener("click", ppNewInvoiceClean);
    $("#btnPPScanArm").addEventListener("click", ppScanArm);
    /* 📷 المسح «بلا زرار»: مستند-عام في مرحلة الالتقاط، فبيشتغل حتى لو Focus على الزرار أو
       الجدول أو جسم الشاشة (تفسير المالك لنفس طلب زرار المسح). مستمع الخانات الخاصة لسه
       هو اللي بيتصرّف لو البائع واقف على خانة بيكتب فيها (`coldFocusMode` بترجع null). */
    document.addEventListener("keydown", coldScanKey, true);
    // 📷 بناء 144: نفس مسار البيع بالحرف في فاتورة الشراء (لوحة تحت خانة الكود)
    $("#scanDrop-txtPPCode").addEventListener("mousedown", (e) => e.preventDefault());
    $("#scanDrop-txtPPCode").addEventListener("click", (e) => {
      const pk = e.target.closest("[data-scan-pick]");
      if (pk) scanSuggestPick("#ppScanHint", "txtPPCode", pk.getAttribute("data-scan-pick"), ppOnCode);
    });
    $("#txtPPCode").addEventListener("blur", () => scanDropHide("txtPPCode"));
    $("#ppScanHint").addEventListener("click", (e) => {
      if (e.target.closest("[data-scan-new]")) { openProductDialogForScan(lastPpScan); return; }
    });
    $("#btnPPSave").addEventListener("click", savePurchaseInvoice);
    $("#txtPPDiscount").addEventListener("input", ppRecalc);

    $("#dgvPItems tbody").addEventListener("input", (e) => {
      const inp = e.target.closest(".cell-input");
      if (!inp) return;
      const tr = inp.closest("tr");
      const idx = parseInt(tr.dataset.idx, 10);
      const f = inp.dataset.f;
      const v = parseFloat(String(inp.value).replace(/,/g, ""));
      ppItems[idx][f] = isNaN(v) ? 0 : v;
      ppCalcRow(idx);
      tr.querySelector(".c-tax").textContent = fmt(ppItems[idx].tax);
      tr.querySelector(".c-total").textContent = fmt(ppItems[idx].total);
      ppRecalc();
    });

    $("#dgvPItems tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-f="del"]');
      if (!btn) return;
      const idx = parseInt(btn.closest("tr").dataset.idx, 10);
      ppItems.splice(idx, 1);
      renderPPItems();
      ppRecalc();
    });

    /* ---- الموردون ---- */
    $("#btnAddSupplier").addEventListener("click", () => openSuppAddEdit(null));
    $("#btnPaySuppDebt").addEventListener("click", () => openPaySuppDebt(null));
    $("#txtSupplierSearch").addEventListener("input", renderSuppliers);
    $("#btnSaveSupplier").addEventListener("click", saveSupplier);
    $("#btnCancelSuppAdd").addEventListener("click", () => hideModal("mSuppAddEdit"));
    $("#sactEdit").addEventListener("click", () => {
      hideModal("mSuppActions");
      openSuppAddEdit(actionsSupp);
    });
    $("#sactStatement").addEventListener("click", () => {
      hideModal("mSuppActions");
      openSupplierStatement(actionsSupp);
    });
    $("#sactPay").addEventListener("click", () => {
      hideModal("mSuppActions");
      openPaySuppDebt(actionsSupp);
    });
    $("#sactDelete").addEventListener("click", () => {
      const s = actionsSupp;
      if (s.protected || s.code === "1" || s.code === "SUPP-001" || s.id === 1 || (s.nameAr && s.nameAr.includes("المورد النقدي"))) {
        toast("لا يمكن حذف المورد النقدي (كاش) - محمي بالنظام.", "warning");
        return;
      }
      // 🟢 قرار المالك (build 119): المورد كمان الحذف بـ «الرصيد» مش بـ «الحركة» —
      // سددت المديونية وصار الرصيد صفر ⇒ يتحذف. الرفض القديم كان «لأي حركة»
      // فكل مورد سابق محليًا حتى لو حسابه تسدّد بالكامل.
      const sBal = Math.round((parseFloat(s.currentBalance) || 0) * 100) / 100;
      if (Math.abs(sBal) > 0.005) {
        toast("رصيد المورد «" + s.nameAr + "» دلوقتي " + fmt(sBal) +
          " ج.م — سدّد المتبقي أو عدّل الحركة، وبعدين تحذفه. (الحذف برصيد صفر)", "warning");
        return;
      }
      const sTx = supplierTxs.filter((t) => Number(t.supplierId) === Number(s.id)).length;
      const sPur = purchases.filter((p) => String(p.supplierName || "").trim() === String(s.nameAr || "").trim()).length;
      const sExtra = (sTx || sPur)
        ? "\n\nحركاته: " + sTx + " حركة | فواتير شراء باسمه: " + sPur +
          "\nكلهم هيفضلوا محفوظات في السجلات وفي كشف الخزينة — اللي هيتم حذفه اسم المورد بس."
        : "";
      if (confirm("هل تحذف المورد «" + s.nameAr + "» (رصيد صفر)؟" + sExtra)) {
        suppliers = suppliers.filter((x) => x.id !== s.id);
        saveSuppliers();
        retireLocal("supplier", s.code);
        hideModal("mSuppActions");
        toast("تم حذف المورد بنجاح — رقمه " + s.code + " تقاعد ولن يُستخدم مرة أخرى، ومستنداته محفوظة.", "success");
        renderSuppliers();
      }
    });
    $("#sactClose").addEventListener("click", () => hideModal("mSuppActions"));
    // build 105: مستندات المورد
    $("#sactDocScan").addEventListener("click", () => docScan(actionsSupp, "supplier"));
    $("#sactDocPick").addEventListener("click", () => docPick(actionsSupp, "supplier"));
    $("#sactDocList").addEventListener("click", () => openDocsModal(actionsSupp, "supplier"));
    $("#psMethod").addEventListener("change", applyTreasuryFilterSupp);
    $("#btnSaveSupPay").addEventListener("click", savePaySupplement);
    $("#btnCancelSupPay").addEventListener("click", () => hideModal("mPaySuppDebt"));

    /* ---- الاستعلام عن الفواتير ---- */
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const t = btn.dataset.tab;
        $("#tabS").hidden = t !== "s";
        $("#tabP").hidden = t !== "p";
      });
    });
    ["dtpFromS", "dtpToS", "txtSearchInvS"].forEach((id) => $("#" + id).addEventListener("input", renderInvoiceQuery));
    ["dtpFromP", "dtpToP", "txtSearchInvP"].forEach((id) => $("#" + id).addEventListener("input", renderInvoiceQuery));
    $("#btnRefreshInvoices").addEventListener("click", renderInvoiceQuery);
    $("#dgvInvS tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-act="print"],[data-act="del"],[data-act="ret"]');
      if (!btn) return;
      const tr = btn.closest("tr");
      const inv = sales.find((x) => x.id === parseInt(tr.dataset.iid, 10));
      if (!inv) return;
      if (btn.dataset.act === "ret") { openRetFor(true, inv); return; }
      if (btn.dataset.act === "del") { deleteInvoiceQuery(inv, true); return; }
      printInvoice(inv);
    });
    $("#dgvInvP tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-act="print"],[data-act="del"],[data-act="ret"]');
      if (!btn) return;
      const tr = btn.closest("tr");
      const inv = purchases.find((x) => x.id === parseInt(tr.dataset.iid, 10));
      if (!inv) return;
      if (btn.dataset.act === "ret") { openRetFor(false, inv); return; }
      if (btn.dataset.act === "del") { deleteInvoiceQuery(inv, false); return; }
      printPurchaseInvoice(inv);
    });

    /* ---- 🔁 المرتجعات (بناء 108) ---- */
    document.querySelectorAll(".ret-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".ret-tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        retActiveTab = btn.dataset.rett === "p" ? "p" : "s";
        $("#retTabS").hidden = retActiveTab !== "s";
        $("#retTabP").hidden = retActiveTab !== "p";
        renderReturns();
      });
    });
    ["dtpFromRS", "dtpToRS", "txtSearchRetS", "dtpFromRP", "dtpToRP", "txtSearchRetP"].forEach((id) => {
      const el = $("#" + id);
      if (el) el.addEventListener("input", renderReturns);
    });
    $("#btnRetRefresh").addEventListener("click", () => {
      renderReturns();
      toast("تم تحديث جدول المرتجعات.", "success");
    });
    $("#btnRetPickSale").addEventListener("click", () => openRetPick(true));
    $("#btnRetPickPur").addEventListener("click", () => openRetPick(false));
    $("#btnRetPickCancel").addEventListener("click", () => hideModal("mRetPick"));
    $("#retPickSearch").addEventListener("input", renderRetPick);
    $("#dgvRetPick tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-act="pick"]');
      if (!btn) return;
      const iid = parseInt(btn.closest("tr").dataset.iid, 10);
      const inv = retDocs(retPickIsSales).find((x) => Number(x.id) === iid);
      if (inv) openRetFor(retPickIsSales, inv);
    });
    $("#retSettle").addEventListener("change", applyRetSettleUI);
    $("#retMethod").addEventListener("change", fillRetTreasury);
    $("#retTreasury").addEventListener("change", syncRetMethodFromTreasury); // 🆕 اختيار الحساب يضبط الطريقة
    $("#dgvRetItems").addEventListener("input", (e) => {
      if (e.target && e.target.classList.contains("ret-qty-inp")) recalcRetTotal();
    });
    $("#btnRetSave").addEventListener("click", saveReturn);
    $("#btnRetCancel").addEventListener("click", () => { retDraft = null; hideModal("mRetAdd"); });
    [["#dgvRetS", true], ["#dgvRetP", false]].forEach((pair) => {
      const tb = $(pair[0] + " tbody");
      if (!tb) return;
      tb.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-act="inv"],[data-act="del"]');
        if (!btn) return;
        const rid = parseInt(btn.closest("tr").dataset.rid, 10);
        const isSales = pair[1];
        const r = retList(isSales).find((x) => Number(x.id) === rid);
        if (!r) return;
        if (btn.dataset.act === "del") { deleteReturn(r, isSales); return; }
        const inv = retInvoiceOf(r, isSales);
        if (!inv) { toast("الفاتورة الأصلية اتحذفت — المرتجع لسه محفوظ في الجدول.", "warning"); return; }
        if (isSales) printInvoice(inv); else printPurchaseInvoice(inv);
      });
    });

    /* ---- الخزينة ---- */
    $("#btnAddTreasury").addEventListener("click", () => openTreasuryDialog(null));
    $("#btnVoucherIn").addEventListener("click", () => openVoucher("in"));
    $("#btnVoucherOut").addEventListener("click", () => openVoucher("out"));
    $("#txtTreSearch").addEventListener("input", renderTreasury);
    $("#btnSaveTreasury").addEventListener("click", saveTreasuryModal);
    $("#btnCancelTreasury").addEventListener("click", () => hideModal("mTreasury"));
    $("#btnSaveVoucher").addEventListener("click", saveVoucher);
    $("#btnCancelVoucher").addEventListener("click", () => hideModal("mVoucher"));
    $("#dgvTreasury tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-act="edit"]');
      if (!btn) return;
      const t = treasury.find((x) => x.id === parseInt(btn.closest("tr").dataset.tid, 10));
      if (t) openTreasuryDialog(t);
    });
    $("#tType").addEventListener("change", () => {
      const type = $("#tType").value;
      $("#tAccountNo").placeholder = type === "bank" ? "رقم الحساب البنكي..." : type === "wallet" ? "رقم المحفظة..." : "غير مطلوب للصندوق";
    });

    /* ---- الحسابات ---- */
    $("#btnAddAccount").addEventListener("click", () => openAccountDialog(null));
    $("#txtAccountSearch").addEventListener("input", renderAccounts);
    $("#btnSaveAccount").addEventListener("click", saveAccount);
    $("#btnCancelAccount").addEventListener("click", () => hideModal("mAccount"));

    /* ---- القيود اليومية ---- */
    $("#btnAddJournal").addEventListener("click", openJournal);
    $("#txtJournalSearch").addEventListener("input", renderJournal);
    // 🆕 بناء 115: تبسيط القيود — الأزرار الثلاثة + دفتر الحركة + بنود الضبط
    $("#btnExpEntry").addEventListener("click", () => openSimpleEntry("expense"));
    $("#btnIncEntry").addEventListener("click", () => openSimpleEntry("income"));
    $("#btnTransferEntry").addEventListener("click", openTransferEntry);
    $("#btnSaveSimple").addEventListener("click", saveSimpleEntry);
    $("#btnCancelSimple").addEventListener("click", () => hideModal("mSimpleEntry"));
    $("#btnSaveTransfer").addEventListener("click", saveTransfer);
    $("#btnCancelJTransfer").addEventListener("click", () => hideModal("mSimpleTransfer"));
    $("#txtLedgerAcc").addEventListener("input", renderLedger);
    $("#txtLedgerAcc").addEventListener("focus", () => ensureDatalist("ledgerAccountsList", accounts.filter((a) => Number(a.parentId) !== 0 && a.isActive).map((a) => a.code + " - " + a.nameAr)));
    $("#btnLedgerPrint").addEventListener("click", printLedger);
    $("#btnOpenAccStatement").addEventListener("click", () => openAccStatementFor($("#txtLedgerAcc").value));
    $("#btnCItemAdd").addEventListener("click", addCItem);
    $("#btnAddJLine").addEventListener("click", () => {
      jrnLines.push({ accountId: "0", accountText: "", debit: "", credit: "" });
      renderJrnLines();
    });
    $("#btnSaveJournal").addEventListener("click", saveJournal);
    $("#btnCancelJournal").addEventListener("click", () => hideModal("mJournal"));

    /* ---- المركز المالي ---- */
    $("#btnRefreshBalance").addEventListener("click", renderBalance);
    $("#btnPrintBalance").addEventListener("click", printBalance);

    /* ---- كشوف الخزائن ---- */
    $("#cmbTreStmt").addEventListener("change", renderTreStmt);
    $("#btnPrintTreStmt").addEventListener("click", printTreStmt);

    /* ---- التقارير ---- */
    $("#btnRefreshReports").addEventListener("click", renderReports);
    $("#btnExportReports").addEventListener("click", exportReports);
    $("#dtpRepFrom").addEventListener("input", renderReports);
    $("#dtpRepTo").addEventListener("input", renderReports);

    /* ---- المستخدمون (حسابات الشركة الحقيقية) ---- */
    const btnAddUser = $("#btnAddUser");
    if (btnAddUser) btnAddUser.addEventListener("click", () => window.__memberAddOpen());
    const usrSearch = $("#txtUserSearch");
    if (usrSearch) usrSearch.addEventListener("input", renderUsers);

    /* ---- سجل العمليات ---- */
    $("#txtAuditSearch").addEventListener("input", renderAudit);
    $("#btnExportAudit").addEventListener("click", exportAudit);

    /* ---- الإعدادات ---- */
    $("#btnSaveSettings").addEventListener("click", saveSettingsForm);
    $("#btnBackupAll").addEventListener("click", backupAllData);
    const btnBackupAll2 = document.getElementById("btnBackupAll2");
    if (btnBackupAll2) btnBackupAll2.addEventListener("click", backupAllData);
    const btnResetDataEl = document.getElementById("btnResetData");
    if (btnResetDataEl) btnResetDataEl.addEventListener("click", resetData);
    $("#btnRestore").addEventListener("click", () => $("#fileRestore").click());
    $("#fileRestore").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => ownerRestoreFile(String(ev.target.result));
      reader.readAsText(f);
      e.target.value = "";
    });
    /* ---- نسخة النشر الكاملة (المالك) ---- */
    const bdf = document.getElementById("btnDeployFull");
    if (bdf) bdf.addEventListener("click", () => ownerDeployBackup(true));
    const bde = document.getElementById("btnDeployEmpty");
    if (bde) bde.addEventListener("click", () => ownerDeployBackup(false));
    const bdr = document.getElementById("btnDeployRestore");
    const fdr = document.getElementById("fileDeployRestore");
    if (bdr && fdr) {
      bdr.addEventListener("click", () => fdr.click());
      fdr.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (ev) => ownerRestoreFullFile(String(ev.target.result));
        reader.readAsText(f);
        e.target.value = "";
      });
    }

    /* ---- إعدادات العميل ---- */
    $("#btnSaveClientSettings").addEventListener("click", saveClientSettingsForm);
    /* تبويب النسخ الاحتياطي الخاص بالعميل أُزيل (النسخ صار للمالك فقط) — ربط اختياري آمن */
    (function () {
      const bb = document.getElementById("btnClientBackup");
      const br = document.getElementById("btnClientRestore");
      const fr = document.getElementById("fileClientRestore");
      if (bb) bb.addEventListener("click", backupData);
      if (br && fr) {
        br.addEventListener("click", () => fr.click());
        fr.addEventListener("change", (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = (ev) => clientRestoreFile(String(ev.target.result));
          reader.readAsText(f);
          e.target.value = "";
        });
      }
    })();

    /* ---- محدد الشركة للمالك (يحمل تبويبات الشركة المختارة) ---- */
    const setOrgPicker = document.getElementById("setOrgPicker");
    if (setOrgPicker) {
      setOrgPicker.addEventListener("change", () => loadSettForOrg(setOrgPicker.value));
    }

    /* ---- تبديل التبويبات في شاشتي الإعدادات (المالك / العميل) ---- */
    function bindSettTabs(tabsId) {
      const tabs = document.getElementById(tabsId);
      if (!tabs) return;
      tabs.querySelectorAll(".tab-btn").forEach((b) => {
        b.addEventListener("click", () => {
          const view = b.closest(".view");
          if (!view) return;
          if (b.classList.contains("locked")) {
            toast("الميزة غير مفعلة في اشتراك شركتك — تواصل مع المالك.", "warning");
            return;
          }
          view.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          view.querySelectorAll(".sett-pane").forEach((p) => {
            p.hidden = p.dataset.pane !== b.dataset.tab;
          });
        });
      });
    }
    bindSettTabs("setTabs");
    bindSettTabs("csettTabs");

    // 🎟️ بناء 141: تبويب «دعوات الشركات» بيقرأ الرموز أول ما يفتح (مش من أول الصفحة)
    const invTabBtn = document.querySelector('#setTabs .tab-btn[data-tab="sinv"]');
    if (invTabBtn) {
      invTabBtn.addEventListener("click", () => loadInviteCodes("invCodesOwner"));
    }

    /* ---- أزرار جداول الإعدادات: العميل (c) والمالك (s) ---- */
    function bindSettGridBtns(viewId) {
      const view = document.getElementById(viewId);
      if (!view) return;
      const prefix = viewId === "viewClientSettings" ? "c" : "s";
      view.querySelectorAll("[data-" + prefix + "add], [data-" + prefix + "edit], [data-" + prefix + "del], [data-" + prefix + "ref]").forEach((btn) => {
        const action = btn.hasAttribute("data-" + prefix + "add") ? "add"
          : btn.hasAttribute("data-" + prefix + "edit") ? "edit"
          : btn.hasAttribute("data-" + prefix + "del") ? "del" : "ref";
        const type = btn.getAttribute("data-" + prefix + action) || "cat";
        btn.addEventListener("click", () => {
          const list = settList(prefix, type);
          // 🛡 بناء 124: «🔄 تحديث» = إعادة تحميل من السحابة فعلًا (كان رسم محلي بس) —
          // ده الزرار اللي بنوجّه المستخدم ليه لما التحميل يفشل والحفظ يتقفل.
          if (action === "ref") {
            renderSettGrid(prefix, type);
            try {
              if (prefix === "c") loadClientSettingsForm();
              else {
                const oid = $("#setOrgPicker") ? $("#setOrgPicker").value : null;
                if (oid) loadSettForOrg(oid);
              }
            } catch (e) { }
          }
          else if (action === "add") settOpenEditor(prefix, type, null);
          else if (action === "edit") {
            if (!list.length) { toast("لا توجد بيانات للتعديل.", "info"); return; }
            settOpenEditor(prefix, type, 0);
          } else {
            if (!list.length) { toast("لا توجد بيانات للحذف.", "info"); return; }
            const nm = (list[0] && list[0].name) || "هذا السجل";
            if (!confirm("حذف «" + nm + "» من هذه القائمة؟")) return;
            list.splice(0, 1);
            const p = settPayload(prefix);
            p[SETT_TYPES[type].key] = list;
            renderSettGrid(prefix, type);
            // 🛡 بناء 124: الحذف من الشريط كمان يتخزن على الجهاز ويترفع فورًا
            settAutosave(prefix, type, { force: true });
          }
        });
      });
    }
    bindSettGridBtns("viewSettings");
    bindSettGridBtns("viewClientSettings");

    // أزرار الحفظ المنفصلة لكل تبويب (data-ssave / data-csave)
    [["viewSettings", "s"], ["viewClientSettings", "c"]].forEach(([viewId, prefix]) => {
      const view = document.getElementById(viewId);
      if (!view) return;
      view.querySelectorAll("[data-" + prefix + "save]").forEach((btn) => {
        btn.addEventListener("click", () => saveSettPane(prefix, btn.getAttribute("data-" + prefix + "save")));
      });
    });

    document.querySelectorAll(".modal-overlay").forEach((ov) => {
      ov.addEventListener("click", (e) => {
        if (e.target === ov) ov.hidden = true;
      });
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.view;
        if (BUILT_VIEWS.includes(name)) {
      if (!canUseView(name)) {
        toast("هذه الشاشة غير مفعّلة في اشتراك شركتك.", "warning");
        return;
      }
          showView(name);
        } else {
          toast("شاشة «" + btn.textContent.trim() + "» قيد التطوير 🚧 - ستصل قريبًا.", "info");
        }
      });
    });

    document.addEventListener("click", (e) => {
      const tr = e.target.closest("tr.dgv-row") || e.target.closest("#dgvCustomers tbody tr");
      // (التحديد يتم داخل renderTable نفسه)
    });
  }

  /* ================== شاشات الدخول (النظام الأونلاين) ================== */
  function showLogin() {
    // 📷 بناء 144: أي مسار خروج (زرار/شاشة رفض/حساب شركتك) بيمرّ من هنا ⇒ الكاميرا
    // تتقفل واللمبة/المؤشر بتاع المتصفح يطفي — مافيش كاميرا تفضل شغالة بعد الخروج.
    if (scanCam.on) scanCamClose();
    // 🛡 تنظيف أي أثر للحساب السابق (الخروج لازم يمسح الهوية مش البيانات فقط)
    resetSessionState();
    hideLoginExpiry();
    $("#loginScreen").hidden = false;
    $("#orgScreen").hidden = true;
    $("#memberScreen").hidden = true;
  }
  function showOrgScreen() {
    hideLoginExpiry();
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = false;
    $("#memberScreen").hidden = true;
  }
  function hideScreens() {
    hideLoginExpiry();
    $("#bootSplash").hidden = true;
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = true;
    $("#memberScreen").hidden = true;
    $("#denyScreen").hidden = true;
  }

  function setAuthMsg(el, txt, kind) {
    el.textContent = txt;
    el.className = "login-msg " + (kind || "");
  }

  /* 🎟️ بناء 141: أي رفض على رمز الدعوة بيتحوّل لكلام ودّي بالعامي قبل ما يوصل للعين —
     نفس درس build 127 («ممنوع أي مصطلح تقني مخيف للعميل»): مافيش نص من القاعدة بيطلع
     بوجهه، والمصدر (السحابة/النت/الصلاحية) بيتصنف في جمل مفهومة بصيغة واحدة. */
  function inviteFailText(err) {
    const m = String((err && (err.message || err.code || err)) || "");
    if (/رمز|code/i.test(m) && /غير صحيح|غير نشطة|not active|inactive/i.test(m)) {
      return "الرمز ده مش شغال — اتأكد إنك كاتبه زي ما وصلك بالظبط، ولو لسه مرفوض تابع مع إدارة برنامج ميزان على واتس وهنرسلهولك من جديد.";
    }
    if (/رمز|code/i.test(m)) {
      return "الرمز ده مش لشركة موجودة حاليًا — تابع مع إدارة برنامج ميزان على واتس تتأكد منه.";
    }
    if (/جلسة|session/i.test(m)) {
      return "انتهت محاولة الدخول — ارجّع اسم المستخدم وكلمة المرور وعاود.";
    }
    if (/مرفوض|غير مصرح|permission|denied|صلاحية/i.test(m)) {
      return "الحساب ده ماعندوش صلاحية يدخل على الشركة دي — تابع مع إدارة برنامج ميزان على واتس.";
    }
    return "تعذّر إكمال الانضمام دلوقتي — اتأكد من الاتصال بالإنترنت وعاود، ولو استمر تابع مع إدارة برنامج ميزان على واتس.";
  }

  function setupAuth() {
    const activeLt = () => {
      const b = document.querySelector(".ltab[data-lt].active");
      return b ? b.dataset.lt : "in";
    };
    document.querySelectorAll(".ltab[data-lt]").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".ltab").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        $("#btnAuthGo").textContent = "دخول";
      });
    });
    // 🛡 بناء 141: مافيش تبويبات «شركة جديدة / لدي رمز دعوة» — الشاشة واحدة ووظيفتها
    // إدخال رمز الدعوة بس (قرار المالك «علشان محدش يعمل حسابات تجريبية»).
    // أي كود قديم كان بيبدّل بينهم اتشال من الملف، فمافيش مسار يورّي خانة اسم شركة.

const pwEye = document.getElementById("btnShowPass");
    if (pwEye) {
      pwEye.addEventListener("click", () => {
        const f = document.getElementById("authPass");
        if (!f) return;
        const on = f.type === "password";
        f.type = on ? "text" : "password";
        pwEye.textContent = on ? "🙈" : "👁";
      });
    }

    window.addEventListener("pageshow", (e) => {
      if (e.persisted || (window.performance && performance.getEntriesByType && performance.getEntriesByType("navigation").length && performance.getEntriesByType("navigation")[0].type === "back_forward")) {
        window.location.reload();
      }
    });

    // نفتح دائمًا على «تسجيل دخول مستخدم». لا يوجد تسجيل ذاتي —
    // حسابات الشركات تُنشأ من شاشة إدارة الشركات (المالك فقط).
    const defTab = document.querySelector('.ltab[data-lt="in"]');
    if (defTab) {
      defTab.click();
    }

    $("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = $("#authUser").value.trim();
      const pass = $("#authPass").value;
      const m = $("#authMsg");
      const asCompany = activeLt() === "up";
      if (!username || !pass) { setAuthMsg(m, "اكتب اسم المستخدم وكلمة المرور.", "err"); return; }
      setAuthMsg(m, "جارٍ الاتصال...", "");

      // كلا التبويبين دخول فقط — لا يوجد تسجيل ذاتي.
      // التبويب يحدد الشاشة فقط: «شركة» ← شاشة حسابات الشركة، «مستخدم» ← البرنامج.
      DATA.login(username, pass).then(() => {
        const p = DATA.getProfile();
        if (!p) {
          // 🎟️ بناء 141: الحساب اللي مالوش شركة بياخد **رمز دعوة** من المالك أو مساعِديه
          // (أعضاء شركة «ميزان») — أما إنه يكتب اسم شركة ويفتحها لنفسه ده اتقفل خالص.
          showOrgScreen();
          setAuthMsg($("#orgMsg"), "اكتب رمز الدعوة اللي وصلك من إدارة برنامج ميزان، وبعدها اسمك.", "");
          return;
        }
        if (asCompany) {
          if (!isOrgAdmin(p)) {
            DATA.logout().catch(() => { });
            setAuthMsg(m, "هذا ليس حساب شركة. استخدم تبويب «تسجيل دخول مستخدم».", "err");
            return;
          }
          // بوابة الانتهاء (بناء ١١٠): صاحب الشركة المنتهي ما يشوفش شاشة حساباته
          setAuthMsg(m, "جارٍ التحقق من الصلاحية...", "");
          DATA.requestAccess().then((acc) => {
            if (!accessGranted(acc)) { showDeny(acc); return; }
            hideLoginExpiry();
            setAuthMsg(m, "", "");
            showMembersScreen();
          }).catch((err) => { handleAskFailure(err, m); });
          return;
        }
        proceedOnline(m, username);
      }).catch((err) => setAuthMsg(m, "خطأ في الدخول: " + (err.message || err), "err"));
    });

    $("#btnWipe").addEventListener("click", () => {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.indexOf("sb-") === 0) localStorage.removeItem(k);
        });
        localStorage.removeItem("mizan_session_v1"); // توكن الجلسة المستمرة
      } catch (e) { }
      A.online = false;
      $("#btnLogout").hidden = true;
      $("#orgScreen").hidden = true;
      setAuthMsg($("#authMsg"), "تم مسح الجلسة القديمة. اكتب اسم المستخدم وكلمة المرور ثم اضغط دخول.", "ok");
    });

    // أزرار شاشة «حسابات شركتك»
   const btnMAdd = document.getElementById("btnMemberAdd");
   if (btnMAdd) btnMAdd.addEventListener("click", () => window.__memberAddOpen());
   // 🔑 صاحب الشركة يغيّر رقمه السري من هنا (قبل الدخول للبرنامج)
   const btnMSelfPw = document.getElementById("btnMemberSelfPw");
    if (btnMSelfPw) {
    btnMSelfPw.addEventListener("click", () => {
     if (!(isOrgAdmin(DATA.getProfile()) || isSuperAcct())) { toast("هذا الزر لصاحب الشركة فقط", "error"); return; }
   const me = (DATA.me && DATA.me()) ? DATA.me() : null;
   const uname = (me && (me.email || "").split("@")[0]) || "حسابك";
   openMyPasswordDialog(uname);
   });
   }
    const btnMLogout = document.getElementById("btnMemberLogout");
    if (btnMLogout) btnMLogout.addEventListener("click", () => {
      stopPlanWatch();
      DATA.logout().then(() => {
        A.online = false;
        $("#btnLogout").hidden = true;
        $("#btnChangePw").hidden = true;
        $("#memberScreen").hidden = true;
        showLogin();
        setAuthMsg($("#authMsg"), "تم تسجيل الخروج.", "ok");
      });
    });

    // 🛡 بناء 141: زرار «إنشاء الشركة والبدء» اتشال من الملف كله (من الـ HTML ومن الكود) —
    // مافيش أي نداء لـ DATA.createOrg في الحزمة المنشورة، فمحدش يقدر يولّد شركة لنفسه.

    $("#btnOrgJoin").addEventListener("click", () => {
      const code = $("#orgJoinCode").value.trim();
      const name = $("#orgJoinName").value.trim();
      const m = $("#orgMsg");
      if (!code) { setAuthMsg(m, "اكتب رمز الدعوة اللي وصلك من إدارة برنامج ميزان.", "err"); return; }
      setAuthMsg(m, "جارٍ التحقق من الرمز...", "");
      DATA.joinOrg(code, name).then(() => proceedOnline())
        .catch((err) => setAuthMsg(m, inviteFailText(err), "err"));
    });

    const btnOrgLogout = document.getElementById("btnOrgLogout");
    if (btnOrgLogout) {
      btnOrgLogout.addEventListener("click", () => {
        stopPlanWatch();
        DATA.logout().then(() => {
          A.online = false;
          $("#btnLogout").hidden = true;
          $("#btnChangePw").hidden = true;
          $("#orgScreen").hidden = true;
          showLogin();
        });
      });
    }

    $("#btnLogout").addEventListener("click", () => {
      stopPlanWatch();
      stopPresence();
      DATA.logout().then(() => {
        A.online = false;
        $("#btnLogout").hidden = true;
        $("#btnChangePw").hidden = true;
        showLogin();
      });
    });
  }

  /* ================== بعد الدخول ================== */
  // 🛡 تنظيف حالة الجلسة: ما يفضلش أي أثر للحساب السابق في الذاكرة
  // (بيانات الجداول نفسها تفضل في localStorage بس هتُفحص عند الدخول بـ guardOrgSwitch)
  function resetSessionState() {
    window.__isOwner = false;
    csetData = null;
    ssetData = null;
    lastOrgMembers = null;
    // 💬 بناء 125: الدردشة في الذاكرة فقط (ممنوع تخزينها على الجهاز أصلاً)،
    // فأي خروج أو رجوع لشاشة الدخول = تفضير كامل + إيقاف الـ polling.
    // كل مسارات الخروج بتنادي showLogin() → resetSessionState()، فالسطر ده
    // وحده يغطيها كلها (مافيش رسايل شركة تانية أو حساب تاني يفضل مفتوح).
    chatWipe("session");
    // خريطة معرّفات السحابة تخص الشركة السابقة → نفضيها
    if (window.MIZAN_STATE) window.MIZAN_STATE.idMap = {};
    // 🔑 build 119: الحالة المحلية بقت «غير مختومة» = مجهولة الملكية ⇒ الدخول
    // الجاي يمسحها قبل أي رفع (مافيش بقايا الحساب ده تنسب لحساب تاني)
    try { localStorage.removeItem(LS_STATE_ORG); } catch (e) { }
    // 🛡 نرجّع الجداول لحالة تجريبية نظيفة (مفيش بقايا بيانات شركة في الذاكرة)
    // مع منع أي رفع للسحابة أثناء التنظيف
    A.cleaning = true;
    try { loadData(); } finally { A.cleaning = false; }
    mirror();
    // 🛡 نخفي شاشات البرنامج القديمة حتى لا تبقى خلف شاشة الدخول
    ownerCurrentView = "";   // 🛡 بناء 121: مافيش شاشة «نشطة» دلوقتي ⇒ الحارس ما يعاندش إخفاء اللوحات
    document.querySelectorAll(".view").forEach((v) => { v.hidden = true; });
  }

  // 🛡 عزل الشركات: أي حالة محلية (ذاكرة + localStorage) مش مختومة بالشركة اللي
  // بنفتحها دلوقتي = حالة من حساب/شركة تانية ⇒ تُمسح قبل أي رفع للسحابة.
  // build 119: «ختم ملكية الحالة» (LS_STATE_ORG) هو الحكم — السبب الجذري إن
  // عملاء/موردين من حساب المالك اترفعوا لشركة «امين» اللي اتعملت فاضية.
  // البيانات الحقيقية بأمان على السحابة وبتنزل تاني في adoptCloud، فمسح حالة
  // غير مختومة لا يُفقد أحد شيئًا (وممنوع يرفعه لشركة تانية).
  function guardOrgSwitch() {
    const org = DATA && DATA.org && DATA.org() ? DATA.org().id : null;
    if (!org) return;
    let src = null;
    try { src = localStorage.getItem(LS_SRC_ORG); } catch (e) { }
    const owned = localStateOrg();
    // نمسح لو: الحالة مختومة بشركة تانية، أو بلا ختم أصلًا (بقايا حساب سابق/
    // لقطة قرص/جهاز جديد) — الختم بيتحط بعد كل دخول ناجح من السحابة.
    if (owned !== org) {
      wipeLocalTables();
      try { localStorage.removeItem(LS_SRC_ORG); } catch (e) { }
      // الختم الجديد: من لحظة المسح الحالة المحلية في المتصفح ده «تاعة» الشركة
      // اللي داخلين ليها (فاضية لحد ما السحابة تنزل) — كذا أي نداء تاني
      // لحارس العزل ما يمسحش بيانات الشركة اللي اتسحبت للتو.
      stampStateOrg(org);
      // 💬 بناء 125: رسايل الشركة السابقة (لو الشاشة كانت مفتوحة) ما تفضلش في الذاكرة،
      // والـ polling ما يفضلش يخبط للسحابة بهوية شركة جديدة وختم قديم.
      // (بعد الختم عمدًا — ترتيب «المسح ثم الختم» بتاع بناء 119 ما يتكسرش.)
      chatWipe("org");
      toast(owned ? "تم مسح بيانات الشركة السابقة من هذا المتصفح"
                  : "بدء نظيف: مفيش أي بيانات شركة تانية على هذا المتصفح", "ok");
    }
    try { localStorage.setItem(LS_SRC_ORG, org); } catch (e) { }
  }

  function seedPushFromLocal() {
    // 🛡 بناء 119: كان بيرفع البيانات التجريبية لأي شركة جديدة على السحابة
    // («شركة جهينة» و«مؤسسة الخير» ظهوروا في شركة «امين» اللي اتعملت فاضية).
    // قرار المالك: الشركة الجديدة تبدأ بيور والأرصدة يعملها المستخدم بنفسه،
    // فممنوع رفع أي seed. الشغل المحلي الحقيقي لسه بيترفع عاديين عن طريق
    // adoptCloud (السطور اللي مالهاش مثيل على السحابة) — دي مش تجريبية لأنها
    // اتشالت من الأساس في purgeDemoForCloudSession.
    return 0;
  }

  function proceedOnline(stageEl, stageUser, bypassMembers) {
    const stage = (t) => { if (stageEl) setAuthMsg(stageEl, t, ""); };
    // مالك الشركة (غير عادل) حقه يدخل شاشة «حسابات شركتك» قبل البرنامج
    // (bypassMembers = true فقط عند الضغط على زر «دخول البرنامج» من شاشة حسابات الشركة)
    const p0 = DATA.getProfile();
    if (!bypassMembers && isOrgAdmin(p0)) {
      // بوابة الصلاحية الأول (بناء ١١٠): المنتهي أو المقفول يشوف رسالة الدعم على شاشة
      // الدخول — مفيش دخول شاشة «حسابات شركتك» قبل ما نتأكد إن الاشتراك ساري.
      stage("جاري التحقق من الصلاحية...");
      DATA.requestAccess().then((acc) => {
        if (!accessGranted(acc)) { showDeny(acc); return; }
        hideLoginExpiry();
        showMembersScreen();
      }).catch((err) => { handleAskFailure(err, stageEl); });
      return;
    }
    A.online = true;
    A.adopting = true;
    // 🛡 عزل الشركات: مانبقاش ببيانات أي حساب سابق قبل ما نبدأ التحميل
    guardOrgSwitch();
    // 🛡 بناء 119: شركة جديدة = بيور — تشيل أي سطر تجريبي من الذاكرة والكاش قبل
    // ما السحابة تُسحب، فـ adoptCloud ما يلاقيش «سطور محلية زيادة» يرفعها للشركة.
    purgeDemoForCloudSession();
    // 🛡 فحص الصلاحيات الأول: ما نحمّلش أي بيانات من السحابة قبل تأكيد حق الدخول
    stage("جاري التحميل: فحص الصلاحيات...");
    DATA.requestAccess().then((acc) => {
      if (!accessGranted(acc)) { A.adopting = false; showDeny(acc); return; }
      stage("جاري التحميل: سحب بيانات السحابة...");
      return window.CLOUD.loadAll().then(() => {
        const changed = adoptCloud();
        A.adopting = false;
        persistLocalFromCloud();
        // 🔑 ختم ملكية الحالة: اللي في المتصفح ده دلوقتي = بيانات هذه الشركة بالذات
        try { stampStateOrg(DATA.org && DATA.org() ? DATA.org().id : null); } catch (e) { }
        seedPushFromLocal();
        // ارفع الجداول اللي فيها سجلات محلية لسه مش في السحابة (عشان ما تضلش معلّقة للأبد)
        if (changed && changed.length) changed.forEach((t) => pushTable(t));
        syncInvoiceSeqFromCloud();
        $("#btnLogout").hidden = false;
        // لا نُظهره هنا: يُتحكم فيه داخل proceedOnline
        // (لصاحب الشركة والسوبر أدمن فقط، لا للموظفين العاديين)
        $("#btnChangePw").hidden = true;
        const p = DATA.getProfile();
        // 🧭 بناء 126: الشريط العلوي ما بيعرضش الكلمة الإنجليزية الخام («admin») ولا «مدير».
        // التسمية بتيجي من roleLabel، والمصدر الموثوق = mizan_access لو الـ profile ناقص.
        var meRow = (p && p.role) ? p : ((DATA.accessInfo ? DATA.accessInfo() : null) || p);
        setUserInfo("👤 " + (p && p.full_name ? p.full_name : DATA.email()) + " | الصلاحية: " + roleLabel(meRow));
        setDbStatus("🟢 متصل بالسحابة");
        stage("جاري التحميل: فتح لوحة البيانات...");
        hideScreens();
        {
          // اسم الشركة من القاعدة → يظهر تلقائيًا في الفواتير والمطبوعات
          if (acc && acc.org_name) settings.orgName = acc.org_name;
          const org = DATA && DATA.org ? DATA.org() : null;
          if (org) {
            if (org.tax_enabled !== undefined && org.tax_enabled !== null) {
              applyTaxSettings(org.tax_enabled, org.tax_rate);
            }
          }
          saveSettings();
          setSubInfo(acc);
          startPlanWatch();
          startPresence();
          // هل المالك (سوبر أدمن)؟ → زرار الإدارة + شاشة إعدادات المالك
          // 🛡 بناء 121: لو صف `is_superadmin` وصل ناقص من مصدر واحد، ownerHasAllAccess()
          // بيلزم أي مصدر سحابي تاني (profile/me) — فلوحة الإدارة ما تقفلش على المالك.
          // العكس آمن: أي حساب غير المالك لسه isAdmin=false واللوحة مقفولة + بوابة showView/openAdmin.
          const isAdmin = !!(acc && acc.is_superadmin) || ownerHasAllAccess();
          window.__isOwner = isAdmin;
          // 🔑 بناء 133: شاشة «إعدادات المالك» = المالك + حسابات شركة ميزان (`ownerSettingsAllowed`)،
          // بينما لوحة الإدارة (`viewAdmin`) وحراسة النسخ الاحتياطي فضلا للمالك وحده (build 121/94).
          $("#viewAdmin").hidden = !isAdmin;
          $("#viewSettings").hidden = !ownerSettingsAllowed();
          // 🔓 قرار المالك (build 119): «الضبط الخاص بيا» + «💾 النسخ الاحتياطي»
          // يظهرا لحساب عادل فورًا، وممنوع أي مسار تاني يخفيهم أو يشيلهم من الـ DOM.
          enforceOwnerSettings();
          // 🔑 زر تغيير الرقم السري: لصاحب الشركة (admin) وللسوبر أدمن فقط.
          enforceChangePwBtn();
          // شاشة «إعدادات مؤسستك»: يُفتح فقط لو صاحب الشركة فعّلها لهذا الحساب
          // (أو المالك العام / صاحب الشركة نفسه).
          const csAllowed = canUseView("clientSettings");
          $("#viewClientSettings").hidden = !csAllowed;
          const svC = document.querySelector('.sidebar .nav-btn[data-view="clientSettings"]');
          // «إعدادات مؤسستك» تختفي تمامًا لو صاحب الشركة قفلها لهذا الحساب
          if (svC) {
            if (csAllowed) {
              svC.hidden = false;
            } else if (svC.parentNode) {
              svC.parentNode.removeChild(svC);
            }
          }
          ensureSettData().finally(() => {
            initApp();
            enforceChangePwBtn();
            if (!A.online || !csetData) return;
            // أعد ملء قوائم الضبط بعد التحميل حتى تتوفر الوحدات/التصنيفات/المستودعات فورًا
            try {
              if (!document.getElementById("viewClientSettings").hidden || !document.getElementById("viewSettings").hidden) renderAllSettPanes("c");
            } catch (e) { }
          });
        }
      }).catch((e) => {
        // الصلاحيات مؤكدة لكن تحميل البيانات فشل (مشكلة اتصال) → نفتح ببيانات محلية
        A.adopting = false;
        setDbStatus("🟠 مشكلة اتصال");
        toast("تعذّر تحميل بيانات السحابة: " + e.message, "error");
        initApp();
      });
    }).catch((err) => {
      // 🛡 إغلاق الفتحة القديمة (fail-open): فشل فحص الصلاحيات = مانفتحش البرنامج
      A.adopting = false;
      // 🛡 بناء 127: لكن مانرميش شاشة «انتهى اشتراكك» لمجرد إن السحابة ما ردّتش
      handleAskFailure(err, stageEl);
    });
  }

  // مؤشر: هل الحساب الحالي «مالك شركة» (مش عادل مالك البرنامج)؟ → شاشة الحسابات
  // 🧭 بناء 126: بتفوّض التعريف الوحيد `isCompanyOwnerRow` — ممنوع أي نسخة تانية من الشرط.
  // لو مُرِّر profile ناقص/فارغ نرجع لـ mizan_access (المصدر الموثوق).
  function isOrgAdmin(p) {
    var r = (p && p.role) ? p : currentAcct();
    return isCompanyOwnerRow(r);
  }
  // بعد الدخول بحساب الشركة نفتح شاشة «حسابات شركتك» بدل فتح البرنامج مباشرة
  function showMembersScreen() {
    hideScreens();
    $("#memberScreen").hidden = false;
    const info = $("#memberOrgName");
    const cnt = $("#memberCount");
    const lst = $("#memberList");
    info.textContent = "جارٍ تحميل بيانات الشركة...";
    cnt.textContent = "";
    lst.innerHTML = "<p class=\"login-sub\">جارٍ التحميل...</p>";
    DATA.orgInfo().then((o) => {
      if (!o) { info.textContent = ""; return; }
      info.textContent = "🏢 " + (o.org_name || "");
      const used = o.members_count || 0;
      const max = o.max_members || 5;
      cnt.textContent = "عدد الحسابات: " + used + " من " + max;
      const canManage = !!(o.is_org_admin || o.is_superadmin);
      return Promise.all([Promise.resolve(o), DATA.orgMembers(o.org_id), Promise.resolve(canManage)]);
    }).then(([o, members, canManage]) => {
      renderMemberList(members, canManage);
    }).catch((e) => {
      lst.innerHTML = "<p class=\"login-msg err\">" + (e.message || e) + "</p>";
    });
  }
  // بعد أي تعديل على حسابات الشركة: حدّث الشاشة المعروضة حاليًا
  // (شاشة «حسابات شركتك» أو تبويب «المستخدمون» داخل البرنامج).
  function refreshMemberViews() {
    const ms = document.getElementById("memberScreen");
    if (ms && !ms.hidden) { showMembersScreen(); return; }
    lastOrgMembers = null;
    if (typeof renderUsers === "function") renderUsers();
  }

  function renderMemberList(members, canManage, mount) {
    const lst = mount || $("#memberList");
    if (!lst) return;
    const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
    if (!members || !members.length) {
      lst.innerHTML = "<p class=\"login-sub\">لا يوجد حسابات بعد — اضغط «إضافة حساب» لإنشاء أول موظف.</p>";
    } else {
      let h = "<table class=\"data-table\"><thead><tr><th>الحساب</th><th>الاسم</th><th>الصلاحية</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>";
      members.forEach((u) => {
        const isMe = myUid && u.user_id === myUid;
        const feats = summarizeFeats(u.features);
   let actions = "";
   if (canManage && !isMe && !u.is_superadmin) {
   actions += "<button class=\"btn small red\" style=\"margin:2px\" type=\"button\" onclick=\"window.__memberDel('" + u.user_id + "')\">🗑️ حذف</button>";
   }
   // 🔑 تغيير الرقم السري — لكل حسابات الشركة بما فيها حساب صاحبها
   actions += "<button class=\"btn small orange\" style=\"margin:2px\" type=\"button\" onclick=\"window.__memberResetPw('" + u.user_id + "','" + (u.username || "") + "')\">🔑 تغيير الرقم السري</button>";
   actions += "<button class=\"btn small sky\" style=\"margin:2px\" type=\"button\" onclick=\"window.__memberFeats('" + u.user_id + "')\">⚙️ الصلاحيات</button>";
        // زرار دخول البرنامج — يظهر قدام حساب صاحب الشركة هو فقط
        if (isMe) {
          actions += "<button class=\"btn small green\" style=\"margin:2px\" type=\"button\" onclick=\"window.__memberEnterProgram()\">▶ دخول البرنامج</button>";
        }
        h += "<tr>" +
          "<td><code>" + (u.username || "—") + "</code>" + (isMe ? " <b>(أنت)</b>" : "") + "</td>" +
          "<td>" + (u.full_name || "—") + "</td>" +
          "<td>" + feats + "</td>" +
          "<td>" + (u.blocked ? "🔴 محظور" : "🟢 نشط") + "</td>" +
          "<td>" + actions + "</td></tr>";
      });
      h += "</tbody></table>";
      lst.innerHTML = h;
    }
  }
  // ملخص الصلاحيات: إن كانت كلها مفعلة → «كل الصلاحيات»، وإلا المعطل فقط
  // 🔑 نافذة تغيير الرقم السري للحساب الحالي (صاحب شركة / مالك البرنامج)
  // جديد + تأكيد، بدون طلب الرقم القديم — والكلمة الجديدة تظهر عند مالك البرنامج.
  function openMyPasswordDialog(label) {
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">🔑 تغيير الرقم السري — ' +
      (label || "حسابك") + "</div>" +
      '<label class="feat-line" style="margin:6px 0">الرقم السري الجديد ' +
      '<input id="myNew" class="inp" type="text" placeholder="اكتب الرقم السري الجديد" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">تأكيد الرقم السري ' +
      '<input id="myCon" class="inp" type="text" placeholder="أعد كتابة الرقم السري" style="flex:1" /></label>' +
      '<div class="feat-btns">' +
      '<button class="btn gray small" type="button" id="myGen">🎲 توليد</button>' +
      '<button class="btn green" type="button" id="myOk">حفظ</button>' +
      '<button class="btn gray" type="button" id="myCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#myCancel").onclick = () => dlg.remove();
    dlg.querySelector("#myGen").onclick = () => {
      const v = Math.random().toString(36).slice(2, 8) +
                Math.random().toString(36).slice(2, 5).toUpperCase() + "1";
      dlg.querySelector("#myNew").value = v;
      dlg.querySelector("#myCon").value = v;
    };
    dlg.querySelector("#myOk").onclick = () => {
      const np = dlg.querySelector("#myNew").value.trim();
      const cp = dlg.querySelector("#myCon").value.trim();
      if (!np) { toast("اكتب الرقم السري الجديد", "error"); return; }
      if (np !== cp) { toast("رقمان غير متطابقين", "error"); return; }
      if (np.length < 6) { toast("الرقم السري لازم 6 حروف على الأقل", "warning"); return; }
      // p_old = null → الدالة تتخطى التحقق وتخزّن الجديدة ليقرأها مالك البرنامج
      DATA.changeMyPassword(null, np).then(() => {
        toast("تم تغيير الرقم السري للحساب ✅", "ok");
        dlg.remove();
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
  }

  // 🔑 تغيير الرقم السري لحساب من حسابات الشركة (صاحب الشركة فقط)
  window.__memberResetPw = function (userId, username) {
    if (!(isOrgAdmin(DATA.getProfile()) || isSuperAcct())) { toast("هذا الزر لصاحب الشركة فقط", "error"); return; }
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">🔑 تغيير الرقم السري — ' +
      (username || "") + "</div>" +
      '<label class="feat-line" style="margin:6px 0">الرقم السري الجديد ' +
      '<input id="mrNew" class="inp" type="text" placeholder="اكتب الرقم السري الجديد" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">تأكيد الرقم السري ' +
      '<input id="mrCon" class="inp" type="text" placeholder="أعد كتابة الرقم السري" style="flex:1" /></label>' +
      '<div class="feat-btns">' +
      '<button class="btn gray small" type="button" id="mrGen">🎲 توليد</button>' +
      '<button class="btn green" type="button" id="mrOk">حفظ</button>' +
      '<button class="btn gray" type="button" id="mrCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#mrCancel").onclick = () => dlg.remove();
    dlg.querySelector("#mrGen").onclick = () => {
      const v = Math.random().toString(36).slice(2, 8) +
                Math.random().toString(36).slice(2, 5).toUpperCase() + "1";
      dlg.querySelector("#mrNew").value = v;
      dlg.querySelector("#mrCon").value = v;
    };
    dlg.querySelector("#mrOk").onclick = () => {
      const np = dlg.querySelector("#mrNew").value.trim();
      const cp = dlg.querySelector("#mrCon").value.trim();
      if (!np) { toast("اكتب الرقم السري الجديد", "error"); return; }
      if (np !== cp) { toast("رقمان غير متطابقين", "error"); return; }
      if (np.length < 6) { toast("الرقم السري لازم 6 حروف على الأقل", "warning"); return; }
      if (!confirm("سيتم إنهاء جلسات «" + (username || "") + "» الحالية. متابعة؟")) return;
      DATA.orgResetMemberPassword(userId, np).then(() => {
        toast("تم تغيير الرقم السري لـ " + (username || "") + " → " + np, "ok");
        dlg.remove();
        showMembersScreen();
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
  };

  // 🔑 بناء 133: المفاتيح المحجوزة للمالك (settings) **ما تظهرش في أي ملخص صلاحيات** —
  // دي مش صلاحية يتداولها أصحاب المؤسسات، فلو قديمة محفوظة `false` في بيانات حساب،
  // إبرازها في العمود كان هيبان «مكان/اسم مالوش لازمة» (ولو المفتاح اتشال من قائمة
  //Labels كان بيرجع اسمه الإنجليزي الخام `settings` = مصطلح تقني للعميل — ممنوع).
  function isOwnerOnlyFeatKey(k) { return OWNER_ONLY_FEATS.indexOf(k) !== -1; }
  function summarizeFeats(feats) {
    const f = feats || {};
    const off = Object.keys(f).filter((k) => f[k] === false && !isOwnerOnlyFeatKey(k));
    if (!off.length) return "✅ كل الصلاحيات";
    let s = off.length > 3 ? off.length + " صلاحيات مغلقة" : off.map((k) => {
      const found = ADMIN_FEATURES.find((x) => x[0] === k);
      return found ? found[1] : k;
    }).join("، ");
    return "🔒 " + s;
  }
  // ملخص بسيط للصلاحيات داخل لوحة المالك (نفس الأداة)
  function featsSummary(feats, adminFeats) {
    const f = feats || {};
    const off = Object.keys(f).filter((k) => f[k] === false && !isOwnerOnlyFeatKey(k));
    if (!off.length) return "✅ كل الصلاحيات";
    const offLabels = off.map((k) => {
      const found = (adminFeats || ADMIN_FEATURES).find((x) => x[0] === k);
      return found ? found[1] : k;
    });
    return offLabels.length > 2 ? offLabels.length + " صلاحيات مغلقة" : "🔒 " + offLabels.join("، ");
  }
  // نافذة لتعديل صلاحيات حساب تابع لشركتي
  window.__memberFeats = function (userId) {
    DATA.orgMembers(DATA.orgId()).then((members) => {
      const u = members.find((x) => x.user_id === userId);
      if (!u) { toast("الحساب غير موجود", "error"); return; }
      let opts = "";
      // 🔑 بناء 133: «الإعدادات (المالك)» مش من الاختيارات دي إطلاقًا (source: `chooserFeatures`)
      chooserFeatures().forEach(([k, label]) => {
        // الصلاحيات opt-in: لا تُمنح إلا لو فُعّلت صريحًا (زي إعدادات المؤسسة والمستندات)
        const on = OPT_IN_FEATS.indexOf(k) !== -1
          ? (u.features && u.features[k] === true)
          : !(u.features && u.features[k] === false);
        opts += "<label class=\"feat-line\"><input type=\"checkbox\" class=\"member-feat\" value=\"" + k + "\" " + (on ? "checked" : "") + " /> " + label + "</label>";
      });
      const body = "<div class=\"feat-grid\">" + opts + "</div>" +
        "<div class=\"feat-btns\"><button class=\"btn green\" type=\"button\" id=\"memberFeatSave\">حفظ الصلاحيات</button>" +
        "<button class=\"btn gray\" type=\"button\" id=\"memberFeatCancel\">إلغاء</button></div>";
      const dlg = document.createElement("div");
      dlg.className = "modal-overlay";
      dlg.innerHTML = '<div class="modal-box"><div class="panel-title">صلاحيات — ' + (u.full_name || u.username) + "</div>" + body + "</div>";
      document.body.appendChild(dlg);
      dlg.querySelector("#memberFeatCancel").onclick = () => dlg.remove();
      dlg.querySelector("#memberFeatSave").onclick = () => {
        const on = {};
        dlg.querySelectorAll(".member-feat").forEach((c) => { on[c.value] = c.checked; });
        // 🔑 بناء 133: المفتاح المحفوظ (لو كان اتحدد قبل كده) بيعدي زي ما هو — الحفظ
        // ده مالوش سلطة على «إعدادات المالك»، ومينفعش يمسح أو يضيف بيانات موجودة.
        carryOwnerOnlyFeats(on, u.features);
        DATA.orgSetFeatures(userId, on).then(() => {
          toast("تم حفظ الصلاحيات", "ok");
          dlg.remove();
          refreshMemberViews();
        }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
      };
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };
  // نافذة إضافة حساب فرعي
  window.__memberAddOpen = function () {
    DATA.orgInfo().then((o) => {
      const used = o.members_count || 0;
      const max = o.max_members || 5;
      if (used >= max) {
        toast("وصلت الحد الأقصى للحسابات (" + used + "/" + max + ")", "warning");
        return;
      }
      let opts = "";
      // 🔑 بناء 133: حساب فرعي جديد مالوش «إعدادات المالك» في القائمة أصلًا
      chooserFeatures().forEach(([k, label]) => {
        const def = OPT_IN_FEATS.indexOf(k) !== -1 ? "" : " checked";
        opts += "<label class=\"feat-line\"><input type=\"checkbox\" class=\"member-newfeat\" value=\"" + k + "\"" + def + " /> " + label + "</label>";
      });
      const body = "<div class=\"feat-grid\" style=\"grid-template-columns:repeat(3,1fr)\">" +
        "<input id=\"memberNewUser\" class=\"inp\" placeholder=\"يوزر نيم (إنجليزي)\" />" +
        "<input id=\"memberNewPass\" class=\"inp\" type=\"password\" placeholder=\"كلمة المرور\" />" +
        "<input id=\"memberNewName\" class=\"inp\" placeholder=\"اسم الموظف\" />" +
        "</div>" +
        "<div class=\"panel-title\" style=\"margin-top:12px\">صلاحيات هذا الحساب</div>" +
        "<div class=\"feat-grid\">" + opts + "</div>" +
        "<div class=\"feat-btns\"><button class=\"btn green\" type=\"button\" id=\"memberAddSave\">إضافة الحساب</button>" +
        "<button class=\"btn gray\" type=\"button\" id=\"memberAddCancel\">إلغاء</button></div>";
      const dlg = document.createElement("div");
      dlg.className = "modal-overlay";
      dlg.innerHTML = '<div class="modal-box"><div class="panel-title">➕ حساب جديد — ' + (o.org_name || "") + " (" + used + "/" + max + ")" + "</div>" + body + "</div>";
      document.body.appendChild(dlg);
      dlg.querySelector("#memberAddCancel").onclick = () => dlg.remove();
      dlg.querySelector("#memberAddSave").onclick = () => {
        const nu = dlg.querySelector("#memberNewUser").value.trim();
        const np = dlg.querySelector("#memberNewPass").value;
        const nn = dlg.querySelector("#memberNewName").value.trim() || null;
        const on = {};
        dlg.querySelectorAll(".member-newfeat").forEach((c) => { on[c.value] = c.checked; });
        if (!nu || !np) { toast("اكتب يوزر نيم وكلمة مرور للحساب", "error"); return; }
        DATA.orgAddMember(nu, np, nn, "member", on).then(() => {
          // أرسل بيانات الحساب للمالك (سوبر أدمن) حتى تظهر في شاشته
          return DATA.logCreatedAccount(DATA.orgId(), nu, np, nn, on)
            .catch(() => null);
        }).then(() => {
          toast("تمت إضافة الحساب", "ok");
          dlg.remove();
          refreshMemberViews();
        }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
      };
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };
  // حذف حساب تابع
  // زرار «دخول البرنامج» — لصاحب الشركة (حسابه هو) من شاشة حسابات شركته
  window.__memberEnterProgram = function () {
    const p0 = DATA.getProfile();
    if (!isOrgAdmin(p0)) { toast("هذا الزر لصاحب الشركة فقط", "error"); return; }
    if (!confirm("ادخل البرنامج الآن بحسابك؟\nتقدر ترجع لشاشة حسابات شركتك في أي وقت.")) return;
    proceedOnline(null, null, true);
  };
  window.__memberDel = function (userId) {
    if (!confirm("هل تريد حذف هذا الحساب نهائيًا؟")) return;
    DATA.orgDeleteMember(userId).then((orgName) => {
      toast("تم حذف الحساب" + (orgName ? " من شركة «" + orgName + "»" : ""), "ok");
      refreshMemberViews();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // 🔒 دمج غير مدمّر: ياخد سجلات السحابة كأساس، ويزيد عليها أي سجل محلي
  // لسه ما وصلش للسحابة (معرّفه id مش موجود عند السحابة)، بدل ما يستبدل
  // الكل ويمسح شغل المستخدم (ده كان سبب اختفاء الفواتير عند القفل).
  function mergeCloudLocal(cloudArr, localArr) {
    cloudArr = Array.isArray(cloudArr) ? cloudArr : [];
    localArr = Array.isArray(localArr) ? localArr : [];
    if (!cloudArr.length) return { merged: localArr.slice(), extras: 0 };
    const seen = {};
    cloudArr.forEach(function (r) { if (r && r.id != null) seen[String(r.id)] = 1; });
    const extras = localArr.filter(function (r) { return r && r.id != null && !seen[String(r.id)]; });
    return { merged: cloudArr.concat(extras), extras: extras.length };
  }

  // الفواتير القديمة على السحابة كانت بتتخزن باسم العميل/المورد من غير رقمه → الجهاز التاني
  // بيشوف الاسم بس فترابط الفاتورة بصاحها يضيع (والمتاح للرجوع ووسم المرتجع بيتعطلوا).
  // إلحقها بالاسم دلوقتي، وأول حفظ جاي يبعت الرقم ويصلح السحابة نفسها.
  function linkInvoiceParties() {
    const byName = (arr, name) => {
      const t = String(name || "").trim();
      if (!t) return null;
      for (let i = 0; i < arr.length; i++) {
        const x = arr[i];
        if (String(x.nameAr || x.name || "").trim() === t) return x;
      }
      return null;
    };
    const hasId = (v) => v !== null && v !== undefined && String(v) !== "" && Number(v) > 0;
    let fixed = 0;
    sales.forEach((s) => {
      if (hasId(s.customerId)) return;
      const c = byName(customers, s.customerName || s.customer);
      if (c) { s.customerId = c.id; fixed++; }
    });
    purchases.forEach((p) => {
      if (hasId(p.supplierId)) return;
      const sup = byName(suppliers, p.supplierName || p.supplier);
      if (sup) { p.supplierId = sup.id; fixed++; }
    });
    return fixed;
  }

  function adoptCloud() {
    const S = window.MIZAN_STATE;
    const changed = [];
    function step(name, cloudArr, localArr, apply) {
      const m = mergeCloudLocal(cloudArr, localArr);
      apply(m.merged);
      if (m.extras > 0) changed.push(name);
    }
    step("customers", S.customers, customers, function (v) { customers = v; });
    step("products", S.products, products, function (v) { products = v; });
    step("suppliers", S.suppliers, suppliers, function (v) { suppliers = v; });
    step("treasury", S.treasury, treasury, function (v) { treasury = v; });
    step("accounts", S.accounts, accounts, function (v) { accounts = v; });
    step("sales", S.sales, sales, function (v) { sales = v; });
    step("purchases", S.purchases, purchases, function (v) { purchases = v; });
    step("sale_returns", S.sale_returns, saleReturns, function (v) { saleReturns = v; });
    step("purchase_returns", S.purchase_returns, purchaseReturns, function (v) { purchaseReturns = v; });
    step("supplier_txs", S.supplier_txs, supplierTxs, function (v) { supplierTxs = v; });
    step("customer_txs", S.customer_txs, txs, function (v) { txs = v; });
    // 🆕 بناء 115: دمج الحضور زي بقية الجداول (بالهوية local_id — درس ترحيل ٣٤)
    step("employees", S.employees, employees, function (v) { employees = v; });
    step("attendance", S.attendance, attendance, function (v) { attendance = v; });
    // 🆕 مهمة 98: الأصول الثابتة — دمج بنفس الهوية (local_id)
    step("fixed_assets", S.fixed_assets, fixedAssets, function (v) { fixedAssets = v; });
    // att_settings: سطر واحد لكل شركة — لو LOCAL كان افتراضي (مفتاحش غايب لحظة الإقلاع)
    // والسحابة فيها قيمة حقيقية، السحابة هي المرجع. غير كده المحلية تتثبت فوقها لاحقًا بالـ push.
    try {
      if (Array.isArray(S.att_settings) && S.att_settings.length &&
          bootLsPresent[LS_ATT_SETTINGS] === false) {
        attSettings = Object.assign(defaultAttSettings(), S.att_settings[0]);
      }
    } catch (e) { }
    step("vouchers", S.vouchers, vouchers, function (v) { vouchers = v; });
    step("journal_entries", S.journalEntries, journalEntries, function (v) { journalEntries = v; });
    linkInvoiceParties();
    recalculateCustomerBalances();
    recalculateSupplierBalances();
    recalculateTreasuryBalances();
    syncToLocalDisk();
    return changed;
  }

  function persistLocalFromCloud() {
    localStorage.setItem(LS_CUSTOMERS, JSON.stringify(customers));
    localStorage.setItem(LS_TXS, JSON.stringify(txs));
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));
    localStorage.setItem(LS_SALES, JSON.stringify(sales));
    localStorage.setItem(LS_TREASURY, JSON.stringify(treasury));
    localStorage.setItem(LS_SUPPLIERS, JSON.stringify(suppliers));
    localStorage.setItem(LS_SUP_TXS, JSON.stringify(supplierTxs));
    localStorage.setItem(LS_PURCHASES, JSON.stringify(purchases));
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
    localStorage.setItem(LS_JOURNAL, JSON.stringify(journalEntries));
    localStorage.setItem(LS_VOUCHERS, JSON.stringify(vouchers));
    localStorage.setItem(LS_SALE_RETURNS, JSON.stringify(saleReturns));
    localStorage.setItem(LS_PURCHASE_RETURNS, JSON.stringify(purchaseReturns));
    // 🆕 بناء 115
    localStorage.setItem(LS_EMPLOYEES, JSON.stringify(employees));
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(LS_ATT_SETTINGS, JSON.stringify(attSettings));
    localStorage.setItem(LS_FIXED_ASSETS, JSON.stringify(fixedAssets));
  }

  /* ================== شاشة "غير متاح" (وقت/قفل/حجب) ================== */
  // صناديق رسالة الانتهاء فوق شاشة الدخول (بناء ١١٠)
  function showLoginExpiry(text) {
    const exp = document.getElementById("loginExpiry");
    if (!exp) return false;
    const t = document.getElementById("loginExpiryText");
    if (t && text) t.textContent = text;
    exp.hidden = false;
    return true;
  }
  function hideLoginExpiry() {
    const exp = document.getElementById("loginExpiry");
    if (exp) exp.hidden = true;
  }

  // 🛡 بناء 127 (تمهيد التصحيح ٤٩): «ما قدرناش نسأل» ≠ «القاعدة قالت لا»
  // data.js بيسمّي فشل mizan_access بـ err.mizanAsk = "denied" | "unreachable".
  // أي فشل نقل (نت واقع / سيرفر مشغول) يفضل على شاشة الدخول برسالة ودّية، مش شاشة
  // «انتهى اشتراكك» — مع بقاء الحماية كما هي: مانفتحش البرنامج خالص (fail-closed).
  function isTransportAskError(err) {
    if (!err) return false;
    if (err.mizanAsk === "unreachable") return true;
    if (err.mizanAsk === "denied") return false;
    return /failed to fetch|fetch failed|network|networkerror|econn|etimedout|enotfound|offline|load fail/i.test(String(err.message || err));
  }
  function showLoginRetry(stageEl, msg) {
    hideLoginExpiry();
    $("#denyScreen").hidden = true;
    $("#orgScreen").hidden = true;
    $("#memberScreen").hidden = true;
    $("#loginScreen").hidden = false;
    setDbStatus("🟠 مشكلة اتصال");
    const el = stageEl || $("#authMsg");
    if (el) setAuthMsg(el, msg, "err");
  }
  function handleAskFailure(err, stageEl) {
    if (isTransportAskError(err)) {
      showLoginRetry(stageEl, "تعذّر الوصول للسحابة (الإنترنت أو السيرفر مشغول) — اتأكد من الاتصال ودوس دخول تاني.");
      return;
    }
    showDeny(null);
  }

  function showDeny(acc) {
    const reasons = {
      plan: "انتهت فترة إشتراكك تواصل مع الدعم الفنى لشركة ميزان لإعادة تفعيل باقة الإشتراك",
      locked: "شركتك مقفولة حاليًا من إدارة ميزان — تواصل مع الدعم الفنى لإعادة التفعيل",
      blocked: "عضوك حديثًا محظور. تواصل مع مالك الشركة.",
      noprofile: "لا يوجد حساب مرتبط بشركة.",
      noorganization: "لا توجد شركة مرتبطة بحسابك."
    };
    let msg;
    if (!acc) msg = "تعذّر التحقق من اشتراكك — جرّب الدخول بعد لحظات.";
    else if (acc.reason === "plan" && acc.plan_end) {
      msg = "انتهت فترة إشتراكك بتاريخ " + String(acc.plan_end).slice(0, 10) + " — تواصل مع الدعم الفنى لشركة ميزان لإعادة تفعيل باقة الإشتراك";
    } else msg = reasons[acc.reason] || "لا يمكنك الدخول حاليًا.";

    // المنتهي أو المقفول: يفضل في شاشة تسجيل الدخول وتشوف الرسالة + زر الواتس
    // (بدل ما يدخل شاشة حسباته وصلاحياتها — ده كان الغلط اللي اتصلّح في بناء ١١٠)
    const onLogin = !!(acc && (acc.reason === "plan" || acc.reason === "locked"));
    if (onLogin) {
      $("#denyScreen").hidden = true;
      $("#orgScreen").hidden = true;
      $("#memberScreen").hidden = true;
      $("#loginScreen").hidden = false;
      showLoginExpiry(msg);
      const m = document.getElementById("authMsg");
      if (m) { m.textContent = ""; m.className = "login-msg"; }
      return;
    }
    hideLoginExpiry();
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = true;
    $("#denyScreen").hidden = false;
    const msgEl = $("#denyMsg");
    msgEl.textContent = msg;
    msgEl.className = "login-msg err";
  }

  /* ================== 🆕 بناء 115: منطق الحضور والانصراف ================== */
  // الحالات السبع المعتمدة (نفس قيود CHECK في ترحيل ٣٥ — ماتفكش الاتنين عن بعض)
  const ATT_STATUSES = {
    present: "حاضر", absent: "غائب", late: "متأخر", mission: "مأمورية",
    leave: "إجازة", permit: "إذن", holiday: "عطلة رسمية"
  };
  let attBound = false;          // أربطة الأحداث تُعمل مرة واحدة عند أول فتح للتبويب
  let attTab = "today";
  let editingEmpId = null;       // local id للموظف محل التعديل (null = جديد)
  let attEditRow = null;         // السجل اللي مفتوح للتعديل اليدوي
  let attLastRep = null;         // آخر تقرير: {head:[], rows:[[]], title, period, filter}

  /* ---------- أدوات وقت صغيرة ---------- */
  function attParseHM(str) {                      // "09:30" → 570 دقيقة من منتصف اليوم
    var m = /^(\d{1,2}):(\d{2})/.exec(str || "");
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function attMinutesOf(iso) {                    // ISO → دقائق محلية من منتصف اليوم
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  function attHM(iso) {                           // ISO → "HH:MM" للعرض (أو —)
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function attLocalInput(iso) {                   // ISO → قيمة datetime-local
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function attHrs(min) {                          // دقائق → "7.50 س"
    return (Number(min) || 0) === 0 ? "0.00 س" : ((Number(min) || 0) / 60).toFixed(2) + " س";
  }
  function attMin(min) { return (Number(min) || 0) + " د"; }
  function attMonthStart() { return todayISO().slice(0, 8) + "01"; }
  function attMonthEnd() {
    var d = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.getFullYear() + "-" + p(last.getMonth() + 1) + "-" + p(last.getDate());
  }
  function attSettingsSafe() {
    if (!attSettings || !attSettings.workStart || !attSettings.workEnd) attSettings = defaultAttSettings();
    return attSettings;
  }
  function currentAttUser() {
    try {
      var p = (window.DATA && DATA.me && DATA.me());
      if (p && p.full_name) return p.full_name;
      if (window.DATA && DATA.email && DATA.email()) return DATA.email();
    } catch (e) { }
    return "—";
  }
  function attEmpById(id) {
    id = String(id);
    return employees.filter(function (e) { return String(e.id) === id; })[0] || null;
  }
  function attEmpName(id) {
    var e = attEmpById(id);
    return e ? (e.nameAr || e.code || ("#" + id)) : ("موظف #" + id);
  }
  function attDepartments() {
    var seen = {};
    employees.forEach(function (e) { if (e.department) seen[e.department] = 1; });
    return Object.keys(seen).sort();
  }
  function nextEmployeeLocalId() {
    return employees.reduce(function (m, e) { return Math.max(m, Number(e.id) || 0); }, 0) + 1;
  }
  function nextAttLocalId() {
    return attendance.reduce(function (m, a) { return Math.max(m, Number(a.id) || 0); }, 0) + 1;
  }
  function nextEmployeeCode() {
    var max = 0;
    employees.forEach(function (e) {
      var m = /^EMP-(\d+)$/.exec(e.code || "");
      if (m) max = Math.max(max, +m[1]);
    });
    return "EMP-" + String(max + 1).padStart(4, "0");
  }
  function findEmployeeByBadge(q) {
    q = String(q == null ? "" : q).trim();
    if (!q) return null;
    var hit = null;
    employees.forEach(function (e) {
      if (hit) return;
      if (String(e.badge || "").trim() === q || String(e.code || "").trim() === q || String(e.id) === q) hit = e;
    });
    return hit;
  }
  function attBadge(status) {
    var lbl = ATT_STATUSES[status] || status || "—";
    return '<span class="att-badge att-' + esc(status || "") + '">' + esc(lbl) + "</span>";
  }
  function attIsAttending(a) {
    return !!(a.checkIn) || a.status === "present" || a.status === "late" || a.status === "mission";
  }

  /* ---------- حسابات التأخير/الساعات/الإضافي من مدة العمل ---------- */
  function computeAttTimes(row) {
    var s = attSettingsSafe();
    var start = attParseHM(s.workStart), end = attParseHM(s.workEnd);
    var grace = Math.max(0, Number(s.graceMin) || 0);
    var lunch = Math.max(0, Number(s.lunchMin) || 0);
    var res = { lateMin: 0, earlyMin: 0, workMin: 0, otMin: 0 };
    var inM = row.checkIn ? attMinutesOf(row.checkIn) : null;
    var outM = row.checkOut ? attMinutesOf(row.checkOut) : null;
    if (inM != null) res.lateMin = Math.max(0, inM - (start + grace));
    if (inM != null && outM != null && outM > inM) {
      res.workMin = Math.max(0, (outM - inM) - lunch);
      res.earlyMin = Math.max(0, end - outM);
      var std = Math.max(0, (end - start) - lunch);
      res.otMin = Math.max(0, res.workMin - std);
    }
    return res;
  }
  function applyAttCalc(row) {
    var c = computeAttTimes(row);
    row.lateMin = c.lateMin; row.earlyMin = c.earlyMin; row.workMin = c.workMin; row.otMin = c.otMin;
    return row;
  }
  function recalcAllAttendance() {
    attendance.forEach(applyAttCalc);
    saveAttendance();
  }

  /* ---------- مصادرة سطر اليوم لموظف ---------- */
  function attTodayRow(employeeId) {
    var t = todayISO();
    return attendance.filter(function (a) {
      return String(a.employeeId) === String(employeeId) && a.date === t;
    })[0] || null;
  }

  /* ---------- تسجيل حضور / انصراف (الوقت من النظام تلقائيًا) ---------- */
  function resolvePunchEmp() {
    var badge = $("#txtPunchBadge").value;
    var e = findEmployeeByBadge(badge);
    if (!e && String(badge || "").trim()) {
      toast("معرّف غير موجود: «" + badge + "» — اختر الموظف من القائمة أو صحّح المعرّف", "error");
      return null;
    }
    if (!e) {
      var selId = $("#selPunchEmp").value;
      if (!selId) { toast("اختر الموظف أولًا أو امسح معرّفه", "error"); return null; }
      e = attEmpById(selId);
      if (!e) { toast("موظف غير موجود", "error"); return null; }
    }
    if (e.isActive === false) {
      toast("«" + (e.nameAr || e.code) + "» متوقف — شغّله من شاشة الموظفين أولًا", "error");
      return null;
    }
    return e;
  }
  function punchManualTime(which) {
    // وقت يدوي قبل التسجيل: مسموح ONLY لصاحب صلاحية التعديل (قاعدة المالك رقم ٢)
    if (!canEditAttendance()) return null;
    var el = document.getElementById(which === "in" ? "atManIn" : "atManOut");
    if (!el || el.disabled || !el.value) return null;
    var d = new Date(el.value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  function doPunch(kind) {
    if (!canManageAttendance()) { toast("صلاحية «الحضور والانصراف» غير مفعّلة لحسابك", "error"); return; }
    var emp = resolvePunchEmp();
    if (!emp) return;
    var row = attTodayRow(emp.id);
    var manual = punchManualTime(kind);
    var now = manual || new Date().toISOString();
    var auto = !manual;
    if (kind === "in") {
      if (row && row.checkIn) {
        toast("⏰ حضور «" + (emp.nameAr || emp.code) + "» مسجّل بالفعل الساعة " + attHM(row.checkIn) +
          (canEditAttendance() ? " — استخدم ✏️ التعديل اليدوي لو لزم" : ""), "info");
        return;
      }
      if (!row) {
        row = {
          id: nextAttLocalId(), employeeId: Number(emp.id), date: todayISO(),
          checkIn: now, checkOut: null, status: "present",
          lateMin: 0, earlyMin: 0, workMin: 0, otMin: 0,
          autoTimed: auto, note: "", userName: currentAttUser()
        };
        applyAttCalc(row);
        if (row.lateMin > 0) row.status = "late";
        attendance.push(row);
      } else {
        row.checkIn = now; row.autoTimed = auto; row.userName = currentAttUser();
        applyAttCalc(row);
        if (row.status === "absent") row.status = row.lateMin > 0 ? "late" : "present";
        else if (row.lateMin > 0 && row.status === "present") row.status = "late";
      }
      saveAttendance();
      addActivity("تسجيل حضور", (emp.nameAr || emp.code) + " — " + attHM(now) + (auto ? " (وقت النظام)" : " (يدوي)"));
      toast("🟢 تم تسجيل حضور «" + (emp.nameAr || emp.code) + "» الساعة " + attHM(now) +
        (row.lateMin > 0 ? " — متأخر " + row.lateMin + " دقيقة" : ""), "success");
    } else {
      if (!row || !row.checkIn) {
        toast("لا يوجد حضور مسجّل اليوم لـ«" + (emp.nameAr || emp.code) + "» — سجّل الحضور أولًا", "error");
        return;
      }
      if (row.checkOut) {
        toast("⏰ انصراف «" + (emp.nameAr || emp.code) + "» مسجّل بالفعل الساعة " + attHM(row.checkOut) +
          (canEditAttendance() ? " — استخدم ✏️ التعديل اليدوي لو لزم" : ""), "info");
        return;
      }
      var inMs = row.checkIn ? new Date(row.checkIn).getTime() : null;
      var outMs = new Date(now).getTime();
      if (inMs != null && outMs < inMs) {
        toast("وقت الانصراف (" + attHM(now) + ") قبل وقت الحضور (" + attHM(row.checkIn) + ") — صحّح الوقت أولًا", "error");
        return;
      }
      row.checkOut = now; row.autoTimed = auto; row.userName = currentAttUser();
      applyAttCalc(row);
      saveAttendance();
      addActivity("تسجيل انصراف", (emp.nameAr || emp.code) + " — " + attHM(now) + (auto ? " (وقت النظام)" : " (يدوي)"));
      toast("🔴 تم تسجيل انصراف «" + (emp.nameAr || emp.code) + "» — " + attHrs(row.workMin) +
        (row.otMin > 0 ? " (إضافي " + attMin(row.otMin) + ")" : "") +
        (row.earlyMin > 0 ? " — منصرف مبكرًا " + row.earlyMin + " دقيقة" : ""), "success");
    }
    $("#txtPunchBadge").value = "";
    $("#atManIn").value = ""; $("#atManOut").value = "";
    attRenderPunchToday(); attRenderToday();
  }

  /* ---------- التبويبات الداخلية ---------- */
  function attSwitchTab(tab) {
    attTab = tab;
    document.querySelectorAll("#attTabs .tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.att === tab);
    });
    var panes = { today: "attPaneToday", emp: "attPaneEmp", punch: "attPanePunch", ledger: "attPaneLedger", reports: "attPaneReports", set: "attPaneSet" };
    Object.keys(panes).forEach(function (k) {
      var el = document.getElementById(panes[k]);
      if (el) el.hidden = (k !== tab);
    });
    if (tab === "today") attRenderToday();
    if (tab === "emp") attRenderEmployees();
    if (tab === "punch") { attRenderPunchToday(); $("#txtPunchBadge").focus(); }
    if (tab === "ledger") attRenderLedger();
    if (tab === "set") attLoadSetForm();
  }

  /* ---------- لوحة اليوم ---------- */
  function attRenderToday() {
    var t = todayISO();
    var rows = attendance.filter(function (a) { return a.date === t; });
    var actives = employees.filter(function (e) { return e.isActive !== false; });
    var present = 0, late = 0, onSite = 0, attendingIds = {};
    rows.forEach(function (a) {
      if (attIsAttending(a)) { present++; attendingIds[String(a.employeeId)] = 1; }
      if (a.status === "late" || (Number(a.lateMin) || 0) > 0) late++;
      if (a.checkIn && !a.checkOut) onSite++;
    });
    var absent = 0;
    actives.forEach(function (e) { if (!attendingIds[String(e.id)]) absent++; });
    $("#attKPresent").textContent = present;
    $("#attKAbsent").textContent = absent;
    $("#attKLate").textContent = late;
    $("#attKOnSite").textContent = onSite;
    var tb = document.querySelector("#dgvAttToday tbody");
    var html = "";
    actives.slice().sort(function (x, y) { return String(x.nameAr || "").localeCompare(String(y.nameAr || ""), "ar"); })
      .forEach(function (e) {
        var a = rows.filter(function (r) { return String(r.employeeId) === String(e.id); })[0];
        html += "<tr><td>" + esc(e.nameAr || e.code) + "</td><td>" + esc(e.department || "—") + "</td>" +
          "<td>" + (a ? esc(attHM(a.checkIn)) : "—") + "</td>" +
          "<td>" + (a && a.checkOut ? esc(attHM(a.checkOut)) : (a && a.checkIn ? '<span class="att-now">موجود الآن</span>' : "—")) + "</td>" +
          "<td>" + (a && a.lateMin > 0 ? '<span class="att-late-n">' + a.lateMin + " د</span>" : "—") + "</td>" +
          "<td>" + (a ? attBadge(a.status) : '<span class="att-badge att-absent">لم يسجّل</span>') + "</td></tr>";
      });
    tb.innerHTML = html || '<tr><td colspan="6">لا يوجد موظفون نشطون — أضف موظفًا من تبويب «👥 الموظفون».</td></tr>';
  }

  /* ---------- الموظفون ---------- */
  function attRenderEmployees() {
    var q = normalizeAr($("#txtEmpSearch").value || "");
    var list = employees.filter(function (e) {
      if (!q) return true;
      return normalizeAr([e.nameAr, e.code, e.jobTitle, e.department, e.badge, e.phone].join(" ")).indexOf(q) >= 0;
    });
    list.sort(function (x, y) { return String(x.code || "").localeCompare(String(y.code || ""), "ar"); });
    var working = list.filter(function (e) { return e.isActive !== false; }).length;
    $("#empSummary").textContent = list.length + " موظف — يعمل " + working + " — متوقف " + (list.length - working);
    var tb = document.querySelector("#dgvEmployees tbody");
    tb.innerHTML = list.map(function (e) {
      return '<tr><td hidden>' + esc(e.id) + "</td><td>" + esc(e.code) + "</td><td>" + esc(e.nameAr) + "</td><td>" + esc(e.jobTitle || "—") +
        "</td><td>" + esc(e.department || "—") + "</td><td>" + esc(e.phone || "—") + "</td><td>" + esc(e.hireDate || "—") +
        "</td><td>" + esc(e.badge || "—") + "</td>" +
        "<td>" + (e.isActive !== false ? '<span class="att-now">يعمل</span>' : '<span class="att-stopped">متوقف</span>') + "</td>" +
        '<td><button class="btn gray sm" type="button" data-edit-emp="' + esc(e.id) + '">✏️ تعديل</button></td></tr>';
    }).join("") || '<tr><td colspan="10">لا يوجد موظفون — اضغط «➕ إضافة موظف».</td></tr>';
  }

  /* ---------- نافذة الموظف ---------- */
  function openEmpModal(emp) {
    if (!canManageAttendance()) { toast("صلاحية «الحضور والانصراف» غير مفعّلة لحسابك", "error"); return; }
    editingEmpId = emp ? Number(emp.id) : null;
    $("#mEmpAddEdit").hidden = false;
    document.getElementById("mEmpAddEditBox").querySelector("h3").textContent = emp ? "✏️ تعديل بيانات موظف" : "➕ إضافة موظف جديد";
    $("#fEmpCode").value = emp ? (emp.code || "") : nextEmployeeCode();
    $("#fEmpName").value = emp ? (emp.nameAr || "") : "";
    $("#fEmpJob").value = emp ? (emp.jobTitle || "") : "";
    $("#fEmpDept").value = emp ? (emp.department || "") : "";
    $("#fEmpPhone").value = emp ? (emp.phone || "") : "";
    $("#fEmpHire").value = emp ? (emp.hireDate || "") : "";
    $("#fEmpBadge").value = emp ? (emp.badge || "") : "";
    $("#fEmpActive").value = emp ? (emp.isActive !== false ? "1" : "0") : "1";
    $("#fEmpNotes").value = emp ? (emp.notes || "") : "";
    $("#btnEmpDelete").hidden = !emp;
    $("#btnEmpToggle").hidden = !emp;
    $("#btnEmpToggle").textContent = emp && emp.isActive === false ? "▶️ تشغيل الموظف" : "⏸ إيقاف الموظف";
    $("#fEmpName").focus();
  }
  function closeEmpModal() { $("#mEmpAddEdit").hidden = true; editingEmpId = null; }
  function saveEmpFromModal() {
    if (!canManageAttendance()) { toast("صلاحية «الحضور والانصراف» غير مفعّلة لحسابك", "error"); return; }
    var name = $("#fEmpName").value.trim(), code = $("#fEmpCode").value.trim();
    if (!name) { toast("اسم الموظف مطلوب", "error"); return; }
    if (!code) { code = nextEmployeeCode(); }
    var dup = employees.filter(function (e) { return String(e.code).trim() === code && String(e.id) !== String(editingEmpId); })[0];
    if (dup) { toast("كود «" + code + "» مستخدم بالفعل للموظف «" + dup.nameAr + "»", "error"); return; }
    var badge = $("#fEmpBadge").value.trim();
    if (badge) {
      var dupB = employees.filter(function (e) { return String(e.badge || "").trim() === badge && String(e.id) !== String(editingEmpId); })[0];
      if (dupB) { toast("معرّف الحضور «" + badge + "» مرتبط بالفعل بـ«" + dupB.nameAr + "»", "error"); return; }
    }
    var rec = {
      code: code, nameAr: name, jobTitle: $("#fEmpJob").value.trim(),
      department: $("#fEmpDept").value.trim(), phone: $("#fEmpPhone").value.trim(),
      hireDate: $("#fEmpHire").value, badge: badge,
      isActive: $("#fEmpActive").value !== "0", notes: $("#fEmpNotes").value.trim()
    };
    if (editingEmpId != null) {
      var e = attEmpById(editingEmpId);
      if (!e) { toast("لم يتم العثور على الموظف", "error"); return; }
      Object.keys(rec).forEach(function (k) { e[k] = rec[k]; });
      addActivity("تعديل موظف", name + " (" + code + ")");
      toast("✔ تم حفظ بيانات «" + name + "»", "success");
    } else {
      rec.id = nextEmployeeLocalId();
      employees.push(rec);
      addActivity("إضافة موظف", name + " (" + code + ")");
      toast("✔ تمت إضافة الموظف «" + name + "»", "success");
    }
    saveEmployees();
    closeEmpModal();
    attFillSelects(); attRenderEmployees(); attRenderToday();
  }
  function toggleEmpActive(id) {
    var e = attEmpById(id);
    if (!e) return;
    e.isActive = e.isActive === false;
    saveEmployees();
    addActivity(e.isActive ? "تشغيل موظف" : "إيقاف موظف", (e.nameAr || e.code));
    attFillSelects(); attRenderEmployees(); attRenderToday();
    toast(e.isActive ? "▶️ تم تشغيل «" + (e.nameAr || e.code) + "»" : "⏸ تم إيقاف «" + (e.nameAr || e.code) + "» — سجلاته محفوظة", "success");
  }
  function deleteEmpFromModal() {
    if (editingEmpId == null) return;
    var e = attEmpById(editingEmpId);
    if (!e) return;
    var hasRows = attendance.some(function (a) { return String(a.employeeId) === String(e.id); });
    if (hasRows) {
      toast("لا يمكن حذف «" + (e.nameAr || e.code) + "» لأنه له سجلات حضور — استخدم «⏸ إيقاف» للحفاظ على التاريخ", "error");
      return;
    }
    if (!confirm("هل أنت متأكد من حذف الموظف «" + (e.nameAr || e.code) + "» نهائيًا؟")) return;
    employees = employees.filter(function (x) { return String(x.id) !== String(e.id); });
    saveEmployees();
    addActivity("حذف موظف", (e.nameAr || e.code) + " (" + e.code + ")");
    toast("🗑 تم حذف الموظف «" + (e.nameAr || e.code) + "»", "success");
    closeEmpModal();
    attFillSelects(); attRenderEmployees(); attRenderToday();
  }

  /* ---------- تبويب التسجيل ---------- */
  function attRenderPunchToday() {
    var t = todayISO();
    var rows = attendance.filter(function (a) { return a.date === t; });
    rows.sort(function (x, y) { return String(attEmpName(x.employeeId)).localeCompare(String(attEmpName(y.employeeId)), "ar"); });
    var canEdit = canEditAttendance();
    var tb = document.querySelector("#dgvPunchToday tbody");
    tb.innerHTML = rows.map(function (a) {
      var act;
      if (!a.checkOut) act = '<button class="btn red sm" type="button" data-punch-out="' + esc(a.employeeId) + '">🔴 انصراف</button> ';
      else act = "";
      if (canEdit) act += '<button class="btn gray sm" type="button" data-edit-att="' + esc(a.id) + '">✏️ تعديل</button>';
      return "<tr><td>" + esc(attEmpName(a.employeeId)) + "</td><td>" + esc(attHM(a.checkIn)) + "</td><td>" + esc(attHM(a.checkOut)) + "</td>" +
        "<td>" + (a.lateMin > 0 ? '<span class="att-late-n">' + a.lateMin + " د</span>" : "—") + "</td>" +
        "<td>" + esc(attHrs(a.workMin)) + "</td><td>" + attBadge(a.status) + "</td><td>" + act + "</td></tr>";
    }).join("") || '<tr><td colspan="7">لم تُسجَّل أي عمليات اليوم.</td></tr>';
    // حقل الوقت اليدوي يظهر فقط لصاحب صلاحية التعديل
    var man = canEdit && $("#atManIn") && !$("#atManIn").disabled;
    if (!man) {
      $("#atManIn").disabled = !canEdit; $("#atManOut").disabled = !canEdit;
      $("#atManHint").textContent = canEdit
        ? "اختر موظفًا ثم (اختياري) اكتب وقتًا يدويًا قبل الضغط على التسجيل"
        : "التسجيل تلقائي من وقت النظام — التعديل اليدوي يحتاج صلاحية «تعديل سجلات الحضور»";
    }
  }

  /* ---------- سجل الحضور ---------- */
  function attLedgerRows() {
    var empId = $("#selLedEmp").value, dept = $("#selLedDept").value;
    var from = $("#dtpLedFrom").value, to = $("#dtpLedTo").value;
    var st = $("#selLedStatus").value;
    var q = normalizeAr($("#txtLedSearch").value || "");
    var list = attendance.filter(function (a) {
      var e = attEmpById(a.employeeId);
      if (empId && String(a.employeeId) !== empId) return false;
      if (dept && (!e || (e.department || "") !== dept)) return false;
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      if (st && a.status !== st) return false;
      if (q) {
        var hay = normalizeAr((e ? [e.nameAr, e.code, e.department].join(" ") : "") + " " +
          a.date + " " + (ATT_STATUSES[a.status] || a.status) + " " + (a.note || ""));
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    list.sort(function (x, y) {
      if (x.date !== y.date) return x.date < y.date ? 1 : -1;
      return String(attEmpName(x.employeeId)).localeCompare(String(attEmpName(y.employeeId)), "ar");
    });
    return list;
  }
  function attRenderLedger() {
    var list = attLedgerRows();
    var canEdit = canEditAttendance();
    $("#ledSummary").textContent = list.length + " سجل — " +
      list.filter(function (a) { return a.status === "absent"; }).length + " غياب، " +
      list.filter(function (a) { return (Number(a.lateMin) || 0) > 0; }).length + " تأخير";
    var tb = document.querySelector("#dgvLedger tbody");
    tb.innerHTML = list.map(function (a) {
      var e = attEmpById(a.employeeId);
      return '<tr><td hidden>' + esc(a.id) + "</td><td>" + esc(attEmpName(a.employeeId)) + "</td><td>" + esc(e ? (e.department || "—") : "—") + "</td>" +
        "<td>" + esc(a.date) + "</td><td>" + esc(attHM(a.checkIn)) + "</td><td>" + esc(attHM(a.checkOut)) + "</td>" +
        "<td>" + (a.lateMin > 0 ? '<span class="att-late-n">' + a.lateMin + " د</span>" : "—") + "</td>" +
        "<td>" + esc(attHrs(a.workMin)) + "</td>" +
        "<td>" + (a.otMin > 0 ? '<span class="att-ot">' + esc(attMin(a.otMin)) + "</span>" : "—") + "</td>" +
        "<td>" + attBadge(a.status) + "</td>" +
        "<td>" + (canEdit ? '<button class="btn gray sm" type="button" data-edit-att="' + esc(a.id) + '">✏️</button>' : "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="11">لا توجد سجلات مطابقة للفلاتر الحالية.</td></tr>';
  }
  function exportLedgerCsv() {
    var list = attLedgerRows();
    var rows = [["التاريخ", "الموظف", "القسم", "الحضور", "الانصراف", "التأخير (د)", "ساعات العمل", "الإضافي (د)", "الحالة", "ملاحظة"]];
    list.forEach(function (a) {
      var e = attEmpById(a.employeeId);
      rows.push([a.date, attEmpName(a.employeeId), e ? (e.department || "") : "", attHM(a.checkIn), attHM(a.checkOut),
      a.lateMin || 0, (Number(a.workMin) || 0) / 60 === 0 ? "0.00" : ((a.workMin) / 60).toFixed(2),
      a.otMin || 0, ATT_STATUSES[a.status] || a.status, a.note || ""]);
    });
    downloadCSV("سجل-الحضور-" + todayISO() + ".csv", rows);
    toast("📥 تم تصدير " + list.length + " سجلًا إلى Excel (CSV)", "success");
  }
  function printLedger() {
    var list = attLedgerRows();
    attFillPrintPage(
      ["التاريخ", "الموظف", "القسم", "الحضور", "الانصراف", "التأخير", "ساعات العمل", "الإضافي", "الحالة"],
      list.map(function (a) {
        var e = attEmpById(a.employeeId);
        return [a.date, attEmpName(a.employeeId), e ? (e.department || "—") : "—", attHM(a.checkIn), attHM(a.checkOut),
        a.lateMin > 0 ? a.lateMin + " د" : "—", attHrs(a.workMin), a.otMin > 0 ? attMin(a.otMin) : "—",
        ATT_STATUSES[a.status] || a.status];
      }),
      "📋 سجل الحضور",
      ($("#dtpLedFrom").value || "البداية") + " إلى " + ($("#dtpLedTo").value || todayISO()),
      "فلترة: " +
      ($("#selLedEmp").value ? "موظف=" + attEmpName($("#selLedEmp").value) + " " : "") +
      ($("#selLedDept").value ? "قسم=" + $("#selLedDept").value + " " : "") +
      ($("#selLedStatus").value ? "حالة=" + (ATT_STATUSES[$("#selLedStatus").value] || "") : "")
    );
  }

  /* ---------- صفحة الطباعة ---------- */
  function attFillPrintPage(head, rows, title, period, filter) {
    document.getElementById("arpOrgName").textContent = invOrgName();
    document.getElementById("arpTitle").textContent = title;
    document.getElementById("arpPeriod").textContent = period || "—";
    document.getElementById("arpFilter").textContent = filter || "";
    document.getElementById("arpHead").innerHTML = head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    document.getElementById("arpBody").innerHTML = rows.map(function (r) {
      return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
    }).join("") || '<tr><td colspan="' + head.length + '">لا توجد بيانات للتقرير.</td></tr>';
    document.getElementById("arpFoot").innerHTML = "عدد السطور: <b>" + rows.length +
      "</b> — تاريخ الطباعة: " + todayISO();
    printSection(document.getElementById("attReportPage"));
  }

  /* ---------- التقارير ---------- */
  function attReportHead(type) {
    if (type === "hours") return ["الموظف", "القسم", "أيام الحضور", "إجمالي ساعات العمل", "متوسط الساعات اليومية"];
    if (type === "ot") return ["الموظف", "القسم", "أيام فيها إضافي", "إجمالي الإضافي (دقائق)", "إجمالي الإضافي (ساعات)"];
    if (type === "monthly") return ["الموظف", "القسم", "أيام حضور", "أيام غياب", "إجمالي التأخير (د)", "إجمالي الانصراف المبكر (د)", "إجمالي ساعات العمل", "إجمالي الإضافي (س)"];
    return ["التاريخ", "الموظف", "القسم", "الحضور", "الانصراف", "التأخير", "الانصراف المبكر", "ساعات العمل", "الإضافي", "الحالة", "ملاحظة"];
  }
  function attDetailRow(a) {
    var e = attEmpById(a.employeeId);
    return [a.date, attEmpName(a.employeeId), e ? (e.department || "—") : "—", attHM(a.checkIn), attHM(a.checkOut),
    a.lateMin > 0 ? a.lateMin + " د" : "—", a.earlyMin > 0 ? a.earlyMin + " د" : "—",
    attHrs(a.workMin), a.otMin > 0 ? attMin(a.otMin) : "—", ATT_STATUSES[a.status] || a.status, a.note || ""];
  }
  function attInRange(from, to, empId, dept) {
    return attendance.filter(function (a) {
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      var e = attEmpById(a.employeeId);
      if (empId && String(a.employeeId) !== empId) return false;
      if (dept && (!e || (e.department || "") !== dept)) return false;
      return true;
    });
  }
  function attAggByEmp(list) {
    var by = {};
    list.forEach(function (a) {
      var k = String(a.employeeId);
      if (!by[k]) by[k] = { present: 0, absent: 0, lateMin: 0, earlyMin: 0, workMin: 0, otMin: 0, otDays: 0 };
      var g = by[k];
      if (attIsAttending(a)) g.present++;
      if (a.status === "absent") g.absent++;
      g.lateMin += Number(a.lateMin) || 0;
      g.earlyMin += Number(a.earlyMin) || 0;
      g.workMin += Number(a.workMin) || 0;
      g.otMin += Number(a.otMin) || 0;
      if ((Number(a.otMin) || 0) > 0) g.otDays++;
    });
    return by;
  }
  function attRunReport() {
    var type = $("#selAttRepType").value;
    var from = $("#dtpAttRepFrom").value, to = $("#dtpAttRepTo").value;
    var empId = $("#selAttRepEmp").value, dept = $("#selAttRepDept").value;
    if (!from || !to) { toast("حدد الفترة (من / إلى) أولًا", "error"); return; }
    if (from > to) { toast("تاريخ «من» أكبر من «إلى»", "error"); return; }
    if (type === "emp" && !empId) { toast("اختر الموظف أولًا لتقرير موظف خلال فترة", "error"); return; }
    var list = attInRange(from, to, empId, dept);
    var head = attReportHead(type), rows = [], summary = "", title = "";
    if (type === "emp") {
      title = "تقرير حضور: " + attEmpName(empId);
      rows = list.map(attDetailRow);
      summary = rows.length + " يومًا مسجلًا";
    } else if (type === "all") {
      title = "تقرير حضور جميع الموظفين";
      rows = list.map(attDetailRow);
      summary = rows.length + " سجل";
    } else if (type === "absent") {
      title = "تقرير الغياب";
      rows = list.filter(function (a) { return a.status === "absent"; }).map(attDetailRow);
      summary = rows.length + " يوم غياب";
    } else if (type === "late") {
      title = "تقرير التأخير";
      rows = list.filter(function (a) { return (Number(a.lateMin) || 0) > 0 || a.status === "late"; }).map(attDetailRow);
      summary = rows.length + " حالة تأخير — " +
        rows.reduce(function (s, r) { return s + (parseInt(r[5], 10) || 0); }, 0) + " دقيقة إجمالًا";
    } else if (type === "early") {
      title = "تقرير الانصراف المبكر";
      rows = list.filter(function (a) { return (Number(a.earlyMin) || 0) > 0; }).map(attDetailRow);
      summary = rows.length + " حالة انصراف مبكر";
    } else if (type === "hours") {
      title = "تقرير ساعات العمل";
      var byH = attAggByEmp(list);
      rows = Object.keys(byH).map(function (k) {
        var e = attEmpById(k), g = byH[k];
        return [attEmpName(k), e ? (e.department || "—") : "—", g.present, attHrs(g.workMin),
        g.present ? attHrs(Math.round(g.workMin / g.present)) : "—"];
      });
      summary = rows.length + " موظف";
    } else if (type === "ot") {
      title = "تقرير العمل الإضافي";
      var byO = attAggByEmp(list.filter(function (a) { return (Number(a.otMin) || 0) > 0; }));
      rows = Object.keys(byO).map(function (k) {
        var e = attEmpById(k), g = byO[k];
        return [attEmpName(k), e ? (e.department || "—") : "—", g.otDays, g.otMin, ((g.otMin) / 60).toFixed(2)];
      });
      summary = rows.length + " موظف لديهم إضافي — " +
        rows.reduce(function (s, r) { return s + (Number(r[3]) || 0); }, 0) + " دقيقة إجمالًا";
    } else if (type === "monthly") {
      title = "التقرير الشهري لكل موظف (للمرتبات)";
      var byM = attAggByEmp(list);
      rows = Object.keys(byM).map(function (k) {
        var e = attEmpById(k), g = byM[k];
        return [attEmpName(k), e ? (e.department || "—") : "—", g.present, g.absent, g.lateMin,
        g.earlyMin, attHrs(g.workMin), ((g.otMin) / 60).toFixed(2)];
      });
      rows.sort(function (x, y) { return String(x[0]).localeCompare(String(y[0]), "ar"); });
      summary = rows.length + " موظف — الفترة: " + from + " إلى " + to;
    }
    if (dept) title += " — قسم: " + dept;
    attLastRep = { head: head, rows: rows, title: title, period: from + " → " + to, summary: summary };
    $("#attRepTitle").textContent = "📈 " + title;
    $("#attRepSummary").textContent = summary + " (" + rows.length + " سطر)";
    document.getElementById("attRepHead").innerHTML = head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    document.querySelector("#dgvAttReport tbody").innerHTML = rows.map(function (r) {
      return "<tr>" + r.map(function (c, i) {
        if (i === head.length - 1 && type !== "emp") return "<td>" + esc(c) + "</td>";
        return "<td>" + esc(c) + "</td>";
      }).join("") + "</tr>";
    }).join("") || '<tr><td colspan="' + head.length + '">لا توجد بيانات في هذه الفترة/الفلاتر.</td></tr>';
  }
  function attExportRepCsv() {
    if (!attLastRep) { toast("اعرض التقرير أولًا ثم صدّره", "error"); return; }
    downloadCSV(attLastRep.title.replace(/[^\u0600-\u06FF0-9 ]+/g, "").trim().replace(/ /g, "-") + "-" + todayISO() + ".csv",
      [attLastRep.head].concat(attLastRep.rows));
    toast("📥 تم تصدير التقرير إلى Excel (CSV)", "success");
  }
  function attPrintRep() {
    if (!attLastRep) { toast("اعرض التقرير أولًا ثم اطبعه", "error"); return; }
    attFillPrintPage(attLastRep.head, attLastRep.rows, "📈 " + attLastRep.title,
      attLastRep.period, "نوع: " + $("#selAttRepType").selectedOptions[0].textContent +
      ($("#selAttRepEmp").value ? " — موظف: " + attEmpName($("#selAttRepEmp").value) : "") +
      ($("#selAttRepDept").value ? " — قسم: " + $("#selAttRepDept").value : ""));
  }

  /* ---------- مدة العمل ---------- */
  function attLoadSetForm() {
    var s = attSettingsSafe();
    $("#atWorkStart").value = s.workStart;
    $("#atWorkEnd").value = s.workEnd;
    $("#atGrace").value = s.graceMin;
    $("#atLunch").value = s.lunchMin;
    attUpdateFormula();
  }
  function attUpdateFormula() {
    var s = attSettingsSafe();
    var std = Math.max(0, attParseHM(s.workEnd) - attParseHM(s.workStart) - (Number(s.lunchMin) || 0));
    $("#attSetFormula").textContent =
      "اليوم الرسمي = " + (std / 60).toFixed(2) + " س | التأخير بعد " + s.workStart + " + " + s.graceMin + " د سماح";
  }
  function attSaveSetForm() {
    if (!canManageAttendance()) { toast("صلاحية «الحضور والانصراف» غير مفعّلة لحسابك", "error"); return; }
    var ws = $("#atWorkStart").value, we = $("#atWorkEnd").value;
    var gr = Math.max(0, Math.round(Number($("#atGrace").value) || 0));
    var lc = Math.max(0, Math.round(Number($("#atLunch").value) || 0));
    if (!ws || !we) { toast("حدد بداية العمل ونهايته أولًا", "error"); return; }
    if (attParseHM(we) <= attParseHM(ws)) { toast("نهاية العمل يجب أن تكون بعد بداية العمل", "error"); return; }
    attSettings = { id: (attSettings && attSettings.id) || 1, workStart: ws, workEnd: we, graceMin: gr, lunchMin: lc };
    saveAttSettings();
    recalcAllAttendance();     // كل السجلات تعاد حساباتها بالمدة الجديدة
    attUpdateFormula();
    addActivity("مدة العمل", ws + " → " + we + " | سماح " + gr + " د | فاصل " + lc + " د");
    toast("✔ تم حفظ مدة العمل وإعادة حساب جميع السجلات", "success");
    if (attTab === "today" || attTab === "ledger") attRenderToday();
  }

  /* ---------- التعديل اليدوي المسجَّل (mizan_att_edit) ---------- */
  function openAttEdit(attId) {
    if (!canEditAttendance()) { toast("التعديل اليدوي يحتاج صلاحية «✏️ تعديل سجلات الحضور يدويًا»", "error"); return; }
    var a = attendance.filter(function (x) { return String(x.id) === String(attId); })[0];
    if (!a) { toast("سجل غير موجود", "error"); return; }
    attEditRow = a;
    $("#mAttEdit").hidden = false;
    $("#aeEmp").value = attEmpName(a.employeeId);
    $("#aeDate").value = a.date;
    $("#aeIn").value = attLocalInput(a.checkIn);
    $("#aeOut").value = attLocalInput(a.checkOut);
    $("#aeStatus").innerHTML = Object.keys(ATT_STATUSES).map(function (k) {
      return '<option value="' + k + '"' + (k === a.status ? " selected" : "") + ">" + ATT_STATUSES[k] + "</option>";
    }).join("");
    $("#aeNote").value = a.note || "";
    $("#aeReason").value = "";
    $("#aeIn").focus();
  }
  function closeAttEdit() { $("#mAttEdit").hidden = true; attEditRow = null; }
  function saveAttEdit() {
    if (!attEditRow) return;
    if (!canEditAttendance()) { toast("لا تملك صلاحية التعديل اليدوي", "error"); return; }
    var reason = $("#aeReason").value.trim();
    if (!reason) { toast("سبب التعديل مطلوب — يُحفظ مع القديم والجديد في سجل العمليات", "error"); return; }
    var inVal = $("#aeIn").value ? new Date($("#aeIn").value) : null;
    var outVal = $("#aeOut").value ? new Date($("#aeOut").value) : null;
    if (inVal && isNaN(inVal.getTime())) { toast("وقت الحضور غير صحيح", "error"); return; }
    if (outVal && isNaN(outVal.getTime())) { toast("وقت الانصراف غير صحيح", "error"); return; }
    if (inVal && outVal && outVal < inVal) { toast("الانصراف لا يصح أن يسبق الحضور", "error"); return; }
    if (!(window.DATA && DATA.isOnline && DATA.isOnline() && DATA.client && DATA.client())) {
      toast("التعديل اليدوي يُنفَّذ على السحابة ويسجل في سجل العمليات — يحتاج اتصالًا بالإنترنت. التسجيل اليومي التلقائي لا يتأثر.", "info");
      return;
    }
    var a = attEditRow;
    var draft = {
      checkIn: inVal ? inVal.toISOString() : a.checkIn,
      checkOut: outVal ? outVal.toISOString() : a.checkOut
    };
    var calc = computeAttTimes(draft);
    var status = $("#aeStatus").value;
    var note = $("#aeNote").value.trim();
    var btn = $("#btnAttEditSave");
    btn.disabled = true;
    DATA.client().rpc("mizan_att_edit", {
      p_id: (window.CLOUD && CLOUD.detUuid) ? CLOUD.detUuid("attendance", a.id) : null,
      p_check_in: draft.checkIn || null,
      p_check_out: draft.checkOut || null,
      p_status: status,
      p_note: note || null,
      p_late_min: calc.lateMin,
      p_early_min: calc.earlyMin,
      p_work_min: calc.workMin,
      p_ot_min: calc.otMin,
      p_reason: reason
    }).then(function (r) {
      btn.disabled = false;
      if (r && r.error) {
        var msg = String(r.error.message || "");
        if (/permit|غير مصرح/i.test(msg)) toast("لا تملك صلاحية التعديل على السحابة — راجع صاحب الشركة", "error");
        else if (/غير موجود/i.test(msg)) toast("هذا السجل لم يصل للسحابة بعد — انتظر المزامنة ثم أعد المحاولة", "error");
        else toast("تعذّر الحفظ: " + (msg || "حاول مرة أخرى"), "error");
        return;
      }
      // نجح على السحابة → الحديث المحلي يطابقها
      a.checkIn = draft.checkIn; a.checkOut = draft.checkOut;
      a.status = status; a.note = note;
      a.lateMin = calc.lateMin; a.earlyMin = calc.earlyMin; a.workMin = calc.workMin; a.otMin = calc.otMin;
      a.autoTimed = false; a.userName = currentAttUser();
      saveAttendance();
      addActivity("تعديل سجل حضور", attEmpName(a.employeeId) + " " + a.date + " — السبب: " + reason);
      closeAttEdit();
      attRenderLedger(); attRenderToday(); attRenderPunchToday();
      toast("✔ تم الحفظ — والسجل دُوُّن في سجل العمليات (القديم والجديد والسبب)", "success");
    }).catch(function (err) {
      btn.disabled = false;
      toast("تعذّر الوصول للسحابة: " + ((err && err.message) || "تحقق من الاتصال"), "error");
    });
  }

  /* ---------- تعبئة القوائم ---------- */
  function attFillSelects() {
    var emps = employees.slice().sort(function (x, y) { return String(x.nameAr || "").localeCompare(String(y.nameAr || ""), "ar"); });
    [["selPunchEmp", false], ["selLedEmp", true], ["selAttRepEmp", true]].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var cur = el.value;
      el.innerHTML = (pair[1] ? '<option value="">الكل</option>' : '<option value="">— اختر —</option>') +
        emps.map(function (e) {
          return '<option value="' + esc(e.id) + '">' + esc((e.nameAr || e.code) + (e.isActive === false ? " (متوقف)" : "")) + "</option>";
        }).join("");
      el.value = cur;
      if (el.value !== cur) el.value = pair[1] ? "" : "";
    });
    var depts = attDepartments();
    [["selLedDept"], ["selAttRepDept"]].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var cur = el.value;
      el.innerHTML = '<option value="">الكل</option>' + depts.map(function (d) {
        return '<option value="' + esc(d) + '">' + esc(d) + "</option>";
      }).join("");
      el.value = cur;
    });
    var dl = document.getElementById("attDeptList");
    if (dl) dl.innerHTML = depts.map(function (d) { return '<option value="' + esc(d) + '"></option>'; }).join("");
    var ls = document.getElementById("selLedStatus");
    if (ls) {
      var curS = ls.value;
      ls.innerHTML = '<option value="">كل الحالات</option>' + Object.keys(ATT_STATUSES).map(function (k) {
        return '<option value="' + k + '">' + ATT_STATUSES[k] + "</option>";
      }).join("");
      ls.value = curS;
    }
  }

  /* ---------- الربط والأول ---------- */
  function attBindOnce() {
    if (attBound) return;
    attBound = true;
    $("#attTabs").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-att]");
      if (b) attSwitchTab(b.dataset.att);
    });
    $("#btnAddEmp").addEventListener("click", function () { openEmpModal(null); });
    $("#btnGoPunch").addEventListener("click", function () { attSwitchTab("punch"); });
    $("#txtEmpSearch").addEventListener("input", attRenderEmployees);
    $("#btnEmpCancel").addEventListener("click", closeEmpModal);
    $("#btnEmpSave").addEventListener("click", saveEmpFromModal);
    $("#btnEmpDelete").addEventListener("click", deleteEmpFromModal);
    $("#btnEmpToggle").addEventListener("click", function () {
      if (editingEmpId != null) toggleEmpActive(editingEmpId);
    });
    $("#btnPunchIn").addEventListener("click", function () { doPunch("in"); });
    $("#btnPunchOut").addEventListener("click", function () { doPunch("out"); });
    $("#txtPunchBadge").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); doPunch("in"); }   // سكنر الباركود يضغط Enter بعد المسح
    });
    // جدول الموظفيون + جداول السجل: تفويض أزرار التعديل
    document.getElementById("viewAttendance").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-edit-emp]");
      if (b) { openEmpModal(attEmpById(b.dataset.editEmp)); return; }
      b = ev.target.closest("[data-edit-att]");
      if (b) { openAttEdit(b.dataset.editAtt); return; }
      b = ev.target.closest("[data-punch-out]");
      if (b) {
        var emp = attEmpById(b.dataset.punchOut);
        if (emp) { $("#selPunchEmp").value = String(emp.id); $("#txtPunchBadge").value = ""; doPunch("out"); }
      }
    });
    ["selLedEmp", "selLedDept", "dtpLedFrom", "dtpLedTo", "selLedStatus"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", attRenderLedger);
    });
    $("#txtLedSearch").addEventListener("input", attRenderLedger);
    $("#btnLedCsv").addEventListener("click", exportLedgerCsv);
    $("#btnLedPrint").addEventListener("click", printLedger);
    $("#btnRunAttRep").addEventListener("click", attRunReport);
    $("#btnAttRepCsv").addEventListener("click", attExportRepCsv);
    $("#btnAttRepPrint").addEventListener("click", attPrintRep);
    $("#btnSaveAttSet").addEventListener("click", attSaveSetForm);
    $("#btnAttEditCancel").addEventListener("click", closeAttEdit);
    $("#btnAttEditSave").addEventListener("click", saveAttEdit);
  }

  function renderAttendanceView() {
    attSettingsSafe();
    attBindOnce();
    attFillSelects();
    // تواريخ افتراضية مريحة: السجل والتقارير من أول الشهر إلى اليوم (والشهري لآخر الشهر)
    if (!$("#dtpLedFrom").value) $("#dtpLedFrom").value = attMonthStart();
    if (!$("#dtpLedTo").value) $("#dtpLedTo").value = todayISO();
    if (!$("#dtpAttRepFrom").value) $("#dtpAttRepFrom").value = attMonthStart();
    if (!$("#dtpAttRepTo").value) $("#dtpAttRepTo").value = attMonthEnd();
    var canEdit = canEditAttendance();
    $("#atManIn").disabled = !canEdit;
    $("#atManOut").disabled = !canEdit;
    attSwitchTab(attTab);
    attRenderToday();
  }

  /* ══════════════════════════════════════════════════════════════════════
     💬 الدردشة الداخلية (بناء 125 — بند 16)

     القاعدة الحاكمة: **البوابة على السحابة (RLS)** والكود ده واجهة بس.
       · «محدش يشوف رسايل مش مبعوته له» و«محدش يشوف عضوات شركة مش شركته»
         و«عادل مش ظاهر للموظفين» = سياسة SELECT على messages + دالة
         public.mizan_chat_peer (ترقية ٤٥). لو حد عدّل الكود ده في الكونسول
         الشبكة نفسها ما ترجّعش حاجة ملكوش — فمفيش هنا أي «فلترة خصوصية»
         بتتعمل يدويًا وممكن تنسي (كانت هتبقى أمان كاذب).
       · مافيش أي تخزين للرسايل: لا localStorage ولا لقطة ديسك ولا نسخة
         احتياطية (طلب المالك: «الدردشة لا تدخل النسخ الاحتياطي»). كل حاجة
         بتعيش في CHAT في الذاكرة وبتتمسح عند الخروج/تبديل الشركة.
       · مافيش Realtime: قياس 02/10 = صفر جدول في publication
         supabase_realtime ⇒ polling كل ١٢ ثانية **وقت ما الشاشة مفتوحة بس**،
         وبيقطع أول ما تقفل أو تخرج أو تبدّل شركة.
       · أي زعلة غير «الجدول مش موجود» بتظهر بلغة ودّية بلا تشخيص تقني
         (درس build 108: صمت الفشل ممنوع — وخوف العميل ممنوع).
     ══════════════════════════════════════════════════════════════════════ */
  var CHAT = {
    bound: false,          // أربطة الأحداث تُعمل مرة واحدة عند أول فتح
    peers: [],             // المخاطَبون: السحابة هي اللي قرّرت مين فيهم
    peerId: null,          // المحادثة المفتوحة دلوقتي
    msgs: [],              // رسايل المحادثة المفتوحة (ذاكرة فقط)
    unread: {},            // peerId -> عدد الرسايل الجديدة
    timer: null,           // الـ polling
    filter: "",            // بحث بالاسم
    busy: false,           // نداء حيّ — يمنع التراكب
    scopeOverride: null    // سويتش المالك بعد ما يتحفظ (قبل ما الصفحة تتحدّث)
  };
  var CHAT_POLL_MS = 12000;
  var CHAT_MSG_LIMIT = 200;

  /* 🟢 بناء 136 — الوصول اللحظي (ترقية ٤٧ + ٤٨ اتنفذوا على السحابة)
   * · الاشتراك بيتعمل بصيغة **فلتر صريح** (الوسيط التاني في `on` دايمًا هو الفلتر —
   *   `.on(type, cb)` بترمي CHANNEL_ERROR من العميل نفسه، متقاس على السلك 04/10).
   * · RLS لسه البوابة الوحيدة: اللي بيوصلني = اللي أنا فيه `to_user` أو `from_user` بس.
   * · الـ polling (١٢ث) والعدّاد (٣٠ث) **ما اتلغوش**: اللحظي بضاف سرعة، مش أمان.
   *   لو websocket ما اتقبّلش (نت ضعيف/بروكسي) الشاشة تشتغل زي ما كانت بالظبط.
   * · 🔊 الصوت: WebAudio بنغمة عالية (مافيش ملف صوت يتنزّل) + المستخدم يختار النغمة.
   *   المفتاح المختار بيتحفظ على الجهاز **كمعرّف فقط** — ممنوع أي نص رسالة يدخل localStorage. */
  var CHAT_SOUNDS = [
    ["ping", "🔔 نغمة عالية"], ["double", "🔔🔔 تنبيه مزدوج"], ["bell", "🛎 جرس"],
    ["siren", "🚨 صافرة"], ["off", "🔕 من غير صوت"]
  ];
  var CHAT_SOUND_KEY = "mizan_chat_sound_v1";
  var CHAT_RT = { status: "off", bound: false };
  var CHAT_seenIds = Object.create(null);

  function chatSoundId() {
    var v = "";
    try { v = String(localStorage.getItem(CHAT_SOUND_KEY) || ""); } catch (e) { v = ""; }
    for (var i = 0; i < CHAT_SOUNDS.length; i++) if (CHAT_SOUNDS[i][0] === v) return v;
    return "ping";                       // الافتراضي: عالي وواضح (طلب المالك «صوت عالى»)
  }
  function chatSetSoundId(v) {
    try { localStorage.setItem(CHAT_SOUND_KEY, String(v || "ping")); } catch (e) { }
  }

  // AudioContext بيتعمل lazily ومفتوح بأول لمسة مستخدم (سياسة المتصفحات: مافيش صوت قبل تفاعل)
  var CHAT_ac = null;
  function chatAudioCtx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!CHAT_ac) CHAT_ac = new AC();
      if (CHAT_ac.state === "suspended" && CHAT_ac.resume) { try { CHAT_ac.resume(); } catch (e) { } }
      return CHAT_ac;
    } catch (e) { return null; }
  }
  function chatUnblockAudio() {
    if (typeof window.addEventListener !== "function") return;
    var go = function () {
      chatAudioCtx();
      try { window.removeEventListener("pointerdown", go, true); } catch (e) { }
      try { window.removeEventListener("keydown", go, true); } catch (e) { }
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
  }
  chatUnblockAudio();

  function chatTone(ctx, t0, freq, dur, peak, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.28, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function playChatSound(which) {
    var w = which || chatSoundId();
    if (w === "off") return false;
    var ctx = chatAudioCtx();
    if (!ctx) return false;
    try {
      var t = ctx.currentTime + 0.01;
      if (w === "double") { chatTone(ctx, t, 880, 0.16, 0.30); chatTone(ctx, t + 0.22, 1174, 0.22, 0.30); }
      else if (w === "bell") {
        chatTone(ctx, t, 988, 0.5, 0.26, "triangle"); chatTone(ctx, t + 0.06, 1319, 0.45, 0.18, "triangle");
      }
      else if (w === "siren") {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(660, t);
        o.frequency.linearRampToValueAtTime(1180, t + 0.35);
        o.frequency.linearRampToValueAtTime(660, t + 0.7);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.85);
      }
      else { chatTone(ctx, t, 1046, 0.18, 0.30); chatTone(ctx, t + 0.05, 1318, 0.3, 0.26); }  // ping
      return true;
    } catch (e) { return false; }
  }

  // حالة اللحظي تُعرض ودّيًا في الشاشة (ومش أي مصطلح تقني)
  function chatLiveText() {
    if (CHAT_RT.status === "subscribed" || CHAT_RT.status === "SUBSCRIBED") return "🟢 الرسائل توصلك فور ما تجي";
    if (CHAT_RT.status === "opening" || CHAT_RT.status === "OPENING" || CHAT_RT.status === "closed-wait") return "🟠 بيتصل…";
    return "🕐 الرسائل بتتحدّث كل شوية";
  }
  function chatPaintLive() {
    var el = $("#chatLiveDot");
    if (el) { el.textContent = chatLiveText(); el.className = "wa-live " +
      ((/^sub/i.test(String(CHAT_RT.status))) ? "on" : /^open/i.test(String(CHAT_RT.status)) ? "wait" : "off"); }
  }

  function chatSeenHas(id) { return !!CHAT_seenIds[String(id)]; }
  function chatSeenAdd(id) {
    if (!id) return;
    CHAT_seenIds[String(id)] = 1;
    var k = Object.keys(CHAT_seenIds);
    if (k.length > 800) { k.slice(0, 400).forEach(function (x) { delete CHAT_seenIds[x]; }); }
  }
  function chatSeenReset() { CHAT_seenIds = Object.create(null); }

  /* سطر وصل لحظيًا. الخصوصية محصّلة **كمان** هنا رغم إن السحابة مفلتراة:
   * لو أي سطر مش ليا (مش منّي ولا إلي) بيتجاهل تمامًا — ولا صوت ولا رسم. */
  function chatOnRealtimeRow(row) {
    if (!row) return;
    var me = String(chatMyId() || "");
    var from = String(row.from_user || ""), to = String(row.to_user || "");
    if (!me || (to !== me && from !== me)) return;
    var dup = chatSeenHas(row.id);
    chatSeenAdd(row.id);
    var already = (CHAT.msgs || []).some(function (m) { return String(m.id) === String(row.id); });
    if (to === me) {
      if (!dup) playChatSound();                       // تنبيه مرة واحدة لكل رسالة واردة فعلية
      if (!dup || !already) {
        var v = $("#viewChat");
        var openHere = v && !v.hidden;
        if (openHere && CHAT.peerId && (from === String(CHAT.peerId))) {
          if (!already) { CHAT.msgs.push(row); chatRenderThread(); chatMarkIncomingRead(); }
        }
        Promise.resolve(chatPollUnread()).catch(function () { });
        chatUpdateBadge();
      }
    } else if (openSelfSent(row)) {
      // صدّى رسالتي أنا (بما فيها البث): نلحقها في الخيط لو لسه ما وصلت بالـ insert
      if (!already) { CHAT.msgs.push(row); chatRenderThread(); }
    }
  }
  // الصدّى مسموح في **خيط صاحبه بالظبط**: الشاشة مفتوحة + زميل محدد + السطر منّي
  // وراسله لنفس الزميل المعروض. من غير الشرطين دول رسالة بعتها لواحد بتظهر عند
  // واحد تاني قدامي — وده تسريب مش شكل حلو (بناء 136، متعاير في check_realtime_48).
  function openSelfSent(row) {
    var v = $("#viewChat");
    if (!v || v.hidden || !CHAT.peerId) return false;
    var me = String(chatMyId() || "");
    if (!me) return false;
    if (String((row && row.from_user) || "") !== me) return false;
    return String((row && row.to_user) || "") === String(CHAT.peerId);
  }

  function chatRtStart() {
    var CL = window.CLOUD || {};
    if (!CL.chatSubscribe || !chatAvailable()) { CHAT_RT.status = "off"; chatPaintLive(); return false; }
    var okStart = false;
    try {
      okStart = !!CL.chatSubscribe(chatOnRealtimeRow, function (s) {
        CHAT_RT.status = String(s || "unknown").toLowerCase();
        chatPaintLive();
      });
    } catch (e) { okStart = false; }
    if (!okStart && CHAT_RT.status === "off") chatPaintLive();
    return okStart;
  }
  function chatRtStop() {
    var CL = window.CLOUD || {};
    try { if (CL.chatUnsubscribe) CL.chatUnsubscribe(); } catch (e) { }
    CHAT_RT.status = "off";
  }

  /* 📢 بناء 136 (سطر ٢٠-ب): بث المالك «رسالة للكل». الدالة على السحابة (`mizan_chat_broadcast`،
   * ترقية ٤٧) بترفض أي حساب مش المالك العام **قبل أي كتابة**، وبتفتح سطر مستقل لكل مستلم في
   * نفس دائرة الخصوصية — فمافيش أي باب جديد ولا رسالة بتخترق حد. الزرار ده **للمالك بس**. */
  function chatCanBroadcast() { return isSuperAcct() && chatAvailable(); }
  function chatBcastOn() { return !!CHAT.broadcast; }
  function chatPaintBcast() {
    var btn = $("#btnChatBroadcast"), send = $("#btnChatSend"), hint = $("#chatBcastHint");
    if (btn) {
      btn.hidden = !chatCanBroadcast();
      btn.classList.toggle("on", chatBcastOn());
      btn.textContent = chatBcastOn() ? "📢 البث مُفعّل" : "📢 رسالة للكل";
    }
    if (send) send.textContent = chatBcastOn() ? "➤ بث للكل" : "➤ إرسال";
    if (hint) hint.textContent = chatBcastOn()
      ? "هذي بتوصل لكل اللي في دائرتك (نفس قواعد الخصوصية) — سطر لكل واحد" : "";
    chatUpdateSend();
  }
  function chatFlipBcast() {
    if (!chatCanBroadcast()) { toast("البث ده لحساب المالك", "error"); return; }
    CHAT.broadcast = !CHAT.broadcast;
    chatPaintBcast();
    if (CHAT.broadcast) chatHint("اختار «➤ بث للكل» يوصّل الرسالة لكل دائرتك", "");
  }
  function chatSendBroadcast(txt, priv) {
    var CL = window.CLOUD || {};
    if (!CL.chatBroadcast) { chatHint("البث مش متاح على هذا الحساب", "err"); return Promise.resolve(); }
    return Promise.resolve(CL.chatBroadcast(txt, priv)).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.missing) { chatShowUnavailable(); return; }
        chatHint((r && r.error) || "الرسالة ما وصلتش — جرّب تاني", "err");
        chatUpdateSend();
        return;
      }
      CHAT.broadcast = false;
      var ta = $("#txtChatMsg"); if (ta) ta.value = "";
      chatPaintBcast();
      chatHint("✅ وصلت لـ " + (r.sent || 0) + " من زملائك", "ok");
      Promise.resolve(chatPollUnread()).catch(function () { });
      chatLoadPeers().catch(function () { });
    }).catch(function () { chatHint("الرسالة ما وصلتش — جرّب تاني", "err"); chatUpdateSend(); });
  }

  // الدردشة سحابية خالص: الحساب المحلي/التجريبي ملوش دردشة، ولازم شركة حقيقية.
  function chatCloudAcct() {
    var DE = window.DATA || {};
    try {
      if (!(DE.isOnline && DE.isOnline())) return false;
      if (!DE.orgId || !DE.orgId()) return false;
      return true;
    } catch (e) { return false; }
  }

  // متاح = حساب سحابي + جدول messages اتعمل فعلًا على السحابة (probeChatTable).
  // لو الترقية لسه ما اتنفّذتش التبويب كله مخفي — أحسن من شاشة فاضية توحي
  // إن الرسايل بتوصل وهي ما بتوصلش (أمان كاذب).
  function chatAvailable() {
    if (!chatCloudAcct()) return false;
    var CL = window.CLOUD || {};
    if (!CL.chatReady) return false;
    try { return !!CL.chatReady(); } catch (e) { return false; }
  }

  function chatMyId() {
    var CL = window.CLOUD || {};
    try { return CL.chatMyId ? CL.chatMyId() : null; } catch (e) { return null; }
  }

  function chatPeerById(id) {
    var out = null;
    (CHAT.peers || []).forEach(function (p) { if (p && p.id === id) out = p; });
    return out;
  }

  function chatPeerName(p) {
    if (!p) return "زميل";
    var n = String(p.full_name || "").trim();
    if (n) return n;
    if (p.org_name) return String(p.org_name);
    return "زميل";
  }

  // سويتش المالك (عادل) وحده: أصحاب المؤسسات (افتراضي) ⇄ كل المستخدمين.
  // الحالة الجاية من صفّه على القاعدة (profiles.features.chatScope) — مش من الجهاز.
  function chatScope() {
    if (CHAT.scopeOverride === "all" || CHAT.scopeOverride === "owners") return CHAT.scopeOverride;
    var DE = window.DATA || {};
    var p = null;
    try { p = (DE.getProfile && DE.getProfile()) || (DE.me && DE.me()); } catch (e) { p = null; }
    var f = p && p.features;
    if (typeof f === "string") { try { f = JSON.parse(f); } catch (e) { f = null; } }
    return (f && f.chatScope === "all") ? "all" : "owners";
  }
  function chatCanSwitchScope() { return isSuperAcct(); }
  function chatScopeLabel() {
    return chatScope() === "all" ? "👥 العرض: كل المستخدمين" : "🏢 العرض: أصحاب المؤسسات";
  }

  function chatHint(msg, kind) {
    var el = $("#chatSendHint");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "wa-hint" + (kind === "err" ? " chat-err" : kind === "ok" ? " chat-ok" : "");
  }

  function chatRenderPeers() {
    var box = $("#chatPeerList");
    if (!box) return;
    var f = normalizeAr(CHAT.filter || "").trim();
    var all = CHAT.peers || [];
    var list = all.filter(function (p) {
      if (!f) return true;
      return normalizeAr(chatPeerName(p)).indexOf(f) >= 0 ||
             normalizeAr(String(p.org_name || "")).indexOf(f) >= 0;
    });
    var cnt = $("#chatPeerCount");
    if (cnt) cnt.textContent = list.length ? String(list.length) : "";
    if (!all.length) {
      box.innerHTML = '<div class="wa-none">مافيش زملاء متاحين للدردشة دلوقتي.</div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="wa-none">مالقيش اسم يطابق بحثك.</div>';
      return;
    }
    box.innerHTML = list.map(function (p) {
      var un = Number(CHAT.unread[p.id]) || 0;
      // 🟢 نقطة خضرا على المتصل فعلًا — من `mizan_chat_peers` نفسها
      var on = !!p.is_online;
      var nm = chatPeerName(p);
      var initial = nm.charAt(0) || "?";
      // آخر رسالة (من msgs لو المحادثة مفتوحة، أو فاضية)
      var lastMsg = "";
      var lastTime = "";
      if (p.id === CHAT.peerId && CHAT.msgs.length) {
        var lm = CHAT.msgs[CHAT.msgs.length - 1];
        lastMsg = String(lm.body || "").substring(0, 50);
        lastTime = chatTimeShort(lm.created_at);
      }
      return '<button type="button" class="wa-peer' + (p.id === CHAT.peerId ? " on" : "") +
        '" data-peer="' + esc(p.id) + '">' +
        '<div class="wa-avatar' + (on ? " on" : "") + '" title="' + (on ? "متصل دلوقتي" : "مش متصل دلوقتي") + '">' + esc(initial) + '</div>' +
        '<div class="wa-peer-body">' +
          '<div class="wa-peer-name">' + esc(nm) +
            (p.is_superadmin ? ' <span class="wa-tag">المالك</span>' : (p.is_owner ? ' <span class="wa-tag">صاحب المؤسسة</span>' : "")) +
          '</div>' +
          (lastMsg ? '<div class="wa-peer-last">' + esc(lastMsg) + '</div>' :
           (p.org_name ? '<div class="wa-peer-last">' + esc(p.org_name) + '</div>' : "")) +
        '</div>' +
        '<div class="wa-peer-meta">' +
          (lastTime ? '<span class="wa-peer-time">' + esc(lastTime) + '</span>' : "") +
          (un ? '<span class="wa-peer-unread">' + (un > 99 ? "99+" : un) + '</span>' : "") +
        '</div>' +
        "</button>";
    }).join("");
  }

  function chatTimeOf(d) {
    if (!d) return "";
    var x = new Date(d);
    if (isNaN(x.getTime())) return "";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(x.getDate()) + "/" + p(x.getMonth() + 1) + " " + p(x.getHours()) + ":" + p(x.getMinutes());
  }
  // 🆕 بناء 137: وقت مختصر للقائمة الجانبية (ساعة:دقيقة بس)
  function chatTimeShort(d) {
    if (!d) return "";
    var x = new Date(d);
    if (isNaN(x.getTime())) return "";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(x.getHours()) + ":" + p(x.getMinutes());
  }

  function chatUpdateSend() {
    var btn = $("#btnChatSend");
    var ta = $("#txtChatMsg");
    if (!btn) return;
    var hasTxt = !!(ta && String(ta.value || "").trim().length);
    // 🆕 بناء 137: المرفق المحلي وحده كافي لتفعيل الإرسال
    var hasAttach = !!CHAT_pendingAttach;
    // في وضع البث مافيش «زميل» محدد — الرسالة بتروح للدائرة كلها (والسحابة بتتأكد من الحساب)
    var targetOk = chatBcastOn() ? true : !!CHAT.peerId;
    btn.disabled = !((hasTxt || hasAttach) && targetOk && chatAvailable());
  }

  function chatRenderThread() {
    var box = $("#chatThread");
    if (!box) return;
    // 🆕 بناء 137: تحديث رأس المحادثة (افاتار + اسم + حالة)
    var headName = document.querySelector("#chatPeerTitle .wa-head-name");
    var headStatus = document.querySelector("#chatPeerTitle .wa-head-status");
    var headAvatar = $("#waHeadAvatar");
    var peer = chatPeerById(CHAT.peerId);
    if (headName) {
      headName.textContent = peer ? chatPeerName(peer) : "اختار زميل من القائمة";
    }
    if (headStatus) {
      headStatus.textContent = peer
        ? (peer.is_online ? "متصل الآن" : (peer.org_name || "آخر ظهور قريب"))
        : "عشان تبدأ المحادثة";
    }
    if (headAvatar) {
      headAvatar.textContent = peer ? (chatPeerName(peer).charAt(0) || "?") : "؟";
    }
    if (!CHAT.peerId) {
      box.innerHTML = '<div class="wa-none">اختار زميل من القائمة على اليمين.</div>';
      chatUpdateSend();
      return;
    }
    if (!(CHAT.msgs || []).length) {
      box.innerHTML = '<div class="wa-none">مافيش رسايل بعد — اكتب أول رسالة.</div>';
      chatUpdateSend();
      return;
    }
    var me = chatMyId();
    box.innerHTML = CHAT.msgs.map(function (m) {
      var mine = String(m.from_user) === String(me);
      var cls = "wa-bbl " + (mine ? "out" : "in") + (m.is_private ? " priv" : "");
      // 🆕 بناء 137: مرفق محلي (صورة/ملف) — يُعرض من IndexedDB مش من السحابة
      var attachHtml = "";
      if (m._attach) {
        var a = m._attach;
        if (a.type && a.type.indexOf("image/") === 0 && a.dataUrl) {
          attachHtml = '<img class="wa-attach-img" src="' + esc(a.dataUrl) + '" alt="' + esc(a.name || "صورة") + '" />';
        } else {
          attachHtml = '<div class="wa-attach"><div class="wa-attach-icon">📄</div>' +
            '<div class="wa-attach-info">' + esc(a.name || "ملف") +
            '<small>' + chatFmtSize(a.size) + ' · على جهازك بس</small></div></div>';
        }
      }
      return '<div class="' + cls + '">' +
        attachHtml +
        esc(m.body || "").replace(/\r?\n/g, "<br>") +
        '<span class="wa-bbl-time">' + chatTimeShort(m.created_at) +
        (mine ? ' <span class="wa-bbl-check">' + (m.read_at ? "✓✓" : "✓") + '</span>' : "") +
        (m.is_private ? " 🔒" : "") +
        '</span></div>';
    }).join("");
    box.scrollTop = box.scrollHeight;
    chatUpdateSend();
  }

  // 🆕 بناء 137: تنسيق حجم الملف للمرفقات
  function chatFmtSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + " B";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function chatUpdateBadge() {
    var b = $("#chatBadge");
    if (!b) return;
    if (!chatAvailable()) { b.hidden = true; b.textContent = ""; return; }
    var n = 0;
    Object.keys(CHAT.unread || {}).forEach(function (k) { n += Number(CHAT.unread[k]) || 0; });
    b.hidden = n <= 0;
    b.textContent = n > 99 ? "99+" : String(n);
  }

  // قائمة المخاطَبين — السحابة بتطبّق mizan_chat_peer، فاللي يوصل هنا أصلي مش مُنتقى
  function chatLoadPeers() {
    var CL = window.CLOUD || {};
    if (!CL.chatPeers || !chatAvailable()) return Promise.resolve();
    return Promise.resolve(CL.chatPeers()).then(function (r) {
      if (!r || !r.ok || r.missing) {
        if (r && r.missing) chatShowUnavailable();
        return;
      }
      CHAT.peers = r.peers || [];
      chatRenderPeers();
      chatRenderThread();
    }).catch(function () { });
  }

  // عدّاد الجديد لكل مخاطَب (رسالتي أنا اللي لسه ما قريتهاش)
  function chatPollUnread() {
    var CL = window.CLOUD || {};
    if (!CL.chatUnread || !chatAvailable()) return Promise.resolve();
    return Promise.resolve(CL.chatUnread()).then(function (r) {
      if (!r || !r.ok || r.missing) { if (r && r.missing) chatShowUnavailable(); return; }
      var counts = {};
      (r.rows || []).forEach(function (m) {
        counts[m.from_user] = (Number(counts[m.from_user]) || 0) + 1;
      });
      CHAT.unread = counts;
      chatRenderPeers();
      chatUpdateBadge();
    }).catch(function () { });
  }

  function chatMarkIncomingRead() {
    var CL = window.CLOUD || {};
    if (!CL.chatMarkRead) return;
    var me = String(chatMyId() || "");
    var ids = (CHAT.msgs || []).filter(function (m) {
      return String(m.to_user) === me && !m.read_at;
    }).map(function (m) { return m.id; });
    if (!ids.length) return;
    CHAT.unread[CHAT.peerId] = 0;
    chatRenderPeers();
    chatUpdateBadge();
    Promise.resolve(CL.chatMarkRead(ids)).catch(function () { });
  }

  function chatOpenPeer(id) {
    if (!id || !chatAvailable()) return;
    CHAT.peerId = id;
    CHAT.msgs = [];
    chatRenderPeers();
    chatRenderThread();
    var CL = window.CLOUD || {};
    return Promise.resolve(CL.chatThread(id, CHAT_MSG_LIMIT)).then(function (r) {
      if (!r) return;
      if (r.missing) { chatShowUnavailable(); return; }
      if (!r.ok) { chatHint("الرسايل ما وصلتش — دوس «تحديث» بعد شوية", "err"); return; }
      CHAT.msgs = r.rows || [];
      chatRenderThread();
      chatMarkIncomingRead();
    }).catch(function () { chatHint("الرسايل ما وصلتش — دوس «تحديث» بعد شوية", "err"); });
  }

  // تحديث هادي وقت الـ polling: ما يلمسش خانة الكتابة، ولو المستخدم قاري
  // رسايل قديمة (مرفوع لفوق) التمرير ما يرتجعوش — يفضل في مكانه.
  function chatReloadThread() {
    if (!CHAT.peerId || !chatAvailable()) return Promise.resolve();
    var CL = window.CLOUD || {};
    var box = $("#chatThread");
    var prevTop = box ? box.scrollTop : 0;
    var atBottom = !box || (box.scrollHeight - box.scrollTop - box.clientHeight) < 40;
    return Promise.resolve(CL.chatThread(CHAT.peerId, CHAT_MSG_LIMIT)).then(function (r) {
      if (!r || !r.ok || r.missing) return;
      var before = (CHAT.msgs || []).length;
      CHAT.msgs = r.rows || [];
      chatRenderThread();               // بيرسم ويرجع لأسفل
      if (!atBottom && box) box.scrollTop = prevTop;
      if (CHAT.msgs.length > before) chatMarkIncomingRead();
    }).catch(function () { });
  }

  function chatSendMsg() {
    var ta = $("#txtChatMsg"), priv = $("#chkChatPrivate");
    if (!ta) return;
    if (!chatAvailable()) {
      chatHint("الدردشة محتاجة اتصال بالإنترنت وحساب على السحابة", "err");
      return;
    }
    var txt0 = String(ta.value || "").trim();
    // 🆕 بناء 137: في وضع المرفق المحلي — الرسالة ممكن تكون فاضية (صورة/ملف بس)
    var hasAttach = !!CHAT_pendingAttach;
    if (chatBcastOn()) {                                   // 📢 وضع البث (مالك البرنامج بس)
      if (!txt0) { chatHint("اكتب الرسالة الأول", "err"); chatUpdateSend(); return; }
      return Promise.resolve(chatSendBroadcast(txt0, !!(priv && priv.checked)));
    }
    if (!CHAT.peerId) { chatHint("اختار زميل الأول", "err"); return; }
    var txt = String(ta.value || "").trim();
    if (!txt && !hasAttach) { chatHint("اكتب الرسالة الأول أو أرفق ملف", "err"); chatUpdateSend(); return; }
    var btn = $("#btnChatSend");
    if (btn) btn.disabled = true;
    // 🆕 بناء 137: المرفق المحلي بيتربط بالرسالة في الذاكرة بس — صفر بايت للسحابة
    var attach = CHAT_pendingAttach;
    CHAT_pendingAttach = null;
    var CL = window.CLOUD || {};
    return Promise.resolve(CL.chatSend(CHAT.peerId, txt || "[مرفق]", !!(priv && priv.checked))).then(function (r) {
      if (!r || !r.ok) {
        chatHint((r && r.error) || "الرسالة ما وصلتش — جرّب تاني", "err");
        chatUpdateSend();
        return;
      }
      ta.value = "";
      if (r.row) {
        if (attach) r.row._attach = attach;   // ربط المرفق محليًا بالرسالة
        CHAT.msgs.push(r.row);
      }
      chatRenderThread();
      chatRenderPeers();   // تحديث آخر رسالة في القائمة
      chatHint("", "");
      chatUpdateSend();
    }).catch(function () {
      chatHint("الرسالة ما وصلتش — جرّب تاني", "err");
      chatUpdateSend();
    });
  }

  // سويتش المالك: أصحاب المؤسسات فقط ⇄ كل المستخدمين (الدالة على السحابة بترفض أي حساب تاني)
  function chatFlipScope() {
    if (!chatCanSwitchScope() || !chatAvailable()) {
      toast("هذا الخيار لحساب المالك", "error");
      return;
    }
    var next = chatScope() === "all" ? "owners" : "all";
    var CL = window.CLOUD || {};
    Promise.resolve(CL.chatSetScope(next)).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.missing) { chatShowUnavailable(); return; }
        chatHint("السويتش ما اتحفظش — جرّب تاني", "err");
        return;
      }
      CHAT.scopeOverride = (r.scope === "all" || r.scope === "owners") ? r.scope : next;
      CHAT.peerId = null;
      CHAT.msgs = [];
      CHAT.peers = [];
      var sw = $("#btnChatScope");
      if (sw) sw.textContent = chatScopeLabel();
      chatHint(next === "all" ? "بقوا كل المستخدمين يظهروا في القائمة" : "رجّعنا القائمة لأصحاب المؤسسات", "ok");
      chatRenderPeers();
      chatRenderThread();
      chatLoadPeers().then(chatPollUnread);
      // نحدّث صفحتنا من السحابة عشان القراءة الجاية تبقى من القاعدة مش من الذاكرة
      var DE = window.DATA || {};
      if (DE.loadProfile) Promise.resolve(DE.loadProfile()).catch(function () { });
    }).catch(function () { chatHint("السويتش ما اتحفظش — جرّب تاني", "err"); });
  }

  function chatShowUnavailable() {
    var cols = $("#chatCols"), note = $("#chatUnavailable");
    if (cols) cols.hidden = true;
    if (note) note.hidden = false;
    chatStopPoll();
    chatUpdateBadge();
  }

  function chatTick() {
    var v = $("#viewChat");
    if (!v || v.hidden || !chatAvailable()) { chatStopPoll(); return; }
    if (CHAT.busy) return;
    CHAT.busy = true;
    Promise.resolve()
      .then(function () { return chatLoadPeers(); })
      .then(function () { return chatPollUnread(); })
      .then(function () { return chatReloadThread(); })
      .catch(function () { })
      .then(function () { CHAT.busy = false; });
  }

  function chatStartPoll() {
    chatStopPoll();
    if (!chatAvailable()) return;
    CHAT.timer = setInterval(chatTick, CHAT_POLL_MS);
  }
  /* 🧱 بناء 132 (طلب المالك: «عايز الدردشة تكون مستقلة علشان يظهر فيها إن رسالة جات
     ويظهر عدد الرسائل الواردة»): الدردشة بقت زرارًا قائمًا بذاته في الشريط العلوي،
     فالعدّاد لازم يعيش حتى والشاشة مقفولة.
     الـ ticker ده **قراءة الواردة بس** (`chatUnread` → عدّاد) — مافيش رسم خيوط ولا رسايل،
     وبيسكت لما شاشة الدردشة نفسها مفتوحة (الـ poll بتاعها أغنى)، وبيسكت قبل الدخول
     وبعده (`chatAvailable` = حساب سحابي + جدول الرسايل على السحابة). */
  const CHAT_BADGE_MS = 30000;
  let CHAT_badgeTimer = null, CHAT_badgeBusy = false;
  function chatBadgeTick() {
    if (CHAT_badgeBusy) return;
    if (!chatAvailable()) return;
    var v = $("#viewChat");
    if (v && !v.hidden) return;
    CHAT_badgeBusy = true;
    Promise.resolve(chatPollUnread()).catch(function () { }).then(function () { CHAT_badgeBusy = false; });
  }
  function chatStartBadgeTicker() {
    if (typeof setInterval !== "function") return;
    chatStopBadgeTicker();
    CHAT_badgeTimer = setInterval(chatBadgeTick, CHAT_BADGE_MS);
    chatBadgeTick();
  }
  function chatStopBadgeTicker() {
    if (CHAT_badgeTimer !== null && typeof CHAT_badgeTimer !== "undefined") {
      clearInterval(CHAT_badgeTimer);
      CHAT_badgeTimer = null;
    }
  }
  function chatStopPoll() {
    if (CHAT.timer !== null && typeof CHAT.timer !== "undefined") {
      clearInterval(CHAT.timer);
      CHAT.timer = null;
    }
  }
  // مسح كامل لحالة الدردشة من الذاكرة (خروج / تبديل شركة) — مافيش بقايا رسايل
  function chatWipe(reason) {
    chatStopPoll();
    // 🟢 بناء 136: الاشتراك اللحظي بيتقطع هو كمان — ومنع إعادة استخدامه بعد التبديل
    chatRtStop();
    chatSeenReset();
    CHAT.broadcast = false;
    // 🧱 بناء 132: الخروج/تبديل company = العدّاد والـ ticker بتاعه يقفوا (بيرجعون مع الدخول)
    chatStopBadgeTicker();
    CHAT.peers = [];
    CHAT.msgs = [];
    CHAT.peerId = null;
    CHAT.unread = {};
    CHAT.filter = "";
    CHAT.busy = false;
    // 🆕 بناء 137: مسح المرفق المعلّق
    CHAT_pendingAttach = null;
    if (reason === "session") CHAT.scopeOverride = null;
    chatUpdateBadge();
    // الرسم بيرجع الشاشة فاضية **في الـ DOM** كمان — عشان بعد خروج أو تبديل شركة
    // مافيش بقايا رسايل حد قديم ولا مسودة مكتوبة على نفس الجهاز.
    chatRenderPeers();
    chatRenderThread();
    var ta = $("#txtChatMsg");
    if (ta) ta.value = "";
  }

  // 🆕 بناء 137: مرفقات محلية (IndexedDB) — صفر بايت للسحابة
  // الصور/الملفات بتتخزن على جهاز المستخدم بس، وما بتترفعش أبدًا.
  var CHAT_ATTACH_DB = "mizan_chat_attach_v1";
  var CHAT_ATTACH_STORE = "files";
  var CHAT_pendingAttach = null;   // ملف واحد معلّق للإرسال مع الرسالة الجاية

  function chatAttachDB() {
    return new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open(CHAT_ATTACH_DB, 1);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(CHAT_ATTACH_STORE)) {
            db.createObjectStore(CHAT_ATTACH_STORE, { keyPath: "id" });
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { reject(e); }
    });
  }
  function chatAttachSave(id, file, dataUrl) {
    return chatAttachDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACH_STORE, "readwrite");
        tx.objectStore(CHAT_ATTACH_STORE).put({ id: id, name: file.name, type: file.type, size: file.size, dataUrl: dataUrl, ts: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function chatAttachLoad(id) {
    return chatAttachDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(CHAT_ATTACH_STORE, "readonly");
        var req = tx.objectStore(CHAT_ATTACH_STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return null; });
  }
  // معالجة الملفات المختارة: تحويل لـ dataURL + تخزين في IndexedDB + ربط بالرسالة
  function chatHandleFiles(files) {
    if (!files || !files.length) return;
    var file = files[0];   // ملف واحد في كل مرة (واتساب نفس النمط)
    if (file.size > 10 * 1024 * 1024) {
      chatHint("الملف كبير أوي (أكبر من ١٠ ميجا) — اختار ملف أصغر", "err");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var attachId = "att_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      chatAttachSave(attachId, file, dataUrl).then(function () {
        CHAT_pendingAttach = { id: attachId, name: file.name, type: file.type, size: file.size, dataUrl: dataUrl };
        chatHint("📎 " + file.name + " (" + chatFmtSize(file.size) + ") — هيتبعت مع الرسالة الجاية", "ok");
        chatUpdateSend();
      }).catch(function () {
        chatHint("ما قدرش يحفظ المرفق على الجهاز — جرّب تاني", "err");
      });
    };
    reader.onerror = function () {
      chatHint("ما قدرش يقرأ الملف — جرّب تاني", "err");
    };
    if (file.type && file.type.indexOf("image/") === 0) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }
  }

  function chatBindOnce() {
    if (CHAT.bound) return;
    CHAT.bound = true;
    var list = $("#chatPeerList");
    if (list) list.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".wa-peer") : null;
      if (b && b.dataset.peer) chatOpenPeer(b.dataset.peer);
    });
    var search = $("#txtChatSearch");
    if (search) search.addEventListener("input", function () {
      CHAT.filter = search.value || "";
      chatRenderPeers();
    });
    var ta = $("#txtChatMsg");
    if (ta) {
      ta.addEventListener("input", chatUpdateSend);
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatSendMsg(); }
      });
    }
    var send = $("#btnChatSend");
    if (send) send.addEventListener("click", chatSendMsg);
    var refresh = $("#btnChatRefresh");
    if (refresh) refresh.addEventListener("click", function () {
      chatHint("…", "");
      chatTick();
    });
    var sw = $("#btnChatScope");
    if (sw) sw.addEventListener("click", chatFlipScope);
    // 🆕 بناء 136: بث المالك + اختيار النغمة (النغمة تفضيل على الجهاز، مافيش فيها أي نص رسالة)
    var bc = $("#btnChatBroadcast");
    if (bc) bc.addEventListener("click", chatFlipBcast);
    var snd = $("#selChatSound");
    if (snd) {
      snd.addEventListener("change", function () {
        chatSetSoundId(snd.value);
        if (snd.value !== "off") playChatSound(snd.value);   // يسمع النغمة وهو بيختارها
        chatHint("🔊 تمام، الرسايل الجاية بتعمل هذا الصوت", "ok");
      });
    }
    var tst = $("#btnChatSoundTest");
    if (tst) tst.addEventListener("click", function () { playChatSound(chatSoundId()); });
    // «خاص» مفعّل افتراضيًا: الراحة البال للموظف. (الخصوصية نفسها مش متوقفة على
    // الصندوق — سياسة SELECT على السحابة بتقفلها لأي حد غير الطرفين مهما كان.)
    var priv = $("#chkChatPrivate");
    if (priv && priv.checked !== true) priv.checked = true;
    // 🆕 بناء 137: زر المرفقات — ملف/صورة على جهاز المستخدم بس (صفر بايت للسحابة)
    var attachBtn = $("#btnChatAttach");
    var fileInp = $("#inpChatFile");
    if (attachBtn && fileInp) {
      attachBtn.addEventListener("click", function () { fileInp.click(); });
      fileInp.addEventListener("change", function () {
        if (!fileInp.files || !fileInp.files.length) return;
        chatHandleFiles(fileInp.files);
        fileInp.value = "";   // عشان نفس الملف يتاختار تاني لو احتاج
      });
    }
  }

  function renderChat() {
    var cols = $("#chatCols"), note = $("#chatUnavailable");
    if (!chatAvailable()) {
      if (cols) cols.hidden = true;
      if (note) note.hidden = false;
      chatStopPoll();
      chatRtStop();
      chatPaintLive();
      chatUpdateBadge();
      return;
    }
    if (cols) cols.hidden = false;
    if (note) note.hidden = true;
    chatBindOnce();
    var sw = $("#btnChatScope");
    if (sw) {
      sw.hidden = !chatCanSwitchScope();
      if (!sw.hidden) sw.textContent = chatScopeLabel();
    }
    // 🔊 النغمة المحفوظة تظهر في القائمة + الحالة تتارسم
    var snd = $("#selChatSound");
    if (snd) snd.value = chatSoundId();
    CHAT.broadcast = false;
    chatPaintBcast();
    chatPaintLive();
    chatRenderPeers();
    chatRenderThread();
    // 🟢 اللحظي (ترقية ٤٨): اشتراك واحد على INSERT، والـ polling يفضل وراه احتياطي
    chatRtStart();
    chatLoadPeers().then(chatPollUnread).then(function () { chatStartPoll(); });
  }

  /* ================== لوحة إدارة المالك ================== */
  const ADMIN_FEATURES = [
    ["sales", "المبيعات (POS)"], ["purchases", "المشتريات"], ["returns", "الاستعلام عن الفواتير"],
    ["products", "الأصناف والمخزون"], ["customers", "دليل العملاء"], ["suppliers", "دليل الموردين"],
    ["treasury", "الخزينة والمصروفات"], ["accounts", "دليل الحسابات"], ["journal", "القيود اليومية"],
    ["balance", "قائمة المركز المالي"], ["treasuryStatements", "كشف الخزائن"], ["reports", "التقارير"],
        ["users", "المستخدمون"], ["audit", "سجل العمليات"],
        ["clientSettings", "إعدادات مؤسستك"], ["settings", "الإعدادات (المالك)"],
        ["catTab", "تبويب التصنيفات"], ["unitTab", "تبويب وحدات القياس"], ["whTab", "تبويب المستودعات"],
        ["walletTab", "تبويب المحافظ الإلكترونية"], ["bankTab", "تبويب حسابات البنوك"], ["ownerTab", "تبويب أصحاب المنشأة"],
        ["docManager", "📁 إدارة مستندات العملاء والموردين"],
        ["returnsManager", "🔁 إدارة المرتجعات"],
        ["attendance", "🕐 الحضور والانصراف"],
        ["attendanceEdit", "✏️ تعديل سجلات الحضور يدويًا"],
        ["fixedAssets", "🏭 الأصول الثابتة"]
        ];

  // صلاحيات opt-in: owner/سوبر أدمن عندهما دائمًا، والعضو ما عندهاش إلا لو فُعّلت صريحًا
  const OPT_IN_FEATS = ["clientSettings", "docManager", "returnsManager", "attendance", "attendanceEdit", "fixedAssets"];

  /* 🆕 بناء 131 — كاش مزايا الشركات (قراءة واحدة من `organizations.features`).
   * قبل البناء ده كانت نافذة «⚙️ المزايا» بتفتح وكل الصناديق معلّمة (ما بتقرأش
   * المحفوظ)، فتحديد المالك كان بيبان «راجع كل الصلاحيات» وأي حفظكان بيمسح القرار. */
  let ORG_FEAT_MAP = null;
  function orgFeatState(orgId, key) {
    const f = (ORG_FEAT_MAP && ORG_FEAT_MAP[orgId]) || {};
    // نفس منطق التنفيذ في القاعدة: opt-in محتاج «أيوه» صريح، وغير كده «لأ» صريحة هي المقفول
    return OPT_IN_FEATS.indexOf(key) !== -1 ? f[key] === true : f[key] !== false;
  }
  function loadOrgFeats() {
    if (!(window.DATA && DATA.adminOrgFeatures)) return Promise.resolve(false);
    return DATA.adminOrgFeatures().then((rows) => {
      const map = {};
      (rows || []).forEach((r) => {
        if (r && r.id) map[r.id] = (r.features && typeof r.features === "object") ? r.features : {};
      });
      ORG_FEAT_MAP = map;
      return true;
    }).catch(() => false); // زعلة اتصال = نرسم الجدول من غير الملخص، ومافيش أي مسح لبيانات
  }
  function orgFeatsSummary(orgId) {
    if (!ORG_FEAT_MAP) return "—";
    if (!(orgId in ORG_FEAT_MAP)) return "—";
    const f = ORG_FEAT_MAP[orgId] || {};
    let open = 0, closed = 0, everSet = false;
    chooserFeatures().forEach((row) => {
      const k = row[0];
      if (f[k] === true || f[k] === false) everSet = true;
      if (orgFeatState(orgId, k)) open++; else closed++;
    });
    if (!everSet) return "✅ كلها مفتوحة (بلا تحديد)";
    return closed ? "🔒 " + closed + " مقفولة · 🟢 " + open : "🟢 كل المزايا مفتوحة";
  }

  function fmtDate(d) { return d ? String(d).slice(0, 10) : ""; }
  // تاريخ وساعة محليان (لآخر الاتصال وغيرها) — بصيغة YYYY-MM-DD HH:MM
  function fmtDateTime(d) {
    if (!d) return "";
    const x = new Date(d);
    if (isNaN(x.getTime())) return "";
    const p = (n) => String(n).padStart(2, "0");
    return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate()) + " " + p(x.getHours()) + ":" + p(x.getMinutes());
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const end = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((end - today) / 86400000);
  }

  // لوحة إحصائية للمالك: بطاقات ملخصة (مضغوطة) فوق جدول الشركات
  var onlineUsers = [];
  var onlineModal = null;
  var adminOrgsCache = [];

  // ============================================================
  // 🛡 بند 17 (بناء 127) — شركة المالك المحمية: بلا تواريخ اشتراك
  // طلب المالك: «الاشتراك من/إلى» ميظهرش على شاشتي، وميتحفظش تاريخ نهاية
  // لشركتي — لأن تاريخ نهاية غلط واحد يقدر يقفل المالك نفسه.
  // المصدر: `mizan_admin_orgs()` بترجع عمود `protected` (= الشركة يملكها حساب
  // is_superadmin) ⇒ الشغل **واجهة بس**، ومافيش أي تنفيذ أو قراءة جديدة على السحابة.
  // القاعدة: أي سطر بيعرض أو بيحفظ أو بيصنّف plan_start/plan_end بيمر من هنا.
  // ============================================================
  function isProtectedOrg(o) { return !!(o && o.protected === true); }
  // خليّة التاريخ في الجداول الإدارية: «—» لشركة المالك (بدل أي تشخيص تقني)
  function subDateCell(o, val) { return isProtectedOrg(o) ? "—" : fmtDate(val); }
  // ممنوع حفظ/قراءة تاريخي شركة محمية من أي نموذج
  function subDatesWriteLocked(o) { return isProtectedOrg(o); }
  // تصنيف واحد تستخدمه البطاقات + الفئات + حالة الصف (عشان العدد والقائمة متطابقين)
  // "locked" | "expired" | "soon" | "active" | "noend" | "other"
  function subClassOf(o) {
    if (!o) return "other";
    if (o.locked) return "locked";
    if (isProtectedOrg(o)) return "active"; // شركة المالك خارج أي حساب لانتهاء الاشتراك
    const until = daysUntil(o.plan_end);
    if (o.plan_end && (o.plan_status === "expired" || (until !== null && until < 0))) return "expired";
    if (o.plan_end && until !== null && until >= 0 && until <= 7) return "soon";
    if (!o.plan_end) return "noend";
    if (o.plan_status === "active" || until === null) return "active";
    return "other";
  }
  function subStatusBadge(o) {
    const k = subClassOf(o);
    if (k === "locked") return '<span class="badge-no">🔴 مقفلة</span>';
    if (k === "expired") return '<span class="badge-no">🔴 منتهية</span>';
    if (k === "soon") return '<span class="badge-warn">🟠 تنتهي خلال ' + daysUntil(o.plan_end) + " يوم</span>";
    if (k === "other") return '<span class="badge-no">🔴 ' + (o.plan_status || "متوقفة") + "</span>";
    if (isProtectedOrg(o)) return '<span class="badge-ok">🟢 نشطة (بلا تاريخ)</span>';
    return '<span class="badge-ok">🟢 نشطة</span>';
  }

  function renderAdminStats(orgs) {
    adminOrgsCache = orgs || [];
    const box = $("#adminStats");
    if (!box) return;
    let total = orgs.length, active = 0, locked = 0, expired = 0, expiringSoon = 0, members = 0, noEnd = 0;
    orgs.forEach((o) => {
      members += o.members || 0;
      // 🛡 بند 17: التصنيف من مصدر واحد (شركة المالك ما تدخلش في أي حساب انتهاء)
      const k = subClassOf(o);
      if (k === "locked") locked++;
      else if (k === "expired") expired++;
      else if (k === "soon") expiringSoon++;
      else if (k === "noend") noEnd++;
      else active++; // "active" و "other" (نفس العد القديم)
    });
    // آخر اتصال عام: أحدث last_seen بين الشركات غير المتصلة (المتصلة ظهرت في «متصلون الآن»)
    let latest = null;
    orgs.forEach((o) => { if (!o.online && o.last_seen && (!latest || new Date(o.last_seen) > new Date(latest))) latest = o.last_seen; });
    box.innerHTML =
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات" onclick="window.__admCat(\'all\')"><span class="kpi-title">🏢 الشركات</span><span class="kpi-value">' + total + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الأعضاء" onclick="window.__admCat(\'members\')"><span class="kpi-title">👥 الأعضاء</span><span class="kpi-value">' + members + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض النشطة" onclick="window.__admCat(\'active\')"><span class="kpi-title">🟢 نشطة</span><span class="kpi-value">' + active + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات المنتهية اشتراكاتها قريبًا" onclick="window.__admCat(\'soon\')"><span class="kpi-title">🟠 خلال أسبوع</span><span class="kpi-value">' + expiringSoon + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض المنتهية/المقفلة" onclick="window.__admCat(\'expired\')"><span class="kpi-title">🔴 منتهية/مقفلة</span><span class="kpi-value">' + (expired + locked) + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات بلا تاريخ" onclick="window.__admCat(\'noend\')"><span class="kpi-title">🚫 بلا تاريخ</span><span class="kpi-value">' + noEnd + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض آخر اتصال لكل شركة" onclick="window.__admLastSeen()"><span class="kpi-title">🕒 آخر اتصال</span><span class="kpi-value" style="font-size:12px;color:#ff5b5b;font-weight:800">' + (latest ? fmtDateTime(latest) : "—") + "</span></div>" +
      '<div class="kpi-card kpi-mini online-card clk" id="kpiOnline" title="اضغط لعرض المتصلين الآن" onclick="window.__admPresence()"><span class="kpi-title">🟢 متصلون الآن</span><span class="kpi-value">…</span></div>';
    refreshPresenceCard();
  }

  // نافذة «آخر اتصال»: كل الشركات وتاريخ وساعة آخر دخول لكل شركة بالأحمر
  var seenModal = null;
  window.__admLastSeen = function () {
    if (!seenModal || !seenModal.isConnected) {
      seenModal = document.createElement("div");
      seenModal.className = "modal-overlay";
      seenModal.id = "lastSeenModal";
      document.body.appendChild(seenModal);
      seenModal.addEventListener("click", (ev) => { if (ev.target === seenModal) { seenModal.remove(); seenModal = null; } });
    }
    // الشركات المتصلة الآن تتشال من القائمة (بتظهر في «متصلون الآن»)
    const list = (adminOrgsCache || []).filter((o) => !o.online).slice().sort((a, b) =>
      new Date(b.last_seen || 0) - new Date(a.last_seen || 0));
    let rows = "";
    if (!list.length) {
      rows = '<tr><td colspan="2" style="text-align:center"><span class="login-sub">كل الشركات متصلة الآن — لا توجد شركات منقطعة.</span></td></tr>';
    }
    list.forEach((o) => {
      rows += "<tr><td><b>" + (o.org_name || "بدون اسم") + "</b> <span class=\"login-sub\">(" + (o.members || 0) + " عضو)</span></td>" +
        '<td style="color:#ff5b5b;font-weight:800">' + (o.last_seen ? fmtDateTime(o.last_seen) : "لم يتصل بعد") + "</td></tr>";
    });
    seenModal.innerHTML = '<div class="modal-box">' +
      '<div class="panel-title">🕒 آخر اتصال بالبرنامج — لكل شركة</div>' +
      '<p class="login-sub">الشركات المتصلة الآن لا تظهر هنا؛ تجدها في بطاقة «🟢 متصلون الآن».</p>' +
      '<div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table class="data-table"><thead><tr><th>الشركة</th><th>تاريخ وساعة آخر اتصال</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="feat-btns"><button class="btn gray" type="button" onclick="window.__admLSClose()">إغلاق</button></div>' +
      "</div>";
  };
  window.__admLSClose = function () { if (seenModal) { seenModal.remove(); seenModal = null; } };

  // تحديث بطاقة المتصلين + محتوى النافذة (تستدعى كل 15 ثانية أثناء فتح لوحة الإدارة)
  function refreshPresenceCard() {
    if (!window.DATA || !DATA.presenceOnline) return;
    DATA.presenceOnline().then((rows) => {
      onlineUsers = rows || [];
      const card = document.getElementById("kpiOnline");
      if (card) {
        card.querySelector(".kpi-value").textContent = onlineUsers.length;
        card.style.borderRightColor = onlineUsers.length ? "var(--success)" : "var(--border)";
      }
      if (onlineModal && onlineModal.__render) onlineModal.__render();
    }).catch(() => {});
  }

  // نافذة المتصلين الآن: أسماء الشركات واليوزرات الفاتحين
  window.__admPresence = function () {
    if (!onlineModal || !onlineModal.isConnected) {
      onlineModal = document.createElement("div");
      onlineModal.className = "modal-overlay";
      onlineModal.id = "presenceModal";
      onlineModal.__render = () => {
        if (!onlineModal) return;
        const byOrg = {};
        (onlineUsers || []).forEach((u) => {
          const k = u.org_name || "بدون اسم";
          if (!byOrg[k]) byOrg[k] = [];
          byOrg[k].push(u);
        });
        const names = Object.keys(byOrg);
        let rows = "";
        if (!names.length) {
          rows = '<tr><td colspan="2" style="text-align:center"><span class="login-sub">لا يوجد أحد متصل حاليًا.</span></td></tr>';
        }
        names.forEach((n) => {
          const list = byOrg[n];
          rows += "<tr><td rowspan=\"" + list.length + "\"><b>" + n + "</b></td>" +
            list.map((u) => "<td><code>" + (u.username || "—") + "</code> " + (isCompanyOwnerRow(u) ? "🧑‍💼" : "👤") + " <span class=\"login-sub\">" + (u.full_name || "") + "</span></td></tr>").join("");
        });
        onlineModal.innerHTML = '<div class="modal-box">' +
          '<div class="panel-title">🟢 المتصلون الآن — ' + (onlineUsers ? onlineUsers.length : 0) + " مستخدم</div>" +
          '<div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table class="data-table"><thead><tr><th>الشركة</th><th>المستخدم الفاتح</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
          '<div class="feat-btns"><button class="btn gray" type="button" onclick="window.__admPClose()">إغلاق</button></div>' +
          "</div>";
      };
      document.body.appendChild(onlineModal);
      onlineModal.addEventListener("click", (ev) => { if (ev.target === onlineModal) { onlineModal.remove(); onlineModal = null; } });
    }
    onlineModal.__render();
    refreshPresenceCard();
  };
  window.__admPClose = function () {
    if (onlineModal) { onlineModal.remove(); onlineModal = null; }
  };

  // نافذة فئة من بطاقات الإحصاء: تعرض الشركات + عدد أفرادها + فتح تعديل الشركة بالضغط
  var catModal = null;
  var catOrgsList = [];
  var catKind = "";
  window.__admCat = function (kind) {
    catKind = kind;
    DATA.adminOrgs().then((orgs) => {
      const map = {
        all: () => orgs,
        members: () => orgs.filter((o) => (o.members || 0) > 0),
        active: () => orgs.filter((o) => { const k = subClassOf(o); return k === "active" || k === "other"; }),
        soon: () => orgs.filter((o) => subClassOf(o) === "soon"),
        expired: () => orgs.filter((o) => { const k = subClassOf(o); return k === "locked" || k === "expired"; }),
        noend: () => orgs.filter((o) => subClassOf(o) === "noend")
      };
      const list = (map[kind] || map.all)();
      catOrgsList = list;
      _renderCatModal();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  function _renderCatModal() {
    const titles = {
      all: "🏢 جميع الشركات", members: "👥 الشركات التي بها أعضاء", active: "🟢 الشركات النشطة",
      soon: "🟠 شركات اشتراكاتها تنتهي خلال أسبوع", expired: "🔴 الشركات المنتهية / المقفلة", noend: "🚫 الشركات بدون تاريخ اشتراك"
    };
    const title = titles[catKind] || "الشركات";
    const totalMembers = catOrgsList.reduce((s, o) => s + (o.members || 0), 0);
    if (!catModal || !catModal.isConnected) {
      catModal = document.createElement("div");
      catModal.className = "modal-overlay";
      catModal.id = "catModal";
      document.body.appendChild(catModal);
      catModal.addEventListener("click", (ev) => { if (ev.target === catModal) _closeCatModal(); });
    }
    let rows = "";
    if (!catOrgsList.length) {
      rows = '<div class="adm-alert orange" style="margin:10px 0">لا توجد شركات في هذه الفئة حاليًا.</div>';
    } else {
      let h = '<table class="data-table"><thead><tr><th>الشركة</th><th>يوزر نيم</th><th>الأفراد (الأعضاء)</th><th>إلى تاريخ</th><th>الحالة</th></tr></thead><tbody>';
      catOrgsList.forEach((o) => {
        const locked = !!o.locked;
        const until = daysUntil(o.plan_end);
        let st;
        // 🛡 بند 17: شركة المالك بتاخد حالة من نفس مصدر التصنيف (وبلا تاريخ نهاية)
        if (isProtectedOrg(o)) st = subStatusBadge(o);
        else if (locked) st = '<span class="badge-no">🔴 مقفلة</span>';
        else if (o.plan_end && (o.plan_status === "expired" || until < 0)) st = '<span class="badge-no">🔴 منتهية</span>';
        else if (o.plan_end && until >= 0 && until <= 7) st = '<span class="badge-warn">🟠 تنتهي خلال ' + until + " يوم</span>";
        else st = '<span class="badge-ok">🟢 نشطة</span>';
        h += '<tr data-cat="' + o.org_id + '" style="cursor:pointer" title="اضغط لفتح بيانات الشركة وتعديلها">' +
          "<td><b>" + (o.org_name || "بدون اسم") + "</b></td>" +
          "<td><code>" + (o.admin_username || "—") + "</code></td>" +
          "<td>" + (o.members || 0) + "</td>" +
          "<td>" + subDateCell(o, o.plan_end) + "</td>" +
          "<td>" + st + "</td></tr>";
      });
      h += "</tbody></table>";
      rows = h;
    }
    catModal.innerHTML = '<div class="modal-box">' +
      '<div class="panel-title">' + title + " <span class=\"login-sub\">(" + catOrgsList.length + " شركة • " + totalMembers + " فرد)</span></div>" +
      '<p class="login-sub" style="margin-bottom:8px">👇 اضغط على أي شركة لفتح بياناتها وتعديلها.</p>' +
      '<div class="tbl-wrap" style="max-height:55vh;overflow:auto">' + rows + "</div>" +
      '<div class="feat-btns"><button class="btn gray" type="button" onclick="window.__admCatClose()">إغلاق</button></div>' +
      "</div>";
    catModal.querySelectorAll("tr[data-cat]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const orgId = tr.getAttribute("data-cat");
        _closeCatModal();
        if (orgId) window.__admDbl(orgId);
      });
    });
  }

  window.__admCatClose = function () { _closeCatModal(); };
  function _closeCatModal() {
    if (catModal) { catModal.remove(); catModal = null; }
  }

  // شريط تنبيهات انتهاء اشتراك الشركات
  function renderAdminAlerts(orgs) {
    const box = $("#adminAlerts");
    if (!box) return;
    const urgent = [];
    const soon = [];
    orgs.forEach((o) => {
      const until = daysUntil(o.plan_end);
      if (o.locked) return;
      // 🛡 بند 17: شركة المالك ما ليهاش تاريخ انتهاء أصلاً ⇒ مافيش تنبيه انتهاء عليها
      if (isProtectedOrg(o)) return;
      if ((o.plan_status === "expired" || (until !== null && until < 0)) && o.plan_end) {
        urgent.push("<div class=\"adm-alert red\">🔴 شركة <code>" + (o.org_name || "بدون اسم") + "</code> اشتراكها انتهى بتاريخ <b>" + fmtDate(o.plan_end) + "</b> — تحدّثه أو قفّلها.</div>");
      } else if (until !== null && until >= 0 && until <= 7 && o.plan_end) {
        const tag = until === 0 ? "اليوم" : "خلال " + until + " يوم";
        soon.push("<div class=\"adm-alert orange\">🟠 شركة <code>" + (o.org_name || "بدون اسم") + "</code> اشتراكها ينتهي <b>" + tag + "</b> بتاريخ <b>" + fmtDate(o.plan_end) + "</b>.</div>");
      }
    });
    if (urgent.length || soon.length) {
      box.innerHTML = urgent.join("") + soon.join("");
    } else if (orgs.length) {
      box.innerHTML = '<div class="adm-alert green">✅ كل الاشتراكات سليمة — لا توجد تنبيهات حاليًا.</div>';
    } else {
      box.innerHTML = "";
    }
  }

  // ===== بحث لوحة الإدارة (بناء 110) =====
  // التطبيع العربي موجود في normalizeAr — نضيف عليه ضغط المسافات عشان البحث متعدد الكلمات
  function admNorm(s) {
    return normalizeAr(s).replace(/\s+/g, " ").trim();
  }
  function admDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }
  function admFilterValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }
  // صندوق «الاسم أو التليفون»: رقم → يطابق التليفون، حرف → يطابق اسم الشركة أو اسم المسئول
  function adminOrgMatches(o, qOrg, qUser) {
    if (qOrg) {
      const digits = qOrg.replace(/\D/g, "");
      const text = qOrg.replace(/[0-9\-+().]/g, "").trim();
      let hit = false;
      if (digits && admDigits(o.org_phone).indexOf(digits) !== -1) hit = true;
      if (!hit && text) {
        if (admNorm(o.org_name).indexOf(text) !== -1) hit = true;
        else if (admNorm(o.owner_name).indexOf(text) !== -1) hit = true;
      }
      if (!hit) return false;
    }
    if (qUser && admNorm(o.admin_username).indexOf(qUser) === -1) return false;
    return true;
  }

  function paintAdminOrgTable(orgs) {
    const box = $("#adminList");
    if (!box) return;
    const list = orgs || adminOrgsCache || [];
    const qOrg = admNorm(admFilterValue("admSearchOrg"));
    const qUser = admNorm(admFilterValue("admSearchUser"));
    const searching = !!(qOrg || qUser);
    const filtered = searching ? list.filter((o) => adminOrgMatches(o, qOrg, qUser)) : list;
    const info = $("#admSearchInfo");
    if (info) info.textContent = searching ? ("🔎 " + filtered.length + " من " + list.length + " شركة") : "";
    if (!list.length) {
      box.innerHTML = '<p class="login-sub">لا توجد شركات بعد.</p>';
      return;
    }
    if (!filtered.length) {
      box.innerHTML = '<p class="login-sub">لا توجد شركة مطابقة لبيانات البحث — جرّب اسمًا أقصر أو رقم تليفون جزئي.</p>';
      return;
    }
    let h = '<p class="login-sub" style="margin-bottom:8px">💡 اضغط على أي شركة <b>ضغطتين</b> (دبل كليك) لفتح شاشة بياناتها وتعديلها في أي وقت.</p>' +
      '<table class="data-table"><thead><tr>' +
      '<th>الشركة</th><th>يوزر نيم</th><th>تليفون المسئول</th><th>المالك</th><th>الأعضاء</th><th>من تاريخ</th><th>إلى تاريخ</th>' +
      '<th>الحالة</th><th>آخر اتصال</th><th>المزايا</th><th>إجراءات</th></tr></thead><tbody>';
    filtered.forEach((o) => {
      // 🛡 بند 17: حالة الصف من مصدر التصنيف الواحد (شركة المالك = نشطة بلا تاريخ)
      const status = subStatusBadge(o);
      h += "<tr data-org=\"" + o.org_id + "\" onclick=\"window.__admDbl('" + o.org_id + "')\" style=\"cursor:pointer\" title=\"اضغط ضغطتين لتعديل بيانات الشركة\">" +
        "<td><b>" + (o.org_name || "بدون اسم") + (o.protected ? ' <span class="badge-ok" title="شركة المالك — محمية من الحذف">🔒</span>' : "") + "</b></td>" +
        "<td><code>" + (o.admin_username || "—") + "</code></td>" +
        "<td>" + (o.org_phone || "—") + "</td>" +
        "<td>" + (o.owner_name || "—") + "</td>" +
        "<td>" + (o.members || 0) + " / " + (o.max_members || 5) + "</td>" +
        "<td>" + subDateCell(o, o.plan_start) + "</td>" +
        "<td>" + subDateCell(o, o.plan_end) + "</td>" +
        "<td>" + status + "</td>" +
        '<td style="white-space:nowrap">' + (o.online
          ? '<span style="color:var(--success);font-weight:800">🟢 متصل الآن</span>'
          : '<span style="color:#ff5b5b;font-weight:800">' + (o.last_seen ? fmtDateTime(o.last_seen) : "لم يتصل بعد") + "</span>") + "</td>" +
        "<td><button class=\"btn small teal\" type=\"button\" onclick=\"event.stopPropagation();window.__admFeats('" + o.org_id + "')\">⚙️ المزايا</button>" +
        // 🆕 بناء 131: الملخص بيتحسب من المحفوظ على القاعدة ⇒ المالك يشوف تحديده
        // قدامه في الجدول، مش جوه النافذة بس (ولو القراءة تعذرت يظهر «—»).
        "<div class=\"login-sub\" style=\"margin-top:4px\">" + orgFeatsSummary(o.org_id) + "</div></td>" +
        "<td><button class=\"btn small blue\" type=\"button\" onclick=\"event.stopPropagation();window.__admDbl('" + o.org_id + "')\">✏️ بيانات الشركة</button> " +
        (o.protected
          ? '<span class="login-sub" title="شركة رئيسية تخص المالك">🔒 لا تُحذف</span>'
          : "<button class=\"btn small red\" type=\"button\" onclick=\"event.stopPropagation();window.__admDel('" + o.org_id + "')\">🗑 حذف</button>") +
        "</td>" +
        "</tr>";
    });
    h += "</tbody></table>";
    box.innerHTML = h;
  }

  function renderAdminOrgs() {
    const box = $("#adminList");
    box.innerHTML = '<p class="login-sub">جارٍ تحميل الشركات...</p>';
    // 🆕 بناء 131: نقرأ مزايا الشركات الأول (قراءة واحدة، `loadOrgFeats` ما بيرفضش)
    // عشان عمود «المزايا» يورّي المحفوظ فعلًا مش كلام عام.
    Promise.all([loadOrgFeats(), DATA.adminOrgs()]).then((res) => {
      const list = res[1] || [];
      renderAdminStats(list);
      renderAdminAlerts(list);
      paintAdminOrgTable(list);
    }).catch((e) => {
      box.innerHTML = '<p class="login-msg err">تعذّر تحميل الشركات: ' + (e.message || e) + "</p>";
    });
  }

  /* ================== 🎟️ بناء 141: رموز الدعوة (المالك ومساعدوه) ==================
     قرار المالك الحرفي (04/10): «عجبتني فكرة انشاء رمز عشوائي نفّذه، وخلّي أعضاء شركة
     ميزان يقدروا يولدوا رمز عشوائي برده — شركة ميزان هي الشركة المالكة والأعضاء اللي
     هضيفهم فيها هما مساعدين ليا». ⇒ الصلاحية من **مصدر واحد**:
       `inviteCodesAllowed() = ownerSettingsAllowed()` (مالك البرنامج أو حساب في شركة «ميزان»)
     ونفس مصدر build 133 اللي بيحكم شاشة «الإعدادات (المالك)» — فمافيش تعريف تاني ولا
     مفتاح في قائمة مزايا يقدر يفتّح الباب لحساب تاني. والرفض بيتعمل **جوه الدوال** كمان
     (طبقة ثانية زي درس build 121/133)، مش اعتماد على إن الزرار مخفي. */
  function inviteCodesAllowed() { return ownerSettingsAllowed(); }
  let inviteCodesCache = [];
  let inviteCodesVia = "table";

  function invWaLink(o) {
    const txt = "برنامج ميزان للمحاسبة ⚖️\n" +
      "الشركة: " + (o.org_name || "") + "\n" +
      "رمز الانضمام: " + (o.invite_code || "") + "\n\n" +
      "افتح البرنامج ← اكتب اسم المستخدم وكلمة المرور بتاعك ← اكتب رمز الانضمام ده.";
    return "https://wa.me/?text=" + encodeURIComponent(txt);
  }
  // نص ودّي لفشل «توليد رمز جديد» — نفس قاعدة build 127: مافيش اصطلاح تقني يوصل للعين
  function inviteWriteFailText(err) {
    const m = String((err && (err.message || err.code || err)) || "");
    if (/غير مصرح|مرفوض|permission|denied|صلاحية/i.test(m)) {
      return "الحساب ده مش عنده صلاحية يغيّر الرمز — ده لمالك البرنامج ومساعِديه.";
    }
    if (/الشركة غير موجودة|not found/i.test(m)) return "الشركة دي مش ظاهرة دلوقتي — دوس تحديث القائمة.";
    return "تعذّر تغيير الرمز دلوقتي — اتأكد من الاتصال وعاود، ولو استمر تابع مع مالك البرنامج.";
  }
  function legacyCopy(text, done) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      const ok = !!(document.execCommand && document.execCommand("copy"));
      document.body.removeChild(ta);
      if (ok) done();
      else toast("اتنسخ الرمز بإيدك: " + text, "info");
    } catch (e) { toast("اتنسخ الرمز بإيدك: " + text, "info"); }
  }
  function copyInviteCode(orgId) {
    const o = (inviteCodesCache || []).find((x) => x.org_id === orgId);
    const code = (o && o.invite_code) || "";
    if (!code) { toast("الرمز مالوش ظهور الشركة دي دلوقتي — دوس تحديث القائمة الأول", "warning"); return; }
    const done = () => toast("اتنسخ رمز «" + (o.org_name || "") + "»: " + code, "ok");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, () => legacyCopy(code, done));
        return;
      }
    } catch (e) { }
    legacyCopy(code, done);
  }

  function paintInviteCodes(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (!inviteCodesAllowed()) { box.innerHTML = ""; return; } // 🛡 fail-closed
    const rows = inviteCodesCache || [];
    if (!rows.length) {
      box.innerHTML = '<p class="login-sub">لا توجد شركات بعد — أو لم تصل الرموز لهذا الحساب.</p>';
      return;
    }
    let h = '<div class="panel-title">🎟️ رموز الدعوة — انسخ وابعت على واتس</div>' +
      '<p class="stk-hint">كل شركة ليها رمز. ابعت الرمز للعميل على واتس، ويكتبه عند الدخول فيدخل شركته. ' +
      '«🎲 رمز عشوائي جديد» بيلغي الرمز القديم ويطلّع واحد بدلُه. ' +
      '<b>مافيش زرار «شركة جديدة» في البرنامج: الحساب ما يدخلش غير برمز من عندك.</b></p>' +
      (inviteCodesVia === "table" && !isSuperAcct()
        ? '<p class="stk-hint">الحساب ده بيشوف رمز شركته بس — عرض كل الشركات بكل رموزها بيشتغل بعد ما مالك البرنامج يفعّل التحديث الصغير في السحابة.</p>'
        : "") +
      '<table class="data-table"><thead><tr><th>الشركة</th><th>رمز الدعوة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
    rows.forEach((o) => {
      const code = String(o.invite_code || "");
      h += "<tr>" +
        "<td><b>" + esc(o.org_name || "بدون اسم") + "</b></td>" +
        "<td><code style=\"font-size:15px;font-weight:800;letter-spacing:2px\">" + esc(code || "—") + "</code></td>" +
        "<td>" + (o.plan_status === "active" ? '<span class="badge-ok">🟢 نشطة</span>' : "⏳ " + esc(o.plan_status || "—")) + "</td>" +
        '<td style="white-space:nowrap">' +
        '<button class="btn small blue" type="button" onclick="window.__invCopy(\'' + o.org_id + "')\">📋 انسخ الرمز</button> " +
        '<a class="btn small green" href="' + invWaLink(o) + '" target="_blank" rel="noopener">🟢 واتس</a> ' +
        '<button class="btn small orange" type="button" onclick="window.__invNew(\'' + o.org_id + "')\">🎲 رمز جديد</button>" +
        "</td></tr>";
    });
    h += "</tbody></table>";
    box.innerHTML = h;
  }

  // قراية الرموز: `adminInviteCodes` بتجرب دالة definer الأول وبعدين تقرأ الجدول مباشرة
  // (السياسة بترجّع للمالك كل الصفوف، ولأي حساب تاني صفّ شركته) ⇒ بشتغل من النهاردة
  // وبلا أي كتابة سحابية. الفشل الشبكة = نص ودّي، ومافيش أي رسالة من القاعدة بوجهها.
  function loadInviteCodes(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (!inviteCodesAllowed()) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="login-sub">جارٍ تحميل الرموز...</p>';
    DATA.adminInviteCodes().then((res) => {
      inviteCodesCache = (res && res.rows) || [];
      inviteCodesVia = (res && res.via) || "table";
      paintInviteCodes(boxId);
      paintInviteCodes(boxId === "adminCodes" ? "invCodesOwner" : "adminCodes");
    }).catch(() => {
      inviteCodesCache = [];
      box.innerHTML = '<p class="login-msg err">تعذّر قراءة الرموز دلوقتي — دوس «🔄 تحديث القائمة»، ولو استمر تابع مع مالك البرنامج.</p>';
      paintInviteCodes(boxId === "adminCodes" ? "invCodesOwner" : "adminCodes");
    });
  }

  window.__invCopy = function (orgId) { copyInviteCode(orgId); };

  window.__invNew = function (orgId) {
    if (!inviteCodesAllowed()) { toast("توليد الرموز لمالك البرنامج ومساعِديه فقط", "error"); return; }
    const o = (inviteCodesCache || []).find((x) => x.org_id === orgId);
    DATA.adminRotateInvite(orgId).then((r) => {
      if (r && r.unavailable) {
        toast("تغيير الرمز هيشتغل بعد ما مالك البرنامج يفعّل التحديث الصغير في السحابة — الرمز الحالي شغال زي ما هو", "info");
        return;
      }
      if (r && r.code) {
        toast("اتعمل رمز جديد لـ«" + ((o && o.org_name) || "الشركة") + "»: " + r.code, "ok");
      }
      loadInviteCodes("adminCodes");
      loadInviteCodes("invCodesOwner");
    }).catch((e) => toast(inviteWriteFailText(e), "error"));
  };

  // الكتابة في صندوق البحث تعيد الرسم من الكاش فقط — بدون طلب شبكة جديد
  function onAdminSearchInput() {
    if (document.getElementById("adminList")) paintAdminOrgTable();
  }

  // 🆕 بناء 119: كاش أعضاء آخر شاشة أعضاء مفتوحة (السوبر أدمن/اليوزر نيم) — عشان
  // تأكيد الحذف يذكر الحساب بالاسم، واللوحة تتحدث بعد الحذف في مكانها.
  let adminMembersCache = [];
  let lastAdminMembersOrg = null;

  window.__admMembers = function (orgId) {
    const box = $("#adminDetail");
    $("#adminDetail").hidden = false;
    $("#adminDetailTitle").textContent = orgId;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    const cont = $("#adminMembers");
    cont.innerHTML = '<p class="login-sub">جارٍ تحميل الأعضاء...</p>';
    DATA.adminMembers(orgId).then((users) => {
      if (!users || !users.length) { adminMembersCache = []; lastAdminMembersOrg = orgId; cont.innerHTML = '<p class="login-sub">لا يوجد أعضاء.</p>'; return; }
      adminMembersCache = users; lastAdminMembersOrg = orgId;
      // 🆕 بناء 119: لوحة الأعضاء كانت بالحظر بس ⇒ أضفنا اليوزر نيم وزرار الحذف النهائي
      // (نفس زرار شاشة بيانات الشركة) عشان المالك يلاقيه من أول مكان.
      let h = '<table class="data-table"><thead><tr><th>العضو</th><th>يوزر نيم</th><th>الصلاحية</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
      const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
      users.forEach((u) => {
        const isMe = myUid && u.user_id === myUid;
        const canDel = !isMe && !u.is_superadmin;
        h += "<tr><td>" + (u.full_name || "—") + (isMe ? " <b>(أنت)</b>" : "") + "</td>" +
          "<td><code>" + (u.username || "—") + "</code></td>" +
          "<td>" + roleLabel(u) + (u.is_superadmin ? " 🔑" : "") + "</td>" +
          "<td>" + (u.blocked ? "🔴 محظور" : "🟢 نشط") + "</td>" +
          "<td style=\"white-space:nowrap\">" +
          (isMe ? "<span class=\"login-sub\">لا يمكنك حظر نفسك</span>"
            : "<button class=\"btn small " + (u.blocked ? "green" : "red") + "\" type=\"button\" onclick=\"window.__admUser('" + u.user_id + "'," + (u.blocked ? "false" : "true") + ")\">" + (u.blocked ? "✅ إلغاء الحظر" : "⛔ حظر") + "</button> ") +
          (canDel ? "<button class=\"btn small red\" type=\"button\" onclick=\"window.__admDelMember('" + u.user_id + "')\">🗑️ حذف الحساب</button>" : "") +
          "</td></tr>";
      });
      h += "</tbody></table>";
      cont.innerHTML = h;
    }).catch((e) => { cont.innerHTML = '<p class="login-msg err">' + (e.message || e) + "</p>"; });
  };

  window.__admUser = function (userId, blocked) {
    DATA.adminSetUser(userId, blocked).then(() => {
      toast(blocked ? "تم حظر العضو" : "تم إلغاء الحظر", "ok");
      renderAdminOrgs();
      const om = document.getElementById("orgModal");
      if (om && om.__orgId) loadOrgMembers(om.__orgId, "#omMembers", om);
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  window.__admSave = function (orgId) {
    // 🛡 بند 17: حصانة تانية — أي مسار حفظ قديم ما بعتش تاريخ لشركة المالك
    const oRow = (adminOrgsCache || []).find((x) => x.org_id === orgId);
    if (subDatesWriteLocked(oRow)) { toast("شركتك محمية — مافيش تاريخ اشتراك بيتحفظ لها", "warning"); return; }
    const tr = document.querySelector('#adminList tr[data-org="' + orgId + '"]');
    if (!tr) return;
    // الجدول بقى بيعرض التواريخ كنص (بند 17) ⇒ لو الخانات مش موجودة مانكتبشش خالص
    const sEl = tr.querySelector(".adm-plan-start");
    const eEl = tr.querySelector(".adm-plan-end");
    if (!sEl || !eEl) return;
    const start = sEl.value || null;
    const end = eEl.value || null;
    const locked = tr.querySelector(".adm-status").value === "locked";
    DATA.adminSetOrg(orgId, start, end, locked, null).then(() => {
      toast("تم حفظ إعدادات الشركة", "ok");
      renderAdminOrgs();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // حذف شركة من الإدارة بخيارين: حذف اليوزرات فقط أو الشركة كاملة ببياناتها
  window.__admDel = function (orgId) {
    DATA.adminOrgs().then((orgs) => {
      const o = orgs.find((x) => x.org_id === orgId);
      const name = (o && o.org_name) || "بدون اسم";
      const dlg = document.createElement("div");
      dlg.className = "modal-overlay";
      dlg.id = "delOrgModal";
      dlg.innerHTML = '<div class="modal-box"><div class="panel-title">🗑 حذف شركة: <b>' + name + "</b></div>" +
        '<p class="login-sub" style="margin-bottom:10px">اختر نوع الحذف:</p>' +
        '<div class="feat-btns" style="flex-direction:column;gap:8px;align-items:stretch">' +
        '<button class="btn orange" type="button" id="delUsersBtn">👤 حذف يوزرات الشركة فقط (تبقى البيانات محفوظة)</button>' +
        '<button class="btn red" type="button" id="delFullBtn">💥 حذف الشركة كاملة بكل بياناتها المخزنة</button>' +
        '<button class="btn gray" type="button" id="delCancel">إلغاء</button>' +
        "</div></div>";
      document.body.appendChild(dlg);
      dlg.querySelector("#delUsersBtn").addEventListener("click", () => {
        dlg.remove();
        if (!confirm("حذف يوزرات/حسابات شركة «" + name + "»؟\nستبقى بيانات الشركة محفوظة ولكن لن يستطيع أحد الدخول إليها.")) return;
        DATA.adminDeleteOrg(orgId, "users").then((res) => {
          toast("تم حذف يوزرات الشركة", "ok");
          renderAdminOrgs();
        }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
      });
      dlg.querySelector("#delFullBtn").addEventListener("click", () => {
        dlg.remove();
        if (!confirm("حذف شركة «" + name + "» نهائيًا بكل بياناتها المخزنة (عملاء، مبيعات، حسابات...)?\nسيتم أولًا حفظ نسخة احتياطية كاملة على جهازك لتستعيدها في أي وقت.\nملاحظة: الملف يحفظ بيانات الشركة (وليس حسابات أعضائها) — لو رجّعتها لاحقًا ستعيد إنشاء حساب الدخول من الإدارة.\nلا يمكن التراجع عن الحذف من السحابة.")) return;
        toast("جارٍ تجهيز النسخة الاحتياطية قبل الحذف...", "info");
        // 🆕 بناء 124: نسخة ما قبل الحذف بتتبني من اللقطة الشاملة (٣٦ جدول)، ولو أي
        // جدول ناقص فيها الحذف بيترفض — مامنعش شركة تتحذف بسبب نسخة احتياطية أنقص منها
        ownerBackupPack(orgId).then((pack) => {
          if (!pack) throw new Error("لا توجد بيانات قابلة للنسخ الاحتياطي");
          const cov = backupCoverage(pack, ORG_SCOPE);
          if (cov.missing.length) throw new Error("النسخة الاحتياطية ما شملتش: " + cov.missing.join("، ") + " — الحذف مرفوض");
          const covTxt = coverageNote(cov);
          const jsonStr = JSON.stringify(pack, null, 2);
          const blob = new Blob([jsonStr], { type: "application/json" });
          const safeName = (name || "شركة").replace(/[\\/:*?"<>|]/g, "_").trim() || "شركة";
          const fname = "mizan-company-backup-" + safeName + "-" + (todayISO ? todayISO() : new Date().toISOString().slice(0, 10)) + ".json";
          const saveFile = (resolve) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fname;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            resolve(true);
          };
          const finishSave = () => (DATA.adminDeleteOrg(orgId, "full")
            .then(() => { toast("تم حفظ النسخة الاحتياطية على جهازك — " + coverageNote(backupCoverage(pack, ORG_SCOPE)) + " — وحُذفت الشركة نهائيًا من السحابة.", "ok"); })
            .catch((e) => { toast("خُزّنت النسخة الاحتياطية، لكن تعذّر حذف الشركة: " + (e.message || e), "error"); })
            .then(() => renderAdminOrgs()));
          if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
              suggestedName: fname,
              types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
            }).then((handle) => {
              return handle.createWritable().then((w) => w.write(blob).then(() => w.close()));
            }).then(() => {
              finishSave();
            }).catch((e) => {
              if (e && e.name === "AbortError") { toast("تم إلغاء الحفظ — لم تُحذف الشركة.", "warning"); return; }
              saveFile(() => finishSave());
            });
          } else {
            finishSave();
          }
        }).catch((e) => toast("خطأ في تجهيز النسخة الاحتياطية: " + (e.message || e), "error"));
      });
      dlg.querySelector("#delCancel").addEventListener("click", () => dlg.remove());
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // نافذة منبثقة لاختيار المزايا لكل شركة
  window.__admFeats = function (orgId) {
    DATA.adminOrgs().then((orgs) => {
      const o = orgs.find((x) => x.org_id === orgId) || {};
      DATA.requestAccess().catch(() => {});
      // 🆕 بناء 131: الصناديق تتعبّى من **المحفوظ فعلًا** (`organizations.features`)،
      // مش «checked» على طول. قبل كده كان أي فتح للنافذة + حفظ بيرجّع الشركة
      // «كل الصلاحيات» وبيمسح تحديد المالك القديم — وده حرفي الشكوى.
      const ready = (ORG_FEAT_MAP && (orgId in ORG_FEAT_MAP)) ? Promise.resolve(true) : loadOrgFeats();
      ready.then(() => {
        let opts = "";
        // 🔑 بناء 133: «الإعدادات (المالك)» اتشالت من اختيارات مزايا الشركات — دي مش
        // صلاحية يتداولها أصحاب المؤسسات، هي لحسابات شركة ميزان (المصدر: `chooserFeatures`).
        chooserFeatures().forEach(([k, label]) => {
          opts += "<label class=\"feat-line\"><input type=\"checkbox\" class=\"adm-feat\" value=\"" + k + "\" " + (orgFeatState(orgId, k) ? "checked" : "") + " /> " + label + "</label>";
        });
        const body = "<div class=\"feat-grid\">" + opts + "</div>" +
          "<p class=\"login-sub\" style=\"margin-top:8px\">✅ اللي بتقفلوه بيفضل مقفول على كل حسابات الشركة (ومقفول حتى على صاحب الشركة).<br>🔑 «إعدادات المالك» مش في القائمة دي — دي لحسابات شركة ميزان ومالك البرنامج فقط، ومحدش يقدر يفتحها أو يقفلها لحد.</p>" +
          "<div class=\"feat-btns\"><button class=\"btn green\" type=\"button\" id=\"admFeatSave\">حفظ المزايا</button>" +
          "<button class=\"btn gray\" type=\"button\" id=\"admFeatCancel\">إلغاء</button></div>";
        const dlg = document.createElement("div");
        dlg.className = "modal-overlay";
        dlg.id = "featModal";
        dlg.innerHTML = '<div class="modal-box"><div class="panel-title">المزايا المفتوحة — ' + (o.org_name || "") + "</div>" + body + "</div>";
        document.body.appendChild(dlg);
        dlg.querySelector("#admFeatCancel").onclick = () => dlg.remove();
        dlg.querySelector("#admFeatSave").onclick = () => {
          const on = {};
          dlg.querySelectorAll(".adm-feat").forEach((c) => { on[c.value] = c.checked; });
          // 🔑 بناء 133: مفتاح «إعدادات المالك» لو كان محفوظًا بيعدي زي ما هو (صفر تغيير
          // في بيانات موجودة) — بس بقى بلا معنى في الواجهة والبوابة مستقلة عنه.
          carryOwnerOnlyFeats(on, (ORG_FEAT_MAP && ORG_FEAT_MAP[orgId]) || {});
          // 🆕 بناء 131: `mizan_admin_set_org` بتكتب `plan_end` بلا coalesce ⇒ لازم
          // نعيد نفس تواريخ الشركة وحالة قفلها، ومينفعش نبعتهم فاضيين وإلا الحفظ
          // ده كان بيمسح «إلى تاريخ» الاشتراك ويخلي الشركة نشطة للأبد.
          DATA.adminSetOrg(orgId, o.plan_start || null, o.plan_end || null, o.locked, on).then(() => {
            toast("تم حفظ المزايا", "ok");
            if (ORG_FEAT_MAP) ORG_FEAT_MAP[orgId] = on;
            dlg.remove();
            renderAdminOrgs();
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
      });
    });
  };

  function openAdmin() {
    // 🛡 بناء 121: بوابة أولى قبل أي رسم/نداء — اللوحة للمالك (سوبر أدمن) فقط.
    // (مش كفاية إن الزرار مخفي: أي مسار مستقبلي ينادي openAdmin ما يفتحش بيانات الشركات)
    if (!(ownerHasAllAccess() || !!window.__isOwner)) {
      toast("لوحة الإدارة لحساب المالك فقط", "error");
      showView("dashboard");
      return;
    }
    hideScreens();
    $("#denyScreen").hidden = true;
    renderAdminOrgs();
    // 🎟️ بناء 141: رموز الدعوة بتظهر تحت جدول الشركات على طول (المالك بيشوف الكل)
    loadInviteCodes("adminCodes");
    showView("admin");
    startPresenceView();
    const p = DATA.getProfile();
    // 🧭 بناء 126: التسمية من نفس المصدر الوحيد (دولي هنا = «مالك البرنامج»)
    var adminRow = (p && p.role) ? p : ((DATA.accessInfo ? DATA.accessInfo() : null) || p);
    setUserInfo("👤 " + (p && p.full_name ? p.full_name : DATA.email()) + " | الصلاحية: " + roleLabel(adminRow));
  }

  // شاشة بيانات الشركة (ضغط مزدوج)
  function loadOrgMembers(orgId, boxSel, dlg) {
    const box = document.querySelector(boxSel);
    if (!box) return;
    box.innerHTML = '<p class="login-sub">جارٍ تحميل الأعضاء...</p>';
    DATA.adminMembers(orgId).then((users) => {
      adminMembersCache = users || []; lastAdminMembersOrg = orgId;
      if (!users || !users.length) { box.innerHTML = '<p class="login-sub">لا يوجد أعضاء.</p>'; return; }
      const adminUser = users.find((u) => isCompanyOwnerRow(u));
      if (dlg) dlg.__adminId = adminUser ? adminUser.user_id : null;
      let h = '<table class="data-table"><thead><tr><th>العضو</th><th>يوزر نيم</th><th>الصلاحية</th><th>المزايا</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
      const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
      users.forEach((u) => {
        const isMe = myUid && u.user_id === myUid;
        // 🛡 حساب المالك (سوبر أدمن) أو حسابي: بلا زرار حذف نهائيًا
        const canDel = !isMe && !u.is_superadmin;
        h += "<tr>" +
          "<td>" + (u.full_name || "—") + (isMe ? " <b>(أنت)</b>" : "") + "</td>" +
          "<td><code>" + (u.username || "—") + "</code></td>" +
          "<td>" + roleLabel(u) + (u.is_superadmin ? " 🔑" : "") + "</td>" +
          "<td>" + featsSummary(u.features, chooserFeatures()) + "</td>" +
          "<td>" + (u.blocked ? "🔴 محظور" : "🟢 نشط") + "</td>" +
          "<td>" +
          "<button class=\"btn small sky\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admResetPw('" + u.user_id + "')\">🔑 تغيير كلمة المرور</button>" +
          "<button class=\"btn small blue\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admRenameUser('" + u.user_id + "')\">✏️ تغيير اليوزر نيم</button>" +
          (isMe ? "<span class=\"login-sub\" style=\"margin:2px\">لا يمكنك حظر نفسك</span>"
            : "<button class=\"btn small " + (u.blocked ? "green" : "red") + "\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admUser('" + u.user_id + "'," + (u.blocked ? "false" : "true") + ");\">" + (u.blocked ? "✅ إلغاء الحظر" : "⛔ حظر") + "</button>") +
          (canDel ? "<button class=\"btn small red\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admDelMember('" + u.user_id + "')\">🗑️ حذف</button>" : "") +
          "</td></tr>";
      });
      h += "</tbody></table>";
      box.innerHTML = h;
    }).catch((e) => { box.innerHTML = '<p class="login-msg err">' + (e.message || e) + "</p>"; });
  }

  /* ================== شاشة بيانات الشركة (ضغط مزدوج) ================== */
  window.__admDbl = function (orgId) {
    // لا نُكوّم النوافذ: إن كانت النافذة مفتوحة نشكّل بياناتها للشركة الجديدة في نفس مكانها
    DATA.adminOrgs().then((orgs) => {
      const o = orgs.find((x) => x.org_id === orgId);
      if (!o) { toast("الشركة غير موجودة", "error"); return; }
      let dlg = document.getElementById("orgModal");
      const reusable = !!dlg;
      if (!dlg) {
        dlg = document.createElement("div");
        dlg.className = "modal-overlay";
        dlg.id = "orgModal";
        dlg.__orgId = orgId;
        dlg.innerHTML = '<div class="modal-box">' +
          '<div class="panel-title">🏢 بيانات الشركة: <b id="omNameTitle"></b></div>' +
          '<div class="feat-grid" style="grid-template-columns:1fr 1fr">' +
          '<label class="feat-line">اسم الشركة <input id="omName" class="inp" style="flex:1" /></label>' +
          '<label class="feat-line">الحد الأقصى للأعضاء <input id="omMax" class="inp" type="number" min="1" max="500" style="flex:1;width:60px" /></label>' +
          '<label class="feat-line">رقم تليفون المسئول <input id="omPhone" class="inp" type="tel" placeholder="01xxxxxxxxx" style="flex:1" /></label>' +
          '<label class="feat-line">يوزر نيم (حساب الشركة) <code id="omUser" style="font-size:13px"></code> <button class="btn small sky" type="button" id="omUserEdit">✏️ تغيير اليوزر نيم</button></label>' +
          '<label class="feat-line">كلمة المرور <button class="btn small orange" type="button" id="omAdminReset">🔑 تغيير كلمة مرور مالك الشركة</button></label>' +
          '<label class="feat-line" id="omStartWrap">الاشتراك من <input id="omStart" class="inp" type="date" style="flex:1" /></label>' +
          '<label class="feat-line" id="omEndWrap">الاشتراك إلى <input id="omEnd" class="inp" type="date" style="flex:1" /></label>' +
          '<label class="feat-line" id="omSubNote" hidden>🔒 شركتك محمية <span class="login-sub">بلا تاريخ اشتراك — وممنوع حفظ أي تاريخ نهاية ليها عشان تقفل حسابك</span></label>' +
          '<label class="feat-line">حالة الشركة <select id="omStatus" class="inp" style="flex:1"><option value="active">نشطة</option><option value="locked">مقفلة</option></select></label>' +
          '<label class="feat-line"><button class="btn green" type="button" id="omSave">💾 حفظ بيانات الشركة</button></label>' +
          '</div>' +
          '<div class="panel-title" style="margin-top:14px">👥 أعضاء الشركة</div>' +
          '<div id="omMembers" class="tbl-wrap" style="max-height:40vh;overflow:auto"></div>' +
          '<div class="panel-title" style="margin-top:14px">➕ إضافة عضو جديد</div>' +
          '<div class="feat-grid" style="grid-template-columns:repeat(4,1fr)">' +
          '<input id="omNewUser" class="inp" placeholder="يوزر نيم (latin)" />' +
          '<input id="omNewPass" class="inp" type="password" placeholder="كلمة المرور" />' +
          '<input id="omNewName" class="inp" placeholder="الاسم المعروض (اختياري)" />' +
          '<button class="btn green" type="button" id="omNewAdd">إضافة العضو</button>' +
          '</div>' +
          '<div class="feat-btns"><button class="btn gray" type="button" id="omClose">إغلاق</button></div>' +
          '</div>';
        document.body.appendChild(dlg);
      }
      dlg.__orgId = orgId;
      // 🛡 بند 17: شركة المالك = النوافذ والتواريخ مقفولة (النافذة بيتعاد استخدامها)
      dlg.__protected = isProtectedOrg(o);

      const q = (sel) => dlg.querySelector(sel);
      q("#omNameTitle").textContent = o.org_name || "";
      q("#omName").value = o.org_name || "";
      q("#omMax").value = o.max_members || 5;
      q("#omPhone").value = o.org_phone || "";
      q("#omUser").textContent = o.admin_username || "—";
      const lockDates = subDatesWriteLocked(o);
      const wStart = q("#omStartWrap"), wEnd = q("#omEndWrap"), wNote = q("#omSubNote");
      if (wStart) wStart.hidden = lockDates;
      if (wEnd) wEnd.hidden = lockDates;
      if (wNote) wNote.hidden = !lockDates;
      // شركة محمية: مانحطش حتى قيمة مخفية في الـ input (ممنوع أي مسار يبعته)
      q("#omStart").value = lockDates ? "" : fmtDate(o.plan_start);
      q("#omEnd").value = lockDates ? "" : fmtDate(o.plan_end);
      q("#omStatus").value = o.locked ? "locked" : "active";

      const loadMembers = () => loadOrgMembers(orgId, "#omMembers", dlg);
      loadMembers();

      if (!reusable) {
        q("#omSave").onclick = () => {
          const curOrg = dlg.__orgId;
          const name = q("#omName").value.trim();
          const max = parseInt(q("#omMax").value, 10);
          const phone = q("#omPhone").value.trim();
          // 🛡 بند 17: شركة المالك ⇒ null/null، و`mizan_admin_set_sub` بتعمل coalesce
          // فالتواريخ المحفوظة ما تتلمسش (وهي أصلاً null) — مستحيل يتحفظ تاريخ نهاية يقفله.
          const lockDates = !!dlg.__protected;
          const start = lockDates ? null : (q("#omStart").value || null);
          const end = lockDates ? null : (q("#omEnd").value || null);
          const locked = q("#omStatus").value === "locked";
          Promise.all([
            DATA.adminEditOrg(curOrg, name || null, max || null, phone || null),
            DATA.adminSetOrg(curOrg, start, end, locked, null)
          ]).then(() => {
            toast("تم حفظ بيانات الشركة", "ok");
            dlg.remove();
            renderAdminOrgs();
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
        q("#omAdminReset").onclick = () => {
          const curOrg = dlg.__orgId;
          const curName = dlg.querySelector("#omNameTitle") ? dlg.querySelector("#omNameTitle").textContent : "الشركة";
          DATA.adminMembers(curOrg).then((users) => {
            const admin = users.find((u) => isCompanyOwnerRow(u));
            if (!admin) { createAdminPrompt(curOrg, curName); return; }
            resetPwPrompt(admin.user_id, "كلمة مرور مالك الشركة", true);
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
        q("#omUserEdit").onclick = () => {
          const curOrg = dlg.__orgId;
          DATA.adminMembers(curOrg).then((users) => {
            const admin = users.find((u) => isCompanyOwnerRow(u));
            if (!admin) { createAdminPrompt(curOrg, dlg.querySelector("#omNameTitle") ? dlg.querySelector("#omNameTitle").textContent : "الشركة"); return; }
            renameUserPrompt(admin.user_id, admin.username);
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
        q("#omNewAdd").onclick = () => {
          const curOrg = dlg.__orgId;
          const nu = q("#omNewUser").value.trim();
          const np = q("#omNewPass").value;
          const nn = q("#omNewName").value.trim() || null;
          if (!nu || !np) { toast("اكتب يوزر نيم وكلمة مرور للعضو", "error"); return; }
          DATA.adminCreateUser(curOrg, nu, np, nn, "member").then(() => {
            toast("تمت إضافة العضو", "ok");
            q("#omNewUser").value = "";
            q("#omNewPass").value = "";
            q("#omNewName").value = "";
            loadMembers();
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
        q("#omClose").onclick = () => dlg.remove();
        dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.remove(); });
      }
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // حذف عضو واحد نهائيًا من القاعدة (يتحرر اسمه بعد الحذف ويمكن إعادة استخدامه)
  window.__admDelMember = function (userId) {
    if (!userId) return;
    const u = (adminMembersCache || []).find((x) => x.user_id === userId) || {};
    const who = (u.username || u.full_name || "هذا الحساب");
    if (!confirm("حذف حساب «" + who + "» نهائيًا من قاعدة النظام؟\nبعد الحذف يمكنك إضافة حساب جديد بنفس اليوزر نيم أو كلمة المرور.\nلا يمكن التراجع عن هذه العملية.")) return;
    DATA.adminDeleteMember(userId).then(() => {
      toast("تم حذف الحساب نهائيًا: " + who, "ok");
      const om = document.getElementById("orgModal");
      if (om && om.__orgId) loadOrgMembers(om.__orgId, "#omMembers", om);
      // 🆕 بناء 119: لو لوحة الأعضاء تحت جدول الشركات مفتوحة، تتحدّث هي كمان
      if (lastAdminMembersOrg && !document.getElementById("adminDetail").hidden) {
        __admMembers(lastAdminMembersOrg);
      }
      renderAdminOrgs();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // نافذة تغيير كلمة مرور أي مستخدم (من المالك) — 3 خانات: الحالية معبأة تلقائيًا، الجديدة، التأكيد
  window.__admResetPw = function (userId) {
    resetPwPrompt(userId, "تغيير كلمة المرور");
  };

  function resetPwPrompt(userId, title, prefill) {
    // 🔑 الهدف = حسابك انت؟ → ده غير مسموح في الدالة نفسها (بتمسح جلساتك)،
    // فنفتح نافذة «تغيير كلمة مرورك» بدل ما نستقبل خطأ من القاعدة.
    const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
    if (userId && myUid && userId === myUid) { openChangePwModal(); return; }
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">🔑 ' + title + '</div>' +
      '<div class="feat-line" style="margin:6px 0">كلمة المرور الحالية: <code id="rpCur" style="flex:1">جارٍ الجلب...</code></div>' +
      '<label class="feat-line" style="margin:6px 0">كلمة المرور الجديدة <input id="rpPass" class="inp" type="text" placeholder="اكتب الكلمة الجديدة" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">تأكيد كلمة المرور <input id="rpConfirm" class="inp" type="text" placeholder="أعد كتابة الكلمة الجديدة" style="flex:1" /></label>' +
      '<div class="feat-btns">' +
      '<button class="btn gray small" type="button" id="rpGen">🎲 توليد</button>' +
      '<button class="btn green" type="button" id="rpOk">حفظ</button>' +
      '<button class="btn gray" type="button" id="rpCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    // عرض الكلمة الحالية للعلم فقط — لا تُكتب ولا تُطلب
    const curEl = dlg.querySelector("#rpCur");
    const cur = DATA.adminGetPassword(userId);
    if (cur && typeof cur.then === "function") {
      cur.then(function (pw) {
        curEl.textContent = pw ? pw : "لا توجد كلمة محفوظة";
      }).catch(function () { curEl.textContent = "—"; });
    } else if (typeof cur === "string") {
      curEl.textContent = cur || "لا توجد كلمة محفوظة";
    } else {
      curEl.textContent = "—";
    }
    dlg.querySelector("#rpGen").onclick = () => {
      const v = Math.random().toString(36).slice(2, 8) +
                Math.random().toString(36).slice(2, 5).toUpperCase() + "1";
      dlg.querySelector("#rpPass").value = v;
      dlg.querySelector("#rpConfirm").value = v;
    };
    dlg.querySelector("#rpOk").onclick = () => {
      const pw = dlg.querySelector("#rpPass").value.trim();
      const cf = dlg.querySelector("#rpConfirm").value.trim();
      if (!pw) { toast("اكتب كلمة المرور الجديدة", "error"); return; }
      if (pw !== cf) { toast("كلمتا المرور غير متطابقتين", "error"); return; }
      if (pw.length < 6) { toast("كلمة المرور لازم 6 حروف على الأقل", "warning"); return; }
      if (!confirm("سيتم إنهاء جلسات هذا الحساب الحالية. متابعة؟")) return;
      DATA.adminResetPassword(userId, pw).then(() => {
        toast("تمت إعادة التعيين — الكلمة الجديدة: " + pw, "ok");
        dlg.remove();
        const box = document.getElementById("adminPwBox");
        if (box && !box.hidden) { toggleAdminPw(); toggleAdminPw(); }
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
    dlg.querySelector("#rpCancel").onclick = () => dlg.remove();
  }

  // نافذة تغيير يوزر نيم أي مستخدم
  window.__admRenameUser = function (userId) {
    renameUserPrompt(userId, null);
  };

  function renameUserPrompt(userId, current) {
    const val = current || "";
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">✏️ تغيير اليوزر نيم</div>' +
      '<input id="ruName" class="inp" placeholder="اليوزر نيم الجديد (latin فقط)" value="' + val + '" style="width:100%;margin:10px 0" />' +
      '<div class="feat-btns"><button class="btn green" type="button" id="ruOk">حفظ</button>' +
      '<button class="btn gray" type="button" id="ruCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#ruOk").onclick = () => {
      const nm = dlg.querySelector("#ruName").value.trim();
      if (!nm) { toast("اكتب اليوزر نيم", "error"); return; }
      DATA.adminSetUsername(userId, nm).then(() => {
        toast("تم تغيير اليوزر نيم", "ok");
        dlg.remove();
        const om = document.getElementById("orgModal");
        if (om && om.__orgId) {
          loadOrgMembers(om.__orgId, "#omMembers", om);
          if (om.__adminId === userId) {
            const u = om.querySelector("#omUser");
            if (u) u.textContent = nm;
          }
        }
        renderAdminOrgs();
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
    dlg.querySelector("#ruCancel").onclick = () => dlg.remove();
  }

  // إنشاء حساب مالك شركة ليس به حساب (من لوحة المالك) — يُستخدم عند غيابه
  function createAdminPrompt(orgId, orgName) {
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">👤 إنشاء حساب مالك شركة «' + orgName + '»</div>' +
      '<p class="login-sub" style="margin-bottom:8px">هذه الشركة لا تملك حساب مالك حاليًا — أنشئ حسابًا ليتمكن صاحبها من الدخول.</p>' +
      '<label class="feat-line" style="margin:6px 0">يوزر نيم <input id="caUser" class="inp" placeholder="الاسم بلاتيني (latin)" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">كلمة المرور <input id="caPass" class="inp" type="password" placeholder="كلمة المرور" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">اسم المالك <input id="caName" class="inp" placeholder="الاسم المعروض (اختياري)" style="flex:1" /></label>' +
      '<div class="feat-btns"><button class="btn green" type="button" id="caOk">إنشاء الحساب</button>' +
      '<button class="btn gray" type="button" id="caCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#caOk").onclick = () => {
      const un = dlg.querySelector("#caUser").value.trim();
      const pw = dlg.querySelector("#caPass").value;
      const nm = dlg.querySelector("#caName").value.trim() || null;
      if (!un || !pw) { toast("اكتب اليوزر نيم وكلمة المرور", "error"); return; }
      DATA.adminCreateUser(orgId, un, pw, nm, "admin").then(() => {
        toast("تم إنشاء حساب مالك الشركة", "ok");
        dlg.remove();
        const om = document.getElementById("orgModal");
        if (om && om.__orgId) {
          loadOrgMembers(om.__orgId, "#omMembers", om);
          const u = om.querySelector("#omUser");
          if (u) u.textContent = un;
        }
        renderAdminOrgs();
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
    dlg.querySelector("#caCancel").onclick = () => dlg.remove();
  }

  /* ================== إضافة شركة جديدة ================== */
  function openOrgModal() {
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box">' +
      '<div class="panel-title">➕ إضافة شركة جديدة</div>' +
      '<div class="feat-grid" style="grid-template-columns:1fr 1fr">' +
      '<input id="aoName" class="inp" placeholder="اسم الشركة" />' +
      '<input id="aoMax" class="inp" type="number" placeholder="الحد الأقصى للأعضاء" value="5" />' +
      '<input id="aoUser" class="inp" placeholder="يوزر نيم مالك الشركة (latin)" />' +
      '<input id="aoPass" class="inp" type="password" placeholder="كلمة مرور مالك الشركة" />' +
      '</div>' +
      '<div class="feat-btns"><button class="btn green" type="button" id="aoOk">إنشاء الشركة</button>' +
      '<button class="btn gray" type="button" id="aoCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#aoOk").onclick = () => {
      const name = dlg.querySelector("#aoName").value.trim();
      const user = dlg.querySelector("#aoUser").value.trim();
      const pass = dlg.querySelector("#aoPass").value;
      const max = parseInt(dlg.querySelector("#aoMax").value, 10) || 5;
      if (!name || !user || !pass) { toast("اكتب اسم الشركة ويوزر نيم وكلمة مرور المالك", "error"); return; }
      DATA.adminCreateOrg(name, user, pass, max).then((orgId) => {
        toast("تم إنشاء الشركة بيوزر نيم: " + user, "ok");
        dlg.remove();
        renderAdminOrgs();
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    };
    dlg.querySelector("#aoCancel").onclick = () => dlg.remove();
    dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.remove(); });
  }

  /* ================== سجل تغييرات كلمات المرور ================== */
  function openLogModal() {
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">🔒 سجل تغييرات كلمات المرور</div>' +
      '<div id="pwLogBody" class="tbl-wrap" style="max-height:60vh;overflow:auto"><p class="login-sub">جارٍ التحميل...</p></div>' +
      '<div class="feat-btns"><button class="btn gray" type="button" id="pwLogClose">إغلاق</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#pwLogClose").onclick = () => dlg.remove();
    const body = dlg.querySelector("#pwLogBody");
    DATA.passwordLog().then((rows) => {
      if (!rows || !rows.length) { body.innerHTML = '<p class="login-sub">لا توجد تغييرات حتى الآن.</p>'; return; }
      let h = '<table class="data-table"><thead><tr><th>اليوزر نيم</th><th>الشركة</th><th>وقت التغيير</th></tr></thead><tbody>';
      rows.forEach((r) => {
        h += "<tr><td><code>" + (r.username || "—") + "</code></td><td>" + (r.org_name || "—") + "</td><td>" + (r.changed_at || "") + "</td></tr>";
      });
      h += "</tbody></table>";
      body.innerHTML = h;
    }).catch((e) => { body.innerHTML = '<p class="login-msg err">' + (e.message || e) + "</p>"; });
  }

  /* ================== تغيير الرقم السري للحساب الحالي ================== */
  // تستخدم نفس نافذة ownerCommon (جديد + تأكيد، بدون طلب القديم).
  function openChangePwModal() {
    var me = (DATA.me && DATA.me()) ? DATA.me() : null;
    var uname = (me && (me.email || "").split("@")[0]) || "حسابك";
    openMyPasswordDialog(uname);
  }

  // ===== كلمة المرور الحالية + إعادة التعيين (للمالك العام) =====
  function toggleAdminPw() {
    const box = $("#adminPwBox");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    const lst = $("#adminPwList");
    lst.innerHTML = "<p class=\"login-sub\">جارٍ التحميل...</p>";
    DATA.adminPwStore().then((rows) => {
      if (!rows || !rows.length) {
        lst.innerHTML = "<p class=\"login-sub\">لا توجد حسابات مسجّلة بعد.</p>";
        return;
      }
      let h = "<table class=\"data-table\"><thead><tr><th>الشركة</th><th>اسم المستخدم</th>" +
        "<th>كلمة المرور الحالية</th><th>آخر تحديث</th><th></th></tr></thead><tbody>";
      rows.forEach((r) => {
        const d = r.updated_at ? new Date(r.updated_at).toLocaleString("ar-EG") : "—";
        h += "<tr>" +
          "<td>" + (r.org_name || "—") + "</td>" +
          "<td><code>" + (r.username || "—") + "</code></td>" +
          "<td><code style=\"font-size:15px;color:#1d7a46\">" + (r.password_plain || "—") + "</code></td>" +
          "<td>" + d + "</td>" +
          "<td><button class=\"btn small orange\" type=\"button\" onclick=\"window.__admResetPw('" +
            r.user_id + "')\">🔑 إعادة تعيين</button></td>" +
          "</tr>";
      });
      h += "</tbody></table>";
      lst.innerHTML = h;
    }).catch((e) => {
      lst.innerHTML = "<p class=\"login-msg err\">" + (e.message || e) + "</p>";
    });
  }

  // ===== سجل حسابات الموظفين المُنشأة (للمالك) =====
  function toggleAdminAccounts() {
    const box = $("#adminAccounts");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    const lst = $("#adminAccountsList");
    lst.innerHTML = "<p class=\"login-sub\">جارٍ التحميل...</p>";
    DATA.adminCreatedAccounts(null).then((rows) => {
      if (!rows || !rows.length) {
        lst.innerHTML = "<p class=\"login-sub\">لا توجد حسابات مُنشأة بعد. عندما ينشئ صاحب شركة حسابًا لموظف من شاشة «تسجيل دخول شركة» سيظهر هنا.</p>";
        return;
      }
      // نفس الحساب ممكن يتكرّر (إنشاء ثم تغيير كلمة المرور)
      // → نرتّب من الأحدث، ونعلّم newest one «الحالية» وما قبلها «سابقة».
      const sorted = (rows || []).slice().sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")));
      const latest = {};
      sorted.forEach((r) => {
        const k = (r.org_id || "") + "|" + (r.username || "");
        if (!(k in latest)) latest[k] = true;
      });

      let h = "<p class=\"login-sub\" style=\"margin:4px 0 8px\">🔑 كلمة المرور <b>الحالية</b> لكل حساب. الصفوف الرمادية «سابقة» بعد تغيير كلمة المرور.</p>" +
        "<table class=\"data-table\"><thead><tr><th>الحالة</th><th>الشركة</th><th>اسم المستخدم</th><th>كلمة المرور</th><th>الاسم</th><th>التاريخ</th><th></th></tr></thead><tbody>";
      sorted.forEach((r) => {
        const k = (r.org_id || "") + "|" + (r.username || "");
        const isCurrent = !!latest[k];
        if (isCurrent) latest[k] = false;
        const d = r.created_at ? new Date(r.created_at).toLocaleString("ar-EG") : "—";
        const style = isCurrent ? "" : " style=\"opacity:.55\"";
        const tag = isCurrent
          ? '<span class="badge-ok">🔑 الحالية</span>'
          : '<span class="badge-none">سابقة</span>';
        h += "<tr" + style + ">" +
          "<td>" + tag + "</td>" +
          "<td>" + (r.org_name || "—") + "</td>" +
          "<td><code>" + (r.username || "—") + "</code></td>" +
          "<td><code>" + (r.password_plain || "—") + "</code></td>" +
          "<td>" + (r.full_name || "—") + "</td>" +
          "<td>" + d + "</td>" +
          "<td><button class=\"btn small red\" type=\"button\" onclick=\"window.__delCreatedAccount(" + r.id + ")\">🗑️</button></td>" +
          "</tr>";
      });
      h += "</tbody></table>";
      lst.innerHTML = h;
    }).catch((e) => {
      lst.innerHTML = "<p class=\"login-msg err\">" + (e.message || e) + "</p>";
    });
  }
  window.__delCreatedAccount = function (id) {
    if (!confirm("حذف هذا السجل؟ (لن يُحذف الحساب نفسه)")) return;
    DATA.adminDeleteCreatedAccount(id).then(() => {
      toast("تم حذف السجل", "ok");
      toggleAdminAccounts();
      toggleAdminAccounts();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  };

  // ===== شاشة الاشتراكات والأسعار (للمالك) — build 104 =====
  // 103: الخطة تُحفظ باسمها + السعر يدوي لكل شركة + «تجربة مجانية» + أسعار الكروت على السحاب.
  // 104: تنسيق ذهبي احترافي + فحص ذاتي يطمّن المالك إن قاعدة البيانات مجهّزة للترحيل
  //      (upgrade-24) أو تنبيه ودّي مع زرار «إعادة فحص» لو لسه.
  const SUB_PLANS_BASE = {
    f: { label: "تجربة مجانية", price: 0,    months: 1 },
    m: { label: "شهري",         price: 200,  months: 1 },
    h: { label: "نصف سنوي",     price: 1000, months: 6 },
    y: { label: "سنوي",         price: 1800, months: 12 }
  };
  let subPlansCfg = null; // من mizan_get_subs_plans
  function SUB_PLANS() {
    const P = JSON.parse(JSON.stringify(SUB_PLANS_BASE));
    if (subPlansCfg) Object.keys(P).forEach((k) => {
      if (subPlansCfg[k] && subPlansCfg[k].price != null) P[k].price = Number(subPlansCfg[k].price) || 0;
    });
    return P;
  }
  function subsIso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function subsToday() { return subsIso(new Date()); }
  function subsEnd(startIso, months) {
    const d = new Date(startIso + "T00:00:00");
    d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() - 1);
    return subsIso(d);
  }
  function subsAddDays(iso, n) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return subsIso(d);
  }
  function subsDaysBetween(aIso, bIso) {
    const a = new Date(aIso + "T00:00:00"), b = new Date(bIso + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }
  // ===== إصلاح 02/10 (بند 18): «التجديد» لازم يمدّ لقدام =====
  // الغلط القديم: الصف كان بيتعبّى من التواريخ المحفوظة (plan_start/plan_end) والزرار كان بيرجّع
  // نفس التواريخ حرفيًا ⇒ «مش بيغير تاريخ بداية و نهاية الاشتراك و مش بيجدد».
  // القاعدة الجديدة: لو لسه في مدة باقية نكمّل من بعدها بيوم (ماتخسرش يوم)،
  // ولو الفترة خلصت (أو مافيش) نبدأ من النهاردة.
  function subsStoredEnd(o) { return String((o && o.plan_end) || "").slice(0, 10); }
  function subsStoredStart(o) { return String((o && o.plan_start) || "").slice(0, 10); }
  function subsRenewStart(o) {
    const was = subsStoredEnd(o);
    const today = subsToday();
    if (was && was >= today) return subsAddDays(was, 1);
    return today;
  }
  // مصدر واحد للسطر التوضيحي تحت تاريخ البداية (الشاشة والرسم اللحظي بيقروا من نفس الدالة)
  function subsStartHint(start, storedEnd) {
    const today = subsToday();
    if (!start) return "حدّد تاريخ البداية";
    if (storedEnd && start === subsAddDays(storedEnd, 1)) return "مكمّل من نهاية الفترة المحفوظة — ماتخسرش يوم";
    if (!storedEnd) return "يبدأ من التاريخ ده (مافيش فترة محفوظة)";
    if (storedEnd < today && start === today) return "الفترة السابقة انتهت — بيبدأ من النهاردة";
    if (start > storedEnd) return "بيبدأ بعد نهاية الفترة المحفوظة (فراغ " + subsDaysBetween(storedEnd, start) + " يوم)";
    return "بيرجّع البداية لقبل نهاية الفترة المحفوظة (هتقل " + subsDaysBetween(start, storedEnd) + " يوم)";
  }
  function subsInferPlan(o) {
    const P = SUB_PLANS();
    // 1) الخطة المحفوظة باسمها على الشركة أولًا
    if (o.plan) {
      const k = Object.keys(P).find((kk) => P[kk].label === o.plan);
      if (k) return k;
      // 1ب) الأسماء القديمة/الإنجليزيت اللي اتحفظت قبل ما تبقى عربي (free = تجربة)
      const ALIAS = { free: "f", trial: "f", monthly: "m", half: "h", halfyearly: "h", semi: "h", semiannual: "h", yearly: "y", annual: "y" };
      const ak = ALIAS[String(o.plan).trim().toLowerCase()];
      if (ak) return ak;
    }
    // 2) ثم استنتاج من مدة التواريخ الموجودة
    if (!o.plan_start || !o.plan_end) return "y";
    const s = new Date(String(o.plan_start).slice(0, 10) + "T00:00:00");
    const e = new Date(String(o.plan_end).slice(0, 10) + "T00:00:00");
    const months = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44)));
    if (e <= new Date() && months <= 1) return "m";
    if (months <= 2) return "m";
    if (months <= 7) return "h";
    return "y";
  }
  function subsRenderPlansCards(box) {
    const P = SUB_PLANS();
    box.innerHTML = Object.keys(P).map((k) => {
      const p = P[k];
      const per = k === "m" || p.months === 1 ? p.price : Math.round((p.price / p.months) * 10) / 10;
      return '<div class="kpi-card">' +
        '<div class="subs-plan-name">' + (k === "f" ? "🎁 " : "💎 ") + p.label + '</div>' +
        '<div class="subs-plan-price-row"><input type="number" min="0" class="cfg-price" data-ck="' + k + '" value="' + p.price + '"><span class="subs-plan-cur">ج.م</span></div>' +
        '<div class="subs-plan-note">' +
          (k === "f" ? "مجانًا للتعرف على البرنامج"
            : k === "m" ? "من غير التزام"
            : "يعني " + per.toLocaleString("en") + " ج.م/شهر") +
        '</div>' +
        '</div>';
    }).join("") +
    '<div style="width:100%;text-align:center"><button id="btnSavePlansCfg" type="button">💾 حفظ أسعار الباقات</button></div>';
    const btnSave = box.querySelector("#btnSavePlansCfg");
    btnSave.addEventListener("click", () => {
      const cfg = {};
      box.querySelectorAll(".cfg-price").forEach((i) => { cfg[i.dataset.ck] = { price: Number(i.value) || 0 }; });
      DATA.setSubPlans(cfg).then(() => {
        subPlansCfg = cfg;
        toast("تم حفظ أسعار الباقات الافتراضية", "ok");
        addActivity("تعديل أسعار الباقات", Object.keys(cfg).map((k) => SUB_PLANS_BASE[k].label + " " + cfg[k].price + " ج.م").join(" | "));
      }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
    });
  }
  // فحص ذاتي: هل قاعدة البيانات هذه مجهّزة بترحيل الاشتراكات (upgrade-24)؟
  function subsRenderStatus(state) {
    const st = $("#subsCfgStatus");
    if (!st) return;
    st.className = "login-sub";
    if (state && state.ok) {
      st.classList.add("ok");
      st.innerHTML = "✅ كل حاجة تمام — أسعار الباقات محفوظة على السحابة وبتترجّع أوتوماتيك لكل الأجهزة.";
      return;
    }
    st.classList.add("warn");
    st.innerHTML = "⚠️ قاعدة البيانات دي لسه مش مجهّزة لخدمات الاشتراكات (الأسعار السحابية). " +
      "المطلوب تشغيل ملف الترحيل <b>db/supabase-upgrade-24-subs.sql</b> — اطلب من المبرمج يشغّله، وبعدها دوس «إعادة فحص». " +
      '<button id="btnSubsRecheck" class="btn small" type="button">🔄 إعادة فحص</button>' +
      '<span style="color:#b45309">(الجدول والتواريخ شغالين عادة — التقصير بيكون في أسعار الكروت السحابية بس.)</span>';
    const b = $("#btnSubsRecheck");
    if (b) b.addEventListener("click", () => { toggleAdminSubs(); toggleAdminSubs(); });
  }
  function toggleAdminSubs() {
    const box = $("#adminSubs");
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    const plans = $("#adminSubsPlans");
    const lst = $("#adminSubsList");
    lst.innerHTML = '<p class="login-sub">جارٍ التحميل من السحابة...</p>';
    Promise.all([
      // فحص ذاتي: لو الـ RPC مش موجود (ترحيل upgrade-24 لسه) هنبيّه تنبيه ودّي بدل الخطأ التقني
      DATA.getSubPlans().then((v) => ({ ok: true, v: v })).catch((e) => ({ ok: false, err: e.message || String(e) })),
      DATA.adminOrgs().catch((e) => { throw e; })
    ]).then((res) => {
      const cfgState = res[0];
      subPlansCfg = cfgState.ok ? (cfgState.v || null) : null;
      subsRenderStatus(cfgState);
      if (plans) subsRenderPlansCards(plans);
      const orgs = res[1];
      const P = SUB_PLANS();
      if (!orgs || !orgs.length) { lst.innerHTML = '<p class="login-sub">لا توجد شركات بعد.</p>'; return; }
      let h = '<table class="data-table"><thead><tr><th>الشركة</th><th>الخطة</th><th>من تاريخ (الجديد)</th><th>إلى تاريخ (الجديد)</th><th>السعر المتفق عليه (ج.م)</th><th>المحفوظ حاليًا</th><th>تفعيل / تجديد</th></tr></thead><tbody>';
      orgs.forEach((o) => {
        const oid = o.org_id;
        // 🛡 بند 17: شركة المالك ما ليهاش خانة تاريخ ولا زرار تجديد — سطر ودّي واحد
        if (isProtectedOrg(o)) {
          h += '<tr data-subs="' + oid + '" data-locked="' + (o.locked ? 1 : 0) + '" data-protected="1" data-srch="' + subsSrchText(o) + '">' +
            '<td><b>' + (o.org_name || "بدون اسم") + '</b> <span class="badge-ok">🔒</span></td>' +
            '<td colspan="5"><span class="login-sub">شركة المالك — بلا تاريخ اشتراك ومحمية من أي قفل بالتاريخ، فمافيش حاجة تتجدد هنا.</span></td>' +
            '<td><span class="badge-ok">🟢 مفتوحة دايمًا</span></td>' +
            '</tr>';
          return;
        }
        // الإصلاح: «من/إلى» = فترة التجديد الجديدة (مش منسوخة من المحفوظ)
        const pk = subsInferPlan(o);
        const start = subsRenewStart(o);
        const end = subsEnd(start, P[pk].months);
        const price = (o.sub_price != null && o.sub_price !== "") ? Number(o.sub_price) : P[pk].price;
        const wasTxt = subsStoredEnd(o)
          ? (subsStoredStart(o) ? fmtDate(subsStoredStart(o)) + " ← " : "") + fmtDate(subsStoredEnd(o))
          : (subsStoredStart(o) ? "من " + fmtDate(subsStoredStart(o)) + " (من غير نهاية)" : "لا يوجد");
        h += '<tr data-subs="' + oid + '" data-locked="' + (o.locked ? 1 : 0) + '" data-stored-end="' + subsStoredEnd(o) + '" data-srch="' + subsSrchText(o) + '">' +
          '<td><b>' + (o.org_name || "بدون اسم") + '</b></td>' +
          '<td><select class="inp subs-plan">' +
            '<option value="f">🎁 تجربة مجانية</option>' +
            '<option value="m">شهري</option>' +
            '<option value="h">نصف سنوي</option>' +
            '<option value="y">سنوي</option>' +
          '</select></td>' +
          '<td><input type="date" class="inp subs-start" value="' + start + '">' +
            '<div class="login-sub subs-note">' + subsStartHint(start, subsStoredEnd(o)) + '</div></td>' +
          '<td><input type="date" class="inp subs-end" value="' + end + '"></td>' +
          '<td><input type="number" min="0" class="inp subs-price" value="' + price + '" style="width:110px;text-align:center"></td>' +
          '<td>' + wasTxt + (o.locked ? ' <span class="badge-no">🔴 مقفلة</span>' : "") + '</td>' +
          '<td><button class="btn small green subs-go" type="button">✅ تفعيل</button></td>' +
          '</tr>';
      });
      h += '</tbody></table><p class="login-sub" style="margin-top:8px">💡 «من/إلى» دي <b>فترة التجديد الجديدة</b>: لو الشركة لسه جواها مدة باقية بيكمّل من بعدها بيوم (ماتخسرش يوم)، ولو الفترة انتهت بيبدأ من النهاردة. غيّر الخطة أو تاريخ البداية تتعاد حساب النهاية، والسعر يدوي لكل شركة حسب الاتفاق — والتجديد بيفكّ قفل الشركة أوتوماتيك.</p>';
      lst.innerHTML = h;
      orgs.forEach((o) => {
        // 🛡 بند 17: سطر شركة المالك بلا أي حقول ⇒ مانديش عليها (وإلا selector بترجع null)
        if (isProtectedOrg(o)) return;
        const tr = lst.querySelector('[data-subs="' + o.org_id + '"]');
        if (!tr) return;
        tr.querySelector(".subs-plan").value = subsInferPlan(o);
        tr.querySelector(".subs-plan").addEventListener("change", () => subsCalc(tr, true));
        tr.querySelector(".subs-start").addEventListener("change", () => subsCalc(tr, false));
        tr.querySelector(".subs-end").addEventListener("change", () => subsPaintAction(tr));
        tr.querySelector(".subs-go").addEventListener("click", () => subsApply(o, tr));
        subsPaintAction(tr);
      });
      subsWireFilter();
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch((e) => {
      lst.innerHTML = '<p class="login-msg err">تعذّر التحميل: ' + (e.message || e) + "</p>";
    });
  }
  /* 🔎 بحث جدول الاشتراكات بالاسم وبرقم التليفون — أمر المالك الحرفي (08/10):
     «فى قائمة الاشتراكات عايز مربع بحث بنفس الطريقه اللى بنعملها يبحث برقم التليفون
      و بالاسم و كمان البحث يكون سواء الياء تحتها نقطتين او لا و هكذا الالف و الواو»
     ⇒ **نفس** منطق صناديق لوحة الإدارة (`adminOrgMatches` في بناء 110): رقم ⇒ يطابق
        تليفون الشركة، وحروف ⇒ تطابق اسم الشركة **أو اسم المسئول**، والتطبيع بيوحّد
        (أ/إ/آ/ٱ → ا) و(ى → ي) و(ؤ → و) و(ئ → ي) و(ة → ه) + التشكيل + ضغط المسافات.
     ⚠️ الدوال الأربعة دي جوه **بلوك الاشتراكات** عمدًا — درس 120/124/127/131: الحارس
        بيقتطع البلوك ويقيّمه لوحده في كروم، فأي مساعدة بره الشريحة = `ReferenceError`
        وجدول فاضي. عشان كده التطبيع مكتوب هنا مباشرة (مش `normalizeAr`)، والصندوق بيتوصل
        بـ `getElementById` (مش `$`) ⇒ الرحلة تفضل شغّالة حتى في نسخة الحارس اللي مافيهاش `$`،
        ولو الصندوق نفسه مش موجود (شاشة قديمة) الفلترة بتعدّ «كل السطور» بلا ما تكسر حاجة. */
  function subsNormKey(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[ً-ْـ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
      .replace(/\s+/g, " ").trim();
  }
  // مفتاح البحث المحفوظ في السطر نفسه: «اسم الشركة + اسم المسئول | أرقام التليفون»
  // ⚠️ تصفية رموز HTML بتكتب بلا علامات اقتباس حرفية جوّه الـ regex (\x22 \x27 \x60) — نفس
  //    المعنى بالحرف، بس مغلق الاعتماديات في الحارس بيستّر النصوص قبل الـ regex literals
  //    (درس 124)، فالعلامة الحرفية جوّه класса الأحرف كانت بتلخبط الستر وتولّد نداءات وهمية.
  function subsSrchText(o) {
    const txt = subsNormKey([o && o.org_name, o && o.owner_name].join(" ")).replace(/[&<>\x22\x27\x60]/g, "");
    const dig = String((o && o.org_phone) || "").replace(/\D/g, "");
    return txt + "|" + dig;
  }
  function subsFilterRows() {
    const el = document.getElementById("subsSearch");
    const list = document.getElementById("adminSubsList");
    if (!list) return;
    const raw = el ? String(el.value || "") : "";
    const dig = raw.replace(/\D/g, "");
    const txt = subsNormKey(raw.replace(/[0-9\-+().]/g, ""));
    let shown = 0, total = 0;
    list.querySelectorAll("tr[data-subs]").forEach((tr) => {
      total++;
      const parts = String(tr.getAttribute("data-srch") || "").split("|");
      const nameKey = parts[0] || "";
      const phoneDigits = parts[1] || "";
      let hit = !dig && !txt;
      if (dig && phoneDigits.indexOf(dig) !== -1) hit = true;
      if (!hit && txt && nameKey.indexOf(txt) !== -1) hit = true;
      tr.style.display = hit ? "" : "none";
      if (hit) shown++;
    });
    const cnt = document.getElementById("subsSearchCount");
    if (!cnt) return;
    cnt.textContent = (!dig && !txt) ? ""
      : ("🔍 " + shown + " من " + total + " شركة" + (shown ? "" : " — جرّب حروف أقل من الاسم، أو ٣ أرقام من التليفون"));
  }
  // يوصل الصندوق مرة واحدة (لو اللوحة اتفتحت تاني — وزرار «إعادة فحص» بينايمها مرتين)
  function subsWireFilter() {
    const el = document.getElementById("subsSearch");
    if (el && el.dataset.wired !== "1") {
      el.dataset.wired = "1";
      el.addEventListener("input", subsFilterRows);
    }
    subsFilterRows();
  }
  function subsCalc(tr, refreshPrice) {
    const P = SUB_PLANS();
    const p = P[tr.querySelector(".subs-plan").value] || P.y;
    const start = tr.querySelector(".subs-start").value || subsToday();
    tr.querySelector(".subs-end").value = subsEnd(start, p.months);
    if (refreshPrice) tr.querySelector(".subs-price").value = p.price;
    subsPaintAction(tr);
  }
  // يوضّح للمالك قبل الضغط الزرار نفسه هيعمل إيه (تفعيل ولا تجديد) وكم يوم هتزود
  function subsPaintAction(tr) {
    const P = SUB_PLANS();
    const k = tr.querySelector(".subs-plan").value;
    const p = P[k] || P.y;
    const b = tr.querySelector(".subs-go");
    const note = tr.querySelector(".subs-note");
    if (!b) return;
    const start = tr.querySelector(".subs-start").value || "";
    const end = tr.querySelector(".subs-end").value || "";
    const bad = !start || !end || end < start;
    b.textContent = bad ? "⚠ راجع التواريخ" : ((tr.dataset.storedEnd ? "✅ تجديد " : "✅ تفعيل ") + p.label);
    b.disabled = bad;
    if (note) note.textContent = bad
      ? "تاريخ النهاية لازم يكون بعد تاريخ البداية"
      : ("مدّة " + subsDaysBetween(start, end) + " يوم — " + subsStartHint(start, tr.dataset.storedEnd || ""));
  }
  function subsApply(o, tr) {
    // 🛡 بند 17: حصانة أخيرة — حتى لو أي مسار تاني نادى التجديد على شركة المالك
    if (subDatesWriteLocked(o)) { toast("شركتك محمية — مافيش تاريخ اشتراك بيتحفظ لها", "warning"); return; }
    const P = SUB_PLANS();
    const p = P[tr.querySelector(".subs-plan").value] || P.y;
    const start = tr.querySelector(".subs-start").value;
    const end = tr.querySelector(".subs-end").value;
    const price = Number(tr.querySelector(".subs-price").value) || 0;
    if (!start || !end) { toast("حدّد تاريخ البداية الأول", "error"); return; }
    if (end < start) { toast("تاريخ النهاية لازم يكون بعد تاريخ البداية", "error"); return; }
    const wasEnd = subsStoredEnd(o);
    const verb = wasEnd ? "تجديد" : "تفعيل";
    const gain = wasEnd ? subsDaysBetween(wasEnd, end) : subsDaysBetween(start, end);
    const gainTxt = gain > 0 ? ("(+" + gain + " يوم عن المحفوظ)")
      : gain < 0 ? ("(" + gain + " يوم — الفترة هتقلّ!)")
      : "(نفس الفترة المحفوظة — مافيش تمداد)";
    const msg = "تأكيد " + verb + " اشتراك «" + p.label + "» لشركة " + (o.org_name || "بدون اسم") +
      "\nالمحفوظ: " + (wasEnd ? (subsStoredStart(o) ? fmtDate(subsStoredStart(o)) + " ← " : "") + fmtDate(wasEnd) : "لا يوجد") +
      "\nالجديد: من " + start + " إلى " + end + " " + gainTxt +
      "\nالسعر المتفق عليه: " + price.toLocaleString("en") + " ج.م" +
      (o.locked ? "\n(الشركة مقفلة حاليًا — هيتم فتحها مع " + verb + ")" : "");
    if (!confirm(msg)) return;
    DATA.adminSetSub(o.org_id, start, end, p.label, price, !!o.locked).then(() => {
      toast("تم " + verb + " «" + p.label + "» من " + start + " إلى " + end + " — " + price.toLocaleString("en") + " ج.م", "ok");
      addActivity("تجديد اشتراك", verb + " " + p.label + " لشركة " + (o.org_name || "") + " من " + start + " إلى " + end + " بمبلغ " + price + " ج.م");
      toggleAdminSubs(); toggleAdminSubs();
      renderAdminOrgs();
    }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
  }
  // تصدير جدول الاشتراكات الحالي إلى ملف يفتح في Excel (CSV بترميز عربي سليم)
  function subsExport() {
    const tbody = document.querySelector("#adminSubsList tbody");
    if (!tbody || !tbody.querySelectorAll("tr[data-subs]").length) {
      toast("افتح تبويب الاشتراكات أولًا عشان الجدول يكون معروضًا", "warning");
      return;
    }
    const P = SUB_PLANS();
    const rows = [["الشركة", "الخطة", "من تاريخ", "إلى تاريخ", "السعر المتفق عليه (ج.م)", "الانتهاء المسجل حاليًا", "الحالة"]];
    tbody.querySelectorAll("tr[data-subs]").forEach((tr) => {
      // 🛡 بند 17: سطر شركة المالك بلا حقول ⇒ يتشال من التصدير (مش بيكسر الجدول)
      if (tr.dataset.protected === "1") return;
      const planSel = tr.querySelector(".subs-plan");
      if (!planSel) return;
      const pk = planSel.value;
      rows.push([
        tr.children[0].textContent.trim(),
        (P[pk] || {}).label || pk,
        tr.querySelector(".subs-start").value,
        tr.querySelector(".subs-end").value,
        Number(tr.querySelector(".subs-price").value) || 0,
        tr.children[5].textContent.trim(),
        tr.dataset.locked === "1" ? "مقفلة" : "مفتوحة"
      ]);
    });
    downloadCSV("اشتراكات_ميزان_" + subsToday() + ".csv", rows);
    toast("تم حفظ جدول الاشتراكات — بيتفتح في Excel", "ok");
    addActivity("تصدير اشتراكات", "تصدير جدول الاشتراكات إلى Excel (" + (rows.length - 1) + " شركة)");
  }

  // ============================================================
  // ===== نظام إدارة المستندات — build 107 (من النسخة المنشورة) =====
  // المستندات بتتحفظ على قرص جهاز المستخدم مباشرة عن طريق File System
  // Access API: المستخدم بيربط فولدر مرة واحدة (زي D:\MizanDocuments)
  // والمتصفح بيفتكر الرابط — مفيش أي برنامج مساعد ومفيش رفع للملفات على
  // السحابة. قاعدة البيانات بتحتفظ بسجل المستند (اسم/نوع/مسار نسبي) عشان
  // القائمة تبان من أي جهاز، والملف نفسه يفضل عند الجهاز اللي حفظه.
  // المتصفحات المدعومة للمستندات: Chrome و Edge على الكمبيوتر.
  // ============================================================
  const DOC_ROOT_NAME = "MizanDocuments";
  const DOC_TOPS = ["Clients", "Suppliers", "Scans"];
  const DOC_IDB = { name: "mizan_doc_store", ver: 1, store: "handles" };
  let docRootH = null;    // مرجع فولدر المستندات على جهاز المستخدم
  let docStoreSt = null;  // آخر حالة: {ok,name} / {needPick} / {needGesture,name} / {unsupported}
  let docPending = [];    // ملفات اختارها المستخدم ومستنين ربط الفولدر
  let docViewUrl = null;  // رابط معاينة المستند المفتوح حاليًا
  const DOC_INLINE = {
    pdf: "application/pdf", txt: "text/plain",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", svg: "image/svg+xml"
  };
  const RETIRED = { customer: new Set(), supplier: new Set() }; // أرقام متقاعدة (mirror محلي)

  function retiredKey(type) { return "mizan_retired_" + (DATA.orgId && DATA.orgId() || "local") + "_" + type; }
  function loadRetiredLocal(type) {
    try { (JSON.parse(localStorage.getItem(retiredKey(type)) || "[]")).forEach((c) => RETIRED[type].add(c)); } catch (e) {}
  }
  function retireLocal(type, code) {
    if (!code) return;
    RETIRED[type].add(code);
    try { localStorage.setItem(retiredKey(type), JSON.stringify(Array.from(RETIRED[type]))); } catch (e) {}
    if (A.online && DATA.codeRetire) DATA.codeRetire(type, code).catch(() => {});
  }
  function refreshRetired(type) {
    loadRetiredLocal(type);
    if (A.online && DATA.codeListRetired) {
      DATA.codeListRetired(type).then((codes) => {
        (codes || []).forEach((c) => RETIRED[type].add(c));
        try { localStorage.setItem(retiredKey(type), JSON.stringify(Array.from(RETIRED[type]))); } catch (e) {}
      }).catch(() => {});
    }
  }
  function retiredMaxNum(type) {
    loadRetiredLocal(type);
    let mx = 0;
    RETIRED[type].forEach((code) => {
      const m = /-(\d+)$/.exec(code) || /^(\d+)$/.exec(code);
      if (m) mx = Math.max(mx, +m[1]);
    });
    return mx;
  }
  // كود لاحق محلي + دمج الأرقام المتقاعدة، وتهيّأ أسيًا من السيرفر (مصدر الحقيقة)
  function prefetchNextCode(type, inputId) {
    refreshRetired(type);
    if (A.online && DATA.codeNext) {
      const el0 = document.getElementById(inputId);
      const localVal = el0 ? el0.value : null;
      DATA.codeNext(type).then((c) => {
        const el = document.getElementById(inputId);
        if (el && (el.value === localVal || /^-0000$/.test(el.value))) el.value = c;
      }).catch(() => {});
    }
  }

  function canManageDocs() {
    if (isSuperAcct() || isCompanyOwnerAcct()) return true;
    const mp = (window.DATA && DATA.me && DATA.me());
    return !!(mp && mp.features && mp.features.docManager === true);
  }
  function docPartyNum(code) {
    const m = /(\d+)\s*$/.exec(String(code || ""));
    return m ? String(+m[1]) : (String(code || "0").replace(/[^A-Za-z0-9_-]/g, "") || "0");
  }
  function docPartyTop(type) { return type === "supplier" ? "Suppliers" : "Clients"; }
  function docsFsSupported() { return typeof window.showDirectoryPicker === "function"; }
  function docExtOf(fileName) {
    const p = String(fileName || "").split(".");
    const e = p.length > 1 ? p.pop().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
    return e || "bin";
  }

  // ---- تخزين مرجع الفولدر في IndexedDB (كل جهاز بيربط فولدره هو) ----
  function docIdb() {
    return new Promise((resolve, reject) => {
      const rq = indexedDB.open(DOC_IDB.name, DOC_IDB.ver);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(DOC_IDB.store); } catch (e) {} };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  function docIdbPut(key, val) {
    return docIdb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(DOC_IDB.store, "readwrite");
      tx.objectStore(DOC_IDB.store).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }
  function docIdbGet(key) {
    return docIdb().then((db) => new Promise((resolve) => {
      const tx = db.transaction(DOC_IDB.store, "readonly");
      const rq = tx.objectStore(DOC_IDB.store).get(key);
      rq.onsuccess = () => resolve(rq.result === undefined ? null : rq.result);
      rq.onerror = () => resolve(null);
    }));
  }

  // ---- فحص الحالة من غير ما نفتح أي نافذة ----
  async function docStoreCheck() {
    if (!docsFsSupported()) { docStoreSt = { unsupported: true }; return docStoreSt; }
    if (!docRootH) { try { docRootH = await docIdbGet("root"); } catch (e) { docRootH = null; } }
    if (!docRootH) { docStoreSt = { needPick: true }; return docStoreSt; }
    let p = "prompt";
    try { p = await docRootH.queryPermission({ mode: "readwrite" }); } catch (e) { p = "prompt"; }
    docStoreSt = (p === "granted")
      ? { ok: true, name: docRootH.name || DOC_ROOT_NAME }
      : { needGesture: true, name: docRootH.name || DOC_ROOT_NAME };
    return docStoreSt;
  }
  // ---- ربط الفولدر (لازم من جوه دوسة مستخدم) ----
  async function docStoreLink() {
    const picked = await window.showDirectoryPicker({ id: "mizan-docs", mode: "readwrite", startIn: "documents" });
    let root = picked;
    // لو اختار فولدر أب (مثل D:\ أو المستندات) نبني/نستخدم MizanDocuments جواه
    if (!new RegExp("^" + DOC_ROOT_NAME + "$", "i").test(String(picked.name || ""))) {
      try { root = await picked.getDirectoryHandle(DOC_ROOT_NAME, { create: true }); } catch (e) { root = picked; }
    }
    for (const n of DOC_TOPS) { try { await root.getDirectoryHandle(n, { create: true }); } catch (e) {} }
    docRootH = root;
    try { await docIdbPut("root", root); } catch (e) {}
    docStoreSt = { ok: true, name: root.name || DOC_ROOT_NAME };
    return docStoreSt;
  }
  // استكمال الوصول لفولدر مربوط قبل كده من غير ما نختار من جديد
  async function docStoreResume() {
    if (docRootH && docRootH.requestPermission) {
      try {
        const q = await docRootH.requestPermission({ mode: "readwrite" });
        if (q === "granted") { docStoreSt = { ok: true, name: docRootH.name || DOC_ROOT_NAME }; return docStoreSt; }
      } catch (e) {}
    }
    return docStoreLink();
  }
  // ضمان إن الفولدر مربوط ومتاح للكتابة، برسالة ودودة لو محتاج ربط
  async function docStoreWant(withGesture) {
    const st = await docStoreCheck();
    if (st.ok) return st;
    if (st.unsupported) {
      toast("عشان تستخدم مستندات على القرص افتح ميزان من متصفح Chrome أو Edge على الكمبيوتر — باقي البرنامج شغال عادي", "warning");
      return null;
    }
    if (!withGesture) {
      toast(st.needGesture
        ? "دوس «📁 فولدر المستندات» مرة واحدة وسيح المتصفح يكمل الوصول، وبعدها كل العمليات تتم تلقائيًا"
        : "اربط فولدر المستندات على جهازك أول مرة بالدوس على «📁 فولدر المستندات»", "warning");
      return null;
    }
    try { return st.needGesture ? await docStoreResume() : await docStoreLink(); }
    catch (e) {
      if (e && e.name === "AbortError") return null;
      toast("ما كملش ربط الفولدر — جرّب تاني", "warning");
      return null;
    }
  }

  // ---- أمان المسار: جوه فولدر المستندات فقط، وبلا .. ----
  function docRelParts(rel) {
    const parts = String(rel || "").replace(/\//g, "\\").split("\\").filter(Boolean);
    if (!parts.length || parts.indexOf("..") >= 0) return null;
    if (DOC_TOPS.indexOf(parts[0]) < 0) return null;
    return parts;
  }
  async function docDirOf(parts, create) {
    if (!docRootH) return null;
    let dir = docRootH;
    for (let i = 0; i < parts.length - 1; i++) {
      try { dir = await dir.getDirectoryHandle(parts[i], create ? { create: true } : {}); } catch (e) { return null; }
    }
    return dir;
  }
  async function docGetFileH(rel) {
    const parts = docRelParts(rel);
    if (!parts || !docRootH) return null;
    const dir = await docDirOf(parts, false);
    if (!dir) return null;
    try { return await dir.getFileHandle(parts[parts.length - 1]); } catch (e) { return null; }
  }
  async function docExistsRel(rel) { return !!(await docGetFileH(rel)); }
  async function docRemoveFile(rel) {
    const parts = docRelParts(rel);
    if (!parts || !docRootH) return { ok: true, skipped: true };
    const dir = await docDirOf(parts, false);
    if (!dir) return { ok: true, skipped: true };
    try { await dir.removeEntry(parts[parts.length - 1]); return { ok: true }; }
    catch (e) {
      if (e && e.name === "NotFoundError") return { ok: true, skipped: true };
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }
  // ---- تسلسل تلقائي داخل فولدر الجهة: 001, 002, ... ----
  async function docSeqIn(dirH) {
    let mx = 0;
    try {
      for await (const entry of dirH.values()) {
        const m = /^(\d+)\./.exec(String(entry && entry.name || ""));
        if (m) mx = Math.max(mx, Number(m[1]));
      }
    } catch (e) {}
    return mx;
  }
  // ---- حفظ ملف جوه فولدر الجهة على القرص (بيستقبل File أو Blob) ----
  async function docSaveToParty(file, ctx, typeLabel) {
    if (!docRootH) throw new Error("الفولدر مش مربوط");
    const top = docPartyTop(ctx.type);
    const num = docPartyNum(ctx.code);
    let dir;
    try {
      dir = await docRootH.getDirectoryHandle(top, { create: true });
      dir = await dir.getDirectoryHandle(num, { create: true });
    } catch (e) { throw new Error("تعذّر تجهيز فولدر الجهة: " + ((e && e.message) || e)); }
    const seq = (await docSeqIn(dir)) + 1;
    const name = String(seq).padStart(3, "0") + "." + docExtOf(file.name || ctx.fileName);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(file);
    await w.close();
    return {
      rel: top + "\\" + num + "\\" + name, name: name,
      originalName: file.name || name, size: file.size || 0,
      docType: typeLabel || "مستند عام", rootName: docRootH.name || DOC_ROOT_NAME
    };
  }
  // ---- ملفات المسح الضوئي الجاهزة في فولدر Scans ----
  async function docScansList() {
    if (!docRootH) return [];
    let sc;
    try { sc = await docRootH.getDirectoryHandle("Scans", { create: true }); } catch (e) { return []; }
    const out = [];
    try {
      for await (const entry of sc.values()) {
        if (!entry || entry.kind !== "file") continue;
        let size = 0, mtime = 0;
        try { const f = await entry.getFile(); size = f.size || 0; mtime = f.lastModified || 0; } catch (e) {}
        out.push({ name: entry.name, size: size, mtime: mtime });
      }
    } catch (e) {}
    out.sort((a, b) => b.mtime - a.mtime);
    return out.slice(0, 20);
  }
  async function docImportScanFile(name, ctx) {
    let sc;
    try { sc = await docRootH.getDirectoryHandle("Scans", { create: true }); } catch (e) { throw new Error("مفيش فولدر للمسح الضوئي على الجهاز ده"); }
    let file;
    try { const fh = await sc.getFileHandle(name); file = await fh.getFile(); } catch (e) { throw new Error("الملف الممسوح مش موجود في فولدر المسح"); }
    const r = await docSaveToParty(file, ctx, "مسح ضوئي");
    r.originalName = name;
    return r;
  }

  let docCtx = null; // {type, code, id, name} للسياق الحالي (رفع/مسح)
  function docsRefreshIfOpen() { if (docCtx && window.$ && !$("#mDocs").hidden) docsRefresh(); }

  // دوسة المستخدم على «📁 فولدر المستندات» — بتفتح اختيار الفولدر وبتكمّل المعلّق
  function docLinkButton() {
    docStoreWant(true).then((st) => {
      if (!st) return;
      toast("✅ تمام — جهازك هيحفظ المستندات في فولدر " + st.name + " على قرصك", "ok");
      addActivity("مستندات", "ربط فولدر المستندات " + st.name);
      renderDocRootBox();
      docsRefreshIfOpen();
      docFlushPending();
    });
  }
  // ملفات اتاختارت قبل ما الفولدر يتربط — تتحفظ أول ما الربط يكتمل
  function docFlushPending() {
    if (!docPending.length || !docStoreSt || !docStoreSt.ok) return;
    const list = docPending.slice();
    docPending = [];
    docUploadFiles(list);
  }

  function docScan(party, type) {
    if (!canManageDocs()) { toast("لا تملك صلاحية «إدارة مستندات العملاء والموردين»", "error"); return; }
    // (1) محاولة فتح برنامج المسح الضوئي الرسمي — لازم جوه الدوسة نفسها
    let launched = false;
    try {
      const a = document.createElement("a");
      a.href = "windowsscan:"; a.rel = "noopener"; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      launched = true;
    } catch (e) {}
    // (2) تجهيز فولدر المستندات واستقبال النتائج
    docCtx = { type, code: party.code, id: party.id, name: party.nameAr };
    docStoreWant(true).then((st) => {
      if (!st) return;
      toast("📷 " + (launched ? "برنامج المسح الضوئي مفتوح — " : "") + "خلي مكان الحفظ في برنامج المسح هو فولدر Scans جوه " + st.name + "، وبعدها دوس «📥 استيراد الملفات الممسوحة» من نافذة المستندات", "ok");
      docsRefreshIfOpen();
    });
  }
  function docPick(party, type) {
    if (!canManageDocs()) { toast("لا تملك صلاحية «إدارة مستندات العملاء والموردين»", "error"); return; }
    docCtx = { type, code: party.code, id: party.id, name: party.nameAr };
    // اختيار الملفات بيتعمل مباشر (من غير انتظار) عشان المتصفح يسمح بالنافذة
    const inp = $("#docFileInput");
    inp.value = "";
    inp.onchange = () => docUploadFiles(inp.files);
    docStoreCheck();
    inp.click();
  }
  function docUploadFiles(files) {
    if (!files || !files.length || !docCtx) return;
    const list = Array.from(files);
    if (!docStoreSt || !docStoreSt.ok) {
      docPending = docPending.concat(list);
      toast("📎 استلمت " + list.length + " ملف — دوس «📁 فولدر المستندات» وبعدها هيتم الحفظ على جهازك فورًا", "warning");
      return;
    }
    const total = list.length;
    let okCount = 0, lastRel = null, lastRoot = null;
    toast("جارٍ حفظ " + total + " مستند في فولدر " + (docCtx.type === "supplier" ? "المورد" : "العميل") + " على جهازك...", "ok");
    // حفظ بالترتيب (ملف ورا التاني) عشان رقم التسلسل ميكررش نفسه لو اتحفظ أكتر من ملف مع بعض
    const saveOne = (f) => docSaveToParty(f, docCtx).then((r) => {
      // التسجيل في القاعدة بعد نجاح حفظ الملف فعليًا فقط
      lastRel = r.rel; lastRoot = r.rootName || lastRoot;
      return DATA.docAdd(docCtx.type, docCtx.id, docCtx.code, f.name, r.name.split(".").pop(), r.rel, r.docType, r.size)
        .then(() => { okCount++; })
        .catch((e) => toast("حُفظ الملف لكن فشل تسجيله: " + ((e && e.message) || e), "error"));
    }).catch((e) => toast("فشل حفظ الملف «" + f.name + "»: " + ((e && e.message) || e) + " — لم يُسجَّل أي شيء", "error"));
    list.reduce((chain, f) => chain.then(() => saveOne(f)), Promise.resolve()).then(() => {
      if (!okCount) return;
      const folder = lastRel ? ((lastRoot ? lastRoot + "\\" : "") + docPartyTop(docCtx.type) + "\\" + docPartyNum(docCtx.code)) : null;
      toast("✅ تم حفظ " + okCount + " من " + total + " في فولدر " + (docCtx.type === "supplier" ? "المورد" : "العميل") + " " + docCtx.name + (folder ? " — " + folder : ""), "ok");
      addActivity("مستندات", "حفظ " + okCount + " مستند لـ" + (docCtx.type === "supplier" ? " مورد " : " عميل ") + docCtx.name + " (" + docCtx.code + ")");
      docsRefresh();
    });
  }
  function openDocsModal(party, type) {
    if (!canManageDocs()) { toast("لا تملك صلاحية «إدارة مستندات العملاء والموردين»", "error"); return; }
    docCtx = { type, code: party.code, id: party.id, name: party.nameAr };
    $("#docsTitle").textContent = (type === "supplier" ? "📁 مستندات المورد: " : "📁 مستندات العميل: ") + party.nameAr + " (" + party.code + ")";
    const sInp = $("#docsSearch"); if (sInp) sInp.value = "";
    $("#docsClose").onclick = () => hideModal("mDocs");
    $("#docsRefresh").onclick = () => { docStoreCheck().then(() => docsRefresh()); };
    const lb = $("#docsLink"); if (lb) lb.onclick = docLinkButton;
    showModal("mDocs");
    docStoreCheck().then(() => docsRefresh());
  }
  // أيقونة حسب الامتداد + تنسيق الحجم — لشاشة المستندات الاحترافية (build 106)
  function docsIcon(name) {
    const e = String(name || "").split(".").pop().toLowerCase();
    if (e === "pdf") return "📕";
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "svg"].indexOf(e) >= 0) return "🖼️";
    if (["xls", "xlsx", "csv"].indexOf(e) >= 0) return "📊";
    if (["doc", "docx"].indexOf(e) >= 0) return "📘";
    if (e === "zip" || e === "rar" || e === "7z") return "🗜️";
    if (e === "txt") return "📄";
    return "📎";
  }
  function docsFmtSize(n) {
    n = Number(n || 0);
    if (!n) return "—";
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB";
    return Math.max(1, Math.round(n / 1024)) + " KB";
  }
  // تطبيع عربي للبحث الذكي: بلا تشكيل/تطويل، الهمزات ألف، الياء موحّدة،
  // التاء المربوطة هاء، وإزالة «ال» التعريف من أول كل كلمة
  function docsNorm(s) {
    s = String(s || "").toLowerCase();
    s = s.replace(/[ً-ْٰـ]/g, "");
    s = s.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
    s = s.replace(/[^؀-ۿa-z0-9]+/g, " ").trim();
    s = " " + s + " ";
    s = s.replace(/ ال(?=[؀-ۿ])/g, " ");
    return s.trim().replace(/\s+/g, " ");
  }
  function docsRowHay(d) {
    return docsNorm([d.file_name, d.rel_path, d.doc_type, d.created_by, fmtDate(d.created_at), String(d.file_size || "")].join(" "));
  }
  function docsRefresh() {
    if (!docCtx) return;
    const body = $("#docsBody");
    body.innerHTML = '<tr><td colspan="6" class="login-sub">جارٍ التحميل...</td></tr>';
    const st = docStoreSt || { needPick: true };
    const folderRel = docPartyTop(docCtx.type) + "\\" + docPartyNum(docCtx.code);
    $("#docsStatParty").textContent = (docCtx.type === "supplier" ? "🤝 مورد • " : "👤 عميل • ") + docCtx.code;
    const lb = $("#docsLink");
    if (st.ok) {
      $("#docsDeviceNote").innerHTML = "📁 فولدر المستندات على جهازك: <b><span dir=\"ltr\">" + esc(st.name + "\\" + folderRel) + "</span></b> — كل ملف بيتحفظ ويترجع من قرص جهازك مباشرة";
      if (lb) lb.hidden = true;
    } else if (st.unsupported) {
      $("#docsDeviceNote").textContent = "🖥️ للمستندات على القرص استخدم Chrome أو Edge على الكمبيوتر — باقي مزايا ميزان شغالة هنا عادي.";
      if (lb) lb.hidden = true;
    } else {
      $("#docsDeviceNote").textContent = "📁 اول مرة على الجهاز ده: دوس «📁 فولدر المستندات» واختار مكان مثل D:\\MizanDocuments — بعدها الحفظ والاستدعاء والفتح بيتم تلقائيًا على قرصك.";
      if (lb) lb.hidden = false;
    }
    DATA.docList(docCtx.type, docCtx.code).then((rows) => {
      // ملفات المسح الضوئي الجاهزة للاستيراد (لو الفولدر مربوط وفيها ملفات)
      const impBtn = $("#docsImportScans");
      if (st.ok) {
        docScansList().then((sf) => {
          if (impBtn) { impBtn.hidden = !(sf && sf.length); impBtn.onclick = docImportScans; }
        });
      } else if (impBtn) impBtn.hidden = true;
      // وجود الملف على الجهاز ده (عشان الشاشة تفرّق بين ملفات جهازه وجهاز تاني)
      const hereP = st.ok ? Promise.all(rows.map((d) => docExistsRel(d.rel_path).then((y) => { d._here = !!y; }))) : Promise.resolve();
      hereP.then(() => {
        // بحث تلقائي في كل الخانات (ذكى بلا حساسية للهمزة/ال/الياء/التاء المربوطة)
        const searchInp = $("#docsSearch");
        const pickRows = () => {
          const q = docsNorm(searchInp && searchInp.value);
          if (!q) return rows;
          const toks = q.split(" ");
          return rows.filter((d) => {
            const hay = " " + docsRowHay(d) + " ";
            return toks.every((t) => hay.indexOf(" " + t) >= 0 || hay.indexOf(t) >= 0);
          });
        };
        const paintRows = (list) => {
          if (!list.length) {
            $("#docsStatCount").textContent = "📄 0 مستند";
            $("#docsStatSize").textContent = "🗂 0 KB";
            body.innerHTML = rows.length
              ? '<tr><td colspan="6" style="text-align:center;padding:22px 10px">🔍 مفيش نتيجة مطابقة للبحث — جرّب كلمة تانية</td></tr>'
              : '<tr><td colspan="6" style="text-align:center;padding:26px 10px"><div style="font-size:34px;margin-bottom:6px">🗂️</div>لا توجد مستندات بعد — دوس «📄 حفظ مستند من الجهاز» وهي اتحفظ في فولدر ' + esc(docCtx.name) + ' على جهازك.</td></tr>';
            return;
          }
          let totalSize = 0;
          list.forEach((d) => { totalSize += Number(d.file_size || 0); });
          const hereN = st.ok ? list.filter((d) => d._here).length : 0;
          $("#docsStatCount").textContent = "📄 " + list.length + (rows.length !== list.length ? " من " + rows.length : "") + " مستند" + (st.ok ? " • " + hereN + " على جهازك" : "");
          $("#docsStatSize").textContent = "🗂 " + docsFmtSize(totalSize);
          body.innerHTML = list.map((d) => {
            const fname = d.file_name || d.rel_path.split("\\").pop();
            const full = st.ok ? (st.name + "\\" + d.rel_path) : d.rel_path;
            const tag = st.ok ? (d._here ? "" : " — نسخة الجهاز ده مش موجودة") : " — الملف على جهاز تاني";
            return '<tr>' +
              '<td><span class="doc-ico">' + docsIcon(fname) + '</span><b title="' + esc(fname) + '">' + esc(fname) + '</b>' +
                '<div class="doc-path" title="' + esc(full + tag) + '">' + esc(full) + esc(tag) + '</div></td>' +
              '<td title="' + esc(d.doc_type || 'مستند عام') + '">' + esc(d.doc_type || 'مستند عام') + '</td>' +
              '<td class="nowrap">' + docsFmtSize(d.file_size) + '</td>' +
              '<td class="nowrap">' + fmtDate(d.created_at) + '</td>' +
              '<td title="' + esc(d.created_by || '—') + '">' + esc(d.created_by || '—') + '</td>' +
              '<td style="white-space:nowrap">' +
                '<button class="btn small blue" type="button" data-open="' + d.doc_id + '">📂 فتح</button> ' +
                '<button class="btn small red" type="button" data-deldoc="' + d.doc_id + '">🗑 حذف</button>' +
              '</td></tr>';
          }).join("");
          body.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => docOpenRow(list.find((x) => x.doc_id === b.dataset.open)));
          body.querySelectorAll("[data-deldoc]").forEach((b) => b.onclick = () => docDeleteRow(list.find((x) => x.doc_id === b.dataset.deldoc)));
        };
        if (searchInp) searchInp.oninput = () => paintRows(pickRows());
        paintRows(pickRows());
      });
    }).catch((e) => {
      body.innerHTML = '<tr><td colspan="6" class="login-msg err">تعذّر التحميل: ' + esc(e.message || String(e)) + ' — لو قاعدة بيانات جديدة شغّل الترحيل db/supabase-upgrade-25-docs.sql</td></tr>';
    });
  }
  // استيراد كل الملفات الموجودة في فولدر Scans (نتائج المسح الضوئي) إلى مستندات الجهة
  function docImportScans() {
    if (!docCtx || !canManageDocs()) return;
    docStoreWant(true).then((st) => {
      if (!st) return;
      docScansList().then((files) => {
        if (!files || !files.length) { toast("لا توجد ملفات ممسوحة جاهزة في فولدر Scans", "warning"); return; }
        let okCount = 0;
        // استيراد بالترتيب عشان التسلسل ميكررش نفسه
        const one = (f) => docImportScanFile(f.name, docCtx).then((r) => {
          if (!r || !r.rel) throw new Error("تعذّر الحفظ");
          return DATA.docAdd(docCtx.type, docCtx.id, docCtx.code, r.originalName || f.name, (r.name || "").split(".").pop(), r.rel, "مسح ضوئي", r.size)
            .then(() => { okCount++; });
        }).catch((e) => toast("ملف «" + f.name + "»: " + ((e && e.message) || e), "error"));
        files.reduce((chain, f) => chain.then(() => one(f)), Promise.resolve()).then(() => {
          if (!okCount) return;
          toast("✅ تم استيراد " + okCount + " ملف ممسوح إلى مستندات " + docCtx.name, "ok");
          addActivity("مستندات", "استيراد " + okCount + " ملف مسح ضوئي لـ" + docCtx.name + " (" + docCtx.code + ")");
          docsRefresh();
        });
      });
    });
  }
  // ---- فتح المستند: معاينة جوه البرنامج للصور وPDF، وتنزيل لباقي الأنواع ----
  function docViewClose() {
    hideModal("mDocView");
    if (docViewUrl) { try { URL.revokeObjectURL(docViewUrl); } catch (e) {} docViewUrl = null; }
    const bd = $("#docViewBody"); if (bd) bd.innerHTML = "";
  }
  function docOpenRow(d) {
    if (!d) return;
    docStoreWant(true).then((st) => {
      if (!st) return;
      return docGetFileH(d.rel_path).then((fh) => {
        if (!fh) {
          toast("ℹ️ نسخة المستند ده مش على جهازك — الملف موجود عند الجهاز اللي حفظه، وتقدر تحفظ نسخة جديدة من هنا", "warning");
          docsRefresh();
          return;
        }
        return fh.getFile().then((file) => {
          const fname = d.file_name || file.name || "مستند";
          const ext = docExtOf(file.name || fname);
          const mime = DOC_INLINE[ext] || "";
          if (docViewUrl) { try { URL.revokeObjectURL(docViewUrl); } catch (e) {} }
          docViewUrl = URL.createObjectURL(file);
          $("#docViewTitle").textContent = "📂 " + fname;
          $("#docViewMeta").textContent = (ext.toUpperCase() || "ملف") + " • " + docsFmtSize(file.size) + " • " + st.name + "\\" + d.rel_path;
          const bd = $("#docViewBody");
          if (mime.indexOf("image/") === 0) bd.innerHTML = '<img src="' + docViewUrl + '" alt="' + esc(fname) + '" />';
          else if (mime === "application/pdf" || mime.indexOf("text/") === 0) bd.innerHTML = '<iframe src="' + docViewUrl + '" title="' + esc(fname) + '"></iframe>';
          else bd.innerHTML = '<div class="docs-no-preview"><div class="dnp-ico">' + docsIcon(fname) + '</div>' +
            '<p>دي ملفات ' + esc((ext || "").toUpperCase()) + ' — تقدر تفتحها في برنامج الجهاز من زرار «⬇️ تنزيل وفتح».</p></div>';
          const dl = $("#docViewDownload");
          dl.onclick = () => {
            const a = document.createElement("a");
            a.href = docViewUrl; a.download = fname;
            document.body.appendChild(a); a.click(); a.remove();
            toast("📥 تم تنزيل «" + fname + "» — افتحه من مجلد التنزيلات", "ok");
          };
          $("#docViewClose").onclick = docViewClose;
          showModal("mDocView");
        });
      }).catch((e) => toast("تعذّر فتح المستند: " + ((e && e.message) || e), "error"));
    });
  }
  function docDeleteRow(d) {
    if (!d || !canManageDocs()) return;
    const choice = confirm("حذف المستند «" + d.file_name + "»؟\n\nدوس OK: حذف السجل من كل الأجهزة + الملف من على جهازك لو موجود عنده\nدوس Cancel: إلغاء");
    if (!choice) return;
    const sure = confirm("تأكيد نهائي: الحذف نهائي ومش بيرجع.\n(مستندات العملاء والموردين المحذوفين فضلت محفوظة — اللي بنحذفه هنا هو المستند نفسه)\n\nتأكيد حذف «" + d.file_name + "»؟");
    if (!sure) return;
    docStoreCheck().then((st) => {
      const rmFile = () => (st && st.ok) ? docRemoveFile(d.rel_path) : Promise.resolve({ ok: true, skipped: true });
      rmFile().then((fr) => {
        if (fr && fr.ok === false) toast("ملف المستند ما انحذفش من جهازك — والسجل اتحذف من كل الأجهزة", "warning");
        return DATA.docDel(d.doc_id);
      })
        .then(() => { toast("تم حذف المستند" + (st && st.ok ? " بسجله وبملفه من جهازك" : " من كل الأجهزة"), "ok"); addActivity("مستندات", "حذف مستند " + d.file_name + " (" + d.rel_path + ")"); docsRefresh(); })
        .catch((e) => toast("خطأ: " + ((e && e.message) || e), "error"));
    });
  }
  // صندوق «فولدر المستندات» في إعدادات مؤسستك — لكل جهاز فولدره على قرصه
  function renderDocRootBox() {
    const txt = $("#docRootStatus"), act = $("#docRootActions");
    if (!txt) return;
    txt.textContent = "جارٍ فحص هذا الجهاز...";
    act.innerHTML = "";
    const mkBtn = (label, fn, cls) => {
      const b = document.createElement("button");
      b.className = "btn small " + (cls || "");
      b.type = "button"; b.textContent = label;
      b.onclick = fn;
      act.appendChild(b);
      return b;
    };
    docStoreCheck().then((st) => {
      if (st.ok) {
        txt.innerHTML = "💾 جهازك بيحفظ مستنداته في فولدر <b>" + esc(st.name) + "</b> على قرصه — إعادة تثبيت البرنامج أو تنصيب ويندوز جديد ما تمسّش أي مستند، وباقي أجهزة الشركة بتحفظ على أقراصها.";
        mkBtn("🔀 تغيير فولدر المستندات", () => {
          docStoreLink().then((r) => {
            toast("تم تغيير فولدر المستندات إلى " + r.name, "ok");
            addActivity("مستندات", "تغيير فولدر تخزين المستندات إلى " + r.name);
            renderDocRootBox(); docsRefreshIfOpen();
          }).catch((e) => { if (!e || e.name !== "AbortError") toast("تعذّر تغيير الفولدر", "error"); });
        }, "light");
        mkBtn("🔄 إعادة فحص", () => renderDocRootBox());
      } else if (st.unsupported) {
        txt.textContent = "🖥️ مستندات الماسح الضوئي والملفات على القرص متاحة في متصفح Chrome أو Edge على الكمبيوتر. بيانات ميزان السحابية وشاشاته كلها شغالة هنا عادي.";
      } else {
        txt.textContent = st.needGesture
          ? "📁 فولدر المستندات مربوط على الجهاز ده (" + st.name + ") — دوس الزرار وسيح المتصفح يكمل الوصول، وبعدها كل العمليات تتم تلقائيًا."
          : "📁 عشان جهازك يحفظ مستنداته على قرصه: دوس الزرار واختار مكان مثل D:\\MizanDocuments (مرة واحدة بس).";
        mkBtn("📁 فولدر المستندات", docLinkButton, "green");
        mkBtn("🔄 إعادة فحص", () => renderDocRootBox());
      }
    });
  }
  // خطاف اختبارات داخلية (بيشتغل بس مع ?docmock=1 — بيستخدم في فحص المنطق)
  if (location.search.indexOf("docmock=1") >= 0) {
    window.__mizanDocTest = {
      setRoot: (h) => { docRootH = h; docStoreSt = h ? { ok: true, name: h.name || "mock" } : null; },
      getRoot: () => docRootH,
      check: () => docStoreCheck(),
      save: (file, ctx, label) => docSaveToParty(file, ctx, label),
      exists: (rel) => docExistsRel(rel),
      remove: (rel) => docRemoveFile(rel),
      scans: () => docScansList(),
      importScan: (name, ctx) => docImportScanFile(name, ctx),
      seqIn: (rel) => docDirOf(docRelParts(rel + "\\x"), false).then((dir) => (dir ? docSeqIn(dir) : -1)),
      state: () => docStoreSt,
      // نقاط دخول الواجهة (للتقييم الشامل في المتصفح)
      setCtx: (c) => { docCtx = c; },
      getCtx: () => docCtx,
      openModal: (party, type) => openDocsModal(party, type),
      refresh: () => docsRefresh(),
      upload: (files, ctx) => { if (ctx) docCtx = ctx; docUploadFiles(files); },
      flush: () => docFlushPending(),
      pending: () => docPending.slice(),
      openRow: (d) => docOpenRow(d),
      deleteRow: (d) => docDeleteRow(d),
      linkBtn: () => docLinkButton(),
      settings: () => renderDocRootBox(),
      viewState: () => ({ url: docViewUrl, modalHidden: document.getElementById("mDocView").hidden, body: document.getElementById("docViewBody").innerHTML.slice(0, 220) })
    };
  }

  function setupAdmin() {
    $("#btnAdmin").addEventListener("click", openAdmin);
    $("#btnAdminRefresh").addEventListener("click", renderAdminOrgs);
    const so = $("#admSearchOrg");
    const su = $("#admSearchUser");
    if (so) so.addEventListener("input", onAdminSearchInput);
    if (su) su.addEventListener("input", onAdminSearchInput);
    const clearBtn = $("#btnAdminSearchClear");
    if (clearBtn) clearBtn.addEventListener("click", () => {
      if (so) so.value = "";
      if (su) su.value = "";
      paintAdminOrgTable();
      if (so) so.focus();
    });
    const btnAddOrg = $("#btnAdminAddOrg");
    if (btnAddOrg) btnAddOrg.addEventListener("click", () => openOrgModal());
    const btnLog = $("#btnAdminLog");
    const btnSubs = $("#btnAdminSubs");
    if (btnSubs) btnSubs.addEventListener("click", toggleAdminSubs);
    const btnSubsExp = $("#btnSubsExport");
    if (btnSubsExp) btnSubsExp.addEventListener("click", subsExport);
    if (btnLog) btnLog.addEventListener("click", () => openLogModal());
    const btnAcc = $("#btnAdminAccounts");
    if (btnAcc) btnAcc.addEventListener("click", () => toggleAdminAccounts());
    const btnPw = $("#btnAdminPw");
    if (btnPw) btnPw.addEventListener("click", () => toggleAdminPw());
    const btnChangePw = $("#btnChangePw");
    if (btnChangePw) btnChangePw.addEventListener("click", () => openChangePwModal());
    $("#btnDenyLogout").addEventListener("click", () => {
      stopPlanWatch();
      DATA.logout().then(() => {
        A.online = false;
        $("#btnLogout").hidden = true;
        $("#btnChangePw").hidden = true;
        $("#btnAdmin").hidden = true;
        $("#denyScreen").hidden = true;
        showLogin();
      });
    });
  }

  /* ================== 🧱 بناء 132: شريط الأقسام العلوي (قوائم تنزل بدل القائمة الجانبية) ==================
     الطلب بالحرف (03/10 ≈22:15): «قسم فوق بدل زراير كتير، ولما أفتحه تعمل لي قوائم تنزل»
     + «مش عايز القوائم اللي في الجانب تظهر — من فوق فقط منسدلة»
     + «الصلاحيات اللي مش عند المستخدم أو صاحب الشركة متظهرش من الأساس، ولا مكانها فاضي».
     مافيش هنا **أي قرار صلاحيات**: نفس أزرار الشاشات الـ22 ونفس `canUseView`/`showView`.
     الشغل ده شكل وسلامة استخدام بس: فتح/قفل القائمة، وإسقاط القسم اللي شاشاته كلها مقفولة. */
  function openSection(id) {
    document.querySelectorAll(".topnav .sec").forEach((s) => {
      s.classList.toggle("open", !!id && s.dataset.sec === id);
    });
  }
  function closeSections() { openSection(""); }
  function secScreens(sec) {
    return Array.prototype.slice.call(sec.querySelectorAll(".drop .nav-btn"));
  }
  function visibleScreensOf(sec) { return secScreens(sec).filter((b) => !b.hidden); }
  /* 🚫 مافيش مكان فاضي: القسم اللي كل شاشاته مقفولة **يتشال** من الشريط (مش يتعطّل ولا يفضل
     مربع فاضي) — `[hidden]{display:none!important}` في styles.css بيقفلها من غير أي فجوة. */
  function applySectionVisibility() {
    document.querySelectorAll(".topnav .sec").forEach((sec) => {
      const n = visibleScreensOf(sec).length;
      sec.hidden = n === 0;
      if (n === 0) sec.classList.remove("open");
    });
    paintSectionActive();
  }
  /* القسم اللي فيه الشاشة المفتوحة حاليًا ياخد علامة، عشان المستخدم يعرف هو فين */
  function paintSectionActive() {
    document.querySelectorAll(".topnav .sec").forEach((sec) => {
      let on = false;
      secScreens(sec).forEach((b) => { if (b.classList.contains("active")) on = true; });
      sec.classList.toggle("has-active", on);
    });
  }
  function wireTopNav() {
    const bar = document.getElementById("sidebar");
    if (!bar) return;
    bar.addEventListener("click", (e) => {
      const t = e.target.closest("[data-sec-toggle]");
      if (t) {
        const sec = t.closest(".sec");
        const wasOpen = !!(sec && sec.classList.contains("open"));
        openSection(wasOpen ? "" : (sec ? sec.dataset.sec : ""));
        return;
      }
      // اختيار شاشة من القائمة ⇒ القائمة تقفل والشاشة تتفتح (الربط القديم للزرار شغال لوحده)
      if (e.target.closest(".nav-btn")) closeSections();
    });
    // دوسة بره الشريط = قفل أي قائمة مفتوحة (زي أي شريط قوائم عادي)
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topnav")) closeSections();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSections(); });
    // على الكمبيوتر: لمّا قائمة تكون مفتوحة أصلًا، المرور على قسم تاني يورّي اللي تحته
    document.querySelectorAll(".topnav .sec").forEach((sec) => {
      sec.addEventListener("mouseenter", () => {
        if (window.innerWidth <= 860) return;
        if (!document.querySelector(".topnav .sec.open")) return;
        openSection(sec.dataset.sec);
      });
    });
    applySectionVisibility();
  }

  /* ================== البداية ================== */
  function init() {
    wireTopNav();
    /* 146: الختم من `verLabel()` = **رقم التحديث** (أمر المالك 07/10 ≈21:36: «ماتكتبش 1.4.1
       اكتب 146»)، مش من `APP_VERSION` (رقم المنتج). مقاس في كروم الحقيقي: السطحين بياخدوا
       من نفس مصدر `window.mizanVerLabel()`، وده بيتنفذ **قبل** ختم `index.html` (آخر مكتِب). */
    const fv = document.getElementById("ftrVer");
    if (fv) fv.textContent = verLabel();
    const lv = document.getElementById("loginVer");
    if (lv) lv.textContent = verLabel();
    // 🛡 لقطة وجود مفاتيح localStorage قبل أي تحميل — تُستخدم للاسترجاع
    // الموثوق من ملف الديسك عند فتح البرنامج على origin جديد أو بعد مسح الكاش.
    try {
      bootLsPresent = {};
      LS_ALL_KEYS.forEach((k) => { bootLsPresent[k] = !!localStorage.getItem(k); });
    } catch (e) { bootLsPresent = {}; }
    loadData();
    recalculateCustomerBalances();
    recalculateSupplierBalances();
    recalculateTreasuryBalances();
    loadFromLocalDisk();
    if (window.DATA && window.DATA.init) window.DATA.init();
    setupAdmin();
    const online = window.DATA && window.DATA.isOnline() && window.CLOUD;
    if (online) {
      A.online = true;
      setupAuth();
      // 🔄 جلسة محفوظة؟ → شاشة تحميل صغيرة ودخول مباشر من غير شاشة الدخول
      var savedSession = false;
      try { savedSession = !!localStorage.getItem("mizan_session_v1"); } catch (e) { }
      if (savedSession && window.DATA.autoLogin) {
        setDbStatus("🟡 جارٍ استرجاع الجلسة...");
        $("#bootSplash").hidden = false;
        window.DATA.autoLogin().then(function (ok) {
          $("#bootSplash").hidden = true;
          if (ok && DATA.getProfile()) { proceedOnline(null, null); return; }
          setDbStatus("🟡 أونلاين — سجّل الدخول");
          showLogin();
        }).catch(function () {
          $("#bootSplash").hidden = true;
          setDbStatus("🟡 أونلاين — سجّل الدخول");
          showLogin();
        });
      } else {
        setDbStatus("🟡 أونلاين — سجّل الدخول");
        showLogin();
      }
    } else {
      A.online = false;
      setDbStatus("🟠 وضع محلي فقط (بدون سحابة)");
      initApp();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
