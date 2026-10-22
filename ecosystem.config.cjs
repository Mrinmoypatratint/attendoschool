module.exports = {
  apps: [
    {
      name: 'attendoschool-backend',
      script: './dist/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        DB_DRIVER: 'postgres',
        APP_BASE_URL: 'https://attendoschool.online',
        CORS_ORIGIN: 'https://attendoschool.online,https://www.attendoschool.online,https://attendoschool.optinetinnovations.in,http://localhost:5173',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        DB_DRIVER: 'postgres',
        APP_BASE_URL: 'https://attendoschool.online',
        CORS_ORIGIN: 'https://attendoschool.online,https://www.attendoschool.online,https://attendoschool.optinetinnovations.in,http://localhost:5173',
      }
    }
  ]
};
