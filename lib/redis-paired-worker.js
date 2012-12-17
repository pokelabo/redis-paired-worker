(function() {
  var RedisLock, RedisPairedWorker, constants, debug, defaultConfig, extend;

  constants = require('./constants');

  debug = (require('debug'))(constants.DEBUGKEY);

  extend = require('node.extend');

  RedisLock = require('./redis-lock');

  defaultConfig = {
    lockTimeout: 100,
    firstAttemptInterval: 10,
    otherAttemptInterval: 30,
    clientErrorPolicy: RedisLock.onError
  };

  RedisPairedWorker = (function() {

    function RedisPairedWorker(config) {
      this.config = extend({}, defaultConfig, config);
    }

    RedisPairedWorker.prototype.lock = function(client, lockName, payload, callback) {
      var lockInfo;
      debug("lock() begin '" + lockName + "'");
      if (callback === void 0) {
        callback = payload;
        payload = null;
      }
      lockInfo = {
        instance: this,
        client: client,
        key: "lock." + lockName,
        expiry: Date.now() + this.config.lockTimeout,
        payload: payload,
        callback: callback,
        status: constants.STATUS_SELF_UNDONE
      };
      RedisLock.acquireLock(lockInfo, 1);
    };

    return RedisPairedWorker;

  })();

  module.exports = RedisPairedWorker;

}).call(this);
