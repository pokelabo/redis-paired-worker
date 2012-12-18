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

    RedisPairedWorker.prototype.lock = function(client, lockName, callback) {
      var lockInfo;
      debug("['%s'] lock() start --->", lockName);
      lockInfo = {
        instance: this,
        client: client,
        key: "lock." + lockName,
        expiry: Date.now() + this.config.lockTimeout,
        callback: callback
      };
      RedisLock.acquireLock(lockInfo, 1);
    };

    return RedisPairedWorker;

  })();

  module.exports = RedisPairedWorker;

}).call(this);
