import { expect } from "vitest";

export function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  init?: Omit<RequestInit, "body">,
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
    body: JSON.stringify(body),
  });
}

export function paramsContext<TParams extends Record<string, string>>(params: TParams) {
  return {
    params: Promise.resolve(params),
  };
}

export async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function expectRateLimitHeaders(response: Response) {
  expect(response.headers.get("X-RateLimit-Limit")).toBe("99");
}
