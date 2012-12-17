(function() {
  var RedisLock, ResultNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  ResultNotifier = require('./result-notifier');

  RedisLock = (function() {

    function RedisLock() {}

    RedisLock.acquireLock = function(lockInfo, attempt) {
      debug("try to lock for '" + lockInfo.key + "' #" + attempt);
      return lockInfo.client.setnx(lockInfo.key, lockInfo.expiry, function(error, result) {
        if (error) {
          debug("error on redis.setnx for '" + lockInfo.key + "' #" + attempt + ": " + (util.inspect(error)));
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        if (result === 1) {
          lockInfo.status = constants.STATUS_SELF_LOCKED;
          ResultNotifier.acquired(lockInfo);
          return;
        }
        RedisLock.checkLock(lockInfo, attempt);
      });
    };

    RedisLock.checkLock = function(lockInfo, attempt) {
      return lockInfo.client.get(lockInfo.key, function(error, result) {
        var interval, lockValue, now;
        if (error) {
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        lockValue = parseFloat(result);
        if (lockValue === constants.SENTINEL_JOB_DONE) {
          debug("opposite has completed its job successfully for '" + lockInfo.key + "'");
          lockInfo.status = constants.STATUS_OPPOSITE_DONE;
          ResultNotifier.oppsiteHasCompleted(lockInfo, false, attempt);
          return;
        }
        if (lockValue === constants.SENTINEL_JOB_FAIL) {
          debug("opposite had acquired lock but failed to complete its job for '" + lockInfo.key + "'");
          lockInfo.status = constants.STATUS_OPPOSITE_FAIL;
          ResultNotifier.acquiredAfterOppositeFail(lockInfo);
          return;
        }
        now = (new Date()).getTime();
        if (lockInfo.expiry <= now) {
          debug("opposite may have crushed during job for '" + lockInfo.key + "'");
          lockInfo.status = constants.STATUS_OPPOSITE_FAIL;
          ResultNotifier.acquiredAfterOppositeFail(lockInfo);
          return;
        }
        interval = attempt === 1 ? Math.min(lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval) : Math.min(lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval);
        debug("retry for '" + lockInfo.key + "', waits " + interval + "ms");
        setTimeout(function() {
          return RedisLock.acquireLock(lockInfo, attempt + 1);
        }, interval);
      });
    };

    RedisLock.onError = function(error, lockInfo, attempt) {
      debug("error occurred for '" + lockInfo.key + "' #" + attempt + ": " + (util.inspect(error)));
      return ResultNotifier.errorOccurred(error, lockInfo);
      if (attempt === 1) {
        process.nextTick(function() {
          return RedisLock.acquireLock(lockInfo, attempt + 1);
        });
      } else {
        ResultNotifier.errorOccurred(error, lockInfo);
      }
    };

    return RedisLock;

  })();

  module.exports = RedisLock;

}).call(this);
