const TelegramBot = require('node-telegram-bot-api');
const token = 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
const bot = new TelegramBot(token, { polling: true });

// Inventory
const inventory = [
  { name: 'Soap', price: 10, quantity: 50, weight: '100g', type: 'Cleaning', brand: 'Dove' },
  { name: 'Shampoo', price: 20, quantity: 30, weight: '250ml', type: 'Hair Care', brand: 'Pantene' },
  { name: 'Toothpaste', price: 15, quantity: 40, weight: '100g', type: 'Oral Care', brand: 'Colgate' },
  // Add more items here
];

// Store owner chat ID
const storeOwnerChatId = 'STORE_OWNER_TELEGRAM_CHAT_ID_HERE';

// Global variables to store user's order and total cost
let order = {};
let totalCost = 0;

// Start command handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to the General Store!');
  displayInventory(chatId);
});

// Inventory command handler
bot.onText(/\/inventory/, (msg) => {
  const chatId = msg.chat.id;
  displayInventory(chatId);
});

// Order command handler
bot.onText(/\/order/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Please choose the item(s) to be ordered:');
  displayInventory(chatId, true);
});

// Callback query handler
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const itemName = data.split(',')[0];
  const itemPrice = Number(data.split(',')[1]);

  if (!order[itemName]) {
    order[itemName] = 1;
  } else {
    order[itemName]++;
  }

  totalCost += itemPrice;
  bot.answerCallbackQuery(callbackQuery.id, `Added 1 ${itemName} to your order`);
});

// Confirm command handler
bot.onText(/\/confirm/, (msg) => {
  const chatId = msg.chat.id;
  if (Object.keys(order).length === 0) {
    bot.sendMessage(chatId, 'You have not added anything to your order yet');
  } else {
    let orderDetails = 'Order Details:\n\n';
    for (let itemName in order) {
      orderDetails += `${itemName} x ${order[itemName]}\n`;
    }
    orderDetails += `\nTotal Cost: ${totalCost}`;
    bot.sendMessage(chatId, orderDetails);
    bot.sendMessage(storeOwnerChatId, `New Order: ${orderDetails}`);
  }
});

// Helper function to display inventory
function displayInventory(chatId, isOrder = false) {
  let inventoryMessage = 'Inventory:\n\n';
  inventory.forEach(item => {
    inventoryMessage += `${item.name} - ${item.price} Rs (${item.quantity} left)`;
    if (isOrder) {
      inventoryMessage += ` - ${item.weight} ${item.type} ${item.brand} /order_${item.name}_${item.price}`;
    }
    inventoryMessage += '\n';
  });
  bot.sendMessage(chatId, inventoryMessage);
}

