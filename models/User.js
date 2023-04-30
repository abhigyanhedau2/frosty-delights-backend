const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
        default: 'user'
    },
    role: {
        type: String,
        required: true,
        enum: ['customer', 'owner', 'deliveryPartner']
    },
    address: {
        type: [{
            type: String
        }],
        default: []
    },
    charges: {
        type: Number
    }
});

const User = new mongoose.model('User', userSchema);

module.exports = User;