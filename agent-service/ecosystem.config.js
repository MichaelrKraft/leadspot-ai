module.exports = {
  apps: [
    {
      name: 'leadspot-agent-service',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        AGENT_SERVICE_PORT: 3008,
      },
      error_file: 'logs/agent-service-error.log',
      out_file: 'logs/agent-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
