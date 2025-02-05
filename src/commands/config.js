// src/commands/config.js
const { formatSuccess, formatError } = require('../utils/formatting');
const { isGroupChat } = require('../utils/chat');
const {
  getAvailableGroups,
  saveUserGroupSelection
} = require('../utils/configManager');

/**
 * Get groups where user is a member
 * @param {string} userId - Telegram user ID
 * @param {Object} bot - Telegram bot instance
 * @param {Array} groups - List of available groups
 * @returns {Promise<Array>} Filtered list of groups
 */
async function getUserGroups(userId, bot, groups) {
  const userGroups = [];
  
  for (const group of groups) {
    try {
      const member = await bot.getChatMember(group.id, userId);
      if (['creator', 'administrator', 'member'].includes(member.status)) {
        userGroups.push(group);
      }
    } catch (error) {
      // Skip if bot can't check membership (likely user not in group)
      continue;
    }
  }
  
  // Reassign indices to maintain sequential numbering
  return userGroups.map((group, index) => ({
    ...group,
    index: index + 1
  }));
}

/**
 * Check if user is bot administrator
 * @param {string} userId - Telegram user ID
 * @returns {boolean} True if user is admin
 */
function isBotAdmin(userId) {
  // You might want to store this in an environment variable or config
  const adminIds = process.env.BOT_ADMIN_IDS ? process.env.BOT_ADMIN_IDS.split(',') : [];
  return adminIds.includes(userId.toString());
}

/**
 * Show all groups in database
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance 
 */
async function showAllGroups(msg, bot) {
  const chatId = msg.chat.id;
  
  // Get list of all groups
  const allGroups = getAvailableGroups();

  if (allGroups.length === 0) {
    await bot.sendMessage(
      chatId,
      'No groups found in database.'
    );
    return;
  }

  // Show list of all groups with IDs
  let message = '*All Configured Groups:*\n\n';
  allGroups.forEach(group => {
    message += `*Name:* ${group.name}\n*ID:* \`${group.id}\`\n\n`;
  });

  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    disable_web_page_preview: true 
  });
}

/**
 * Show list of available group chats
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance 
 */
async function showGroups(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Ensure this is a private chat
  if (isGroupChat(msg)) {
    await bot.sendMessage(
      chatId,
      formatError('This command can only be used in private chats with the bot.')
    );
    return;
  }

  // Get list of available groups
  const allGroups = getAvailableGroups();
  const userGroups = await getUserGroups(userId, bot, allGroups);

  if (userGroups.length === 0) {
    await bot.sendMessage(
      chatId,
      'You are not a member of any configured group chats.\n\n' +
      'Please:\n' +
      '1. Join a group where I am present\n' +
      '2. Make sure I am an admin in that group\n' +
      '3. Use /help in the group to set it up'
    );
    return;
  }

  // Show numbered list of groups
  let message = 'Here are the groups where you are a member:\n\n';
  userGroups.forEach(group => {
    message += `*Group:* ${group.index}\n*Name:* ${group.name}\n*ID:* \`${group.id}\`\n\n`;
  });
  message += '\nUse /setGC <number> to select a group (e.g., "/setGC 1")';

  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    disable_web_page_preview: true 
  });
}

/**
 * Set target group chat for updates
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance
 */
async function setGroupChat(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Ensure this is a private chat
  if (isGroupChat(msg)) {
    await bot.sendMessage(
      chatId,
      formatError('This command can only be used in private chats with the bot.')
    );
    return;
  }

  // Get the number parameter
  const param = msg.text.split(' ')[1];
  if (!param) {
    await bot.sendMessage(
      chatId,
      formatError('Please provide a group number. Use /showGroups to see the list of available groups.')
    );
    return;
  }

  const selectedNumber = parseInt(param);
  const allGroups = getAvailableGroups();
  const userGroups = await getUserGroups(userId, bot, allGroups);
  const selectedGroup = userGroups.find(g => g.index === selectedNumber);

  if (!selectedGroup) {
    await bot.sendMessage(
      chatId,
      formatError(
        'Invalid group number. Use /showGroups to see the list of available groups.'
      )
    );
    return;
  }

  // Save the selection
  saveUserGroupSelection(userId, selectedGroup.id);

  await bot.sendMessage(
    chatId,
    formatSuccess(
      `Group "${selectedGroup.name}" configured successfully!\n\n` +
      'You can now use /start to begin drafting your standup update.'
    )
  );
}

module.exports = function(bot) {
  // Register commands
  bot.onText(/^\/setGC(?:\s+(\d+))?$/, (msg) => setGroupChat(msg, bot));
  bot.onText(/^\/showGroups$/, (msg) => showGroups(msg, bot));
  bot.onText(/^\/showAllGroups$/, (msg) => showAllGroups(msg, bot));

  // Return command info for help (without showAllGroups)
  return {
    commands: {
      showGroups: {
        command: '/showGroups',
        description: 'Show list of available group chats'
      },
      setGroupChat: {
        command: '/setGC <number>',
        description: 'Set target group chat for standup updates'
      }
    }
  };
};