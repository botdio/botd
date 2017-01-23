var mongoose = require('mongoose');

const MONGO_DB = process.env.DB || 'mongodb://localhost/botd';
mongoose.connect(MONGO_DB);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('mongodb connected')
});


module.exports = mongoose;