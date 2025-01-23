// src/commands/config.js
const { formatSuccess, formatError } = require('../utils/formatting');
const { isGroupChat } = require('../utils/chat');
const {
  getAvailableGroups,
  saveUserGroupSelection
} = require('../utils/configManager');

/**
 * Show list of available group chats
 * @param {Object} msg - Telegram message object
 * @param {Object} bot - Telegram bot instance 
 */
async function showGroups(msg, bot) {
  const chatId = msg.chat.id;
  
  // Ensure this is a private chat
  if (isGroupChat(msg.chat)) {
    await bot.sendMessage(
      chatId,
      formatError('This command can only be used in private chats with the bot.')
    );
    return;
  }

  // Get list of available groups
  const availableGroups = getAvailableGroups();

  if (availableGroups.length === 0) {
    await bot.sendMessage(
      chatId,
      'I\'m not currently a member of any configured group chats.\n\n' +
      'Please:\n' +
      '1. Add me to your group chat\n' +
      '2. Make me an admin in the group\n' +
      '3. Use /help in the group to set it up'
    );
    return;
  }

  // Show numbered list of groups
  let message = 'Here are the groups where I\'m a member:\n\n';
  availableGroups.forEach(group => {
    message += `${group.index}. ${group.name}\n`;
  });
  message += '\nUse /setGC <number> to select a group (e.g., "/setGC 1")';

  await bot.sendMessage(chatId, message);
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
  if (isGroupChat(msg.chat)) {
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
  const availableGroups = getAvailableGroups();
  const selectedGroup = availableGroups.find(g => g.index === selectedNumber);

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

  // Return command info for help
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