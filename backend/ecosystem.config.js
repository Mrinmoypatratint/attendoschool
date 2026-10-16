module.exports = {
  apps: [
    {
      name: 'attendoschool-api',
      script: './dist/server.js',
      instances: process.env.WEB_CONCURRENCY || 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      listen_timeout: 10000,
      kill_timeout: 8000,
      wait_ready: false,
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'attendoschool-worker',
      script: './dist/workers/notificationQueueWorker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
