// src/utils/configManager.js
const { botData, saveData } = require('../storage');

/**
 * Initialize or get user data
 * @param {string} userId - User ID
 */
function getUserData(userId) {
  if (!botData.privateChats) {
    botData.privateChats = {};
  }
  if (!botData.privateChats[userId]) {
    botData.privateChats[userId] = {};
  }
  return botData.privateChats[userId];
}

/**
 * Get available groups for a user
 * @returns {Array} Array of group objects with index, id, and name
 */
function getAvailableGroups() {
  return Object.entries(botData.groups)
    .filter(([_, groupData]) => groupData.metadata?.groupName)
    .map(([groupId, groupData], index) => ({
      index: index + 1,
      id: groupId,
      name: groupData.metadata.groupName
    }));
}

/**
 * Save group selection for user
 * @param {string} userId - User ID
 * @param {string} groupId - Selected group ID
 */
function saveUserGroupSelection(userId, groupId) {
  const userData = getUserData(userId);
  userData.targetGroupId = groupId;
  saveData(botData);
}

/**
 * Initialize update draft
 * @param {string} userId - User ID
 */
function initializeUpdateDraft(userId) {
  const userData = getUserData(userId);
  userData.draftUpdate = {
    state: 'collecting_yesterday',
    collecting: 'what',
    currentTask: null,
    content: {
      yesterday: [],
      today: []
    },
    lastModified: Date.now()
  };
  saveData(botData);
  return userData.draftUpdate;
}

/**
 * Clean up user session
 * @param {string} userId - User ID
 */
function cleanupUserSession(userId) {
  const userData = getUserData(userId);
  delete userData.draftUpdate;
  delete userData.messageHandler;
  saveData(botData);
}

module.exports = {
  getUserData,
  getAvailableGroups,
  saveUserGroupSelection,
  initializeUpdateDraft,
  cleanupUserSession
};