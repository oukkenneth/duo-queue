const MAX_BYTES = 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

async function readBody(req) {
  if (Number(req.headers['content-length']) > MAX_BYTES) throw new Error('size');
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('size');
    return JSON.parse(raw);
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error('size');
  }
  return JSON.parse(raw);
}

export function createRsvpHandler({ env = process.env, fetcher = fetch, logger = console, now = Date.now } = {}) {
  // Best-effort per-instance throttling. Use host-level rate limits for distributed abuse protection.
  const limits = new Map();
  return async function rsvp(req, res) {
    const reply = (status, message) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ message }));
    };
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, 'Not allowed'); }
    // No wildcard CORS. Browser requests must originate on the serving host.
    let origin;
    try { origin = new URL(req.headers.origin); } catch { return reply(403, 'Not allowed'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host ||
        (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) return reply(403, 'Not allowed');
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415, 'Invalid request');
    const session = req.headers['x-rsvp-session'];
    if (typeof session !== 'string' || !UUID.test(session)) return reply(400, 'Invalid request');
    let data;
    try { data = await readBody(req); } catch { return reply(400, 'Invalid request'); }
    if (!data || Array.isArray(data) || Object.keys(data).some(k => !['choice', 'timestamp', 'declineAttempts'].includes(k)) ||
        !['accepted', 'declined'].includes(data.choice) || !Number.isInteger(data.declineAttempts) ||
        data.declineAttempts < 0 || data.declineAttempts > 3 || (data.choice === 'declined' && data.declineAttempts !== 3) ||
        typeof data.timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.timestamp) ||
        !Number.isFinite(Date.parse(data.timestamp)) || new Date(data.timestamp).toISOString() !== data.timestamp) return reply(400, 'Invalid request');
    const time = now();
    for (const [key, item] of limits) if (item.until <= time) limits.delete(key);
    const ip = req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
    const limit = limits.get(ip) || { count: 0, until: time + 600000 };
    if (limit.count >= 10 || (!limits.has(ip) && limits.size >= 10000)) return reply(429, 'Try later');
    limit.count += 1;
    limits.set(ip, limit);
    const { RESEND_API_KEY, NOTIFICATION_EMAIL, RESEND_FROM_EMAIL } = env;
    if (!RESEND_API_KEY || !EMAIL.test(NOTIFICATION_EMAIL || '') || !EMAIL.test(RESEND_FROM_EMAIL || '')) {
      logger.error('[rsvp] Email delivery unavailable: missing or invalid server configuration');
      return reply(503, 'Unavailable');
    }
    const accepted = data.choice === 'accepted';
    try {
      const result = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `wedding-rsvp/${session}/${data.choice}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [NOTIFICATION_EMAIL],
          subject: `Wedding Invite RSVP: ${accepted ? 'ACCEPTED' : 'DECLINED'}`,
          text: `May clicked ${accepted ? 'ACCEPT MATCH' : 'DECLINE'}.\n\nTimestamp: ${data.timestamp}\nDecline attempts: ${data.declineAttempts}`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!result.ok) {
        // Never log keys, addresses, raw provider responses, or untrusted payloads.
        logger.error('[rsvp] Resend delivery request failed', { status: result.status });
        return reply(502, 'Unavailable');
      }
      return reply(200, 'Received');
    } catch {
      logger.error('[rsvp] Resend delivery request failed or timed out');
      return reply(502, 'Unavailable');
    }
  };
}
// Vercel Node function. Await delivery server-side so the function stays alive.
export default createRsvpHandler();
