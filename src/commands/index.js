// src/commands/index.js
const display = require('./display');
const help = require('./help');
const members = require('./members');
const reminder = require('./reminder');
const spreadsheet = require('./spreadsheet');
const update = require('./update');

module.exports = function registerCommands(bot) {
  display(bot);
  help(bot);
  members(bot);
  reminder(bot);
  spreadsheet(bot);
  update(bot);
};