export const DEFAULT_API_BASE_URL = "http://localhost:9001";

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export type ApiHealthResponse = {
  status: string;
};

export async function fetchHealth(
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<ApiHealthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/health`);

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as ApiHealthResponse;
}

export type RequestOtpIn = {
  email: string;
};

export type RequestOtpOut = {
  status: string;
  message: string;
  debug_otp?: string | null;
};

export type VerifyOtpIn = {
  email: string;
  otp: string;
};

export type TokenOut = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type RefreshIn = {
  refresh_token: string;
};

export type MeOut = {
  id: number;
  email: string;
  handle: string | null;
};

export type FlowerOut = {
  id: number;
  owner_id: number;
  title: string;
  flower_type: string;
  status: string;
  stage: number;
  water_count: number;
  streak_count: number;
  ready_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type FlowerCreateIn = {
  title: string;
  flower_type?: string;
};

export type FlowerWaterIn = {
  message: string;
  drop_type?: "text" | "voice" | "video";
};

export type FlowerWaterOut = {
  flower: FlowerOut;
  drop_id: number;
  day_number: number;
};

export type FlowerSendIn = {
  recipient_name?: string | null;
  recipient_contact?: string | null;
  delivery_mode?: "instant" | "scheduled";
  scheduled_for?: string | null;
};

export type FlowerSendOut = {
  flower_id: number;
  share_token: string;
  delivery_mode: string;
  scheduled_for: string | null;
  sent_at: string | null;
};

export type FlowerDetailOut = {
  flower: FlowerOut;
  share_token: string | null;
  delivery_mode: string | null;
  recipient_name: string | null;
  recipient_contact: string | null;
  sent_at: string | null;
};

export type RefreshTokenOperation = (refreshToken: string) => Promise<TokenOut>;

export async function runWithTokenRefresh<T>(params: {
  accessToken: string;
  refreshToken: string | null;
  execute: (accessToken: string) => Promise<T>;
  refresh: RefreshTokenOperation;
  onTokensRefreshed: (tokens: TokenOut) => Promise<void> | void;
  onUnauthorized: () => Promise<void> | void;
}): Promise<T> {
  const { accessToken, refreshToken, execute, refresh, onTokensRefreshed, onUnauthorized } = params;

  try {
    return await execute(accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !refreshToken) {
      throw error;
    }

    try {
      const nextTokens = await refresh(refreshToken);
      await onTokensRefreshed(nextTokens);
      return await execute(nextTokens.access_token);
    } catch {
      await onUnauthorized();
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
  }
}

async function postJson<TResponse, TPayload>(
  url: string,
  payload: TPayload,
  token?: string
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as TResponse;
}

export async function requestOtp(
  payload: RequestOtpIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<RequestOtpOut> {
  return postJson<RequestOtpOut, RequestOtpIn>(`${apiBaseUrl}/api/v1/auth/request-otp`, payload);
}

export async function verifyOtp(
  payload: VerifyOtpIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<TokenOut> {
  return postJson<TokenOut, VerifyOtpIn>(`${apiBaseUrl}/api/v1/auth/verify-otp`, payload);
}

export async function refreshTokens(
  payload: RefreshIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<TokenOut> {
  return postJson<TokenOut, RefreshIn>(`${apiBaseUrl}/api/v1/auth/refresh`, payload);
}

export async function logout(
  payload: RefreshIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok && response.status !== 204) {
    throw await parseApiError(response);
  }
}

export async function getMe(
  accessToken: string,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<MeOut> {
  const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as MeOut;
}

export async function listFlowers(
  accessToken: string,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<FlowerOut[]> {
  const response = await fetch(`${apiBaseUrl}/api/v1/flowers`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as FlowerOut[];
}

export async function createFlower(
  accessToken: string,
  payload: FlowerCreateIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<FlowerOut> {
  return postJson<FlowerOut, FlowerCreateIn>(`${apiBaseUrl}/api/v1/flowers`, payload, accessToken);
}

export async function getFlowerDetail(
  accessToken: string,
  flowerId: number,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<FlowerDetailOut> {
  const response = await fetch(`${apiBaseUrl}/api/v1/flowers/${flowerId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as FlowerDetailOut;
}

export async function waterFlower(
  accessToken: string,
  flowerId: number,
  payload: FlowerWaterIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<FlowerWaterOut> {
  return postJson<FlowerWaterOut, FlowerWaterIn>(
    `${apiBaseUrl}/api/v1/flowers/${flowerId}/water`,
    payload,
    accessToken
  );
}

export async function sendFlower(
  accessToken: string,
  flowerId: number,
  payload: FlowerSendIn,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<FlowerSendOut> {
  return postJson<FlowerSendOut, FlowerSendIn>(
    `${apiBaseUrl}/api/v1/flowers/${flowerId}/send`,
    payload,
    accessToken
  );
}

async function parseApiError(response: Response): Promise<ApiError> {
  const cloned = response.clone();
  try {
    const data = (await cloned.json()) as { detail?: string };
    const detail = typeof data.detail === "string" ? data.detail : undefined;
    return new ApiError(response.status, detail || `Request failed with status ${response.status}`, detail);
  } catch {
    try {
      const text = await response.text();
      return new ApiError(response.status, text || `Request failed with status ${response.status}`);
    } catch {
      return new ApiError(response.status, `Request failed with status ${response.status}`);
    }
  }
}
