constants = require './constants'
logger = require './logger'
util = require 'util'

LockStatus = require './lock-status'
RedisLockNotifier = require './redis-lock-notifier'

class RedisLock
    @acquireLock: (lockInfo, attempt) ->
        logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} begin locking"

        lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_UNDONE
        lockInfo.client.setnx lockInfo.key, lockValue, (error, result) ->
            if error
                logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} error on redis.setnx: #{util.inspect error}"
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            if result is 1
                logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} acquired lock", lockInfo.key, attempt
                RedisLockNotifier.acquired lockInfo
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
            logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} lockStatus = #{util.inspect(lockStatus)}, lockValue = #{lockValue}"
            if lockStatus.sentinel is constants.SENTINEL_JOB_DONE
                logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} opposite has completed its job successfully"
                RedisLockNotifier.oppsiteHasCompleted lockInfo, false, attempt
                return

            now = (new Date()).getTime()

            # Check if the lock has been expired.
            # If true, then delete the lock and retry immediately
            if lockStatus.expiry <= now
                logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} the lock has been expired; opposite may have crushed during job"
                lockInfo.client.del lockInfo.key, (error) =>
                    if error
                        lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                        return
                    @acquireLock lockInfo, attempt + 1
                return

            # If opposite had tried to do the task but failed, this process would fail, too.
            # So let it be untouch.
            if lockStatus.sentinel is constants.SENTINEL_JOB_FAIL
                logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} opposite had failed to complete its job. Do nothing"
                RedisLockNotifier.oppositeHasFailed lockInfo
                return

            # Retry
            interval = if attempt is 1
                Math.min lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval
            else
                Math.min lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval

            logger.verbose "[rpw:#{lockInfo.key}] ##{attempt} retry, waits #{interval}ms"
            setTimeout () ->
                RedisLock.acquireLock lockInfo, attempt + 1
            , interval
            return
    
    # Default behavior on redis.setnx failure.
    @onError: (error, lockInfo, attempt) ->
        return RedisLockNotifier.errorOccurred error, lockInfo

module.exports = RedisLock
