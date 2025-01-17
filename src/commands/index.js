// src/commands/index.js
const display = require('./display');
const help = require('./help');
const members = require('./members');
const reminder = require('./reminder');
const spreadsheet = require('./spreadsheet');
const updateGC = require('./updateGC');        // Group chat updates
const updatePrivate = require('./updatePrivate'); // Private chat updates
const config = require('./config');

module.exports = function registerCommands(bot) {
  display(bot);
  help(bot);
  members(bot);
  reminder(bot);
  spreadsheet(bot);
  updateGC(bot);       // Register group chat update commands
  updatePrivate(bot);  // Register private chat update commands
  config(bot);
};