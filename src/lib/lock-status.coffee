class LockStatus
    @stringify: (expiry, sentinel) ->
        "#{expiry}:#{sentinel}"

    @parse: (lockValue) ->
        if typeof lockValue is 'string'
            expiry: parseFloat lockValue
            sentinel: parseInt lockValue.substring lockValue.length - 1
        else
            expiry: null
            sentinel: null

module.exports = LockStatus
