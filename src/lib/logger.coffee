# logger

logger = null

module.exports.verbose = () ->
    logger?.verbose and logger.verbose.apply logger, arguments

module.exports.setLogger = (newLogger) ->
    logger = newLogger
