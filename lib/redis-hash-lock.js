(function() {
  var LockStatus, RedisHashLock, RedisHashLockNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisHashLockNotifier = require('./redis-hash-lock-notifier');

  RedisHashLock = (function() {

    function RedisHashLock() {}

    RedisHashLock.acquireLock = function(lockInfo, attempt) {
      var lockValue;
      debug("['%s . %s' #%d] begin locking", lockInfo.key, lockInfo.field, attempt);
      lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_UNDONE);
      return lockInfo.client.hsetnx(lockInfo.key, lockInfo.field, lockValue, function(error, result) {
        if (error) {
          debug("['%s . %s' #%d] error on redis.setnx: " + (util.inspect(error)), lockInfo.key, lockInfo.field, attempt);
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        if (result === 1) {
          debug("['%s . %s' #%d] acquired lock", lockInfo.key, lockInfo.field, attempt);
          RedisHashLockNotifier.acquired(lockInfo);
        } else {
          RedisHashLock.checkLock(lockInfo, attempt);
        }
      });
    };

    RedisHashLock.checkLock = function(lockInfo, attempt) {
      var _this = this;
      return lockInfo.client.hget(lockInfo.key, lockInfo.field, function(error, lockValue) {
        var interval, lockStatus, now;
        if (error) {
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        lockStatus = LockStatus.parse(lockValue);
        debug("['%s . %s' #%d] lockStatus = %s, lockValue = %s", lockInfo.key, lockInfo.field, attempt, util.inspect(lockStatus), lockValue);
        if (lockStatus.sentinel === constants.SENTINEL_JOB_DONE) {
          debug("['%s . %s' #%d] opposite has completed its job successfully", lockInfo.key, lockInfo.field, attempt);
          RedisHashLockNotifier.oppsiteHasCompleted(lockInfo, false, attempt);
          return;
        }
        now = (new Date()).getTime();
        if (lockStatus.expiry <= now) {
          debug("['%s' #%d] the lock has been expired; opposite may have crushed during job", lockInfo.key, attempt);
          lockInfo.client.hdel(lockInfo.key, lockInfo.field, function(error) {
            if (error) {
              lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
              return;
            }
            return _this.acquireLock(lockInfo, attempt + 1);
          });
          return;
        }
        if (lockStatus.sentinel === constants.SENTINEL_JOB_FAIL) {
          debug("['%s . %s' #%d] opposite had failed to complete its job. Do nothing", lockInfo.key, lockInfo.field, attempt);
          RedisHashLockNotifier.oppositeHasFailed(lockInfo);
          return;
        }
        interval = attempt === 1 ? Math.min(lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval) : Math.min(lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval);
        debug("['%s . %s' #%d] retry, waits " + interval + "ms", lockInfo.key, lockInfo.field, attempt);
        setTimeout(function() {
          return RedisHashLock.acquireLock(lockInfo, attempt + 1);
        }, interval);
      });
    };

    RedisHashLock.onError = function(error, lockInfo, attempt) {
      return RedisHashLockNotifier.errorOccurred(error, lockInfo);
    };

    return RedisHashLock;

  })();

  module.exports = RedisHashLock;

}).call(this);
