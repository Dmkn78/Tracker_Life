type NativeFormEntry = { key: string; type: "string"; value: string }
  | { key: string; type: "base64File"; value: string; fileName: string; contentType: string };

export async function serializeFormData(form: FormData): Promise<NativeFormEntry[]> {
  const entries: NativeFormEntry[] = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") entries.push({ key, type: "string", value });
    else {
      const bytes = new Uint8Array(await value.arrayBuffer());
      let binary = "";
      const chunkSize = 8192;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      entries.push({ key, type: "base64File", value: btoa(binary), fileName: value.name, contentType: value.type || "application/octet-stream" });
    }
  }
  return entries;
}
