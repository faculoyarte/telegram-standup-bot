// src/utils/formatUpdate.js
const { escapeMarkdown, formatUsername } = require('./formatting');

/**
 * Format a task list preview during collection
 * @param {Array} tasks - Array of tasks
 * @param {string} section - 'yesterday' or 'today'
 */
function formatTaskPreview(tasks, section) {
  const formatted = tasks.map((task, i) => {
    const prefix = section === 'yesterday' ? 'accomplishment' : 'prio';
    return escapeMarkdown(
      `${prefix} ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}`
    );
  }).join('\n\n');

  return formatted;
}

/**
 * Format the next task prompt
 * @param {number} taskNumber - Next task number
 * @param {string} section - 'yesterday' or 'today'
 */
function formatNextTaskPrompt(taskNumber, section) {
  const text = section === 'yesterday' ?
    `what was your accomplishment ${taskNumber}` :
    `what is prio ${taskNumber}`;
  return escapeMarkdown(text);
}

/**
 * Format complete standup update for posting
 * @param {Object} draftUpdate - Complete draft update object
 */
function formatFinalUpdate(draftUpdate) {
  const { yesterday, today } = draftUpdate.content;
  
  let message = '*Yesterday:*\n';
  yesterday.forEach((task, i) => {
    message += escapeMarkdown(
      `accomplishment ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}\n\n`
    );
  });
  
  message += '*Today:*\n';
  today.forEach((task, i) => {
    message += escapeMarkdown(
      `prio ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}\n\n`
    );
  });
  
  return message;
}

/**
 * Format task prompts for user interaction
 */
const prompts = {
  startYesterday: escapeMarkdown(
    'Let\'s prepare your standup update.\n\n' +
    'First, tell me what you *accomplished yesterday*.\n\n' +
    'What was your biggest accomplishment 1:'
  ),
  
  startToday: escapeMarkdown(
    'Great! Now let\'s talk about your priorities for today.\n\nWhat is prio 1:'
  ),
  
  why: escapeMarkdown('Why?')
};

module.exports = {
  formatTaskPreview,
  formatNextTaskPrompt,
  formatFinalUpdate,
  prompts
};