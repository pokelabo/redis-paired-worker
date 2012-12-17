constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

ResultNotifier = require './result-notifier'

class RedisLock
    @acquireLock: (lockInfo, attempt) ->
        debug "try to lock for '#{lockInfo.key}' ##{attempt}"
        lockInfo.client.setnx lockInfo.key, lockInfo.expiry, (error, result) ->
            if error
                debug "error on redis.setnx for '#{lockInfo.key}' ##{attempt}: #{util.inspect error}"
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            if result is 1
                lockInfo.status = constants.STATUS_SELF_LOCKED
                ResultNotifier.acquired lockInfo
                return
            
            RedisLock.checkLock lockInfo, attempt
            return

    @checkLock: (lockInfo, attempt) ->
        lockInfo.client.get lockInfo.key, (error, result) ->
            if error
                lockInfo.instance.config.clientErrorPolicy error, lockInfo, attempt
                return

            lockValue = parseFloat(result)
            if lockValue is constants.SENTINEL_JOB_DONE
                debug "opposite has completed its job successfully for '#{lockInfo.key}'"
                lockInfo.status = constants.STATUS_OPPOSITE_DONE
                ResultNotifier.oppsiteHasCompleted lockInfo, false, attempt
                return

            if lockValue is constants.SENTINEL_JOB_FAIL
                debug "opposite had acquired lock but failed to complete its job for '#{lockInfo.key}'"
                lockInfo.status = constants.STATUS_OPPOSITE_FAIL
                ResultNotifier.acquiredAfterOppositeFail lockInfo
                return

            now = (new Date()).getTime()
            if lockInfo.expiry <= now
                debug "opposite may have crushed during job for '#{lockInfo.key}'"
                lockInfo.status = constants.STATUS_OPPOSITE_FAIL
                ResultNotifier.acquiredAfterOppositeFail lockInfo
                return

            # retry
            interval = if attempt is 1
                Math.min lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval
            else
                Math.min lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval

            debug "retry for '#{lockInfo.key}', waits #{interval}ms"
            setTimeout () ->
                RedisLock.acquireLock lockInfo, attempt + 1
            , interval
            return
    
    # Default behavior on redis.setnx failure.
    # Retry lock only once. If it still fails then it gives up locking.
    @onError: (error, lockInfo, attempt) ->
        debug "error occurred for '#{lockInfo.key}' ##{attempt}: #{util.inspect error}"

        return ResultNotifier.errorOccurred error, lockInfo
        if attempt is 1
            process.nextTick () ->
                RedisLock.acquireLock lockInfo, attempt + 1
        else
            ResultNotifier.errorOccurred error, lockInfo
        return

module.exports = RedisLock
