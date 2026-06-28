import {
  applyMonthYearHeader,
  createCartolaDateContext,
  parseMonthYearHeader,
  resolveCartolaDate,
} from "../dist/index.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

console.log("── Cartola date tests ───────────────────────────────────\n");

console.log("parseMonthYearHeader:");
{
  const h = parseMonthYearHeader("Mayo 2026", 2026);
  assert(h?.month === 5 && h?.year === 2026, "Mayo 2026 → 5/2026");
  assert(parseMonthYearHeader("Junio 2026", 2026)?.month === 6, "Junio 2026");
}

console.log("section header resets context:");
{
  let ctx = createCartolaDateContext(2026);
  ctx = { ...ctx, lastDate: "30/06/2026", sectionMonth: 6, sectionYear: 2026 };
  const next = applyMonthYearHeader("Mayo 2026", ctx, 2026);
  assert(next?.sectionMonth === 5 && next.lastDate === "", "Mayo header clears June lastDate");
  ctx = next;
  const pay = resolveCartolaDate("30", ctx, 2026);
  assert(pay.date === "30/05/2026", `day-only 30 under Mayo → 30/05/2026 (got ${pay.date})`);
}

console.log("full dd/mm in row:");
{
  let ctx = createCartolaDateContext(2026);
  const r = resolveCartolaDate("02/06", ctx, 2026);
  assert(r.date === "02/06/2026", "02/06 → 02/06/2026");
  assert(r.ctx.sectionMonth === 6, "updates section month from full date");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
