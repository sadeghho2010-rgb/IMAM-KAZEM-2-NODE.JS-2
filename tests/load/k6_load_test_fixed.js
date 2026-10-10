import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const WriteLatency = new Trend('write_latency_ms');
const SsePropagationLatency = new Trend('sse_propagation_latency_ms');
const WriteSuccess = new Counter('write_success');
const WriteConflict = new Counter('write_conflict');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up writers
    { duration: '2m', target: 5 },    // Steady state
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'write_latency_ms': ['p(95)<100', 'p(99)<200'],
    'sse_propagation_latency_ms': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';
let lastEventSeq = 0;

export function setup() {
  // Simulate login
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    username: 'test_staff',
    password: 'TestPassword123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  const token = loginRes.cookies.find(c => c.name === '__Host-sid')?.value || '';
  const csrfMeta = loginRes.body.match(/"csrfToken":"([^"]+)"/);
  const csrfToken = csrfMeta ? csrfMeta[1] : '';

  return { token, csrfToken };
}

export function sseSubscriberScenario(data) {
  const res = http.get(
    `${BASE_URL}/api/v1/events?since=${lastEventSeq}`,
    {
      headers: { 'Accept': 'text/event-stream' },
      cookies: { '__Host-sid': data.token },
      timeout: '60s'
    }
  );

  check(res, { 'SSE Connected': (r) => r.status === 200 });

  // Parse SSE events
  const events = res.body.split('\n\n').filter(e => e.trim());
  for (const event of events) {
    const lastIdMatch = event.match(/^id: (\d+)/m);
    if (lastIdMatch) {
      lastEventSeq = Math.max(lastEventSeq, Number(lastIdMatch[1]));
    }
  }

  sleep(5);
}

export function concurrentWriterScenario(data) {
  const startTime = new Date();
  const studentId = `018f26a2-e63f-7000-8000-${String(Math.random()).slice(2, 8)}`;

  const res = http.post(
    `${BASE_URL}/api/v1/students`,
    JSON.stringify({
      id: studentId,
      firstName: 'تست',
      lastName: `بار_${Date.now()}`,
      nationalId: '0499370899',
      phone: '09121234567',
      level: 'LEVEL_1',
      department: 'FIQH'
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': data.csrfToken,
        'Idempotency-Key': `k6_${__VU}_${__ITER}_${Date.now()}`
      },
      cookies: { '__Host-sid': data.token },
      timeout: '15s'
    }
  );

  const latency = new Date() - startTime;
  WriteLatency.add(latency);

  if (res.status === 200) {
    WriteSuccess.add(1);
  } else if (res.status === 409) {
    WriteConflict.add(1);
  }

  check(res, {
    'Write OK or Conflict': (r) => r.status === 200 || r.status === 409,
    'p95 Latency < 100ms': (r) => latency < 100
  });

  sleep(2);
}

export function teardown(data) {
  http.post(`${BASE_URL}/api/v1/auth/logout`, null, {
    headers: { 'X-CSRF-Token': data.csrfToken },
    cookies: { '__Host-sid': data.token }
  });
}
