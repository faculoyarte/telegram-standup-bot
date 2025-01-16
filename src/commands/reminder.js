// src/commands/reminder.js
const { botData, saveData, initGroupLogs } = require('../storage');
const { 
  parseTimeString,
  convertToUTC,
  formatTime,
  formatError,
  formatSuccess,
  isGroupChat
} = require('../utils');

/**
 * Set reminder handler
 */
function setReminder(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  initGroupLogs(chatId);

  bot.sendMessage(
    chatId,
    "Please provide current time and desired reminder time in this format:\n" +
    "```\nNow: 2:55 pm\nSet: 10:25 am\n```\n(Then press Enter)",
    { parse_mode: 'Markdown' }
  );

  const reminderListener = (response) => {
    if (response.chat.id === chatId) {
      const lines = response.text.split('\n');
      if (lines.length === 2) {
        try {
          const currentTime = lines[0].split(': ')[1];
          const reminderTime = lines[1].split(': ')[1];
          const utcTime = convertToUTC(reminderTime, currentTime);

          botData.groups[chatId].settings.reminderTime = 
            `${String(utcTime.hours).padStart(2, '0')}:${String(utcTime.minutes).padStart(2, '0')}`;
          botData.groups[chatId].settings.isActive = true;
          saveData(botData);

          const utcPeriod = utcTime.hours >= 12 ? 'PM' : 'AM';
          const utcDisplayHours = utcTime.hours % 12 || 12;

          bot.sendMessage(
            chatId,
            formatSuccess(
              `Reminder set!\n` +
              `• Your local time: ${reminderTime}\n` +
              `• UTC time: ${utcDisplayHours.toString().padStart(2, '0')}:${String(utcTime.minutes).padStart(2, '0')} ${utcPeriod}\n` +
              `• Status: Reminders are now active`
            )
          );
        } catch (error) {
          console.error('Error setting reminder:', error);
          bot.sendMessage(chatId, formatError("Invalid time format. Please try again with the example format."));
        }
      } else {
        bot.sendMessage(chatId, formatError("Invalid input. Please provide 2 lines as shown in the example."));
      }
      bot.removeListener('message', reminderListener);
    }
  };
  bot.on('message', reminderListener);
}

/**
 * Toggle reminder handler
 */
function toggleReminder(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  const groupData = botData.groups[chatId];
  if (!groupData || !groupData.settings.reminderTime) {
    return bot.sendMessage(
      chatId,
      formatError("Please set up a reminder time first using `/setReminder`.")
    );
  }

  groupData.settings.isActive = !groupData.settings.isActive;
  saveData(botData);

  bot.sendMessage(
    chatId,
    formatSuccess(
      `Reminders are now ${groupData.settings.isActive ? '✅ Active' : '❌ Inactive'}\n` +
      `Current reminder time: ${groupData.settings.reminderTime} UTC`
    )
  );
}

/**
 * Show reminder handler
 */
function showReminder(bot, msg) {
  const chatId = msg.chat.id;
  if (!isGroupChat(msg)) return;

  const groupData = botData.groups[chatId];
  if (!groupData) {
    return bot.sendMessage(
      chatId,
      formatError("No settings found for this group. Use `/setReminder` to set up a standup reminder.")
    );
  }

  const { reminderTime, isActive } = groupData.settings;
  if (!reminderTime) {
    return bot.sendMessage(
      chatId,
      formatError("No reminder time found for this group. Use `/setReminder` to set one.")
    );
  }

  // Convert UTC to local estimate
  const now = new Date();
  const localHours = now.getHours();
  const utcHours = now.getUTCHours();
  const difference = localHours - utcHours;

  const [rHours, rMinutes] = reminderTime.split(":").map(Number);
  let localReminderHours = rHours + difference;
  if (localReminderHours < 0) localReminderHours += 24;
  if (localReminderHours >= 24) localReminderHours -= 24;

  const period = localReminderHours >= 12 ? "PM" : "AM";
  const displayHours = localReminderHours % 12 || 12;

  bot.sendMessage(
    chatId,
    `📅 Standup Reminder Settings\n\n` +
    `Status: ${isActive ? "✅ Active" : "❌ Inactive"}\n` +
    `Time: ${displayHours}:${String(rMinutes).padStart(2, "0")} ${period}\n` +
    `UTC Time: ${reminderTime}\n\n` +
    "Use `/setReminder` to change this time."
  );
}

module.exports = function(bot) {
  bot.onText(/^\/setReminder/, (msg) => setReminder(bot, msg));
  bot.onText(/^\/toggleReminder/, (msg) => toggleReminder(bot, msg));
  bot.onText(/^\/showReminder/, (msg) => showReminder(bot, msg));
};