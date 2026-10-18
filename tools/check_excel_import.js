"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const importer = require("../excel_import");

function testColumnNameMappingAndBlankCells() {
  const result = importer.mapRows("customers", [
    ["اسم العميل", "الرصيد الافتتاحي", "كود العميل", "رقم التليفون", "عمود غير معروف", "الاسم بالإنجليزية"],
    ["أحمد", 1500, "C-1", "010123", "لا يستخدم", "Ahmed"],
    ["منى", "", "C-2", "010456", "", ""]
  ]);
  assert.strictEqual(result.errors.length, 0);
  assert.deepStrictEqual(result.rows[0], {
    name_ar: "أحمد",
    opening_balance: 1500,
    code: "C-1",
    phone: "010123",
    name_en: "Ahmed"
  });
  assert.deepStrictEqual(result.rows[1], {
    name_ar: "منى",
    code: "C-2",
    phone: "010456"
  });
  assert.deepStrictEqual(result.ignoredHeaders, ["عمود غير معروف"]);
}

function testArabicNumbersAndActivityValues() {
  const result = importer.mapRows("products", [
    ["اسم الصنف", "سعر البيع", "نشط"],
    ["قلم", "١٬٢٥٠٫٥", "نعم"],
    ["كراسة", 0, "لا"]
  ]);
  assert.strictEqual(result.errors.length, 0);
  assert.deepStrictEqual(result.rows, [
    { name_ar: "قلم", sale_price: 1250.5, is_active: true },
    { name_ar: "كراسة", sale_price: 0, is_active: false }
  ]);
}

function testDuplicateMappedHeadersRejected() {
  assert.throws(() => importer.mapRows("customers", [
    ["اسم العميل", "name_ar"],
    ["أحمد", "Ahmed"]
  ]), /مكرر/);
}

function testCsvQuotingAndDelimitedHeaders() {
  const rows = importer.parseCsv('اسم العميل;العنوان\r\n"أحمد; محمد";"شارع ""النيل"""\r\n');
  assert.deepStrictEqual(rows, [
    ["اسم العميل", "العنوان"],
    ["أحمد; محمد", 'شارع "النيل"']
  ]);
}

async function testRealXlsxFileParsing() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("البيانات");
  sheet.addRow(["كود الصنف", "اسم الصنف", "سعر البيع"]);
  sheet.addRow(["P-1", "صنف أول", 25]);
  const buffer = await workbook.xlsx.writeBuffer();
  const result = await importer.parseFile({
    name: "products.xlsx",
    size: buffer.byteLength,
    arrayBuffer: async () => buffer
  }, "products", ExcelJS);
  assert.strictEqual(result.errors.length, 0);
  assert.deepStrictEqual(result.rows, [{ code: "P-1", name_ar: "صنف أول", sale_price: 25 }]);
}

function testMigrationFunctionReferencesAndGrants() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "supabase-upgrade-61-excel-import.sql"), "utf8");
  const referenceHelper = "mizan_admin_excel_replace_has_references";
  assert.deepStrictEqual(importer.TABLES.map((table) => table.key), [
    "customers", "suppliers", "products", "treasury", "accounts"
  ]);
  ["categories", "units", "warehouses", "owners"].forEach((table) => {
    assert(!sql.includes("when '" + table + "'"));
  });
  assert(sql.includes("create or replace function public." + referenceHelper + "("));
  assert(sql.includes("public." + referenceHelper + "(p_org_id, p_table)"));
  assert(sql.includes("revoke all on function public." + referenceHelper + "(uuid, text) from public, anon, authenticated;"));
  assert(sql.includes(
    "revoke all on function public.mizan_admin_import_excel(uuid, text, text, jsonb) from public, anon;"
  ));
  assert(sql.includes(
    "grant execute on function public.mizan_admin_import_excel(uuid, text, text, jsonb) to authenticated;"
  ));
}

(async () => {
  testColumnNameMappingAndBlankCells();
  testArabicNumbersAndActivityValues();
  testDuplicateMappedHeadersRejected();
  testCsvQuotingAndDelimitedHeaders();
  await testRealXlsxFileParsing();
  testMigrationFunctionReferencesAndGrants();
  console.log("Excel import checks: 6/6 passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
