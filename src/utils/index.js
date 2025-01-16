// src/utils/index.js

const formatting = require('./formatting');
const time = require('./time');
const chat = require('./chat');

module.exports = {
  ...formatting,
  ...time,
  ...chat
};

// You can also export specific utilities if you prefer explicit exports:
/*
module.exports = {
  // Formatting utilities
  escapeMarkdown: formatting.escapeMarkdown,
  formatUsername: formatting.formatUsername,
  formatUpdate: formatting.formatUpdate,
  formatMemberList: formatting.formatMemberList,
  formatReminderTime: formatting.formatReminderTime,
  formatStats: formatting.formatStats,
  formatError: formatting.formatError,
  formatSuccess: formatting.formatSuccess,

  // Time utilities
  parseTimeString: time.parseTimeString,
  convertToUTC: time.convertToUTC,
  formatTime: time.formatTime,
  getCurrentWeek: time.getCurrentWeek,
  isValidTime: time.isValidTime,
  calculateLocalTime: time.calculateLocalTime
};
*/