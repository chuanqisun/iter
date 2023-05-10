export interface ListDeploymentsResponse {
  data: ModelDeployment[];
}

type OfficialModel = "gpt-35-turbo" | "gpt-4" | "gpt-4-32k" | "text-embedding-ada-002";

export interface ModelDeployment {
  id: string;
  model: OfficialModel;
  status: "canceled" | "deleted" | "failed" | "notRunning" | "running" | "succeeded";
  created_at: number;
  updated_at: number;
}

export async function listDeployments(apiKey: string, endpoint: string): Promise<ModelDeployment[]> {
  const response: ListDeploymentsResponse = await fetch(`${removeTrailingSlash(endpoint)}/openai/deployments?api-version=2022-12-01`, {
    headers: { "api-key": apiKey },
  }).then((res) => res.json());
  return response.data;
}

export function isSucceeded(deployment: ModelDeployment): boolean {
  return deployment.status === "succeeded";
}

export function isChatModel(deployment: ModelDeployment): boolean {
  return ["gpt-35-turbo", "gpt-4", "gpt-4-32k"].includes(deployment.model);
}

export function newerFirst(a: ModelDeployment, b: ModelDeployment): number {
  return b.updated_at - a.updated_at;
}

export function deduplicateByModelName(deployment: ModelDeployment, index: number, array: ModelDeployment[]) {
  return array.findIndex((d) => d.model === deployment.model) === index;
}

export function removeTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
