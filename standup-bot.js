require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

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

// Clear the standup logs for a group
function clearGroupLogs(chatId) {
  if (botData.groups[chatId]) {
    botData.groups[chatId].standUpLogs = [];
    saveData(botData);
  }
}

// Update the initialization functions
function initGroupLogs(chatId, groupName) {
  if (!botData.groups[chatId]) {
    botData.groups[chatId] = {
      standUpLogs: [],
      state: { 
        collecting: false,
        collectionStartTime: null,
        autoCollection: false
      },
      settings: {
        reminderTime: "09:00",
        timezone: 'UTC',
        activeWeekdays: [1, 2, 3, 4, 5],
        isActive: false,
        collectionWindowHours: 5,
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID // Default spreadsheet ID
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
    botData.groups[chatId].state.autoCollection = false;
    botData.groups[chatId].state.collectionStartTime = null;
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

// Add these environment variables to your .env file:
// GOOGLE_PRIVATE_KEY="your-private-key"
// GOOGLE_CLIENT_EMAIL="your-client-email"
// GOOGLE_SPREADSHEET_ID="your-spreadsheet-id"

// Initialize Google Sheets client
function getGoogleSheetsClient() {
  const client = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth: client });
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Export standup logs to Google Sheets
async function exportToGoogleSheets(chatId, logs) {
  try {
    const sheets = getGoogleSheetsClient();
    const date = formatDate(new Date());
    const groupName = botData.groups[chatId].metadata.groupName;
    const spreadsheetId = botData.groups[chatId].settings.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error('No spreadsheet ID configured for this group');
    }

    // Prepare the data rows
    const rows = logs.map(log => [
      date,
      groupName,
      log.user,
      log.text,
      new Date(log.date).toISOString()
    ]);

    // First, check if we need to create a new sheet for this month
    const sheetName = `Standups ${date.substring(0, 10)}`;
    
    try {
      // Try to get the sheet to see if it exists
      await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        ranges: [sheetName],
      });
    } catch (error) {
      // Sheet doesn't exist, create it with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              }
            }
          }]
        }
      });

      // Add headers to the new sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A1:E1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Date', 'Group', 'User', 'Update', 'Timestamp']]
        }
      });
    }

    // Append the data rows
    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:E`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: rows
      }
    });

    return true;
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return false;
  }
}

// Update the exportStandupForGroup function
async function exportStandupForGroup(chatId) {
  const groupData = botData.groups[chatId];
  if (!groupData) return;
  
  console.log(`Exporting standup logs for group ${chatId}:`);
  console.log(groupData.standUpLogs);

  if (groupData.standUpLogs.length > 0) {
    const exported = await exportToGoogleSheets(chatId, groupData.standUpLogs);
    if (exported) {
      bot.sendMessage(chatId, "✅ Standup updates have been exported to the spreadsheet.");
    } else {
      bot.sendMessage(chatId, "❌ There was an error exporting the updates to the spreadsheet.");
    }
  }
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
  // Parse the user's current time and desired reminder time
  const { hours: userCurrentHours, minutes: userCurrentMinutes } = parseTimeString(currentTime);
  const { hours: desiredHours, minutes: desiredMinutes } = parseTimeString(localTime);
  
  // Get the current UTC time
  const now = new Date();
  const currentUTCHours = now.getUTCHours();
  const currentUTCMinutes = now.getUTCMinutes();
  
  // Calculate the user's timezone offset in hours
  let userOffset = userCurrentHours - currentUTCHours;
  
  // Adjust for day boundary cases
  if (userOffset > 12) {
    userOffset -= 24;
  } else if (userOffset < -12) {
    userOffset += 24;
  }
  
  // Convert desired local time to UTC
  let utcHours = desiredHours - userOffset;
  
  // Handle day wrapping
  if (utcHours < 0) {
    utcHours += 24;
  } else if (utcHours >= 24) {
    utcHours -= 24;
  }
  
  return {
    hours: utcHours,
    minutes: desiredMinutes
  };
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
            
            // Determine AM/PM for UTC time
            const utcPeriod = utcTime.hours >= 12 ? 'PM' : 'AM';
            const utcDisplayHours = utcTime.hours % 12 || 12;
            
            // Update the success message with AM/PM
            bot.sendMessage(chatId, 
              `✅ Reminder set successfully!\n` +
              `Your local time: ${reminderTime}\n` +
              `UTC time: ${utcDisplayHours.toString().padStart(2, '0')}:${utcTime.minutes.toString().padStart(2, '0')} ${utcPeriod}\n` +
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

// Update the cron job with error handling
cron.schedule('* * * * 1-5', () => {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  Object.entries(botData.groups).forEach(async ([chatId, groupData]) => {
    if (groupData.settings.isActive) {
      const [reminderHours, reminderMinutes] = groupData.settings.reminderTime.split(':').map(Number);
      
      if (utcHours === reminderHours && utcMinutes === reminderMinutes) {
        try {
          // Verify the bot can still message this group
          await bot.getChat(chatId);
          
          // Automatically start collection
          botData.groups[chatId].state.collecting = true;
          botData.groups[chatId].state.collectionStartTime = now.toISOString();
          botData.groups[chatId].state.autoCollection = true;
          saveData(botData);
          
          await bot.sendMessage(chatId, 
            "🕐 Good morning! It's standup time!\n\n" +
            "Please share your updates in the following format:\n" +
            "Yesterday: \nToday: \nBlockers: \n\n" +
            `Updates will be collected for the next ${groupData.settings.collectionWindowHours} hours.`
          );
        } catch (error) {
          console.log(`Failed to send message to group ${chatId}:`, error.message);
          // Remove the group from botData if we can't message it anymore
          if (error.message.includes('PEER_ID_INVALID') || error.message.includes('bot was blocked')) {
            delete botData.groups[chatId];
            saveData(botData);
          }
        }
      }
      
      // Check if we need to end collection
      if (groupData.state.autoCollection && groupData.state.collectionStartTime) {
        const startTime = new Date(groupData.state.collectionStartTime);
        const elapsedHours = (now - startTime) / (1000 * 60 * 60);
        
        if (elapsedHours >= groupData.settings.collectionWindowHours) {
          try {
            // End collection and export results
            botData.groups[chatId].state.collecting = false;
            botData.groups[chatId].state.autoCollection = false;
            botData.groups[chatId].state.collectionStartTime = null;
            saveData(botData);
            
            // Export standup and notify group
            await exportStandupForGroup(chatId);
            await bot.sendMessage(chatId, 
              "⏰ Standup collection window has ended.\n" +
              "Thank you for your updates! Here's a summary:"
            );
            
            // Show final standup summary
            const groupData = botData.groups[chatId];
            if (groupData && groupData.standUpLogs.length > 0) {
              let response = "📝 Final Standup Summary:\n\n";
              groupData.standUpLogs.forEach((item, idx) => {
                response += `${idx + 1}. @${item.user}:\n${item.text}\n\n`;
              });
              await bot.sendMessage(chatId, response);
            }
            clearGroupLogs(chatId);
          } catch (error) {
            console.log(`Failed to send end message to group ${chatId}:`, error.message);
            // Remove the group if we can't message it anymore
            if (error.message.includes('PEER_ID_INVALID') || error.message.includes('bot was blocked')) {
              delete botData.groups[chatId];
              saveData(botData);
            }
          }
        }
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
    
    `*Export Settings:*\n` +
    `• /setSpreadsheet <id> - Set custom Google Spreadsheet ID (admin only)\n\n` +
    
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

// Add new command to set spreadsheet ID
bot.onText(/\/setSpreadsheet (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  // Check if user is admin
  bot.getChatMember(chatId, msg.from.id).then((chatMember) => {
    if (['creator', 'administrator'].includes(chatMember.status)) {
      const newSpreadsheetId = match[1].trim();
      
      // Validate spreadsheet ID format (basic validation)
      if (!/^[a-zA-Z0-9-_]+$/.test(newSpreadsheetId)) {
        return bot.sendMessage(chatId, "❌ Invalid spreadsheet ID format. Please provide a valid Google Spreadsheet ID.");
      }
      
      // Initialize group if needed
      initGroupLogs(chatId);
      
      // Update spreadsheet ID
      botData.groups[chatId].settings.spreadsheetId = newSpreadsheetId;
      saveData(botData);
      
      bot.sendMessage(chatId, 
        "✅ Spreadsheet ID updated successfully!\n\n" +
        "Make sure to share the spreadsheet with the service account email:\n" +
        `${process.env.GOOGLE_CLIENT_EMAIL}`
      );
    } else {
      bot.sendMessage(chatId, "❌ Only group administrators can change the spreadsheet ID.");
    }
  }).catch(error => {
    console.error('Error checking admin status:', error);
    bot.sendMessage(chatId, "❌ Error checking permissions. Please try again later.");
  });
});
