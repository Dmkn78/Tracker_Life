import test from "node:test";
import assert from "node:assert/strict";
import { serializeFormData } from "./formDataTransport.ts";

test("native uploads preserve the audio bytes, filename, MIME type and text fields", async () => {
  const form = new FormData();
  const bytes = new Uint8Array([0, 127, 128, 255, 13, 10]);
  form.set("file", new File([bytes], "résumé.webm", { type: "audio/webm" }));
  form.set("note", "été");
  assert.deepEqual(await serializeFormData(form), [
    { key: "file", type: "base64File", value: Buffer.from(bytes).toString("base64"), fileName: "résumé.webm", contentType: "audio/webm" },
    { key: "note", type: "string", value: "été" }
  ]);
});
