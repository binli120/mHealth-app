/**
 * Load test — ramps up to find the breaking point under realistic traffic.
 * Run this before scaling decisions, not in production during peak hours.
 *
 * Stages:
 *   0→10 VU  over 2m  — warm up
 *   10 VU    for 5m   — steady state (measure baseline)
 *   10→50 VU over 2m  — ramp to higher load
 *   50 VU    for 3m   — hold and observe
 *   50→0 VU  over 1m  — cool down
 *
 * Usage:
 *   k6 run benchmark/load.js
 *   k6 run -e BASE_URL=https://healthcompass.cloud benchmark/load.js
 *   k6 run --out json=results/load-$(date +%Y%m%d).json benchmark/load.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

const healthLatency = new Trend('health_latency', true)
const dbLatency     = new Trend('db_latency', true)
const errorRate     = new Rate('errors')

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0  },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],      // <1% errors
    http_req_duration: ['p(95)<3000'],     // p95 under 3s
    errors:            ['rate<0.01'],
  },
}

export default function loadBenchmark() {
  // Liveness check
  const h = http.get(`${BASE_URL}/api/health`)
  healthLatency.add(h.timings.duration)
  errorRate.add(h.status !== 200)
  check(h, { 'health 200': (r) => r.status === 200 })

  sleep(0.5)

  // DB check
  const db = http.get(`${BASE_URL}/api/health/db`)
  dbLatency.add(db.timings.duration)
  errorRate.add(db.status !== 200)
  check(db, { 'db 200': (r) => r.status === 200 })

  sleep(1)
}
