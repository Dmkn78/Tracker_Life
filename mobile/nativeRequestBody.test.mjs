import assert from "node:assert/strict";
import test from "node:test";
import { serializeNativeRequestBody } from "./nativeRequestBody.ts";

test("native transport retains JSON writes and empty reads", async () => {
  assert.deepEqual(await serializeNativeRequestBody(undefined), {});
  assert.deepEqual(await serializeNativeRequestBody('{"energy":7}'), { data: { energy: 7 } });
});

test("audio and text fields survive conversion to the Capacitor multipart format", async () => {
  const form = new FormData();
  form.append("language", "fr");
  form.append("file", new Blob([new Uint8Array([0, 1, 254, 255])], { type: "audio/webm" }), "log.webm");
  const body = await serializeNativeRequestBody(form);
  assert.equal(body.dataType, "formData");
  assert.equal(body.contentType, "multipart/form-data");
  assert.deepEqual(body.data, [{ key: "language", type: "string", value: "fr" }, { key: "file", type: "base64File", value: "AAH+/w==", fileName: "log.webm", contentType: "audio/webm" }]);
});
