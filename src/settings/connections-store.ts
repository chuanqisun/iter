import type { BaseConnection, BaseCredential } from "../providers/base";
import { createProvider } from "../providers/factory";

export const connectionsEvents = new EventTarget();

const getCredentialKey = (c: BaseCredential): string | undefined => {
  const cred = c as unknown as Record<string, unknown>;
  return (
    (typeof cred.accountName === "string" && cred.accountName.trim()) ||
    (typeof cred.endpoint === "string" && cred.endpoint.trim()) ||
    undefined
  );
};

export function listCredentials(): BaseCredential[] {
  return tryJSONParse(localStorage.getItem("iter.credentials"), [] as BaseCredential[]);
}

export function listConnections(): BaseConnection[] {
  return credentialsToConnections(listCredentials());
}

export function upsertCredentials(newCredentials: BaseCredential[]): BaseCredential[] {
  const credentials = listCredentials();

  for (const newCred of newCredentials) {
    const key = getCredentialKey(newCred);
    const idx = key ? credentials.findIndex((c) => getCredentialKey(c) === key) : -1;

    if (idx !== -1) {
      credentials[idx] = { ...newCred, id: credentials[idx].id };
    } else {
      credentials.push(newCred);
    }
  }

  localStorage.setItem("iter.credentials", JSON.stringify(credentials));

  connectionsEvents.dispatchEvent(
    new CustomEvent<BaseConnection[]>("change", { detail: credentialsToConnections(credentials) }),
  );

  return credentials;
}

export function deleteCredential(id: string): BaseCredential[] {
  const remaining = listCredentials().filter((c) => c.id !== id);
  localStorage.setItem("iter.credentials", JSON.stringify(remaining));

  connectionsEvents.dispatchEvent(
    new CustomEvent<BaseConnection[]>("change", { detail: credentialsToConnections(remaining) }),
  );

  return remaining;
}
export function moveCredential(id: string, delta: number): BaseCredential[] {
  const credentials = listCredentials();
  if (credentials.length <= 1) return credentials;

  const idx = credentials.findIndex((c) => c.id === id);
  if (idx === -1) return credentials;

  const newIdx = (idx + delta + credentials.length) % credentials.length;
  const [removed] = credentials.splice(idx, 1);
  credentials.splice(newIdx, 0, removed);

  localStorage.setItem("iter.credentials", JSON.stringify(credentials));

  connectionsEvents.dispatchEvent(
    new CustomEvent<BaseConnection[]>("change", { detail: credentialsToConnections(credentials) }),
  );

  return credentials;
}
function tryJSONParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  return JSON.parse(value) ?? fallback;
}

function credentialsToConnections(credentials: BaseCredential[]): BaseConnection[] {
  return credentials.flatMap((c) => createProvider(c.type).credentialToConnections(c) as BaseConnection[]);
}
