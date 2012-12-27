constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

LockStatus = require './lock-status'
RedisHashLockNotifier = require './redis-hash-lock-notifier'

class RedisHashLock
    @acquireLock: (lockInfo, attempt) ->
        debug "['%s . %s' #%d] begin locking", lockInfo.key, lockInfo.field, attempt

        lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_UNDONE
        lockInfo.client.hsetnx lockInfo.key, lockInfo.field, lockValue, (error, result) ->
            if error
                debug "['%s . %s' #%d] error on redis.setnx: #{util.inspect error}", lockInfo.key, lockInfo.field, attempt
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            if result is 1
                debug "['%s . %s' #%d] acquired lock", lockInfo.key, lockInfo.field, attempt
                RedisHashLockNotifier.acquired lockInfo
            else
                RedisHashLock.checkLock lockInfo, attempt
            return

    @checkLock: (lockInfo, attempt) ->
        # Check if the opposite has completed its job
        lockInfo.client.hget lockInfo.key, lockInfo.field, (error, lockValue) =>
            if error
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            lockStatus = LockStatus.parse lockValue
            debug "['%s . %s' #%d] lockStatus = %s, lockValue = %s", lockInfo.key, lockInfo.field, attempt, util.inspect(lockStatus), lockValue
            if lockStatus.sentinel is constants.SENTINEL_JOB_DONE
                debug "['%s . %s' #%d] opposite has completed its job successfully", lockInfo.key, lockInfo.field, attempt
                RedisHashLockNotifier.oppsiteHasCompleted lockInfo, false, attempt
                return

            now = (new Date()).getTime()

            # Check if the lock has been expired.
            # If true, then delete the lock and retry immediately
            if lockStatus.expiry <= now
                debug "['%s' #%d] the lock has been expired; opposite may have crushed during job", lockInfo.key, attempt
                lockInfo.client.hdel lockInfo.key, lockInfo.field, (error) =>
                    if error
                        lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                        return
                    @acquireLock lockInfo, attempt + 1
                return

            # If opposite had tried to do the task but failed, this process would fail, too.
            # So let it be untouch.
            if lockStatus.sentinel is constants.SENTINEL_JOB_FAIL
                debug "['%s . %s' #%d] opposite had failed to complete its job. Do nothing", lockInfo.key, lockInfo.field, attempt
                RedisHashLockNotifier.oppositeHasFailed lockInfo
                return

            # Retry
            interval = if attempt is 1
                Math.min lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval
            else
                Math.min lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval

            debug "['%s . %s' #%d] retry, waits #{interval}ms", lockInfo.key, lockInfo.field, attempt
            setTimeout () ->
                RedisHashLock.acquireLock lockInfo, attempt + 1
            , interval
            return
    
    # Default behavior on redis.setnx failure.
    @onError: (error, lockInfo, attempt) ->
        return RedisHashLockNotifier.errorOccurred error, lockInfo

module.exports = RedisHashLock
