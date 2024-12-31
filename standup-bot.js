require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.get('/', (req, res) => {
  res.send("Bot is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express running on ${PORT}`);
});

function loadData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return default structure
    return { groups: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(
      path.join(__dirname, 'data.json'),
      JSON.stringify(data, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Replace the in-memory storage with file-based storage
let botData = loadData();

// Update the initialization functions
function initGroupLogs(chatId, groupName) {
  if (!botData.groups[chatId]) {
    botData.groups[chatId] = {
      standUpLogs: [],
      state: { collecting: false },
      settings: {
        reminderTime: "09:00",
        timezone: 'UTC',
        activeWeekdays: [1, 2, 3, 4, 5], // Monday to Friday
        isActive: false
      },
      metadata: {
        groupName: groupName ?? '',
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }
    };
    saveData(botData);
  }
}

// ----- Commands -----
bot.onText(/\/startStandup/, (msg) => {
  const chatId = msg.chat.id;

  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    
    botData.groups[chatId].standUpLogs = [];
    botData.groups[chatId].state.collecting = true;
    saveData(botData);
    
    bot.sendMessage(chatId, "🎯 Standup started! Please share your updates now.\n\nFormat suggestion:\nYesterday: \nToday: \nBlockers: ");
  }
});

bot.onText(/\/endStandup/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (botData.groups[chatId]) {
      botData.groups[chatId].state.collecting = false;
      saveData(botData);
    }
    exportStandupForGroup(chatId);
    bot.sendMessage(chatId, "Standup ended. Thanks for participating!");
  }
});

// Example command to see current updates
bot.onText(/\/showStandup/, (msg) => {
  const chatId = msg.chat.id;
  const groupData = botData.groups[chatId];
  
  if (groupData && groupData.standUpLogs.length > 0) {
    let response = "Current standup logs:\n\n";
    
    groupData.standUpLogs.forEach((item, idx) => {
      response += `${idx + 1}. @${item.user}:\n${item.text}\n\n`;
    });
    
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, "No standup logs yet.");
  }
});

// ----- Message Listener -----
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    
    // Update group metadata
    botData.groups[chatId].metadata.groupName = msg.chat.title;
    botData.groups[chatId].metadata.lastActivity = new Date().toISOString();
    
    if (msg.text && 
        botData.groups[chatId].state.collecting && 
        !msg.text.startsWith('/')) {
      
      const userName = msg.from.username 
        ? msg.from.username 
        : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      
      const update = {
        user: userName,
        text: msg.text,
        date: new Date().toISOString(),
      };
      
      // Find if user already has an update
      const existingUpdateIndex = botData.groups[chatId].standUpLogs.findIndex(
        log => log.user === userName
      );
      
      if (existingUpdateIndex !== -1) {
        // Replace existing update
        botData.groups[chatId].standUpLogs[existingUpdateIndex] = update;
        bot.sendMessage(chatId, `✏️ @${userName}'s update has been updated.`);
      } else {
        // Add new update
        botData.groups[chatId].standUpLogs.push(update);
        bot.sendMessage(chatId, `✅ @${userName}'s update has been recorded.`);
      }
      
      saveData(botData);
    }
  }
});

// ----- Example: Global 09:00 reminder for all active groups -----
// cron.schedule('39 18 * * 1-5', () => {
//   console.log('Sending reminders to groups at 5:30 PM');
  
//   Object.entries(botData.groups).forEach(([chatId, groupData]) => {
//     if (groupData.settings.isActive) {
//       bot.sendMessage(chatId, "It's 5:30 PM! Type /startStandup to begin today's standup.");
//     }
//   });
// });

function exportStandupForGroup(chatId) {
  const groupData = botData.groups[chatId];
  if (!groupData) return;
  
  console.log(`Exporting standup logs for group ${chatId}:`);
  console.log(groupData.standUpLogs);
  
  groupData.standUpLogs = [];
  saveData(botData);
}

function parseTimeString(timeStr) {
  // Convert "2:55 pm" or "10:25 am" format to 24h format
  const [time, period] = timeStr.toLowerCase().split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }
  // Check if hours or minutes is NaN
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error('Invalid time format: 2:55 pm or 10:25 am');
  }
  return { hours, minutes };
}

function convertToUTC(localTime, currentTime) {
  // Get the time difference between local and UTC
  const localDate = new Date();
  const { hours: nowHours, minutes: nowMinutes } = parseTimeString(currentTime);
  localDate.setHours(nowHours, nowMinutes, 0, 0);
  
  const utcHours = localDate.getUTCHours();
  const difference = nowHours - utcHours;
  
  // Convert reminder time to UTC
  const { hours: reminderHours, minutes: reminderMinutes } = parseTimeString(localTime);
  let utcReminderHours = reminderHours - difference;
  
  // Adjust for day wrap
  if (utcReminderHours < 0) {
    utcReminderHours += 24;
  } else if (utcReminderHours >= 24) {
    utcReminderHours -= 24;
  }
  
  return { hours: utcReminderHours, minutes: reminderMinutes };
}

