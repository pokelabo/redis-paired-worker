constants = require './constants'
logger = require './logger'
util = require 'util'

LockStatus = require './lock-status'
RedisHashLockNotifier = require './redis-hash-lock-notifier'

class RedisHashLock
    @acquireLock: (lockInfo, attempt) ->
        logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} begin locking"

        lockValue = LockStatus.stringify lockInfo.expiry, constants.SENTINEL_JOB_UNDONE
        lockInfo.client.hsetnx lockInfo.key, lockInfo.field, lockValue, (error, result) ->
            if error
                logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} error on redis.setnx: #{util.inspect error}"
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            if result is 1
                logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} acquired lock"
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
            logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} lockStatus = %s, lockValue = %s", util.inspect(lockStatus), lockValue
            if lockStatus.sentinel is constants.SENTINEL_JOB_DONE
                logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} opposite has completed its job successfully"
                RedisHashLockNotifier.oppsiteHasCompleted lockInfo, false, attempt
                return

            now = (new Date()).getTime()

            # Check if the lock has been expired.
            # If true, then delete the lock and retry immediately
            if lockStatus.expiry <= now
                logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] the lock has been expired; opposite may have crushed during job"
                lockInfo.client.hdel lockInfo.key, lockInfo.field, (error) =>
                    if error
                        lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                        return
                    @acquireLock lockInfo, attempt + 1
                return

            # If opposite had tried to do the task but failed, this process would fail, too.
            # So let it be untouch.
            if lockStatus.sentinel is constants.SENTINEL_JOB_FAIL
                logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} opposite had failed to complete its job. Do nothing"
                RedisHashLockNotifier.oppositeHasFailed lockInfo
                return

            # Retry
            interval = if attempt is 1
                Math.min lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval
            else
                Math.min lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval

            logger.verbose "[rpw:#{lockInfo.key}:#{lockInfo.field}] ##{attempt} retry, waits #{interval}ms"
            setTimeout () ->
                RedisHashLock.acquireLock lockInfo, attempt + 1
            , interval
            return
    
    # Default behavior on redis.setnx failure.
    @onError: (error, lockInfo, attempt) ->
        return RedisHashLockNotifier.errorOccurred error, lockInfo

module.exports = RedisHashLock
