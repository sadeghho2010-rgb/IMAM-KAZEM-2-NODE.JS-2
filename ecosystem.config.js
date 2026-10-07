module.exports = {
  apps: [
    {
      name: "madrasah-app",
      script: "server-dist/server.cjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "450M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=384",
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
