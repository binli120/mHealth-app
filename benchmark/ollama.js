/**
 * Ollama throughput test — measures how many concurrent inference requests
 * the Ollama instance can handle before queuing or timing out.
 *
 * Ollama is single-process and GPU/CPU-bound. This test helps you find
 * its concurrency ceiling before you need to add hardware.
 *
 * Run this ONLY on dev/staging — never against production during patient use.
 *
 * Usage:
 *   k6 run benchmark/ollama.js
 *   k6 run -e OLLAMA_URL=http://localhost:11434 benchmark/ollama.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const OLLAMA_URL = __ENV.OLLAMA_URL || 'http://localhost:11434'
const MODEL      = __ENV.OLLAMA_MODEL || 'llama3.2'

const inferenceLatency = new Trend('ollama_inference_ms', true)
const errorRate        = new Rate('ollama_errors')

export const options = {
  stages: [
    { duration: '1m', target: 1  },   // single user baseline
    { duration: '2m', target: 3  },   // 3 concurrent (typical peak)
    { duration: '2m', target: 5  },   // stress — watch for queue buildup
    { duration: '1m', target: 0  },
  ],
  thresholds: {
    ollama_inference_ms: ['p(95)<30000'],   // p95 under 30s (LLM is slow)
    ollama_errors:       ['rate<0.05'],     // <5% errors
  },
}

export default function () {
  // Check models are loaded
  const tags = http.get(`${OLLAMA_URL}/api/tags`)
  check(tags, { 'ollama reachable': (r) => r.status === 200 })

  // Send a short inference request
  const payload = JSON.stringify({
    model:  MODEL,
    prompt: 'Reply with only the word OK.',
    stream: false,
  })

  const res = http.post(`${OLLAMA_URL}/api/generate`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '60s',
  })

  inferenceLatency.add(res.timings.duration)
  errorRate.add(res.status !== 200)

  check(res, {
    'inference 200':    (r) => r.status === 200,
    'response not empty': (r) => r.body && r.body.length > 0,
  })

  sleep(2)
}
