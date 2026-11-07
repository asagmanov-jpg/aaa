import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submit-lead.mjs';
const valid = () => ({
  name: 'Александр', phone: '+7 (999) 111-22-33', city: 'Москва', topic: '',
  message: 'После строительства дома появились трещины в стенах',
  consent: true, website: '', startedAt: Date.now() - 15_000
});
async function send(body = valid(), opts = {}) {
  const req = {method: opts.method ?? 'POST', headers: {
    host: 'example.test', origin: opts.origin ?? 'https://example.test',
    'content-type': 'application/json'
  }, body};
  const response = {statusCode: 200, headers: {}, setHeader(k,v){this.headers[k]=v;return this;}, status(x){this.statusCode=x;return this;}, json(x){this.data=x;return this;}};
  await handler(req, response);
  return response;
}
const keys = ['RESEND_API_KEY','OPORA_MAIL_TO','OPORA_MAIL_FROM'];
for (const k of keys) process.env[k] = '';

test('API cannot be accessed cross-origin', async () => {
  const r=await send(valid(),{origin:'https://bad.example'});assert.equal(r.statusCode,403);
});
test('GET is not accepted', async () => {
  const r=await send(valid(),{method:'GET'});assert.equal(r.statusCode,405);
});
test('required fields are validated', async () => {
  const r=await send({...valid(),phone:'bad'});assert.equal(r.statusCode,422);
});
test('topic is optional', async () => {
  const r=await send(valid());assert.equal(r.statusCode,503);
  assert.match(r.data.message,/не настроен/);
});
test('configured service accepts a valid submission', async () => {
  for (const k of keys) process.env[k]='mock';
  const fetchBefore=globalThis.fetch;
  let payload;
  globalThis.fetch=async (_url,opts)=>{payload=JSON.parse(opts.body);return {ok:true,status:200}};
  try{
    const r=await send(valid());assert.equal(r.statusCode,200);assert.equal(r.data.ok,true);
    assert.equal(payload.to[0],'mock');assert.match(payload.text,/Новая заявка/);
    assert.match(payload.text,/Тип вопроса: Не указан/);
  }finally{globalThis.fetch=fetchBefore;for (const k of keys)process.env[k]='';}
});
test('mail provider failure is not reported as a successful submission', async () => {
  for (const k of keys) process.env[k]='mock';
  const f=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false,status:429});
  try{const r=await send(valid());assert.equal(r.statusCode,502);assert.equal(r.data.ok,false);}finally{globalThis.fetch=f;for(const k of keys)process.env[k]='';}
});
