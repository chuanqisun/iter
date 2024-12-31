import type { BaseConnection, BaseCredential } from "./providers/base";
import { createProvider } from "./providers/factory";

export const connectionsEvents = new EventTarget();

export function listCredentials(): BaseCredential[] {
  return tryJSONParse(localStorage.getItem("iter.credentials"), [] as BaseCredential[]);
}

export function listConnections(): BaseConnection[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as BaseCredential[]);
  return credentialsToConnections(credentials);
}

export function upsertCredentials(newCredentials: BaseCredential[]): BaseCredential[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as BaseCredential[]);
  const mergedCredentials = [...credentials, ...newCredentials];
  localStorage.setItem("iter.credentials", JSON.stringify(mergedCredentials));

  const connections = credentialsToConnections(mergedCredentials);
  connectionsEvents.dispatchEvent(new CustomEvent<BaseConnection[]>("change", { detail: connections }));

  return mergedCredentials;
}

export function deleteCredential(id: string): BaseCredential[] {
  const credentials = tryJSONParse(localStorage.getItem("iter.credentials"), [] as BaseCredential[]);
  const remaining = credentials.filter((credential) => credential.id !== id);
  localStorage.setItem("iter.credentials", JSON.stringify(remaining));

  const connections = credentialsToConnections(remaining);
  connectionsEvents.dispatchEvent(new CustomEvent<BaseConnection[]>("change", { detail: connections }));

  return remaining;
}

function tryJSONParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;

  return JSON.parse(value as string) ?? fallback;
}

function credentialsToConnections(credentials: BaseCredential[]): BaseConnection[] {
  return credentials.flatMap((credential) => {
    const provider = createProvider(credential.type);
    return provider.credentialToConnections(credential) as BaseConnection[];
  });
}
