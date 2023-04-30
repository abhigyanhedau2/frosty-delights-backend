const express = require('express');
const bodyParser = require('body-parser');
const connectToDB = require('./utils/connectToDB');
const dotenv = require('dotenv');
const cors = require('cors');
const bot = require('./utils/bot');
const validator = require('validator');
dotenv.config();

const Product = require('./models/Product');
const Purchase = require('./models/Purchase');
const Order = require('./models/Order');
const User = require('./models/User');

const app = express();

// MIDDLEWARES
// To get the req.body values 
app.use(bodyParser.json());

app.use(cors());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "1800");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    next();
});

// create an array of options for the dropdown list
const options = [
    ['Place an Order', 'placeOrder'],
    ['Register as Delivery Partner', 'registerAsDelPartner'],
    ['Sign in as Owner', 'signInAsOwner']
];

const ownerOptions = [
    ['View Orders For Delivery', 'viewOrders'],
    ['View Orders For Pickup', 'viewOrdersForPickup'],
    ['Add Product', 'addProduct'],
    ['Update Product Quantity', 'updateProductQuantity']
];

let currTasks = [];
let newProduct = {};
let newDeliveryPartner = {};
let toBeDispatchedOrder;
let currProductId;
let productQuantityUpdateId;
let currProduct;
let user;

