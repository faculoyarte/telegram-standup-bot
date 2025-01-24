// src/commands/updatePrivate.js
const { formatSuccess, formatError } = require('../utils/formatting');
const { isGroupChat } = require('../utils/chat');
const { getUserData, initializeUpdateDraft, cleanupUserSession } = require('../utils/configManager');
const { formatTaskPreview, formatNextTaskPrompt, formatFinalUpdate, prompts } = require('../utils/formatUpdate');
const { botData, saveData } = require('../storage');
const { exportToGoogleSheets } = require('../googleSheets');

/**
 * Handle the transition between yesterday and today sections
 * Used to finish yesterday's tasks and move to today's, or finish today's tasks
 */
async function handleTransitionCommand(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  const userData = getUserData(userId);
  if (!userData?.draftUpdate?.state) {
    return; // Ignore /today or /done if not creating an update
  }

  const section = userData.draftUpdate.state === 'collecting_yesterday' ? 'yesterday' : 'today';

  if (userData.draftUpdate.content[section].length === 0) {
    await bot.sendMessage(
      chatId,
      formatError('Please add at least one accomplishment before continuing.')
    );
    return;
  }

  if (section === 'yesterday') {
    // Move to collecting today's tasks
    userData.draftUpdate.state = 'collecting_today';
    userData.draftUpdate.collecting = 'what';
    await bot.sendMessage(chatId, prompts.startToday);
  } else {
    // Clean up message listener before sending final update
    if (userData.messageHandler) {
      bot.removeListener('message', userData.messageHandler);
      userData.messageHandler = null;
    }

    // Format and send the update to the group chat
    const finalMessage = formatFinalUpdate(userData.draftUpdate);
    const targetGroupId = userData.targetGroupId;

    const userName = msg.from.username
      ? `@${msg.from.username}`
      : `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
    const userDisplayName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

    // Include user's name and username in the message
    const finalMessageWithUserDetails = `*${userDisplayName}* (${userName}):\n\n${finalMessage}`;

    try {
      // Send formatted message to group
      await bot.sendMessage(targetGroupId, finalMessageWithUserDetails, { parse_mode: 'Markdown' });
      
      // Create update record for storage and export
      const update = {
        user: `${userDisplayName} (${userName})`,
        text: finalMessage,
        date: new Date().toISOString(),
      };

      // Update storage
      const existingIndex = botData.groups[targetGroupId].standUpLogs.findIndex(
        (log) => log.user === `${userDisplayName} (${userName})`
      );
      
      if (existingIndex !== -1) {
        botData.groups[targetGroupId].standUpLogs[existingIndex] = update;
      } else {
        botData.groups[targetGroupId].standUpLogs.push(update);
      }
      saveData(botData);

      // Export to spreadsheet
      const exported = await exportToGoogleSheets(targetGroupId, [update]);
      if (!exported) {
        await bot.sendMessage(
          chatId,
          formatError("Your update was posted but failed to export to the spreadsheet.")
        );
      } else {
        // Clean up session after successful update
        cleanupUserSession(userId);
        await bot.sendMessage(
          chatId,
          formatSuccess('Your update has been posted to the group chat and exported successfully!')
        );
      }
    } catch (error) {
      console.error('Error posting update:', error);
      await bot.sendMessage(
        chatId,
        formatError('Failed to post the update. Please try again or contact support.')
      );
    }
  }
}

/**
 * Handle individual task input messages
 * Collects what/why for each task
 */
async function handleTaskInput(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  const userData = getUserData(userId);
  if (!userData?.draftUpdate?.state || !userData?.draftUpdate?.collecting) {
    return;
  }

  const section = userData.draftUpdate.state === 'collecting_yesterday' ? 'yesterday' : 'today';
  const collecting = userData.draftUpdate.collecting;
  const tasks = userData.draftUpdate.content[section];

  switch (collecting) {
    case 'what': {
      const inputText = msg.text.trim();

      // Check character limit for "what"
      if (inputText.length > 250) {
        await bot.sendMessage(
          chatId,
          formatError(
            `Your input is too long (${inputText.length} characters). Please keep it under 250 characters. Try again:`
          )
        );
        return;
      }

      // Create a new task object for each "what" input
      userData.draftUpdate.currentTask = {
        what: inputText,
        why: '' // Initialize with empty string
      };
      userData.draftUpdate.collecting = 'why';
      await bot.sendMessage(chatId, prompts.why);
      break;
    }

    case 'why': {
      const inputText = msg.text.trim();
      
      // Ensure we have a currentTask object
      if (!userData.draftUpdate.currentTask) {
        userData.draftUpdate.currentTask = {
          what: '',
          why: ''
        };
      }

      // Check character limit for "why"
      if (inputText.length > 300) {
        await bot.sendMessage(
          chatId,
          formatError(
            `Your input is too long (${inputText.length} characters). Please keep it under 300 characters. Try again:`
          )
        );
        return;
      }

      // Update the why field of the current task
      userData.draftUpdate.currentTask.why = inputText;
      tasks.push({...userData.draftUpdate.currentTask}); // Create a copy of the task
      userData.draftUpdate.currentTask = null;
      userData.draftUpdate.collecting = 'what';

      const preview = formatTaskPreview(tasks, section);


      let promptMessage = preview + '\n\n';
      if (section === 'yesterday') {
        promptMessage += 'Write /today to finish yesterday\'s accomplishments and start today\'s priorities. ' +
                        'Otherwise tell me, what was yesterday\'s accomplishment ' + (tasks.length + 1) + '?';
      } else {
        promptMessage += 'Write /done to finish or what is prio ' + (tasks.length + 1) + '?';
      }

      await bot.sendMessage(chatId, promptMessage);
      break;
    }
  }
}

/**
 * Start the guided update preparation process
 * Walks user through creating their update in private chat
 */
async function startUpdatePreparation(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  if (isGroupChat(msg)) {
    await bot.sendMessage(
      chatId,
      formatError('This command can only be used in private chats with the bot.')
    );
    return;
  }

  const userData = getUserData(userId);
  if (!userData?.targetGroupId) {
    await bot.sendMessage(
      chatId,
      formatError('Please use /setGC first to choose your target group chat.')
    );
    return;
  }

  // Clean up any existing handler before starting new update
  if (userData.messageHandler) {
    bot.removeListener('message', userData.messageHandler);
    userData.messageHandler = null;
  }

  // Initialize new draft
  initializeUpdateDraft(userId);
  
  // Create a new message handler for this session
  const messageHandler = async (message) => {
    if (message.from.id.toString() !== userId || message.chat.id !== chatId) {
      return;
    }
    
    if (message.text?.startsWith('/')) {
      return;
    }
    
    await handleTaskInput(message, bot);
  };
  
  userData.messageHandler = messageHandler;
  bot.on('message', messageHandler);

  await bot.sendMessage(
    chatId,
    prompts.startYesterday,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Stop the update preparation process and cleanup
 */
async function stopUpdatePreparation(msg, bot) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  

  const userData = getUserData(userId);
  if (!userData?.draftUpdate?.state) {
    await bot.sendMessage(
      chatId,
      formatError('No update preparation in progress.')
    );
    return;
  }

  if (userData?.messageHandler) {
    bot.removeListener('message', userData.messageHandler);
    userData.messageHandler = null;
  }

  // Clean up the session
  cleanupUserSession(userId);
  
  await bot.sendMessage(
    chatId,
    formatSuccess('Update preparation cancelled. Use /start to begin a new update.')
  );
}

module.exports = function(bot) {
  // Register commands for private update preparation
  bot.onText(/^\/start/, (msg) => startUpdatePreparation(msg, bot));
  bot.onText(/^\/today/, (msg) => handleTransitionCommand(msg, bot));
  bot.onText(/^\/done/, (msg) => handleTransitionCommand(msg, bot));
  bot.onText(/^\/stop/, (msg) => stopUpdatePreparation(msg, bot));

  return {
    commands: {
      start: {
        command: '/start',
        description: 'Start preparing your standup update privately'
      },
      stop: {
        command: '/stop',
        description: 'Cancel the current update preparation'
      }
    }
  };
};