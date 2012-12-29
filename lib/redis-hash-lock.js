(function() {
  var LockStatus, RedisHashLock, RedisHashLockNotifier, constants, logger, util;

  constants = require('./constants');

  logger = require('./logger');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisHashLockNotifier = require('./redis-hash-lock-notifier');

  RedisHashLock = (function() {

    function RedisHashLock() {}

    RedisHashLock.acquireLock = function(lockInfo, attempt) {
      var lockValue;
      logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " begin locking");
      lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_UNDONE);
      return lockInfo.client.hsetnx(lockInfo.key, lockInfo.field, lockValue, function(error, result) {
        if (error) {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " error on redis.setnx: " + (util.inspect(error)));
          lockInfo.instance.config.clientErrorPolicy(error, lockInfo, attempt);
          return;
        }
        if (result === 1) {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " acquired lock");
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
        logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " lockStatus = %s, lockValue = %s", util.inspect(lockStatus), lockValue);
        if (lockStatus.sentinel === constants.SENTINEL_JOB_DONE) {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " opposite has completed its job successfully");
          RedisHashLockNotifier.oppsiteHasCompleted(lockInfo, false, attempt);
          return;
        }
        now = (new Date()).getTime();
        if (lockStatus.expiry <= now) {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] the lock has been expired; opposite may have crushed during job");
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
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " opposite had failed to complete its job. Do nothing");
          RedisHashLockNotifier.oppositeHasFailed(lockInfo);
          return;
        }
        interval = attempt === 1 ? Math.min(lockInfo.expiry - now, lockInfo.instance.config.firstAttemptInterval) : Math.min(lockInfo.expiry - now, lockInfo.instance.config.otherAttemptInterval);
        logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] #" + attempt + " retry, waits " + interval + "ms");
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
