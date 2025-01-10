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
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
      },
      metadata: {
        groupName: groupName ?? '',
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      },
      memberCategories: {}
    };
    saveData(botData);
  }
}

// ----- Commands -----
const shareUpdate = async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    
    const userName = msg.from.username 
      ? msg.from.username 
      : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
    
    // Check if there's text after the command
    const updateText = match[1]?.trim();
    console.log({ updateText, match });
    if (!updateText) {
      return bot.sendMessage(chatId, 
        "Please provide your update with the command. Example:\n\n" +
        "(/myUpdate or /up) Yesterday: Worked on feature X\n" +
        "Today: Planning to implement Y\n" +
        "Blockers: None"
      );
    }

    const update = {
      user: userName,
      text: updateText,
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

    // Export the update immediately
    const exported = await exportToGoogleSheets(chatId, [update]);
    if (!exported) {
      bot.sendMessage(chatId, "❌ There was an error exporting your update to the spreadsheet.");
    }
  }
}

bot.onText(/^\/myupdate([\s\S]+)?/, async (msg, match) => {
  shareUpdate(msg, match);
});
bot.onText(/^\/myUpdate([\s\S]+)?/, async (msg, match) => {
  shareUpdate(msg, match);
});
bot.onText(/^\/UP([\s\S]+)?/, async (msg, match) => {
  shareUpdate(msg, match);
});
bot.onText(/^\/up([\s\S]+)?/, async (msg, match) => {
  shareUpdate(msg, match);
});

// Modify the message listener to ignore non-command messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    
    // Update group metadata
    botData.groups[chatId].metadata.groupName = msg.chat.title;
    botData.groups[chatId].metadata.lastActivity = new Date().toISOString();
  }
});

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

