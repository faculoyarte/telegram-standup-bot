// src/commands/config.js
const { formatSuccess, formatError } = require('../utils/formatting');
const { isGroupChat } = require('../utils/chat');
const {
  getAvailableGroups,
  saveUserGroupSelection
} = require('../utils/configManager');

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
  message += '\nType the number of the group you want to use (e.g., "1"):';

  await bot.sendMessage(chatId, message);

  // Set up one-time message handler for the response
  bot.once('message', async (response) => {
    // Ignore if not from same user/chat
    if (response.from.id.toString() !== userId || response.chat.id !== chatId) {
      return;
    }

    const selectedNumber = parseInt(response.text);
    const selectedGroup = availableGroups.find(g => g.index === selectedNumber);

    if (!selectedGroup) {
      await bot.sendMessage(
        chatId,
        formatError(
          'Invalid selection. Please use /setGC again and choose a number from the list.'
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
  });
}

module.exports = function(bot) {
  // Register command
  bot.onText(/^\/setGC/, (msg) => setGroupChat(msg, bot));

  // Return command info for help
  return {
    commands: {
      setGroupChat: {
        command: '/setGC',
        description: 'Set target group chat for standup updates'
      }
    }
  };
};