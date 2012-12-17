(function() {
  var RedisPairedWorker, buster, config, redisClientStub;

  buster = require('buster');

  RedisPairedWorker = require('../index');

  config = {};

  redisClientStub = function() {
    var client;
    return client = {
      value: null,
      setnx: function(key, value, cb) {
        if (this.value !== null) {
          return cb(null, 0);
        }
        this.value = value;
        return cb(null, 1);
      },
      get: function(key, cb) {
        if (cb) {
          return cb(null, this.value);
        }
      },
      set: function(key, value, cb) {
        this.value = value;
        if (cb) {
          return cb(null, 1);
        }
      },
      del: function(key, value, cb) {
        return this.value = null;
      }
    };
  };

  buster.testCase('RedisPairedWorker', {
    'Do not change default config': function() {
      var defaultTimeout, newConfig, worker0, worker1, worker2;
      worker0 = new RedisPairedWorker({});
      defaultTimeout = worker0.config.lockTimeout;
      refute.equals(defaultTimeout, 1);
      newConfig = {
        lockTimeout: 1
      };
      worker1 = new RedisPairedWorker(newConfig);
      assert.equals(worker1.config.lockTimeout, 1);
      worker2 = new RedisPairedWorker({});
      return assert.equals(worker2.config.lockTimeout, defaultTimeout);
    },
    'A faster worker should acquires a lock and another should fail': function() {
      var callback, client, worker1, worker2;
      worker1 = new RedisPairedWorker(config);
      worker2 = new RedisPairedWorker(config);
      callback = this.stub().callsArgWith(3, true);
      client = redisClientStub();
      this.spy(client, 'del');
      worker1.lock(client, 'testLockId', "payload1", callback);
      worker2.lock(client, 'testLockId', "payload2", callback);
      assert(callback.calledTwice);
      assert(callback.calledWith(null, true, 'payload1'));
      assert(callback.calledWith(null, false, 'payload2'));
      return assert(client.del.calledOnce);
    },
    'When a faster worker fails its job after acquires a lock, another should take over the job': function() {
      var callback1, callback2, client, worker1, worker2;
      worker1 = new RedisPairedWorker(config);
      worker2 = new RedisPairedWorker(config);
      callback1 = this.stub().callsArgWith(3, false);
      callback2 = this.stub().callsArgWith(3, true);
      client = redisClientStub();
      this.spy(client, 'del');
      worker1.lock(client, 'testLockId', "payload1", callback1);
      worker2.lock(client, 'testLockId', "payload2", callback2);
      assert(callback1.calledWith(null, true, 'payload1'));
      assert(callback2.calledWith(null, true, 'payload2'));
      return assert(client.del.calledOnce);
    },
    'Can omit arguments for lock()': function() {
      var callback, client, worker1;
      worker1 = new RedisPairedWorker(config);
      callback = this.stub().callsArgWith(3, true);
      client = redisClientStub();
      worker1.lock(client, 'testLockId', callback);
      return assert(callback.calledWith(null, true, null));
    },
    'If redis.setnx fails, the worker notifies it with error object and lock will be left.': function(done) {
      var callback1, callback2, client, worker1, worker2;
      worker1 = new RedisPairedWorker(config);
      worker2 = new RedisPairedWorker(config);
      callback1 = this.stub().callsArgWith(3, false);
      callback2 = this.stub().callsArgWith(3, true);
      client = redisClientStub();
      client.setnx = function(key, value, cb) {
        return cb("anError", 0);
      };
      this.spy(client, 'del');
      return setTimeout(function() {
        worker1.lock(client, 'testLockId', "payload1", callback1);
        worker2.lock(client, 'testLockId', "payload2", callback2);
        assert(callback1.calledOnce);
        assert(callback1.calledWith('anError', false, 'payload1'));
        assert(callback2.calledOnce);
        assert(callback2.calledWith('anError', false, 'payload2'));
        refute(client.del.calledOnce);
        return done();
      }, 10);
    }
  });

}).call(this);
