// src/commands/display.js
const { botData, initGroupLogs } = require('../storage');
const { 
  escapeMarkdown,
  formatMemberList,
  formatUpdate,
  formatError,
  isGroupChat
} = require('../utils');

/**
 * Show today's standup updates
 */
async function showStandup(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;
  
  try {
    initGroupLogs(chatId);
    const groupData = botData.groups[chatId];

    // Filter updates for "today"
    const today = new Date().toISOString().split('T')[0];
    const todayUpdates = groupData.standUpLogs.filter(
      (log) => log.date.startsWith(today)
    );

    if (todayUpdates.length === 0) {
      return bot.sendMessage(
        chatId,
        "No standup updates for today yet.\n\nUse `/myUpdate` or `/up` to share yours.",
        { parse_mode: 'MarkdownV2' }
      );
    }

    // Group updates by category
    const updatesByCategory = {};
    todayUpdates.forEach((update) => {
      let category = 'Uncategorized';
      Object.entries(groupData.memberCategories || {}).forEach(([cat, members]) => {
        if (members.includes(update.user)) {
          category = cat;
        }
      });
      if (!updatesByCategory[category]) updatesByCategory[category] = [];
      updatesByCategory[category].push(update);
    });

    // Build message
    let message = "*Today's Standup Updates*\n\n";
    Object.entries(updatesByCategory).forEach(([category, updates]) => {
      message += `*${escapeMarkdown(category)}*:\n`;
      updates.forEach((upd) => {
        message += `• @${escapeMarkdown(upd.user)}:\n`;
        message += upd.text
          .split('\n')
          .map((line) => `  ${escapeMarkdown(line)}`)
          .join('\n');
        message += "\n\n";
      });
    });

    // Add summary
    const totalMembers = Object.values(groupData.memberCategories || {}).reduce(
      (acc, members) => acc + members.length,
      0
    );
    if (totalMembers > 0) {
      const pendingMembers = Object.values(groupData.memberCategories)
        .flat()
        .filter((member) => !todayUpdates.some((upd) => upd.user === member));
      if (pendingMembers.length > 0) {
        message += "*Pending Updates From:*\n";
        pendingMembers.forEach((member) => {
          message += `• @${escapeMarkdown(member)}\n`;
        });
      }
      message += `\n*Summary:* ${todayUpdates.length}/${totalMembers} updates submitted`;
    }
    bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Error in /showStandup:', error);
    bot.sendMessage(chatId, "❌ Error showing standup updates. Please try again later.");
  }
}

/**
 * Show members missing updates today
 */
async function showMissing(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    initGroupLogs(chatId);
    const groupData = botData.groups[chatId];

    // Filter today's logs
    const today = new Date().toISOString().split('T')[0];
    const todayUpdates = groupData.standUpLogs.filter(
      (log) => log.date.startsWith(today)
    );

    // Collect unique members from categories
    const memberCategories = new Map();
    let totalUniqueMembers = 0;
    Object.entries(groupData.memberCategories || {}).forEach(([cat, members]) => {
      members.forEach((m) => {
        if (!memberCategories.has(m)) {
          memberCategories.set(m, new Set());
          totalUniqueMembers++;
        }
        memberCategories.get(m).add(cat);
      });
    });

    if (totalUniqueMembers === 0) {
      return bot.sendMessage(
        chatId,
        "No team members configured.\nUse `/addMember [category] [username]` to add members.",
        { parse_mode: 'MarkdownV2' }
      );
    }

    // Find missing members
    const missingMembers = new Map();
    memberCategories.forEach((cats, member) => {
      if (!todayUpdates.some((log) => log.user === member)) {
        missingMembers.set(member, Array.from(cats));
      }
    });

    // If no one is missing
    if (missingMembers.size === 0) {
      return bot.sendMessage(
        chatId,
        `✅ *All team members have submitted their updates\\!*\n` +
        `*Total:* ${todayUpdates.length}/${totalUniqueMembers} updates submitted`,
        { parse_mode: 'MarkdownV2' }
      );
    }

    // Format message
    let msgText = "*Missing Standup Updates*\n\n";
    missingMembers.forEach((cats, member) => {
      msgText += `• @${escapeMarkdown(member)}\n`;
      msgText += `  _Categories: ${escapeMarkdown(cats.join(', '))}_\n\n`;
    });
    msgText += `*Summary:* ${todayUpdates.length}/${totalUniqueMembers} updates submitted`;

    bot.sendMessage(chatId, msgText, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Error in /missing command:', error);
    bot.sendMessage(chatId, "❌ Error checking missing updates. Please try again later.");
  }
}

module.exports = function(bot) {
  bot.onText(/^\/showStandup/, (msg) => showStandup(bot, msg));
  bot.onText(/^\/missing/, (msg) => showMissing(bot, msg));
};