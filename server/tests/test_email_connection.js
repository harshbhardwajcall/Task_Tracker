import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testConnection() {
  console.log('----------------------------------------------------');
  console.log('Testing Call-Astro Email Connection Configuration...');
  console.log('----------------------------------------------------');
  console.log('SMTP Host:', process.env.SMTP_HOST || '(not set)');
  console.log('SMTP Port:', process.env.SMTP_PORT || '(not set)');
  console.log('SMTP Secure:', process.env.SMTP_SECURE || '(not set)');
  console.log('SMTP User:', process.env.SMTP_USER || '(not set)');
  console.log('SMTP Pass:', process.env.SMTP_PASS ? '******** (configured)' : '(NOT SET - please set in .env)');

  if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 'YOUR_EMAIL_PASSWORD_HERE') {
    console.log('\n❌ Please open .env and set your actual password in SMTP_PASS before running this test.');
    process.exit(1);
  }

  const port = Number(process.env.SMTP_PORT) || 465;
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('\nConnecting to mail server...');
    await transporter.verify();
    console.log('✅ SMTP Connection & Authentication Successful!\n');

    console.log(`Sending test email to ${process.env.SMTP_USER}...`);
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Call-Astro Task Tracker" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: '✅ Call-Astro Task Tracker Mail Service Verified!',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #38bdf8; margin: 0 0 12px;">Call-Astro Mail Service Online</h2>
          <p>Your company email <strong>${process.env.SMTP_USER}</strong> is now connected to Task Tracker.</p>
          <p style="color: #94a3b8; font-size: 13px;">Automated emails will now be dispatched whenever tasks are created, modified, or overdue.</p>
        </div>
      `
    });

    console.log('✅ Test email sent successfully! Message ID:', info.messageId);
    console.log('Please check your inbox at:', process.env.SMTP_USER);
  } catch (err) {
    console.error('\n❌ Email test failed:', err.message);
    if (err.code === 'EAUTH') {
      console.log('👉 Tip: Check your email password in .env (SMTP_PASS).');
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
      console.log('👉 Tip: Try changing SMTP_PORT=587 and SMTP_SECURE=false in .env.');
    }
  }
}

testConnection();
