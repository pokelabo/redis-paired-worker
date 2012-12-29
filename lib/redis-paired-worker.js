(function() {
  var RedisHashLock, RedisLock, RedisPairedWorker, constants, defaultConfig, extend, logger;

  constants = require('./constants');

  logger = require('./logger');

  extend = require('node.extend');

  RedisLock = require('./redis-lock');

  RedisHashLock = require('./redis-hash-lock');

  defaultConfig = {
    keyPrefix: 'lock:',
    lockTimeout: 100 * 1000,
    firstAttemptInterval: 10 * 1000,
    otherAttemptInterval: 30 * 1000,
    clientErrorPolicy: RedisLock.onError
  };

  RedisPairedWorker = (function() {

    function RedisPairedWorker(config) {
      this.config = extend({}, defaultConfig, config);
    }

    RedisPairedWorker.prototype.lock = function(client, lockName, callback) {
      var lockInfo;
      logger.verbose("[rpw:" + lockName + "] start --->");
      lockInfo = {
        instance: this,
        client: client,
        key: (this.config.keyPrefix || '') + lockName,
        expiry: Date.now() + this.config.lockTimeout,
        callback: callback
      };
      RedisLock.acquireLock(lockInfo, 1);
    };

    RedisPairedWorker.prototype.hlock = function(client, key, field, callback) {
      var lockInfo;
      logger.verbose("[rpw:" + key + ":" + field + "] start --->");
      lockInfo = {
        instance: this,
        client: client,
        key: (this.config.keyPrefix || '') + key,
        field: field,
        expiry: Date.now() + this.config.lockTimeout,
        callback: callback
      };
      RedisHashLock.acquireLock(lockInfo, 1);
    };

    return RedisPairedWorker;

  })();

  module.exports = RedisPairedWorker;

}).call(this);
