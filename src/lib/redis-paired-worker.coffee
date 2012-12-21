constants = require './constants'
debug = (require 'debug')(constants.DEBUGKEY)
extend = require 'node.extend'
RedisLock = require './redis-lock'

defaultConfig =
    lockTimeout: 100 * 1000
    firstAttemptInterval: 10 * 1000
    otherAttemptInterval: 30 * 1000
    clientErrorPolicy: RedisLock.onError

class RedisPairedWorker
    constructor: (config) ->
        @config = extend {}, defaultConfig, config

    # Try lock
    # `client`: A redis client instance.
    # `lockName`: Any name for a lock. Must follw redis' key naming rules.
    # `callback`: The function to call when the attempt has finished.
    lock: (client, lockName, callback) ->
        debug "['%s'] lock() start --->", lockName

        lockInfo =
            instance: this
            client: client
            key: "lock." + lockName
            expiry: Date.now() + @config.lockTimeout
            callback: callback

        RedisLock.acquireLock lockInfo, 1
        return

module.exports = RedisPairedWorker
