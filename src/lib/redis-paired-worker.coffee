constants = require './constants'
debug = (require 'debug')(constants.DEBUGKEY)
extend = require 'node.extend'
RedisLock = require './redis-lock'
RedisHashLock = require './redis-hash-lock'

defaultConfig =
    keyPrefix: 'lock:'
    lockTimeout: 100 * 1000
    firstAttemptInterval: 10 * 1000
    otherAttemptInterval: 30 * 1000
    clientErrorPolicy: RedisLock.onError

class RedisPairedWorker
    constructor: (config) ->
        @config = extend {}, defaultConfig, config

    # Try lock
    # `client`: A redis client instance.
    # `lockName`: Any name for a lock. Must follow redis' key naming rules.
    # `callback`: The function to call when the attempt has finished.
    lock: (client, lockName, callback) ->
        debug "['%s'] lock() start --->", lockName

        lockInfo =
            instance: this
            client: client
            key: (@config.keyPrefix || '') + lockName
            expiry: Date.now() + @config.lockTimeout
            callback: callback

        RedisLock.acquireLock lockInfo, 1
        return

    # Try lock using a hash
    # `client`: A redis client instance.
    # `key`: hash key which will contain lock(s). Must follow redis' key naming rules.
    # `field`: field name for a lock. Must follw redis' key naming rules.
    # `callback`: The function to call when the attempt has finished.
    hlock: (client, key, field, callback) ->
        debug "['%s'.%s] lock() start --->", key, field

        lockInfo =
            instance: this
            client: client
            key: (@config.keyPrefix || '') + key
            field: field
            expiry: Date.now() + @config.lockTimeout
            callback: callback

        RedisHashLock.acquireLock lockInfo, 1
        return

module.exports = RedisPairedWorker
