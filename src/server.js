// src/server.js
const app = require('./app');
const { loadData } = require('./storage');
const { initCronJobs } = require('./cronJobs');
const { bot } = require('./bot');

async function initializeApp() {
  try {
    // Initialize data and services
    await loadData();
    initCronJobs();
    
    // Wait for bot to get initialized
    await new Promise((resolve) => {
      if (bot.username) {
        resolve();
      } else {
        bot.on('polling_error', (error) => {
          console.error('Polling error:', error);
        });
        
        bot.getMe().then((botInfo) => {
          bot.username = botInfo.username;
          resolve();
        }).catch((error) => {
          console.error('Failed to get bot info:', error);
          resolve(); // Still resolve to allow server to start
        });
      }
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Express server running on port ${PORT}`);
      if (bot.username) {
        console.log('Bot username:', bot.username);
      } else {
        console.log('Warning: Bot not fully initialized');
      }
      console.log('Cron jobs initialized');
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the application
if (require.main === module) {
  initializeApp().catch(console.error);
}