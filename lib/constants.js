(function() {

  module.exports = {
    DEBUGKEY: 'redis-pw',
    SENTINEL_JOB_UNDONE: 0,
    SENTINEL_JOB_DONE: -1,
    SENTINEL_JOB_FAIL: -2,
    STATUS_SELF_UNDONE: 0,
    STATUS_SELF_LOCKED: 1,
    STATUS_SELF_DONE: 2,
    STATUS_OPPOSITE_DONE: 3,
    STATUS_OPPOSITE_FAIL: 4
  };

}).call(this);
