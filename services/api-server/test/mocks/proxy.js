import { jest } from "@jest/globals";

export function createProxyMiddlewareMock() {
  const handler = jest.fn((req, res, _next) => {
    res.status(200).json({
      proxied: true,
      originalUrl: req.originalUrl,
      rewrittenUrl: req.url,
      headers: req.headers,
    });
  });

  const factory = jest.fn(() => handler);
  return { factory, handler };
}

export function createJwksMock(publicKey) {
  return {
    getSigningKey: jest.fn((_kid, cb) =>
      cb(null, { getPublicKey: () => publicKey }),
    ),
  };
}
