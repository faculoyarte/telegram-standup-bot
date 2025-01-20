// src/commands/updateGC.js
const { botData, saveData, initGroupLogs } = require('../storage');
const { exportToGoogleSheets } = require('../googleSheets');
const { 
  formatSuccess,
  formatError,
  isGroupChat
} = require('../utils');

/**
 * Handler for sharing an update directly in group chat via /myUpdate, /up
 * This supports the traditional method of posting updates directly in the group
 */
const shareUpdate = async (bot, msg, match) => {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) {
    await bot.sendMessage(
      chatId,
      formatError(
        'This command is for group chats. In private chat, use /start to prepare your update.'
      )
    );
    return;
  }

  initGroupLogs(chatId);

  const userName = msg.from.username
    ? msg.from.username
    : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

  const updateText = match[1]?.trim();
  if (!updateText) {
    return bot.sendMessage(
      chatId,
      "Please provide your update after the command. For example:\n" +
      "`/myUpdate Yesterday: Worked on X\nToday: Work on Y\nBlockers: None`",
    );
  }

  const update = {
    user: userName,
    text: updateText,
    date: new Date().toISOString(),
  };

  const existingIndex = botData.groups[chatId].standUpLogs.findIndex(
    (log) => log.user === userName
  );
  
  if (existingIndex !== -1) {
    botData.groups[chatId].standUpLogs[existingIndex] = update;
    bot.sendMessage(chatId, `✏️ @${userName}'s update has been updated.`);
  } else {
    botData.groups[chatId].standUpLogs.push(update);
    bot.sendMessage(chatId, `✅ @${userName}'s update has been recorded.`);
  }

  saveData(botData);

  const exported = await exportToGoogleSheets(chatId, [update]);
  if (!exported) {
    bot.sendMessage(chatId, "❌ Error exporting your update to the spreadsheet.");
  }
};

module.exports = function(bot) {
  // Register update commands for group chat
  bot.onText(/^\/myupdate([\s\S]+)?/, (msg, match) => shareUpdate(bot, msg, match));
  bot.onText(/^\/myUpdate([\s\S]+)?/, (msg, match) => shareUpdate(bot, msg, match));
  bot.onText(/^\/UP([\s\S]+)?/, (msg, match) => shareUpdate(bot, msg, match));
  bot.onText(/^\/up([\s\S]+)?/, (msg, match) => shareUpdate(bot, msg, match));

  return {
    commands: {
      myUpdate: {
        command: '/myUpdate',
        description: 'Share your standup update in the group'
      },
      up: {
        command: '/up',
        description: 'Short command to share your standup update'
      }
    }
  };
};