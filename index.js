module.exports = require('./lib/redis-paired-worker');

module.exports.setLogger = function(logger) {
    require('./lib/logger').setLogger(logger);
};
