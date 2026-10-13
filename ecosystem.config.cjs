module.exports = {
  apps: [
    {
      name: 'attendoschool-backend',
      script: './backend/dist/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        DB_DRIVER: 'firebase',
        FIREBASE_PROJECT_ID: 'attendoschool',
        APP_BASE_URL: 'https://attendoschool.optinetinnovations.in',
        CORS_ORIGIN: 'http://localhost:5173,https://attendoschool.optinetinnovations.in,http://attendoschool.optinetinnovations.in',
        SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
        SMTP_PORT: process.env.SMTP_PORT || '465',
        SMTP_USER: process.env.SMTP_USER || '',
        SMTP_PASS: process.env.SMTP_PASS || '',
        SMTP_FROM: process.env.SMTP_FROM || 'AttendoSchool <no-reply@attendoschool.com>',
        SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'AttendoSchool Notifications',
        SMTP_REPLY_TO: process.env.SMTP_REPLY_TO || '',
        EMAIL_ENABLED: process.env.EMAIL_ENABLED || 'true'
      }
    }
  ]
};
