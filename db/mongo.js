var mongoose = require('mongoose');
const constants = require('../constants');

mongoose.connect(constants.DB);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('mongodb connected')
});


module.exports = mongoose;