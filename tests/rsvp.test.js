import test from 'node:test';
import assert from 'node:assert/strict';
import { createRsvpSender } from '../src/utils/rsvp.js';
import { createRsvpHandler } from '../api/rsvp.js';

const session = '1e17b87d-013d-4653-856a-1593d368a304';
const timestamp = '2026-09-22T20:00:00.000Z';
const env = { RESEND_API_KEY: 'test-only-secret', NOTIFICATION_EMAIL: 'recipient@example.test', RESEND_FROM_EMAIL: 'sender@example.test' };
function request(choice = 'accepted', declineAttempts = 0) {
  return { method: 'POST', headers: { origin: 'https://invite.example.test', host: 'invite.example.test', 'content-type': 'application/json', 'x-rsvp-session': session }, body: { choice, timestamp, declineAttempts }, socket: { remoteAddress: 'test-ip' } };
}
async function invoke(handler, req) {
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await handler(req, res);
  return res;
}
test('browser sends each choice once, including rapid clicks and same-tab reload', () => {
  const data = new Map(); const calls = [];
  const options = { storage: () => ({ getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) }), fetcher: (...args) => { calls.push(args); return Promise.resolve({ok:true}); }, uuid: () => session, now: () => new Date(timestamp) };
  const send = createRsvpSender(options);
  send('accepted', 2); send('accepted', 2);
  createRsvpSender(options)('accepted', 0);
  send('declined', 3); send('declined', 3);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0][1].body), { choice:'accepted',timestamp,declineAttempts:2 });
  assert.equal(calls[0][1].headers['X-RSVP-Session'], session);
});
test('browser failures and blocked storage never throw or create rapid duplicates', async () => {
  let calls = 0;
  const send = createRsvpSender({ storage: () => { throw Error(); }, fetcher: () => { calls++; return Promise.reject(Error('offline')); }, uuid: () => session });
  assert.doesNotThrow(() => { send('accepted',0); send('accepted',0); });
  await Promise.resolve(); assert.equal(calls,1);
});
test('server formats exact accepted and declined emails and uses stable provider idempotency', async () => {
  const calls = [];
  const handler = createRsvpHandler({env, fetcher: async (...args) => {calls.push(args); return {ok:true};}});
  for (const [choice, count, button] of [['accepted',2,'ACCEPT MATCH'],['declined',3,'DECLINE']]) {
    assert.equal((await invoke(handler,request(choice,count))).statusCode,200);
    const options = calls.at(-1)[1]; const email = JSON.parse(options.body);
    assert.equal(email.subject,`Wedding Invite RSVP: ${choice.toUpperCase()}`);
    assert.equal(email.text,`May clicked ${button}.\n\nTimestamp: ${timestamp}\nDecline attempts: ${count}`);
    assert.deepEqual(email.to,[env.NOTIFICATION_EMAIL]);
    assert.equal(options.headers['Idempotency-Key'],`wedding-rsvp/${session}/${choice}`);
  }
  await invoke(handler,request('accepted',2));
  assert.equal(calls[0][1].headers['Idempotency-Key'],calls[2][1].headers['Idempotency-Key']);
});
test('rejects invalid payloads, early declines, cross-origin requests, and unsupported methods', async () => {
  let calls = 0; const handler = createRsvpHandler({ env, fetcher: async () => {calls++;return {ok:true};} });
  const cases = [
    [r => r.method='GET',405], [r => r.headers.origin='https://other.example.test',403],
    [r => delete r.headers.origin,403], [r => r.headers['content-type']='text/plain',415],
    [r => r.body.choice='other',400], [r => r.body.declineAttempts=4,400],
    [r => r.body.timestamp='not a date',400], [r => r.body.timestamp='2026-02-31T20:00:00.000Z',400],
    [r => r.body.to='intruder@example.test',400], [r => r.body={...r.body, choice:'declined'},400],
    [r => r.headers['x-rsvp-session']='bad',400], [r => r.headers['content-length']='99999',400],
  ];
  for (const [mutate,status] of cases) { const r=request(); mutate(r); assert.equal((await invoke(handler,r)).statusCode,status); }
  assert.equal(calls,0);
});
test('delivery errors are logged only server-side without secrets or provider content', async () => {
  const logs=[];
  for (const fetcher of [async()=>({ok:false,status:401}),async()=>{throw Error('test-only-secret');}]) {
    const res=await invoke(createRsvpHandler({env,fetcher,logger:{error:(...a)=>logs.push(a)}}),request());
    assert.equal(res.statusCode,502); assert.equal(res.body,'{"message":"Unavailable"}');
  }
  assert.equal(logs.length,2); assert.ok(!JSON.stringify(logs).includes(env.RESEND_API_KEY));
  assert.equal((await invoke(createRsvpHandler({env:{},logger:{error(){}}}),request())).statusCode,503);
});
test('per-instance throttling bounds repeated requests', async () => {
  const handler=createRsvpHandler({env,fetcher:async()=>({ok:true})});
  for(let i=0;i<10;i++) assert.equal((await invoke(handler,request())).statusCode,200);
  assert.equal((await invoke(handler,request())).statusCode,429);
});
