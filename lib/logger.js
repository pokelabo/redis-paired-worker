(function() {
  var logger;

  logger = null;

  module.exports.verbose = function() {
    return (logger != null ? logger.verbose : void 0) && logger.verbose.apply(logger, arguments);
  };

  module.exports.setLogger = function(newLogger) {
    return logger = newLogger;
  };

}).call(this);
