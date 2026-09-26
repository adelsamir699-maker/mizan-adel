/* ================================================================
   برنامج ميزان - نسخة الويب | صفحة دليل العملاء
   By Adel Samir - واتس: 01002655282
   نسخة تجريبية: البيانات محفوظة في متصفحك (localStorage)
   ================================================================ */

(function () {
  "use strict";

  // رقم الإصدار المعروض للمستخدم — يُحدَّث مع كل مراجعة
  const APP_VERSION = "84";

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
  const LS_SETTINGS = "mizan_settings_v1";
  // كل مفاتيح البيانات المحلية (مشتركة بين كل الحسابات في نفس المتصفح)
  const LS_ALL_KEYS = [
    LS_CUSTOMERS, LS_TXS, LS_PRODUCTS, LS_ACTIVITY, LS_SALES, LS_TREASURY,
    LS_SUPPLIERS, LS_SUP_TXS, LS_PURCHASES, LS_ACCOUNTS, LS_JOURNAL,
    LS_USERS, LS_VOUCHERS, LS_SETTINGS
  ];
  // 🛡 عزل الشركات: أي مفتاح آخر كتبته بيانات شركة معينة
  // (لو دخل حساب من شركة تانية → البيانات القديمة تُمسح قبل التحميل)
  const LS_SRC_ORG = "mizan_src_org";

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
      id: 1, code: "CASH", nameAr: "العميل النقدي (كاش)",
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

  const CATEGORIES = ["عام", "ألبان", "مخبوزات", "زيوت", "سكريات", "مشروبات", "معلبات", "عصائر", "منظفات"];
  const UNITS = ["حبة", "عبوة", "كيس", "علبة", "كارتون", "طبق", "كيلو", "لتر", "زجاجة"];
  const WAREHOUSES = ["المخزن الرئيسي", "مخزن المنصورة", "مخزن الزقازيق"];

  const seedActivity = [
    { ts: "09:12:44", user: "admin", action: "تسجيل دخول", desc: "دخول مدير النظام" },
    { ts: "09:30:10", user: "admin", action: "فاتورة مبيعات", desc: "فاتورة POS #INV-1001" },
    { ts: "10:05:22", user: "admin", action: "تحصيل مديونية", desc: "دفعة من أحمد محمد السيد 500 ج.م" },
    { ts: "11:40:05", user: "admin", action: "إضافة صنف", desc: "إضافة صنف جديد" },
    { ts: "12:15:48", user: "admin", action: "فاتورة مشتريات", desc: "فاتورة مشتريات #PINV-2001" }
  ];

  const seedTreasury = [
    { id: 1, name: "الصندوق الرئيسي (نقدي)", type: "cash", balance: 25000 },
    { id: 2, name: "البنك الأهلي المصري (1234567890)", type: "bank", balance: 50000 },
    { id: 3, name: "محفظة فودافون كاش (01002655282)", type: "wallet", balance: 10000 }
  ];

  const seedSuppliers = [
    {
      id: 1, code: "SUPP-001", nameAr: "المورد النقدي (كاش)", phone: "", walletPhone: "",
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
    { id: 3, code: "1.1.1", nameAr: "الصناديق النقدية", type: "asset", parentId: 2, openingBalance: 25000, isActive: true },
    { id: 4, code: "1.1.2", nameAr: "البنوك والحسابات البنكية", type: "asset", parentId: 2, openingBalance: 50000, isActive: true },
    { id: 5, code: "1.1.3", nameAr: "المحافظ الإلكترونية", type: "asset", parentId: 2, openingBalance: 10000, isActive: true },
    { id: 6, code: "1.1.4", nameAr: "المخزون (بضاعة)", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 7, code: "1.1.5", nameAr: "مديونيات العملاء", type: "asset", parentId: 2, openingBalance: 0, isActive: true },
    { id: 8, code: "1.3", nameAr: "الأصول الثابتة", type: "asset", parentId: 1, openingBalance: 0, isActive: true },
    { id: 9, code: "1.3.1", nameAr: "المباني والمعدات", type: "asset", parentId: 8, openingBalance: 0, isActive: true },
    { id: 10, code: "2", nameAr: "الالتزامات", type: "liability", parentId: 0, openingBalance: 0, isActive: true },
    { id: 11, code: "2.1", nameAr: "الالتزامات المتداولة", type: "liability", parentId: 10, openingBalance: 0, isActive: true },
    { id: 12, code: "2.1.1", nameAr: "مستحقات الموردين", type: "liability", parentId: 11, openingBalance: 0, isActive: true },
    { id: 13, code: "2.1.2", nameAr: "ضريبة المبيعات المستحقة", type: "liability", parentId: 11, openingBalance: 0, isActive: true },
    { id: 14, code: "3", nameAr: "حقوق الملكية", type: "equity", parentId: 0, openingBalance: 0, isActive: true },
    { id: 15, code: "3.1", nameAr: "رأس المال", type: "equity", parentId: 14, openingBalance: 100000, isActive: true },
    { id: 16, code: "3.2", nameAr: "الأرباح المحتجزة", type: "equity", parentId: 14, openingBalance: 0, isActive: true },
    { id: 17, code: "4", nameAr: "الإيرادات", type: "revenue", parentId: 0, openingBalance: 0, isActive: true },
    { id: 18, code: "4.1", nameAr: "إيرادات المبيعات", type: "revenue", parentId: 17, openingBalance: 0, isActive: true },
    { id: 19, code: "5", nameAr: "المصروفات", type: "expense", parentId: 0, openingBalance: 0, isActive: true },
    { id: 20, code: "5.1", nameAr: "مصروفات عمومية وإدارية", type: "expense", parentId: 19, openingBalance: 0, isActive: true },
    { id: 21, code: "5.2", nameAr: "إيجارات وما شابه", type: "expense", parentId: 19, openingBalance: 0, isActive: true }
  ];

  const seedJournal = [];

  const seedUsers = [
    { id: 1, username: "admin", fullName: "مدير النظام", password: "123456", role: "مدير النظام", branch: "الفرع الرئيسي", isActive: true, lastSeen: "" }
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
    planStatus: "تجربة 🧪",
    publishUrl: "https://adelsamir699-maker.github.io/"
  };

  /* ================== الحالة ================== */
  let customers = [];
  let txs = [];
  let products = [];
  let activity = [];
  let sales = [];
  let treasury = [];
  let suppliers = [];
  let supplierTxs = [];
  let purchases = [];
  let accounts = [];
  let journalEntries = [];
  let users = [];
  let vouchers = [];
  let settings = {};
  let editingId = null;

  /* ================== أدوات ================== */
  const $ = (sel) => document.querySelector(sel);

  /* ================== الأدوات الأونلاين ================== */
  const DB = window.MIZAN_STATE;
  const A = { online: false, uid: null, adopting: false, cleaning: false };
  let planWatchTimer = null;
  let presenceTimer = null;

  function mirror() {
    DB.customers = customers;
    DB.products = products;
    DB.suppliers = suppliers;
    DB.treasury = treasury;
    DB.accounts = accounts;
    DB.sales = sales;
    DB.purchases = purchases;
    DB.supplier_txs = supplierTxs;
    DB.customer_txs = txs;
    DB.vouchers = vouchers;
    DB.journalEntries = journalEntries;
  }

  function pushTable(name) {
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
      if (!acc.allowed) {
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
  // مؤقت تحديث بطاقة (متصلون الآن) في لوحة الإدارة كل 15 ثانية
  let presenceViewTimer = null;
  function startPresenceView() {
    stopPresenceView();
    presenceViewTimer = setInterval(() => {
      const av = document.getElementById("viewAdmin");
      if (av && !av.hidden) refreshPresenceCard();
    }, 15000);
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
    try {
      customers = JSON.parse(localStorage.getItem(LS_CUSTOMERS)) || seedCustomers;
      txs = JSON.parse(localStorage.getItem(LS_TXS)) || seedTxs;
      products = (JSON.parse(localStorage.getItem(LS_PRODUCTS)) || []).map(normalizeProduct);
      activity = JSON.parse(localStorage.getItem(LS_ACTIVITY)) || seedActivity;
      sales = JSON.parse(localStorage.getItem(LS_SALES)) || [];
      treasury = JSON.parse(localStorage.getItem(LS_TREASURY)) || seedTreasury;
      suppliers = JSON.parse(localStorage.getItem(LS_SUPPLIERS)) || seedSuppliers;
      supplierTxs = JSON.parse(localStorage.getItem(LS_SUP_TXS)) || seedSupplierTxs;
      purchases = JSON.parse(localStorage.getItem(LS_PURCHASES)) || seedPurchases;
      accounts = JSON.parse(localStorage.getItem(LS_ACCOUNTS)) || seedAccounts;
      journalEntries = JSON.parse(localStorage.getItem(LS_JOURNAL)) || seedJournal;
      users = JSON.parse(localStorage.getItem(LS_USERS)) || seedUsers;
      vouchers = JSON.parse(localStorage.getItem(LS_VOUCHERS)) || seedVouchers;
      settings = Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(LS_SETTINGS)) || {});
      TAX.enabled = settings.taxEnabled == null ? TAX.enabled : Boolean(settings.taxEnabled);
      if (settings.taxRate != null) {
        const r = parseFloat(settings.taxRate) || 0;
        TAX.rate = r > 1 ? r / 100 : r;
      }
    } catch (e) {
      customers = seedCustomers;
      txs = seedTxs;
      products = seedProducts.map(normalizeProduct);
      activity = seedActivity;
      sales = [];
      treasury = seedTreasury;
      suppliers = seedSuppliers;
      supplierTxs = seedSupplierTxs;
      purchases = seedPurchases;
      accounts = seedAccounts;
      journalEntries = seedJournal;
      users = seedUsers;
      vouchers = seedVouchers;
      settings = Object.assign({}, defaultSettings);
    }
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
    if (!localStorage.getItem(LS_SETTINGS)) saveSettings();
  }

  function saveProducts() {
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));
    pushTable("products");
  }

  function saveSales() {
    localStorage.setItem(LS_SALES, JSON.stringify(sales));
    pushTable("sales");
  }

  function saveTreasury() {
    localStorage.setItem(LS_TREASURY, JSON.stringify(treasury));
    pushTable("treasury");
  }

  function saveSuppliers() {
    localStorage.setItem(LS_SUPPLIERS, JSON.stringify(suppliers));
    pushTable("suppliers");
  }

  function saveSupplierTxs() {
    localStorage.setItem(LS_SUP_TXS, JSON.stringify(supplierTxs));
    pushTable("supplier_txs");
  }

  function savePurchases() {
    localStorage.setItem(LS_PURCHASES, JSON.stringify(purchases));
    pushTable("purchases");
  }

  function saveAccounts() {
    localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
    pushTable("accounts");
  }

  function persistJournal() {
    localStorage.setItem(LS_JOURNAL, JSON.stringify(journalEntries));
    pushTable("journal_entries");
  }

  function saveUsers() {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  }

  function saveVouchers() {
    localStorage.setItem(LS_VOUCHERS, JSON.stringify(vouchers));
    pushTable("vouchers");
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
    pushTable("customers");
  }

  function saveTxs() {
    localStorage.setItem(LS_TXS, JSON.stringify(txs));
    pushTable("customer_txs");
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  /* ================== النوافذ ================== */
  function showModal(id) {
    $("#" + id).hidden = false;
  }

  function hideModal(id) {
    $("#" + id).hidden = true;
  }

  function printSection(el) {
    // اسم الشركة من الضبط (لكل شركة على حدة) يظهر في كل صفحات الطباعة
    const settOrg = (csetData && csetData.org) || (ssetData && ssetData.org);
    const settName = settOrg && settOrg.name;
    const org = settName || (settings && settings.orgName ? settings.orgName : (DATA.org() && DATA.org().name) || "مؤسستي التجارية");
    [["invOrgName"], ["ppOrgName"], ["stmOrgName"], ["skOrgName"], ["blpOrgName"], ["trpOrgName"]].forEach(([id]) => {
      const x = document.getElementById(id);
      if (x) x.textContent = org;
    });
    document.querySelectorAll(".print-only").forEach((s) => s.classList.remove("print-target"));
    el.classList.add("print-target");
    document.body.classList.add("printing");
    const cleanup = () => {
      el.classList.remove("print-target");
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1200);
  }

  /* ================== الروترة بين الشاشات ================== */
  const BUILT_VIEWS = ["dashboard", "customers", "products", "sales", "purchases", "suppliers", "returns", "treasury", "accounts", "journal", "balance", "treasuryStatements", "reports", "users", "audit", "settings", "clientSettings"];

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

  // صاحب الشركة = role admin وليس سوبر أدمن
  function isCompanyOwnerAcct() {
    var r = currentAcct();
    return !!(r && r.role === "admin" && !r.is_superadmin);
  }
  function isSuperAcct() {
    var r = currentAcct();
    return !!(r && r.is_superadmin);
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
  // «إعدادات مؤسستك» استثناءً: يجب أن يفعّلها صاحب الشركة **صريحًا** (opt-in).
  // المالك العام وصاحب الشركة مسموح لهما دائمًا لأن البيانات شركتهما.
  function canUseView(name) {
    var DE = window.DATA || {};
    if (name === "clientSettings") {
      if (isSuperAcct() || isCompanyOwnerAcct()) return true;
      if (!DE.featureFlag) return true; // احتياطي: لو الدالة غير موجودة نسمح
      return DE.featureFlag("clientSettings") === true;
    }
    return DE.featureEnabled ? DE.featureEnabled(name) : true;
  }

  // إخفاء أزرار الشاشات غير المفعّلة في اشتراك الشركة الحالية
  function applyFeatureGating() {
    var fe = window.DATA && window.DATA.featureEnabled;
    if (!fe) return;
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const n = b.dataset.view;
      b.hidden = !canUseView(n);
    });
    // لو الشاشة الحالية أصبحت معطّلة → عد للوحة
    const cur = document.querySelector(".view:not([hidden])");
    if (cur && !canUseView(cur.dataset.id)) showView("dashboard");
  }

  function showView(name) {
    // حماية: تبويب «إعدادات ونسخ احتياطي المالك» للمالك (سوبر أدمن) وحده.
    // أي حساب تاني — حتى لو حاول فتحه برمجيًا — يتحوّل لـ«إعدادات مؤسستك».
    const isOwner = !!window.__isOwner;
    if (name === "settings" && !isOwner) {
      name = "clientSettings";
      toast("هذا القسم للمالك فقط", "error");
    }
    // «إعدادات مؤسستك» لا تُفتح إلا لمن فعّلها صاحب الشركة (أو المالك/صاحب الشركة)
    if (name === "clientSettings" && !canUseView("clientSettings")) {
      toast("صلاحية «إعدادات مؤسستك» غير مفعّلة لحسابك", "error");
      name = "dashboard";
    }
    document.querySelectorAll(".view[data-id]").forEach((v) => {
      v.hidden = v.dataset.id !== name;
    });
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === name);
    });
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
    if (name === "treasury") { syncTreasuryFromSett(); renderTreasury(); renderTreMoves(); }
    if (name === "accounts") renderAccounts();
    if (name === "journal") renderJournal();
    if (name === "balance") renderBalance();
    if (name === "treasuryStatements") renderTreStmt();
    if (name === "reports") renderReports();
    if (name === "users") renderUsers();
    if (name === "audit") renderAudit();
    if (name === "settings") loadSettingsForm();
    if (name === "clientSettings") loadClientSettingsForm();
    if (name === "admin") { if (window.refreshPresenceCard) { startPresenceView(); refreshPresenceCard(); } }
    if (name !== "admin") stopPresenceView();
  }

  /* ================== لوحة التحكم ================== */
  function renderDashboard() {
    const today = todayISO();
    const isToday = (d) => (d || "").slice(0, 10) === today;
    const salesToday = sales.filter((s) => isToday(s.invoiceDate)).reduce((m, s) => m + (s.grandTotal || 0), 0);
    const purToday = purchases.filter((p) => isToday(p.invoiceDate)).reduce((m, p) => m + (p.grandTotal || 0), 0);
    const expToday = vouchers.filter((v) => v.type === "out" && isToday(v.date)).reduce((m, v) => m + (v.amount || 0), 0);
    const revToday = vouchers.filter((v) => v.type === "in" && isToday(v.date)).reduce((m, v) => m + (v.amount || 0), 0);
    const treTotal = treasury.reduce((m, t) => m + (t.balance || 0), 0);

    $("#kSales").textContent = fmt(salesToday) + " ج.م";
    $("#kPurchases").textContent = fmt(purToday) + " ج.م";
    $("#kExpenses").textContent = fmt(expToday) + " ج.م";
    $("#kProfit").textContent = fmt(Math.round((salesToday + revToday - purToday - expToday) * 100) / 100) + " ج.م";
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
    const tbody = $("#dgvCustomers tbody");
    tbody.innerHTML = "";
    const q = normalizeAr($("#txtCustomerSearch").value);

    customers
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
      .replace(/"/g, "&quot;");
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
      $("#fBalance").value = fmt(customer.openingBalance);
      $("#fBalance").disabled = true;
    } else {
      $("#addEditTitle").textContent = "إضافة عميل جديد";
      $("#btnSaveCustomer").textContent = "💾 إضافة العميل";
      $("#fCode").value = nextCustomerCode();
      $("#fCode").disabled = false;
      $("#fName").value = "";
      $("#fPhone").value = "";
      $("#fSecPhone").value = "";
      $("#fWallet").value = "";
      $("#fAddress").value = "";
      $("#fNotes").value = "";
      $("#fBalance").value = "0.00";
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

    const bal = parseFloat($("#fBalance").value) || 0;

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
    customers.forEach((c) => {
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
    const amount = parseFloat($("#pAmount").value);
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
    }
    txs.push({
      id: nextTxId(),
      customerId: cid,
      date: todayISO(),
      desc: notes,
      debit: 0,
      credit: amount
    });
    saveCustomers();
    saveTxs();
    hideModal("mPayDebt");
    toast("تم تسجيل السداد بنجاح.", "success");
    renderTable();
  }

  function todayISO() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ================== نافذة: خيارات العميل ================== */
  let actionsCust = null;
  let statementCtx = null;

  function openActions(cust) {
    actionsCust = cust;
    $("#actTitle").textContent = "👤 إدارة العميل: " + cust.nameAr + " (" + cust.code + ") - By Adel Samir - واتس: 01002655282";
    $("#actName").textContent = "👤 العميل: " + cust.nameAr;
    $("#actDetails1").textContent = "الكود: " + cust.code + " | الهاتف: " + (cust.phone || "-") + " | هاتف آخر: " + (cust.secondaryPhone || "-");
    $("#actDetails2").textContent = "العنوان: " + (cust.address || "-") + " | ملاحظات: " + (cust.notes || "-");
    const bal = $("#actBalance");
    bal.textContent = "الرصيد الحالي (المديونية): " + fmt(cust.currentBalance) + " ج.م";
    bal.className = "act-bal " + (cust.currentBalance > 0 ? "balance-debit" : "balance-credit");
    showModal("mActions");
  }

  /* ================== كشف الحساب ================== */
  function getStatement(cust) {
    const rows = txs
      .filter((t) => t.customerId === cust.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let run = 0;
    return rows.map((t) => {
      run = Math.round((run + t.debit - t.credit) * 100) / 100;
      return {
        date: t.date,
        desc: t.desc,
        debit: t.debit,
        credit: t.credit,
        balance: run
      };
    });
  }

  function fillStatementTable(tbodyEl, cust) {
    tbodyEl.innerHTML = "";
    const rows = getStatement(cust);
    if (rows.length === 0) {
      tbodyEl.innerHTML = '<tr><td colspan="5">لا توجد حركات على حساب هذا العميل.</td></tr>';
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
      tbodyEl.appendChild(tr);
    });
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

  function openStatement(cust) {
    statementCtx = { type: "customer", obj: cust };
    $("#stmTitle").textContent = "📋 كشف حساب تفصيلي: " + cust.nameAr;
    $("#stmHeadMini").innerHTML =
      "الكود: <b>" + esc(cust.code) + "</b> | الفترة: <b>" + dateRange() + "</b> | " +
      "الرصيد الحالي: <b class=\"" + (cust.currentBalance > 0 ? "balance-debit" : "balance-credit") + "\">" + fmt(cust.currentBalance) + " ج.م</b>";
    fillStatementTable($("#stmBodyMini"), cust);
    showModal("mStatement");
  }

  function printStatement(cust) {
    $("#stmName").textContent = cust.nameAr;
    $("#stmCode").textContent = cust.code;
    $("#stmRange").textContent = dateRange();
    const bal = $("#stmBal");
    bal.textContent = fmt(cust.currentBalance);
    bal.className = cust.currentBalance > 0 ? "balance-debit" : "balance-credit";
    fillStatementTable($("#stmBody"), cust);
    printSection($("#statementPage"));
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
          if (p.org.name) settings.orgName = p.org.name;
          if (!settings.orgAddress && p.org.address) settings.orgAddress = p.org.address;
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
      (unitsArr || []).forEach((u) => {
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
        '<td>' + esc(p.barcode || "-") + '</td>' +
        '<td>' + esc(p.nameAr) + '<div class="stk-mini">' + esc(stockDetail) + '</div></td>' +
        '<td>' + esc(p.category) + '</td>' +
        '<td>' + esc(p.unit) + '</td>' +
        '<td>' + esc(Number(p.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(p.purchasePrice) + '</td>' +
        '<td>' + fmt(p.weightedAvgCost) + '</td>' +
        '<td>' + fmt(p.salePrice) + '</td>' +
        '<td>' + discBadge + '</td>' +
        '<td>' + stBadge + '</td>' +
        '<td class="cell-actions"><button class="btn small blue" type="button" data-action="edit">✏️ تعديل</button></td>';
      tr.dataset.id = p.id;
      tr.querySelector('[data-action="edit"]').addEventListener("click", () => openProductDialog(p));
      tr.addEventListener("dblclick", () => openProductDialog(p));
      tbody.appendChild(tr);
    });
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
      $("#fPPurchase").value = fmt(product.purchasePrice);
      $("#fPSale").value = fmt(product.salePrice);
      $("#fPStock").value = Number(product.qty).toLocaleString("en-US");
      $("#fPStock").disabled = true;
      $("#fPDiscount").value = Number(product.discountPercent || 0).toLocaleString("en-US");
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
      $("#fPPurchase").value = "0.00";
      $("#fPSale").value = "0.00";
      $("#fPStock").value = "0";
      $("#fPStock").disabled = false;
      $("#fPDiscount").value = "0";
      $("#fPDiscStart").value = "";
      $("#fPDiscEnd").value = "";
      $("#fPStatus").value = "1";
    }
    showModal("mProduct");
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

    const purchase = parseFloat($("#fPPurchase").value) || 0;
    const sale = parseFloat($("#fPSale").value) || 0;
    const opening = parseFloat(String($("#fPStock").value).replace(/,/g, "")) || 0;
    const discount = parseFloat($("#fPDiscount").value) || 0;
    const status = $("#fPStatus").value === "1";

    if (editingProductId == null) {
      const pr = {
        id: nextProductId(),
        code: nextProductCode(),
        barcode: $("#fPBarcode").value.trim() || "",
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
      products.push(pr);
      saveProducts();
      addActivity("إضافة صنف", "إضافة صنف جديد: " + pr.nameAr + " (" + pr.code + ")");
      toast("تمت إضافة الصنف بنجاح.", "success");
    } else {
      const pr = products.find((p) => p.id === editingProductId);
      pr.barcode = $("#fPBarcode").value.trim() || "";
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

  function nextInvoiceNumber() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return "INV-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + String(sales.length + 1).padStart(4, "0");
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
    const custSel = $("#cmbPosCustomer");
    const prevCust = custSel.value;
    custSel.innerHTML = "";
    customers.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nameAr;
      custSel.appendChild(opt);
    });
    if (prevCust) custSel.value = prevCust;

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
    const def = customers.find((c) => c.code === "CASH") || customers.find((c) => (c.nameAr || "").includes("نقدي")) || customers[0];
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
    posSelectDefaultCustomer();
    posPaymentVisibility();
    posUpdateBadge(null);
    renderPosItems();
    posRecalc();
  }

  function posPaymentVisibility() {
    const m = $("#cmbPaymentMethod").value;
    const isBank = m.includes("بنكي");
    const isWallet = m.includes("محفظة");
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
      if (input) input.value = fmt(p.salePrice);
    }
  }

  function posOnCode() {
    const q = $("#txtPosCode").value.trim();
    if (!q) return;
    const p = findProductFlexible(q);
    if (p) {
      posUpdateBadge(p);
      const input = $("#txtPosPrice");
      if (input) input.value = fmt(p.salePrice);
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
    let price = parseFloat(String($("#txtPosPrice").value).replace(/,/g, ""));
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
    posUpdateBadge(prod);
    renderPosItems();
    posRecalc();
    if (posAddSource === "code") $("#txtPosCode").focus();
    else $("#txtPosSearch").focus();
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
        '<td>' + esc(it.unit) + '</td>' +
        '<td><input class="cell-input" data-f="qty" type="text" value="' + esc(it.qty) + '" /></td>' +
        '<td class="c-fixed">' + fmt(it.price) + '</td>' +
        '<td><input class="cell-input" data-f="discount" type="text" value="' + fmt(it.discount) + '" /></td>' +
        '<td class="c-tax' + (TAX.enabled ? '' : ' tax-hidden') + '"' + (TAX.enabled ? '' : ' style="display:none"') + '>' + fmt(it.tax) + '</td>' +
        '<td class="c-total">' + fmt(it.total) + '</td>' +
        '<td class="cell-actions"><button class="btn small red" type="button" data-f="del">❌</button></td>';
      tr.addEventListener("mouseenter", () => posUpdateBadge(products.find((p) => p.id === it.productId) || null));
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
        const p = products.find((x) => x.id === it.productId);
        const avail = p ? stockAt(p, warehouse) : 0;
        return p && avail >= it.qty ? null : it.nameAr + " (المتاح: " + Number(avail).toLocaleString("en-US") + ")";
      })
      .filter(Boolean);
    if (shortages.length > 0) {
      toast("لا يوجد رصيد كافٍ للأصناف التالية:\n" + shortages.join("\n"), "warning");
      return;
    }

    const t = posRecalc();
    const invoice = {
      id: sales.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      invoiceNumber: $("#txtInvoiceNo").value,
      invoiceDate: $("#dtpDate").value || todayISO(),
      customerId: cust.id,
      customerName: cust.nameAr,
      warehouse: warehouse,
      paymentMethod: payment,
      treasuryId: null,
      discountAmount: t.extra,
      taxAmount: t.tax,
      subTotal: t.sub,
      grandTotal: t.grand,
      items: posItems.map((it) => ({ productId: it.productId, code: it.code, nameAr: it.nameAr, unit: it.unit, qty: it.qty, price: it.price, discount: it.discount, tax: it.tax, total: it.total })),
      status: "posted"
    };

    if (payment === "آجل") {
      cust.currentBalance = Math.round((cust.currentBalance + t.grand) * 100) / 100;
      txs.push({ id: nextTxId(), customerId: cust.id, date: invoice.invoiceDate, desc: "فاتورة مبيعات آجلة رقم " + invoice.invoiceNumber, debit: t.grand, credit: 0 });
      saveCustomers();
      saveTxs();
    } else {
      const type = payment === "تحويل بنكي" ? "bank" : payment === "محافظ إلكترونية" ? "wallet" : "cash";
      const selId = payment === "تحويل بنكي" ? parseInt($("#cmbPosBank").value, 10)
        : payment === "محافظ إلكترونية" ? parseInt($("#cmbPosWallet").value, 10)
        : treasury.find((x) => x.type === "cash") ? treasury.find((x) => x.type === "cash").id : null;
      const tr = treasury.find((x) => x.id === selId && x.type === type) || treasury.find((x) => x.type === type);
      if (tr) {
        tr.balance = Math.round((tr.balance + t.grand) * 100) / 100;
        invoice.treasuryId = tr.id;
        saveTreasury();
      }
    }

    posItems.forEach((it) => {
      const p = products.find((x) => x.id === it.productId);
      if (p) addStockAt(p, warehouse, -it.qty);
    });
    saveProducts();

    sales.push(invoice);
    saveSales();
    addActivity("فاتورة مبيعات", "فاتورة " + invoice.invoiceNumber + " - " + cust.nameAr + " - " + fmt(t.grand) + " ج.م (" + payment + ")");

    toast("تم حفظ وتأكيد فاتورة المبيعات بنجاح برقم (" + invoice.invoiceNumber + ").", "success");
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
        '<td style="text-align:right">' + esc(it.nameAr) + '</td>' +
        '<td>' + esc(it.unit) + '</td>' +
        '<td>' + esc(Number(it.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(it.price) + '</td>' +
        '<td>' + fmt(it.discount) + '</td>' +
        (hasTax ? ('<td>' + fmt(it.tax) + '</td>') : '') +
        '<td>' + fmt(it.total) + '</td>';
      tb.appendChild(tr);
    });
    let footStr = "المجموع: <b>" + fmt(inv.subTotal) + " ج.م</b>";
    if (inv.discountAmount) footStr += " | الخصم الإضافي: <b>" + fmt(inv.discountAmount) + " ج.م</b>";
    if (hasTax) footStr += " | الضريبة: <b>" + fmt(inv.taxAmount) + " ج.م</b>";
    footStr += " | الصافي النهائي: <b>" + fmt(inv.grandTotal) + " ج.م</b>";
    $("#invFootPrint").innerHTML = footStr;
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
    const purchase = parseFloat($("#qCost").value) || 0;
    const sale = parseFloat($("#qSale").value) || 0;
    const qty = parseFloat($("#qQty").value) || 0;
    const disc = parseFloat($("#qDisc").value) || 0;
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
    products.push(p);
    saveProducts();
    addActivity("إضافة صنف", "إضافة صنف سريع من شاشة المبيعات: " + p.nameAr + " (" + p.code + ")");
    hideModal("mQuickProduct");
    fillPosDatalist();
    fillPPDatalist();
    $("#txtPosSearch").value = p.nameAr;
    $("#txtPosPrice").value = fmt(p.salePrice);
    posUpdateBadge(p);
    toast("تم حفظ الصنف (" + p.nameAr + ") برصيد " + qty + " في المخزن.", "success");
  }

  /* ---- إضافة سريعة: عميل ---- */
  function openQuickCustomer() {
    $("#qCCode").value = nextCustomerCode();
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
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return "PINV-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + String(purchases.length + 1).padStart(4, "0");
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
    if (prevSup && supSel.querySelector('option[value="' + prevSup + '"]')) supSel.value = prevSup;

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
    const def = suppliers.find((s) => s.code === "SUPP-001") || suppliers.find((s) => (s.nameAr || "").includes("نقدي")) || suppliers[0];
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
    ppSelectDefaultSupplier();
    ppPaymentVisibility();
    ppUpdateBadge(null);
    renderPPItems();
    ppRecalc();
  }

  function ppPaymentVisibility() {
    const m = $("#cmbPPaymentMethod").value;
    const isBank = m.includes("بنكي");
    const isWallet = m.includes("محفظة");
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
    ppUpdateBadge(prod);
    renderPPItems();
    ppRecalc();
    if (ppAddSource === "code") $("#txtPPCode").focus();
    else $("#txtPPSearch").focus();
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
        '<td>' + esc(it.unit) + '</td>' +
        '<td><input class="cell-input" data-f="qty" type="text" value="' + esc(it.qty) + '" /></td>' +
        '<td><input class="cell-input" data-f="price" type="text" value="' + fmt(it.price) + '" /></td>' +
        '<td><input class="cell-input" data-f="discount" type="text" value="' + fmt(it.discount) + '" /></td>' +
        '<td class="c-tax' + (TAX.enabled ? '' : ' tax-hidden') + '"' + (TAX.enabled ? '' : ' style="display:none"') + '>' + fmt(it.tax) + '</td>' +
        '<td class="c-total">' + fmt(it.total) + '</td>' +
        '<td class="cell-actions"><button class="btn small red" type="button" data-f="del">❌</button></td>';
      tr.addEventListener("mouseenter", () => ppUpdateBadge(products.find((p) => p.id === it.productId) || null));
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
    const invoice = {
      id: purchases.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      invoiceNumber: $("#txtPInvNo").value,
      invoiceDate: $("#dtpPDate").value || todayISO(),
      supplierId: supplier.id,
      supplierName: supplier.nameAr,
      warehouse: warehouse,
      paymentMethod: payment,
      treasuryId: null,
      discountAmount: t.extra,
      taxAmount: t.tax,
      subTotal: t.sub,
      grandTotal: t.grand,
      items: ppItems.map((it) => ({ productId: it.productId, code: it.code, nameAr: it.nameAr, unit: it.unit, qty: it.qty, price: it.price, discount: it.discount, tax: it.tax, total: it.total })),
      status: "posted"
    };

    if (payment === "آجل") {
      supplier.currentBalance = Math.round((supplier.currentBalance + t.grand) * 100) / 100;
      supplierTxs.push({ id: supplierTxs.reduce((m, x) => Math.max(m, x.id), 0) + 1, supplierId: supplier.id, date: invoice.invoiceDate, desc: "فاتورة مشتريات آجلة رقم " + invoice.invoiceNumber, debit: t.grand, credit: 0 });
      saveSuppliers();
      saveSupplierTxs();
    } else {
      const type = payment === "تحويل بنكي" ? "bank" : payment === "محافظ إلكترونية" ? "wallet" : "cash";
      const selId = payment === "تحويل بنكي" ? parseInt($("#cmbPPBank").value, 10)
        : payment === "محافظ إلكترونية" ? parseInt($("#cmbPPWallet").value, 10)
        : treasury.find((x) => x.type === "cash") ? treasury.find((x) => x.type === "cash").id : null;
      const tr = treasury.find((x) => x.id === selId && x.type === type) || treasury.find((x) => x.type === type);
      if (tr) {
        tr.balance = Math.round((tr.balance - t.grand) * 100) / 100;
        invoice.treasuryId = tr.id;
        saveTreasury();
      }
    }

    ppItems.forEach((it) => {
      const p = products.find((x) => x.id === it.productId);
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
    addActivity("فاتورة مشتريات", "فاتورة " + invoice.invoiceNumber + " - " + supplier.nameAr + " - " + fmt(t.grand) + " ج.م (" + payment + ")");

    toast("تم حفظ وتأكيد فاتورة المشتريات بنجاح برقم (" + invoice.invoiceNumber + ").", "success");
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
        '<td style="text-align:right">' + esc(it.nameAr) + '</td>' +
        '<td>' + esc(it.unit) + '</td>' +
        '<td>' + esc(Number(it.qty).toLocaleString("en-US")) + '</td>' +
        '<td>' + fmt(it.price) + '</td>' +
        '<td>' + fmt(it.discount) + '</td>' +
        (hasTax ? ('<td>' + fmt(it.tax) + '</td>') : '') +
        '<td>' + fmt(it.total) + '</td>';
      tb.appendChild(tr);
    });
    let footStr = "المجموع: <b>" + fmt(inv.subTotal) + " ج.م</b>";
    if (inv.discountAmount) footStr += " | الخصم الإضافي: <b>" + fmt(inv.discountAmount) + " ج.م</b>";
    if (hasTax) footStr += " | الضريبة: <b>" + fmt(inv.taxAmount) + " ج.م</b>";
    footStr += " | الصافي النهائي: <b>" + fmt(inv.grandTotal) + " ج.م</b>";
    $("#ppFoot").innerHTML = footStr;
    printSection($("#purchasePage"));
  }

  /* ---- إضافة سريعة: مورد ---- */
  function openQuickSupplier() {
    $("#qSCode").value = nextSupplierCode();
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
    $("#fSName").value = supplier ? supplier.nameAr : "";
    $("#fSPhone").value = supplier ? (supplier.phone || "") : "";
    $("#fSWallet").value = supplier ? (supplier.walletPhone || "") : "";
    $("#fSAddress").value = supplier ? (supplier.address || "") : "";
    $("#fSNotes").value = supplier ? (supplier.notes || "") : "";
    $("#fSOpening").value = supplier ? fmt(supplier.openingBalance || 0) : "0.00";
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
      s.openingBalance = parseFloat($("#fSOpening").value) || 0;
      saveSuppliers();
      addActivity("تعديل مورد", "تعديل بيانات المورد: " + s.nameAr);
      toast("تم حفظ التعديلات بنجاح.", "success");
    } else {
      const opening = parseFloat($("#fSOpening").value) || 0;
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
    const rows = supplierTxs
      .filter((t) => t.supplierId === sup.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let run = (parseFloat(sup.openingBalance) || 0);
    return rows.map((t) => {
      run = Math.round((run + t.debit - t.credit) * 100) / 100;
      return { date: t.date, desc: t.desc, debit: t.debit, credit: t.credit, balance: run };
    });
  }

  function openSuppActions(s) {
    actionsSupp = s;
    $("#sactTitle").textContent = "📦 إدارة المورد: " + s.nameAr + " (" + s.code + ")";
    $("#sactName").textContent = "📦 المورد: " + s.nameAr;
    $("#sactDetails1").textContent = "الكود: " + s.code + " | الهاتف: " + (s.phone || "-");
    $("#sactDetails2").textContent = "العنوان: " + (s.address || "-") + " | ملاحظات: " + (s.notes || "-");
    const bal = $("#sactBalance");
    bal.textContent = "الرصيد الحالي (المستحق): " + fmt(s.currentBalance) + " ج.م";
    bal.className = "act-bal " + (s.currentBalance > 0 ? "balance-debit" : "balance-credit");
    showModal("mSuppActions");
  }

  function openSupplierStatement(s) {
    statementCtx = { type: "supplier", obj: s };
    const rows = getSupplierStatement(s);
    const mini = $("#stmBodyMini");
    $("#stmTitle").textContent = "📋 كشف حساب تفصيلي: " + s.nameAr;
    $("#stmHeadMini").innerHTML =
      "الكود: <b>" + esc(s.code) + "</b> | الفترة: <b>" + dateRange() + "</b> | " +
      "الرصيد الحالي: <b class=\"" + (s.currentBalance > 0 ? "balance-debit" : "balance-credit") + "\">" + fmt(s.currentBalance) + " ج.م</b>";
    mini.innerHTML = "";
    if (!rows.length) {
      mini.innerHTML = '<tr><td colspan="5">لا توجد حركات على حساب هذا المورد.</td></tr>';
    } else {
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + esc(r.date) + '</td>' +
          '<td style="text-align:right">' + esc(r.desc) + '</td>' +
          '<td>' + (r.debit ? fmt(r.debit) : "-") + '</td>' +
          '<td>' + (r.credit ? fmt(r.credit) : "-") + '</td>' +
          '<td class="' + (r.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(r.balance) + '</td>';
        mini.appendChild(tr);
      });
    }
    showModal("mStatement");
  }

  function printSupplierStatement(s) {
    printStatementDoc({
      name: s.nameAr,
      code: s.code,
      range: dateRange(),
      balance: s.currentBalance,
      rows: getSupplierStatement(s)
    });
  }

  function openPaySuppDebt(supplier) {
    paySuppPreselected = supplier || null;
    const sel = $("#psSupplier");
    sel.innerHTML = "";
    suppliers.forEach((s) => {
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
    const amount = parseFloat($("#psAmount").value);
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
    }
    supplierTxs.push({
      id: supplierTxs.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      supplierId: sid,
      date: todayISO(),
      desc: $("#psNotes").value.trim() || "سداد مستحقات مورد",
      debit: 0,
      credit: amount
    });
    saveSuppliers();
    saveSupplierTxs();
    hideModal("mPaySuppDebt");
    addActivity("سداد مورد", "سداد مستحقات " + supp.nameAr + " بمبلغ " + fmt(amount) + " ج.م");
    toast("تم تسجيل السداد بنجاح.", "success");
    renderSuppliers();
  }

  /* ================== استعلام عن الفواتير ================== */
  function renderInvoiceQuery() {
    const fromS = $("#dtpFromS").value || "2000-01-01";
    const toS = $("#dtpToS").value || "2999-12-31";
    const fromP = $("#dtpFromP").value || "2000-01-01";
    const toP = $("#dtpToP").value || "2999-12-31";

    const inRange = (d, from, to) => (d || "") >= from && (d || "") <= to;

    const fill = (tbody, list, isSales) => {
      tbody.innerHTML = "";
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7">لا توجد فواتير في هذه الفترة.</td></tr>';
        return;
      }
      list.forEach((inv) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(inv.invoiceNumber) + '</td>' +
          '<td>' + esc(inv.invoiceDate) + '</td>' +
          '<td>' + esc(isSales ? inv.customerName : inv.supplierName) + '</td>' +
          '<td>' + fmt(inv.grandTotal) + ' ج.م</td>' +
          '<td>' + esc(inv.paymentMethod) + '</td>' +
          '<td class="cell-actions"><button class="btn small sky" type="button" data-act="print">🖨️ طباعة</button></td>';
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

    fill($("#dgvInvS tbody"), sales.filter((i) => inRange(i.invoiceDate, fromS, toS)).filter((i) => match(i, qs, i.customerName)), true);
    fill($("#dgvInvP tbody"), purchases.filter((i) => inRange(i.invoiceDate, fromP, toP)).filter((i) => match(i, qp, i.supplierName)), false);
  }

  /* ================== الخزينة والمصروفات ================== */
  let treasuryEditingId = null;
  let voucherMode = "in";

  // الضبط هو المرجع: نبني قائمة الخزائن من بيانات الضبط (بنوك + محافظ) مع إبقاء
  // الخزائن النقدية الموجودة، ونحافظ على معرفات الأصناف الشبيهة حتى لا تنكسر الفواتير.
  // إن لم تصل بيانات ضبط فعلية من السحابة (غير محمّلة/فارغة) نحتفظ بالقائمة الحالية دون مساس.
  function syncTreasuryFromSett() {
    try {
      const banks = (csetData && csetData.banks) || null;
      const wallets = (csetData && csetData.wallets) || null;
      if (!csetData || csetData.__online !== true) return false;
      const hasBankData = Array.isArray(banks) && banks.length;
      const hasWalletData = Array.isArray(wallets) && wallets.length;
      if (!hasBankData && !hasWalletData) {
        // لا بنوك ولا محافظ في الضبط → لا نمسّ القائمة الحالية
        return false;
      }
      const nextId = treasury.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
      const built = [];
      const used = {};
      const match = (type, name) => {
        for (const t of treasury) {
          if (used[t.id]) continue;
          if (t.type === type && t.name === name) { used[t.id] = true; return t; }
        }
        return null;
      };
      (banks || []).forEach((b) => {
        const name = (b.name || "").trim(); if (!name) return;
        const prev = match("bank", name);
        built.push({
          id: prev ? prev.id : nextId++,
          name: name,
          type: "bank",
          accountNo: (b.account_no || "").trim(),
          openingBalance: Number(b.opening_balance || 0),
          balance: Number((b.balance != null ? b.balance : b.opening_balance) || 0),
          isActive: b.is_active !== false
        });
      });
      (wallets || []).forEach((w) => {
        const name = (w.name || "").trim(); if (!name) return;
        const prev = match("wallet", name);
        built.push({
          id: prev ? prev.id : nextId++,
          name: name,
          type: "wallet",
          accountNo: (w.account_no || "").trim(),
          openingBalance: Number(w.opening_balance || 0),
          balance: Number((w.balance != null ? w.balance : w.opening_balance) || 0),
          isActive: w.is_active !== false
        });
      });
      // إبقاء الخزائن النقدية فقط؛ البنوك/المحافظ القديمة تُستبدل من الضبط
      treasury.forEach((t) => {
        if (used[t.id]) return;
        if (t.type !== "cash") return;
        built.push(t);
      });
      if (built.length === treasury.length &&
          built.every((b, i) => b.id === treasury[i].id && b.name === treasury[i].name && b.balance === treasury[i].balance)) {
        return false;
      }
      treasury = built;
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
        tr.innerHTML =
          '<td hidden></td>' +
          '<td>' + esc(t.name) + '</td>' +
          '<td>' + typeName + '</td>' +
          '<td>' + esc(t.accountNo || (t.type === "bank" ? "—" : t.type === "wallet" ? (t.phone || "—") : "—")) + '</td>' +
          '<td class="' + (t.balance > 0 ? "balance-debit" : "balance-credit") + '">' + fmt(t.balance) + ' ج.م</td>' +
          '<td>' + fmt(totals[t.id].in) + '</td>' +
          '<td>' + fmt(totals[t.id].out) + '</td>' +
          '<td class="cell-actions"><button class="btn small blue" type="button" data-act="edit">✏️</button></td>';
        tr.dataset.tid = t.id;
        tbody.appendChild(tr);
      });
  }

  function treasuryAmounts() {
    const map = {};
    treasury.forEach((t) => (map[t.id] = { in: 0, out: 0 }));
    sales.filter((s) => s.treasuryId && s.paymentMethod !== "آجل").forEach((s) => { if (map[s.treasuryId]) map[s.treasuryId].in += s.grandTotal; });
    purchases.filter((p) => p.treasuryId && p.paymentMethod !== "آجل").forEach((p) => { if (map[p.treasuryId]) map[p.treasuryId].out += p.grandTotal; });
    vouchers.forEach((v) => { if (map[v.treasuryId]) { if (v.type === "in") map[v.treasuryId].in += v.amount; else map[v.treasuryId].out += v.amount; } });
    Object.keys(map).forEach((k) => { map[k].in = Math.round(map[k].in * 100) / 100; map[k].out = Math.round(map[k].out * 100) / 100; });
    return map;
  }

  function openTreasuryDialog(t) {
    treasuryEditingId = t ? t.id : null;
    $("#treasuryModalTitle").textContent = t ? "✏️ تعديل الخزينة" : "➕ إضافة خزينة / حساب";
    $("#tName").value = t ? t.name : "";
    $("#tType").value = t ? t.type : "cash";
    $("#tAccountNo").value = t ? (t.accountNo || "") : "";
    $("#tOpening").value = t ? fmt(t.openingBalance || 0) : "0.00";
    showModal("mTreasury");
    $("#tName").focus();
  }

  function saveTreasuryModal() {
    const name = $("#tName").value.trim();
    if (!name) {
      toast("اسم الخزينة مطلوب.", "warning");
      return;
    }
    const type = $("#tType").value;
    if (treasuryEditingId) {
      const t = treasury.find((x) => x.id === treasuryEditingId);
      t.name = name;
      t.type = type;
      t.accountNo = $("#tAccountNo").value.trim();
      saveTreasury();
      addActivity("تعديل خزينة", "تعديل بيانات الخزينة: " + name);
      toast("تم حفظ التعديلات بنجاح.", "success");
    } else {
      const t = {
        id: treasury.reduce((m, x) => Math.max(m, x.id), 0) + 1,
        name: name,
        type: type,
        accountNo: $("#tAccountNo").value.trim(),
        openingBalance: parseFloat($("#tOpening").value) || 0,
        balance: parseFloat($("#tOpening").value) || 0
      };
      treasury.push(t);
      saveTreasury();
      addActivity("إضافة خزينة", "إضافة خزينة جديدة: " + name);
      toast("تمت إضافة الخزينة بنجاح.", "success");
    }
    hideModal("mTreasury");
    renderTreasury();
  }

  function openVoucher(mode) {
    voucherMode = mode;
    $("#voucherTitle").textContent = mode === "in" ? "➕ سند قبض (إيراد)" : "➖ سند صرف (مصروف)";
    const sel = $("#vTreasury");
    sel.innerHTML = "";
    treasury.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    $("#vDate").value = todayISO();
    $("#vAmount").value = "";
    $("#vDesc").value = mode === "in" ? "إيراد (سند قبض)" : "مصروف (سند صرف)";
    showModal("mVoucher");
    $("#vAmount").focus();
  }

  function saveVoucher() {
    const tid = parseInt($("#vTreasury").value, 10);
    const amount = parseFloat($("#vAmount").value);
    if (!tid) {
      toast("يرجى اختيار الخزينة.", "warning");
      return;
    }
    if (!(amount > 0)) {
      toast("يرجى كتابة مبلغ صحيح أكبر من الصفر.", "warning");
      return;
    }
    const t = treasury.find((x) => x.id === tid);
    const sign = voucherMode === "in" ? 1 : -1;
    t.balance = Math.round((t.balance + sign * amount) * 100) / 100;
    vouchers.push({
      id: vouchers.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      type: voucherMode,
      treasuryId: tid,
      date: $("#vDate").value || todayISO(),
      amount: Math.round(amount * 100) / 100,
      desc: $("#vDesc").value.trim() || (voucherMode === "in" ? "إيراد" : "مصروف")
    });
    saveTreasury();
    saveVouchers();
    hideModal("mVoucher");
    addActivity(voucherMode === "in" ? "سند قبض" : "سند صرف", (voucherMode === "in" ? "قبض إيراد" : "صرف مصروف") + " بمبلغ " + fmt(amount) + " ج.م (" + t.name + ")");
    toast("تم حفظ السند بنجاح.", "success");
    renderTreasury();
    renderTreMoves();
  }

  function renderTreMoves() {
    const moves = [];
    sales.filter((s) => s.treasuryId).forEach((s) => moves.push({ date: s.invoiceDate, name: (treasury.find((t) => t.id === s.treasuryId) || {}).name || "-", desc: "فاتورة مبيعات " + s.invoiceNumber, in: s.grandTotal, out: 0 }));
    purchases.filter((p) => p.treasuryId).forEach((p) => moves.push({ date: p.invoiceDate, name: (treasury.find((t) => t.id === p.treasuryId) || {}).name || "-", desc: "فاتورة مشتريات " + p.invoiceNumber, in: 0, out: p.grandTotal }));
    vouchers.forEach((v) => moves.push({ date: v.date, name: (treasury.find((t) => t.id === v.treasuryId) || {}).name || "-", desc: v.desc, in: v.type === "in" ? v.amount : 0, out: v.type === "out" ? v.amount : 0 }));
    moves.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = $("#dgvTreMoves tbody");
    tbody.innerHTML = "";
    moves.slice(0, 60).forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td>' + esc(m.date) + '</td>' +
        '<td>' + esc(m.name) + '</td>' +
        '<td style="text-align:right">' + esc(m.desc) + '</td>' +
        '<td>' + (m.in ? fmt(m.in) : "-") + '</td>' +
        '<td>' + (m.out ? fmt(m.out) : "-") + '</td>';
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
    $("#aOpening").value = a ? fmt(a.openingBalance || 0) : "0.00";
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
    const opening = parseFloat($("#aOpening").value) || 0;
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
      tr.innerHTML =
        '<td hidden></td>' +
        '<td>' + esc(j.number) + '</td>' +
        '<td>' + esc(j.date) + '</td>' +
        '<td style="text-align:right">' + esc(j.desc) + '</td>' +
        '<td>' + fmt(j.debit) + '</td>' +
        '<td>' + fmt(j.credit) + '</td>' +
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

  /* ================== قائمة المركز المالي ================== */
  function renderBalance() {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    $("#balDate").textContent = p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();

    const treasuryTotal = treasury.reduce((m, t) => m + (t.balance || 0), 0);
    const custDebts = customers.reduce((m, c) => m + Math.max(c.currentBalance || 0, 0), 0);
    const invValue = products.reduce((m, pr) => m + (pr.qty || 0) * (pr.weightedAvgCost || 0), 0);
    const suppDebts = suppliers.reduce((m, s) => m + Math.max(s.currentBalance || 0, 0), 0);
    const taxLiability = sales.reduce((m, s) => m + (s.taxAmount || 0), 0) - purchases.reduce((m, p2) => m + (p2.taxAmount || 0), 0);
    const capital = accounts.filter((a) => a.type === "equity").reduce((m, a) => m + (a.openingBalance || 0), 0);
    const profits = sales.reduce((m, s) => m + (s.grandTotal || 0), 0) - purchases.reduce((m, p2) => m + (p2.grandTotal || 0), 0) - vouchers.filter((v) => v.type === "out").reduce((m, v) => m + v.amount, 0) + vouchers.filter((v) => v.type === "in").reduce((m, v) => m + v.amount, 0);

    const assets = [
      ["الصناديق والبنوك والمحافظ", treasuryTotal],
      ["مديونيات العملاء", custDebts],
      ["المخزون (بالتكلفة المرجحة)", invValue],
      ["مصروفات مقدمة ومدينون آخرون", 0]
    ];
    const liab = [
      ["مستحقات الموردين", suppDebts],
      ["ضريبة المبيعات المستحقة", Math.max(taxLiability, 0)],
      ["رأس المال وحقوق الملكية", capital],
      ["أرباح الدورة (محققة)", Math.round(profits * 100) / 100]
    ];

    const ta = Math.round(assets.reduce((m, r) => m + r[1], 0) * 100) / 100;
    const tl = Math.round(liab.reduce((m, r) => m + r[1], 0) * 100) / 100;

    const fill = (tbodyId, rows, total) => {
      const tb = $(tbodyId);
      tb.innerHTML = "";
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td>' + esc(r[0]) + '</td><td>' + fmt(r[1]) + '</td>';
        tb.appendChild(tr);
      });
      const tr = document.createElement("tr");
      tr.innerHTML = '<td><b>الإجمالي</b></td><td><b>' + fmt(total) + '</b></td>';
      tr.style.fontWeight = "bold";
      tb.appendChild(tr);
    };
    fill("#dgvBalAssets tbody", assets, ta);
    fill("#dgvBalLiab tbody", liab, tl);

    const ok = Math.abs(ta - tl) < 0.01;
    $("#balResult").textContent = ok ? "الميزان متوازن ✓" : "فرق الميزان: " + fmt(Math.abs(ta - tl)) + " ج.م (يُعالج عبر القيود اليومية)";
    $("#balResult").className = "ft-total " + (ok ? "balance-credit" : "balance-debit");
  }

  function printBalance() {
    $("#blpOrg").textContent = settings.orgName || "مؤسستي";
    $("#blpDate").textContent = $("#balDate").textContent;
    const ta = $("#dgvBalAssets tbody").innerHTML;
    const tl = $("#dgvBalLiab tbody").innerHTML;
    $("#blpAssets").innerHTML = ta;
    $("#blpLiab").innerHTML = tl;
    $("#blpFoot").innerHTML = $("#balResult").textContent;
    printSection($("#balancePage"));
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
    sales.filter((s) => s.treasuryId === tid).forEach((s) => moves.push({ date: s.invoiceDate, desc: "فاتورة مبيعات " + s.invoiceNumber, in: s.grandTotal, out: 0 }));
    purchases.filter((p) => p.treasuryId === tid).forEach((p) => moves.push({ date: p.invoiceDate, desc: "فاتورة مشتريات " + p.invoiceNumber, in: 0, out: p.grandTotal }));
    vouchers.filter((v) => v.treasuryId === tid).forEach((v) => moves.push({ date: v.date, desc: v.desc, in: v.type === "in" ? v.amount : 0, out: v.type === "out" ? v.amount : 0 }));
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
        '<td>' + (r.in ? fmt(r.in) : "-") + '</td>' +
        '<td>' + (r.out ? fmt(r.out) : "-") + '</td>' +
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

    const agg = (list, isSales) => {
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
      return [...map.entries()].map(([name, v]) => ({ name: name, qty: Math.round(v.qty * 100) / 100, val: Math.round(v.val * 100) / 100 })).sort((a, b) => b.val - a.val);
    };

    const aggParty = (list, isSales) => {
      const map = new Map();
      list.filter((i) => inRange(i.invoiceDate)).forEach((inv) => {
        const name = isSales ? inv.customerName : inv.supplierName;
        const cur = map.get(name) || { count: 0, val: 0 };
        cur.count += 1;
        cur.val += inv.grandTotal;
        map.set(name, cur);
      });
      return [...map.entries()].map(([name, v]) => ({ name: name, count: v.count, val: Math.round(v.val * 100) / 100 })).sort((a, b) => b.val - a.val);
    };

    const fill = (tbodyId, rows, cols) => {
      const tb = $(tbodyId);
      tb.innerHTML = "";
      if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="' + cols + '">لا توجد بيانات.</td></tr>';
        return;
      }
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td>' + esc(r.name) + '</td><td>' + esc(r.qty != null ? Number(r.qty).toLocaleString("en-US") : r.count) + '</td><td>' + fmt(r.val) + '</td>';
        tb.appendChild(tr);
      });
    };

    fill("#dgvRepSales tbody", agg(sales, true).slice(0, 15), 3);
    fill("#dgvRepPurch tbody", agg(purchases, false).slice(0, 15), 3);
    fill("#dgvRepCust tbody", aggParty(sales, true), 3);
    fill("#dgvRepSupp tbody", aggParty(purchases, false), 3);

    const sTot = sales.filter((i) => inRange(i.invoiceDate)).reduce((m, i) => m + (i.grandTotal || 0), 0);
    const pTot = purchases.filter((i) => inRange(i.invoiceDate)).reduce((m, i) => m + (i.grandTotal || 0), 0);
    $("#repSummary").textContent = " | إجمالي المبيعات: " + fmt(sTot) + " ج.م | إجمالي المشتريات: " + fmt(pTot) + " ج.م";
  }

  function exportReports() {
    const from = $("#dtpRepFrom").value || "2000-01-01";
    const to = $("#dtpRepTo").value || "2999-12-31";
    const rows = [["صنف", "الكمية", "القيمة"]];
    $("#dgvRepSales tbody tr").forEach((tr) => rows.push([tr.cells[0].textContent, tr.cells[1].textContent, tr.cells[2].textContent]));
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
    $("#dgvAudit tbody tr").forEach((tr) => rows.push(Array.from(tr.cells || []).map((c) => c.textContent)));
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
      h += "<td>" +
        "<button class=\"btn small blue\" type=\"button\" onclick=\"window.__settEdit('" + prefix + "','" + type + "'," + idx + ")\">✏️</button> " +
        "<button class=\"btn small red\" type=\"button\" onclick=\"window.__settDel('" + prefix + "','" + type + "'," + idx + ")\">🗑️</button>" +
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
      def.fields.forEach(([f]) => {
        if (f === "is_active") { rec[f] = document.getElementById("setF_is_active").value === "1"; return; }
        const el = document.getElementById("setF_" + f);
        const v = el ? el.value : "";
        if (f === "balance" || f === "opening_balance" || f === "capital" || f === "withdrawals") rec[f] = parseFloat(v) || 0;
        else rec[f] = v;
      });
      if (root.__idx >= 0) list[root.__idx] = rec; else list.push(rec);
      data[key] = list;
      root.hidden = true;
      renderSettGrid(root.__prefix, root.__type);
      toast("تم التعديل محليًا. اضغط «حفظ جميع تبويبات» لحفظه.", "info");
    };
  }

  window.__settEdit = function (prefix, type, idx) { settOpenEditor(prefix, type, idx); };
  window.__settDel = function (prefix, type, idx) {
    const data = settPayload(prefix);
    const key = SETT_TYPES[type].key;
    const list = data[key] || [];
    const nm = list[idx] ? (list[idx].name || "هذا السجل") : "هذا السجل";
    if (!confirm("حذف «" + nm + "»؟")) return;
    list.splice(idx, 1);
    data[key] = list;
    renderSettGrid(prefix, type);
    toast("تم الحذف محليًا. اضغط «حفظ جميع تبويبات» لحفظه.", "info");
  };

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
    const g = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val == null ? "" : String(val); };
    g("#" + prefix + "setOrgName", org.name || "");
    g("#" + prefix + "setOrgPhone", org.phone || "");
    g("#" + prefix + "setOrgAddress", org.address || "");
    g("#" + prefix + "setOrgVat", org.tax_number || "");
    g("#" + prefix + "setOrgNote", org.org_note || "");
    g("#" + prefix + "setTaxEnabled", en ? "1" : "0");
    g("#" + prefix + "setTaxRate", rt || (en ? "14" : "0"));
    g("#" + prefix + "setTaxTitle", org.tax_title || "");
    g("#" + prefix + "setPaper", org.paper_size || "A4");
    g("#" + prefix + "setWarranty", org.warranty_terms || "");
  }

  // قراءة حقول بيانات المنشأة / الضريبة إلى كائن org (قبل الحفظ)
  function settReadOrgFields(prefix) {
    const p = settPayload(prefix);
    const org = p.org || {};
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    org.name = v(prefix + "setOrgName");
    org.phone = v(prefix + "setOrgPhone");
    org.address = v(prefix + "setOrgAddress");
    org.tax_number = v(prefix + "setOrgVat");
    org.org_note = v(prefix + "setOrgNote");
    org.tax_enabled = (v(prefix + "setTaxEnabled") === "1");
    const rawRate = parseFloat(String(v(prefix + "setTaxRate")).replace(/[^\d.-]/g, "")) || 0;
    org.tax_rate = rawRate;
    org.tax_title = v(prefix + "setTaxTitle");
    org.paper_size = v(prefix + "setPaper") || "A4";
    org.warranty_terms = v(prefix + "setWarranty");
    p.org = org;
    return org;
  }

  // ================== العميل: تحميل وحفظ تبويبات شركته ==================
  function loadClientSettingsForm() {
    if (A.online && DATA && DATA.clientSett) {
      $("#csettTabs").disabled = true;
      DATA.clientSett().then((p) => {
        csetData = p || { org: {}, categories: [], units: [], warehouses: [], owners: [], wallets: [], banks: [] };
        csetData.__online = true;
        if (csetData && csetData.org) {
          if (csetData.org.tax_enabled !== undefined && csetData.org.tax_enabled !== null) {
            applyTaxSettings(csetData.org.tax_enabled, csetData.org.tax_rate);
          }
        }
        applySettFeatureGatingClient();
        renderAllSettPanes("c");
        syncTreasuryFromSett();
      }).catch((e) => toast("تعذّر تحميل إعدادات مؤسستك: " + (e.message || e), "error"));
      return;
    }
    csetData = {
      org: { name: settings.orgName || "", phone: settings.orgPhone || "", address: settings.orgAddress || "", tax_number: settings.orgVat || "", org_note: settings.orgNote || "", tax_enabled: !!settings.taxEnabled, tax_rate: Math.round((settings.taxRate || 0) * 100), tax_title: "", paper_size: "A4", warranty_terms: "" },
      categories: [], units: [], warehouses: [], owners: [], wallets: [], banks: []
    };
    renderAllSettPanes("c");
  }

  function gatherSettPayload(prefix) {
    settReadOrgFields(prefix);
    return settPayload(prefix);
  }

  function saveClientSettingsForm() {
    const payload = gatherSettPayload("c");
    const doAfter = () => {
      applyTaxSettings(payload.org.tax_enabled, payload.org.tax_rate);
      settings.orgName = payload.org.name;
      saveSettings();
      addActivity("إعدادات", "تعديل إعدادات المؤسسة");
      toast("تم حفظ إعدادات مؤسستك بنجاح.", "success");
    };
    if (A.online && DATA && DATA.saveClientSett) {
      DATA.saveClientSett(payload).then(doAfter).catch((e) => toast("خطأ في الحفظ: " + (e.message || e), "error"));
    } else doAfter();
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
  function saveSettPane(prefix, type) {
    const isOwner = prefix === "s";
    const ttl = type === "org" ? "بيانات المنشأة" : type === "tax" ? "الضريبة والفواتير" : (SETT_TYPES[type] ? SETT_TYPES[type].title : type);
    let payload = {};
    if (type === "org" || type === "tax") {
      // يقرأ حقول المنشأة/الضريبة الحالية من الواجهة ويحدّث كائن org فقط (لا يمسّ القوائم)
      settReadOrgFields(prefix);
      payload.org = settPayload(prefix).org;
    } else {
      const key = SETT_TYPES[type].key;
      payload[key] = settList(prefix, type).slice();
    }
    const after = () => {
      if (payload.org) {
        applyTaxSettings(payload.org.tax_enabled, payload.org.tax_rate);
        settings.orgName = payload.org.name;
        saveSettings();
      }
      renderAllSettPanes(prefix);
      // الضبط هو المرجع → حدّث القوائم الحية بعد الحفظ مباشرة
      try {
        if (csetData && csetData.units) csetData = payload;
        syncOpenListsAfterSett();
        syncTreasuryFromSett();
        if (!document.getElementById("viewTreasury").hidden) renderTreasury();
      } catch (e) {}
      addActivity("إعدادات", "حفظ تبويب «" + ttl + "»");
      toast("تم حفظ «" + ttl + "» بنجاح.", "success");
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
      }).catch((e) => toast("خطأ في الحفظ: " + (e.message || e), "error"));
      return;
    }
    DATA.saveClientSett(payload).then(after).catch((e) => toast("خطأ في الحفظ: " + (e.message || e), "error"));
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
      ssetData = p || { org: {}, categories: [], units: [], warehouses: [], owners: [], wallets: [], banks: [] };
      renderAllSettPanes("s");
      const o = ssetOrgs.find((x) => x.org_id === orgId);
      if (o) {
        const t = $("#viewSettings .view-title");
        if (t) t.textContent = "🛡️ إعدادات ونسخ احتياطي المالك — " + (o.org_name || "");
      }
    }).catch((e) => toast("تعذّر تحميل إعدادات الشركة: " + (e.message || e), "error"));
  }

  function saveSettingsForm() {
    const orgId = $("#setOrgPicker") ? $("#setOrgPicker").value : null;
    if (!orgId || !ssetData) { toast("اختر الشركة أولًا.", "warning"); return; }
    const payload = gatherSettPayload("s");
    DATA.adminSettSave(orgId, payload).then(() => {
      addActivity("إعدادات", "تعديل إعدادات شركة (المالك)");
      toast("تم حفظ تبويبات الشركة بنجاح.", "success");
      renderAllSettPanes("s");
    }).catch((e) => toast("خطأ في الحفظ: " + (e.message || e), "error"));
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
  function backupAllData() {
    if (!DATA) return;
    const sel = document.getElementById("setBackupScope");
    const orgId = sel ? sel.value : "";
    const orgName = sel && sel.selectedOptions.length
      ? sel.selectedOptions[0].textContent.trim()
      : "الكل (كل العملاء)";
    toast("جارٍ تجهيز النسخة الاحتياطية (" + orgName + ")...", "info");
    const run = (prom) => prom.then((pack) => {
      if (!pack) throw new Error("لا توجد بيانات");
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
          addActivity("نسخ احتياطي شامل", "تصدير نسخة احتياطية (" + orgName + ")");
          toast("تم حفظ النسخة الاحتياطية في المكان الذي اخترته.", "success");
        }).catch((e) => {
          if (e && e.name === "AbortError") return;
          saveFile(() => {
            addActivity("نسخ احتياطي شامل", "تصدير نسخة احتياطية (" + orgName + ")");
            toast("تم حفظ النسخة الاحتياطية في مجلد التنزيلات.", "success");
          });
        });
      } else {
        saveFile(() => {
          addActivity("نسخ احتياطي شامل", "تصدير نسخة احتياطية (" + orgName + ")");
          toast("تم حفظ النسخة الاحتياطية في مجلد التنزيلات.", "success");
        });
      }
    });
    if (orgId) run(DATA.adminExportOne(orgId));
    else if (DATA.adminExportAll) run(DATA.adminExportAll());
    else toast("النسخة الاحتياطية غير متاحة.", "error");
  }

  // استعادة نسخة للمالك: يختار الشركة أولًا (أو الكل) من القائمة، بتحذير فقط — بدون باسورد
  function ownerRestoreFile(jsonStr) {
    let payload;
    try { payload = JSON.parse(jsonStr); } catch (e) { toast("الملف غير صالح أو تالف.", "warning"); return; }
    if (!payload || typeof payload !== "object") { toast("ملف النسخة غير صحيح.", "warning"); return; }
    const sel = document.getElementById("setRestoreScope");
    // لو الملف نسخة شركة واحدة (يحتوي org) نستعيد الشركة مباشرة بمعرّفها من الملف نفسه
    // — فيعمل حتى لو كانت الشركة محذوفة من السحابة (تُعاد إنشاؤها بكل بياناتها)
    const singleOrgId = (payload.org && payload.org.id) || null;
    const orgId = singleOrgId || (sel ? sel.value : "");
    const scopeName = singleOrgId
      ? (payload.org.name || "شركة محذوفة") + " (من الملف)"
      : (sel && sel.selectedOptions.length ? sel.selectedOptions[0].textContent.trim() : "الكل (كل العملاء)");
    if (singleOrgId) {
      const again = confirm("أعد استعادة شركة «" + scopeName + "»؟\nستُعاد كل بياناتها المخزنة من الملف إلى السحابة (نفس الشركة — تُنشأ مجددًا إن كانت محذوفة).\nملاحظة: حسابات أعضاء الشركة لا تُستعاد من الملف — ستعيد إنشاء حساب دخولها من شاشة الإدارة بعد الاستعادة.\nهل أنت متأكد؟");
      if (!again) { toast("تم إلغاء الاستعادة.", "info"); return; }
      if (!DATA) { toast("وضع السحابة غير متاح.", "error"); return; }
      toast("جارٍ استعادة الشركة من الملف...", "info");
      DATA.adminRestoreOne(singleOrgId, payload).then(() => {
        addActivity("نسخ احتياطي شامل", "استعادة شركة واحدة من الملف (" + scopeName + ")");
        toast("تمت استعادة الشركة بنجاح.", "success");
        setTimeout(() => window.location.reload(), 1600);
      }).catch((e) => {
        const msg = e && e.message ? e.message : String(e);
        toast("خطأ في الاستعادة: " + (msg.length > 140 ? msg.slice(0, 140) : msg), "error");
      });
      return;
    }
    const w = confirm("تحذير شديد ⚠️⚠️⚠️\n\nستُستبدل بيانات: «" + scopeName + "»\nببيانات هذا الملف نهائيًا. لا يمكن التراجع.\n\nهل أنت متأكد تمامًا؟");
    if (!w) { toast("تم إلغاء الاستعادة.", "info"); return; }
    if (!DATA) { toast("وضع السحابة غير متاح.", "error"); return; }
    toast("جارٍ استعادة النسخة...", "info");
    const prom = orgId ? DATA.adminRestoreOne(orgId, payload) : DATA.adminRestoreAll(payload);
    prom.then(() => {
      toast("تمت الاستعادة بنجاح.", "success");
      addActivity("نسخ احتياطي شامل", "استعادة نسخة (" + scopeName + ")");
      setTimeout(() => window.location.reload(), 1600);
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
      set(LS_TREASURY, o.treasury || seedTreasury);
      set(LS_SUPPLIERS, o.suppliers || []);
      set(LS_SUP_TXS, o.supplierTxs || []);
      set(LS_ACCOUNTS, o.accounts || seedAccounts);
      set(LS_JOURNAL, o.journalEntries || []);
      set(LS_USERS, o.users || seedUsers);
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
      if (cust.protected) {
        toast("لا يمكن حذف العميل النقدي (كاش) - محمي بالنظام.", "warning");
        return;
      }
      if (txs.some((t) => t.customerId === cust.id && t.credit > 0)) {
        toast("لا يمكن حذف العميل لوجود حركات على حسابه.", "warning");
        return;
      }
      if (confirm("هل أنت متأكد من حذف العميل (" + cust.nameAr + ")؟")) {
        customers = customers.filter((c) => c.id !== cust.id);
        saveCustomers();
        hideModal("mActions");
        toast("تم حذف العميل بنجاح.", "success");
        renderTable();
      }
    });
    $("#actClose").addEventListener("click", () => hideModal("mActions"));

    $("#btnPrintStmt").addEventListener("click", () => {
      if (statementCtx && statementCtx.type === "supplier") {
        printSupplierStatement(statementCtx.obj);
      } else {
        printStatement(actionsCust);
      }
    });
    $("#btnCloseStmt").addEventListener("click", () => hideModal("mStatement"));

    $("#btnAddProduct").addEventListener("click", () => openProductDialog(null));
    $("#btnStockTake").addEventListener("click", openStockTake);
    $("#btnTransferStock").addEventListener("click", openTransferModal);
    $("#btnRefreshProducts").addEventListener("click", renderProducts);
    $("#txtProductSearch").addEventListener("input", renderProducts);
    $("#cmbProductCategory").addEventListener("change", renderProducts);

    $("#btnSaveProduct").addEventListener("click", saveProduct);
    $("#btnCancelProduct").addEventListener("click", () => hideModal("mProduct"));

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
    $("#txtPosCode").addEventListener("input", posOnCode);
    $("#txtPosCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddSource = "code"; posAddItem(); }
    });
    $("#txtPosSearch").addEventListener("input", posOnSearch);
    $("#txtPosSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddSource = "search"; posAddItem(); }
    });
    $("#numPosQty").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddSource = "search"; posAddItem(); }
    });
    $("#txtPosPrice").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); posAddSource = "search"; posAddItem(); }
    });
    $("#btnPosAdd").addEventListener("click", posAddItem);
    $("#btnPosNew").addEventListener("click", posNewInvoice);
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
    $("#txtPPCode").addEventListener("input", ppOnCode);
    $("#txtPPCode").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddSource = "code"; ppAddItem(); }
    });
    $("#txtPPSearch").addEventListener("input", ppOnSearch);
    $("#txtPPSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddSource = "search"; ppAddItem(); }
    });
    $("#numPPQty").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddSource = "search"; ppAddItem(); }
    });
    $("#txtPPPrice").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ppAddSource = "search"; ppAddItem(); }
    });
    $("#btnPPAdd").addEventListener("click", ppAddItem);
    $("#btnPPNew").addEventListener("click", ppNewInvoice);
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
      if (s.protected) {
        toast("لا يمكن حذف المورد النقدي (كاش) - محمي بالنظام.", "warning");
        return;
      }
      if (supplierTxs.some((t) => t.supplierId === s.id)) {
        toast("لا يمكن حذف المورد لوجود حركات على حسابه.", "warning");
        return;
      }
      if (confirm("هل أنت متأكد من حذف المورد (" + s.nameAr + ")؟")) {
        suppliers = suppliers.filter((x) => x.id !== s.id);
        saveSuppliers();
        hideModal("mSuppActions");
        toast("تم حذف المورد بنجاح.", "success");
        renderSuppliers();
      }
    });
    $("#sactClose").addEventListener("click", () => hideModal("mSuppActions"));
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
      const btn = e.target.closest('[data-act="print"]');
      if (!btn) return;
      const tr = btn.closest("tr");
      const inv = sales.find((x) => x.id === parseInt(tr.dataset.iid, 10));
      if (inv) printInvoice(inv);
    });
    $("#dgvInvP tbody").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-act="print"]');
      if (!btn) return;
      const tr = btn.closest("tr");
      const inv = purchases.find((x) => x.id === parseInt(tr.dataset.iid, 10));
      if (inv) printPurchaseInvoice(inv);
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

    /* ---- إعدادات العميل ---- */
    $("#btnSaveClientSettings").addEventListener("click", saveClientSettingsForm);
    $("#btnClientBackup").addEventListener("click", backupData);
    $("#btnClientRestore").addEventListener("click", () => $("#fileClientRestore").click());
    $("#fileClientRestore").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => clientRestoreFile(String(ev.target.result));
      reader.readAsText(f);
      e.target.value = "";
    });

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
          if (action === "ref") renderSettGrid(prefix, type);
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
            toast("تم الحذف محليًا. اضغط «حفظ جميع تبويبات» لحفظه.", "info");
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
    // 🛡 تنظيف أي أثر للحساب السابق (الخروج لازم يمسح الهوية مش البيانات فقط)
    resetSessionState();
    $("#loginScreen").hidden = false;
    $("#orgScreen").hidden = true;
    $("#memberScreen").hidden = true;
  }
  function showOrgScreen() {
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = false;
    $("#memberScreen").hidden = true;
  }
  function hideScreens() {
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = true;
    $("#memberScreen").hidden = true;
    $("#denyScreen").hidden = true;
  }

  function setAuthMsg(el, txt, kind) {
    el.textContent = txt;
    el.className = "login-msg " + (kind || "");
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
    document.querySelectorAll(".ltab[data-ot]").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".ltab").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        $("#orgJoin").hidden = b.dataset.ot !== "join";
        $("#orgNew").hidden = b.dataset.ot === "join";
      });
    });

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
          setAuthMsg(m, "هذا الحساب غير مرتبط بأي شركة. تواصل مع إدارة البرنامج.", "err");
          return;
        }
        if (asCompany) {
          if (!isOrgAdmin(p)) {
            DATA.logout().catch(() => { });
            setAuthMsg(m, "هذا ليس حساب شركة. استخدم تبويب «تسجيل دخول مستخدم».", "err");
            return;
          }
          showMembersScreen();
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

    $("#btnOrgNew").addEventListener("click", () => {
      const name = $("#orgNewName").value.trim();
      const full = $("#orgNewFull").value.trim();
      const m = $("#orgMsg");
      if (!name) { setAuthMsg(m, "اكتب اسم الشركة.", "err"); return; }
      setAuthMsg(m, "جارٍ إنشاء شركتك...", "");
      DATA.createOrg(name, full).then(() => proceedOnline()).catch((err) => setAuthMsg(m, "خطأ: " + (err.message || err), "err"));
    });

    $("#btnOrgJoin").addEventListener("click", () => {
      const code = $("#orgJoinCode").value.trim();
      const name = $("#orgJoinName").value.trim();
      const m = $("#orgMsg");
      if (!code) { setAuthMsg(m, "اكتب رمز الدعوة.", "err"); return; }
      setAuthMsg(m, "جارٍ الانضمام...", "");
      DATA.joinOrg(code, name).then(() => proceedOnline()).catch((err) => setAuthMsg(m, "خطأ: " + (err.message || err), "err"));
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
    // خريطة معرّفات السحابة تخص الشركة السابقة → نفضيها
    if (window.MIZAN_STATE) window.MIZAN_STATE.idMap = {};
    // 🛡 نرجّع الجداول لحالة تجريبية نظيفة (مفيش بقايا بيانات شركة في الذاكرة)
    // مع منع أي رفع للسحابة أثناء التنظيف
    A.cleaning = true;
    try { loadData(); } finally { A.cleaning = false; }
    mirror();
    // 🛡 نخفي شاشات البرنامج القديمة حتى لا تبقى خلف شاشة الدخول
    document.querySelectorAll(".view").forEach((v) => { v.hidden = true; });
  }

  // 🛡 عزل الشركات: لو البيانات المحلية كتبها حساب من شركة أخرى
  // (أو مافيش علامة أصل أصلاً) → نمسحها ونرجع لحالة جهاز جديد
  function guardOrgSwitch() {
    const org = DATA && DATA.org && DATA.org() ? DATA.org().id : null;
    if (!org) return;
    let src = null;
    try { src = localStorage.getItem(LS_SRC_ORG); } catch (e) { }
    if (src !== org) {
      LS_ALL_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { } });
      loadData(); // يعيد البيانات التجريبية زي أي جهاز جديد
      toast("تم مسح بيانات الحساب السابق من هذا المتصفح", "ok");
    }
    try { localStorage.setItem(LS_SRC_ORG, org); } catch (e) { }
  }

  function seedPushFromLocal() {
    // لو السحابة فاضية والتطبيق لسه فيه بيانات تجريبية محلية → نرفعها للشركة الجديدة
    const S = window.MIZAN_STATE;
    const checks = [
      ["customers", customers], ["suppliers", suppliers], ["products", products],
      ["treasury", treasury], ["accounts", accounts]
    ];
    checks.forEach(([name, arr]) => {
      if (!arr || !arr.length || (S[name] && S[name].length)) return;
      // 🛡 مانرفعش بيانات تجريبية إلا بعد التأكد من أن الجدول فاضي فعلًا في القاعدة
      // (السحاب ممكن يحتوي سطورًا أُنشئت من أداة أخرى بلا local_id والتطبيق ما يقرأهاش)
      if (!DATA.countRows) { pushTable(name); return; }
      DATA.countRows(name).then((n) => { if (!n) pushTable(name); }).catch(() => { });
    });
  }

  function proceedOnline(stageEl, stageUser, bypassMembers) {
    const stage = (t) => { if (stageEl) setAuthMsg(stageEl, t, ""); };
    // مدير الشركة (غير المالك) حقه يدخل شاشة «حسابات شركتك» قبل البرنامج
    // (bypassMembers = true فقط عند الضغط على زر «دخول البرنامج» من شاشة حسابات الشركة)
    const p0 = DATA.getProfile();
    if (!bypassMembers && isOrgAdmin(p0)) { showMembersScreen(); return; }
    A.online = true;
    A.adopting = true;
    // 🛡 عزل الشركات: مانبقاش ببيانات أي حساب سابق قبل ما نبدأ التحميل
    guardOrgSwitch();
    // 🛡 فحص الصلاحيات الأول: ما نحمّلش أي بيانات من السحابة قبل تأكيد حق الدخول
    stage("جاري التحميل: فحص الصلاحيات...");
    DATA.requestAccess().then((acc) => {
      if (!(acc && acc.allowed)) { A.adopting = false; showDeny(acc); return; }
      stage("جاري التحميل: فتح الاتصال بالسحابة...");
      return window.CLOUD.loadAll().then(() => {
        adoptCloud();
        A.adopting = false;
        persistLocalFromCloud();
        seedPushFromLocal();
        $("#btnLogout").hidden = false;
        // لا نُظهره هنا: يُتحكم فيه داخل proceedOnline
        // (لصاحب الشركة والسوبر أدمن فقط، لا للموظفين العاديين)
        $("#btnChangePw").hidden = true;
        const p = DATA.getProfile();
        setUserInfo("👤 " + (p && p.full_name ? p.full_name : DATA.email()) + " | " + (p && p.role ? p.role : ""));
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
          const isAdmin = !!(acc && acc.is_superadmin);
          window.__isOwner = isAdmin;
          $("#btnAdmin").hidden = !isAdmin;
          $("#viewAdmin").hidden = !isAdmin;
          $("#viewSettings").hidden = !isAdmin;
          // 🔑 زر تغيير الرقم السري: لصاحب الشركة (admin) وللسوبر أدمن فقط.
          enforceChangePwBtn();
          // شاشة «إعدادات مؤسستك»: يُفتح فقط لو صاحب الشركة فعّلها لهذا الحساب
          // (أو المالك العام / صاحب الشركة نفسه).
          const csAllowed = canUseView("clientSettings");
          $("#viewClientSettings").hidden = !csAllowed;
          const svO = document.querySelector('.sidebar .nav-btn[data-view="settings"]');
          const svC = document.querySelector('.sidebar .nav-btn[data-view="clientSettings"]');
          // تبويب «إعدادات ونسخ احتياطي المالك» للمالك وحده.
          // بنحذفه من الـ DOM تمامًا (مش hidden بس) عشان ما يظهرش لحد ولا ينكشف بالفحص.
          // ولو محذوف وكان داخل المالك، بنرجّعه تاني (بعد تبديل الحساب مثلًا).
          if (svO) {
            if (isAdmin) {
              svO.hidden = false;
              if (!svO.parentNode) {
                const sb = document.querySelector(".sidebar");
                if (sb) sb.appendChild(svO);
              }
            } else if (svO.parentNode) {
              svO.parentNode.removeChild(svO);
            }
          }
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
    }).catch(() => {
      // 🛡 إغلاق الفتحة القديمة (fail-open): فشل فحص الصلاحيات = مانفتحش البرنامج
      A.adopting = false;
      showDeny(null);
    });
  }

  // مؤشر: هل الحساب الحالي مدير شركة (مش مالك النظام)؟ → شاشة الحسابات
  // لو مُرِّر profile ناقص/فارغ نرجع لـ mizan_access (المصدر الموثوق).
  function isOrgAdmin(p) {
    var r = (p && p.role) ? p : currentAcct();
    return !!(r && r.role === "admin" && !r.is_superadmin);
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
   if (canManage && !isMe) {
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

  function summarizeFeats(feats) {
    const f = feats || {};
    const off = Object.keys(f).filter((k) => f[k] === false);
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
    const off = Object.keys(f).filter((k) => f[k] === false);
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
      ADMIN_FEATURES.forEach(([k, label]) => {
        const on = !(u.features && u.features[k] === false);
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
      ADMIN_FEATURES.forEach(([k, label]) => {
        opts += "<label class=\"feat-line\"><input type=\"checkbox\" class=\"member-newfeat\" value=\"" + k + "\" checked /> " + label + "</label>";
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

  function adoptCloud() {
    const S = window.MIZAN_STATE;
    if (S.customers && S.customers.length) customers = S.customers;
    if (S.products && S.products.length) products = S.products;
    if (S.suppliers && S.suppliers.length) suppliers = S.suppliers;
    if (S.treasury && S.treasury.length) treasury = S.treasury;
    if (S.accounts && S.accounts.length) accounts = S.accounts;
    if (S.sales && S.sales.length) sales = S.sales;
    if (S.purchases && S.purchases.length) purchases = S.purchases;
    if (S.supplier_txs && S.supplier_txs.length) supplierTxs = S.supplier_txs;
    if (S.customer_txs && S.customer_txs.length) txs = S.customer_txs;
    if (S.vouchers && S.vouchers.length) vouchers = S.vouchers;
    if (S.journalEntries && S.journalEntries.length) journalEntries = S.journalEntries;
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
  }

  /* ================== شاشة "غير متاح" (وقت/قفل/حجب) ================== */
  function showDeny(acc) {
    const reasons = {
      plan: "انتهت مدة اشتراك شركتك. تواصل مع المالك لتجديدها.",
      locked: "شركتك مقفلة حاليًا من المالك. حاول لاحقًا.",
      blocked: "عضوك حديثًا محظور. تواصل مع مالك الشركة.",
      noprofile: "لا يوجد حساب مرتبط بشركة.",
      noorganization: "لا توجد شركة مرتبطة بحسابك."
    };
    $("#loginScreen").hidden = true;
    $("#orgScreen").hidden = true;
    $("#denyScreen").hidden = false;
    const a = DATA.accessInfo();
    const msgEl = $("#denyMsg");
    if (!acc) {
      msgEl.textContent = "تعذّر التحقق من اشتراكك.";
    } else if (acc.reason === "plan" && acc.plan_end) {
      msgEl.textContent = "أشتراك شركتك منتهي بتاريخ " + acc.plan_end + ". تواصل مع المالك للتفعيل.";
    } else {
      msgEl.textContent = reasons[acc.reason] || "لا يمكنك الدخول حاليًا.";
    }
    msgEl.className = "login-msg err";
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
        ["walletTab", "تبويب المحافظ الإلكترونية"], ["bankTab", "تبويب حسابات البنوك"], ["ownerTab", "تبويب أصحاب المنشأة"]
        ];

  function fmtDate(d) { return d ? String(d).slice(0, 10) : ""; }

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

  function renderAdminStats(orgs) {
    const box = $("#adminStats");
    if (!box) return;
    let total = orgs.length, active = 0, locked = 0, expired = 0, expiringSoon = 0, members = 0, noEnd = 0;
    orgs.forEach((o) => {
      members += o.members || 0;
      const until = daysUntil(o.plan_end);
      if (o.locked) { locked++; }
      else if ((o.plan_status === "expired" || (until !== null && until < 0)) && o.plan_end) { expired++; }
      else if (until !== null && until >= 0 && until <= 7 && o.plan_end) { expiringSoon++; }
      else if (o.plan_end) { active++; }
      else { noEnd++; }
    });
    box.innerHTML =
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات" onclick="window.__admCat(\'all\')"><span class="kpi-title">🏢 الشركات</span><span class="kpi-value">' + total + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الأعضاء" onclick="window.__admCat(\'members\')"><span class="kpi-title">👥 الأعضاء</span><span class="kpi-value">' + members + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض النشطة" onclick="window.__admCat(\'active\')"><span class="kpi-title">🟢 نشطة</span><span class="kpi-value">' + active + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات المنتهية اشتراكاتها قريبًا" onclick="window.__admCat(\'soon\')"><span class="kpi-title">🟠 خلال أسبوع</span><span class="kpi-value">' + expiringSoon + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض المنتهية/المقفلة" onclick="window.__admCat(\'expired\')"><span class="kpi-title">🔴 منتهية/مقفلة</span><span class="kpi-value">' + (expired + locked) + "</span></div>" +
      '<div class="kpi-card kpi-mini clk" title="اضغط لعرض الشركات بلا تاريخ" onclick="window.__admCat(\'noend\')"><span class="kpi-title">🚫 بلا تاريخ</span><span class="kpi-value">' + noEnd + "</span></div>" +
      '<div class="kpi-card kpi-mini online-card clk" id="kpiOnline" title="اضغط لعرض المتصلين الآن" onclick="window.__admPresence()"><span class="kpi-title">🟢 متصلون الآن</span><span class="kpi-value">…</span></div>';
    refreshPresenceCard();
  }

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
            list.map((u) => "<td><code>" + (u.username || "—") + "</code> " + (u.role === "admin" ? "🧑‍💼" : "👤") + " <span class=\"login-sub\">" + (u.full_name || "") + "</span></td></tr>").join("");
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
        active: () => orgs.filter((o) => !o.locked && o.plan_end && ((o.plan_status === "active") || (daysUntil(o.plan_end) !== null && daysUntil(o.plan_end) > 7))),
        soon: () => orgs.filter((o) => !o.locked && o.plan_end && daysUntil(o.plan_end) !== null && daysUntil(o.plan_end) >= 0 && daysUntil(o.plan_end) <= 7),
        expired: () => orgs.filter((o) => o.locked || (o.plan_end && (o.plan_status === "expired" || daysUntil(o.plan_end) < 0))),
        noend: () => orgs.filter((o) => !o.plan_end)
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
        if (locked) st = '<span class="badge-no">🔴 مقفلة</span>';
        else if (o.plan_end && (o.plan_status === "expired" || until < 0)) st = '<span class="badge-no">🔴 منتهية</span>';
        else if (o.plan_end && until >= 0 && until <= 7) st = '<span class="badge-warn">🟠 تنتهي خلال ' + until + " يوم</span>";
        else st = '<span class="badge-ok">🟢 نشطة</span>';
        h += '<tr data-cat="' + o.org_id + '" style="cursor:pointer" title="اضغط لفتح بيانات الشركة وتعديلها">' +
          "<td><b>" + (o.org_name || "بدون اسم") + "</b></td>" +
          "<td><code>" + (o.admin_username || "—") + "</code></td>" +
          "<td>" + (o.members || 0) + "</td>" +
          "<td>" + fmtDate(o.plan_end) + "</td>" +
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

  function renderAdminOrgs() {
    const box = $("#adminList");
    box.innerHTML = '<p class="login-sub">جارٍ تحميل الشركات...</p>';
    DATA.adminOrgs().then((orgs) => {
      if (!orgs || !orgs.length) {
        box.innerHTML = '<p class="login-sub">لا توجد شركات بعد.</p>';
        renderAdminStats(orgs || []);
        return;
      }
      renderAdminStats(orgs);
      renderAdminAlerts(orgs);
      let h = '<p class="login-sub" style="margin-bottom:8px">💡 اضغط على أي شركة <b>ضغطتين</b> (دبل كليك) لفتح شاشة بياناتها وتعديلها في أي وقت.</p>' +
        '<table class="data-table"><thead><tr>' +
        '<th>الشركة</th><th>يوزر نيم</th><th>تليفون المسئول</th><th>المالك</th><th>الأعضاء</th><th>من تاريخ</th><th>إلى تاريخ</th>' +
        '<th>الحالة</th><th>المزايا</th><th>إجراءات</th></tr></thead><tbody>';
      orgs.forEach((o) => {
        const locked = !!o.locked;
        const until = daysUntil(o.plan_end);
        let status;
        if (locked) {
          status = '<span class="badge-no">🔴 مقفلة</span>';
        } else if ((o.plan_status === "expired" || until < 0) && o.plan_end) {
          status = '<span class="badge-no">🔴 منتهية</span>';
        } else if (until !== null && until >= 0 && until <= 7 && o.plan_end) {
          status = '<span class="badge-warn">🟠 تنتهي خلال ' + until + " يوم</span>";
        } else if (o.plan_status === "active" || until === null) {
          status = '<span class="badge-ok">🟢 نشطة</span>';
        } else {
          status = '<span class="badge-no">🔴 ' + (o.plan_status || "متوقفة") + "</span>";
        }
        h += "<tr data-org=\"" + o.org_id + "\" onclick=\"window.__admDbl('" + o.org_id + "')\" style=\"cursor:pointer\" title=\"اضغط ضغطتين لتعديل بيانات الشركة\">" +
          "<td><b>" + (o.org_name || "بدون اسم") + (o.protected ? ' <span class="badge-ok" title="شركة المالك — محمية من الحذف">🔒</span>' : "") + "</b></td>" +
          "<td><code>" + (o.admin_username || "—") + "</code></td>" +
          "<td>" + (o.org_phone || "—") + "</td>" +
          "<td>" + (o.owner_name || "—") + "</td>" +
          "<td>" + (o.members || 0) + " / " + (o.max_members || 5) + "</td>" +
          "<td>" + fmtDate(o.plan_start) + "</td>" +
          "<td>" + fmtDate(o.plan_end) + "</td>" +
          "<td>" + status + "</td>" +
          "<td><button class=\"btn small teal\" type=\"button\" onclick=\"event.stopPropagation();window.__admFeats('" + o.org_id + "')\">⚙️ المزايا</button></td>" +
          "<td><button class=\"btn small blue\" type=\"button\" onclick=\"event.stopPropagation();window.__admDbl('" + o.org_id + "')\">✏️ بيانات الشركة</button> " +
          (o.protected
            ? '<span class="login-sub" title="شركة رئيسية تخص المالك">🔒 لا تُحذف</span>'
            : "<button class=\"btn small red\" type=\"button\" onclick=\"event.stopPropagation();window.__admDel('" + o.org_id + "')\">🗑 حذف</button>") +
          "</td>" +
          "</tr>";
      });
      h += "</tbody></table>";
      box.innerHTML = h;
    }).catch((e) => {
      box.innerHTML = '<p class="login-msg err">تعذّر تحميل الشركات: ' + (e.message || e) + "</p>";
    });
  }

  window.__admMembers = function (orgId) {
    const box = $("#adminDetail");
    $("#adminDetail").hidden = false;
    $("#adminDetailTitle").textContent = orgId;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    const cont = $("#adminMembers");
    cont.innerHTML = '<p class="login-sub">جارٍ تحميل الأعضاء...</p>';
    DATA.adminMembers(orgId).then((users) => {
      if (!users || !users.length) { cont.innerHTML = '<p class="login-sub">لا يوجد أعضاء.</p>'; return; }
      let h = '<table class="data-table"><thead><tr><th>العضو</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody>';
      const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
      users.forEach((u) => {
        const isMe = myUid && u.user_id === myUid;
        h += "<tr><td>" + (u.full_name || "—") + (isMe ? " <b>(أنت)</b>" : "") + "</td><td>" + (u.role || "member") + "</td>" +
          "<td>" + (u.blocked ? "🔴 محظور" : "🟢 نشط") + "</td>" +
          (isMe ? "<td><span class=\"login-sub\">لا يمكنك حظر نفسك</span></td>"
            : "<td><button class=\"btn small " + (u.blocked ? "green" : "red") + "\" type=\"button\" onclick=\"window.__admUser('" + u.user_id + "'," + (u.blocked ? "false" : "true") + ")\">" + (u.blocked ? "إلغاء الحظر" : "حظر") + "</button></td>") + "</tr>";
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
    const tr = document.querySelector('#adminList tr[data-org="' + orgId + '"]');
    if (!tr) return;
    const start = tr.querySelector(".adm-plan-start").value || null;
    const end = tr.querySelector(".adm-plan-end").value || null;
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
        DATA.adminExportOne(orgId).then((pack) => {
          if (!pack) throw new Error("لا توجد بيانات قابلة للنسخ الاحتياطي");
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
            .then(() => { toast("تم حفظ النسخة الاحتياطية على جهازك، وحُذفت الشركة نهائيًا من السحابة.", "ok"); })
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
      const o = orgs.find((x) => x.org_id === orgId);
      const feats = {};
      DATA.requestAccess().catch(() => {});
      // نبني الخريطة من البيانات المتوفرة داخل mizan_admin_orgs ننقصها — نعتمد على القيم الافتراضية
      let opts = "";
      ADMIN_FEATURES.forEach(([k, label]) => {
        opts += "<label class=\"feat-line\"><input type=\"checkbox\" class=\"adm-feat\" value=\"" + k + "\" checked /> " + label + "</label>";
      });
      const body = "<div class=\"feat-grid\">" + opts + "</div>" +
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
        DATA.adminSetOrg(orgId, null, null, null, on).then(() => {
          toast("تم حفظ المزايا", "ok");
          dlg.remove();
          renderAdminOrgs();
        }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
      };
    });
  };

  function openAdmin() {
    hideScreens();
    $("#denyScreen").hidden = true;
    renderAdminOrgs();
    showView("admin");
    startPresenceView();
    const p = DATA.getProfile();
    setUserInfo("👤 " + (p && p.full_name ? p.full_name : DATA.email()) + " | المالك");
  }

  // شاشة بيانات الشركة (ضغط مزدوج)
  function loadOrgMembers(orgId, boxSel, dlg) {
    const box = document.querySelector(boxSel);
    if (!box) return;
    box.innerHTML = '<p class="login-sub">جارٍ تحميل الأعضاء...</p>';
    DATA.adminMembers(orgId).then((users) => {
      if (!users || !users.length) { box.innerHTML = '<p class="login-sub">لا يوجد أعضاء.</p>'; return; }
      const adminUser = users.find((u) => u.role === "admin");
      if (dlg) dlg.__adminId = adminUser ? adminUser.user_id : null;
      let h = '<table class="data-table"><thead><tr><th>العضو</th><th>يوزر نيم</th><th>الصلاحية</th><th>المزايا</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
      const myUid = (DATA.me && DATA.me()) ? DATA.me().id : null;
      users.forEach((u) => {
        const isMe = myUid && u.user_id === myUid;
        h += "<tr>" +
          "<td>" + (u.full_name || "—") + (isMe ? " <b>(أنت)</b>" : "") + "</td>" +
          "<td><code>" + (u.username || "—") + "</code></td>" +
          "<td>" + (u.role || "member") + "</td>" +
          "<td>" + featsSummary(u.features, ADMIN_FEATURES) + "</td>" +
          "<td>" + (u.blocked ? "🔴 محظور" : "🟢 نشط") + "</td>" +
          "<td>" +
          "<button class=\"btn small sky\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admResetPw('" + u.user_id + "')\">🔑 تغيير كلمة المرور</button>" +
          "<button class=\"btn small blue\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admRenameUser('" + u.user_id + "')\">✏️ تغيير اليوزر نيم</button>" +
          (isMe ? "<span class=\"login-sub\" style=\"margin:2px\">لا يمكنك حظر نفسك</span>"
            : "<button class=\"btn small " + (u.blocked ? "green" : "red") + "\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admUser('" + u.user_id + "'," + (u.blocked ? "false" : "true") + ");\">" + (u.blocked ? "✅ إلغاء الحظر" : "⛔ حظر") + "</button>") +
          "<button class=\"btn small red\" style=\"margin:2px\" type=\"button\" onclick=\"window.__admDelMember('" + u.user_id + "')\">🗑️ حذف</button>" +
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
          '<label class="feat-line">كلمة المرور <button class="btn small orange" type="button" id="omAdminReset">🔑 تغيير كلمة مرور المدير</button></label>' +
          '<label class="feat-line">الاشتراك من <input id="omStart" class="inp" type="date" style="flex:1" /></label>' +
          '<label class="feat-line">الاشتراك إلى <input id="omEnd" class="inp" type="date" style="flex:1" /></label>' +
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

      const q = (sel) => dlg.querySelector(sel);
      q("#omNameTitle").textContent = o.org_name || "";
      q("#omName").value = o.org_name || "";
      q("#omMax").value = o.max_members || 5;
      q("#omPhone").value = o.org_phone || "";
      q("#omUser").textContent = o.admin_username || "—";
      q("#omStart").value = fmtDate(o.plan_start);
      q("#omEnd").value = fmtDate(o.plan_end);
      q("#omStatus").value = o.locked ? "locked" : "active";

      const loadMembers = () => loadOrgMembers(orgId, "#omMembers", dlg);
      loadMembers();

      if (!reusable) {
        q("#omSave").onclick = () => {
          const curOrg = dlg.__orgId;
          const name = q("#omName").value.trim();
          const max = parseInt(q("#omMax").value, 10);
          const phone = q("#omPhone").value.trim();
          const start = q("#omStart").value || null;
          const end = q("#omEnd").value || null;
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
            const admin = users.find((u) => u.role === "admin");
            if (!admin) { createAdminPrompt(curOrg, curName); return; }
            resetPwPrompt(admin.user_id, "كلمة مرور مدير الشركة", true);
          }).catch((e) => toast("خطأ: " + (e.message || e), "error"));
        };
        q("#omUserEdit").onclick = () => {
          const curOrg = dlg.__orgId;
          DATA.adminMembers(curOrg).then((users) => {
            const admin = users.find((u) => u.role === "admin");
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
    if (!confirm("حذف هذا العضو نهائيًا من قاعدة النظام؟\nبعد الحذف يمكنك إضافة حساب جديد بنفس اليوزر نيم أو كلمة المرور.\nلا يمكن التراجع عن هذه العملية.")) return;
    DATA.adminDeleteMember(userId).then(() => {
      toast("تم حذف العضو نهائيًا", "ok");
      const om = document.getElementById("orgModal");
      if (om && om.__orgId) loadOrgMembers(om.__orgId, "#omMembers", om);
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

  // إنشاء حساب مدير لشركة ليس بها حساب (المالك) — يُستخدم عند غياب مدير
  function createAdminPrompt(orgId, orgName) {
    const dlg = document.createElement("div");
    dlg.className = "modal-overlay";
    dlg.innerHTML = '<div class="modal-box"><div class="panel-title">👤 إنشاء حساب مدير لشركة «' + orgName + '»</div>' +
      '<p class="login-sub" style="margin-bottom:8px">هذه الشركة لا تملك حساب مدير حاليًا — أنشئ حسابًا ليتمكن مسئولها من الدخول.</p>' +
      '<label class="feat-line" style="margin:6px 0">يوزر نيم <input id="caUser" class="inp" placeholder="الاسم بلاتيني (latin)" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">كلمة المرور <input id="caPass" class="inp" type="password" placeholder="كلمة المرور" style="flex:1" /></label>' +
      '<label class="feat-line" style="margin:6px 0">اسم المدير <input id="caName" class="inp" placeholder="الاسم المعروض (اختياري)" style="flex:1" /></label>' +
      '<div class="feat-btns"><button class="btn green" type="button" id="caOk">إنشاء الحساب</button>' +
      '<button class="btn gray" type="button" id="caCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#caOk").onclick = () => {
      const un = dlg.querySelector("#caUser").value.trim();
      const pw = dlg.querySelector("#caPass").value;
      const nm = dlg.querySelector("#caName").value.trim() || null;
      if (!un || !pw) { toast("اكتب اليوزر نيم وكلمة المرور", "error"); return; }
      DATA.adminCreateUser(orgId, un, pw, nm, "admin").then(() => {
        toast("تم إنشاء حساب مدير الشركة", "ok");
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
      '<input id="aoUser" class="inp" placeholder="يوزر نيم مدير الشركة (latin)" />' +
      '<input id="aoPass" class="inp" type="password" placeholder="كلمة مرور مدير الشركة" />' +
      '</div>' +
      '<div class="feat-btns"><button class="btn green" type="button" id="aoOk">إنشاء الشركة</button>' +
      '<button class="btn gray" type="button" id="aoCancel">إلغاء</button></div></div>';
    document.body.appendChild(dlg);
    dlg.querySelector("#aoOk").onclick = () => {
      const name = dlg.querySelector("#aoName").value.trim();
      const user = dlg.querySelector("#aoUser").value.trim();
      const pass = dlg.querySelector("#aoPass").value;
      const max = parseInt(dlg.querySelector("#aoMax").value, 10) || 5;
      if (!name || !user || !pass) { toast("اكتب اسم الشركة ويوزر نيم وكلمة مرور المدير", "error"); return; }
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

  function setupAdmin() {
    $("#btnAdmin").addEventListener("click", openAdmin);
    $("#btnAdminRefresh").addEventListener("click", renderAdminOrgs);
    const btnAddOrg = $("#btnAdminAddOrg");
    if (btnAddOrg) btnAddOrg.addEventListener("click", () => openOrgModal());
    const btnLog = $("#btnAdminLog");
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

  /* ================== البداية ================== */
  function init() {
    const fv = document.getElementById("ftrVer");
    if (fv) fv.textContent = APP_VERSION;
    const lv = document.getElementById("loginVer");
    if (lv) lv.textContent = APP_VERSION;
    loadData();
    if (window.DATA && window.DATA.init) window.DATA.init();
    setupAdmin();
    const online = window.DATA && window.DATA.isOnline() && window.CLOUD;
    if (online) {
      A.online = true;
      setDbStatus("🟡 أونلاين — سجّل الدخول");
      setupAuth();
      showLogin();
    } else {
      A.online = false;
      setDbStatus("🟠 وضع محلي فقط (بدون سحابة)");
      initApp();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
