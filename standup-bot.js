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

    groupStates[chatId].collecting = true;
    bot.sendMessage(chatId, "Standup started! Please share your updates now.");
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
    let response = "Current standup logs:\n";
    standUpLogs[chatId].forEach((item, idx) => {
      response += `${idx + 1}. ${item.user}: ${item.text}\n`;
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
    initGroupState(chatId);

    // Keep track of all groups we're in
    activeGroupIds.add(chatId);

    // If collecting is on, store the message
    if (groupStates[chatId].collecting && msg.text) {
      standUpLogs[chatId].push({
        user: msg.from.username || `${msg.from.first_name} ${msg.from.last_name}`,
        text: msg.text,
        date: new Date().toISOString(),
      });
    }
  }
});

// ----- Example: Global 09:00 reminder for all active groups -----
cron.schedule('0 0 9 * * 1-5', () => {
  activeGroupIds.forEach((chatId) => {
    bot.sendMessage(chatId, "It's 9 AM! Type /startStandup to begin today's standup.");
  });
});

function exportStandupForGroup(chatId) {
  if (!standUpLogs[chatId]) return;
  
  console.log(`Exporting standup logs for group ${chatId}:`);
  console.log(standUpLogs[chatId]);
  
  // Clear the array after exporting
  standUpLogs[chatId] = [];
}
