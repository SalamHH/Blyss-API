import { DEFAULT_API_BASE_URL } from "@blyss/shared";

export const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
