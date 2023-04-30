const express = require('express');
const bodyParser = require('body-parser');
const connectToDB = require('./utils/connectToDB');
const dotenv = require('dotenv');
const cors = require('cors');
const bot = require('./utils/bot');
const validator = require('validator');
dotenv.config();

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

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log(msg);
    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, 'Received your message');
});

// connect to database
connectToDB();

// specifying port to start the server
const port = process.env.PORT || 5000;

app.listen(port || 5000, () => {
    console.log(`App listening on port ${port}`);
});