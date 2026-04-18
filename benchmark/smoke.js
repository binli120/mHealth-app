/**
 * Smoke test — run after every deploy to verify the app is alive.
 * 1 user, 30 seconds, all critical endpoints must return 200.
 *
 * Usage:
 *   k6 run benchmark/smoke.js
 *   k6 run -e BASE_URL=https://healthcompass.cloud benchmark/smoke.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate==0'],        // zero errors allowed
    http_req_duration: ['p(95)<2000'],     // all responses under 2s
  },
}

export default function () {
  // Liveness
  const health = http.get(`${BASE_URL}/api/health`)
  check(health, { 'health ok': (r) => r.status === 200 })

  // DB readiness
  const db = http.get(`${BASE_URL}/api/health/db`)
  check(db, { 'db ok': (r) => r.status === 200 })

  sleep(1)
}
