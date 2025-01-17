// src/app.js
require('dotenv').config();

// Core dependencies
const express = require('express');
const path = require('path');

// Import local modules
const { bot } = require('./bot');
const { initCronJobs } = require('./cronJobs');
const { loadData } = require('./storage');

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic "health check" route
app.get('/', (req, res) => {
  res.send("Bot is alive!");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// Export app for use in server.js
module.exports = app;