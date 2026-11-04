import assert from "node:assert/strict";
import test from "node:test";
import { MOBILE_PAGES, mobileRouteHref, parseMobileRoute, selectedMobileDate } from "./routes.ts";

test("every mobile section has a route, including the website dashboard aliases", () => {
  for (const page of MOBILE_PAGES) assert.equal(parseMobileRoute(`#${mobileRouteHref(page)}`).page, page);
  assert.equal(parseMobileRoute("/dashboard/life-terminal").page, "life-terminal");
  assert.equal(parseMobileRoute("/dashboard").page, "life-terminal");
  assert.equal(parseMobileRoute("/objectives/planning").page, "objectives-planning");
  assert.deepEqual(parseMobileRoute("/knowledge?note=Cours%2FA.md"), { page: "knowledge", search: "?note=Cours%2FA.md" });
});

test("history, log dates and period selections survive hash navigation", () => {
  assert.deepEqual(parseMobileRoute("#/daily-log?date=2026-09-12"), { page: "daily-log", search: "?date=2026-09-12" });
  assert.deepEqual(parseMobileRoute("/history?filter=last7"), { page: "history", search: "?filter=last7" });
  assert.deepEqual(parseMobileRoute("/time-allocation?period=week&date=2026-09-14"), { page: "time-allocation", search: "?period=week&date=2026-09-14" });
  for (const href of ["//other.example/daily-log", "https://other.example/todo", "/api/daily-log", "/unknown"]) assert.equal(parseMobileRoute(href), null);
});

test("log date defaults to today and rejects impossible dates", () => {
  for (const search of ["", "?date=2026-02-30", "?date=nonsense", "?date=2026-13-01"]) assert.equal(selectedMobileDate(search, "2026-09-17"), "2026-09-17");
  assert.equal(selectedMobileDate("?date=2024-02-29", "2026-09-17"), "2024-02-29");
});
