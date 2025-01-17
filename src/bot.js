// src/bot.js
const TelegramBot = require('node-telegram-bot-api');
const { initGroupLogs, botData } = require('./storage');
const { isGroupChat } = require('./utils');
const commands = require('./commands');

// Initialize bot
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is not set!');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Listen for *any* message to update group metadata
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (isGroupChat(msg)) {
    const groupData = initGroupLogs(chatId);
    if (groupData) {
      groupData.metadata.groupName = msg.chat.title;
      groupData.metadata.lastActivity = new Date().toISOString();
    }
  }
});

// Register all command handlers
commands(bot);

// Export only the bot instance
module.exports = { bot };