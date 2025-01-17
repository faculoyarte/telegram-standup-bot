// src/utils/taskFormatter.js

/**
 * Format a task list preview during collection
 * @param {Array} tasks - Array of tasks
 * @param {string} section - 'yesterday' or 'today'
 */
function formatTaskPreview(tasks, section) {
  return tasks.map((task, i) => 
    section === 'yesterday' ?
      `accomplishment ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}` :
      `prio ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}`
  ).join('\n\n');
}

/**
 * Format the next task prompt
 * @param {number} taskNumber - Next task number
 * @param {string} section - 'yesterday' or 'today'
 */
function formatNextTaskPrompt(taskNumber, section) {
  return section === 'yesterday' ?
    `what was your accomplishment ${taskNumber}` :
    `what is prio ${taskNumber}`;
}

/**
 * Format complete standup update for posting
 * @param {Object} draftUpdate - Complete draft update object
 */
function formatFinalUpdate(draftUpdate) {
  const { yesterday, today } = draftUpdate.content;
  
  let message = '*Yesterday:*\n';
  yesterday.forEach((task, i) => {
    message += `accomplishment ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}\n\n`;
  });
  
  message += '*Today:*\n';
  today.forEach((task, i) => {
    message += `prio ${i + 1}:\nwhat: ${task.what}\nwhy: ${task.why}\n\n`;
  });
  
  return message;
}

/**
 * Format initial prompt messages
 */
const prompts = {
  startYesterday: 'Let\'s prepare your standup update.\n\n' +
                 'First, tell me what you *accomplished yesterday*.\n\n' +
                 'What was your biggest accomplishment 1:',
  
  startToday: 'Great! Now let\'s talk about your priorities for today.\n\nWhat is prio 1:',
  
  why: 'Why?'
};

module.exports = {
  formatTaskPreview,
  formatNextTaskPrompt,
  formatFinalUpdate,
  prompts
};