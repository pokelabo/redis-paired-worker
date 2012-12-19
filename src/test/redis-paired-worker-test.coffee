buster = require 'buster'

RedisPairedWorker = require '../index'
config = {}

redisClientStub = () ->
    client =
      value: null
      setnx: (key, value, cb) ->
        if this.value isnt null
            return cb null, 0
        this.value = value
        cb null, 1
      get: (key, cb) ->
        cb null, this.value if cb
      set: (key, value, cb) ->
        this.value = value
        cb null, 1 if cb
      del: (key, cb) ->
        this.value = null
        cb null, 1 if cb

buster.testCase 'RedisPairedWorker', {
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
         this.spy client, 'del'
 
         worker1.lock client, 'testLockId', callback
         worker2.lock client, 'testLockId', callback
 
         assert callback.calledTwice
         assert callback.calledWith null, true
         assert callback.calledWith null, false
         # the lock should been deleted
         assert client.del.calledOnce

    'When a faster worker fails its job after acquires a lock, another leaves the job undone': () ->
        worker1 = new RedisPairedWorker config
        worker2 = new RedisPairedWorker config

        callback1 = this.stub().callsArgWith 2, false
        callback2 = this.stub().callsArgWith 2, true

        client = redisClientStub()
        this.spy client, 'del'

        worker1.lock client, 'testLockId', callback1
        worker2.lock client, 'testLockId', callback2
        assert callback1.calledWith null, true
        assert callback2.calledWith null, false
        # the lock should not been deleted
        refute client.del.calledOnce

     'If redis.setnx fails, the worker notifies it with error object and lock will be left.': (done) ->
         worker1 = new RedisPairedWorker config
         worker2 = new RedisPairedWorker config
 
         callback1 = this.stub().callsArgWith 2, false
         callback2 = this.stub().callsArgWith 2, true
 
         client = redisClientStub()
         client.setnx = (key, value, cb) ->
             cb "anError", 0
         this.spy client, 'del'
 
         setTimeout () ->
             worker1.lock client, 'testLockId', callback1
             worker2.lock client, 'testLockId', callback2
             assert callback1.calledOnce
             assert callback1.calledWith 'anError', false
             assert callback2.calledOnce
             assert callback2.calledWith 'anError', false
             # redis.del should have not been called
             refute client.del.calledOnce
             done()
         , 10

     'If the lock had been expired, take over it.': (done) ->
        worker1 = new RedisPairedWorker lockTimeout: 10
        worker2 = new RedisPairedWorker lockTimeout: 20

        callback1 = this.stub().callsArgWith 2, false
        callback2 = this.stub().callsArgWith 2, true

        client = redisClientStub()
        this.spy client, 'del'

        worker1.lock client, 'testLockId', callback1
        assert callback1.calledWith null, true
        setTimeout () ->
            worker2.lock client, 'testLockId', callback2
            assert callback2.calledWith null, true
            ## the lock should not been deleted
            assert client.del.calledOnce
            done()
        , 10
}
