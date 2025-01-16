// src/commands/members.js
const { botData, saveData, initGroupLogs } = require('../storage');
const { 
  escapeMarkdown,
  formatUsername,
  formatMemberList,
  formatError,
  formatSuccess,
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
 * Show or manage the categories and members in the group
 */
async function manageMembers(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(chatId, "❌ Only administrators can manage members.");
    }

    initGroupLogs(chatId);
    const categories = botData.groups[chatId].memberCategories || {};

    // Escape for MarkdownV2
    const escapeMarkdown = (t) => t.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

    let message = "*Team Members by Category*\n\n";
    if (!Object.keys(categories).length) {
      message += "No members set in any category\n";
    } else {
      Object.entries(categories).forEach(([category, members]) => {
        message += `*${escapeMarkdown(category)}*:\n`;
        if (!members.length) {
          message += "• No members\n\n";
        } else {
          members.forEach((m) => {
            message += `• @${escapeMarkdown(m)}\n`;
          });
          message += "\n";
        }
      });
    }

    message +=
      "To add members:\n" +
      "`/addMember [category] [username1], [username2], ...`\n\n" +
      "To remove members:\n" +
      "`/removeMember [username1], [username2], ...`\n\n" +
      "Example: `/addMember developer john_doe`";

    bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('/manageMembers error:', error);
    bot.sendMessage(chatId, "❌ Error managing members. Please try again later.");
  }
}

/**
 * Add members to a specific category
 * Format: /addMember "Category Name" user1, user2
 */
async function addMember(bot, msg, match) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(chatId, "❌ Only administrators can manage members.");
    }

    const input = match[1].trim();
    let category, usernameParts;

    // Handle quoted category names
    if (input.startsWith('"')) {
      const closingQuoteIndex = input.indexOf('"', 1);
      if (closingQuoteIndex === -1) {
        return bot.sendMessage(
          chatId,
          "❌ Invalid format for quotes. Example:\n" +
          '`/addMember "Sales Team" user1, user2`'
        );
      }
      category = input.slice(1, closingQuoteIndex);
      usernameParts = input.slice(closingQuoteIndex + 1).trim();
    } else {
      // Split by first space
      const parts = input.split(/\s+(.+)/);
      if (parts.length < 2) {
        return bot.sendMessage(
          chatId,
          "❌ Provide category and usernames.\nFormat: `/addMember [category] user1, user2, ...`"
        );
      }
      category = parts[0];
      usernameParts = parts[1];
    }

    // Clean up usernames (remove commas, @, etc.)
    const usernames = usernameParts
      .split(',')
      .map((u) => u.trim().replace('@', ''))
      .filter((u) => u);

    if (!usernames.length) {
      return bot.sendMessage(chatId, "❌ No valid usernames provided.");
    }

    initGroupLogs(chatId);
    const memberCats = botData.groups[chatId].memberCategories || {};
    const categoryLower = category.toLowerCase();
    if (!memberCats[categoryLower]) memberCats[categoryLower] = [];

    const results = { added: [], already: [] };
    usernames.forEach((u) => {
      if (memberCats[categoryLower].includes(u)) {
        results.already.push(u);
      } else {
        memberCats[categoryLower].push(u);
        results.added.push(u);
      }
    });

    botData.groups[chatId].memberCategories = memberCats;
    saveData(botData);

    let message = "";
    if (results.added.length) {
      message += `✅ Added to '${category}':\n${results.added.map((x) => `@${x}`).join('\n')}\n\n`;
    }
    if (results.already.length) {
      message += `⚠️ Already in '${category}':\n${results.already.map((x) => `@${x}`).join('\n')}`;
    }
    bot.sendMessage(chatId, message || "❌ No members were added.");
  } catch (error) {
    console.error('/addMember error:', error);
    bot.sendMessage(chatId, "❌ Error adding members. Please try again.");
  }
}

/**
 * Remove members from all categories
 * Format: /removeMember user1, user2
 */
async function removeMember(bot, msg, match) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  try {
    if (!await isAdmin(bot, chatId, msg.from.id)) {
      return bot.sendMessage(chatId, "❌ Only administrators can remove members.");
    }

    const input = match[1].trim();
    const usernames = input
      .split(',')
      .map((u) => u.trim().replace('@', ''))
      .filter((u) => u);

    if (!usernames.length) {
      return bot.sendMessage(chatId, "❌ Provide usernames to remove.\n`/removeMember user1, user2`");
    }

    initGroupLogs(chatId);
    const memberCats = botData.groups[chatId].memberCategories || {};

    const results = { removed: [], notFound: [], cleanedCats: [] };
    usernames.forEach((username) => {
      let found = false;
      Object.entries(memberCats).forEach(([cat, mems]) => {
        const idx = mems.indexOf(username);
        if (idx !== -1) {
          mems.splice(idx, 1);
          results.removed.push({ username, category: cat });
          found = true;
        }
      });
      if (!found) results.notFound.push(username);
    });

    // Cleanup empty categories
    Object.entries(memberCats).forEach(([cat, mems]) => {
      if (!mems.length) {
        delete memberCats[cat];
        results.cleanedCats.push(cat);
      }
    });
    botData.groups[chatId].memberCategories = memberCats;
    saveData(botData);

    // Build response
    let message = "";
    if (results.removed.length) {
      message += `✅ Removed:\n`;
      results.removed.forEach((r) => {
        message += `@${r.username} (from '${r.category}')\n`;
      });
      message += "\n";
    }
    if (results.cleanedCats.length) {
      message += `🗑 Removed empty categories:\n`;
      results.cleanedCats.forEach((cat) => {
        message += `• ${cat}\n`;
      });
      message += "\n";
    }
    if (results.notFound.length) {
      message += `⚠️ Not found:\n`;
      results.notFound.forEach((nf) => {
        message += `• @${nf}\n`;
      });
    }
    bot.sendMessage(chatId, message || "❌ No members removed.");
  } catch (error) {
    console.error('/removeMember error:', error);
    bot.sendMessage(chatId, "❌ Error removing members. Please try again later.");
  }
}

module.exports = function(bot) {
  bot.onText(/^\/manageMembers/, (msg) => manageMembers(bot, msg));
  bot.onText(/^\/addMember (.+)/, (msg, match) => addMember(bot, msg, match));
  bot.onText(/^\/removeMember (.+)/, (msg, match) => removeMember(bot, msg, match));
};