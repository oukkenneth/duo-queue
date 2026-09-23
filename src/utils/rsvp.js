// Browser-only helper. Secrets and email delivery live in /api/rsvp.js.
export function createRsvpSender({ storage, fetcher, uuid, now = () => new Date() }) {
  const attempted = new Set();
  let sessionId;
  return function sendRsvp(choice, declineAttempts) {
    if (!['accepted', 'declined'].includes(choice) || attempted.has(choice)) return;
    const key = `wedding-rsvp:v1:${choice}`;
    // Claim synchronously, before any asynchronous work, including failed sends.
    attempted.add(choice);
    try {
      if (storage()?.getItem(key)) return;
      sessionId ||= storage()?.getItem('wedding-rsvp:v1:session') || uuid();
      storage()?.setItem('wedding-rsvp:v1:session', sessionId);
      storage()?.setItem(key, 'attempted');
    } catch { /* Storage may be blocked; the in-memory guard still works. */ }
    try {
      sessionId ||= uuid();
      void fetcher('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RSVP-Session': sessionId },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({ choice, timestamp: now().toISOString(), declineAttempts }),
      }).catch(() => {}); // Deliberately silent; never interfere with the invitation.
    } catch { /* Even a synchronous fetch error must not block the transition. */ }
  };
}
export const sendRsvp = createRsvpSender({
  storage: () => window.sessionStorage,
  fetcher: (...args) => window.fetch(...args),
  uuid: () => window.crypto.randomUUID(),
});
