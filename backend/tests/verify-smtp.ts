import nodemailer from 'nodemailer';
import { env } from '../src/config/env';
import { sendMailWithDualPortFallback } from '../src/services/notificationService';

async function testPort(port: number, secure: boolean) {
  process.stdout.write(`Testing port ${port} (secure: ${secure})... `);
  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port,
    secure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    tls: { rejectUnauthorized: false }
  });

  try {
    const verified = await transporter.verify();
    console.log(`SUCCESS (verified: ${verified})`);
    return true;
  } catch (err: any) {
    console.log(`FAILED (${err.code || err.message})`);
    return false;
  }
}

async function test() {
  console.log('====================================================');
  console.log('AttendoSchool Resilient SMTP Verification Test');
  console.log('Host:', env.smtpHost);
  console.log('Default Port:', env.smtpPort);
  console.log('User:', env.smtpUser);
  console.log('Pass configured:', Boolean(env.smtpPass));
  console.log('====================================================');

  const p465 = await testPort(465, true);
  const p587 = await testPort(587, false);

  console.log('\n--- Verifying sendMailWithDualPortFallback ---');
  try {
    const result = await sendMailWithDualPortFallback(
      {
        from: env.smtpFrom,
        to: env.smtpUser,
        subject: 'AttendoSchool SMTP Resilience Test',
        text: 'This email confirms that AttendoSchool SMTP dual-port fallback operates correctly across all cloud and VPS deployments.'
      },
      {
        host: env.smtpHost,
        port: env.smtpPort,
        username: env.smtpUser,
        password: env.smtpPass
      }
    );
    console.log(`✅ Email sent successfully!`);
    console.log(`   MessageId: ${result.messageId}`);
    console.log(`   Used Port: ${result.usedPort}`);
    console.log(`   Used Encryption: ${result.usedEncryption}`);
    console.log(`   Fallback Triggered: ${result.fallbackTriggered}`);
  } catch (err: any) {
    console.error(`❌ sendMailWithDualPortFallback failed:`, err.message);
  }

  console.log('\n====================================================');
  console.log('SMTP TEST COMPLETED');
  console.log('====================================================');
}

test();
