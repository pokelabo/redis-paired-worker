(function() {
  var LockStatus, RedisLock, RedisLockNotifier, constants, logger, util;

  constants = require('./constants');

  logger = require('./logger');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisLockNotifier = require('./redis-lock-notifier');

  RedisLock = (function() {

    function RedisLock() {}

    RedisLock.acquireLock = function(lockInfo, attempt) {
      var lockValue;
      logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " begin locking");
      lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_UNDONE);
      return lockInfo.client.setnx(lockInfo.key, lockValue, function(error, result) {
        if (error) {
          logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " error on redis.setnx: " + (util.inspect(error)));
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        if (result === 1) {
          logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " acquired lock", lockInfo.key, attempt);
          RedisLockNotifier.acquired(lockInfo);
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
        logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " lockStatus = " + (util.inspect(lockStatus)) + ", lockValue = " + lockValue);
        if (lockStatus.sentinel === constants.SENTINEL_JOB_DONE) {
          logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " opposite has completed its job successfully");
          RedisLockNotifier.oppsiteHasCompleted(lockInfo, false, attempt);
          return;
        }
        now = (new Date()).getTime();
        if (lockStatus.expiry <= now) {
          logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " the lock has been expired; opposite may have crushed during job");
          lockInfo.client.del(lockInfo.key, function(error) {
            if (error) {
              lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
              return;
            }
            return _this.acquireLock(lockInfo, attempt + 1);
          });
          return;
        }
        if (lockStatus.sentinel === constants.SENTINEL_JOB_FAIL) {
          logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " opposite had failed to complete its job. Do nothing");
          RedisLockNotifier.oppositeHasFailed(lockInfo);
          return;
        }
        interval = attempt === 1 ? Math.min(lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval) : Math.min(lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval);
        logger.verbose("[rpw:" + lockInfo.key + "] #" + attempt + " retry, waits " + interval + "ms");
        setTimeout(function() {
          return RedisLock.acquireLock(lockInfo, attempt + 1);
        }, interval);
      });
    };

    RedisLock.onError = function(error, lockInfo, attempt) {
      return RedisLockNotifier.errorOccurred(error, lockInfo);
    };

    return RedisLock;

  })();

  module.exports = RedisLock;

}).call(this);
