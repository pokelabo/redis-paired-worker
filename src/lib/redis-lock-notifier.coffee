constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

LockStatus = require './lock-status'

class RedisLockNotifier
    @acquired: (lockInfo) ->
        lockInfo.callback null, true, (succeeded) =>
            if succeeded
                debug "['%s'] client has done the job; set the sentinel value DONE", lockInfo.key
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_DONE
            else 
                debug "['%s'] client has failed on the job; set the sentinel value FAIL", lockInfo.key
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_FAIL
            lockInfo.client.set lockInfo.key, lockValue

    @oppsiteHasCompleted: (lockInfo) ->
        debug "['%s'] opposite has done the job; delete the lock", lockInfo.key
        lockInfo.client.del lockInfo.key
        lockInfo.callback null, false, () ->

    @oppositeHasFailed: (lockInfo) ->
        lockInfo.callback null, false, () ->

    @errorOccurred: (error, lockInfo) ->
        debug "['%s'] error on acquiring lock: %s", lockInfo.key, util.inspect error
        lockInfo.callback error, false, () ->

module.exports = RedisLockNotifier
