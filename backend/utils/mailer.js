// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const hasSMTP = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

let transporter;

if (hasSMTP) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // STARTTLS en 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Fallback dev: imprime en consola
  transporter = {
    sendMail: async (opts) => {
      console.log('\n[DEV EMAIL] -------------------------------');
      console.log('To:', opts.to);
      console.log('Subject:', opts.subject);
      console.log('Text:', opts.text);
      console.log('HTML:', opts.html);
      console.log('------------------------------------------\n');
    },
  };
}

async function sendMagicLinkEmail(to, link) {
  const subject = 'Tu enlace para entrar a Nardeli';
  const text = `Abre este enlace para iniciar sesión (expira pronto): ${link}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.4">
      <h2 style="margin:0 0 8px">Accede para administrar tu evento</h2>
      <p style="margin:0 0 16px">Haz clic para entrar sin contraseña. Este enlace expira en poco tiempo.</p>
      <p style="margin:0 0 16px">
        <a href="${link}" style="display:inline-block;padding:10px 16px;background:#6b46c1;color:#fff;border-radius:8px;text-decoration:none">
          Entrar ahora
        </a>
      </p>
      <p style="font-size:13px;color:#555">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <span style="word-break:break-all">${link}</span>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Nardeli <no-reply@localhost>',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMagicLinkEmail };
