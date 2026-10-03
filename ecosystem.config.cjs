module.exports = {
  apps: [
    {
      name: "madrasah-app",
      script: "dist/server.cjs",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
