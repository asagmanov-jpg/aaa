/**
 * ОПОРА — Vercel Function for incoming website enquiries.
 * The recipient, verified sender address and API key exist only as environment variables.
 * No credentials and no recipient address are delivered to browsers or committed to GitHub.
 *
 * Compatible with Vercel Node.js Functions, no third-party npm dependencies.
 */
const cities = new Set(['Москва', 'Московская область', 'Казань', 'Уфа', 'Другой регион']);
const topics = new Set([
  '', 'Трещины и деформации', 'Проблемы с фундаментом',
  'Протечки и нарушения гидроизоляции', 'Некачественное строительство и ремонт',
  'Спор с подрядчиком', 'Повреждения после аварии',
  'Строительно-техническая экспертиза', 'Расчёт стоимости устранения дефектов',
  'Рецензирование экспертного заключения', 'Другой вопрос'
]);
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
const genericFailure = 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.';

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return reply(response, 405, {ok: false, message: 'Метод не поддерживается.'});
  const origin = request.headers.origin || '';
  const host = request.headers['x-forwarded-host'] || request.headers.host || '';
  let sameOrigin = false;
  try {
    const incoming = new URL(origin);
    sameOrigin = incoming.host === host && (incoming.protocol === 'https:' || (incoming.protocol === 'http:' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)));
  } catch {}
  const extraOrigins = (process.env.OPORA_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!sameOrigin && !extraOrigins.includes(origin)) return reply(response, 403, {ok: false, message: genericFailure});

  if (!(request.headers['content-type'] || '').startsWith('application/json')) {
    return reply(response, 415, {ok: false, message: 'Неверный формат запроса.'});
  }
  if (Number(request.headers['content-length'] || 0) > 12000) {
    return reply(response, 413, {ok: false, message: 'Слишком большой запрос.'});
  }
  let input;
  try {
    // Vercel normally populates request.body for application/json.
    input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  } catch { return reply(response, 400, {ok: false, message: 'Неверные данные заявки.'}); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reply(response, 400, {ok: false, message: 'Неверные данные заявки.'});
  }
  // Honeypot — discard automated submissions without sending personal data onward.
  if (input.website) return reply(response, 200, {ok: true});

  const name = clean(input.name, 100);
  const phone = clean(input.phone, 30);
  const city = clean(input.city, 100);
  const topic = clean(input.topic, 150);
  const message = clean(input.message, 2500);
  const digits = phone.replace(/\D/g, '');
  if (
    name.length < 2 || name.length > 100 ||
    !/^\+?[\d\s()\-]{10,30}$/.test(phone) || digits.length < 10 || digits.length > 15 ||
    !cities.has(city) || !topics.has(topic) ||
    message.length < 10 || message.length > 2500 || input.consent !== true
  ) return reply(response, 422, {ok: false, message: 'Проверьте заполнение формы.'});

  const started = Number(input.startedAt);
  const elapsed = Date.now() - started;
  if (!Number.isFinite(started) || started <= 0 || elapsed < 1800 || elapsed > 12 * 60 * 60 * 1000) {
    return reply(response, 422, {ok: false, message: 'Обновите страницу и повторите отправку.'});
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.OPORA_MAIL_TO;
  const from = process.env.OPORA_MAIL_FROM;
  if (!key || !to || !from) {
    return reply(response, 503, {ok: false, message: 'Сервис отправки пока не настроен.'});
  }
  const content = [
    'Новая заявка с сайта «ОПОРА»', '',
    `Имя: ${name}`, `Телефон: ${phone}`, `Город: ${city}`,
    `Тип вопроса: ${topic || 'Не указан'}`, '',
    'Описание ситуации:', message, '',
    `Дата (Москва): ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
  ].join('\n');
  const controller = new AbortController();
  const abortAfter = setTimeout(() => controller.abort(), 9500);
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
      body: JSON.stringify({from, to: [to], subject: `ОПОРА · Новая заявка · ${city}`, text: content})
    });
    // Provider accepts an email; real delivery into an inbox must be separately checked.
    if (!result.ok) {
      console.error('Mail provider rejected request, status:', result.status);
      return reply(response, 502, {ok: false, message: genericFailure});
    }
    return reply(response, 200, {ok: true});
  } catch (error) {
    console.error('Mail provider is unavailable:', error?.name || 'Error');
    return reply(response, 502, {ok: false, message: genericFailure});
  } finally {
    clearTimeout(abortAfter);
  }
}
