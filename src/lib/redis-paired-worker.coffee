constants = require './constants'
debug = (require 'debug')(constants.DEBUGKEY)
extend = require 'node.extend'
RedisLock = require './redis-lock'

defaultConfig =
    lockTimeout: 100
    firstAttemptInterval: 10
    otherAttemptInterval: 30
    clientErrorPolicy: RedisLock.onError

class RedisPairedWorker
    constructor: (config) ->
        @config = extend {}, defaultConfig, config

    # Try lock
    # `client`: A redis client instance.
    # `lockName`: Any name for a lock. Must follw redis' key naming rules.
    # `payload`: (Optional) Any data which will be passed to `callback` function.
    # `callback`: The function to call when the attempt has finished.
    lock: (client, lockName, payload, callback) ->
        debug "lock() begin '#{lockName}'"

        if callback is undefined
            callback = payload
            payload = null

        lockInfo =
            instance: this
            client: client
            key: "lock." + lockName
            expiry: Date.now() + @config.lockTimeout
            payload: payload
            callback: callback
            status: constants.STATUS_SELF_UNDONE

        RedisLock.acquireLock lockInfo, 1
        return

module.exports = RedisPairedWorker
