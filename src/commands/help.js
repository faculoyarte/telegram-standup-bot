// src/commands/help.js
const { initGroupLogs } = require('../storage');
const { escapeMarkdown, isGroupChat } = require('../utils');

/**
 * Get the help content (welcome or standard)
 * @param {boolean} isWelcome - Show welcome text if true
 * @returns {string} Help text in Markdown
 */
function getHelpContent(isWelcome = false) {
  const welcomeText = isWelcome
    ? `👋 *Thanks for adding me to the group!*\n\nI'll help you manage daily standups.\n\n`
    : `🤖 *Standup Bot Commands*\n\n`;

  const importantNote = `⚠️ *IMPORTANT:*\nMake the bot *ADMIN* to ensure all features work.\n\n`;

  return welcomeText +
    importantNote +
    `*Update Commands:*\n` +
    `• /myUpdate (or /up) - Share your standup update\n` +
    `• /showStandup - Show today's standup updates\n` +
    `• /missing - Show who hasn't submitted updates\n\n` +
    `*Reminder Settings:*\n` +
    `• /setReminder - Set daily standup reminder time\n` +
    `• /showReminder - Show reminder settings\n` +
    `• /toggleReminder - Toggle reminders on/off\n\n` +
    `*Export Settings:*\n` +
    `• /setSpreadsheet <id> - Set a custom Google Spreadsheet ID (admin only)\n\n` +
    `*Member Management:*\n` +
    `• /manageMembers - Show all members and categories\n` +
    `• /addMember [category] [username] - Add member to category\n` +
    `• /removeMember [username] - Remove member from all categories\n\n` +
    `*Format for Updates:*\n` +
    `Use /myUpdate with your text. Example:\n` +
    `/myUpdate Yesterday: <your update>\nToday: <your update>\nBlockers: None\n\n` +
    `*Notes:*\n` +
    `• The latest update overwrites previous updates\n` +
    `• Reminders are converted to UTC internally\n` +
    `• Member categories help organize standup reports\n` +
    (isWelcome ? '\n\nType /help anytime to see this message again.' : '');
}

/**
 * Show help content
 */
function showHelp(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, getHelpContent(false), { 
    parse_mode: 'Markdown',
    disable_web_page_preview: true 
  });
}

/**
 * Handle new chat members (welcome message)
 */
function handleNewMembers(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  // Initialize group data
  initGroupLogs(chatId);

  // Check if the bot itself was added
  const newMembers = msg.new_chat_members || [];
  const botWasAdded = newMembers.some(member => member.username === bot.username);

  if (botWasAdded) {
    bot.sendMessage(chatId, getHelpContent(true), { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
  }
}

module.exports = function(bot) {
  // Register help command
  bot.onText(/^\/help/, (msg) => showHelp(bot, msg));
  
  // Listen for new members
  bot.on('new_chat_members', (msg) => handleNewMembers(bot, msg));
};