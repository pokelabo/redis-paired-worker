constants = require './constants'
debug = (require 'debug')('redis-pw')
util = require 'util'

class ResultNotifier
    @acquired: (lockInfo) ->
        debug "acquired lock for '#{lockInfo.key}'"
        lockInfo.callback null, true, lockInfo.payload, (succeeded) =>
            if succeeded
                debug "job for '#{lockInfo.key}' has been done; set the sentinel value DONE"
                lockInfo.client.set lockInfo.key, constants.SENTINEL_JOB_DONE
            else 
                debug "job for '#{lockInfo.key}' has been failed; set the sentinel value FAIL"
                lockInfo.client.set lockInfo.key, constants.SENTINEL_JOB_FAIL

    @acquiredAfterOppositeFail: (lockInfo) ->
        lockInfo.callback null, true, lockInfo.payload, (succeeded) =>
            if succeeded
                debug "job for '#{lockInfo.key}' has been done; delete the lock"
                lockInfo.client.del lockInfo.key
            else 
                debug "job for '#{lockInfo.key}' has been failed, too; delete the lock"
                lockInfo.client.del lockInfo.key

    @oppsiteHasCompleted: (lockInfo) ->
        debug "job for '#{lockInfo.key}' has been done by opposite; delete the lock"
        lockInfo.client.del lockInfo.key

        lockInfo.callback null, false, lockInfo.payload, () ->

    @errorOccurred: (error, lockInfo) ->
        debug "error on acquiring lock for '#{lockInfo.key}': #{util.inspect error}"
        if lockInfo.status is constants.STATUS_OPPOSITE_FAIL
            debug "delete the lock '#{lockInfo.key}'"
            lockInfo.client.del lockInfo.key
        else
            debug "set the sentinel value FAIL for '#{lockInfo.key}'"
            lockInfo.client.set constants.SENTINEL_JOB_FAIL
        lockInfo.callback error, false, lockInfo.payload, () ->

module.exports = ResultNotifier
