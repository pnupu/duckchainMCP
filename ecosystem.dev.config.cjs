module.exports = {
  apps: [
    {
      name: "duck-web-dev",
      script: "npm",
      args: "run dev",
      cwd: __dirname,
      env: {
        NODE_ENV: "development",
        PORT: "3443",
      },
      watch: false,
      max_restarts: 10,
    },
    {
      name: "duck-mcp-dev",
      script: "npm",
      args: "run mcp:stdio",
      cwd: __dirname,
      env: {
        NODE_ENV: "development",
        PORT: "3020",
      },
      env_file: ".env",
      watch: false,
      max_restarts: 10,
    },
  ],
};


