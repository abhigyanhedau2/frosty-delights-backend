class AppError extends Error {

    constructor(statusCode, message) {

        // message is the only param that the 
        // built-in Error class accepts
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        // only send back true for operational errors and not for programming errors
        this.isOperational = true;

        // To get the stack trace which tells us where the error occurred
        Error.captureStackTrace(this, this.constructor);

    }

};

module.exports = AppError;