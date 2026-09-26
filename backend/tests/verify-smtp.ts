import nodemailer from 'nodemailer';
import { env } from '../src/config/env';

async function test() {
  console.log('Testing SMTP connection with:');
  console.log('Host:', env.smtpHost);
  console.log('Port:', env.smtpPort);
  console.log('User:', env.smtpUser);
  console.log('Pass configured:', Boolean(env.smtpPass));

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    const verified = await transporter.verify();
    console.log('SMTP transporter.verify() SUCCESS:', verified);
  } catch (err: any) {
    console.log('SMTP transporter.verify() ERROR:', err.message);
  }
}

test();
