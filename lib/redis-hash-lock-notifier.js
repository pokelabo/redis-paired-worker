(function() {
  var LockStatus, RedisHashLockNotifier, constants, logger, util;

  constants = require('./constants');

  logger = require('./logger');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisHashLockNotifier = (function() {

    function RedisHashLockNotifier() {}

    RedisHashLockNotifier.acquired = function(lockInfo) {
      var _this = this;
      return lockInfo.callback(null, true, function(succeeded) {
        var lockValue;
        if (succeeded) {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] client has done the job; set the sentinel value DONE");
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_DONE);
        } else {
          logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] client has failed on the job; set the sentinel value FAIL");
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_FAIL);
        }
        return lockInfo.client.hset(lockInfo.key, lockInfo.field, lockValue);
      });
    };

    RedisHashLockNotifier.oppsiteHasCompleted = function(lockInfo) {
      logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] opposite has done the job; delete the lock");
      lockInfo.client.hdel(lockInfo.key, lockInfo.field, function() {});
      return lockInfo.callback(null, false, function() {});
    };

    RedisHashLockNotifier.oppositeHasFailed = function(lockInfo) {
      return lockInfo.callback(null, false, function() {});
    };

    RedisHashLockNotifier.errorOccurred = function(error, lockInfo) {
      logger.verbose("[rpw:" + lockInfo.key + ":" + lockInfo.field + "] error on acquiring lock: %s", util.inspect(error));
      return lockInfo.callback(error, false, function() {});
    };

    return RedisHashLockNotifier;

  })();

  module.exports = RedisHashLockNotifier;

}).call(this);
