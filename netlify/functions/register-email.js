// ── transpAIrency™ v6.0 — register-email.js ──
// © 2026 Honest AiB™ Holdings, Inc. — Patent Pending
// Accepts {email}, stores in Redis, returns {token} for email tier (10/day)
// Token stored as: etoken:{uuid} → email  TTL 365 days
// Email index:     email:{email} → token  TTL 365 days (dedup — one token per email)

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_YEAR    = 31536000; // 365 days in seconds

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
  const d = await r.json();
  return d.result ? JSON.parse(decodeURIComponent(d.result)) : null;
}

async function redisSet(key, value, ttl) {
  await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}/ex/${ttl}`,
    { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body || '{}');

    if (!email || !isValidEmail(email.trim())) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const cleanEmail = email.trim().toLowerCase();

    // Dedup — if email already registered, return existing token
    const existingToken = await redisGet(`email:${cleanEmail}`);
    if (existingToken) {
      return { statusCode: 200, headers, body: JSON.stringify({ token: existingToken, existing: true }) };
    }

    // New registration
    const token = generateToken();
    await redisSet(`etoken:${token}`, cleanEmail, TTL_YEAR);
    await redisSet(`email:${cleanEmail}`, token, TTL_YEAR);

    return { statusCode: 200, headers, body: JSON.stringify({ token, existing: false }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Registration failed. Try again.' }) };
  }
};
