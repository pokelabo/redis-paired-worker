constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

LockStatus = require './lock-status'

class RedisHashLockNotifier
    @acquired: (lockInfo) ->
        lockInfo.callback null, true, (succeeded) =>
            if succeeded
                debug "['%s . %s'] client has done the job; set the sentinel value DONE", lockInfo.key, lockInfo.field
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_DONE
            else 
                debug "['%s . %s'] client has failed on the job; set the sentinel value FAIL", lockInfo.key, lockInfo.field
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_FAIL
            lockInfo.client.hset lockInfo.key, lockInfo.field, lockValue

    @oppsiteHasCompleted: (lockInfo) ->
        debug "['%s . %s'] opposite has done the job; delete the lock", lockInfo.key, lockInfo.field
        lockInfo.client.hdel lockInfo.key, lockInfo.field, () ->
        lockInfo.callback null, false, () ->

    @oppositeHasFailed: (lockInfo) ->
        lockInfo.callback null, false, () ->

    @errorOccurred: (error, lockInfo) ->
        debug "['%s . %s'] error on acquiring lock: %s", lockInfo.key, lockInfo.field, util.inspect error
        lockInfo.callback error, false, () ->

module.exports = RedisHashLockNotifier
