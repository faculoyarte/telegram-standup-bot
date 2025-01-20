// src/cronJobs.js
const cron = require('node-cron');
const { bot } = require('./bot');
const { botData, saveData } = require('./storage');
const { formatError } = require('./utils');

/**
 * Get a missing updates message for a group
 */
function getMissingUpdatesMessage(chatId) {
  const groupData = botData.groups[chatId];
  if (!groupData) return null;

  const today = new Date().toISOString().split('T')[0];
  const updatedUsers = groupData.standUpLogs
    .filter((log) => log.date.startsWith(today))
    .map((log) => log.user);

  // Flatten all categories
  const expectedMembers = Object.values(groupData.memberCategories || {}).flat();
  const missing = expectedMembers.filter((m) => !updatedUsers.includes(m));

  if (!missing.length) return null;

  let message = "⚠️ *Missing Standup Updates*\n\n";
  message += "The following members haven't submitted updates yet:\n";
  missing.forEach((m) => {
    message += `• @${m}\n`;
  });
  message += `\nUse /myUpdate to submit your standup.`;
  return message;
}

/**
 * Initialize cron jobs
 */
function initCronJobs() {
  // Check every minute (you may want to adjust this in production)
  cron.schedule('* * * * 1-5', () => {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();

    Object.entries(botData.groups).forEach(async ([chatId, groupData]) => {
      if (!groupData.settings.isActive) return;

      const [reminderH, reminderM] = groupData.settings.reminderTime.split(':').map(Number);

      // Initial reminder
      if (utcHours === reminderH && utcMinutes === reminderM) {
        try {
          await bot.getChat(chatId);

          groupData.lastReminderTime = new Date().toISOString();
          saveData(botData);

          const isMonday = now.getDay() === 1;
          const messageTemplate = isMonday ?
            "🕐 Good morning! It's standup time.\n\n" +
            "Share your update using `/myUpdate`:\n" +
            "`/myUpdate\nFriday: <stuff>\nWeekend: <stuff>\nToday: <stuff>\nBlockers: <stuff>`"
            :
            "🕐 Good morning! It's standup time.\n\n" +
            "Share your update using `/myUpdate`:\n" +
            "`/myUpdate Yesterday: <stuff>\nToday: <stuff>\nBlockers: <stuff>`";

          await bot.sendMessage(chatId, messageTemplate);
        } catch (error) {
          console.log(`Failed to send reminder to group ${chatId}:`, error.message);
          // Remove invalid/blocked groups
          if (error.message.includes('PEER_ID_INVALID') || 
              error.message.includes('bot was blocked')) {
            delete botData.groups[chatId];
            saveData(botData);
          }
        }
      }

      // Follow-up reminder after ~1 hour
      const lastReminderTime = new Date(groupData.lastReminderTime || 0);
      const timeSinceReminder = now - lastReminderTime;
      
      if (timeSinceReminder >= 3600000 && timeSinceReminder < 3660000) {
        try {
          const missingMessage = getMissingUpdatesMessage(chatId);
          if (missingMessage) {
            await bot.sendMessage(chatId, missingMessage, { parse_mode: 'Markdown' });
          }
        } catch (error) {
          console.log(`Failed follow-up in group ${chatId}:`, error.message);
        }
      }
    });
  });
}

module.exports = {
  initCronJobs,
  getMissingUpdatesMessage // Exported for testing or direct use
};