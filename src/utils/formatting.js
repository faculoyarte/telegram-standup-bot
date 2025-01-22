// src/utils/formatting.js

/**
 * Escape special characters for MarkdownV2 format
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for MarkdownV2
 */
function escapeMarkdown(text) {
    if (!text) return '';
    // Escape all special characters except periods and exclamation marks
    return text.replace(/[_*[\]()~`>#+=|{}-]/g, '\\$&')
               .replace(/\.(?=\S)/g, '\\.')
               .replace(/!(?=\S)/g, '\\!');
}

/**
 * Format a username for display (handles @ symbol)
 * @param {string} username - Username to format
 * @returns {string} Formatted username
 */
function formatUsername(username) {
  if (!username) return '';
  return username.startsWith('@') ? username : `@${username}`;
}

/**
 * Format a standup update for display
 * @param {Object} update - Update object
 * @param {boolean} [escaped=true] - Whether to escape markdown characters
 * @returns {string} Formatted update text
 */
function formatUpdate(update, escaped = true) {
  if (!update) return '';
  
  const { user, text, date } = update;
  const formattedDate = new Date(date).toLocaleDateString();
  
  let output = `*From:* ${formatUsername(user)}\n`;
  output += `*Date:* ${formattedDate}\n\n`;
  output += text.split('\n').map(line => `  ${line}`).join('\n');

  return escaped ? escapeMarkdown(output) : output;
}

/**
 * Format a list of members with their categories
 * @param {Object} memberCategories - Category to members mapping
 * @returns {string} Formatted member list
 */
function formatMemberList(memberCategories) {
  if (!memberCategories || Object.keys(memberCategories).length === 0) {
    return '*No members configured*';
  }

  let output = '*Team Members by Category*\n\n';
  
  Object.entries(memberCategories).forEach(([category, members]) => {
    output += `*${escapeMarkdown(category)}*:\n`;
    if (!members.length) {
      output += '• No members\n\n';
    } else {
      members.forEach(member => {
        output += `• ${formatUsername(escapeMarkdown(member))}\n`;
      });
      output += '\n';
    }
  });

  return output;
}

/**
 * Format reminder time in a readable format
 * @param {string} time - Time in HH:mm format
 * @param {string} timezone - Timezone string
 * @returns {string} Formatted time string
 */
function formatReminderTime(time, timezone = 'UTC') {
  if (!time) return 'Not set';
  
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period} ${timezone}`;
}

/**
 * Format summary statistics
 * @param {Object} stats - Statistics object
 * @returns {string} Formatted statistics
 */
function formatStats(stats) {
  if (!stats) return '';

  const {
    totalMembers = 0,
    updatesSubmitted = 0,
    categories = [],
    lastUpdate = null
  } = stats;

  let output = '*Summary Statistics*\n\n';
  output += `• Updates Today: ${updatesSubmitted}/${totalMembers}\n`;
  output += `• Categories: ${categories.length}\n`;
  
  if (lastUpdate) {
    const lastUpdateTime = new Date(lastUpdate).toLocaleTimeString();
    output += `• Last Update: ${lastUpdateTime}\n`;
  }

  return escapeMarkdown(output);
}

/**
 * Format error messages consistently
 * @param {string} message - Error message
 * @param {string} [command=null] - Command that caused the error
 * @returns {string} Formatted error message
 */
function formatError(message, command = null) {
  let output = '❌ ';
  if (command) {
    output += `Error in /${command}: `;
  }
  output += message;
  return escapeMarkdown(output);
}

/**
 * Format success messages consistently
 * @param {string} message - Success message
 * @returns {string} Formatted success message
 */
function formatSuccess(message) {
  return `✅ ${escapeMarkdown(message)}`;
}

module.exports = {
  escapeMarkdown,
  formatUsername,
  formatUpdate,
  formatMemberList,
  formatReminderTime,
  formatStats,
  formatError,
  formatSuccess
};