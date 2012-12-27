redis-paired-worker
===================

A job worker solution that is robust, concurrent and highly available for Node.js using redis.

Overview
--------
This is a robust concurrent and highly available job solution, derived from an idea of Flickr's article:
[Highly Available Real Time Push Notifications and You](http://code.flickr.net/2012/12/12/highly-available-real-time-notifications/).

``RedisPaidWorker`` backups any tasks with high availability in two different processes, which maybe in a different server or even a different data center.

Example
-------

```javascript
var redis = require('redis');
var RedisPaidWorker = require('redis-paired-worker');

var config = {
  lockTimeout: 100,
  firstAttemptInterval: 10,
  otherAttemptInterval: 30
};

var redisClient = redis.createClient(6379, 'localhost');
var worker = new RedisPaidWorker(config);
worker.lock(redisClient, 'aTask-id', { data: 'xyz' }, function(error, acquired, callback) {
  if (acquired) {
     // do task...
     callback(true);  // task has done successfully
  }
});

// lock using redis' hash
worker.hlock(redisClient, 'aTask-id', 'aField', { data: 'xyz' }, function(error, acquired, callback) {
  if (acquired) {
     // do task...
     callback(true);  // task has done successfully
  }
});
```

Features and benefits
---------------------
* Fully non-blocking and asynchronous. Useful for concurrent system.
* Make system tasks be highly availavble in high performance. Workers run in different two processes for same tasks; either one acquire a task and another will back up it and when the winner happen to be unavailable then the another will take over the task possibly in nearly realtime.

Conceptual scenario and usage
-----------------------------
1. Two ``RedisPaidWorker`` try to acquire same lock but either will win; another will stay.
1. If the winner calls a specified callback of its client. Client will do a task then tell the result to the worker.
1. If the task has been done successfully, the another worker deletes the lock.
1. If the task has been failed(simply failed or the process may been crashed), the another worker takes over the lock and its client will do the task.

Installation
------------
1. `npm install redis-paired-worker`

## Changelog

* 0.3.0 - Added method `RedisPairedWorker.hlock` to use redis' hash for locks.
* 0.2.2 - Modified default timeout values.
* 0.2.1 - Fixed a bug on deleting an expired lock.
* 0.2.0 - Changed the structure of redis' lock value, to store both lock expiration date and lock status.
* 0.1.1 - Update README.md
* 0.1.0 - Removed `payload` argument from `RedisPairedWorker.lock()`.
* 0.0.1 - First release.

## License

(The MIT License)

Copyright (c) 2012 Pokelabo, INC <support@pokelabo.co.jp>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
