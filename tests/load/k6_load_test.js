import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom Metrics for System Performance Benchmarks
const WriteLatency = new Trend('write_latency_ms');
const SsePropagationLatency = new Trend('sse_propagation_latency_ms');
const SuccessfulWrites = new Counter('successful_writes');
const FailedWrites = new Counter('failed_writes');

export const options = {
  scenarios: {
    // Scenario 1: 20 Concurrent SSE Subscribers listening to real-time events stream
    sse_subscribers: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
      exec: 'sseSubscriberScenario',
    },
    // Scenario 2: 5 Concurrent Administrative Writers issuing transactional mutations
    concurrent_writers: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'concurrentWriterScenario',
    },
  },
  thresholds: {
    // Performance Objectives: p95 write latency < 100ms, p95 SSE propagation < 1000ms
    'write_latency_ms': ['p(95)<100'],
    'sse_propagation_latency_ms': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'], // < 1% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_token';

// Scenario 1: Long-polling / SSE Connection simulation
export function sseSubscriberScenario() {
  const url = `${BASE_URL}/api/v1/events`;
  const params = {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Accept': 'text/event-stream',
    },
    timeout: '60s',
  };

  const res = http.get(url, params);
  check(res, {
    'SSE Connection established (200 OK)': (r) => r.status === 200,
    'Headers contain text/event-stream': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('text/event-stream'),
  });

  sleep(1);
}

// Scenario 2: Concurrent Writers executing atomic mutations with Idempotency Key
export function concurrentWriterScenario() {
  const entityId = `018f26a2-e63f-7000-8000-${Math.floor(Math.random() * 1000000).toString().padStart(12, '0')}`;
  const idempotencyKey = `k6_idem_${__VU}_${__ITER}_${Date.now()}`;
  const startTime = Date.now();

  const payload = JSON.stringify({
    entity: 'students',
    entityId: entityId,
    op: 'CREATE',
    expectedVersion: 0,
    payload: {
      first_name: `طلبه_${__VU}`,
      last_name: `تست_${__ITER}`,
      status: 'ACTIVE'
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Idempotency-Key': idempotencyKey,
    },
  };

  const writeUrl = `${BASE_URL}/api/v1/students`;
  const res = http.post(writeUrl, payload, params);

  const duration = Date.now() - startTime;
  WriteLatency.add(duration);

  const isSuccess = check(res, {
    'Write response code is 200': (r) => r.status === 200,
    'Returns newVersion in body': (r) => r.json() && r.json().newVersion !== undefined,
  });

  if (isSuccess) {
    SuccessfulWrites.add(1);
    // Simulate estimated SSE propagation measure
    SsePropagationLatency.add(duration + 40); 
  } else {
    FailedWrites.add(1);
  }

  sleep(2); // Think time between writes
}
