(function() {
  var LockStatus, RedisLock, ResultNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  LockStatus = require('./lock-status');

  ResultNotifier = require('./result-notifier');

  RedisLock = (function() {

    function RedisLock() {}

    RedisLock.acquireLock = function(lockInfo, attempt) {
      var lockValue;
      debug("['%s' #%d] begin locking", lockInfo.key, attempt);
      lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_UNDONE);
      return lockInfo.client.setnx(lockInfo.key, lockValue, function(error, result) {
        if (error) {
          debug("['%s' #%d] error on redis.setnx: " + (util.inspect(error)), lockInfo.key, attempt);
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        if (result === 1) {
          debug("['%s' #%d] acquired lock", lockInfo.key, attempt);
          ResultNotifier.acquired(lockInfo);
        } else {
          RedisLock.checkLock(lockInfo, attempt);
        }
      });
    };

    RedisLock.checkLock = function(lockInfo, attempt) {
      var _this = this;
      return lockInfo.client.get(lockInfo.key, function(error, lockValue) {
        var interval, lockStatus, now;
        if (error) {
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        lockStatus = LockStatus.parse(lockValue);
        console.log("lockValue = ", lockValue);
        console.log("lockStatus = ", lockStatus);
        if (lockStatus.sentinel === constants.SENTINEL_JOB_DONE) {
          debug("['%s' #%d] opposite has completed its job successfully", lockInfo.key, attempt);
          ResultNotifier.oppsiteHasCompleted(lockInfo, false, attempt);
          return;
        }
        now = (new Date()).getTime();
        if (lockStatus.expiry <= now) {
          debug("['%s' #%d] the lock has been expired; opposite may have crushed during job", lockInfo.key, attempt);
          lockInfo.client.del(lockInfo.key, function(error) {
            if (error) {
              lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
              return;
            }
            return this.acquireLock(lockInfo, attempt + 1);
          });
          return;
        }
        if (lockStatus.sentinel === constants.SENTINEL_JOB_FAIL) {
          debug("['%s' #%d] opposite had failed to complete its job. Do nothing", lockInfo.key, attempt);
          ResultNotifier.oppositeHasFailed(lockInfo);
          return;
        }
        interval = attempt === 1 ? Math.min(lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval) : Math.min(lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval);
        debug("['%s' #%d] retry, waits " + interval + "ms", lockInfo.key, attempt);
        setTimeout(function() {
          return RedisLock.acquireLock(lockInfo, attempt + 1);
        }, interval);
      });
    };

    RedisLock.onError = function(error, lockInfo, attempt) {
      return ResultNotifier.errorOccurred(error, lockInfo);
    };

    return RedisLock;

  })();

  module.exports = RedisLock;

}).call(this);
