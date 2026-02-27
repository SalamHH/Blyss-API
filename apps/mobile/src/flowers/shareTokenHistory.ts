import * as SecureStore from "expo-secure-store";

const SHARE_TOKEN_HISTORY_KEY = "blyss_share_token_history";

export type ShareTokenHistoryEntry = {
  token: string;
  created_at: string;
};

type ShareTokenMap = Record<string, ShareTokenHistoryEntry[]>;

async function readMap(): Promise<ShareTokenMap> {
  const raw = await SecureStore.getItemAsync(SHARE_TOKEN_HISTORY_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as ShareTokenMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeMap(data: ShareTokenMap): Promise<void> {
  await SecureStore.setItemAsync(SHARE_TOKEN_HISTORY_KEY, JSON.stringify(data));
}

export async function addShareTokenHistory(flowerId: number, token: string): Promise<void> {
  const map = await readMap();
  const key = String(flowerId);
  const current = map[key] ?? [];
  const deduped = current.filter((item) => item.token !== token);
  map[key] = [{ token, created_at: new Date().toISOString() }, ...deduped].slice(0, 10);
  await writeMap(map);
}

export async function getShareTokenHistory(flowerId: number): Promise<ShareTokenHistoryEntry[]> {
  const map = await readMap();
  return map[String(flowerId)] ?? [];
}