const sendHomeScreenOptions = async (chatId) => {

    const prevOrder = await Purchase.findOne({ chatId }).populate('products.productId');

    if (prevOrder) {
        for (const productObj of prevOrder.products) {
            const productFromDB = await Product.findById(productObj.productId);
            await Product.findByIdAndUpdate(productObj.productId, { quantity: (+productFromDB.quantity) + (+productObj.quantity) }, { new: true });
        }

        await Purchase.deleteOne({ chatId });
    }

    // listen for incoming messages
    await bot.sendMessage(chatId, 'Please choose an option:', {
        reply_markup: {
            inline_keyboard: options.map(([text, callback_data]) => ([{ text, callback_data }])),
        },
    });

};

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async (message) => {

    const chatId = message.chat.id;

    if (message.text === '/start' || message.text === '/home' || currTasks.length === 0) await sendHomeScreenOptions(chatId);

    else {
        switch (currTasks[currTasks.length - 1]) {

            case 'enterOwnerPassword':
                const password = message.text;
                // if the password matches the owner password
                if (password.toString() === process.env.OWNER_PASS) {
                    // listen for incoming messages
                    await bot.sendMessage(chatId, 'Please choose an option:', {
                        reply_markup: {
                            inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                        },
                    });
                }
                // else, send error message
                else {
                    currTasks = [];
                    await bot.sendMessage(chatId, 'Incorrect password.');
                    await sendHomeScreenOptions(chatId);
                }
                break;

            case 'enterProductName':
                const productName = message.text;
                const isValidLetters = validator.isAlpha(productName.replace(/ /g, '')) && !validator.contains(productName, /[0-9]/g);
                // if entered product name is invalid
                if (!isValidLetters) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Invalid flavor name.');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newProduct['name'] = productName;
                    currTasks.push('enterProductPrice');
                    await bot.sendMessage(chatId, 'Enter flavor price (in number)');
                }
                break;

            case 'enterProductPrice':
                const productPrice = message.text;
                // if entered product price is valid
                const isValidNumber = validator.isNumeric(productPrice) && !validator.matches(productPrice, /[^0-9]/g);
                if (!isValidNumber) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Invalid flavor price');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newProduct['price'] = productPrice;
                    currTasks.push('enterProductQuantity');
                    await bot.sendMessage(chatId, 'Enter flavor quantity (in number)');
                }
                break;

            case 'enterProductQuantity':
                const productQuantity = message.text;
                const isValidQuantity = validator.isNumeric(productQuantity) && !validator.matches(productQuantity, /[^0-9]/g);
                if (!isValidQuantity) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Invalid flavor quantity');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newProduct['quantity'] = productQuantity;
                    currTasks.push('enterProductWeight');
                    await bot.sendMessage(chatId, 'Enter flavor weight in grams (in number)');
                }
                break;

            case 'enterProductWeight':
                const productWeight = message.text;
                const isValidWeight = validator.isNumeric(productWeight) && !validator.matches(productWeight, /[^0-9]/g);
                if (!isValidWeight) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Invalid flavor weight');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newProduct['weight'] = productWeight;
                    currTasks.push('enterProductBrand');
                    await bot.sendMessage(chatId, 'Enter flavor brand');
                }
                break;

            case 'enterProductBrand':
                const productBrand = message.text;
                newProduct['brand'] = productBrand;
                const product = `Name: ${newProduct.name}\nPrice: ${newProduct.price}\nQuantity: ${newProduct.quantity}\nWeight: ${newProduct.weight}\nBrand: ${newProduct.brand}`;
                await bot.sendMessage(chatId, `Review the Ice Cream Product:\n\n${product}`);
                const addProductOptions = [
                    ['Confirm Add Product', 'confirmAddProduct'],
                    ['Cancel', 'cancelAddProduct']
                ];
                await bot.sendMessage(chatId, 'Please choose an option:', {
                    reply_markup: {
                        inline_keyboard: addProductOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case 'enterQuantityRequired':
                const requestedQuantity = message.text;
                const isValidRequestedQuantity = validator.isNumeric(requestedQuantity) && !validator.matches(requestedQuantity, /[^0-9]/g);
                if (!isValidRequestedQuantity) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Invalid quantity requested.');
                    await sendHomeScreenOptions(chatId);
                } else if (+currProduct.quantity < +requestedQuantity) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, `Sorry, we don't have enough quantity of ${currProduct.name} ice cream available.`);
                }
                // Add the product
                else {
                    let currentOrder = await Purchase.findOne({ chatId }).populate('products.productId');
                    user = await User.findOne({ chatId });
                    // prepare new order data
                    const purchasedProducts = {
                        productId: currProductId,
                        quantity: +requestedQuantity,
                        totalPrice: (+currProduct.price) * (+requestedQuantity)
                    }

                    if (!currentOrder) {
                        // create user
                        if (!user) {
                            user = await User.create({
                                chatId,
                                name: message.chat.first_name,
                                role: 'customer'
                            });
                        }
                        // create the new order
                        await Purchase.create({
                            chatId,
                            products: purchasedProducts,
                            totalItems: purchasedProducts.quantity,
                            totalOrderPrice: purchasedProducts.totalPrice
                        });

                    } else {
                        let updatedOrders = currentOrder.products;
                        updatedOrders.push(purchasedProducts);
                        let updatedTotalItems = (+currentOrder.totalItems) + (+purchasedProducts.quantity);
                        let updatedTotalPrice = currentOrder.totalOrderPrice + purchasedProducts.totalPrice;

                        await Purchase.updateOne({ chatId }, { products: updatedOrders, totalItems: updatedTotalItems, totalOrderPrice: updatedTotalPrice });
                    }

                    // decrease the product quantity
                    const numberedProductQuantity = +(currProduct.quantity);
                    const numberedRequestedProductQuantity = +requestedQuantity;
                    const updatedProductQuantity = numberedProductQuantity - numberedRequestedProductQuantity;
                    currProduct = await Product.findByIdAndUpdate(currProductId, { quantity: +updatedProductQuantity }, { new: true });

                    const updatedOrder = await Purchase.findOne({ chatId }).populate('products.productId');
                    let orderStr = "";
                    for (const productObj of updatedOrder.products) {
                        orderStr += (`${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                        orderStr += '\n';
                    }
                    orderStr += `\nTotal Items: ${updatedOrder.totalItems}`;
                    orderStr += `\nTotal Order Price: ${updatedOrder.totalOrderPrice} Rs.`;
                    await bot.sendMessage(chatId, `Review Order:\n\n${orderStr}`);

                    const custOptions = [
                        ['Add Product', 'addProductToOrder'],
                        ['Place Order', 'placeFinalOrder']
                    ];

                    await bot.sendMessage(message.chat.id, 'Please choose an option:', {
                        reply_markup: {
                            inline_keyboard: custOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                        },
                    });
                }
                break;

            case 'enterNewDeliveryAddress':
                const newDeliverAddress = message.text;
                user = await User.findOne({ chatId });
                const prevAddresses = user.address;
                prevAddresses.push(newDeliverAddress);
                user = await User.updateOne({ chatId }, { address: prevAddresses });
                await Purchase.updateOne({ chatId }, { address: newDeliverAddress }).populate('products.productId');
                let orderStr = "";
                const finalOrder = await Purchase.findOne({ chatId }).populate('products.productId');
                if (!finalOrder) {
                    await bot.sendMessage(chatId, 'Add some items before placing an order.');
                    await sendHomeScreenOptions(chatId);
                } else {
                    for (const productObj of finalOrder.products) {
                        orderStr += (`${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                        orderStr += '\n';
                    }
                    orderStr += `\nTotal Items: ${finalOrder.totalItems}`;
                    orderStr += `\nTotal Order Price: ${finalOrder.totalOrderPrice} Rs.`;
                    orderStr += `\n\nDelivery Address: ${finalOrder.address}`;
                    await bot.sendMessage(chatId, `Order Placed:\n\n${orderStr}`);
                    await bot.sendMessage(chatId, 'Order will be dispatched as soon as the owner accepts the order and a delivery partner 🛵 is assigned by the owner.\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨');
                    await Purchase.updateOne({ chatId }, { orderType: 'delivery' });
                    const currOrder = await Purchase.findOne({ chatId }).populate('products.productId');
                    await Order.create({
                        chatId,
                        products: currOrder.products,
                        totalItems: currOrder.totalItems,
                        totalOrderPrice: currOrder.totalOrderPrice,
                        orderType: 'delivery',
                        address: currOrder.address
                    });
                    await Purchase.deleteOne({ chatId });
                }
                break;

            case 'enterDeliveryPartnerName':
                const newDeliveryPartnerName = message.text;
                const isValidDeliveryPartnerName = validator.isAlpha(newDeliveryPartnerName.replace(/ /g, '')) && !validator.contains(newDeliveryPartnerName, /[0-9]/g);
                if (!isValidDeliveryPartnerName) {
                    currTasks = [];
                    newProduct = {};
                    newDeliveryPartner = {};
                    await bot.sendMessage(chatId, 'Enter a valid name');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newDeliveryPartner['name'] = newDeliveryPartnerName;
                    currTasks.push('enterDeliveryPartnerCharges');
                    await bot.sendMessage(chatId, 'Enter your charges per km (in number)');
                }
                break;

            case 'enterDeliveryPartnerCharges':
                const deliveryCharge = message.text;
                // if entered product price is valid
                const isValidDeliveryCharge = validator.isNumeric(deliveryCharge) && !validator.matches(deliveryCharge, /[^0-9]/g);
                if (!isValidDeliveryCharge) {
                    currTasks = [];
                    newProduct = {};
                    newDeliveryPartner = {};
                    await bot.sendMessage(chatId, 'Enter valid delivery charges per km (in number)');
                    await sendHomeScreenOptions(chatId);
                } else {
                    newDeliveryPartner['charges'] = deliveryCharge;
                    await User.create({
                        chatId,
                        name: newDeliveryPartner.name,
                        role: 'deliveryPartner',
                        charges: newDeliveryPartner.charges
                    });
                    await bot.sendMessage(chatId, `You have successfully registered as a delivery partner 🛵 for Frosty Delights. \n\nYou'll get orders for delivery when owner assigns them to you.\n\nHave a sweet day! 🍨`);
                }
                break;

            case 'enterDeliveryDistance':
                let deliveryDistance = message.text;
                // if entered product price is valid
                const isDeliveryDistance = validator.isNumeric(deliveryDistance) && !validator.matches(deliveryDistance, /[^0-9]/g);
                if (!isDeliveryDistance) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Enter a valid delivery distance (in km)');
                    await sendHomeScreenOptions(chatId);
                } else {
                    deliveryDistance = +deliveryDistance;
                    const deliveryPartners = await User.find({ role: 'deliveryPartner' }).sort({ charges: 1 });
                    let deliveryPartnerOptions = [];
                    for (let i = 0; i < deliveryPartners.length; i++) {
                        let currDeliveryPartner = [];
                        currDeliveryPartner.push(`${deliveryPartners[i].name} - ${deliveryPartners[i].charges * deliveryDistance} Rs.`);
                        currDeliveryPartner.push(`DPC ${i}`);
                        deliveryPartnerOptions.push(currDeliveryPartner);
                    }
                    bot.sendMessage(chatId, `Following are the delivery partners and their charges.\n\nSelect Delivery Partner to dispatch the order with:`, {
                        reply_markup: {
                            inline_keyboard: deliveryPartnerOptions.map(([text, callback_data]) => ([
                                { text, callback_data }
                            ])),
                        },
                    });
                }
                break;

            case 'productQuantityToUpdate':
                const enteredProductQuantity = message.text;
                const isValidProductQuantity = validator.isNumeric(enteredProductQuantity) && !validator.matches(enteredProductQuantity, /[^0-9]/g);
                if (!isValidProductQuantity) {
                    currTasks = [];
                    newProduct = {};
                    await bot.sendMessage(chatId, 'Enter a valid quantity to add (in number)');
                    await sendHomeScreenOptions(chatId);
                } else {
                    const productToUpdate = await Product.findById(productQuantityUpdateId);
                    await Product.findByIdAndUpdate(productQuantityUpdateId, { quantity: productToUpdate.quantity + (+enteredProductQuantity) });
                    bot.sendMessage(chatId, `Product quantity updated successfully. ${productToUpdate.name} by ${productToUpdate.brand} - ${productToUpdate.quantity + (+enteredProductQuantity)} available`);
                    bot.sendMessage(chatId, `Please choose an option`, {
                        reply_markup: {
                            inline_keyboard: ownerOptions.map(([text, callback_data]) => ([
                                { text, callback_data }
                            ])),
                        },
                    });
                }
                currTasks.pop();
                break;

            default:
                currTasks = [];
                newProduct = {};
                await bot.sendMessage(chatId, 'Wrong Input');
                await sendHomeScreenOptions(chatId);
                break;

        }
    }

});

