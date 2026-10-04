import assert from "node:assert/strict";
import test from "node:test";
import { describeConnectionError } from "./connectionError.ts";

test("distinguishes invalid credentials from a session cookie rejected after login", () => {
  assert.match(describeConnectionError({ status: 401 }, "login"), /refusé la clé/);
  assert.match(describeConnectionError({ status: 401 }, "session"), /clé a été acceptée/);
  assert.match(describeConnectionError({ status: 401 }, "session"), /HTTPS/);
});

test("explains native network failures without depending on Error instances", () => {
  assert.match(describeConnectionError({ message: "Unable to resolve host" }, "login"), /Serveur inaccessible/);
  assert.match(describeConnectionError({ message: "SSLHandshakeException" }, "login"), /certificat/);
  assert.match(describeConnectionError({ name: "AbortError" }, "login"), /délai/);
  assert.match(describeConnectionError({ status: 404 }, "login"), /API introuvable/);
  assert.match(describeConnectionError(new Error("The API returned invalid JSON."), "login"), /pas avec l’API/);
});

test("keeps precise validation errors and handles empty native failures", () => {
  assert.equal(describeConnectionError(new Error("Coche Autoriser HTTP"), "address"), "Coche Autoriser HTTP");
  assert.match(describeConnectionError(null, "login"), /Impossible de joindre/);
});
