# RSVP setup and testing

## Hosting and environment

Deploy this project to Vercel as a Vite app. The root `api/rsvp.js` becomes the Node serverless endpoint `POST /api/rsvp`. Build: `npm run build`; output: `dist`. Deploy the whole source project, not just dist, so the endpoint is included. Static GitHub Pages cannot execute this endpoint. Netlify needs a function adapter; it is not configured in this version.

Required server environment variables:

- `RESEND_API_KEY`: Resend sending API key.
- `NOTIFICATION_EMAIL`: your notification recipient address.
- `RESEND_FROM_EMAIL`: a bare sender email address on a domain verified in Resend. This additional variable is necessary because Resend requires a sender; no address is hardcoded.

Copy `.env.example` to `.env.local`, fill it locally, and restart `npm run dev`. The Vite development middleware serves the same handler as production. `.env.local` is ignored by git. Never prefix secrets with `VITE_`; never put them in src/config.js. On Vercel, set all three variables in the project environment settings and redeploy. `npm run preview` previews static output only and does not serve the API.

Create a Resend account, add and verify your sending domain using the DNS records Resend provides, create a sending API key, and configure the three variables above. See [verified domains](https://resend.com/docs/dashboard/domains/introduction) and [sending API](https://resend.com/docs/api-reference/emails/send-email). For Resend sandbox testing, follow their [test email guide](https://resend.com/docs/dashboard/emails/send-test-emails), including sender/recipient restrictions.

## Behavior

App owns `attempts`, counting only the three playful dodges (0–3). The final fourth click reports `declined` with 3 attempts. Accept reports the current number of dodges. No request is made for a dodge.

`src/utils/rsvp.js` exports `sendRsvp(choice, declineAttempts)`. It sends the requested JSON with a current ISO timestamp and an opaque random session UUID in the `X-RSVP-Session` header. It runs without awaiting delivery, so the screen transition and decline message remain immediate. Fetch failures are swallowed. There are no technical messages in May's UI.

Each choice is synchronously claimed in memory and sessionStorage before fetch. That prevents double-clicks, repeated final declines, and resends after same-tab reload. Accepted and declined are separately guarded, so someone who declines and then accepts sends each outcome once. An attempted send is not retried even if delivery fails, preserving the requested at-most-once behavior. Closing the tab ends the storage session; separate new tabs generally have separate sessions. If sessionStorage is blocked, only the current-page in-memory guard is available.

Resend receives an idempotency key based on session UUID + choice, providing additional duplicate protection across serverless instances. Resend retains keys for 24 hours, not indefinitely. See [idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys). There is no database or delivery webhook: successful API submission is tracked in Resend; asynchronous bounces/delivery events can be inspected there. Network/provider/configuration failures are logged in server logs with sanitized messages.

## Security boundaries

Only same-origin JSON POST requests are accepted. Choice, ISO date, UUID, count, allowed fields, and body size are validated. A declined request with fewer than three dodges is rejected. Recipient, sender and subject come only from server configuration/fixed code; the endpoint cannot send arbitrary email. It has a timeout, no wildcard CORS, and a best-effort limit of ten valid requests per IP per ten minutes per server instance.

Origin checks prevent cross-site browser submissions; they are not authentication and non-browser clients can forge headers. Session storage is duplicate suppression, not identity verification. For internet-facing abuse protection, configure a host-level rate limit for `/api/rsvp`; the in-memory limit is not globally distributed. The endpoint does not verify that the visitor is May. Host access protection can restrict the invite without adding another app screen.

## Tests

Run `node --test tests/rsvp.test.js` (no real emails; delivery is mocked).

ACCEPT manual test:
1. Configure the environment and start the dev server, or deploy to Vercel.
2. Open a fresh browser tab/session. Click ACCEPT MATCH.
3. The autumn screen opens immediately and finishes loading normally.
4. Confirm one POST in browser Network and an accepted notification in Resend/your inbox. Subject: `Wedding Invite RSVP: ACCEPTED`. Body starts `May clicked ACCEPT MATCH.` and includes timestamp and count.
5. Reload the same tab and accept again: no new POST or notification for accepted.

DECLINE manual test:
1. Use a fresh session for an independent test.
2. Click DECLINE three times. Confirm the three existing tooltip messages and zero RSVP requests.
3. Click DECLINE a fourth time: the closable `fair enough 😭` message appears, and one declined request is sent with `declineAttempts: 3`.
4. Confirm subject `Wedding Invite RSVP: DECLINED`, body `May clicked DECLINE.`, timestamp and count.
5. Close the message and click DECLINE again: no duplicate request.

Failure test: omit the key locally and restart the server. Use a new session, accept, and verify the normal transition and a sanitized configuration failure in the terminal. No notification is sent. Restore the key and restart before a live test. Tests performed during implementation used mocks and missing configuration; no live email was sent.

## Theme changes

- Both screen crest icons: heart → queue diamond/check.
- ACCEPT MATCH icon: heart → queue diamond/check.
- ROLE icon: heart → party/duo icon.
- Favicon: heart inside hexagonal frame → diamond/check in the same frame.
- Both footer instances: `Love is a team comp` → `Same duo. New adventure.`
- Removed the unused public heart.svg and its asset config entry.

The existing artwork contains no visible hearts, rings or romantic handwritten copy, so it was preserved. Existing particles are sparkles/leaves. No floating-heart, Better Together, or ring decorations existed in the implemented app. Source mockup references and historical artwork prompts remain archival files, not rendered app elements.
