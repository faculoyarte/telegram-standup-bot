# Telegram Standup Bot

A Telegram bot to help manage daily standups in group chats, with features for scheduling reminders, tracking member updates, and exporting to Google Sheets.

## Features

- Daily standup management in Telegram groups
- Automated reminders at configurable times
- Update tracking and member management
- Export updates to Google Sheets
- Team categorization and tracking
- Missing updates notifications

## Setup Instructions

### 1. Bot Setup

1. Add the bot to your group
   - Search for `@TripleStandupBot` in Telegram
   - Click "Add to Group" and select your group

2. Make the bot an admin
   - Open your group settings
   - Go to "Administrators"
   - Click "Add Admin"
   - Select `@TripleStandupBot`
   - Required permissions:
     - Delete messages
     - Pin messages
     - Manage voice chats

### 2. Google Sheets Integration (Optional)

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account
4. Download credentials JSON
5. Share your spreadsheet with the service account email
6. Use `/setSpreadsheet` command with your spreadsheet ID

## Commands

### Update Commands
- `/myUpdate` (or `/up`) - Share your standup update
- `/showStandup` - Show today's standup updates
- `/missing` - Show who hasn't submitted updates

### Reminder Settings
- `/setReminder` - Set daily standup reminder time
- `/showReminder` - Show reminder settings
- `/toggleReminder` - Toggle reminders on/off

### Member Management
- `/manageMembers` - Show all members and categories
- `/addMember [category] [username]` - Add member to category
- `/removeMember [username]` - Remove member from all categories

### Export Settings
- `/setSpreadsheet <id>` - Set a custom Google Spreadsheet ID (admin only)

## Update Format

When sharing your standup update, use this format:

```
/up
Yesterday:
- What: Completed task X
  Why: It contributed to business goal Y

Today:
- Working on feature P
  Why: It contributed to business goal Q

Blockers:
- Waiting for API documentation
```

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm
- MongoDB (optional, for persistent storage)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd telegram-standup-bot
```

2. Install dependencies:

```bash
npm install node-telegram-bot-api express node-cron dotenv googleapis google-auth-library
```

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

Required environment variables:

```
BOT_TOKEN=your_telegram_bot_token
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_service_account_private_key
GOOGLE_SPREADSHEET_ID=default_spreadsheet_id
PORT=3000
```

### Running the Application

Development:

```bash
node src/server.js
```

### Project Structure

```
project-root/
├── src/
|   ├── app.js             # Express app setup & config
│   ├── bot.js             # Main Telegram bot setup
│   ├── cronJobs.js        # Scheduled tasks
│   ├── googleSheets.js    # Google Sheets integration
│   ├── server.js          # Main Express server setup
│   ├── storage.js         # Data persistence logic
│   ├── commands/          # Command handlers
│   │   ├── display.js     # Display commands (/showStandup, /missing)
│   │   ├── help.js        # Help/welcome commands
│   │   ├── index.js       # Exports all commands
│   │   ├── members.js     # Member management commands
│   │   ├── reminder.js    # Reminder commands
│   │   ├── spreadsheet.js # Spreadsheet commands
│   │   └── update.js      # Update commands (/myUpdate, /up)
│   └── utils/             # Utility functions
│       ├── formatting.js  # Message formatting helpers
│       ├── index.js       # Exports all utilities
│       └── time.js        # Time parsing/conversion
```

### Dependencies Map
```
server.js
  ├── app.js
  ├── bot.js
  ├── cronJobs.js
  └── storage.js

bot.js
  ├── storage.js
  └── commands/index.js

commands/*.js
  ├── storage.js
  ├── bot.js
  ├── utils/formatting.js
  └── utils/time.js
```

## Troubleshooting

### Common Issues

1. Bot not responding
   - Ensure bot is admin in the group
   - Check if `BOT_TOKEN` is correct
   - Verify server is running

2. Google Sheets export failing
   - Verify spreadsheet is shared with service account
   - Check `GOOGLE_PRIVATE_KEY` format
   - Ensure spreadsheet ID is correct

3. Reminders not working
   - Check timezone settings
   - Verify cron job is running
   - Ensure reminder is enabled with `/toggleReminder`
