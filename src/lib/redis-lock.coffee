constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

LockStatus = require './lock-status'
ResultNotifier = require './result-notifier'

class RedisLock
    @acquireLock: (lockInfo, attempt) ->
        debug "['%s' #%d] begin locking", lockInfo.key, attempt

        lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_UNDONE
        lockInfo.client.setnx lockInfo.key, lockValue, (error, result) ->
            if error
                debug "['%s' #%d] error on redis.setnx: #{util.inspect error}", lockInfo.key, attempt
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            if result is 1
                debug "['%s' #%d] acquired lock", lockInfo.key, attempt
                ResultNotifier.acquired lockInfo
            else
                RedisLock.checkLock lockInfo, attempt
            return

    @checkLock: (lockInfo, attempt) ->
        # Check if the opposite has completed its job
        lockInfo.client.get lockInfo.key, (error, lockValue) =>
            if error
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            lockStatus = LockStatus.parse lockValue
            console.log "lockValue = ", lockValue
            console.log "lockStatus = ", lockStatus
            if lockStatus.sentinel is constants.SENTINEL_JOB_DONE
                debug "['%s' #%d] opposite has completed its job successfully", lockInfo.key, attempt
                ResultNotifier.oppsiteHasCompleted lockInfo, false, attempt
                return

            now = (new Date()).getTime()

            # Check if the lock has been expired.
            # If true, then delete the lock and retry immediately
            if lockStatus.expiry <= now
                debug "['%s' #%d] the lock has been expired; opposite may have crushed during job", lockInfo.key, attempt
                lockInfo.client.del lockInfo.key, (error) ->
                    if error
                        lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                        return
                    @acquireLock lockInfo, attempt + 1
                return

            # If opposite had tried to do the task but failed, this process would fail, too.
            # So let it be untouch.
            if lockStatus.sentinel is constants.SENTINEL_JOB_FAIL
                debug "['%s' #%d] opposite had failed to complete its job. Do nothing", lockInfo.key, attempt
                ResultNotifier.oppositeHasFailed lockInfo
                return

            # Retry
            interval = if attempt is 1
                Math.min lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval
            else
                Math.min lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval

            debug "['%s' #%d] retry, waits #{interval}ms", lockInfo.key, attempt
            setTimeout () ->
                RedisLock.acquireLock lockInfo, attempt + 1
            , interval
            return
    
    # Default behavior on redis.setnx failure.
    @onError: (error, lockInfo, attempt) ->
        return ResultNotifier.errorOccurred error, lockInfo

module.exports = RedisLock
