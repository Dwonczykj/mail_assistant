module.exports = {
  apps: [
    {
      name: "daemon-worker",
      script: "worker.ts", // Entry point for the daemon worker.
      interpreter: "ts-node", // Use ts-node to run TypeScript directly.
      instances: 1,
      autorestart: true,
      watch: false, // Change to true if you want PM2 to watch for file changes.
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      }
      // Additional PM2 configuration options can be added here.
    }
  ]
};