module.exports = {
    apps: [
      {
        name: 'import_movers',
        cwd: '/var/www/movers-crawler',
        script: 'import_movers.js',  // adjust this to your actual script name
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production'
        }
      },
      {
        name: 'movers-dot',
        cwd: '/var/www/movers-dot',
        script: 'dot_finder.js',
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production',
          PORT: 3001  // different port to avoid conflicts
        }
      },
      {
        name: 'standup-bot',
        cwd: '/var/www/standup-bot',  // adjust this path to where your bot is located
        script: 'src/server.js',
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production',
          PORT: 3002  // different port to avoid conflicts
        }
      }
    ]
  };
