const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
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
        enum: ['delivery', 'pickup']
    },
    deliveryPartnerId: {
        type: String
    },
    address: {
        type: String
    }
});

const Purchase = new mongoose.model('Purchase', purchaseSchema);

module.exports = Purchase;