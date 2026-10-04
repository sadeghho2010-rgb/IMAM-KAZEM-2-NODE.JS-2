module.exports = {
  apps: [
    {
      name: "madrasah-app",
      script: "dist/server.cjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=512",
        PORT: 3000,
      },
    },
  ],
};
