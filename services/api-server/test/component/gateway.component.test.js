import request from 'supertest';
import { app, server } from '../../src/app.js';

describe('API Gateway Component Tests', () => {


  it('should return 200 for health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.role).toBe('gateway');
  });

  it('should route auth requests without 401 from gateway itself', async () => {
    // We expect this to be proxied. It might return 504 if the profile service is down,
    // or 404 depending on how the proxy handles it, but it should NOT be 401 (unauthorized by gateway).
    const res = await request(app).post('/auth/login');
    expect(res.status).not.toBe(401);
  });

  it('should return 401 for protected profile route without token', async () => {
    const res = await request(app).get('/profile/123');
    expect(res.status).toBe(401);
  });
});
