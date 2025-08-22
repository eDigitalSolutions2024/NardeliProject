// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const DEV = process.env.MAIL_DEV_MODE === '1';

// helper: interpreta 1/true/yes como booleano
const toBool = (v) => /^(1|true|yes)$/i.test(String(v || ''));

// Lee flags desde .env
const SECURE = toBool(process.env.SMTP_SECURE);     // true => 465, false => 587
const HOST   = process.env.SMTP_HOST;
const PORT   = Number(process.env.SMTP_PORT || (SECURE ? 465 : 587));
const USER   = process.env.SMTP_USER;
const PASS   = process.env.SMTP_PASS;

const transporter = DEV
  ? nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    })
  : nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: USER && PASS ? { user: USER, pass: PASS } : undefined,
      // Si trabajas en dev y tu proveedor usa TLS con cert self-signed:
      // tls: { rejectUnauthorized: false },
    });

// Verifica el transporte al iniciar
(async () => {
  try {
    await transporter.verify();
    console.log(`[MAILER] SMTP listo (DEV=${DEV}) host=${HOST} port=${PORT} secure=${SECURE}`);
  } catch (e) {
    console.error('[MAILER] ERROR de SMTP verify:', {
      message: e.message,
      code: e.code,
      command: e.command,
      response: e.response,
    });
  }
})();

/**
 * Envía el código y link mágico
 * @param {{to:string, code:string, link?:string, from?:string}} param0
 */
async function sendMagicCode({ to, code, link, from }) {
  const expires = Number(process.env.MAGIC_LINK_EXPIRES_MIN || 15);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#7c3aed;margin:0 0 8px">Nardeli · Acceso</h2>
      <p>Tu código (válido por ${expires} min):</p>
      <div style="font-size:26px;font-weight:700;letter-spacing:4px;border:1px solid #eee;padding:10px 14px;display:inline-block">
        ${code}
      </div>
      ${link ? `<p style="margin:16px 0">O usa este enlace:</p>
      <p><a href="${link}" style="color:#7c3aed">${link}</a></p>` : ''}
    </div>`;

  const info = await transporter.sendMail({
    from: from || process.env.SMTP_FROM, // <-- DEBE estar configurado en .env
    to,
    subject: 'Tu código de acceso',
    html,
  });

  if (DEV && info?.message) {
    console.log('==== EMAIL (DEV) ====\n' + info.message.toString());
  }
  console.log('[MAILER] enviado:', info?.messageId || '(ok)');
}

module.exports = { sendMagicCode };
