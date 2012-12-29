(function() {
  var LockStatus, RedisLockNotifier, constants, logger, util;

  constants = require('./constants');

  logger = require('./logger');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisLockNotifier = (function() {

    function RedisLockNotifier() {}

    RedisLockNotifier.acquired = function(lockInfo) {
      var _this = this;
      return lockInfo.callback(null, true, function(succeeded) {
        var lockValue;
        if (succeeded) {
          logger.verbose("[rpw:" + lockInfo.key + "] client has done the job; set the sentinel value DONE");
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_DONE);
        } else {
          logger.verbose("[rpw:" + lockInfo.key + "] client has failed on the job; set the sentinel value FAIL");
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_FAIL);
        }
        return lockInfo.client.set(lockInfo.key, lockValue);
      });
    };

    RedisLockNotifier.oppsiteHasCompleted = function(lockInfo) {
      logger.verbose("[rpw:" + lockInfo.key + "] opposite has done the job; delete the lock");
      lockInfo.client.del(lockInfo.key);
      return lockInfo.callback(null, false, function() {});
    };

    RedisLockNotifier.oppositeHasFailed = function(lockInfo) {
      return lockInfo.callback(null, false, function() {});
    };

    RedisLockNotifier.errorOccurred = function(error, lockInfo) {
      logger.verbose("[rpw:" + lockInfo.key + "] error on acquiring lock: %s", util.inspect(error));
      return lockInfo.callback(error, false, function() {});
    };

    return RedisLockNotifier;

  })();

  module.exports = RedisLockNotifier;

}).call(this);
