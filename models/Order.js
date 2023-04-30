const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true
    },
    products: {
        type: [{
            productId: {
                type: mongoose.Schema.ObjectId,
                ref: 'Product',
            },
            quantity: {
                type: Number,
                required: true
            },
            totalPrice: {
                type: Number,
                required: true
            }
        }]
    },
    totalItems: {
        type: Number,
        required: true
    },
    totalOrderPrice: {
        type: Number,
        required: true
    },
    orderType: {
        type: String,
        required: true,
        enum: ['delivery', 'pickup']
    },
    deliveryPartnerId: {
        type: String
    },
    address: {
        type: String
    }
});

const Order = new mongoose.model('Order', orderSchema);

module.exports = Order;