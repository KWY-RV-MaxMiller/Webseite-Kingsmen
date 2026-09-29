const crypto = require('crypto');

const COOKIE_NAME = 'kingsmen_session';

function sign(value) {
  return crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(value)
    .digest('base64url');
}

function createSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readSession(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map(v => v.trim())
    .find(v => v.startsWith(COOKIE_NAME + '='));

  if (!cookie) return null;

  const token = decodeURIComponent(
    cookie.slice(COOKIE_NAME.length + 1)
  );

  const [body, signature] = token.split('.');

  if (!body || !signature) return null;

  const expected = sign(body);

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString()
    );

    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function setSession(res, payload) {
  const token = createSession(payload);

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`
  );
}

function clearSession(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

function requireSession(req, res) {
  const session = readSession(req);

  if (!session) {
    res.status(401).json({
      error: 'Nicht angemeldet'
    });

    return null;
  }

  return session;
}

module.exports = {
  readSession,
  setSession,
  clearSession,
  requireSession
};
