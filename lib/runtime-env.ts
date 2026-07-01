import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, unknown>;

export function getRuntimeString(key: string) {
  const workerValue = (env as RuntimeEnv)[key];
  const nodeValue = process.env[key];
  const value = typeof workerValue === "string" ? workerValue : nodeValue;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getRuntimeBinding<T>(key: string) {
  return (env as RuntimeEnv)[key] as T | undefined;
}
