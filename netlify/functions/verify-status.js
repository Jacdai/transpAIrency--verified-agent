// ════════════════════════════════════════════════════════════════
// transpAIrency™ — MERGED BUILD — Feb 24 2026
// CORE: v4.3 Redis polling logic
// SHELL: v6.3 env vars (no hardcoded credentials)
// © 2026 Honest AiB™ Holdings, Inc. — Patent Pending
// Redis polling endpoint — nothing else lives here
// ════════════════════════════════════════════════════════════════

// SHELL: v6.3 — env var pattern, no hardcoded credentials
const REDIS_URL   = process.env.UPSTASH_REDIS_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;
if (!REDIS_URL || !REDIS_TOKEN) {
  throw new Error('FATAL: UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN env var missing. Set both in Netlify dashboard.');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'jobId required' }) };

  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    const data = await res.json();

    // No result yet — still processing
    if (!data.result || data.result === 'null' || data.result === null) {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };
    }

    // Parse stored result
    let parsed;
    try { parsed = JSON.parse(decodeURIComponent(data.result)); }
    catch (e) { parsed = JSON.parse(data.result); }

    // Delete key after delivery — clean Redis
    if (parsed.status === 'complete' || parsed.status === 'error') {
      fetch(`${REDIS_URL}/del/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      }).catch(() => {});
    }

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    // Network hiccup — return pending so browser keeps polling
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'pending' }) };
  }
};