// Add the new command
bot.onText(/\/setReminder/, (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    
    bot.sendMessage(chatId, 
      "Please provide your current time and desired reminder time in this format:\n" +
      "Now: 2:55 pm\n" +
      "Set: 10:25 am"
    );
    
    // Set up a one-time listener for the next message
    const listener = (response) => {
      if (response.chat.id === chatId) {
        const lines = response.text.split('\n');
        if (lines.length === 2) {
          try {
            const currentTime = lines[0].split(': ')[1];
            const reminderTime = lines[1].split(': ')[1];
            const utcTime = convertToUTC(reminderTime, currentTime);
            
            // Update the group settings
            botData.groups[chatId].settings.reminderTime = 
              `${utcTime.hours.toString().padStart(2, '0')}:${utcTime.minutes.toString().padStart(2, '0')}`;
            // Enable reminders when setting a time
            botData.groups[chatId].settings.isActive = true;
            saveData(botData);
            
            // Update the cron schedule
            bot.sendMessage(chatId, 
              `✅ Reminder set successfully!\n` +
              `Your local time: ${reminderTime}\n` +
              `UTC time: ${botData.groups[chatId].settings.reminderTime}\n` +
              `Status: Reminders are now active`
            );
          } catch (error) {
            console.error('Error setting reminder:', error);
            bot.sendMessage(chatId, "❌ Invalid time format. Please use the format shown in the example.");
          }
        } else {
          bot.sendMessage(chatId, "❌ Invalid format. Please provide both current time and reminder time.");
        }
        
        // Remove the listener
        bot.removeListener('message', listener);
      }
    };
    
    bot.on('message', listener);
  }
});

// Also add a command to toggle reminders on/off
bot.onText(/\/toggleReminder/, (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    const groupData = botData.groups[chatId];
    
    if (!groupData || !groupData.settings.reminderTime) {
      return bot.sendMessage(
        chatId,
        "⚠️ Please set up a reminder time first using /setReminder"
      );
    }
    
    // Toggle the active state
    groupData.settings.isActive = !groupData.settings.isActive;
    saveData(botData);
    
    bot.sendMessage(
      chatId,
      `Reminders are now ${groupData.settings.isActive ? '✅ Active' : '❌ Inactive'}\n` +
      `Current reminder time: ${groupData.settings.reminderTime} UTC`
    );
  }
});

// Update the cron job to use group-specific times
cron.schedule('* * * * 1-5', () => {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  Object.entries(botData.groups).forEach(([chatId, groupData]) => {
    if (groupData.settings.isActive) {
      const [reminderHours, reminderMinutes] = groupData.settings.reminderTime.split(':').map(Number);
      
      if (utcHours === reminderHours && utcMinutes === reminderMinutes) {
        bot.sendMessage(chatId, "🕐 It's standup time! Type /startStandup to begin today's standup.");
      }
    }
  });
});

// Add this new command after other commands
bot.onText(/\/showReminder/, (msg) => {
  const chatId = msg.chat.id;

  if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    const groupData = botData.groups[chatId];

    if (!groupData) {
      return bot.sendMessage(
        chatId,
        "⚠️ No settings found for this group. Use /setReminder to set up a standup reminder."
      );
    }

    const { reminderTime, isActive } = groupData.settings;
    if (!reminderTime) {
      return bot.sendMessage(
        chatId,
        "⚠️ No reminder time found for this group. Use /setReminder to set up a standup reminder."
      );
    }
    const [hours, minutes] = reminderTime.split(":").map(Number);

    // Convert UTC back to an example local time (using the same offset logic)
    const now = new Date();
    const localHours = now.getHours();
    const utcHours = now.getUTCHours();
    const difference = localHours - utcHours;

    let localReminderHours = hours + difference;

    // Adjust for day wrap
    if (localReminderHours < 0) {
      localReminderHours += 24;
    } else if (localReminderHours >= 24) {
      localReminderHours -= 24;
    }

    const period = localReminderHours >= 12 ? "PM" : "AM";
    const displayHours =
      localReminderHours > 12
        ? localReminderHours - 12
        : localReminderHours === 0
        ? 12
        : localReminderHours;

    const message =
      `📅 Standup Reminder Settings\n\n` +
      `Status: ${isActive ? "✅ Active" : "❌ Inactive"}\n` +
      `Time: ${displayHours}:${minutes
        .toString()
        .padStart(2, "0")} ${period}\n` +
      `UTC Time: ${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}\n\n` +
      `Use /setReminder to change the time.`;

    bot.sendMessage(chatId, message);
  }
});

// Add this function to store the help content
function getHelpContent(isWelcome = false) {
  const welcomeText = isWelcome 
    ? `👋 *Thanks for adding me to the group!*\n\nI'll help you manage your daily standups.\n\n`
    : `🤖 *Standup Bot Commands*\n\n`;

  const importantNote = `⚠️ *IMPORTANT:*\nRemember to make the bot *ADMIN* with permissions to ensure all features work properly.\n\n`;
    
  return welcomeText +
    importantNote +
    `*Basic Commands:*\n` +
    `• /startStandup - Start collecting standup updates\n` +
    `• /endStandup - End standup and clear updates\n` +
    `• /showStandup - Show all current standup updates\n\n` +
    
    `*Reminder Settings:*\n` +
    `• /setReminder - Set daily standup reminder time\n` +
    `• /showReminder - Show current reminder settings\n` +
    `• /toggleReminder - Turn reminders on/off\n\n` +
    
    `*Format for Updates:*\n` +
    `When standup is started, simply type your update like:\n` +
    `Yesterday: Completed feature X\n` +
    `Today: Working on feature Y\n` +
    `Blockers: None\n\n` +
    
    `*Notes:*\n` +
    `• Updates can be edited by sending a new message\n` +
    `• Only the latest update from each person is kept\n` +
    `• Reminders only work on weekdays (Mon-Fri)\n` +
    `• All times are converted to UTC internally` +
    (isWelcome ? '\n\nType /help anytime to see this message again.' : '');
}

// Update the help command to use the new function
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, getHelpContent(false), { parse_mode: 'Markdown' });
});

// Update the new chat members handler to use the new function
bot.on('new_chat_members', (msg) => {
    const chatId = msg.chat.id;
    
  if (true) {
    initGroupLogs(chatId);
    bot.sendMessage(chatId, getHelpContent(true), { parse_mode: 'Markdown' });
  }
});
