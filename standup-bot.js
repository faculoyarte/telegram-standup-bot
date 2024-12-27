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
function initGroupLogs(chatId) {
  if (!botData.groups[chatId]) {
    botData.groups[chatId] = {
      standUpLogs: [],
      state: { collecting: false },
      settings: {
        reminderTime: '17:30',
        timezone: 'UTC',
        activeWeekdays: [1, 2, 3, 4, 5], // Monday to Friday
        isActive: true
      },
      metadata: {
        groupName: '',
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
    const uniqueLogs = new Map();
    
    groupData.standUpLogs.forEach((item) => {
      uniqueLogs.set(item.user, item);
    });

    Array.from(uniqueLogs.values()).forEach((item, idx) => {
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
      
      botData.groups[chatId].standUpLogs.push(update);
      saveData(botData);
    }
  }
});

// ----- Example: Global 09:00 reminder for all active groups -----
cron.schedule('39 18 * * 1-5', () => {
  console.log('Sending reminders to groups at 5:30 PM');
  
  Object.entries(botData.groups).forEach(([chatId, groupData]) => {
    if (groupData.settings.isActive) {
      bot.sendMessage(chatId, "It's 5:30 PM! Type /startStandup to begin today's standup.");
    }
  });
});

function exportStandupForGroup(chatId) {
  const groupData = botData.groups[chatId];
  if (!groupData) return;
  
  console.log(`Exporting standup logs for group ${chatId}:`);
  console.log(groupData.standUpLogs);
  
  groupData.standUpLogs = [];
  saveData(botData);
}