// Get week number and date range for a given date
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  // Get to Monday of this week
  const monday = new Date(d);
  monday.setDate(d.getDate() - (d.getDay() || 7) + 1);
  
  // Get to Friday of this week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  // Format dates as MM/DD
  const formatMonthDay = (date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };
  
  // Calculate week number
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  // Return format: "2024-W12 MM/DD-MM/DD"
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')} ${formatMonthDay(monday)}-${formatMonthDay(friday)}`;
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

    // Get the latest update
    const log = logs[logs.length - 1];
    
    // Find all categories for the user
    let userCategories = [];
    Object.entries(botData.groups[chatId].memberCategories || {}).forEach(([category, members]) => {
      if (members.includes(log.user)) {
        userCategories.push(category);
      }
    });
    
    // Join categories with comma or use 'Uncategorized' if none found
    const categoryString = userCategories.length > 0 
      ? userCategories.join(', ') 
      : 'Uncategorized';

    const newRow = [
      chatId.toString(),
      groupName,
      log.user,
      categoryString,
      log.text,
      formatDate(new Date(log.date))
    ];

    // Use week number for sheet name (YYYY-Wxx)
    const sheetName = `Standups ${getWeekNumber(date)}`;
    
    try {
      await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        ranges: [sheetName],
      });
    } catch (error) {
      // Sheet doesn't exist, create it with headers
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
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

      // Add headers with new category column
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A1:F1`,
        valueInputOption: 'RAW',
        resource: {
          values: [['Group ID', 'Group Name', 'User', 'Category', 'Update', 'Date']]
        }
      });
    }

    // Get all values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:F`,
    });

    const values = response.data.values || [];
    
    // Find if there's an existing row for this group and user for today
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] === chatId.toString() && 
          row[2] === log.user && 
          row[5] === formatDate(new Date(log.date))) {
        rowIndex = i + 1; // +1 because sheets are 1-based
        break;
      }
    }

    if (rowIndex !== -1) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A${rowIndex}:F${rowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [newRow]
        }
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow]
        }
      });
    }

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
bot.onText(/^\/setReminder/, (msg) => {
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
bot.onText(/^\/toggleReminder/, (msg) => {
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


// Add this new command after other commands
bot.onText(/^\/showReminder/, (msg) => {
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
    `*Update Commands:*\n` +
    `• /myUpdate or /up - Share your standup update\n` +
    `• /showStandup - Show all current standup updates\n` +
    `• /missing - Show who hasn't sent updates yet\n\n` +
    
    `*Reminder Settings:*\n` +
    `• /setReminder - Set daily standup reminder time\n` +
    `• /showReminder - Show current reminder settings\n` +
    `• /toggleReminder - Turn reminders on/off\n\n` +
    
    `*Member Management:*\n` +
    `• /manageMembers - Show and manage expected members\n` +
    `• /addMember <username> - Add member to expected list\n` +
    `• /removeMember <username> - Remove member from expected list\n\n` +
    
    `*Export Settings:*\n` +
    `• /setSpreadsheet <id> - Set custom Google Spreadsheet ID (admin only)\n\n` +
    
    `*Format for Updates:*\n` +
    `Use the /myUpdate command with your update like:\n` +
    `/myUpdate Yesterday: Completed feature X\n` +
    `Today: Working on feature Y\n` +
    `Blockers: None\n\n` +
    
    `*Notes:*\n` +
    `• Updates can be edited by sending a new /myUpdate\n` +
    `• Only the latest update from each person is kept\n` +
    `• Reminders only work on weekdays (Mon-Fri)\n` +
    `• All times are converted to UTC internally` +
    (isWelcome ? '\n\nType /help anytime to see this message again.' : '');
}

// Update the help command to use the new function
bot.onText(/^\/help/, (msg) => {
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
bot.onText(/^\/setSpreadsheet (.+)/, (msg, match) => {
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

// Add this function after the other helper functions
function getMissingUpdatesMessage(chatId) {
  const groupData = botData.groups[chatId];
  if (!groupData) return null;

  // Get all chat members who submitted updates today
  const today = new Date().toISOString().split('T')[0];
  const updatedUsers = groupData.standUpLogs
    .filter(log => log.date.startsWith(today))
    .map(log => log.user);

  // Get list of expected members (we'll store this in the group data)
  const expectedMembers = groupData.expectedMembers || [];
  
  // Find members who haven't submitted updates
  const missingMembers = expectedMembers.filter(member => !updatedUsers.includes(member));

  if (missingMembers.length === 0) return null;

  return `⚠️ *Missing Standup Updates*\n\n` +
    `The following team members haven't submitted their updates yet:\n` +
    missingMembers.map(member => `• @${member}`).join('\n') +
    `\n\nPlease use /myUpdate to submit your standup update.`;
}

// Modify the cron job to schedule the follow-up message
cron.schedule('* * * * 1-5', () => {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  Object.entries(botData.groups).forEach(async ([chatId, groupData]) => {
    if (groupData.settings.isActive) {
      const [reminderHours, reminderMinutes] = groupData.settings.reminderTime.split(':').map(Number);
      
      // Check for initial reminder time
      if (utcHours === reminderHours && utcMinutes === reminderMinutes) {
        try {
          await bot.getChat(chatId);
          
          // Store the reminder time for follow-up
          groupData.lastReminderTime = new Date().toISOString();
          saveData(botData);
          
          await bot.sendMessage(chatId, 
            "🕐 Good morning! It's standup time!\n\n" +
            "Share your update using the /myUpdate command:\n\n" +
            "/myUpdate Yesterday: <your update>\n" +
            "Today: <your update>\n" +
            "Blockers: <any blockers>"
          );
        } catch (error) {
          console.log(`Failed to send message to group ${chatId}:`, error.message);
          if (error.message.includes('PEER_ID_INVALID') || error.message.includes('bot was blocked')) {
            delete botData.groups[chatId];
            saveData(botData);
          }
        }
      }
      
      // Check for follow-up reminder (1 hour later)
      const lastReminderTime = new Date(groupData.lastReminderTime || 0);
      const timeSinceReminder = now - lastReminderTime;
      
      // If it's been 1 hour (with a small buffer for the cron interval)
      if (timeSinceReminder >= 3600000 && timeSinceReminder < 3660000) {
        try {
          const message = getMissingUpdatesMessage(chatId);
          if (message) {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          }
        } catch (error) {
          console.log(`Failed to send follow-up message to group ${chatId}:`, error.message);
        }
      }
    }
  });
});

// Add command to manage expected members list
bot.onText(/^\/manageMembers/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("manageMembers command received");
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    console.log("manageMembers command received 2");
    try {
      const chatMember = await bot.getChatMember(chatId, msg.from.id);
      if (!['creator', 'administrator'].includes(chatMember.status)) {
        return bot.sendMessage(chatId, "❌ Only administrators can manage expected members.");
      }

      initGroupLogs(chatId);
      
      const categories = botData.groups[chatId].memberCategories || {};
      
      // Helper function to escape special characters for MarkdownV2
      const escapeMarkdown = (text) => {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      };

      let message = "*Team Members by Category*\n\n";
      
      if (Object.keys(categories).length === 0) {
        message += "No members set in any category\n";
      } else {
        Object.entries(categories).forEach(([category, members]) => {
          message += `*${escapeMarkdown(category)}*:\n`;
          if (members.length === 0) {
            message += "• No members\n";
          } else {
            members.forEach(member => {
              message += `• @${escapeMarkdown(member)}\n`;
            });
          }
          message += "\n";
        });
      }
      
      message += "To add/remove members, use:\n" +
        `\`/addMember \\[category\\] \\[username1\\], \\[username2\\], \\.\\.\\.\\]\`\n` +
        `\`/removeMember \\[username1\\], \\[username2\\], \\.\\.\\.\\]\`\n\n` +
        `Example: \`/addMember developer john\\_doe\``;
      
      bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in manageMembers:', error);
      bot.sendMessage(chatId, "❌ Error managing members. Please try again later.");
    }
  }
});

// Update the addMember command to properly handle multiple members
bot.onText(/^\/addMember (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    try {
      const chatMember = await bot.getChatMember(chatId, msg.from.id);
      if (!['creator', 'administrator'].includes(chatMember.status)) {
        return bot.sendMessage(chatId, "❌ Only administrators can manage expected members.");
      }

      // Parse input to handle quoted category names and multiple usernames
      let category, usernameParts;
      
      if (input.startsWith('"')) {
        // Find the closing quote
        const closingQuoteIndex = input.indexOf('"', 1);
        if (closingQuoteIndex === -1) {
          return bot.sendMessage(chatId, 
            "❌ Invalid format. If using spaces in category name, wrap it in quotes.\n" +
            'Example: /addMember "Sales Data" john_doe, jane_smith, bob_jones'
          );
        }
        category = input.slice(1, closingQuoteIndex);
        usernameParts = input.slice(closingQuoteIndex + 1).trim();
      } else {
        // No quotes, split by first space to separate category and usernames
        const parts = input.split(/\s+(.+)/);
        if (parts.length < 2) {
          return bot.sendMessage(chatId, 
            "❌ Please provide category and usernames.\n" +
            "Format: /addMember [category] [username1], [username2], ...\n" +
            "For categories with spaces use: /addMember \"Category Name\" username1, username2, username3"
          );
        }
        category = parts[0];
        usernameParts = parts[1];
      }

      // Process the usernames part - split by commas and clean up
      const usernames = usernameParts
        .split(',')
        .map(username => username.trim().replace('@', ''))
        .filter(username => username.length > 0);

      if (usernames.length === 0) {
        return bot.sendMessage(chatId, "❌ No valid usernames provided.");
      }

      initGroupLogs(chatId);
      if (!botData.groups[chatId].memberCategories) {
        botData.groups[chatId].memberCategories = {};
      }
      
      // Initialize category if it doesn't exist
      const categoryLower = category.toLowerCase();
      if (!botData.groups[chatId].memberCategories[categoryLower]) {
        botData.groups[chatId].memberCategories[categoryLower] = [];
      }
      
      // Process each username
      const results = {
        added: [],
        alreadyInCategory: []
      };

      usernames.forEach(username => {
        if (botData.groups[chatId].memberCategories[categoryLower].includes(username)) {
          results.alreadyInCategory.push(username);
        } else {
          botData.groups[chatId].memberCategories[categoryLower].push(username);
          results.added.push(username);
        }
      });

      saveData(botData);
      
      // Prepare response message
      let message = '';
      if (results.added.length > 0) {
        message += `✅ Added to '${category}':\n${results.added.map(u => `@${u}`).join('\n')}\n\n`;
      }
      if (results.alreadyInCategory.length > 0) {
        message += `⚠️ Already in '${category}':\n${results.alreadyInCategory
          .map(username => `@${username}`)
          .join('\n')}`;
      }
      
      bot.sendMessage(chatId, message || "❌ No members were added.");
    } catch (error) {
      console.error('Error in addMember:', error);
      bot.sendMessage(chatId, "❌ Error adding members. Please try again later.");
    }
  }
});

// Update the removeMember command to clean up empty categories
bot.onText(/^\/removeMember (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1].trim();
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    try {
      const chatMember = await bot.getChatMember(chatId, msg.from.id);
      if (!['creator', 'administrator'].includes(chatMember.status)) {
        return bot.sendMessage(chatId, "❌ Only administrators can manage expected members.");
      }

      // Process the usernames
      const usernames = input
        .split(',')
        .map(username => username.trim().replace('@', ''))
        .filter(username => username.length > 0);

      if (usernames.length === 0) {
        return bot.sendMessage(chatId, 
          "❌ Please provide usernames to remove.\n" +
          "Format: /removeMember username1, username2, ...\n" +
          "Example: /removeMember john_doe, jane_smith"
        );
      }

      initGroupLogs(chatId);
      
      // Process each username
      const results = {
        removed: [],
        notFound: [],
        emptyCategoriesRemoved: []
      };

      usernames.forEach(username => {
        let found = false;
        Object.entries(botData.groups[chatId].memberCategories || {}).forEach(([category, members]) => {
          const index = members.indexOf(username);
          if (index !== -1) {
            botData.groups[chatId].memberCategories[category].splice(index, 1);
            results.removed.push({ username, category });
            found = true;
          }
        });
        
        if (!found) {
          results.notFound.push(username);
        }
      });
      
      // Clean up empty categories
      Object.entries(botData.groups[chatId].memberCategories).forEach(([category, members]) => {
        if (members.length === 0) {
          delete botData.groups[chatId].memberCategories[category];
          results.emptyCategoriesRemoved.push(category);
        }
      });
      
      if (results.removed.length > 0 || results.emptyCategoriesRemoved.length > 0) {
        saveData(botData);
      }
      
      // Prepare response message
      let message = '';
      if (results.removed.length > 0) {
        message += `✅ Removed:\n${results.removed
          .map(item => `@${item.username} (from '${item.category}')`)
          .join('\n')}\n\n`;
      }
      if (results.emptyCategoriesRemoved.length > 0) {
        message += `🗑 Removed empty categories:\n${results.emptyCategoriesRemoved
          .map(category => `• ${category}`)
          .join('\n')}\n\n`;
      }
      if (results.notFound.length > 0) {
        message += `⚠️ Not found in any category:\n${results.notFound
          .map(username => `@${username}`)
          .join('\n')}`;
      }
      
      bot.sendMessage(chatId, message || "❌ No members were removed.");
    } catch (error) {
      console.error('Error in removeMember:', error);
      bot.sendMessage(chatId, "❌ Error removing members. Please try again later.");
    }
  }
});

// Add showStandup command
bot.onText(/^\/showStandup/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    try {
      initGroupLogs(chatId);
      
      const today = new Date().toISOString().split('T')[0];
      const todayUpdates = botData.groups[chatId].standUpLogs.filter(
        log => log.date.startsWith(today)
      );

      // Helper function to escape special characters for MarkdownV2
      const escapeMarkdown = (text) => {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      };

      if (todayUpdates.length === 0) {
        return bot.sendMessage(
          chatId, 
          "No standup updates for today yet\\.\n\n" +
          "Share your update using:\n" +
          "`/myUpdate` or `/up`",
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Group updates by category
      const updatesByCategory = {};
      todayUpdates.forEach(update => {
        let category = 'Uncategorized';
        Object.entries(botData.groups[chatId].memberCategories || {}).forEach(([cat, members]) => {
          if (members.includes(update.user)) {
            category = cat;
          }
        });
        
        if (!updatesByCategory[category]) {
          updatesByCategory[category] = [];
        }
        updatesByCategory[category].push(update);
      });

      // Format message
      let message = "*Today's Standup Updates*\n\n";
      
      Object.entries(updatesByCategory).forEach(([category, updates]) => {
        message += `*${escapeMarkdown(category)}*:\n`;
        updates.forEach(update => {
          message += `• @${escapeMarkdown(update.user)}:\n`;
          message += update.text.split('\n')
            .map(line => `  ${escapeMarkdown(line)}`)
            .join('\n');
          message += '\n\n';
        });
      });

      // Add summary
      const totalMembers = Object.values(botData.groups[chatId].memberCategories || {})
        .reduce((acc, members) => acc + members.length, 0);
      
      if (totalMembers > 0) {
        const pendingMembers = Object.values(botData.groups[chatId].memberCategories)
          .flat()
          .filter(member => !todayUpdates.some(update => update.user === member));

        if (pendingMembers.length > 0) {
          message += "*Pending Updates From:*\n";
          pendingMembers.forEach(member => {
            message += `• @${escapeMarkdown(member)}\n`;
          });
        }

        message += `\n*Summary:* ${todayUpdates.length}/${totalMembers} updates submitted`;
      }

      bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in showStandup:', error);
      bot.sendMessage(chatId, "❌ Error showing standup updates. Please try again later.");
    }
  }
});

// Update missing updates command
bot.onText(/^\/missing/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    try {
      initGroupLogs(chatId);
      
      const today = new Date().toISOString().split('T')[0];
      const todayUpdates = botData.groups[chatId].standUpLogs.filter(
        log => log.date.startsWith(today)
      );

      // Helper function to escape special characters for MarkdownV2
      const escapeMarkdown = (text) => {
        return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      };

      // Get unique members and their categories
      const memberCategories = new Map(); // Map to store member -> categories
      let totalUniqueMembers = 0;

      Object.entries(botData.groups[chatId].memberCategories || {}).forEach(([category, members]) => {
        members.forEach(member => {
          if (!memberCategories.has(member)) {
            memberCategories.set(member, new Set());
            totalUniqueMembers++;
          }
          memberCategories.get(member).add(category);
        });
      });

      if (totalUniqueMembers === 0) {
        return bot.sendMessage(
          chatId, 
          "No team members configured\\.\n" +
          "Use `/addMember` to add team members first\\.",
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Get missing members with their categories
      const missingMembers = new Map();
      memberCategories.forEach((categories, member) => {
        if (!todayUpdates.some(update => update.user === member)) {
          missingMembers.set(member, Array.from(categories));
        }
      });

      if (missingMembers.size === 0) {
        return bot.sendMessage(
          chatId,
          `✅ *All team members have submitted their updates\\!*\n` +
          `*Total:* ${todayUpdates.length}/${totalUniqueMembers} updates submitted`,
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Format message
      let message = "*Missing Standup Updates*\n\n";
      
      missingMembers.forEach((categories, member) => {
        message += `• @${escapeMarkdown(member)}\n`;
        message += `  _Categories: ${escapeMarkdown(categories.join(', '))}_\n\n`;
      });

      message += `*Summary:* ${todayUpdates.length}/${totalUniqueMembers} updates submitted`;

      bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in missing command:', error);
      bot.sendMessage(chatId, "❌ Error checking missing updates. Please try again later.");
    }
  }
});
