// src/utils/chat.js

/**
 * Helper to confirm if a message is from a group or supergroup
 * @param {Object} msg - Telegram message object
 * @returns {boolean} True if it's a group or supergroup
 */
function isGroupChat(msg) {
    return msg && msg.chat && (msg.chat.type === 'group' || msg.chat.type === 'supergroup');
  }
  
  module.exports = {
    isGroupChat
  };