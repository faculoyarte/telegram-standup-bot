// src/commands/help.js
const { initGroupLogs } = require('../storage');
const { escapeMarkdown, isGroupChat } = require('../utils');

/**
 * Get help content for private chats
 * @returns {string} Help text in Markdown
 */
function getPrivateChatHelp() {
  return '🤖 *Standup Bot Private Chat Commands*\n\n' +
    '*Setup:*\n' +
    '• /setGC - Set which group chat your updates should go to\n\n' +
    '*Creating Updates:*\n' +
    '• /start - Begin creating your standup update\n' +
    '• /stop - Finish current section (yesterday/today)\n\n' +
    '*How it works:*\n' +
    '1. Use /setGC and forward a message from your target group\n' +
    '2. Use /start to begin your update\n' +
    '3. Follow the prompts to add tasks\n' +
    '4. Use /stop when done with a section\n\n' +
    '*Format for Tasks:*\n' +
    'The bot will guide you through adding tasks one by one.\n' +
    'For each task, you\'ll enter:\n' +
    '1. What you did/will do\n' +
    '2. Why you did/will do it\n\n' +
    'The bot will automatically format and number your tasks.';
}

/**
 * Get help content for group chats
 * @param {boolean} isWelcome - Show welcome text if true
 * @returns {string} Help text in Markdown
 */
function getGroupChatHelp(isWelcome = false) {
  const welcomeText = isWelcome
    ? `👋 *Thanks for adding me to the group!*\n\nI'll help you manage daily standups.\n\n`
    : `🤖 *Standup Bot Group Commands*\n\n`;

  const importantNote = `⚠️ *IMPORTANT:*\nMake the bot *ADMIN* to ensure all features work.\n\n`;

  return welcomeText +
    importantNote +
    `*Update Commands:*\n` +
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
    `*Creating Updates:*\n` +
    `To create updates, chat with @${bot.username} privately.\n` +
    `The bot will guide you through creating well-formatted updates.\n\n` +
    `*Notes:*\n` +
    `• Member categories help organize standup reports\n` +
    `• Reminders are converted to UTC internally\n` +
    (isWelcome ? '\n\nType /help anytime to see this message again.' : '');
}

/**
 * Show appropriate help content based on chat type
 */
function showHelp(bot, msg) {
  const chatId = msg.chat.id;
  const helpContent = isGroupChat(msg.chat) 
    ? getGroupChatHelp(false)
    : getPrivateChatHelp();

  bot.sendMessage(chatId, helpContent, { 
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
    bot.sendMessage(chatId, getGroupChatHelp(true), { 
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