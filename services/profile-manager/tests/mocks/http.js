export function createMockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

export function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

export function createMockNext() {
  return () => {};
}
