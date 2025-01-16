// src/storage.js
const fs = require('fs');
const path = require('path');

/**
 * Load bot data from `data.json`
 */
function loadData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { groups: {} };
  }
}

/**
 * Save bot data to `data.json`
 */
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

// In-memory data store
let botData = loadData();

/**
 * Initialize group data
 */
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
  return botData.groups[chatId];
}

/**
 * Clear standup logs for a group
 */
function clearGroupLogs(chatId) {
  if (botData.groups[chatId]) {
    botData.groups[chatId].standUpLogs = [];
    saveData(botData);
  }
}

module.exports = {
  botData,
  loadData,
  saveData,
  initGroupLogs,
  clearGroupLogs
};