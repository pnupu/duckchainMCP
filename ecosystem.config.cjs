module.exports = {
  apps: [
    {
      name: "duck-web",
      script: "node",
      args: "node_modules/next/dist/bin/next start -p 3333",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 5,
      watch: false,
    },
    {
      name: "duck-mcp",
      script: "node",
      args: "packages/mcp-server/dist/index.js --http 3020",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env",
      max_restarts: 5,
      watch: false,
    },
  ],
};


