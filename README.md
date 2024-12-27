# telegram-standup-bot

# Telegram Standup Bot

A Telegram bot to help manage daily standups in group chats.

## Setup Instructions

1. Add the bot to your group

   - Search for `@TripleStandupBot` in Telegram
   - Click "Add to Group" and select your group

2. Make the bot an admin
   - Open your group settings
   - Go to "Administrators"
   - Click "Add Admin"
   - Select `@TripleStandupBot`
   - Enable these permissions:
     - Delete messages
     - Pin messages
     - Manage voice chats

## Commands

- `/startStandup` - Start collecting standup updates
- `/endStandup` - End standup and export logs
- `/showStandup` - View current standup updates

## Update Format

When sharing your standup update, use this suggested format:
Yesterday:

- What you accomplished yesterday
- Tasks completed
- Meetings attended

Today:

- Your planned tasks for today
- Scheduled meetings
- Goals to achieve

Blockers:

- Any issues preventing progress
- Help needed from team
- Dependencies you're waiting on
