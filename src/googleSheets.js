// src/googleSheets.js
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const { botData } = require('./storage');

/**
 * Create a Google Sheets client via JWT service account
 */
function getGoogleSheetsClient() {
  const client = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: client });
}

/**
 * Formats a JS date into `YYYY-MM-DD`
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get week label (year-week + MM/DD range) for a given date
 * e.g., "2024-W12 03/18-03/22"
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  // Monday of current week
  const monday = new Date(d);
  monday.setDate(d.getDate() - (d.getDay() || 7) + 1);
  
  // Friday of current week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  // Format month/day
  const formatMonthDay = (myDate) => {
    const month = (myDate.getMonth() + 1).toString().padStart(2, '0');
    const day = myDate.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };
  
  // Calculate week number in year
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')} ${formatMonthDay(monday)}-${formatMonthDay(friday)}`;
}

/**
 * Export standup logs to a specific group's spreadsheet tab
 */
async function exportToGoogleSheets(chatId, logs) {
  try {
    const sheets = getGoogleSheetsClient();
    const date = new Date();
    const groupData = botData.groups[chatId];
    if (!groupData) throw new Error('No data for this group.');

    const groupName = groupData.metadata.groupName;
    const spreadsheetId = groupData.settings.spreadsheetId;
    if (!spreadsheetId) throw new Error('No spreadsheet ID configured for this group.');

    // Use last log in the array
    const log = logs[logs.length - 1];

    // Determine categories for user
    let userCategories = [];
    Object.entries(groupData.memberCategories || {}).forEach(([category, members]) => {
      if (members.includes(log.user)) {
        userCategories.push(category);
      }
    });
    const categoryString = userCategories.length ? userCategories.join(', ') : 'Uncategorized';

    // Prepare row data
    const newRow = [
      chatId.toString(),
      groupName,
      log.user,
      categoryString,
      log.text,
      formatDate(new Date(log.date))
    ];

    // Use "Standups + weekNumber" as sheet name
    const sheetName = `Standups ${getWeekNumber(date)}`;

    // Try to get the sheet, or create if doesn't exist
    try {
      await sheets.spreadsheets.get({ spreadsheetId, ranges: [sheetName] });
    } catch (error) {
      // Create new sheet with headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: sheetName } }
          }]
        }
      });
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:F1`,
        valueInputOption: 'RAW',
        resource: {
          values: [
            ['Group ID', 'Group Name', 'User', 'Category', 'Update', 'Date']
          ]
        }
      });
    }

    // Get existing values
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:F`,
    });
    const values = response.data.values || [];

    // Check for existing row for this user + date
    const todayStr = formatDate(new Date(log.date));
    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] === chatId.toString() && row[2] === log.user && row[5] === todayStr) {
        rowIndex = i + 1; // +1 for 1-based indexing in Sheets
        break;
      }
    }

    // Update existing or append new row
    if (rowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex}:F${rowIndex}`,
        valueInputOption: 'RAW',
        resource: { values: [newRow] }
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [newRow] }
      });
    }
    return true;
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    return false;
  }
}

module.exports = {
  exportToGoogleSheets,
  getWeekNumber,
  formatDate
};