import { describe, expect, it, vi } from "vitest";
import { ApiError, TokenOut, runWithTokenRefresh } from "./index";

function makeTokens(): TokenOut {
  return {
    access_token: "access-2",
    refresh_token: "refresh-2",
    token_type: "bearer",
    expires_in: 1800
  };
}

describe("runWithTokenRefresh", () => {
  it("retries once after 401 and refresh success", async () => {
    const execute = vi.fn(async (_accessToken: string) => "ok");
    execute.mockRejectedValueOnce(new ApiError(401, "expired"));
    execute.mockResolvedValueOnce("ok");
    const refresh = vi.fn().mockResolvedValue(makeTokens());
    const onTokensRefreshed = vi.fn();
    const onUnauthorized = vi.fn();

    const result = await runWithTokenRefresh({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      execute,
      refresh,
      onTokensRefreshed,
      onUnauthorized
    });

    expect(result).toBe("ok");
    expect(refresh).toHaveBeenCalledWith("refresh-1");
    expect(onTokensRefreshed).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, "access-1");
    expect(execute).toHaveBeenNthCalledWith(2, "access-2");
  });

  it("fails and calls unauthorized when refresh fails", async () => {
    const execute = vi.fn().mockRejectedValue(new ApiError(401, "expired"));
    const refresh = vi.fn().mockRejectedValue(new Error("refresh failed"));
    const onTokensRefreshed = vi.fn();
    const onUnauthorized = vi.fn();

    await expect(
      runWithTokenRefresh({
        accessToken: "access-1",
        refreshToken: "refresh-1",
        execute,
        refresh,
        onTokensRefreshed,
        onUnauthorized
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onTokensRefreshed).not.toHaveBeenCalled();
  });
});
