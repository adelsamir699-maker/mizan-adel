/* Browser-side Excel parsing and column-name mapping for the owner import screen. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MizanExcelImport = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TABLES = [
    {
      key: "customers", label: "العملاء", required: ["name_ar"],
      fields: [
        ["code", "الكود", "كود العميل", "رقم العميل"],
        ["name_ar", "اسم العميل", "اسم العميل عربي", "الاسم", "اسم"],
        ["name_en", "اسم العميل بالإنجليزية", "الاسم بالإنجليزية"],
        ["phone", "التليفون", "الهاتف", "رقم التليفون", "الموبايل"],
        ["address", "العنوان"],
        ["opening_balance", "الرصيد الافتتاحي", "رصيد افتتاحي", "الرصيد السابق"],
        ["credit_limit", "حد الائتمان", "الحد الائتماني"],
        ["is_active", "نشط", "حالة النشاط"]
      ]
    },
    {
      key: "suppliers", label: "الموردون", required: ["name_ar"],
      fields: [
        ["code", "الكود", "كود المورد", "رقم المورد"],
        ["name_ar", "اسم المورد", "اسم المورد عربي", "الاسم", "اسم"],
        ["phone", "التليفون", "الهاتف", "رقم التليفون", "الموبايل"],
        ["address", "العنوان"],
        ["opening_balance", "الرصيد الافتتاحي", "رصيد افتتاحي", "الرصيد السابق"],
        ["current_balance", "الرصيد الحالي", "الرصيد"],
        ["is_active", "نشط", "حالة النشاط"]
      ]
    },
    {
      key: "products", label: "الأصناف", required: ["name_ar"],
      fields: [
        ["code", "الكود", "كود الصنف", "رقم الصنف"],
        ["name_ar", "اسم الصنف", "الاسم", "اسم"],
        ["name_en", "اسم الصنف بالإنجليزية", "الاسم بالإنجليزية"],
        ["barcode", "الباركود", "باركود"],
        ["category", "التصنيف", "الفئة"],
        ["unit", "الوحدة", "وحدة القياس"],
        ["purchase_price", "سعر الشراء"],
        ["last_purchase_price", "آخر سعر شراء"],
        ["avg_purchase_price", "متوسط سعر الشراء"],
        ["sale_price", "سعر البيع"],
        ["stock_qty", "الكمية", "الكمية الحالية", "الرصيد بالمخزن"],
        ["min_stock", "حد التنبيه", "الحد الأدنى للمخزون"],
        ["is_active", "نشط", "حالة النشاط"]
      ]
    },
    {
      key: "treasury", label: "الخزائن والبنوك والمحافظ", required: ["name"],
      fields: [
        ["name", "اسم الخزينة", "اسم الحساب", "الاسم", "اسم"],
        ["type", "النوع", "نوع الحساب"],
        ["account_no", "رقم الحساب", "رقم المحفظة"],
        ["opening_balance", "الرصيد الافتتاحي", "رصيد افتتاحي"],
        ["balance", "الرصيد", "الرصيد الحالي"],
        ["is_active", "نشط", "حالة النشاط"]
      ]
    },
    {
      key: "accounts", label: "دليل الحسابات", required: ["name_ar"],
      fields: [
        ["code", "الكود", "كود الحساب"],
        ["name_ar", "اسم الحساب", "الاسم", "اسم"],
        ["type", "النوع", "نوع الحساب"],
        ["parent_id", "رقم الحساب الأب", "الحساب الأب"],
        ["opening_debit", "مدين افتتاحي"],
        ["opening_credit", "دائن افتتاحي"],
        ["balance", "الرصيد"],
        ["is_active", "نشط", "حالة النشاط"]
      ]
    },
  ];

  function headerKey(value) {
    return String(value == null ? "" : value).toLowerCase()
      .replace(/[ً-ْـ]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[\s_\-().:/\\]+/g, "");
  }

  function scalar(cell) {
    let value = cell;
    if (value && typeof value === "object") {
      if (value.result !== undefined) value = value.result;
      else if (Array.isArray(value.richText)) value = value.richText.map((part) => part.text || "").join("");
      else if (value.text !== undefined) value = value.text;
      else if (value.hyperlink) value = value.text || value.hyperlink;
      else if (value instanceof Date) value = value.toISOString().slice(0, 10);
      else value = "";
    }
    if (value == null) return "";
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : "";
    return String(value).trim();
  }

  const NUMERIC_KEYS = new Set([
    "opening_balance", "current_balance", "credit_limit", "purchase_price",
    "last_purchase_price", "avg_purchase_price", "sale_price", "stock_qty",
    "min_stock", "balance", "parent_id", "opening_debit", "opening_credit",
    "capital", "withdrawals"
  ]);

  function normalizeValue(key, value) {
    if (value === "" || value == null) return "";
    if (key === "is_active") {
      if (typeof value === "boolean") return value;
      const v = String(value).trim().toLowerCase();
      if (["نعم", "نشط", "فعال", "true", "1", "yes"].includes(v)) return true;
      if (["لا", "غير نشط", "موقوف", "false", "0", "no"].includes(v)) return false;
      throw new Error("قيمة النشاط يجب أن تكون نعم أو لا.");
    }
    if (NUMERIC_KEYS.has(key)) {
      const normalized = String(value)
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[٬,]/g, "")
        .replace(/٫/g, ".")
        .trim();
      if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
        throw new Error("قيمة رقمية غير صحيحة في عمود " + key + ".");
      }
      return Number(normalized);
    }
    return String(value);
  }

  /* ذيل الورقة: Excel بيخلي حدود الورقة توصل لآخر سطر (1,048,576) ولو الخانات
     تحت البيانات فاضية — صيغة أو تنسيق بيخلي كل سطر بعد آخر بيانات فيه قيمة.
     قبل كده كان بيرمي «1,047,306 صف ناقص» وبيقفّل زرار الرفع.
     القاعدة (مقاسة على ملفاته): السطر اللي تحت آخر سطر مكتمل، و**مافيش فيه أي
     علامة تعريف** (كود/اسم/باركود)، و**كل خانة مملوحة فيه عمود رقمي**،
     وفيه قيمتين أو أقل = ذيل ورقة ⇒ يتجاهل.
     ليه الشروط دي سوا؟ سطر الإجمالي بتاعه فيه رقم أو اتنين بلا اسم ⇒ ذيل ✓،
     وسطر «C3 / الرصيد 50» فيه كود ⇒ بيانات ناقصة الاسم ولازم تبان غلط زي الأول،
     وسطر فيه ٨ أرقام بلا اسم ⇒ كمان يبان عشان يقدر يصلحه،
     وسطر فيه **أي كلمة** (تليفون/وحدة/ملاحظة) تحت البيانات ⇒ مش متأكدين إنه ذيل،
     فيبان غلط ولا يختفي صامت — «ماتفقدش أي بيانات» أحسن من ذيل سكوت.
     (الرقم صفر أو "0" في عمود رقمي مش قيمة — نفس قرار بناء 222.) */
  const IDENTITY_KEYS = new Set(["code", "name_ar", "name_en", "name", "barcode"]);
  const TAIL_MAX_CELLS = 2;
  /* ملف «اللي ما نزّلش» مينفعش يبقى مليون سطر: بيجمّد الشاشة وبيمنع التحذير يظهر. */
  const MAX_FAILED_REPORT = 5000;

  function cellFilled(key, value) {
    if (value === "" || value == null) return false;
    if (typeof value === "boolean") return value;
    if (String(value).trim() === "") return false;
    if (NUMERIC_KEYS.has(key)) {
      let n = NaN;
      /* قيمة رقمية مرفوضة = وجود فعلًا؛ الخطأ ده هيتقال في الدورة التانية. */
      try { n = Number(normalizeValue(key, value)); } catch (e) { return true; }
      return Number.isFinite(n) && n !== 0;
    }
    return true;
  }

  /* الحكم على «ذيل الورقة»: علامة تعريف (كود/اسم/باركود) = سطر حقيقي.
     ولو أي خانة مملوحة مش من الأعمدة الرقمية (كلمة/تليفون/وحدة) = سطر حقيقي.
     غير كده وقيمته أو قيمتين أو أقل = ذيل ورقة؛ ولو أكتر من كده = بيانات
     ناقصة الاسم ولازم تظهر غلط عشان يصلحها. */
  function isPhantomTailRow(mapped, source) {
    let filled = 0;
    for (let column = 0; column < mapped.length; column++) {
      const key = mapped[column].key;
      if (!cellFilled(key, scalar(source[mapped[column].index]))) continue;
      if (IDENTITY_KEYS.has(key)) return false;
      if (!NUMERIC_KEYS.has(key)) return false;
      filled++;
      if (filled > TAIL_MAX_CELLS) return false;
    }
    return true;
  }

  function mapRows(tableKey, matrix) {
    const config = TABLES.find((table) => table.key === tableKey);
    if (!config) throw new Error("الجدول المختار غير متاح للاستيراد.");
    if (!Array.isArray(matrix) || !matrix.length) throw new Error("الملف لا يحتوي على صف عناوين.");
    const headers = matrix[0] || [];
    const aliases = new Map();
    config.fields.forEach((field) => {
      [field[0]].concat(field.slice(1)).forEach((label) => {
        const normalized = headerKey(label);
        if (normalized) aliases.set(normalized, field[0]);
      });
    });
    const mapped = [];
    const ignored = [];
    const seen = new Set();
    headers.forEach((header, index) => {
      const normalized = headerKey(header);
      if (!normalized) return;
      const key = aliases.get(normalized);
      if (!key) { ignored.push(String(header)); return; }
      if (seen.has(key)) throw new Error("العمود «" + header + "» مكرر لنفس الحقل.");
      seen.add(key);
      mapped.push({ index: index, key: key, label: String(header) });
    });
    if (!mapped.length) throw new Error("لم أتعرف على أسماء أعمدة الملف لهذا الجدول.");

    /* آخر سطر فيه كل الأعمدة المطلوبة — كل اللي بعده مرشّح يبقى ذيل ورقة.
       لو عمود مطلوب مش موجود في العناوين أصلًا، مافيش «آخر سطر سليم» ⇒ نسيب
       كل سطر يتحسب زي الأول عشان الأخطاء الحقيقية كلها تظهر. */
    const requiredColumns = config.required.map((key) => mapped.find((column) => column.key === key) || null);
    const requiredAllMapped = requiredColumns.every((column) => column !== null);
    let lastGood = 0;
    if (requiredAllMapped) {
      for (let rowIndex = matrix.length - 1; rowIndex >= 1; rowIndex--) {
        const source = matrix[rowIndex] || [];
        let complete = true;
        for (let r = 0; r < requiredColumns.length; r++) {
          if (!cellFilled(requiredColumns[r].key, scalar(source[requiredColumns[r].index]))) { complete = false; break; }
        }
        if (complete) { lastGood = rowIndex; break; }
      }
    }

    const rows = [];
    const errors = [];
    const failed = [];
    let tailIgnored = 0;
    let errorTotal = 0;
    let errorsTruncated = false;

    function noteFailure(rowIndex, message, source) {
      errorTotal++;
      if (errors.length < MAX_FAILED_REPORT) {
        errors.push({ row: rowIndex + 1, message: message });
        failed.push({ row: rowIndex + 1, message: message, cells: source.slice(0) });
      } else {
        errorsTruncated = true;
      }
    }

    for (let rowIndex = 1; rowIndex < matrix.length; rowIndex++) {
      const source = matrix[rowIndex] || [];
      if (requiredAllMapped && rowIndex > lastGood && isPhantomTailRow(mapped, source)) {
        tailIgnored++;
        continue;
      }
      const row = {};
      let hasValue = false;
      try {
        mapped.forEach((column) => {
          const value = scalar(source[column.index]);
          if (value === "") return;
          const normalized = normalizeValue(column.key, value);
          row[column.key] = normalized;
          /* صفوف Excel الممتدة لآخر الورقة (1,048,576) بتبان كأنها بيانات لأن
             خلية معادلة بترجّع صفر. الصفر لوحده مش بيانات ⇒ مايتحسبش صف ناقص. */
          if (NUMERIC_KEYS.has(column.key) && Number(normalized) === 0) return;
          hasValue = true;
        });
        if (!hasValue) continue;
        config.required.forEach((key) => {
          if (row[key] == null || row[key] === "") throw new Error("البيانات المطلوبة ناقصة: " + key);
        });
        rows.push(row);
      } catch (error) {
        noteFailure(rowIndex, error.message || String(error), source);
      }
    }
    return {
      rows: rows,
      mappedHeaders: mapped.map((column) => column.label),
      ignoredHeaders: ignored,
      errors: errors,
      failed: failed,
      tailIgnored: tailIgnored,
      errorTotal: errorTotal,
      errorsTruncated: errorsTruncated,
      scannedRows: Math.max(0, matrix.length - 1),
      lastGoodRow: lastGood + 1,
      headers: headers.map((header) => (header == null ? "" : String(header))),
      table: config
    };
  }

  async function parseFile(file, tableKey, ExcelJS) {
    if (!file || !file.name) throw new Error("اختر ملف Excel أو CSV أولًا.");
    const extension = file.name.split(".").pop().toLowerCase();
    let matrix;
    if (extension === "csv") {
      matrix = parseCsv(await file.text());
    } else if (extension === "xlsx") {
      if (!ExcelJS || !ExcelJS.Workbook) throw new Error("قارئ ملفات Excel غير جاهز.");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(new Uint8Array(await file.arrayBuffer()));
      const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
      if (!sheet) throw new Error("ورقة Excel الأولى فارغة.");
      matrix = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        matrix[row.number - 1] = row.values.slice(1);
      });
    } else {
      throw new Error("الملفات المدعومة هي .xlsx و.csv.");
    }
    return mapRows(tableKey, matrix);
  }

  function parseCsv(text) {
    const first = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
    const comma = (first.match(/,/g) || []).length;
    const semicolon = (first.match(/;/g) || []).length;
    const tab = (first.match(/\t/g) || []).length;
    const delimiter = tab > comma && tab > semicolon ? "\t" : (semicolon > comma ? ";" : ",");
    const rows = [];
    let row = [], value = "", quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '"') {
        if (quoted && source[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        row.push(value); value = "";
      } else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && source[i + 1] === "\n") i++;
        row.push(value); rows.push(row); row = []; value = "";
      } else value += ch;
    }
    row.push(value);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
    return rows;
  }

  return { TABLES: TABLES, mapRows: mapRows, parseCsv: parseCsv, parseFile: parseFile };
});
