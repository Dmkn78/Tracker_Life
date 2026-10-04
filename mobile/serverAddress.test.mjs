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

test("public HTTP is accepted only after explicit selection, including a custom port", () => {
  assert.throws(() => normalizeServerAddress("http://203.0.113.10:3000"), /Autoriser HTTP/);
  assert.equal(normalizeServerAddress(" http://203.0.113.10:3000/ ", "allow-http"), "http://203.0.113.10:3000");
  assert.equal(normalizeServerAddress("http://life.example.com", "allow-http"), "http://life.example.com");
  assert.equal(normalizeServerAddress("https://life.example.com", "allow-http"), "https://life.example.com");
  for (const url of ["http://user:pass@life.example.com", "http://life.example.com/api", "http://life.example.com?key=secret", "ftp://life.example.com"]) {
    assert.throws(() => normalizeServerAddress(url, "allow-http"));
  }
});

test("missing protocol receives an actionable address error", () => {
  assert.throws(() => normalizeServerAddress("203.0.113.10"), /http:\/\/ ou https:\/\//);
});