// listen for callbacks from the list
bot.on('callback_query', async (callbackQuery) => {

    const chatId = callbackQuery.message.chat.id;
    const optionValue = callbackQuery.data;

    if (optionValue.split(' ')[0] === "PO") {
        currProductId = optionValue.split(' ')[1];
        currProduct = await Product.findById(currProductId);
        await bot.sendMessage(chatId, 'Your selection is: ' + currProduct.name + ' by ' + currProduct.brand + ' - ' + currProduct.quantity + ' units available');
        await bot.sendMessage(chatId, `Enter the number of ${currProduct.name} ice cream you'd like to order`);
        currTasks.push('enterQuantityRequired');
    }

    else if (optionValue.split(' ')[0] === 'TAN') {
        await bot.sendMessage(chatId, 'Enter a new address having details about house no., floor, wing, society, area name and city.');
        currTasks.push('enterNewDeliveryAddress');
    } else if (optionValue.split(' ')[0] === 'TA') {
        const deliveryAddressIdx = optionValue.split(' ')[1];
        user = await User.findOne({ chatId });
        const deliveryAddress = user.address[deliveryAddressIdx];
        await Purchase.updateOne({ chatId }, { address: deliveryAddress }, { new: true });
        let orderStr = "";
        const finalOrder = await Purchase.findOne({ chatId }).populate('products.productId');
        if (!finalOrder) {
            await bot.sendMessage(chatId, 'Add some items before placing an order.');
            sendHomeScreenOptions(chatId);
        } else {
            for (const productObj of finalOrder.products) {
                orderStr += (`${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                orderStr += '\n';
            }
            orderStr += `\nTotal Items: ${finalOrder.totalItems}`;
            orderStr += `\nTotal Order Price: ${finalOrder.totalOrderPrice} Rs.`;
            orderStr += `\n\nDelivery Address: ${finalOrder.address}`;
            const currOrder = await Purchase.findOne({ chatId });
            await Order.create({
                chatId,
                products: currOrder.products,
                totalItems: currOrder.totalItems,
                totalOrderPrice: currOrder.totalOrderPrice,
                orderType: 'delivery',
                address: currOrder.address
            });
            await bot.sendMessage(chatId, `Order Placed:\n\n${orderStr}`);
            await bot.sendMessage(chatId, 'Order will be dispatched as soon as a delivery partner 🛵 is assigned by the owner.\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨');
            await Purchase.deleteOne({ chatId });
        }

    }

    else if (optionValue.split(' ')[0] === 'AODel') {
        let orderId = optionValue.split(' ')[1];
        toBeDispatchedOrder = await Order.findById(orderId).populate('products.productId');
        if (toBeDispatchedOrder) {
            await bot.sendMessage(chatId, 'Enter the delivery distance (in km)');
            currTasks.push('enterDeliveryDistance');
        }
    }

    else if (optionValue.split(' ')[0] === 'DODel') {
        let orderId = optionValue.split(' ')[1];
        toBeDispatchedOrder = await Order.findById(orderId).populate('products.productId');
        const custChatId = toBeDispatchedOrder.chatId;
        let completeOrderStr = "";
        const productsObjArr = toBeDispatchedOrder.products;
        const totalItems = toBeDispatchedOrder.totalItems;
        const totalOrderPrice = toBeDispatchedOrder.totalOrderPrice;
        completeOrderStr += (`Order Declined ❌. Sorry, following order cannot be dispatched.\n`);
        for (const productObj of productsObjArr) {
            completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
        }
        completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
        completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.\n\n`);
        completeOrderStr += (`\nDelivery Address: ${toBeDispatchedOrder.address}`);

        completeOrderStr += (`\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨`);

        await bot.sendMessage(custChatId, completeOrderStr);
        await bot.sendMessage(chatId, 'Order declined.');
        await Order.findByIdAndDelete(orderId);

        await bot.sendMessage(chatId, 'Please choose an option:', {
            reply_markup: {
                inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
            },
        });
    }

    else if (optionValue.split(' ')[0] === 'AOP') {
        let orderId = optionValue.split(' ')[1];
        toBeDispatchedOrder = await Order.findById(orderId).populate('products.productId');
        const custChatId = toBeDispatchedOrder.chatId;
        let completeOrderStr = "";
        const productsObjArr = toBeDispatchedOrder.products;
        const totalItems = toBeDispatchedOrder.totalItems;
        const totalOrderPrice = toBeDispatchedOrder.totalOrderPrice;
        completeOrderStr += (`Order Accepted ✅. This is a confimation message that you can pickup your order from Frosty Delights any time from 11 am to 9 pm\n\n`);
        for (const productObj of productsObjArr) {
            completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
        }
        completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
        completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.\n\n`);

        completeOrderStr += (`\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨`);

        await bot.sendMessage(custChatId, completeOrderStr);
        await bot.sendMessage(chatId, 'Order accepted.');
        await Order.findByIdAndDelete(orderId);

        await bot.sendMessage(chatId, 'Please choose an option:', {
            reply_markup: {
                inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
            },
        });
    }

    else if (optionValue.split(' ')[0] === 'DOP') {
        let orderId = optionValue.split(' ')[1];
        toBeDispatchedOrder = await Order.findById(orderId).populate('products.productId');
        const custChatId = toBeDispatchedOrder.chatId;
        let completeOrderStr = "";
        const productsObjArr = toBeDispatchedOrder.products;
        const totalItems = toBeDispatchedOrder.totalItems;
        const totalOrderPrice = toBeDispatchedOrder.totalOrderPrice;
        completeOrderStr += (`Order Delined ❌. Sorry, we cannot fulfill the following pickup order.\n\n`);
        for (const productObj of productsObjArr) {
            completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
        }
        completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
        completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.\n\n`);

        completeOrderStr += (`\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨`);

        await bot.sendMessage(custChatId, completeOrderStr);
        await bot.sendMessage(chatId, 'Order declined.');
        await Order.findByIdAndDelete(orderId);

        await bot.sendMessage(chatId, 'Please choose an option:', {
            reply_markup: {
                inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
            },
        });
    }

    else if (optionValue.split(' ')[0] === 'DPC') {
        let deliveryPartnerIdx = optionValue.split(' ')[1];
        deliveryPartnerIdx = +deliveryPartnerIdx;
        const deliveryPartners = await User.find({ role: 'deliveryPartner' }).sort({ charges: 1 });
        const currDeliveryPartner = deliveryPartners[deliveryPartnerIdx];

        if (toBeDispatchedOrder) {
            const productsObjArr = toBeDispatchedOrder.products;
            const totalItems = toBeDispatchedOrder.totalItems;
            const totalOrderPrice = toBeDispatchedOrder.totalOrderPrice;
            let completeOrderStr = "";
            let completeOrderStrDel = "";
            let completeOrderStrCust = "";
            completeOrderStrDel += (`New Order to Deliver  📦\n`);
            completeOrderStrCust += (`Order Dispatched 🛵. Following order is dispatched with ${currDeliveryPartner.name} and will reach you soon.\n`);
            for (const productObj of productsObjArr) {
                completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
            }
            completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
            completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.\n\n`);
            completeOrderStr += (`\nDelivery Address: ${toBeDispatchedOrder.address}`);

            completeOrderStrDel += completeOrderStr;
            completeOrderStrCust += completeOrderStr;
            completeOrderStrCust += (`\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨`);

            await Order.findByIdAndDelete(toBeDispatchedOrder.id);

            await bot.sendMessage(currDeliveryPartner.chatId, `${completeOrderStrDel}`);
            await bot.sendMessage(chatId, 'Order Accepted');
            await bot.sendMessage(toBeDispatchedOrder.chatId, `${completeOrderStrCust}`);
            await Order.findByIdAndDelete(toBeDispatchedOrder.id);

            await bot.sendMessage(chatId, 'Please choose an option:', {
                reply_markup: {
                    inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                },
            });
        }

    }

    else if (optionValue.split(' ')[0] === 'UPQ') {
        productQuantityUpdateId = optionValue.split(' ')[1];
        const currProductQuantityToUpdate = await Product.findById(productQuantityUpdateId);
        await bot.sendMessage(chatId, `Enter the number of ${currProductQuantityToUpdate.name} to add`);
        currTasks.push(`productQuantityToUpdate`);
    }

    else {

        switch (optionValue) {

            case 'placeOrder':
                const products = await Product.find().sort({ price: 1 });
                if (products.length === 0) {
                    await bot.sendMessage(chatId, 'No ice creams available at the moment.');
                } else {
                    let productOptions = [];
                    for (const product of products) {
                        let currProduct = [];
                        const productDetailsStr = product.name + " by " + product.brand + " for " + product.price + " Rs. per " + product.weight + " grams";
                        currProduct.push(productDetailsStr);
                        currProduct.push(('PO ' + product.id));
                        productOptions.push(currProduct);
                    }
                    await bot.sendMessage(chatId, `Select the flavor and the brand you'd like to order:`, {
                        reply_markup: {
                            inline_keyboard: productOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                        },
                    });
                }
                break;

            case 'registerAsDelPartner':
                await bot.sendMessage(chatId, 'Enter your name');
                currTasks.push('enterDeliveryPartnerName');
                break;

            case 'signInAsOwner':
                currTasks.push('enterOwnerPassword');
                await bot.sendMessage(chatId, 'Enter password\n\n\nType /start to return');
                break;


            case 'viewOrders':
                // Fetch orders from DB and display here
                const orders = await Order.find({ orderType: 'delivery' }).populate('products.productId');
                if (orders.length === 0) {
                    await bot.sendMessage(chatId, 'No orders for delivery found.');
                } else {
                    let orderOptions = [];
                    let completeOrderStr = "";

                    for (let i = 0; i < orders.length; i++) {
                        let currOrder = [];
                        currOrder.push(`Accept Order ${i + 1}`);
                        currOrder.push(`AODel ${orders[i].id}`);
                        orderOptions.push(currOrder);
                        currOrder = [];
                        currOrder.push(`Deline Order ${i + 1}`);
                        currOrder.push(`DODel ${orders[i].id}`);
                        orderOptions.push(currOrder);
                        const productsObjArr = orders[i].products;
                        const totalItems = orders[i].totalItems;
                        const totalOrderPrice = orders[i].totalOrderPrice;
                        completeOrderStr += (`Order ${i + 1} :\n`);
                        for (const productObj of productsObjArr) {
                            completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                        }
                        completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
                        completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.`);
                        completeOrderStr += (`\n\nDelivery Address: ${orders[i].address}\n\n\n`);
                    }
                    bot.sendMessage(chatId, `${completeOrderStr}\nSelect the order to accept or decline:`, {
                        reply_markup: {
                            inline_keyboard: orderOptions.map(([text, callback_data]) => ([
                                { text, callback_data }
                            ])),
                        },
                    });
                }
                break;

            case 'viewOrdersForPickup':
                // Fetch orders from DB and display here
                const ordersForPickup = await Order.find({ orderType: 'pickup' }).populate('products.productId');
                if (ordersForPickup.length === 0) {
                    await bot.sendMessage(chatId, 'No orders for pickup found.');
                } else {
                    let orderOptions = [];
                    let completeOrderStr = "";
                    for (let i = 0; i < ordersForPickup.length; i++) {
                        let currOrder = [];
                        currOrder.push(`Accept Order ${i + 1}`);
                        currOrder.push(`AOP ${ordersForPickup[i].id}`);
                        orderOptions.push(currOrder);
                        currOrder = [];
                        currOrder.push(`Decline Order ${i + 1}`);
                        currOrder.push(`DOP ${ordersForPickup[i].id}`);
                        orderOptions.push(currOrder);
                        const productsObjArr = ordersForPickup[i].products;
                        const totalItems = ordersForPickup[i].totalItems;
                        const totalOrderPrice = ordersForPickup[i].totalOrderPrice;
                        completeOrderStr += (`Order ${i + 1} :\n`);
                        for (const productObj of productsObjArr) {
                            completeOrderStr += (`\n${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                        }
                        completeOrderStr += (`\n\nTotal Items: ${totalItems}`);
                        completeOrderStr += (`\nTotal Price: ${totalOrderPrice} Rs.\n\n`);
                    }
                    bot.sendMessage(chatId, `${completeOrderStr}\nSelect the order to accept or decline:`, {
                        reply_markup: {
                            inline_keyboard: orderOptions.map(([text, callback_data]) => ([
                                { text, callback_data }
                            ])),
                        },
                    });
                }
                break;

            case 'addProduct':
                await bot.sendMessage(chatId, 'Enter flavor name');
                currTasks.push('enterProductName');
                break;

            case 'confirmAddProduct':
                await Product.create({
                    name: newProduct.name,
                    price: newProduct.price,
                    quantity: newProduct.quantity,
                    weight: newProduct.weight,
                    brand: newProduct.brand
                });
                await bot.sendMessage(chatId, 'Ice cream added successfully');
                // listen for incoming messages
                await bot.sendMessage(chatId, 'Please choose an option:', {
                    reply_markup: {
                        inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case 'cancelAddProduct':
                // listen for incoming messages
                await bot.sendMessage(chatId, 'Please choose an option:', {
                    reply_markup: {
                        inline_keyboard: ownerOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case 'addProductToOrder':
                const products2 = await Product.find().sort({ price: 1 });
                let productOptions2 = [];
                for (const product of products2) {
                    let currProduct = [];
                    const productDetailsStr = product.name + " by " + product.brand + " for " + product.price + " Rs. per " + product.weight + " grams";
                    currProduct.push(productDetailsStr);
                    currProduct.push(('PO ' + product.id));
                    productOptions2.push(currProduct);
                }
                await bot.sendMessage(chatId, `Select the flavor and brand you'd like to order:`, {
                    reply_markup: {
                        inline_keyboard: productOptions2.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case 'placeFinalOrder':
                const delOptions = [
                    ['Pickup', 'placeFinalOrderPickup'],
                    ['Delivery', 'placeFinalOrderDel']
                ];
                await bot.sendMessage(chatId, 'Select pickup/delivery:', {
                    reply_markup: {
                        inline_keyboard: delOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case 'placeFinalOrderPickup':
                let orderStr = "";
                const finalOrderPickup = await Purchase.findOne({ chatId }).populate('products.productId');
                if (!finalOrderPickup) {
                    await bot.sendMessage(chatId, 'Add some items before placing an order.');
                    sendHomeScreenOptions(chatId);
                } else {
                    for (const productObj of finalOrderPickup.products) {
                        orderStr += (`${productObj.productId.name} x ${productObj.quantity} - ${productObj.totalPrice} Rs.`);
                        orderStr += '\n';
                    }
                    orderStr += `\nTotal Items: ${finalOrderPickup.totalItems}`;
                    orderStr += `\nTotal Order Price: ${finalOrderPickup.totalOrderPrice} Rs.`;
                    orderStr += `\n\nAfter you get a confimation message from us, you can pickup your order from Frosty Delights any time from 11 am to 9 pm\n\nThank you for choosing Frosty Delights. Have a sweet day! 🍨`;
                    await bot.sendMessage(chatId, `Order Placed:\n\n${orderStr}`);
                    await Order.create({
                        chatId,
                        products: finalOrderPickup.products,
                        totalItems: finalOrderPickup.totalItems,
                        totalOrderPrice: finalOrderPickup.totalOrderPrice,
                        orderType: 'pickup'
                    })
                    await Purchase.deleteOne({ chatId });
                }
                break;

            case 'placeFinalOrderDel':
                const finalOrder = await Purchase.findOne({ chatId }).populate('products.productId');
                if (!finalOrder) {
                    await bot.sendMessage(chatId, 'Add some items before placing an order.');
                    sendHomeScreenOptions(chatId);
                }

                else {
                    user = await User.findOne({ chatId });
                    const userAddresses = user.address;
                    let addressOptions = [];
                    for (let i = 0; i < userAddresses.length; i++) {
                        let currAddress = [];
                        currAddress.push(userAddresses[i]);
                        currAddress.push('TA ' + i);
                        addressOptions.push(currAddress);
                    }

                    addressOptions.push(['Add new address', 'TAN']);

                    await bot.sendMessage(chatId, 'Select or add a new address:', {
                        reply_markup: {
                            inline_keyboard: addressOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                        },
                    });
                }

                break;

            case 'updateProductQuantity':
                const allProducts = await Product.find().sort({ price: 1 });
                const productOptions = [];
                for (const product of allProducts) {
                    const currProduct = [];
                    currProduct.push(`${product.name} by ${product.brand} - ${product.quantity} Remaining`);
                    currProduct.push(`UPQ ${product.id}`);
                    productOptions.push(currProduct);
                }
                await bot.sendMessage(chatId, 'Select the product to update the quantity:', {
                    reply_markup: {
                        inline_keyboard: productOptions.map(([text, callback_data]) => ([{ text, callback_data }])),
                    },
                });
                break;

            case '':

                break;

            default:
                currTasks = [];
                newProduct = {};
                await bot.sendMessage(chatId, 'Wrong Input');
                await sendHomeScreenOptions(chatId);
                break;

        }
    }

});


// connect to database
connectToDB();

// specifying port to start the server
const port = process.env.PORT || 5000;

app.listen(port || 5000, () => {
    console.log(`App listening on port ${port}`);
});