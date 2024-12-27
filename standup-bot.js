// bot username: TripleStandupBot
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

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

// In-memory storage
const standUpLogs = {};   // standUpLogs[chatId] = [ { user, text, date }, ... ]
const groupStates = {};   // groupStates[chatId] = { collecting: boolean }
const activeGroupIds = new Set();

function initGroupLogs(chatId) {
  if (!standUpLogs[chatId]) {
    standUpLogs[chatId] = [];
  }
}
function initGroupState(chatId) {
  if (!groupStates[chatId]) {
    groupStates[chatId] = { collecting: false };
  }
}

// ----- Commands -----
bot.onText(/\/startStandup/, (msg) => {
  const chatId = msg.chat.id;

  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    initGroupState(chatId);

    // Clear previous logs when starting new standup
    standUpLogs[chatId] = [];
    groupStates[chatId].collecting = true;
    
    console.log('Starting standup for chat:', {
      chatId,
      state: groupStates[chatId]
    });
    
    bot.sendMessage(chatId, "🎯 Standup started! Please share your updates now.\n\nFormat suggestion:\nYesterday: \nToday: \nBlockers: ");
  }
});

bot.onText(/\/endStandup/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (groupStates[chatId]) {
      groupStates[chatId].collecting = false;
    }
    exportStandupForGroup(chatId);
    bot.sendMessage(chatId, "Standup ended. Thanks for participating!");
  }
});

// Example command to see current updates
bot.onText(/\/showStandup/, (msg) => {
  const chatId = msg.chat.id;
  if (standUpLogs[chatId] && standUpLogs[chatId].length > 0) {
    let response = "Current standup logs:\n\n";
    const uniqueLogs = new Map(); // To prevent duplicates
    
    standUpLogs[chatId].forEach((item) => {
      // Use username as key to prevent duplicates
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
  console.log('Message received:', {
    chatId,
    text: msg.text,
    type: msg.chat.type,
    collecting: groupStates[chatId]?.collecting,
    from: msg.from
  });

  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    initGroupLogs(chatId);
    initGroupState(chatId);

    // Keep track of all groups we're in
    activeGroupIds.add(chatId);

    // Debug log
    console.log('Group state:', {
      isCollecting: groupStates[chatId].collecting,
      hasText: !!msg.text,
      isCommand: msg.text?.startsWith('/'),
      currentLogs: standUpLogs[chatId]
    });

    // If collecting is on and it's not a command, store the message
    if (groupStates[chatId].collecting && 
        msg.text && 
        !msg.text.startsWith('/')) {
      
      const userName = msg.from.username 
        ? msg.from.username 
        : [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      
      const update = {
        user: userName,
        text: msg.text,
        date: new Date().toISOString(),
      };
      
      console.log('Storing update:', update);
      standUpLogs[chatId].push(update);
    }
  }
});

// ----- Example: Global 09:00 reminder for all active groups -----
cron.schedule('30 17 * * 1-5', () => {
  console.log('Sending reminders to groups at 5:27 PM');
  console.log({ activeGroupIds });
  activeGroupIds.forEach((chatId) => {
    bot.sendMessage(chatId, "It's 5:27 PM! Type /startStandup to begin today's standup.");
  });
});

function exportStandupForGroup(chatId) {
  if (!standUpLogs[chatId]) return;
  
  console.log(`Exporting standup logs for group ${chatId}:`);
  console.log(standUpLogs[chatId]);
  
  // Clear the array after exporting
  standUpLogs[chatId] = [];
}
