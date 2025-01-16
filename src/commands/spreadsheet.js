// src/commands/spreadsheet.js
const { botData, saveData, initGroupLogs } = require('../storage');
const { 
  formatError,
  formatSuccess,
  escapeMarkdown,
  isGroupChat
} = require('../utils');

/**
 * Check if user is an admin of the group
 */
async function isAdmin(bot, chatId, userId) {
  try {
    const chatMember = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(chatMember.status);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Command to set a custom Google Spreadsheet ID
 * Format: /setSpreadsheet spreadsheet_id
 */
async function setSpreadsheet(bot, msg, match) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    // Check admin status
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(
        chatId, 
        "❌ Only group administrators can change the spreadsheet ID."
      );
    }

    const newSpreadsheetId = match[1].trim();
    
    // Validate spreadsheet ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(newSpreadsheetId)) {
      return bot.sendMessage(
        chatId,
        "❌ Invalid spreadsheet ID format.\n\n" +
        "The ID should be found in your spreadsheet's URL:\n" +
        "https://docs.google.com/spreadsheets/d/*spreadsheet_id*/edit"
      );
    }

    // Initialize group if needed
    initGroupLogs(chatId);
    
    // Update spreadsheet ID
    botData.groups[chatId].settings.spreadsheetId = newSpreadsheetId;
    saveData(botData);

    // Send success message with service account email
    const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL;
    bot.sendMessage(
      chatId,
      "✅ Spreadsheet ID updated successfully!\n\n" +
      "*Important:* Share your spreadsheet with our service account:\n" +
      `\`${serviceAccountEmail}\`\n\n` +
      "Give it *Editor* access so it can create and update sheets.",
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('/setSpreadsheet error:', error);
    bot.sendMessage(
      chatId,
      "❌ Error updating spreadsheet ID. Please try again later."
    );
  }
}

/**
 * Show current spreadsheet settings
 */
async function showSpreadsheet(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(
        chatId,
        "❌ Only administrators can view spreadsheet settings."
      );
    }

    const groupData = botData.groups[chatId];
    if (!groupData || !groupData.settings.spreadsheetId) {
      return bot.sendMessage(
        chatId,
        "📝 No spreadsheet configured yet.\n\n" +
        "Use `/setSpreadsheet [spreadsheet_id]` to set one up.",
        { parse_mode: 'Markdown' }
      );
    }

    bot.sendMessage(
      chatId,
      "📊 *Current Spreadsheet Settings*\n\n" +
      `ID: \`${groupData.settings.spreadsheetId}\`\n\n` +
      "To change this, use:\n" +
      "`/setSpreadsheet [new_spreadsheet_id]`",
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('/showSpreadsheet error:', error);
    bot.sendMessage(
      chatId,
      "❌ Error fetching spreadsheet settings. Please try again later."
    );
  }
}

/**
 * Remove spreadsheet integration
 */
async function removeSpreadsheet(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(
        chatId,
        "❌ Only administrators can remove spreadsheet integration."
      );
    }

    const groupData = botData.groups[chatId];
    if (!groupData || !groupData.settings.spreadsheetId) {
      return bot.sendMessage(
        chatId,
        "❌ No spreadsheet currently configured."
      );
    }

    // Remove spreadsheet ID
    groupData.settings.spreadsheetId = null;
    saveData(botData);

    bot.sendMessage(
      chatId,
      "✅ Spreadsheet integration removed.\n\n" +
      "Updates will no longer be exported to Google Sheets.\n" +
      "Use `/setSpreadsheet` to set up a new spreadsheet."
    );

  } catch (error) {
    console.error('/removeSpreadsheet error:', error);
    bot.sendMessage(
      chatId,
      "❌ Error removing spreadsheet integration. Please try again later."
    );
  }
}

module.exports = function(bot) {
  bot.onText(/^\/setSpreadsheet (.+)/, (msg, match) => setSpreadsheet(bot, msg, match));
  bot.onText(/^\/showSpreadsheet/, (msg) => showSpreadsheet(bot, msg));
  bot.onText(/^\/removeSpreadsheet/, (msg) => removeSpreadsheet(bot, msg));
};