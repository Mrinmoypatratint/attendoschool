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
        CORS_ORIGIN: 'http://localhost:5173,https://attendoschool.optinetinnovations.in,http://attendoschool.optinetinnovations.in'
      }
    }
  ]
};
