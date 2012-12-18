(function() {
  var LockStatus;

  LockStatus = (function() {

    function LockStatus() {}

    LockStatus.stringify = function(expiry, sentinel) {
      return "" + expiry + ":" + sentinel;
    };

    LockStatus.parse = function(lockValue) {
      if (typeof lockValue === 'string') {
        return {
          expiry: parseFloat(lockValue),
          sentinel: parseInt(lockValue.substring(lockValue.length - 1))
        };
      } else {
        return {
          expiry: null,
          sentinel: null
        };
      }
    };

    return LockStatus;

  })();

  module.exports = LockStatus;

}).call(this);
