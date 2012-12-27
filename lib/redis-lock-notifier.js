(function() {
  var LockStatus, RedisLockNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisLockNotifier = (function() {

    function RedisLockNotifier() {}

    RedisLockNotifier.acquired = function(lockInfo) {
      var _this = this;
      return lockInfo.callback(null, true, function(succeeded) {
        var lockValue;
        if (succeeded) {
          debug("['%s'] client has done the job; set the sentinel value DONE", lockInfo.key);
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_DONE);
        } else {
          debug("['%s'] client has failed on the job; set the sentinel value FAIL", lockInfo.key);
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_FAIL);
        }
        return lockInfo.client.set(lockInfo.key, lockValue);
      });
    };

    RedisLockNotifier.oppsiteHasCompleted = function(lockInfo) {
      debug("['%s'] opposite has done the job; delete the lock", lockInfo.key);
      lockInfo.client.del(lockInfo.key);
      return lockInfo.callback(null, false, function() {});
    };

    RedisLockNotifier.oppositeHasFailed = function(lockInfo) {
      return lockInfo.callback(null, false, function() {});
    };

    RedisLockNotifier.errorOccurred = function(error, lockInfo) {
      debug("['%s'] error on acquiring lock: %s", lockInfo.key, util.inspect(error));
      return lockInfo.callback(error, false, function() {});
    };

    return RedisLockNotifier;

  })();

  module.exports = RedisLockNotifier;

}).call(this);
