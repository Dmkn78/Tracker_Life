import test from "node:test";
import assert from "node:assert/strict";
import { normalizeServerAddress } from "./serverAddress.ts";

test("accepts the personal LAN API and HTTPS without a trailing slash", () => {
  assert.equal(normalizeServerAddress(" http://192.168.1.20:8000/ "), "http://192.168.1.20:8000");
  assert.equal(normalizeServerAddress("https://life.example.com"), "https://life.example.com");
  assert.equal(normalizeServerAddress("http://10.0.2.2:8000"), "http://10.0.2.2:8000");
});

test("rejects public cleartext, credentials, paths and alternate protocols", () => {
  for (const url of ["http://public.example.com", "https://user:pass@life.example.com", "https://life.example.com/api", "https://life.example.com?token=x", "file:///data", "javascript:alert(1)"]) {
    assert.throws(() => normalizeServerAddress(url));
  }
});

test("allows only the explicitly configured VPS HTTP origin", () => {
  const personalOrigin = "http://203.0.113.10";
  assert.equal(normalizeServerAddress(personalOrigin + "/", personalOrigin), personalOrigin);
  for (const other of ["http://203.0.113.11", "http://203.0.113.10:8000", "http://203.0.113.10.example.com", "http://203.0.113.10@other.example.com"]) {
    assert.throws(() => normalizeServerAddress(other, personalOrigin));
  }
  assert.throws(() => normalizeServerAddress(personalOrigin));
  assert.throws(() => normalizeServerAddress("http://public.example.com", "http://public.example.com"));
});
