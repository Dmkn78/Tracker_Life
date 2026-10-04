type NativeFormEntry = { key: string; type: "string"; value: string } | { key: string; type: "base64File"; value: string; fileName: string; contentType: string };
export type NativeRequestBody = { data?: unknown; dataType?: "formData"; contentType?: string };

export async function serializeNativeRequestBody(body: BodyInit | null | undefined): Promise<NativeRequestBody> {
  if (body == null) return {};
  if (typeof body === "string") return { data: JSON.parse(body) as unknown };
  if (!(body instanceof FormData)) throw new Error("Format de fichier non pris en charge.");
  const entries: NativeFormEntry[] = [];
  for (const [key, value] of body.entries()) {
    if (typeof value === "string") entries.push({ key, type: "string", value });
    else {
      const bytes = new Uint8Array(await value.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      entries.push({ key, type: "base64File", value: btoa(binary), fileName: value.name, contentType: value.type || "application/octet-stream" });
    }
  }
  return { data: entries, dataType: "formData", contentType: "multipart/form-data" };
}
