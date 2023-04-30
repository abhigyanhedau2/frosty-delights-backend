const bot = require('./utils/bot');

const sendHomeScreenOptions = (chatId) => {

    // create an array of options for the dropdown list
    const options = [
        ['Place an Order', 'placeOrder'],
        ['Register as Delivery Partner', 'registerAsDeliveryPartner'],
        ['Sign in as Owner', 'signInAsOwner']
    ];

    // listen for incoming messages
    bot.sendMessage(chatId, 'Please choose an option:', {
        reply_markup: {
            inline_keyboard: options.map(([text, callback_data]) => ([{ text, callback_data }])),
        },
    });

};

const queryRouter = (callbackQuery) => {

    const chatId = callbackQuery.message.chat.id;
    const optionValue = callbackQuery.data;

    if (optionValue.split(' ')[0] === 'placeOrder') {
        
        

    }

    else if (optionValue.split(' ')[0] === 'registerAsDeliveryPartner') {



    }

    else if (optionValue.split(' ')[0] === 'signInAsOwner') {



    }

    else {
        bot.sendMessage(chatId, 'Choose a valid option from below');
        sendHomeScreenOptions(chatId);
    }
}

module.exports = queryRouter;