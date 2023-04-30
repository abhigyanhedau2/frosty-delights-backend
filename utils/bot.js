const TelegramBot = require('node-telegram-bot-api');

// replace the value below with the Telegram token you receive from @BotFather
const token = '5978951810:AAFiAlNKNaWdQvBM_QW933lcWBEGO59eocg';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

module.exports = bot;