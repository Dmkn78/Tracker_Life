import { expectJsonObject, expectString, requestJson } from "@/lib/http/apiClient";
import type { Company } from "../domain/tagCompany";

export function listCompanies(signal?: AbortSignal): Promise<Company[]> {
  return requestJson("/api/companies", parseCompaniesResponse, { signal });
}

export function deleteCompany(id: string): Promise<void> {
  return requestJson(`/api/companies?id=${encodeURIComponent(id)}`, () => undefined, {
    method: "DELETE"
  });
}

function parseCompaniesResponse(payload: unknown): Company[] {
  const response = expectJsonObject(payload, "companies response");
  if (!Array.isArray(response.companies)) {
    throw new Error("companies response.companies must be an array");
  }
  return response.companies.map((company, index) => parseCompany(company, `companies response.companies[${index}]`));
}

function parseCompany(payload: unknown, context: string): Company {
  const company = expectJsonObject(payload, context);
  return {
    id: expectString(company.id, `${context}.id`),
    name: expectString(company.name, `${context}.name`),
    color: expectString(company.color, `${context}.color`)
  };
}
