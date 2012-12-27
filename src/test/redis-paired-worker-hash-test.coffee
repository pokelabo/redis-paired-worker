buster = require 'buster'

RedisPairedWorker = require '../index'
config = {}

redisClientStub = () ->
    client =
      value: null
      hsetnx: (key, field, value, cb) ->
        if @value isnt null
            return cb null, 0
        @value = value
        cb null, 1
      hget: (key, field, cb) ->
        cb null, @value if cb
      hset: (key, field, value, cb) ->
        @value = value
        cb null, 1 if cb
      hdel: (key, field, cb) ->
        @value = null
        cb null, 1 if cb

buster.testCase 'RedisPairedWorker(hash)', {
    'Do not change default config': () ->
        worker0 = new RedisPairedWorker {}
        defaultTimeout = worker0.config.lockTimeout
        refute.equals defaultTimeout, 1

        newConfig = lockTimeout: 1
        worker1 = new RedisPairedWorker newConfig
        assert.equals worker1.config.lockTimeout, 1

        worker2 = new RedisPairedWorker {}
        assert.equals worker2.config.lockTimeout, defaultTimeout
        
    'A faster worker should acquires a lock and another should fail': () ->
        worker1 = new RedisPairedWorker config
        worker2 = new RedisPairedWorker config

        callback = this.stub().callsArgWith 2, true

        client = redisClientStub()
        this.spy client, 'hdel'

        worker1.hlock client, 'testLockId', 'aField', callback
        worker2.hlock client, 'testLockId', 'aField', callback

        assert callback.calledTwice
        assert callback.calledWith null, true
        assert callback.calledWith null, false
        # the lock should been deleted
        assert client.hdel.calledOnce

    'When a faster worker fails its job after acquires a lock, another leaves the job undone': () ->
        worker1 = new RedisPairedWorker config
        worker2 = new RedisPairedWorker config

        callback1 = this.stub().callsArgWith 2, false
        callback2 = this.stub().callsArgWith 2, true

        client = redisClientStub()
        this.spy client, 'hdel'

        worker1.hlock client, 'testLockId', 'aField', callback1
        worker2.hlock client, 'testLockId', 'aField', callback2
        assert callback1.calledWith null, true
        assert callback2.calledWith null, false
        # the lock should not been deleted
        refute client.hdel.calledOnce

    'If redis.setnx fails, the worker notifies it with error object and lock will be left.': (done) ->
        worker1 = new RedisPairedWorker config
        worker2 = new RedisPairedWorker config

        callback1 = this.stub().callsArgWith 2, false
        callback2 = this.stub().callsArgWith 2, true

        client = redisClientStub()
        client.hsetnx = (key, field, value, cb) ->
            cb "anError", 0
        this.spy client, 'hdel'

        setTimeout () ->
            worker1.hlock client, 'testLockId', 'aField', callback1
            worker2.hlock client, 'testLockId', 'aField', callback2
            assert callback1.calledOnce
            assert callback1.calledWith 'anError', false
            assert callback2.calledOnce
            assert callback2.calledWith 'anError', false
            # redis.hdel should have not been called
            refute client.hdel.calledOnce
            done()
        , 10

    'If the lock had been expired, take over it.': (done) ->
        worker1 = new RedisPairedWorker lockTimeout: 10
        worker2 = new RedisPairedWorker lockTimeout: 20

        callback1 = this.stub().callsArgWith 2, false
        callback2 = this.stub().callsArgWith 2, true

        client = redisClientStub()
        this.spy client, 'hdel'

        worker1.hlock client, 'testLockId', 'aField', callback1
        assert callback1.calledWith null, true
        setTimeout () ->
            worker2.hlock client, 'testLockId', 'aField', callback2
            assert callback2.calledWith null, true
            ## the lock should not been deleted
            assert client.hdel.calledOnce
            done()
        , 10
}
