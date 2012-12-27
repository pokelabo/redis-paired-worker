(function() {
  var LockStatus, RedisHashLockNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  LockStatus = require('./lock-status');

  RedisHashLockNotifier = (function() {

    function RedisHashLockNotifier() {}

    RedisHashLockNotifier.acquired = function(lockInfo) {
      var _this = this;
      return lockInfo.callback(null, true, function(succeeded) {
        var lockValue;
        if (succeeded) {
          debug("['%s . %s'] client has done the job; set the sentinel value DONE", lockInfo.key, lockInfo.field);
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_DONE);
        } else {
          debug("['%s . %s'] client has failed on the job; set the sentinel value FAIL", lockInfo.key, lockInfo.field);
          lockValue = LockStatus.stringify(lockInfo.expiry, constants.SENTINEL_JOB_FAIL);
        }
        return lockInfo.client.hset(lockInfo.key, lockInfo.field, lockValue);
      });
    };

    RedisHashLockNotifier.oppsiteHasCompleted = function(lockInfo) {
      debug("['%s . %s'] opposite has done the job; delete the lock", lockInfo.key, lockInfo.field);
      lockInfo.client.hdel(lockInfo.key, lockInfo.field, function() {});
      return lockInfo.callback(null, false, function() {});
    };

    RedisHashLockNotifier.oppositeHasFailed = function(lockInfo) {
      return lockInfo.callback(null, false, function() {});
    };

    RedisHashLockNotifier.errorOccurred = function(error, lockInfo) {
      debug("['%s . %s'] error on acquiring lock: %s", lockInfo.key, lockInfo.field, util.inspect(error));
      return lockInfo.callback(error, false, function() {});
    };

    return RedisHashLockNotifier;

  })();

  module.exports = RedisHashLockNotifier;

}).call(this);
