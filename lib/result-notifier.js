(function() {
  var ResultNotifier, constants, debug, util;

  constants = require('./constants');

  debug = (require('debug'))('redis-pw');

  util = require('util');

  ResultNotifier = (function() {

    function ResultNotifier() {}

    ResultNotifier.acquired = function(lockInfo) {
      var _this = this;
      debug("acquired lock for '" + lockInfo.key + "'");
      return lockInfo.callback(null, true, function(succeeded) {
        if (succeeded) {
          debug("job for '" + lockInfo.key + "' has been done; set the sentinel value DONE");
          return lockInfo.client.set(lockInfo.key, constants.SENTINEL_JOB_DONE);
        } else {
          debug("job for '" + lockInfo.key + "' has been failed; set the sentinel value FAIL");
          return lockInfo.client.set(lockInfo.key, constants.SENTINEL_JOB_FAIL);
        }
      });
    };

    ResultNotifier.acquiredAfterOppositeFail = function(lockInfo) {
      var _this = this;
      return lockInfo.callback(null, true, function(succeeded) {
        if (succeeded) {
          debug("job for '" + lockInfo.key + "' has been done; delete the lock");
          return lockInfo.client.del(lockInfo.key);
        } else {
          debug("job for '" + lockInfo.key + "' has been failed, too; delete the lock");
          return lockInfo.client.del(lockInfo.key);
        }
      });
    };

    ResultNotifier.oppsiteHasCompleted = function(lockInfo) {
      debug("job for '" + lockInfo.key + "' has been done by opposite; delete the lock");
      lockInfo.client.del(lockInfo.key);
      return lockInfo.callback(null, false, function() {});
    };

    ResultNotifier.errorOccurred = function(error, lockInfo) {
      debug("error on acquiring lock for '" + lockInfo.key + "': " + (util.inspect(error)));
      if (lockInfo.status === constants.STATUS_OPPOSITE_FAIL) {
        debug("delete the lock '" + lockInfo.key + "'");
        lockInfo.client.del(lockInfo.key);
      } else {
        debug("set the sentinel value FAIL for '" + lockInfo.key + "'");
        lockInfo.client.set(constants.SENTINEL_JOB_FAIL);
      }
      return lockInfo.callback(error, false, function() {});
    };

    return ResultNotifier;

  })();

  module.exports = ResultNotifier;

}).call(this);
