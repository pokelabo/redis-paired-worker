constants = require './constants'
logger = require './logger'
util = require 'util'

LockStatus = require './lock-status'

class RedisLockNotifier
    @acquired: (lockInfo) ->
        lockInfo.callback null, true, (succeeded) =>
            if succeeded
                logger.verbose "[rpw:#{lockInfo.key}] client has done the job; set the sentinel value DONE"
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_DONE
            else 
                logger.verbose "[rpw:#{lockInfo.key}] client has failed on the job; set the sentinel value FAIL"
                lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_FAIL
            lockInfo.client.set lockInfo.key, lockValue

    @oppsiteHasCompleted: (lockInfo) ->
        logger.verbose "[rpw:#{lockInfo.key}] opposite has done the job; delete the lock"
        lockInfo.client.del lockInfo.key
        lockInfo.callback null, false, () ->

    @oppositeHasFailed: (lockInfo) ->
        lockInfo.callback null, false, () ->

    @errorOccurred: (error, lockInfo) ->
        logger.verbose "[rpw:#{lockInfo.key}] error on acquiring lock: %s", util.inspect error
        lockInfo.callback error, false, () ->

module.exports = RedisLockNotifier
