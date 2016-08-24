/* @preserve
 * The MIT License (MIT)
 * 
 * Copyright (c) 2013-2015 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
/**
 * bluebird build version 3.4.1
 * Features enabled: core
 * Features disabled: race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, using, timers, filter, any, each
*/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof _dereq_=="function"&&_dereq_;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof _dereq_=="function"&&_dereq_;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";
var firstLineError;
try {throw new Error(); } catch (e) {firstLineError = e;}
var schedule = _dereq_("./schedule");
var Queue = _dereq_("./queue");
var util = _dereq_("./util");

function Async() {
    this._customScheduler = false;
    this._isTickUsed = false;
    this._lateQueue = new Queue(16);
    this._normalQueue = new Queue(16);
    this._haveDrainedQueues = false;
    this._trampolineEnabled = true;
    var self = this;
    this.drainQueues = function () {
        self._drainQueues();
    };
    this._schedule = schedule;
}

Async.prototype.setScheduler = function(fn) {
    var prev = this._schedule;
    this._schedule = fn;
    this._customScheduler = true;
    return prev;
};

Async.prototype.hasCustomScheduler = function() {
    return this._customScheduler;
};

Async.prototype.enableTrampoline = function() {
    this._trampolineEnabled = true;
};

Async.prototype.disableTrampolineIfNecessary = function() {
    if (util.hasDevTools) {
        this._trampolineEnabled = false;
    }
};

Async.prototype.haveItemsQueued = function () {
    return this._isTickUsed || this._haveDrainedQueues;
};


Async.prototype.fatalError = function(e, isNode) {
    if (isNode) {
        process.stderr.write("Fatal " + (e instanceof Error ? e.stack : e) +
            "\n");
        process.exit(2);
    } else {
        this.throwLater(e);
    }
};

Async.prototype.throwLater = function(fn, arg) {
    if (arguments.length === 1) {
        arg = fn;
        fn = function () { throw arg; };
    }
    if (typeof setTimeout !== "undefined") {
        setTimeout(function() {
            fn(arg);
        }, 0);
    } else try {
        this._schedule(function() {
            fn(arg);
        });
    } catch (e) {
        throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
};

function AsyncInvokeLater(fn, receiver, arg) {
    this._lateQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncInvoke(fn, receiver, arg) {
    this._normalQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncSettlePromises(promise) {
    this._normalQueue._pushOne(promise);
    this._queueTick();
}

if (!util.hasDevTools) {
    Async.prototype.invokeLater = AsyncInvokeLater;
    Async.prototype.invoke = AsyncInvoke;
    Async.prototype.settlePromises = AsyncSettlePromises;
} else {
    Async.prototype.invokeLater = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvokeLater.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                setTimeout(function() {
                    fn.call(receiver, arg);
                }, 100);
            });
        }
    };

    Async.prototype.invoke = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvoke.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                fn.call(receiver, arg);
            });
        }
    };

    Async.prototype.settlePromises = function(promise) {
        if (this._trampolineEnabled) {
            AsyncSettlePromises.call(this, promise);
        } else {
            this._schedule(function() {
                promise._settlePromises();
            });
        }
    };
}

Async.prototype.invokeFirst = function (fn, receiver, arg) {
    this._normalQueue.unshift(fn, receiver, arg);
    this._queueTick();
};

Async.prototype._drainQueue = function(queue) {
    while (queue.length() > 0) {
        var fn = queue.shift();
        if (typeof fn !== "function") {
            fn._settlePromises();
            continue;
        }
        var receiver = queue.shift();
        var arg = queue.shift();
        fn.call(receiver, arg);
    }
};

Async.prototype._drainQueues = function () {
    this._drainQueue(this._normalQueue);
    this._reset();
    this._haveDrainedQueues = true;
    this._drainQueue(this._lateQueue);
};

Async.prototype._queueTick = function () {
    if (!this._isTickUsed) {
        this._isTickUsed = true;
        this._schedule(this.drainQueues);
    }
};

Async.prototype._reset = function () {
    this._isTickUsed = false;
};

module.exports = Async;
module.exports.firstLineError = firstLineError;

},{"./queue":17,"./schedule":18,"./util":21}],2:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise, debug) {
var calledBind = false;
var rejectThis = function(_, e) {
    this._reject(e);
};

var targetRejected = function(e, context) {
    context.promiseRejectionQueued = true;
    context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
};

var bindingResolved = function(thisArg, context) {
    if (((this._bitField & 50397184) === 0)) {
        this._resolveCallback(context.target);
    }
};

var bindingRejected = function(e, context) {
    if (!context.promiseRejectionQueued) this._reject(e);
};

Promise.prototype.bind = function (thisArg) {
    if (!calledBind) {
        calledBind = true;
        Promise.prototype._propagateFrom = debug.propagateFromFunction();
        Promise.prototype._boundValue = debug.boundValueFunction();
    }
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 1);
    var target = this._target();
    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        var context = {
            promiseRejectionQueued: false,
            promise: ret,
            target: target,
            bindingPromise: maybePromise
        };
        target._then(INTERNAL, targetRejected, undefined, ret, context);
        maybePromise._then(
            bindingResolved, bindingRejected, undefined, ret, context);
        ret._setOnCancel(maybePromise);
    } else {
        ret._resolveCallback(target);
    }
    return ret;
};

Promise.prototype._setBoundTo = function (obj) {
    if (obj !== undefined) {
        this._bitField = this._bitField | 2097152;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~2097152);
    }
};

Promise.prototype._isBound = function () {
    return (this._bitField & 2097152) === 2097152;
};

Promise.bind = function (thisArg, value) {
    return Promise.resolve(value).bind(thisArg);
};
};

},{}],3:[function(_dereq_,module,exports){
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict() {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
var bluebird = _dereq_("./promise")();
bluebird.noConflict = noConflict;
module.exports = bluebird;

},{"./promise":15}],4:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, debug) {
var util = _dereq_("./util");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var async = Promise._async;

Promise.prototype["break"] = Promise.prototype.cancel = function() {
    if (!debug.cancellation()) return this._warn("cancellation is disabled");

    var promise = this;
    var child = promise;
    while (promise.isCancellable()) {
        if (!promise._cancelBy(child)) {
            if (child._isFollowing()) {
                child._followee().cancel();
            } else {
                child._cancelBranched();
            }
            break;
        }

        var parent = promise._cancellationParent;
        if (parent == null || !parent.isCancellable()) {
            if (promise._isFollowing()) {
                promise._followee().cancel();
            } else {
                promise._cancelBranched();
            }
            break;
        } else {
            if (promise._isFollowing()) promise._followee().cancel();
            child = promise;
            promise = parent;
        }
    }
};

Promise.prototype._branchHasCancelled = function() {
    this._branchesRemainingToCancel--;
};

Promise.prototype._enoughBranchesHaveCancelled = function() {
    return this._branchesRemainingToCancel === undefined ||
           this._branchesRemainingToCancel <= 0;
};

Promise.prototype._cancelBy = function(canceller) {
    if (canceller === this) {
        this._branchesRemainingToCancel = 0;
        this._invokeOnCancel();
        return true;
    } else {
        this._branchHasCancelled();
        if (this._enoughBranchesHaveCancelled()) {
            this._invokeOnCancel();
            return true;
        }
    }
    return false;
};

Promise.prototype._cancelBranched = function() {
    if (this._enoughBranchesHaveCancelled()) {
        this._cancel();
    }
};

Promise.prototype._cancel = function() {
    if (!this.isCancellable()) return;

    this._setCancelled();
    async.invoke(this._cancelPromises, this, undefined);
};

Promise.prototype._cancelPromises = function() {
    if (this._length() > 0) this._settlePromises();
};

Promise.prototype._unsetOnCancel = function() {
    this._onCancelField = undefined;
};

Promise.prototype.isCancellable = function() {
    return this.isPending() && !this.isCancelled();
};

Promise.prototype._doInvokeOnCancel = function(onCancelCallback, internalOnly) {
    if (util.isArray(onCancelCallback)) {
        for (var i = 0; i < onCancelCallback.length; ++i) {
            this._doInvokeOnCancel(onCancelCallback[i], internalOnly);
        }
    } else if (onCancelCallback !== undefined) {
        if (typeof onCancelCallback === "function") {
            if (!internalOnly) {
                var e = tryCatch(onCancelCallback).call(this._boundValue());
                if (e === errorObj) {
                    this._attachExtraTrace(e.e);
                    async.throwLater(e.e);
                }
            }
        } else {
            onCancelCallback._resultCancelled(this);
        }
    }
};

Promise.prototype._invokeOnCancel = function() {
    var onCancelCallback = this._onCancel();
    this._unsetOnCancel();
    async.invoke(this._doInvokeOnCancel, this, onCancelCallback);
};

Promise.prototype._invokeInternalOnCancel = function() {
    if (this.isCancellable()) {
        this._doInvokeOnCancel(this._onCancel(), true);
        this._unsetOnCancel();
    }
};

Promise.prototype._resultCancelled = function() {
    this.cancel();
};

};

},{"./util":21}],5:[function(_dereq_,module,exports){
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util");
var getKeys = _dereq_("./es5").keys;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

function catchFilter(instances, cb, promise) {
    return function(e) {
        var boundTo = promise._boundValue();
        predicateLoop: for (var i = 0; i < instances.length; ++i) {
            var item = instances[i];

            if (item === Error ||
                (item != null && item.prototype instanceof Error)) {
                if (e instanceof item) {
                    return tryCatch(cb).call(boundTo, e);
                }
            } else if (typeof item === "function") {
                var matchesPredicate = tryCatch(item).call(boundTo, e);
                if (matchesPredicate === errorObj) {
                    return matchesPredicate;
                } else if (matchesPredicate) {
                    return tryCatch(cb).call(boundTo, e);
                }
            } else if (util.isObject(e)) {
                var keys = getKeys(item);
                for (var j = 0; j < keys.length; ++j) {
                    var key = keys[j];
                    if (item[key] != e[key]) {
                        continue predicateLoop;
                    }
                }
                return tryCatch(cb).call(boundTo, e);
            }
        }
        return NEXT_FILTER;
    };
}

return catchFilter;
};

},{"./es5":10,"./util":21}],6:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var longStackTraces = false;
var contextStack = [];

Promise.prototype._promiseCreated = function() {};
Promise.prototype._pushContext = function() {};
Promise.prototype._popContext = function() {return null;};
Promise._peekContext = Promise.prototype._peekContext = function() {};

function Context() {
    this._trace = new Context.CapturedTrace(peekContext());
}
Context.prototype._pushContext = function () {
    if (this._trace !== undefined) {
        this._trace._promiseCreated = null;
        contextStack.push(this._trace);
    }
};

Context.prototype._popContext = function () {
    if (this._trace !== undefined) {
        var trace = contextStack.pop();
        var ret = trace._promiseCreated;
        trace._promiseCreated = null;
        return ret;
    }
    return null;
};

function createContext() {
    if (longStackTraces) return new Context();
}

function peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return undefined;
}
Context.CapturedTrace = null;
Context.create = createContext;
Context.deactivateLongStackTraces = function() {};
Context.activateLongStackTraces = function() {
    var Promise_pushContext = Promise.prototype._pushContext;
    var Promise_popContext = Promise.prototype._popContext;
    var Promise_PeekContext = Promise._peekContext;
    var Promise_peekContext = Promise.prototype._peekContext;
    var Promise_promiseCreated = Promise.prototype._promiseCreated;
    Context.deactivateLongStackTraces = function() {
        Promise.prototype._pushContext = Promise_pushContext;
        Promise.prototype._popContext = Promise_popContext;
        Promise._peekContext = Promise_PeekContext;
        Promise.prototype._peekContext = Promise_peekContext;
        Promise.prototype._promiseCreated = Promise_promiseCreated;
        longStackTraces = false;
    };
    longStackTraces = true;
    Promise.prototype._pushContext = Context.prototype._pushContext;
    Promise.prototype._popContext = Context.prototype._popContext;
    Promise._peekContext = Promise.prototype._peekContext = peekContext;
    Promise.prototype._promiseCreated = function() {
        var ctx = this._peekContext();
        if (ctx && ctx._promiseCreated == null) ctx._promiseCreated = this;
    };
};
return Context;
};

},{}],7:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, Context) {
var getDomain = Promise._getDomain;
var async = Promise._async;
var Warning = _dereq_("./errors").Warning;
var util = _dereq_("./util");
var canAttachTrace = util.canAttachTrace;
var unhandledRejectionHandled;
var possiblyUnhandledRejection;
var bluebirdFramePattern =
    /[\\\/]bluebird[\\\/]js[\\\/](release|debug|instrumented)/;
var stackFramePattern = null;
var formatStack = null;
var indentStackFrames = false;
var printWarning;
var debugging = !!(util.env("BLUEBIRD_DEBUG") != 0 &&
                        (true ||
                         util.env("BLUEBIRD_DEBUG") ||
                         util.env("NODE_ENV") === "development"));

var warnings = !!(util.env("BLUEBIRD_WARNINGS") != 0 &&
    (debugging || util.env("BLUEBIRD_WARNINGS")));

var longStackTraces = !!(util.env("BLUEBIRD_LONG_STACK_TRACES") != 0 &&
    (debugging || util.env("BLUEBIRD_LONG_STACK_TRACES")));

var wForgottenReturn = util.env("BLUEBIRD_W_FORGOTTEN_RETURN") != 0 &&
    (warnings || !!util.env("BLUEBIRD_W_FORGOTTEN_RETURN"));

Promise.prototype.suppressUnhandledRejections = function() {
    var target = this._target();
    target._bitField = ((target._bitField & (~1048576)) |
                      524288);
};

Promise.prototype._ensurePossibleRejectionHandled = function () {
    if ((this._bitField & 524288) !== 0) return;
    this._setRejectionIsUnhandled();
    async.invokeLater(this._notifyUnhandledRejection, this, undefined);
};

Promise.prototype._notifyUnhandledRejectionIsHandled = function () {
    fireRejectionEvent("rejectionHandled",
                                  unhandledRejectionHandled, undefined, this);
};

Promise.prototype._setReturnedNonUndefined = function() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._returnedNonUndefined = function() {
    return (this._bitField & 268435456) !== 0;
};

Promise.prototype._notifyUnhandledRejection = function () {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue();
        this._setUnhandledRejectionIsNotified();
        fireRejectionEvent("unhandledRejection",
                                      possiblyUnhandledRejection, reason, this);
    }
};

Promise.prototype._setUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField | 262144;
};

Promise.prototype._unsetUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField & (~262144);
};

Promise.prototype._isUnhandledRejectionNotified = function () {
    return (this._bitField & 262144) > 0;
};

Promise.prototype._setRejectionIsUnhandled = function () {
    this._bitField = this._bitField | 1048576;
};

Promise.prototype._unsetRejectionIsUnhandled = function () {
    this._bitField = this._bitField & (~1048576);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled = function () {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._warn = function(message, shouldUseOwnTrace, promise) {
    return warn(message, shouldUseOwnTrace, promise || this);
};

Promise.onPossiblyUnhandledRejection = function (fn) {
    var domain = getDomain();
    possiblyUnhandledRejection =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

Promise.onUnhandledRejectionHandled = function (fn) {
    var domain = getDomain();
    unhandledRejectionHandled =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

var disableLongStackTraces = function() {};
Promise.longStackTraces = function () {
    if (async.haveItemsQueued() && !config.longStackTraces) {
        throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    if (!config.longStackTraces && longStackTracesIsSupported()) {
        var Promise_captureStackTrace = Promise.prototype._captureStackTrace;
        var Promise_attachExtraTrace = Promise.prototype._attachExtraTrace;
        config.longStackTraces = true;
        disableLongStackTraces = function() {
            if (async.haveItemsQueued() && !config.longStackTraces) {
                throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
            }
            Promise.prototype._captureStackTrace = Promise_captureStackTrace;
            Promise.prototype._attachExtraTrace = Promise_attachExtraTrace;
            Context.deactivateLongStackTraces();
            async.enableTrampoline();
            config.longStackTraces = false;
        };
        Promise.prototype._captureStackTrace = longStackTracesCaptureStackTrace;
        Promise.prototype._attachExtraTrace = longStackTracesAttachExtraTrace;
        Context.activateLongStackTraces();
        async.disableTrampolineIfNecessary();
    }
};

Promise.hasLongStackTraces = function () {
    return config.longStackTraces && longStackTracesIsSupported();
};

var fireDomEvent = (function() {
    try {
        var event = document.createEvent("CustomEvent");
        event.initCustomEvent("testingtheevent", false, true, {});
        util.global.dispatchEvent(event);
        return function(name, event) {
            var domEvent = document.createEvent("CustomEvent");
            domEvent.initCustomEvent(name.toLowerCase(), false, true, event);
            return !util.global.dispatchEvent(domEvent);
        };
    } catch (e) {}
    return function() {
        return false;
    };
})();

var fireGlobalEvent = (function() {
    if (util.isNode) {
        return function() {
            return process.emit.apply(process, arguments);
        };
    } else {
        if (!util.global) {
            return function() {
                return false;
            };
        }
        return function(name) {
            var methodName = "on" + name.toLowerCase();
            var method = util.global[methodName];
            if (!method) return false;
            method.apply(util.global, [].slice.call(arguments, 1));
            return true;
        };
    }
})();

function generatePromiseLifecycleEventObject(name, promise) {
    return {promise: promise};
}

var eventToObjectGenerator = {
    promiseCreated: generatePromiseLifecycleEventObject,
    promiseFulfilled: generatePromiseLifecycleEventObject,
    promiseRejected: generatePromiseLifecycleEventObject,
    promiseResolved: generatePromiseLifecycleEventObject,
    promiseCancelled: generatePromiseLifecycleEventObject,
    promiseChained: function(name, promise, child) {
        return {promise: promise, child: child};
    },
    warning: function(name, warning) {
        return {warning: warning};
    },
    unhandledRejection: function (name, reason, promise) {
        return {reason: reason, promise: promise};
    },
    rejectionHandled: generatePromiseLifecycleEventObject
};

var activeFireEvent = function (name) {
    var globalEventFired = false;
    try {
        globalEventFired = fireGlobalEvent.apply(null, arguments);
    } catch (e) {
        async.throwLater(e);
        globalEventFired = true;
    }

    var domEventFired = false;
    try {
        domEventFired = fireDomEvent(name,
                    eventToObjectGenerator[name].apply(null, arguments));
    } catch (e) {
        async.throwLater(e);
        domEventFired = true;
    }

    return domEventFired || globalEventFired;
};

Promise.config = function(opts) {
    opts = Object(opts);
    if ("longStackTraces" in opts) {
        if (opts.longStackTraces) {
            Promise.longStackTraces();
        } else if (!opts.longStackTraces && Promise.hasLongStackTraces()) {
            disableLongStackTraces();
        }
    }
    if ("warnings" in opts) {
        var warningsOption = opts.warnings;
        config.warnings = !!warningsOption;
        wForgottenReturn = config.warnings;

        if (util.isObject(warningsOption)) {
            if ("wForgottenReturn" in warningsOption) {
                wForgottenReturn = !!warningsOption.wForgottenReturn;
            }
        }
    }
    if ("cancellation" in opts && opts.cancellation && !config.cancellation) {
        if (async.haveItemsQueued()) {
            throw new Error(
                "cannot enable cancellation after promises are in use");
        }
        Promise.prototype._clearCancellationData =
            cancellationClearCancellationData;
        Promise.prototype._propagateFrom = cancellationPropagateFrom;
        Promise.prototype._onCancel = cancellationOnCancel;
        Promise.prototype._setOnCancel = cancellationSetOnCancel;
        Promise.prototype._attachCancellationCallback =
            cancellationAttachCancellationCallback;
        Promise.prototype._execute = cancellationExecute;
        propagateFromFunction = cancellationPropagateFrom;
        config.cancellation = true;
    }
    if ("monitoring" in opts) {
        if (opts.monitoring && !config.monitoring) {
            config.monitoring = true;
            Promise.prototype._fireEvent = activeFireEvent;
        } else if (!opts.monitoring && config.monitoring) {
            config.monitoring = false;
            Promise.prototype._fireEvent = defaultFireEvent;
        }
    }
};

function defaultFireEvent() { return false; }

Promise.prototype._fireEvent = defaultFireEvent;
Promise.prototype._execute = function(executor, resolve, reject) {
    try {
        executor(resolve, reject);
    } catch (e) {
        return e;
    }
};
Promise.prototype._onCancel = function () {};
Promise.prototype._setOnCancel = function (handler) { ; };
Promise.prototype._attachCancellationCallback = function(onCancel) {
    ;
};
Promise.prototype._captureStackTrace = function () {};
Promise.prototype._attachExtraTrace = function () {};
Promise.prototype._clearCancellationData = function() {};
Promise.prototype._propagateFrom = function (parent, flags) {
    ;
    ;
};

function cancellationExecute(executor, resolve, reject) {
    var promise = this;
    try {
        executor(resolve, reject, function(onCancel) {
            if (typeof onCancel !== "function") {
                throw new TypeError("onCancel must be a function, got: " +
                                    util.toString(onCancel));
            }
            promise._attachCancellationCallback(onCancel);
        });
    } catch (e) {
        return e;
    }
}

function cancellationAttachCancellationCallback(onCancel) {
    if (!this.isCancellable()) return this;

    var previousOnCancel = this._onCancel();
    if (previousOnCancel !== undefined) {
        if (util.isArray(previousOnCancel)) {
            previousOnCancel.push(onCancel);
        } else {
            this._setOnCancel([previousOnCancel, onCancel]);
        }
    } else {
        this._setOnCancel(onCancel);
    }
}

function cancellationOnCancel() {
    return this._onCancelField;
}

function cancellationSetOnCancel(onCancel) {
    this._onCancelField = onCancel;
}

function cancellationClearCancellationData() {
    this._cancellationParent = undefined;
    this._onCancelField = undefined;
}

function cancellationPropagateFrom(parent, flags) {
    if ((flags & 1) !== 0) {
        this._cancellationParent = parent;
        var branchesRemainingToCancel = parent._branchesRemainingToCancel;
        if (branchesRemainingToCancel === undefined) {
            branchesRemainingToCancel = 0;
        }
        parent._branchesRemainingToCancel = branchesRemainingToCancel + 1;
    }
    if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
}

function bindingPropagateFrom(parent, flags) {
    if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
}
var propagateFromFunction = bindingPropagateFrom;

function boundValueFunction() {
    var ret = this._boundTo;
    if (ret !== undefined) {
        if (ret instanceof Promise) {
            if (ret.isFulfilled()) {
                return ret.value();
            } else {
                return undefined;
            }
        }
    }
    return ret;
}

function longStackTracesCaptureStackTrace() {
    this._trace = new CapturedTrace(this._peekContext());
}

function longStackTracesAttachExtraTrace(error, ignoreSelf) {
    if (canAttachTrace(error)) {
        var trace = this._trace;
        if (trace !== undefined) {
            if (ignoreSelf) trace = trace._parent;
        }
        if (trace !== undefined) {
            trace.attachExtraTrace(error);
        } else if (!error.__stackCleaned__) {
            var parsed = parseStackAndMessage(error);
            util.notEnumerableProp(error, "stack",
                parsed.message + "\n" + parsed.stack.join("\n"));
            util.notEnumerableProp(error, "__stackCleaned__", true);
        }
    }
}

function checkForgottenReturns(returnValue, promiseCreated, name, promise,
                               parent) {
    if (returnValue === undefined && promiseCreated !== null &&
        wForgottenReturn) {
        if (parent !== undefined && parent._returnedNonUndefined()) return;
        if ((promise._bitField & 65535) === 0) return;

        if (name) name = name + " ";
        var msg = "a promise was created in a " + name +
            "handler but was not returned from it";
        promise._warn(msg, true, promiseCreated);
    }
}

function deprecated(name, replacement) {
    var message = name +
        " is deprecated and will be removed in a future version.";
    if (replacement) message += " Use " + replacement + " instead.";
    return warn(message);
}

function warn(message, shouldUseOwnTrace, promise) {
    if (!config.warnings) return;
    var warning = new Warning(message);
    var ctx;
    if (shouldUseOwnTrace) {
        promise._attachExtraTrace(warning);
    } else if (config.longStackTraces && (ctx = Promise._peekContext())) {
        ctx.attachExtraTrace(warning);
    } else {
        var parsed = parseStackAndMessage(warning);
        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
    }

    if (!activeFireEvent("warning", warning)) {
        formatAndLogError(warning, "", true);
    }
}

function reconstructStack(message, stacks) {
    for (var i = 0; i < stacks.length - 1; ++i) {
        stacks[i].push("From previous event:");
        stacks[i] = stacks[i].join("\n");
    }
    if (i < stacks.length) {
        stacks[i] = stacks[i].join("\n");
    }
    return message + "\n" + stacks.join("\n");
}

function removeDuplicateOrEmptyJumps(stacks) {
    for (var i = 0; i < stacks.length; ++i) {
        if (stacks[i].length === 0 ||
            ((i + 1 < stacks.length) && stacks[i][0] === stacks[i+1][0])) {
            stacks.splice(i, 1);
            i--;
        }
    }
}

function removeCommonRoots(stacks) {
    var current = stacks[0];
    for (var i = 1; i < stacks.length; ++i) {
        var prev = stacks[i];
        var currentLastIndex = current.length - 1;
        var currentLastLine = current[currentLastIndex];
        var commonRootMeetPoint = -1;

        for (var j = prev.length - 1; j >= 0; --j) {
            if (prev[j] === currentLastLine) {
                commonRootMeetPoint = j;
                break;
            }
        }

        for (var j = commonRootMeetPoint; j >= 0; --j) {
            var line = prev[j];
            if (current[currentLastIndex] === line) {
                current.pop();
                currentLastIndex--;
            } else {
                break;
            }
        }
        current = prev;
    }
}

function cleanStack(stack) {
    var ret = [];
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        var isTraceLine = "    (No stack trace)" === line ||
            stackFramePattern.test(line);
        var isInternalFrame = isTraceLine && shouldIgnore(line);
        if (isTraceLine && !isInternalFrame) {
            if (indentStackFrames && line.charAt(0) !== " ") {
                line = "    " + line;
            }
            ret.push(line);
        }
    }
    return ret;
}

function stackFramesAsArray(error) {
    var stack = error.stack.replace(/\s+$/g, "").split("\n");
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        if ("    (No stack trace)" === line || stackFramePattern.test(line)) {
            break;
        }
    }
    if (i > 0) {
        stack = stack.slice(i);
    }
    return stack;
}

function parseStackAndMessage(error) {
    var stack = error.stack;
    var message = error.toString();
    stack = typeof stack === "string" && stack.length > 0
                ? stackFramesAsArray(error) : ["    (No stack trace)"];
    return {
        message: message,
        stack: cleanStack(stack)
    };
}

function formatAndLogError(error, title, isSoft) {
    if (typeof console !== "undefined") {
        var message;
        if (util.isObject(error)) {
            var stack = error.stack;
            message = title + formatStack(stack, error);
        } else {
            message = title + String(error);
        }
        if (typeof printWarning === "function") {
            printWarning(message, isSoft);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
}

function fireRejectionEvent(name, localHandler, reason, promise) {
    var localEventFired = false;
    try {
        if (typeof localHandler === "function") {
            localEventFired = true;
            if (name === "rejectionHandled") {
                localHandler(promise);
            } else {
                localHandler(reason, promise);
            }
        }
    } catch (e) {
        async.throwLater(e);
    }

    if (name === "unhandledRejection") {
        if (!activeFireEvent(name, reason, promise) && !localEventFired) {
            formatAndLogError(reason, "Unhandled rejection ");
        }
    } else {
        activeFireEvent(name, promise);
    }
}

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj && typeof obj.toString === "function"
            ? obj.toString() : util.toString(obj);
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function longStackTracesIsSupported() {
    return typeof captureStackTrace === "function";
}

var shouldIgnore = function() { return false; };
var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
function parseLineInfo(line) {
    var matches = line.match(parseLineInfoRegex);
    if (matches) {
        return {
            fileName: matches[1],
            line: parseInt(matches[2], 10)
        };
    }
}

function setBounds(firstLineError, lastLineError) {
    if (!longStackTracesIsSupported()) return;
    var firstStackLines = firstLineError.stack.split("\n");
    var lastStackLines = lastLineError.stack.split("\n");
    var firstIndex = -1;
    var lastIndex = -1;
    var firstFileName;
    var lastFileName;
    for (var i = 0; i < firstStackLines.length; ++i) {
        var result = parseLineInfo(firstStackLines[i]);
        if (result) {
            firstFileName = result.fileName;
            firstIndex = result.line;
            break;
        }
    }
    for (var i = 0; i < lastStackLines.length; ++i) {
        var result = parseLineInfo(lastStackLines[i]);
        if (result) {
            lastFileName = result.fileName;
            lastIndex = result.line;
            break;
        }
    }
    if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName ||
        firstFileName !== lastFileName || firstIndex >= lastIndex) {
        return;
    }

    shouldIgnore = function(line) {
        if (bluebirdFramePattern.test(line)) return true;
        var info = parseLineInfo(line);
        if (info) {
            if (info.fileName === firstFileName &&
                (firstIndex <= info.line && info.line <= lastIndex)) {
                return true;
            }
        }
        return false;
    };
}

function CapturedTrace(parent) {
    this._parent = parent;
    this._promisesCreated = 0;
    var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
    captureStackTrace(this, CapturedTrace);
    if (length > 32) this.uncycle();
}
util.inherits(CapturedTrace, Error);
Context.CapturedTrace = CapturedTrace;

CapturedTrace.prototype.uncycle = function() {
    var length = this._length;
    if (length < 2) return;
    var nodes = [];
    var stackToIndex = {};

    for (var i = 0, node = this; node !== undefined; ++i) {
        nodes.push(node);
        node = node._parent;
    }
    length = this._length = i;
    for (var i = length - 1; i >= 0; --i) {
        var stack = nodes[i].stack;
        if (stackToIndex[stack] === undefined) {
            stackToIndex[stack] = i;
        }
    }
    for (var i = 0; i < length; ++i) {
        var currentStack = nodes[i].stack;
        var index = stackToIndex[currentStack];
        if (index !== undefined && index !== i) {
            if (index > 0) {
                nodes[index - 1]._parent = undefined;
                nodes[index - 1]._length = 1;
            }
            nodes[i]._parent = undefined;
            nodes[i]._length = 1;
            var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;

            if (index < length - 1) {
                cycleEdgeNode._parent = nodes[index + 1];
                cycleEdgeNode._parent.uncycle();
                cycleEdgeNode._length =
                    cycleEdgeNode._parent._length + 1;
            } else {
                cycleEdgeNode._parent = undefined;
                cycleEdgeNode._length = 1;
            }
            var currentChildLength = cycleEdgeNode._length + 1;
            for (var j = i - 2; j >= 0; --j) {
                nodes[j]._length = currentChildLength;
                currentChildLength++;
            }
            return;
        }
    }
};

CapturedTrace.prototype.attachExtraTrace = function(error) {
    if (error.__stackCleaned__) return;
    this.uncycle();
    var parsed = parseStackAndMessage(error);
    var message = parsed.message;
    var stacks = [parsed.stack];

    var trace = this;
    while (trace !== undefined) {
        stacks.push(cleanStack(trace.stack.split("\n")));
        trace = trace._parent;
    }
    removeCommonRoots(stacks);
    removeDuplicateOrEmptyJumps(stacks);
    util.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
    util.notEnumerableProp(error, "__stackCleaned__", true);
};

var captureStackTrace = (function stackDetection() {
    var v8stackFramePattern = /^\s*at\s*/;
    var v8stackFormatter = function(stack, error) {
        if (typeof stack === "string") return stack;

        if (error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        Error.stackTraceLimit += 6;
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        var captureStackTrace = Error.captureStackTrace;

        shouldIgnore = function(line) {
            return bluebirdFramePattern.test(line);
        };
        return function(receiver, ignoreUntil) {
            Error.stackTraceLimit += 6;
            captureStackTrace(receiver, ignoreUntil);
            Error.stackTraceLimit -= 6;
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
        stackFramePattern = /@/;
        formatStack = v8stackFormatter;
        indentStackFrames = true;
        return function captureStackTrace(o) {
            o.stack = new Error().stack;
        };
    }

    var hasStackAfterThrow;
    try { throw new Error(); }
    catch(e) {
        hasStackAfterThrow = ("stack" in e);
    }
    if (!("stack" in err) && hasStackAfterThrow &&
        typeof Error.stackTraceLimit === "number") {
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        return function captureStackTrace(o) {
            Error.stackTraceLimit += 6;
            try { throw new Error(); }
            catch(e) { o.stack = e.stack; }
            Error.stackTraceLimit -= 6;
        };
    }

    formatStack = function(stack, error) {
        if (typeof stack === "string") return stack;

        if ((typeof error === "object" ||
            typeof error === "function") &&
            error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    return null;

})([]);

if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
    printWarning = function (message) {
        console.warn(message);
    };
    if (util.isNode && process.stderr.isTTY) {
        printWarning = function(message, isSoft) {
            var color = isSoft ? "\u001b[33m" : "\u001b[31m";
            console.warn(color + message + "\u001b[0m\n");
        };
    } else if (!util.isNode && typeof (new Error().stack) === "string") {
        printWarning = function(message, isSoft) {
            console.warn("%c" + message,
                        isSoft ? "color: darkorange" : "color: red");
        };
    }
}

var config = {
    warnings: warnings,
    longStackTraces: false,
    cancellation: false,
    monitoring: false
};

if (longStackTraces) Promise.longStackTraces();

return {
    longStackTraces: function() {
        return config.longStackTraces;
    },
    warnings: function() {
        return config.warnings;
    },
    cancellation: function() {
        return config.cancellation;
    },
    monitoring: function() {
        return config.monitoring;
    },
    propagateFromFunction: function() {
        return propagateFromFunction;
    },
    boundValueFunction: function() {
        return boundValueFunction;
    },
    checkForgottenReturns: checkForgottenReturns,
    setBounds: setBounds,
    warn: warn,
    deprecated: deprecated,
    CapturedTrace: CapturedTrace,
    fireDomEvent: fireDomEvent,
    fireGlobalEvent: fireGlobalEvent
};
};

},{"./errors":9,"./util":21}],8:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function returner() {
    return this.value;
}
function thrower() {
    throw this.reason;
}

Promise.prototype["return"] =
Promise.prototype.thenReturn = function (value) {
    if (value instanceof Promise) value.suppressUnhandledRejections();
    return this._then(
        returner, undefined, undefined, {value: value}, undefined);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow = function (reason) {
    return this._then(
        thrower, undefined, undefined, {reason: reason}, undefined);
};

Promise.prototype.catchThrow = function (reason) {
    if (arguments.length <= 1) {
        return this._then(
            undefined, thrower, undefined, {reason: reason}, undefined);
    } else {
        var _reason = arguments[1];
        var handler = function() {throw _reason;};
        return this.caught(reason, handler);
    }
};

Promise.prototype.catchReturn = function (value) {
    if (arguments.length <= 1) {
        if (value instanceof Promise) value.suppressUnhandledRejections();
        return this._then(
            undefined, returner, undefined, {value: value}, undefined);
    } else {
        var _value = arguments[1];
        if (_value instanceof Promise) _value.suppressUnhandledRejections();
        var handler = function() {return _value;};
        return this.caught(value, handler);
    }
};
};

},{}],9:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5");
var Objectfreeze = es5.freeze;
var util = _dereq_("./util");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        notEnumerableProp(this, "message",
            typeof message === "string" ? message : defaultMessage);
        notEnumerableProp(this, "name", nameProperty);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            Error.call(this);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var Warning = subError("Warning", "warning");
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

es5.defineProperty(AggregateError.prototype, "length", {
    value: 0,
    configurable: false,
    writable: true,
    enumerable: true
});
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    if (!(this instanceof OperationalError))
        return new OperationalError(message);
    notEnumerableProp(this, "name", "OperationalError");
    notEnumerableProp(this, "message", message);
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        notEnumerableProp(this, "message", message.message);
        notEnumerableProp(this, "stack", message.stack);
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var errorTypes = Error["__BluebirdErrorTypes__"];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    es5.defineProperty(Error, "__BluebirdErrorTypes__", {
        value: errorTypes,
        writable: false,
        enumerable: false,
        configurable: false
    });
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    Warning: Warning
};

},{"./es5":10,"./util":21}],10:[function(_dereq_,module,exports){
var isES5 = (function(){
    "use strict";
    return this === undefined;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        getDescriptor: Object.getOwnPropertyDescriptor,
        keys: Object.keys,
        names: Object.getOwnPropertyNames,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5,
        propertyIsWritable: function(obj, prop) {
            var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            return !!(!descriptor || descriptor.writable || descriptor.set);
        }
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function (o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    };

    var ObjectGetDescriptor = function(o, key) {
        return {value: o[key]};
    };

    var ObjectDefineProperty = function (o, key, desc) {
        o[key] = desc.value;
        return o;
    };

    var ObjectFreeze = function (obj) {
        return obj;
    };

    var ObjectGetPrototypeOf = function (obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    };

    var ArrayIsArray = function (obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    };

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        names: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        getDescriptor: ObjectGetDescriptor,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5,
        propertyIsWritable: function() {
            return true;
        }
    };
}

},{}],11:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, tryConvertToPromise) {
var util = _dereq_("./util");
var CancellationError = Promise.CancellationError;
var errorObj = util.errorObj;

function PassThroughHandlerContext(promise, type, handler) {
    this.promise = promise;
    this.type = type;
    this.handler = handler;
    this.called = false;
    this.cancelPromise = null;
}

PassThroughHandlerContext.prototype.isFinallyHandler = function() {
    return this.type === 0;
};

function FinallyHandlerCancelReaction(finallyHandler) {
    this.finallyHandler = finallyHandler;
}

FinallyHandlerCancelReaction.prototype._resultCancelled = function() {
    checkCancel(this.finallyHandler);
};

function checkCancel(ctx, reason) {
    if (ctx.cancelPromise != null) {
        if (arguments.length > 1) {
            ctx.cancelPromise._reject(reason);
        } else {
            ctx.cancelPromise._cancel();
        }
        ctx.cancelPromise = null;
        return true;
    }
    return false;
}

function succeed() {
    return finallyHandler.call(this, this.promise._target()._settledValue());
}
function fail(reason) {
    if (checkCancel(this, reason)) return;
    errorObj.e = reason;
    return errorObj;
}
function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    if (!this.called) {
        this.called = true;
        var ret = this.isFinallyHandler()
            ? handler.call(promise._boundValue())
            : handler.call(promise._boundValue(), reasonOrValue);
        if (ret !== undefined) {
            promise._setReturnedNonUndefined();
            var maybePromise = tryConvertToPromise(ret, promise);
            if (maybePromise instanceof Promise) {
                if (this.cancelPromise != null) {
                    if (maybePromise.isCancelled()) {
                        var reason =
                            new CancellationError("late cancellation observer");
                        promise._attachExtraTrace(reason);
                        errorObj.e = reason;
                        return errorObj;
                    } else if (maybePromise.isPending()) {
                        maybePromise._attachCancellationCallback(
                            new FinallyHandlerCancelReaction(this));
                    }
                }
                return maybePromise._then(
                    succeed, fail, undefined, this, undefined);
            }
        }
    }

    if (promise.isRejected()) {
        checkCancel(this);
        errorObj.e = reasonOrValue;
        return errorObj;
    } else {
        checkCancel(this);
        return reasonOrValue;
    }
}

Promise.prototype._passThrough = function(handler, type, success, fail) {
    if (typeof handler !== "function") return this.then();
    return this._then(success,
                      fail,
                      undefined,
                      new PassThroughHandlerContext(this, type, handler),
                      undefined);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function (handler) {
    return this._passThrough(handler,
                             0,
                             finallyHandler,
                             finallyHandler);
};

Promise.prototype.tap = function (handler) {
    return this._passThrough(handler, 1, finallyHandler);
};

return PassThroughHandlerContext;
};

},{"./util":21}],12:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, tryConvertToPromise, INTERNAL) {
var util = _dereq_("./util");
var canEvaluate = util.canEvaluate;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var reject;

if (!true) {
if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var promiseSetter = function(i) {
        return new Function("promise", "holder", "                           \n\
            'use strict';                                                    \n\
            holder.pIndex = promise;                                         \n\
            ".replace(/Index/g, i));
    };

    var generateHolderClass = function(total) {
        var props = new Array(total);
        for (var i = 0; i < props.length; ++i) {
            props[i] = "this.p" + (i+1);
        }
        var assignment = props.join(" = ") + " = null;";
        var cancellationCode= "var promise;\n" + props.map(function(prop) {
            return "                                                         \n\
                promise = " + prop + ";                                      \n\
                if (promise instanceof Promise) {                            \n\
                    promise.cancel();                                        \n\
                }                                                            \n\
            ";
        }).join("\n");
        var passedArguments = props.join(", ");
        var name = "Holder$" + total;


        var code = "return function(tryCatch, errorObj, Promise) {           \n\
            'use strict';                                                    \n\
            function [TheName](fn) {                                         \n\
                [TheProperties]                                              \n\
                this.fn = fn;                                                \n\
                this.now = 0;                                                \n\
            }                                                                \n\
            [TheName].prototype.checkFulfillment = function(promise) {       \n\
                var now = ++this.now;                                        \n\
                if (now === [TheTotal]) {                                    \n\
                    promise._pushContext();                                  \n\
                    var callback = this.fn;                                  \n\
                    var ret = tryCatch(callback)([ThePassedArguments]);      \n\
                    promise._popContext();                                   \n\
                    if (ret === errorObj) {                                  \n\
                        promise._rejectCallback(ret.e, false);               \n\
                    } else {                                                 \n\
                        promise._resolveCallback(ret);                       \n\
                    }                                                        \n\
                }                                                            \n\
            };                                                               \n\
                                                                             \n\
            [TheName].prototype._resultCancelled = function() {              \n\
                [CancellationCode]                                           \n\
            };                                                               \n\
                                                                             \n\
            return [TheName];                                                \n\
        }(tryCatch, errorObj, Promise);                                      \n\
        ";

        code = code.replace(/\[TheName\]/g, name)
            .replace(/\[TheTotal\]/g, total)
            .replace(/\[ThePassedArguments\]/g, passedArguments)
            .replace(/\[TheProperties\]/g, assignment)
            .replace(/\[CancellationCode\]/g, cancellationCode);

        return new Function("tryCatch", "errorObj", "Promise", code)
                           (tryCatch, errorObj, Promise);
    };

    var holderClasses = [];
    var thenCallbacks = [];
    var promiseSetters = [];

    for (var i = 0; i < 8; ++i) {
        holderClasses.push(generateHolderClass(i + 1));
        thenCallbacks.push(thenCallback(i + 1));
        promiseSetters.push(promiseSetter(i + 1));
    }

    reject = function (reason) {
        this._reject(reason);
    };
}}

Promise.join = function () {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (!true) {
            if (last <= 8 && canEvaluate) {
                var ret = new Promise(INTERNAL);
                ret._captureStackTrace();
                var HolderClass = holderClasses[last - 1];
                var holder = new HolderClass(fn);
                var callbacks = thenCallbacks;

                for (var i = 0; i < last; ++i) {
                    var maybePromise = tryConvertToPromise(arguments[i], ret);
                    if (maybePromise instanceof Promise) {
                        maybePromise = maybePromise._target();
                        var bitField = maybePromise._bitField;
                        ;
                        if (((bitField & 50397184) === 0)) {
                            maybePromise._then(callbacks[i], reject,
                                               undefined, ret, holder);
                            promiseSetters[i](maybePromise, holder);
                        } else if (((bitField & 33554432) !== 0)) {
                            callbacks[i].call(ret,
                                              maybePromise._value(), holder);
                        } else if (((bitField & 16777216) !== 0)) {
                            ret._reject(maybePromise._reason());
                        } else {
                            ret._cancel();
                        }
                    } else {
                        callbacks[i].call(ret, maybePromise, holder);
                    }
                }
                if (!ret._isFateSealed()) {
                    ret._setAsyncGuaranteed();
                    ret._setOnCancel(holder);
                }
                return ret;
            }
        }
    }
    var args = [].slice.call(arguments);;
    if (fn) args.pop();
    var ret = new PromiseArray(args).promise();
    return fn !== undefined ? ret.spread(fn) : ret;
};

};

},{"./util":21}],13:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, INTERNAL, tryConvertToPromise, apiRejection, debug) {
var util = _dereq_("./util");
var tryCatch = util.tryCatch;

Promise.method = function (fn) {
    if (typeof fn !== "function") {
        throw new Promise.TypeError("expecting a function but got " + util.classString(fn));
    }
    return function () {
        var ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        var promiseCreated = ret._popContext();
        debug.checkForgottenReturns(
            value, promiseCreated, "Promise.method", ret);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function (fn) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._pushContext();
    var value;
    if (arguments.length > 1) {
        debug.deprecated("calling Promise.try with more than 1 argument");
        var arg = arguments[1];
        var ctx = arguments[2];
        value = util.isArray(arg) ? tryCatch(fn).apply(ctx, arg)
                                  : tryCatch(fn).call(ctx, arg);
    } else {
        value = tryCatch(fn)();
    }
    var promiseCreated = ret._popContext();
    debug.checkForgottenReturns(
        value, promiseCreated, "Promise.try", ret);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.prototype._resolveFromSyncValue = function (value) {
    if (value === util.errorObj) {
        this._rejectCallback(value.e, false);
    } else {
        this._resolveCallback(value, true);
    }
};
};

},{"./util":21}],14:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors");
var OperationalError = errors.OperationalError;
var es5 = _dereq_("./es5");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

var rErrorKey = /^(?:name|message|stack|cause)$/;
function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
        ret.name = obj.name;
        ret.message = obj.message;
        ret.stack = obj.stack;
        var keys = es5.keys(obj);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (!rErrorKey.test(key)) {
                ret[key] = obj[key];
            }
        }
        return ret;
    }
    util.markAsOriginatingFromRejection(obj);
    return obj;
}

function nodebackForPromise(promise, multiArgs) {
    return function(err, value) {
        if (promise === null) return;
        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (!multiArgs) {
            promise._fulfill(value);
        } else {
            var args = [].slice.call(arguments, 1);;
            promise._fulfill(args);
        }
        promise = null;
    };
}

module.exports = nodebackForPromise;

},{"./errors":9,"./es5":10,"./util":21}],15:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var makeSelfResolutionError = function () {
    return new TypeError("circular promise resolution chain\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
};
var reflectHandler = function() {
    return new Promise.PromiseInspection(this._target());
};
var apiRejection = function(msg) {
    return Promise.reject(new TypeError(msg));
};
function Proxyable() {}
var UNDEFINED_BINDING = {};
var util = _dereq_("./util");

var getDomain;
if (util.isNode) {
    getDomain = function() {
        var ret = process.domain;
        if (ret === undefined) ret = null;
        return ret;
    };
} else {
    getDomain = function() {
        return null;
    };
}
util.notEnumerableProp(Promise, "_getDomain", getDomain);

var es5 = _dereq_("./es5");
var Async = _dereq_("./async");
var async = new Async();
es5.defineProperty(Promise, "_async", {value: async});
var errors = _dereq_("./errors");
var TypeError = Promise.TypeError = errors.TypeError;
Promise.RangeError = errors.RangeError;
var CancellationError = Promise.CancellationError = errors.CancellationError;
Promise.TimeoutError = errors.TimeoutError;
Promise.OperationalError = errors.OperationalError;
Promise.RejectionError = errors.OperationalError;
Promise.AggregateError = errors.AggregateError;
var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {};
var tryConvertToPromise = _dereq_("./thenables")(Promise, INTERNAL);
var PromiseArray =
    _dereq_("./promise_array")(Promise, INTERNAL,
                               tryConvertToPromise, apiRejection, Proxyable);
var Context = _dereq_("./context")(Promise);
 /*jshint unused:false*/
var createContext = Context.create;
var debug = _dereq_("./debuggability")(Promise, Context);
var CapturedTrace = debug.CapturedTrace;
var PassThroughHandlerContext =
    _dereq_("./finally")(Promise, tryConvertToPromise);
var catchFilter = _dereq_("./catch_filter")(NEXT_FILTER);
var nodebackForPromise = _dereq_("./nodeback");
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
function check(self, executor) {
    if (typeof executor !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(executor));
    }
    if (self.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
}

function Promise(executor) {
    this._bitField = 0;
    this._fulfillmentHandler0 = undefined;
    this._rejectionHandler0 = undefined;
    this._promise0 = undefined;
    this._receiver0 = undefined;
    if (executor !== INTERNAL) {
        check(this, executor);
        this._resolveFromExecutor(executor);
    }
    this._promiseCreated();
    this._fireEvent("promiseCreated", this);
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] = function (fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (util.isObject(item)) {
                catchInstances[j++] = item;
            } else {
                return apiRejection("expecting an object but got " + util.classString(item));
            }
        }
        catchInstances.length = j;
        fn = arguments[i];
        return this.then(undefined, catchFilter(catchInstances, fn, this));
    }
    return this.then(undefined, fn);
};

Promise.prototype.reflect = function () {
    return this._then(reflectHandler,
        reflectHandler, undefined, this, undefined);
};

Promise.prototype.then = function (didFulfill, didReject) {
    if (debug.warnings() && arguments.length > 0 &&
        typeof didFulfill !== "function" &&
        typeof didReject !== "function") {
        var msg = ".then() only accepts functions but was passed: " +
                util.classString(didFulfill);
        if (arguments.length > 1) {
            msg += ", " + util.classString(didReject);
        }
        this._warn(msg);
    }
    return this._then(didFulfill, didReject, undefined, undefined, undefined);
};

Promise.prototype.done = function (didFulfill, didReject) {
    var promise =
        this._then(didFulfill, didReject, undefined, undefined, undefined);
    promise._setIsFinal();
};

Promise.prototype.spread = function (fn) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }
    return this.all()._then(fn, undefined, undefined, APPLY, undefined);
};

Promise.prototype.toJSON = function () {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: undefined,
        rejectionReason: undefined
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this.value();
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this.reason();
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function () {
    if (arguments.length > 0) {
        this._warn(".all() was passed arguments but it does not take any");
    }
    return new PromiseArray(this).promise();
};

Promise.prototype.error = function (fn) {
    return this.caught(util.originatesFromRejection, fn);
};

Promise.getNewLibraryCopy = module.exports;

Promise.is = function (val) {
    return val instanceof Promise;
};

Promise.fromNode = Promise.fromCallback = function(fn) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    var multiArgs = arguments.length > 1 ? !!Object(arguments[1]).multiArgs
                                         : false;
    var result = tryCatch(fn)(nodebackForPromise(ret, multiArgs));
    if (result === errorObj) {
        ret._rejectCallback(result.e, true);
    }
    if (!ret._isFateSealed()) ret._setAsyncGuaranteed();
    return ret;
};

Promise.all = function (promises) {
    return new PromiseArray(promises).promise();
};

Promise.cast = function (obj) {
    var ret = tryConvertToPromise(obj);
    if (!(ret instanceof Promise)) {
        ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._setFulfilled();
        ret._rejectionHandler0 = obj;
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function (reason) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._rejectCallback(reason, true);
    return ret;
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(fn));
    }
    return async.setScheduler(fn);
};

Promise.prototype._then = function (
    didFulfill,
    didReject,
    _,    receiver,
    internalData
) {
    var haveInternalData = internalData !== undefined;
    var promise = haveInternalData ? internalData : new Promise(INTERNAL);
    var target = this._target();
    var bitField = target._bitField;

    if (!haveInternalData) {
        promise._propagateFrom(this, 3);
        promise._captureStackTrace();
        if (receiver === undefined &&
            ((this._bitField & 2097152) !== 0)) {
            if (!((bitField & 50397184) === 0)) {
                receiver = this._boundValue();
            } else {
                receiver = target === this ? undefined : this._boundTo;
            }
        }
        this._fireEvent("promiseChained", this, promise);
    }

    var domain = getDomain();
    if (!((bitField & 50397184) === 0)) {
        var handler, value, settler = target._settlePromiseCtx;
        if (((bitField & 33554432) !== 0)) {
            value = target._rejectionHandler0;
            handler = didFulfill;
        } else if (((bitField & 16777216) !== 0)) {
            value = target._fulfillmentHandler0;
            handler = didReject;
            target._unsetRejectionIsUnhandled();
        } else {
            settler = target._settlePromiseLateCancellationObserver;
            value = new CancellationError("late cancellation observer");
            target._attachExtraTrace(value);
            handler = didReject;
        }

        async.invoke(settler, target, {
            handler: domain === null ? handler
                : (typeof handler === "function" && domain.bind(handler)),
            promise: promise,
            receiver: receiver,
            value: value
        });
    } else {
        target._addCallbacks(didFulfill, didReject, promise, receiver, domain);
    }

    return promise;
};

Promise.prototype._length = function () {
    return this._bitField & 65535;
};

Promise.prototype._isFateSealed = function () {
    return (this._bitField & 117506048) !== 0;
};

Promise.prototype._isFollowing = function () {
    return (this._bitField & 67108864) === 67108864;
};

Promise.prototype._setLength = function (len) {
    this._bitField = (this._bitField & -65536) |
        (len & 65535);
};

Promise.prototype._setFulfilled = function () {
    this._bitField = this._bitField | 33554432;
    this._fireEvent("promiseFulfilled", this);
};

Promise.prototype._setRejected = function () {
    this._bitField = this._bitField | 16777216;
    this._fireEvent("promiseRejected", this);
};

Promise.prototype._setFollowing = function () {
    this._bitField = this._bitField | 67108864;
    this._fireEvent("promiseResolved", this);
};

Promise.prototype._setIsFinal = function () {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._isFinal = function () {
    return (this._bitField & 4194304) > 0;
};

Promise.prototype._unsetCancelled = function() {
    this._bitField = this._bitField & (~65536);
};

Promise.prototype._setCancelled = function() {
    this._bitField = this._bitField | 65536;
    this._fireEvent("promiseCancelled", this);
};

Promise.prototype._setAsyncGuaranteed = function() {
    if (async.hasCustomScheduler()) return;
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._receiverAt = function (index) {
    var ret = index === 0 ? this._receiver0 : this[
            index * 4 - 4 + 3];
    if (ret === UNDEFINED_BINDING) {
        return undefined;
    } else if (ret === undefined && this._isBound()) {
        return this._boundValue();
    }
    return ret;
};

Promise.prototype._promiseAt = function (index) {
    return this[
            index * 4 - 4 + 2];
};

Promise.prototype._fulfillmentHandlerAt = function (index) {
    return this[
            index * 4 - 4 + 0];
};

Promise.prototype._rejectionHandlerAt = function (index) {
    return this[
            index * 4 - 4 + 1];
};

Promise.prototype._boundValue = function() {};

Promise.prototype._migrateCallback0 = function (follower) {
    var bitField = follower._bitField;
    var fulfill = follower._fulfillmentHandler0;
    var reject = follower._rejectionHandler0;
    var promise = follower._promise0;
    var receiver = follower._receiverAt(0);
    if (receiver === undefined) receiver = UNDEFINED_BINDING;
    this._addCallbacks(fulfill, reject, promise, receiver, null);
};

Promise.prototype._migrateCallbackAt = function (follower, index) {
    var fulfill = follower._fulfillmentHandlerAt(index);
    var reject = follower._rejectionHandlerAt(index);
    var promise = follower._promiseAt(index);
    var receiver = follower._receiverAt(index);
    if (receiver === undefined) receiver = UNDEFINED_BINDING;
    this._addCallbacks(fulfill, reject, promise, receiver, null);
};

Promise.prototype._addCallbacks = function (
    fulfill,
    reject,
    promise,
    receiver,
    domain
) {
    var index = this._length();

    if (index >= 65535 - 4) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        this._receiver0 = receiver;
        if (typeof fulfill === "function") {
            this._fulfillmentHandler0 =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this._rejectionHandler0 =
                domain === null ? reject : domain.bind(reject);
        }
    } else {
        var base = index * 4 - 4;
        this[base + 2] = promise;
        this[base + 3] = receiver;
        if (typeof fulfill === "function") {
            this[base + 0] =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this[base + 1] =
                domain === null ? reject : domain.bind(reject);
        }
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._proxy = function (proxyable, arg) {
    this._addCallbacks(undefined, undefined, arg, proxyable, null);
};

Promise.prototype._resolveCallback = function(value, shouldBind) {
    if (((this._bitField & 117506048) !== 0)) return;
    if (value === this)
        return this._rejectCallback(makeSelfResolutionError(), false);
    var maybePromise = tryConvertToPromise(value, this);
    if (!(maybePromise instanceof Promise)) return this._fulfill(value);

    if (shouldBind) this._propagateFrom(maybePromise, 2);

    var promise = maybePromise._target();

    if (promise === this) {
        this._reject(makeSelfResolutionError());
        return;
    }

    var bitField = promise._bitField;
    if (((bitField & 50397184) === 0)) {
        var len = this._length();
        if (len > 0) promise._migrateCallback0(this);
        for (var i = 1; i < len; ++i) {
            promise._migrateCallbackAt(this, i);
        }
        this._setFollowing();
        this._setLength(0);
        this._setFollowee(promise);
    } else if (((bitField & 33554432) !== 0)) {
        this._fulfill(promise._value());
    } else if (((bitField & 16777216) !== 0)) {
        this._reject(promise._reason());
    } else {
        var reason = new CancellationError("late cancellation observer");
        promise._attachExtraTrace(reason);
        this._reject(reason);
    }
};

Promise.prototype._rejectCallback =
function(reason, synchronous, ignoreNonErrorWarnings) {
    var trace = util.ensureErrorObject(reason);
    var hasStack = trace === reason;
    if (!hasStack && !ignoreNonErrorWarnings && debug.warnings()) {
        var message = "a promise was rejected with a non-error: " +
            util.classString(reason);
        this._warn(message, true);
    }
    this._attachExtraTrace(trace, synchronous ? hasStack : false);
    this._reject(reason);
};

Promise.prototype._resolveFromExecutor = function (executor) {
    var promise = this;
    this._captureStackTrace();
    this._pushContext();
    var synchronous = true;
    var r = this._execute(executor, function(value) {
        promise._resolveCallback(value);
    }, function (reason) {
        promise._rejectCallback(reason, synchronous);
    });
    synchronous = false;
    this._popContext();

    if (r !== undefined) {
        promise._rejectCallback(r, true);
    }
};

Promise.prototype._settlePromiseFromHandler = function (
    handler, receiver, value, promise
) {
    var bitField = promise._bitField;
    if (((bitField & 65536) !== 0)) return;
    promise._pushContext();
    var x;
    if (receiver === APPLY) {
        if (!value || typeof value.length !== "number") {
            x = errorObj;
            x.e = new TypeError("cannot .spread() a non-array: " +
                                    util.classString(value));
        } else {
            x = tryCatch(handler).apply(this._boundValue(), value);
        }
    } else {
        x = tryCatch(handler).call(receiver, value);
    }
    var promiseCreated = promise._popContext();
    bitField = promise._bitField;
    if (((bitField & 65536) !== 0)) return;

    if (x === NEXT_FILTER) {
        promise._reject(value);
    } else if (x === errorObj) {
        promise._rejectCallback(x.e, false);
    } else {
        debug.checkForgottenReturns(x, promiseCreated, "",  promise, this);
        promise._resolveCallback(x);
    }
};

Promise.prototype._target = function() {
    var ret = this;
    while (ret._isFollowing()) ret = ret._followee();
    return ret;
};

Promise.prototype._followee = function() {
    return this._rejectionHandler0;
};

Promise.prototype._setFollowee = function(promise) {
    this._rejectionHandler0 = promise;
};

Promise.prototype._settlePromise = function(promise, handler, receiver, value) {
    var isPromise = promise instanceof Promise;
    var bitField = this._bitField;
    var asyncGuaranteed = ((bitField & 134217728) !== 0);
    if (((bitField & 65536) !== 0)) {
        if (isPromise) promise._invokeInternalOnCancel();

        if (receiver instanceof PassThroughHandlerContext &&
            receiver.isFinallyHandler()) {
            receiver.cancelPromise = promise;
            if (tryCatch(handler).call(receiver, value) === errorObj) {
                promise._reject(errorObj.e);
            }
        } else if (handler === reflectHandler) {
            promise._fulfill(reflectHandler.call(receiver));
        } else if (receiver instanceof Proxyable) {
            receiver._promiseCancelled(promise);
        } else if (isPromise || promise instanceof PromiseArray) {
            promise._cancel();
        } else {
            receiver.cancel();
        }
    } else if (typeof handler === "function") {
        if (!isPromise) {
            handler.call(receiver, value, promise);
        } else {
            if (asyncGuaranteed) promise._setAsyncGuaranteed();
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (receiver instanceof Proxyable) {
        if (!receiver._isResolved()) {
            if (((bitField & 33554432) !== 0)) {
                receiver._promiseFulfilled(value, promise);
            } else {
                receiver._promiseRejected(value, promise);
            }
        }
    } else if (isPromise) {
        if (asyncGuaranteed) promise._setAsyncGuaranteed();
        if (((bitField & 33554432) !== 0)) {
            promise._fulfill(value);
        } else {
            promise._reject(value);
        }
    }
};

Promise.prototype._settlePromiseLateCancellationObserver = function(ctx) {
    var handler = ctx.handler;
    var promise = ctx.promise;
    var receiver = ctx.receiver;
    var value = ctx.value;
    if (typeof handler === "function") {
        if (!(promise instanceof Promise)) {
            handler.call(receiver, value, promise);
        } else {
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (promise instanceof Promise) {
        promise._reject(value);
    }
};

Promise.prototype._settlePromiseCtx = function(ctx) {
    this._settlePromise(ctx.promise, ctx.handler, ctx.receiver, ctx.value);
};

Promise.prototype._settlePromise0 = function(handler, value, bitField) {
    var promise = this._promise0;
    var receiver = this._receiverAt(0);
    this._promise0 = undefined;
    this._receiver0 = undefined;
    this._settlePromise(promise, handler, receiver, value);
};

Promise.prototype._clearCallbackDataAtIndex = function(index) {
    var base = index * 4 - 4;
    this[base + 2] =
    this[base + 3] =
    this[base + 0] =
    this[base + 1] = undefined;
};

Promise.prototype._fulfill = function (value) {
    var bitField = this._bitField;
    if (((bitField & 117506048) >>> 16)) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._reject(err);
    }
    this._setFulfilled();
    this._rejectionHandler0 = value;

    if ((bitField & 65535) > 0) {
        if (((bitField & 134217728) !== 0)) {
            this._settlePromises();
        } else {
            async.settlePromises(this);
        }
    }
};

Promise.prototype._reject = function (reason) {
    var bitField = this._bitField;
    if (((bitField & 117506048) >>> 16)) return;
    this._setRejected();
    this._fulfillmentHandler0 = reason;

    if (this._isFinal()) {
        return async.fatalError(reason, util.isNode);
    }

    if ((bitField & 65535) > 0) {
        async.settlePromises(this);
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._fulfillPromises = function (len, value) {
    for (var i = 1; i < len; i++) {
        var handler = this._fulfillmentHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, value);
    }
};

Promise.prototype._rejectPromises = function (len, reason) {
    for (var i = 1; i < len; i++) {
        var handler = this._rejectionHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, reason);
    }
};

Promise.prototype._settlePromises = function () {
    var bitField = this._bitField;
    var len = (bitField & 65535);

    if (len > 0) {
        if (((bitField & 16842752) !== 0)) {
            var reason = this._fulfillmentHandler0;
            this._settlePromise0(this._rejectionHandler0, reason, bitField);
            this._rejectPromises(len, reason);
        } else {
            var value = this._rejectionHandler0;
            this._settlePromise0(this._fulfillmentHandler0, value, bitField);
            this._fulfillPromises(len, value);
        }
        this._setLength(0);
    }
    this._clearCancellationData();
};

Promise.prototype._settledValue = function() {
    var bitField = this._bitField;
    if (((bitField & 33554432) !== 0)) {
        return this._rejectionHandler0;
    } else if (((bitField & 16777216) !== 0)) {
        return this._fulfillmentHandler0;
    }
};

function deferResolve(v) {this.promise._resolveCallback(v);}
function deferReject(v) {this.promise._rejectCallback(v, false);}

Promise.defer = Promise.pending = function() {
    debug.deprecated("Promise.defer", "new Promise");
    var promise = new Promise(INTERNAL);
    return {
        promise: promise,
        resolve: deferResolve,
        reject: deferReject
    };
};

util.notEnumerableProp(Promise,
                       "_makeSelfResolutionError",
                       makeSelfResolutionError);

_dereq_("./method")(Promise, INTERNAL, tryConvertToPromise, apiRejection,
    debug);
_dereq_("./bind")(Promise, INTERNAL, tryConvertToPromise, debug);
_dereq_("./cancel")(Promise, PromiseArray, apiRejection, debug);
_dereq_("./direct_resolve")(Promise);
_dereq_("./synchronous_inspection")(Promise);
_dereq_("./join")(
    Promise, PromiseArray, tryConvertToPromise, INTERNAL, debug);
Promise.Promise = Promise;
Promise.version = "3.4.0";
                                                         
    util.toFastProperties(Promise);                                          
    util.toFastProperties(Promise.prototype);                                
    function fillTypes(value) {                                              
        var p = new Promise(INTERNAL);                                       
        p._fulfillmentHandler0 = value;                                      
        p._rejectionHandler0 = value;                                        
        p._promise0 = value;                                                 
        p._receiver0 = value;                                                
    }                                                                        
    // Complete slack tracking, opt out of field-type tracking and           
    // stabilize map                                                         
    fillTypes({a: 1});                                                       
    fillTypes({b: 2});                                                       
    fillTypes({c: 3});                                                       
    fillTypes(1);                                                            
    fillTypes(function(){});                                                 
    fillTypes(undefined);                                                    
    fillTypes(false);                                                        
    fillTypes(new Promise(INTERNAL));                                        
    debug.setBounds(Async.firstLineError, util.lastLineError);               
    return Promise;                                                          

};

},{"./async":1,"./bind":2,"./cancel":4,"./catch_filter":5,"./context":6,"./debuggability":7,"./direct_resolve":8,"./errors":9,"./es5":10,"./finally":11,"./join":12,"./method":13,"./nodeback":14,"./promise_array":16,"./synchronous_inspection":19,"./thenables":20,"./util":21}],16:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise,
    apiRejection, Proxyable) {
var util = _dereq_("./util");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    if (values instanceof Promise) {
        promise._propagateFrom(values, 3);
    }
    promise._setOnCancel(this);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(undefined, -2);
}
util.inherits(PromiseArray, Proxyable);

PromiseArray.prototype.length = function () {
    return this._length;
};

PromiseArray.prototype.promise = function () {
    return this._promise;
};

PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
    var values = tryConvertToPromise(this._values, this._promise);
    if (values instanceof Promise) {
        values = values._target();
        var bitField = values._bitField;
        ;
        this._values = values;

        if (((bitField & 50397184) === 0)) {
            this._promise._setAsyncGuaranteed();
            return values._then(
                init,
                this._reject,
                undefined,
                this,
                resolveValueIfEmpty
           );
        } else if (((bitField & 33554432) !== 0)) {
            values = values._value();
        } else if (((bitField & 16777216) !== 0)) {
            return this._reject(values._reason());
        } else {
            return this._cancel();
        }
    }
    values = util.asArray(values);
    if (values === null) {
        var err = apiRejection(
            "expecting an array or an iterable object but got " + util.classString(values)).reason();
        this._promise._rejectCallback(err, false);
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    this._iterate(values);
};

PromiseArray.prototype._iterate = function(values) {
    var len = this.getActualLength(values.length);
    this._length = len;
    this._values = this.shouldCopyValues() ? new Array(len) : this._values;
    var result = this._promise;
    var isResolved = false;
    var bitField = null;
    for (var i = 0; i < len; ++i) {
        var maybePromise = tryConvertToPromise(values[i], result);

        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            bitField = maybePromise._bitField;
        } else {
            bitField = null;
        }

        if (isResolved) {
            if (bitField !== null) {
                maybePromise.suppressUnhandledRejections();
            }
        } else if (bitField !== null) {
            if (((bitField & 50397184) === 0)) {
                maybePromise._proxy(this, i);
                this._values[i] = maybePromise;
            } else if (((bitField & 33554432) !== 0)) {
                isResolved = this._promiseFulfilled(maybePromise._value(), i);
            } else if (((bitField & 16777216) !== 0)) {
                isResolved = this._promiseRejected(maybePromise._reason(), i);
            } else {
                isResolved = this._promiseCancelled(i);
            }
        } else {
            isResolved = this._promiseFulfilled(maybePromise, i);
        }
    }
    if (!isResolved) result._setAsyncGuaranteed();
};

PromiseArray.prototype._isResolved = function () {
    return this._values === null;
};

PromiseArray.prototype._resolve = function (value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype._cancel = function() {
    if (this._isResolved() || !this._promise.isCancellable()) return;
    this._values = null;
    this._promise._cancel();
};

PromiseArray.prototype._reject = function (reason) {
    this._values = null;
    this._promise._rejectCallback(reason, false);
};

PromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
        return true;
    }
    return false;
};

PromiseArray.prototype._promiseCancelled = function() {
    this._cancel();
    return true;
};

PromiseArray.prototype._promiseRejected = function (reason) {
    this._totalResolved++;
    this._reject(reason);
    return true;
};

PromiseArray.prototype._resultCancelled = function() {
    if (this._isResolved()) return;
    var values = this._values;
    this._cancel();
    if (values instanceof Promise) {
        values.cancel();
    } else {
        for (var i = 0; i < values.length; ++i) {
            if (values[i] instanceof Promise) {
                values[i].cancel();
            }
        }
    }
};

PromiseArray.prototype.shouldCopyValues = function () {
    return true;
};

PromiseArray.prototype.getActualLength = function (len) {
    return len;
};

return PromiseArray;
};

},{"./util":21}],17:[function(_dereq_,module,exports){
"use strict";
function arrayMove(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
        src[j + srcIndex] = void 0;
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
}

Queue.prototype._willBeOverCapacity = function (size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function (arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype._unshiftOne = function(value) {
    var capacity = this._capacity;
    this._checkCapacity(this.length() + 1);
    var front = this._front;
    var i = (((( front - 1 ) &
                    ( capacity - 1) ) ^ capacity ) - capacity );
    this[i] = value;
    this._front = i;
    this._length = this.length() + 1;
};

Queue.prototype.unshift = function(fn, receiver, arg) {
    this._unshiftOne(arg);
    this._unshiftOne(receiver);
    this._unshiftOne(fn);
};

Queue.prototype.push = function (fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function () {
    var front = this._front,
        ret = this[front];

    this[front] = undefined;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function () {
    return this._length;
};

Queue.prototype._checkCapacity = function (size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 1);
    }
};

Queue.prototype._resizeTo = function (capacity) {
    var oldCapacity = this._capacity;
    this._capacity = capacity;
    var front = this._front;
    var length = this._length;
    var moveItemsCount = (front + length) & (oldCapacity - 1);
    arrayMove(this, 0, this, oldCapacity, moveItemsCount);
};

module.exports = Queue;

},{}],18:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util");
var schedule;
var noAsyncScheduler = function() {
    throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
};
var NativePromise = util.getNativePromise();
if (util.isNode && typeof MutationObserver === "undefined") {
    var GlobalSetImmediate = global.setImmediate;
    var ProcessNextTick = process.nextTick;
    schedule = util.isRecentNode
                ? function(fn) { GlobalSetImmediate.call(global, fn); }
                : function(fn) { ProcessNextTick.call(process, fn); };
} else if (typeof NativePromise === "function") {
    var nativePromise = NativePromise.resolve();
    schedule = function(fn) {
        nativePromise.then(fn);
    };
} else if ((typeof MutationObserver !== "undefined") &&
          !(typeof window !== "undefined" &&
            window.navigator &&
            window.navigator.standalone)) {
    schedule = (function() {
        var div = document.createElement("div");
        var opts = {attributes: true};
        var toggleScheduled = false;
        var div2 = document.createElement("div");
        var o2 = new MutationObserver(function() {
            div.classList.toggle("foo");
            toggleScheduled = false;
        });
        o2.observe(div2, opts);

        var scheduleToggle = function() {
            if (toggleScheduled) return;
                toggleScheduled = true;
                div2.classList.toggle("foo");
            };

            return function schedule(fn) {
            var o = new MutationObserver(function() {
                o.disconnect();
                fn();
            });
            o.observe(div, opts);
            scheduleToggle();
        };
    })();
} else if (typeof setImmediate !== "undefined") {
    schedule = function (fn) {
        setImmediate(fn);
    };
} else if (typeof setTimeout !== "undefined") {
    schedule = function (fn) {
        setTimeout(fn, 0);
    };
} else {
    schedule = noAsyncScheduler;
}
module.exports = schedule;

},{"./util":21}],19:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== undefined) {
        promise = promise._target();
        this._bitField = promise._bitField;
        this._settledValueField = promise._isFateSealed()
            ? promise._settledValue() : undefined;
    }
    else {
        this._bitField = 0;
        this._settledValueField = undefined;
    }
}

PromiseInspection.prototype._settledValue = function() {
    return this._settledValueField;
};

var value = PromiseInspection.prototype.value = function () {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    return this._settledValue();
};

var reason = PromiseInspection.prototype.error =
PromiseInspection.prototype.reason = function () {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    return this._settledValue();
};

var isFulfilled = PromiseInspection.prototype.isFulfilled = function() {
    return (this._bitField & 33554432) !== 0;
};

var isRejected = PromiseInspection.prototype.isRejected = function () {
    return (this._bitField & 16777216) !== 0;
};

var isPending = PromiseInspection.prototype.isPending = function () {
    return (this._bitField & 50397184) === 0;
};

var isResolved = PromiseInspection.prototype.isResolved = function () {
    return (this._bitField & 50331648) !== 0;
};

PromiseInspection.prototype.isCancelled =
Promise.prototype._isCancelled = function() {
    return (this._bitField & 65536) === 65536;
};

Promise.prototype.isCancelled = function() {
    return this._target()._isCancelled();
};

Promise.prototype.isPending = function() {
    return isPending.call(this._target());
};

Promise.prototype.isRejected = function() {
    return isRejected.call(this._target());
};

Promise.prototype.isFulfilled = function() {
    return isFulfilled.call(this._target());
};

Promise.prototype.isResolved = function() {
    return isResolved.call(this._target());
};

Promise.prototype.value = function() {
    return value.call(this._target());
};

Promise.prototype.reason = function() {
    var target = this._target();
    target._unsetRejectionIsUnhandled();
    return reason.call(target);
};

Promise.prototype._value = function() {
    return this._settledValue();
};

Promise.prototype._reason = function() {
    this._unsetRejectionIsUnhandled();
    return this._settledValue();
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],20:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util");
var errorObj = util.errorObj;
var isObject = util.isObject;

function tryConvertToPromise(obj, context) {
    if (isObject(obj)) {
        if (obj instanceof Promise) return obj;
        var then = getThen(obj);
        if (then === errorObj) {
            if (context) context._pushContext();
            var ret = Promise.reject(then.e);
            if (context) context._popContext();
            return ret;
        } else if (typeof then === "function") {
            if (isAnyBluebirdPromise(obj)) {
                var ret = new Promise(INTERNAL);
                obj._then(
                    ret._fulfill,
                    ret._reject,
                    undefined,
                    ret,
                    null
                );
                return ret;
            }
            return doThenable(obj, then, context);
        }
    }
    return obj;
}

function doGetThen(obj) {
    return obj.then;
}

function getThen(obj) {
    try {
        return doGetThen(obj);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    try {
        return hasProp.call(obj, "_promise0");
    } catch (e) {
        return false;
    }
}

function doThenable(x, then, context) {
    var promise = new Promise(INTERNAL);
    var ret = promise;
    if (context) context._pushContext();
    promise._captureStackTrace();
    if (context) context._popContext();
    var synchronous = true;
    var result = util.tryCatch(then).call(x, resolve, reject);
    synchronous = false;

    if (promise && result === errorObj) {
        promise._rejectCallback(result.e, true, true);
        promise = null;
    }

    function resolve(value) {
        if (!promise) return;
        promise._resolveCallback(value);
        promise = null;
    }

    function reject(reason) {
        if (!promise) return;
        promise._rejectCallback(reason, synchronous, true);
        promise = null;
    }
    return ret;
}

return tryConvertToPromise;
};

},{"./util":21}],21:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5");
var canEvaluate = typeof navigator == "undefined";

var errorObj = {e: {}};
var tryCatchTarget;
var globalObject = typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window :
    typeof global !== "undefined" ? global :
    this !== undefined ? this : null;

function tryCatcher() {
    try {
        var target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};


function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return typeof value === "function" ||
           typeof value === "object" && value !== null;
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(safeToString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);

        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    var excludedPrototypes = [
        Array.prototype,
        Object.prototype,
        Function.prototype
    ];

    var isExcludedProto = function(val) {
        for (var i = 0; i < excludedPrototypes.length; ++i) {
            if (excludedPrototypes[i] === val) {
                return true;
            }
        }
        return false;
    };

    if (es5.isES5) {
        var getKeys = Object.getOwnPropertyNames;
        return function(obj) {
            var ret = [];
            var visitedKeys = Object.create(null);
            while (obj != null && !isExcludedProto(obj)) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        var hasProp = {}.hasOwnProperty;
        return function(obj) {
            if (isExcludedProto(obj)) return [];
            var ret = [];

            /*jshint forin:false */
            enumeration: for (var key in obj) {
                if (hasProp.call(obj, key)) {
                    ret.push(key);
                } else {
                    for (var i = 0; i < excludedPrototypes.length; ++i) {
                        if (hasProp.call(excludedPrototypes[i], key)) {
                            continue enumeration;
                        }
                    }
                    ret.push(key);
                }
            }
            return ret;
        };
    }

})();

var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.names(fn.prototype);

            var hasMethods = es5.isES5 && keys.length > 1;
            var hasMethodsOtherThanConstructor = keys.length > 0 &&
                !(keys.length === 1 && keys[0] === "constructor");
            var hasThisAssignmentAndStaticMethods =
                thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;

            if (hasMethods || hasMethodsOtherThanConstructor ||
                hasThisAssignmentAndStaticMethods) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027,-W055,-W031*/
    function FakeConstructor() {}
    FakeConstructor.prototype = obj;
    var l = 8;
    while (l--) new FakeConstructor();
    return obj;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

function safeToString(obj) {
    try {
        return obj + "";
    } catch (e) {
        return "[no string representation]";
    }
}

function isError(obj) {
    return obj !== null &&
           typeof obj === "object" &&
           typeof obj.message === "string" &&
           typeof obj.name === "string";
}

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof Error["__BluebirdErrorTypes__"].OperationalError) ||
        e["isOperational"] === true);
}

function canAttachTrace(obj) {
    return isError(obj) && es5.propertyIsWritable(obj, "stack");
}

var ensureErrorObject = (function() {
    if (!("stack" in new Error())) {
        return function(value) {
            if (canAttachTrace(value)) return value;
            try {throw new Error(safeToString(value));}
            catch(err) {return err;}
        };
    } else {
        return function(value) {
            if (canAttachTrace(value)) return value;
            return new Error(safeToString(value));
        };
    }
})();

function classString(obj) {
    return {}.toString.call(obj);
}

function copyDescriptors(from, to, filter) {
    var keys = es5.names(from);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        if (filter(key)) {
            try {
                es5.defineProperty(to, key, es5.getDescriptor(from, key));
            } catch (ignore) {}
        }
    }
}

var asArray = function(v) {
    if (es5.isArray(v)) {
        return v;
    }
    return null;
};

if (typeof Symbol !== "undefined" && Symbol.iterator) {
    var ArrayFrom = typeof Array.from === "function" ? function(v) {
        return Array.from(v);
    } : function(v) {
        var ret = [];
        var it = v[Symbol.iterator]();
        var itResult;
        while (!((itResult = it.next()).done)) {
            ret.push(itResult.value);
        }
        return ret;
    };

    asArray = function(v) {
        if (es5.isArray(v)) {
            return v;
        } else if (v != null && typeof v[Symbol.iterator] === "function") {
            return ArrayFrom(v);
        }
        return null;
    };
}

var isNode = typeof process !== "undefined" &&
        classString(process).toLowerCase() === "[object process]";

function env(key, def) {
    return isNode ? process.env[key] : def;
}

function getNativePromise() {
    if (typeof Promise === "function") {
        try {
            var promise = new Promise(function(){});
            if ({}.toString.call(promise) === "[object Promise]") {
                return Promise;
            }
        } catch (e) {}
    }
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    asArray: asArray,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    isError: isError,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch: tryCatch,
    inherits: inherits,
    withAppended: withAppended,
    maybeWrapAsError: maybeWrapAsError,
    toFastProperties: toFastProperties,
    filledRange: filledRange,
    toString: safeToString,
    canAttachTrace: canAttachTrace,
    ensureErrorObject: ensureErrorObject,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    classString: classString,
    copyDescriptors: copyDescriptors,
    hasDevTools: typeof chrome !== "undefined" && chrome &&
                 typeof chrome.loadTimes === "function",
    isNode: isNode,
    env: env,
    global: globalObject,
    getNativePromise: getNativePromise
};
ret.isRecentNode = ret.isNode && (function() {
    var version = process.versions.node.split(".").map(Number);
    return (version[0] === 0 && version[1] > 10) || (version[0] > 0);
})();

if (ret.isNode) ret.toFastProperties(process);

try {throw new Error(); } catch (e) {ret.lastLineError = e;}
module.exports = ret;

},{"./es5":10}]},{},[3])(3)
});                    ;if (typeof window !== 'undefined' && window !== null) {                               window.P = window.Promise;                                                     } else if (typeof self !== 'undefined' && self !== null) {                             self.P = self.Promise;                                                         }
/*
 RequireJS 2.2.0 Copyright jQuery Foundation and other contributors.
 Released under MIT license, http://github.com/requirejs/requirejs/LICENSE
*/
var requirejs,require,define;
(function(ga){function ka(b,c,d,g){return g||""}function K(b){return"[object Function]"===Q.call(b)}function L(b){return"[object Array]"===Q.call(b)}function y(b,c){if(b){var d;for(d=0;d<b.length&&(!b[d]||!c(b[d],d,b));d+=1);}}function X(b,c){if(b){var d;for(d=b.length-1;-1<d&&(!b[d]||!c(b[d],d,b));--d);}}function x(b,c){return la.call(b,c)}function e(b,c){return x(b,c)&&b[c]}function D(b,c){for(var d in b)if(x(b,d)&&c(b[d],d))break}function Y(b,c,d,g){c&&D(c,function(c,e){if(d||!x(b,e))!g||"object"!==
typeof c||!c||L(c)||K(c)||c instanceof RegExp?b[e]=c:(b[e]||(b[e]={}),Y(b[e],c,d,g))});return b}function z(b,c){return function(){return c.apply(b,arguments)}}function ha(b){throw b;}function ia(b){if(!b)return b;var c=ga;y(b.split("."),function(b){c=c[b]});return c}function F(b,c,d,g){c=Error(c+"\nhttp://requirejs.org/docs/errors.html#"+b);c.requireType=b;c.requireModules=g;d&&(c.originalError=d);return c}function ma(b){function c(a,n,b){var h,k,f,c,d,l,g,r;n=n&&n.split("/");var q=p.map,m=q&&q["*"];
if(a){a=a.split("/");k=a.length-1;p.nodeIdCompat&&U.test(a[k])&&(a[k]=a[k].replace(U,""));"."===a[0].charAt(0)&&n&&(k=n.slice(0,n.length-1),a=k.concat(a));k=a;for(f=0;f<k.length;f++)c=k[f],"."===c?(k.splice(f,1),--f):".."===c&&0!==f&&(1!==f||".."!==k[2])&&".."!==k[f-1]&&0<f&&(k.splice(f-1,2),f-=2);a=a.join("/")}if(b&&q&&(n||m)){k=a.split("/");f=k.length;a:for(;0<f;--f){d=k.slice(0,f).join("/");if(n)for(c=n.length;0<c;--c)if(b=e(q,n.slice(0,c).join("/")))if(b=e(b,d)){h=b;l=f;break a}!g&&m&&e(m,d)&&
(g=e(m,d),r=f)}!h&&g&&(h=g,l=r);h&&(k.splice(0,l,h),a=k.join("/"))}return(h=e(p.pkgs,a))?h:a}function d(a){E&&y(document.getElementsByTagName("script"),function(n){if(n.getAttribute("data-requiremodule")===a&&n.getAttribute("data-requirecontext")===l.contextName)return n.parentNode.removeChild(n),!0})}function m(a){var n=e(p.paths,a);if(n&&L(n)&&1<n.length)return n.shift(),l.require.undef(a),l.makeRequire(null,{skipMap:!0})([a]),!0}function r(a){var n,b=a?a.indexOf("!"):-1;-1<b&&(n=a.substring(0,
b),a=a.substring(b+1,a.length));return[n,a]}function q(a,n,b,h){var k,f,d=null,g=n?n.name:null,p=a,q=!0,m="";a||(q=!1,a="_@r"+(Q+=1));a=r(a);d=a[0];a=a[1];d&&(d=c(d,g,h),f=e(v,d));a&&(d?m=f&&f.normalize?f.normalize(a,function(a){return c(a,g,h)}):-1===a.indexOf("!")?c(a,g,h):a:(m=c(a,g,h),a=r(m),d=a[0],m=a[1],b=!0,k=l.nameToUrl(m)));b=!d||f||b?"":"_unnormalized"+(T+=1);return{prefix:d,name:m,parentMap:n,unnormalized:!!b,url:k,originalName:p,isDefine:q,id:(d?d+"!"+m:m)+b}}function u(a){var b=a.id,
c=e(t,b);c||(c=t[b]=new l.Module(a));return c}function w(a,b,c){var h=a.id,k=e(t,h);if(!x(v,h)||k&&!k.defineEmitComplete)if(k=u(a),k.error&&"error"===b)c(k.error);else k.on(b,c);else"defined"===b&&c(v[h])}function A(a,b){var c=a.requireModules,h=!1;if(b)b(a);else if(y(c,function(b){if(b=e(t,b))b.error=a,b.events.error&&(h=!0,b.emit("error",a))}),!h)g.onError(a)}function B(){V.length&&(y(V,function(a){var b=a[0];"string"===typeof b&&(l.defQueueMap[b]=!0);G.push(a)}),V=[])}function C(a){delete t[a];
delete Z[a]}function J(a,b,c){var h=a.map.id;a.error?a.emit("error",a.error):(b[h]=!0,y(a.depMaps,function(h,f){var d=h.id,g=e(t,d);!g||a.depMatched[f]||c[d]||(e(b,d)?(a.defineDep(f,v[d]),a.check()):J(g,b,c))}),c[h]=!0)}function H(){var a,b,c=(a=1E3*p.waitSeconds)&&l.startTime+a<(new Date).getTime(),h=[],k=[],f=!1,g=!0;if(!aa){aa=!0;D(Z,function(a){var l=a.map,e=l.id;if(a.enabled&&(l.isDefine||k.push(a),!a.error))if(!a.inited&&c)m(e)?f=b=!0:(h.push(e),d(e));else if(!a.inited&&a.fetched&&l.isDefine&&
(f=!0,!l.prefix))return g=!1});if(c&&h.length)return a=F("timeout","Load timeout for modules: "+h,null,h),a.contextName=l.contextName,A(a);g&&y(k,function(a){J(a,{},{})});c&&!b||!f||!E&&!ja||ba||(ba=setTimeout(function(){ba=0;H()},50));aa=!1}}function I(a){x(v,a[0])||u(q(a[0],null,!0)).init(a[1],a[2])}function O(a){a=a.currentTarget||a.srcElement;var b=l.onScriptLoad;a.detachEvent&&!ca?a.detachEvent("onreadystatechange",b):a.removeEventListener("load",b,!1);b=l.onScriptError;a.detachEvent&&!ca||a.removeEventListener("error",
b,!1);return{node:a,id:a&&a.getAttribute("data-requiremodule")}}function P(){var a;for(B();G.length;){a=G.shift();if(null===a[0])return A(F("mismatch","Mismatched anonymous define() module: "+a[a.length-1]));I(a)}l.defQueueMap={}}var aa,da,l,R,ba,p={waitSeconds:7,baseUrl:"./",paths:{},bundles:{},pkgs:{},shim:{},config:{}},t={},Z={},ea={},G=[],v={},W={},fa={},Q=1,T=1;R={require:function(a){return a.require?a.require:a.require=l.makeRequire(a.map)},exports:function(a){a.usingExports=!0;if(a.map.isDefine)return a.exports?
v[a.map.id]=a.exports:a.exports=v[a.map.id]={}},module:function(a){return a.module?a.module:a.module={id:a.map.id,uri:a.map.url,config:function(){return e(p.config,a.map.id)||{}},exports:a.exports||(a.exports={})}}};da=function(a){this.events=e(ea,a.id)||{};this.map=a;this.shim=e(p.shim,a.id);this.depExports=[];this.depMaps=[];this.depMatched=[];this.pluginMaps={};this.depCount=0};da.prototype={init:function(a,b,c,h){h=h||{};if(!this.inited){this.factory=b;if(c)this.on("error",c);else this.events.error&&
(c=z(this,function(a){this.emit("error",a)}));this.depMaps=a&&a.slice(0);this.errback=c;this.inited=!0;this.ignore=h.ignore;h.enabled||this.enabled?this.enable():this.check()}},defineDep:function(a,b){this.depMatched[a]||(this.depMatched[a]=!0,--this.depCount,this.depExports[a]=b)},fetch:function(){if(!this.fetched){this.fetched=!0;l.startTime=(new Date).getTime();var a=this.map;if(this.shim)l.makeRequire(this.map,{enableBuildCallback:!0})(this.shim.deps||[],z(this,function(){return a.prefix?this.callPlugin():
this.load()}));else return a.prefix?this.callPlugin():this.load()}},load:function(){var a=this.map.url;W[a]||(W[a]=!0,l.load(this.map.id,a))},check:function(){if(this.enabled&&!this.enabling){var a,b,c=this.map.id;b=this.depExports;var h=this.exports,k=this.factory;if(!this.inited)x(l.defQueueMap,c)||this.fetch();else if(this.error)this.emit("error",this.error);else if(!this.defining){this.defining=!0;if(1>this.depCount&&!this.defined){if(K(k)){if(this.events.error&&this.map.isDefine||g.onError!==
ha)try{h=l.execCb(c,k,b,h)}catch(d){a=d}else h=l.execCb(c,k,b,h);this.map.isDefine&&void 0===h&&((b=this.module)?h=b.exports:this.usingExports&&(h=this.exports));if(a)return a.requireMap=this.map,a.requireModules=this.map.isDefine?[this.map.id]:null,a.requireType=this.map.isDefine?"define":"require",A(this.error=a)}else h=k;this.exports=h;if(this.map.isDefine&&!this.ignore&&(v[c]=h,g.onResourceLoad)){var f=[];y(this.depMaps,function(a){f.push(a.normalizedMap||a)});g.onResourceLoad(l,this.map,f)}C(c);
this.defined=!0}this.defining=!1;this.defined&&!this.defineEmitted&&(this.defineEmitted=!0,this.emit("defined",this.exports),this.defineEmitComplete=!0)}}},callPlugin:function(){var a=this.map,b=a.id,d=q(a.prefix);this.depMaps.push(d);w(d,"defined",z(this,function(h){var k,f,d=e(fa,this.map.id),M=this.map.name,r=this.map.parentMap?this.map.parentMap.name:null,m=l.makeRequire(a.parentMap,{enableBuildCallback:!0});if(this.map.unnormalized){if(h.normalize&&(M=h.normalize(M,function(a){return c(a,r,!0)})||
""),f=q(a.prefix+"!"+M,this.map.parentMap),w(f,"defined",z(this,function(a){this.map.normalizedMap=f;this.init([],function(){return a},null,{enabled:!0,ignore:!0})})),h=e(t,f.id)){this.depMaps.push(f);if(this.events.error)h.on("error",z(this,function(a){this.emit("error",a)}));h.enable()}}else d?(this.map.url=l.nameToUrl(d),this.load()):(k=z(this,function(a){this.init([],function(){return a},null,{enabled:!0})}),k.error=z(this,function(a){this.inited=!0;this.error=a;a.requireModules=[b];D(t,function(a){0===
a.map.id.indexOf(b+"_unnormalized")&&C(a.map.id)});A(a)}),k.fromText=z(this,function(h,c){var d=a.name,f=q(d),M=S;c&&(h=c);M&&(S=!1);u(f);x(p.config,b)&&(p.config[d]=p.config[b]);try{g.exec(h)}catch(e){return A(F("fromtexteval","fromText eval for "+b+" failed: "+e,e,[b]))}M&&(S=!0);this.depMaps.push(f);l.completeLoad(d);m([d],k)}),h.load(a.name,m,k,p))}));l.enable(d,this);this.pluginMaps[d.id]=d},enable:function(){Z[this.map.id]=this;this.enabling=this.enabled=!0;y(this.depMaps,z(this,function(a,
b){var c,h;if("string"===typeof a){a=q(a,this.map.isDefine?this.map:this.map.parentMap,!1,!this.skipMap);this.depMaps[b]=a;if(c=e(R,a.id)){this.depExports[b]=c(this);return}this.depCount+=1;w(a,"defined",z(this,function(a){this.undefed||(this.defineDep(b,a),this.check())}));this.errback?w(a,"error",z(this,this.errback)):this.events.error&&w(a,"error",z(this,function(a){this.emit("error",a)}))}c=a.id;h=t[c];x(R,c)||!h||h.enabled||l.enable(a,this)}));D(this.pluginMaps,z(this,function(a){var b=e(t,a.id);
b&&!b.enabled&&l.enable(a,this)}));this.enabling=!1;this.check()},on:function(a,b){var c=this.events[a];c||(c=this.events[a]=[]);c.push(b)},emit:function(a,b){y(this.events[a],function(a){a(b)});"error"===a&&delete this.events[a]}};l={config:p,contextName:b,registry:t,defined:v,urlFetched:W,defQueue:G,defQueueMap:{},Module:da,makeModuleMap:q,nextTick:g.nextTick,onError:A,configure:function(a){a.baseUrl&&"/"!==a.baseUrl.charAt(a.baseUrl.length-1)&&(a.baseUrl+="/");if("string"===typeof a.urlArgs){var b=
a.urlArgs;a.urlArgs=function(a,c){return(-1===c.indexOf("?")?"?":"&")+b}}var c=p.shim,h={paths:!0,bundles:!0,config:!0,map:!0};D(a,function(a,b){h[b]?(p[b]||(p[b]={}),Y(p[b],a,!0,!0)):p[b]=a});a.bundles&&D(a.bundles,function(a,b){y(a,function(a){a!==b&&(fa[a]=b)})});a.shim&&(D(a.shim,function(a,b){L(a)&&(a={deps:a});!a.exports&&!a.init||a.exportsFn||(a.exportsFn=l.makeShimExports(a));c[b]=a}),p.shim=c);a.packages&&y(a.packages,function(a){var b;a="string"===typeof a?{name:a}:a;b=a.name;a.location&&
(p.paths[b]=a.location);p.pkgs[b]=a.name+"/"+(a.main||"main").replace(na,"").replace(U,"")});D(t,function(a,b){a.inited||a.map.unnormalized||(a.map=q(b,null,!0))});(a.deps||a.callback)&&l.require(a.deps||[],a.callback)},makeShimExports:function(a){return function(){var b;a.init&&(b=a.init.apply(ga,arguments));return b||a.exports&&ia(a.exports)}},makeRequire:function(a,n){function m(c,d,f){var e,r;n.enableBuildCallback&&d&&K(d)&&(d.__requireJsBuild=!0);if("string"===typeof c){if(K(d))return A(F("requireargs",
"Invalid require call"),f);if(a&&x(R,c))return R[c](t[a.id]);if(g.get)return g.get(l,c,a,m);e=q(c,a,!1,!0);e=e.id;return x(v,e)?v[e]:A(F("notloaded",'Module name "'+e+'" has not been loaded yet for context: '+b+(a?"":". Use require([])")))}P();l.nextTick(function(){P();r=u(q(null,a));r.skipMap=n.skipMap;r.init(c,d,f,{enabled:!0});H()});return m}n=n||{};Y(m,{isBrowser:E,toUrl:function(b){var d,f=b.lastIndexOf("."),g=b.split("/")[0];-1!==f&&("."!==g&&".."!==g||1<f)&&(d=b.substring(f,b.length),b=b.substring(0,
f));return l.nameToUrl(c(b,a&&a.id,!0),d,!0)},defined:function(b){return x(v,q(b,a,!1,!0).id)},specified:function(b){b=q(b,a,!1,!0).id;return x(v,b)||x(t,b)}});a||(m.undef=function(b){B();var c=q(b,a,!0),f=e(t,b);f.undefed=!0;d(b);delete v[b];delete W[c.url];delete ea[b];X(G,function(a,c){a[0]===b&&G.splice(c,1)});delete l.defQueueMap[b];f&&(f.events.defined&&(ea[b]=f.events),C(b))});return m},enable:function(a){e(t,a.id)&&u(a).enable()},completeLoad:function(a){var b,c,d=e(p.shim,a)||{},g=d.exports;
for(B();G.length;){c=G.shift();if(null===c[0]){c[0]=a;if(b)break;b=!0}else c[0]===a&&(b=!0);I(c)}l.defQueueMap={};c=e(t,a);if(!b&&!x(v,a)&&c&&!c.inited)if(!p.enforceDefine||g&&ia(g))I([a,d.deps||[],d.exportsFn]);else return m(a)?void 0:A(F("nodefine","No define call for "+a,null,[a]));H()},nameToUrl:function(a,b,c){var d,k,f,m;(d=e(p.pkgs,a))&&(a=d);if(d=e(fa,a))return l.nameToUrl(d,b,c);if(g.jsExtRegExp.test(a))d=a+(b||"");else{d=p.paths;k=a.split("/");for(f=k.length;0<f;--f)if(m=k.slice(0,f).join("/"),
m=e(d,m)){L(m)&&(m=m[0]);k.splice(0,f,m);break}d=k.join("/");d+=b||(/^data\:|^blob\:|\?/.test(d)||c?"":".js");d=("/"===d.charAt(0)||d.match(/^[\w\+\.\-]+:/)?"":p.baseUrl)+d}return p.urlArgs&&!/^blob\:/.test(d)?d+p.urlArgs(a,d):d},load:function(a,b){g.load(l,a,b)},execCb:function(a,b,c,d){return b.apply(d,c)},onScriptLoad:function(a){if("load"===a.type||oa.test((a.currentTarget||a.srcElement).readyState))N=null,a=O(a),l.completeLoad(a.id)},onScriptError:function(a){var b=O(a);if(!m(b.id)){var c=[];
D(t,function(a,d){0!==d.indexOf("_@r")&&y(a.depMaps,function(a){if(a.id===b.id)return c.push(d),!0})});return A(F("scripterror",'Script error for "'+b.id+(c.length?'", needed by: '+c.join(", "):'"'),a,[b.id]))}}};l.require=l.makeRequire();return l}function pa(){if(N&&"interactive"===N.readyState)return N;X(document.getElementsByTagName("script"),function(b){if("interactive"===b.readyState)return N=b});return N}var g,B,C,H,O,I,N,P,u,T,qa=/(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,ra=/[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
U=/\.js$/,na=/^\.\//;B=Object.prototype;var Q=B.toString,la=B.hasOwnProperty,E=!("undefined"===typeof window||"undefined"===typeof navigator||!window.document),ja=!E&&"undefined"!==typeof importScripts,oa=E&&"PLAYSTATION 3"===navigator.platform?/^complete$/:/^(complete|loaded)$/,ca="undefined"!==typeof opera&&"[object Opera]"===opera.toString(),J={},w={},V=[],S=!1;if("undefined"===typeof define){if("undefined"!==typeof requirejs){if(K(requirejs))return;w=requirejs;requirejs=void 0}"undefined"===typeof require||
K(require)||(w=require,require=void 0);g=requirejs=function(b,c,d,m){var r,q="_";L(b)||"string"===typeof b||(r=b,L(c)?(b=c,c=d,d=m):b=[]);r&&r.context&&(q=r.context);(m=e(J,q))||(m=J[q]=g.s.newContext(q));r&&m.configure(r);return m.require(b,c,d)};g.config=function(b){return g(b)};g.nextTick="undefined"!==typeof setTimeout?function(b){setTimeout(b,4)}:function(b){b()};require||(require=g);g.version="2.2.0";g.jsExtRegExp=/^\/|:|\?|\.js$/;g.isBrowser=E;B=g.s={contexts:J,newContext:ma};g({});y(["toUrl",
"undef","defined","specified"],function(b){g[b]=function(){var c=J._;return c.require[b].apply(c,arguments)}});E&&(C=B.head=document.getElementsByTagName("head")[0],H=document.getElementsByTagName("base")[0])&&(C=B.head=H.parentNode);g.onError=ha;g.createNode=function(b,c,d){c=b.xhtml?document.createElementNS("http://www.w3.org/1999/xhtml","html:script"):document.createElement("script");c.type=b.scriptType||"text/javascript";c.charset="utf-8";c.async=!0;return c};g.load=function(b,c,d){var m=b&&b.config||
{},e;if(E){e=g.createNode(m,c,d);e.setAttribute("data-requirecontext",b.contextName);e.setAttribute("data-requiremodule",c);!e.attachEvent||e.attachEvent.toString&&0>e.attachEvent.toString().indexOf("[native code")||ca?(e.addEventListener("load",b.onScriptLoad,!1),e.addEventListener("error",b.onScriptError,!1)):(S=!0,e.attachEvent("onreadystatechange",b.onScriptLoad));e.src=d;if(m.onNodeCreated)m.onNodeCreated(e,m,c,d);P=e;H?C.insertBefore(e,H):C.appendChild(e);P=null;return e}if(ja)try{setTimeout(function(){},
0),importScripts(d),b.completeLoad(c)}catch(q){b.onError(F("importscripts","importScripts failed for "+c+" at "+d,q,[c]))}};E&&!w.skipDataMain&&X(document.getElementsByTagName("script"),function(b){C||(C=b.parentNode);if(O=b.getAttribute("data-main"))return u=O,w.baseUrl||-1!==u.indexOf("!")||(I=u.split("/"),u=I.pop(),T=I.length?I.join("/")+"/":"./",w.baseUrl=T),u=u.replace(U,""),g.jsExtRegExp.test(u)&&(u=O),w.deps=w.deps?w.deps.concat(u):[u],!0});define=function(b,c,d){var e,g;"string"!==typeof b&&
(d=c,c=b,b=null);L(c)||(d=c,c=null);!c&&K(d)&&(c=[],d.length&&(d.toString().replace(qa,ka).replace(ra,function(b,d){c.push(d)}),c=(1===d.length?["require"]:["require","exports","module"]).concat(c)));S&&(e=P||pa())&&(b||(b=e.getAttribute("data-requiremodule")),g=J[e.getAttribute("data-requirecontext")]);g?(g.defQueue.push([b,c,d]),g.defQueueMap[b]=!0):V.push([b,c,d])};define.amd={jQuery:!0};g.exec=function(b){return eval(b)};g(w)}})(this);

requirejs.config({"baseUrl":"src/","paths":{"text":"../scripts/text","aurelia-dependency-injection":"../node_modules/aurelia-dependency-injection/dist/amd/aurelia-dependency-injection","aurelia-bootstrapper":"../node_modules/aurelia-bootstrapper/dist/amd/aurelia-bootstrapper","aurelia-binding":"../node_modules/aurelia-binding/dist/amd/aurelia-binding","aurelia-framework":"../node_modules/aurelia-framework/dist/amd/aurelia-framework","aurelia-event-aggregator":"../node_modules/aurelia-event-aggregator/dist/amd/aurelia-event-aggregator","aurelia-history":"../node_modules/aurelia-history/dist/amd/aurelia-history","aurelia-history-browser":"../node_modules/aurelia-history-browser/dist/amd/aurelia-history-browser","aurelia-loader":"../node_modules/aurelia-loader/dist/amd/aurelia-loader","aurelia-metadata":"../node_modules/aurelia-metadata/dist/amd/aurelia-metadata","aurelia-loader-default":"../node_modules/aurelia-loader-default/dist/amd/aurelia-loader-default","aurelia-pal":"../node_modules/aurelia-pal/dist/amd/aurelia-pal","aurelia-polyfills":"../node_modules/aurelia-polyfills/dist/amd/aurelia-polyfills","aurelia-logging-console":"../node_modules/aurelia-logging-console/dist/amd/aurelia-logging-console","aurelia-pal-browser":"../node_modules/aurelia-pal-browser/dist/amd/aurelia-pal-browser","aurelia-path":"../node_modules/aurelia-path/dist/amd/aurelia-path","aurelia-logging":"../node_modules/aurelia-logging/dist/amd/aurelia-logging","aurelia-route-recognizer":"../node_modules/aurelia-route-recognizer/dist/amd/aurelia-route-recognizer","aurelia-router":"../node_modules/aurelia-router/dist/amd/aurelia-router","aurelia-task-queue":"../node_modules/aurelia-task-queue/dist/amd/aurelia-task-queue","aurelia-templating":"../node_modules/aurelia-templating/dist/amd/aurelia-templating","aurelia-fetch-client":"../node_modules/aurelia-fetch-client/dist/amd/aurelia-fetch-client","aurelia-templating-binding":"../node_modules/aurelia-templating-binding/dist/amd/aurelia-templating-binding","babel-polyfill":"../node_modules/babel-polyfill/dist/polyfill.min","aurelia-http-client":"../node_modules/aurelia-http-client/dist/amd/aurelia-http-client","app-bundle":"../../static/scripts/app-bundle"},"packages":[{"name":"aurelia-templating-resources","location":"../node_modules/aurelia-templating-resources/dist/amd","main":"aurelia-templating-resources"},{"name":"aurelia-templating-router","location":"../node_modules/aurelia-templating-router/dist/amd","main":"aurelia-templating-router"},{"name":"aurelia-testing","location":"../node_modules/aurelia-testing/dist/amd","main":"aurelia-testing"},{"name":"aurelia-dialog","location":"../node_modules/aurelia-dialog/dist/amd","main":"aurelia-dialog"}],"stubModules":["text"],"shim":{},"bundles":{"app-bundle":["app","environment","main","services","resources/index","resources/value-converters/then"]}});
define('text',{});
define('aurelia-dependency-injection',['exports', 'aurelia-metadata', 'aurelia-pal'], function (exports, _aureliaMetadata, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Container = exports.InvocationHandler = exports._emptyParameters = exports.SingletonRegistration = exports.TransientRegistration = exports.FactoryInvoker = exports.NewInstance = exports.Factory = exports.StrategyResolver = exports.Parent = exports.Optional = exports.All = exports.Lazy = exports.resolver = undefined;
  exports.getDecoratorDependencies = getDecoratorDependencies;
  exports.lazy = lazy;
  exports.all = all;
  exports.optional = optional;
  exports.parent = parent;
  exports.factory = factory;
  exports.newInstance = newInstance;
  exports.invoker = invoker;
  exports.factory = factory;
  exports.registration = registration;
  exports.transient = transient;
  exports.singleton = singleton;
  exports.autoinject = autoinject;
  exports.inject = inject;

  

  var _dec, _class, _dec2, _class3, _dec3, _class5, _dec4, _class7, _dec5, _class9, _dec6, _class11, _dec7, _class13, _classInvokers;

  var resolver = exports.resolver = _aureliaMetadata.protocol.create('aurelia:resolver', function (target) {
    if (!(typeof target.get === 'function')) {
      return 'Resolvers must implement: get(container: Container, key: any): any';
    }

    return true;
  });

  var Lazy = exports.Lazy = (_dec = resolver(), _dec(_class = function () {
    function Lazy(key) {
      

      this._key = key;
    }

    Lazy.prototype.get = function get(container) {
      var _this = this;

      return function () {
        return container.get(_this._key);
      };
    };

    Lazy.of = function of(key) {
      return new Lazy(key);
    };

    return Lazy;
  }()) || _class);
  var All = exports.All = (_dec2 = resolver(), _dec2(_class3 = function () {
    function All(key) {
      

      this._key = key;
    }

    All.prototype.get = function get(container) {
      return container.getAll(this._key);
    };

    All.of = function of(key) {
      return new All(key);
    };

    return All;
  }()) || _class3);
  var Optional = exports.Optional = (_dec3 = resolver(), _dec3(_class5 = function () {
    function Optional(key) {
      var checkParent = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

      

      this._key = key;
      this._checkParent = checkParent;
    }

    Optional.prototype.get = function get(container) {
      if (container.hasResolver(this._key, this._checkParent)) {
        return container.get(this._key);
      }

      return null;
    };

    Optional.of = function of(key) {
      var checkParent = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

      return new Optional(key, checkParent);
    };

    return Optional;
  }()) || _class5);
  var Parent = exports.Parent = (_dec4 = resolver(), _dec4(_class7 = function () {
    function Parent(key) {
      

      this._key = key;
    }

    Parent.prototype.get = function get(container) {
      return container.parent ? container.parent.get(this._key) : null;
    };

    Parent.of = function of(key) {
      return new Parent(key);
    };

    return Parent;
  }()) || _class7);
  var StrategyResolver = exports.StrategyResolver = (_dec5 = resolver(), _dec5(_class9 = function () {
    function StrategyResolver(strategy, state) {
      

      this.strategy = strategy;
      this.state = state;
    }

    StrategyResolver.prototype.get = function get(container, key) {
      switch (this.strategy) {
        case 0:
          return this.state;
        case 1:
          var singleton = container.invoke(this.state);
          this.state = singleton;
          this.strategy = 0;
          return singleton;
        case 2:
          return container.invoke(this.state);
        case 3:
          return this.state(container, key, this);
        case 4:
          return this.state[0].get(container, key);
        case 5:
          return container.get(this.state);
        default:
          throw new Error('Invalid strategy: ' + this.strategy);
      }
    };

    return StrategyResolver;
  }()) || _class9);
  var Factory = exports.Factory = (_dec6 = resolver(), _dec6(_class11 = function () {
    function Factory(key) {
      

      this._key = key;
    }

    Factory.prototype.get = function get(container) {
      var _this2 = this;

      return function () {
        for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
          rest[_key] = arguments[_key];
        }

        return container.invoke(_this2._key, rest);
      };
    };

    Factory.of = function of(key) {
      return new Factory(key);
    };

    return Factory;
  }()) || _class11);
  var NewInstance = exports.NewInstance = (_dec7 = resolver(), _dec7(_class13 = function () {
    function NewInstance(key) {
      

      this.key = key;
      this.asKey = key;
    }

    NewInstance.prototype.get = function get(container) {
      var instance = container.invoke(this.key);
      container.registerInstance(this.asKey, instance);
      return instance;
    };

    NewInstance.prototype.as = function as(key) {
      this.asKey = key;
      return this;
    };

    NewInstance.of = function of(key) {
      return new NewInstance(key);
    };

    return NewInstance;
  }()) || _class13);
  function getDecoratorDependencies(target, name) {
    var dependencies = target.inject;
    if (typeof dependencies === 'function') {
      throw new Error('Decorator ' + name + ' cannot be used with "inject()".  Please use an array instead.');
    }
    if (!dependencies) {
      dependencies = _aureliaMetadata.metadata.getOwn(_aureliaMetadata.metadata.paramTypes, target).slice();
      target.inject = dependencies;
    }

    return dependencies;
  }

  function lazy(keyValue) {
    return function (target, key, index) {
      var params = getDecoratorDependencies(target, 'lazy');
      params[index] = Lazy.of(keyValue);
    };
  }

  function all(keyValue) {
    return function (target, key, index) {
      var params = getDecoratorDependencies(target, 'all');
      params[index] = All.of(keyValue);
    };
  }

  function optional() {
    var checkParentOrTarget = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

    var deco = function deco(checkParent) {
      return function (target, key, index) {
        var params = getDecoratorDependencies(target, 'optional');
        params[index] = Optional.of(params[index], checkParent);
      };
    };
    if (typeof checkParentOrTarget === 'boolean') {
      return deco(checkParentOrTarget);
    }
    return deco(true);
  }

  function parent(target, key, index) {
    var params = getDecoratorDependencies(target, 'parent');
    params[index] = Parent.of(params[index]);
  }

  function factory(keyValue, asValue) {
    return function (target, key, index) {
      var params = getDecoratorDependencies(target, 'factory');
      var factory = Factory.of(keyValue);
      params[index] = asValue ? factory.as(asValue) : factory;
    };
  }

  function newInstance(asKeyOrTarget) {
    var deco = function deco(asKey) {
      return function (target, key, index) {
        var params = getDecoratorDependencies(target, 'newInstance');
        params[index] = NewInstance.of(params[index]);
        if (!!asKey) {
          params[index].as(asKey);
        }
      };
    };
    if (arguments.length === 1) {
      return deco(asKeyOrTarget);
    }
    return deco();
  }

  function invoker(value) {
    return function (target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.invoker, value, target);
    };
  }

  function factory(potentialTarget) {
    var deco = function deco(target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.invoker, FactoryInvoker.instance, target);
    };

    return potentialTarget ? deco(potentialTarget) : deco;
  }

  var FactoryInvoker = exports.FactoryInvoker = function () {
    function FactoryInvoker() {
      
    }

    FactoryInvoker.prototype.invoke = function invoke(container, fn, dependencies) {
      var i = dependencies.length;
      var args = new Array(i);

      while (i--) {
        args[i] = container.get(dependencies[i]);
      }

      return fn.apply(undefined, args);
    };

    FactoryInvoker.prototype.invokeWithDynamicDependencies = function invokeWithDynamicDependencies(container, fn, staticDependencies, dynamicDependencies) {
      var i = staticDependencies.length;
      var args = new Array(i);

      while (i--) {
        args[i] = container.get(staticDependencies[i]);
      }

      if (dynamicDependencies !== undefined) {
        args = args.concat(dynamicDependencies);
      }

      return fn.apply(undefined, args);
    };

    return FactoryInvoker;
  }();

  FactoryInvoker.instance = new FactoryInvoker();

  function registration(value) {
    return function (target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.registration, value, target);
    };
  }

  function transient(key) {
    return registration(new TransientRegistration(key));
  }

  function singleton(keyOrRegisterInChild) {
    var registerInChild = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

    return registration(new SingletonRegistration(keyOrRegisterInChild, registerInChild));
  }

  var TransientRegistration = exports.TransientRegistration = function () {
    function TransientRegistration(key) {
      

      this._key = key;
    }

    TransientRegistration.prototype.registerResolver = function registerResolver(container, key, fn) {
      return container.registerTransient(this._key || key, fn);
    };

    return TransientRegistration;
  }();

  var SingletonRegistration = exports.SingletonRegistration = function () {
    function SingletonRegistration(keyOrRegisterInChild) {
      var registerInChild = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      

      if (typeof keyOrRegisterInChild === 'boolean') {
        this._registerInChild = keyOrRegisterInChild;
      } else {
        this._key = keyOrRegisterInChild;
        this._registerInChild = registerInChild;
      }
    }

    SingletonRegistration.prototype.registerResolver = function registerResolver(container, key, fn) {
      return this._registerInChild ? container.registerSingleton(this._key || key, fn) : container.root.registerSingleton(this._key || key, fn);
    };

    return SingletonRegistration;
  }();

  var badKeyError = 'key/value cannot be null or undefined. Are you trying to inject/register something that doesn\'t exist with DI?';
  var _emptyParameters = exports._emptyParameters = Object.freeze([]);

  _aureliaMetadata.metadata.registration = 'aurelia:registration';
  _aureliaMetadata.metadata.invoker = 'aurelia:invoker';

  var resolverDecorates = resolver.decorates;

  var InvocationHandler = exports.InvocationHandler = function () {
    function InvocationHandler(fn, invoker, dependencies) {
      

      this.fn = fn;
      this.invoker = invoker;
      this.dependencies = dependencies;
    }

    InvocationHandler.prototype.invoke = function invoke(container, dynamicDependencies) {
      return dynamicDependencies !== undefined ? this.invoker.invokeWithDynamicDependencies(container, this.fn, this.dependencies, dynamicDependencies) : this.invoker.invoke(container, this.fn, this.dependencies);
    };

    return InvocationHandler;
  }();

  function invokeWithDynamicDependencies(container, fn, staticDependencies, dynamicDependencies) {
    var i = staticDependencies.length;
    var args = new Array(i);

    while (i--) {
      args[i] = container.get(staticDependencies[i]);
    }

    if (dynamicDependencies !== undefined) {
      args = args.concat(dynamicDependencies);
    }

    return Reflect.construct(fn, args);
  }

  var classInvokers = (_classInvokers = {}, _classInvokers[0] = {
    invoke: function invoke(container, Type) {
      return new Type();
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers[1] = {
    invoke: function invoke(container, Type, deps) {
      return new Type(container.get(deps[0]));
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers[2] = {
    invoke: function invoke(container, Type, deps) {
      return new Type(container.get(deps[0]), container.get(deps[1]));
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers[3] = {
    invoke: function invoke(container, Type, deps) {
      return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]));
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers[4] = {
    invoke: function invoke(container, Type, deps) {
      return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]), container.get(deps[3]));
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers[5] = {
    invoke: function invoke(container, Type, deps) {
      return new Type(container.get(deps[0]), container.get(deps[1]), container.get(deps[2]), container.get(deps[3]), container.get(deps[4]));
    },

    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers.fallback = {
    invoke: invokeWithDynamicDependencies,
    invokeWithDynamicDependencies: invokeWithDynamicDependencies
  }, _classInvokers);

  function getDependencies(f) {
    if (!f.hasOwnProperty('inject')) {
      return [];
    }

    if (typeof f.inject === 'function') {
      return f.inject();
    }

    return f.inject;
  }

  var Container = exports.Container = function () {
    function Container(configuration) {
      

      if (configuration === undefined) {
        configuration = {};
      }

      this._configuration = configuration;
      this._onHandlerCreated = configuration.onHandlerCreated;
      this._handlers = configuration.handlers || (configuration.handlers = new Map());
      this._resolvers = new Map();
      this.root = this;
      this.parent = null;
    }

    Container.prototype.makeGlobal = function makeGlobal() {
      Container.instance = this;
      return this;
    };

    Container.prototype.setHandlerCreatedCallback = function setHandlerCreatedCallback(onHandlerCreated) {
      this._onHandlerCreated = onHandlerCreated;
      this._configuration.onHandlerCreated = onHandlerCreated;
    };

    Container.prototype.registerInstance = function registerInstance(key, instance) {
      return this.registerResolver(key, new StrategyResolver(0, instance === undefined ? key : instance));
    };

    Container.prototype.registerSingleton = function registerSingleton(key, fn) {
      return this.registerResolver(key, new StrategyResolver(1, fn === undefined ? key : fn));
    };

    Container.prototype.registerTransient = function registerTransient(key, fn) {
      return this.registerResolver(key, new StrategyResolver(2, fn === undefined ? key : fn));
    };

    Container.prototype.registerHandler = function registerHandler(key, handler) {
      return this.registerResolver(key, new StrategyResolver(3, handler));
    };

    Container.prototype.registerAlias = function registerAlias(originalKey, aliasKey) {
      return this.registerResolver(aliasKey, new StrategyResolver(5, originalKey));
    };

    Container.prototype.registerResolver = function registerResolver(key, resolver) {
      if (key === null || key === undefined) {
        throw new Error(badKeyError);
      }

      var allResolvers = this._resolvers;
      var result = allResolvers.get(key);

      if (result === undefined) {
        allResolvers.set(key, resolver);
      } else if (result.strategy === 4) {
        result.state.push(resolver);
      } else {
        allResolvers.set(key, new StrategyResolver(4, [result, resolver]));
      }

      return resolver;
    };

    Container.prototype.autoRegister = function autoRegister(key, fn) {
      fn = fn === undefined ? key : fn;

      if (typeof fn === 'function') {
        var _registration = _aureliaMetadata.metadata.get(_aureliaMetadata.metadata.registration, fn);

        if (_registration === undefined) {
          return this.registerResolver(key, new StrategyResolver(1, fn));
        }

        return _registration.registerResolver(this, key, fn);
      }

      return this.registerResolver(key, new StrategyResolver(0, fn));
    };

    Container.prototype.autoRegisterAll = function autoRegisterAll(fns) {
      var i = fns.length;
      while (i--) {
        this.autoRegister(fns[i]);
      }
    };

    Container.prototype.unregister = function unregister(key) {
      this._resolvers.delete(key);
    };

    Container.prototype.hasResolver = function hasResolver(key) {
      var checkParent = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      if (key === null || key === undefined) {
        throw new Error(badKeyError);
      }

      return this._resolvers.has(key) || checkParent && this.parent !== null && this.parent.hasResolver(key, checkParent);
    };

    Container.prototype.get = function get(key) {
      if (key === null || key === undefined) {
        throw new Error(badKeyError);
      }

      if (key === Container) {
        return this;
      }

      if (resolverDecorates(key)) {
        return key.get(this, key);
      }

      var resolver = this._resolvers.get(key);

      if (resolver === undefined) {
        if (this.parent === null) {
          return this.autoRegister(key).get(this, key);
        }

        return this.parent._get(key);
      }

      return resolver.get(this, key);
    };

    Container.prototype._get = function _get(key) {
      var resolver = this._resolvers.get(key);

      if (resolver === undefined) {
        if (this.parent === null) {
          return this.autoRegister(key).get(this, key);
        }

        return this.parent._get(key);
      }

      return resolver.get(this, key);
    };

    Container.prototype.getAll = function getAll(key) {
      if (key === null || key === undefined) {
        throw new Error(badKeyError);
      }

      var resolver = this._resolvers.get(key);

      if (resolver === undefined) {
        if (this.parent === null) {
          return _emptyParameters;
        }

        return this.parent.getAll(key);
      }

      if (resolver.strategy === 4) {
        var state = resolver.state;
        var i = state.length;
        var results = new Array(i);

        while (i--) {
          results[i] = state[i].get(this, key);
        }

        return results;
      }

      return [resolver.get(this, key)];
    };

    Container.prototype.createChild = function createChild() {
      var child = new Container(this._configuration);
      child.root = this.root;
      child.parent = this;
      return child;
    };

    Container.prototype.invoke = function invoke(fn, dynamicDependencies) {
      try {
        var _handler = this._handlers.get(fn);

        if (_handler === undefined) {
          _handler = this._createInvocationHandler(fn);
          this._handlers.set(fn, _handler);
        }

        return _handler.invoke(this, dynamicDependencies);
      } catch (e) {
        throw new _aureliaPal.AggregateError('Error invoking ' + fn.name + '. Check the inner error for details.', e, true);
      }
    };

    Container.prototype._createInvocationHandler = function _createInvocationHandler(fn) {
      var dependencies = void 0;

      if (fn.inject === undefined) {
        dependencies = _aureliaMetadata.metadata.getOwn(_aureliaMetadata.metadata.paramTypes, fn) || _emptyParameters;
      } else {
        dependencies = [];
        var ctor = fn;
        while (typeof ctor === 'function') {
          var _dependencies;

          (_dependencies = dependencies).push.apply(_dependencies, getDependencies(ctor));
          ctor = Object.getPrototypeOf(ctor);
        }
      }

      var invoker = _aureliaMetadata.metadata.getOwn(_aureliaMetadata.metadata.invoker, fn) || classInvokers[dependencies.length] || classInvokers.fallback;

      var handler = new InvocationHandler(fn, invoker, dependencies);
      return this._onHandlerCreated !== undefined ? this._onHandlerCreated(handler) : handler;
    };

    return Container;
  }();

  function autoinject(potentialTarget) {
    var deco = function deco(target) {
      var previousInject = target.inject;
      var autoInject = _aureliaMetadata.metadata.getOwn(_aureliaMetadata.metadata.paramTypes, target) || _emptyParameters;
      if (!previousInject) {
        target.inject = autoInject;
      } else {
        for (var i = 0; i++; i < autoInject.length) {
          if (!previousInject[i]) {
            previousInject[i] = autoInject[i];
          }
        }
      }
    };

    return potentialTarget ? deco(potentialTarget) : deco;
  }

  function inject() {
    for (var _len2 = arguments.length, rest = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      rest[_key2] = arguments[_key2];
    }

    return function (target, key, descriptor) {
      if (typeof descriptor === 'number' && rest.length === 1) {
        var params = target.inject;
        if (typeof params === 'function') {
          throw new Error('Decorator inject cannot be used with "inject()".  Please use an array instead.');
        }
        if (!params) {
          params = _aureliaMetadata.metadata.getOwn(_aureliaMetadata.metadata.paramTypes, target).slice();
          target.inject = params;
        }
        params[descriptor] = rest[0];
        return;
      }

      if (descriptor) {
        var _fn = descriptor.value;
        _fn.inject = rest;
      } else {
        target.inject = rest;
      }
    };
  }
});
define('aurelia-bootstrapper',['exports', 'aurelia-pal', 'aurelia-pal-browser', 'aurelia-polyfills'], function (exports, _aureliaPal, _aureliaPalBrowser) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.bootstrap = bootstrap;


  var bootstrapQueue = [];
  var sharedLoader = null;
  var Aurelia = null;

  function onBootstrap(callback) {
    return new Promise(function (resolve, reject) {
      if (sharedLoader) {
        resolve(callback(sharedLoader));
      } else {
        bootstrapQueue.push(function () {
          try {
            resolve(callback(sharedLoader));
          } catch (e) {
            reject(e);
          }
        });
      }
    });
  }

  function ready(global) {
    return new Promise(function (resolve, reject) {
      if (global.document.readyState === 'complete') {
        resolve(global.document);
      } else {
        global.document.addEventListener('DOMContentLoaded', completed);
        global.addEventListener('load', completed);
      }

      function completed() {
        global.document.removeEventListener('DOMContentLoaded', completed);
        global.removeEventListener('load', completed);
        resolve(global.document);
      }
    });
  }

  function createLoader() {
    if (_aureliaPal.PLATFORM.Loader) {
      return Promise.resolve(new _aureliaPal.PLATFORM.Loader());
    }

    if (window.System && typeof window.System.import === 'function') {
      return System.normalize('aurelia-bootstrapper').then(function (bootstrapperName) {
        return System.normalize('aurelia-loader-default', bootstrapperName);
      }).then(function (loaderName) {
        return System.import(loaderName).then(function (m) {
          return new m.DefaultLoader();
        });
      });
    }

    if (typeof window.require === 'function') {
      return new Promise(function (resolve, reject) {
        return require(['aurelia-loader-default'], function (m) {
          return resolve(new m.DefaultLoader());
        }, reject);
      });
    }

    return Promise.reject('No PLATFORM.Loader is defined and there is neither a System API (ES6) or a Require API (AMD) globally available to load your app.');
  }

  function preparePlatform(loader) {
    return loader.normalize('aurelia-bootstrapper').then(function (bootstrapperName) {
      return loader.normalize('aurelia-framework', bootstrapperName).then(function (frameworkName) {
        loader.map('aurelia-framework', frameworkName);

        return Promise.all([loader.normalize('aurelia-dependency-injection', frameworkName).then(function (diName) {
          return loader.map('aurelia-dependency-injection', diName);
        }), loader.normalize('aurelia-router', bootstrapperName).then(function (routerName) {
          return loader.map('aurelia-router', routerName);
        }), loader.normalize('aurelia-logging-console', bootstrapperName).then(function (loggingConsoleName) {
          return loader.map('aurelia-logging-console', loggingConsoleName);
        })]).then(function () {
          return loader.loadModule(frameworkName).then(function (m) {
            return Aurelia = m.Aurelia;
          });
        });
      });
    });
  }

  function handleApp(loader, appHost) {
    var moduleId = appHost.getAttribute('aurelia-app') || appHost.getAttribute('data-aurelia-app');
    return config(loader, appHost, moduleId);
  }

  function config(loader, appHost, configModuleId) {
    var aurelia = new Aurelia(loader);
    aurelia.host = appHost;
    aurelia.configModuleId = configModuleId || null;

    if (configModuleId) {
      return loader.loadModule(configModuleId).then(function (customConfig) {
        return customConfig.configure(aurelia);
      });
    }

    aurelia.use.standardConfiguration().developmentLogging();

    return aurelia.start().then(function () {
      return aurelia.setRoot();
    });
  }

  function run() {
    return ready(window).then(function (doc) {
      (0, _aureliaPalBrowser.initialize)();

      var appHost = doc.querySelectorAll('[aurelia-app],[data-aurelia-app]');
      return createLoader().then(function (loader) {
        return preparePlatform(loader).then(function () {
          for (var i = 0, ii = appHost.length; i < ii; ++i) {
            handleApp(loader, appHost[i]).catch(console.error.bind(console));
          }

          sharedLoader = loader;
          for (var _i = 0, _ii = bootstrapQueue.length; _i < _ii; ++_i) {
            bootstrapQueue[_i]();
          }
          bootstrapQueue = null;
        });
      });
    });
  }

  function bootstrap(configure) {
    return onBootstrap(function (loader) {
      var aurelia = new Aurelia(loader);
      return configure(aurelia);
    });
  }

  run();
});
define('aurelia-binding',['exports', 'aurelia-logging', 'aurelia-pal', 'aurelia-task-queue', 'aurelia-metadata'], function (exports, _aureliaLogging, _aureliaPal, _aureliaTaskQueue, _aureliaMetadata) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getSetObserver = exports.BindingEngine = exports.NameExpression = exports.Listener = exports.ListenerExpression = exports.BindingBehaviorResource = exports.ValueConverterResource = exports.Call = exports.CallExpression = exports.Binding = exports.BindingExpression = exports.ObjectObservationAdapter = exports.ObserverLocator = exports.SVGAnalyzer = exports.presentationAttributes = exports.presentationElements = exports.elements = exports.ComputedExpression = exports.ClassObserver = exports.SelectValueObserver = exports.CheckedObserver = exports.ValueAttributeObserver = exports.StyleObserver = exports.DataAttributeObserver = exports.dataAttributeAccessor = exports.XLinkAttributeObserver = exports.SetterObserver = exports.PrimitiveObserver = exports.propertyAccessor = exports.DirtyCheckProperty = exports.DirtyChecker = exports.EventManager = exports.getMapObserver = exports.ParserImplementation = exports.Parser = exports.Scanner = exports.Lexer = exports.Token = exports.bindingMode = exports.ExpressionCloner = exports.Unparser = exports.LiteralObject = exports.LiteralArray = exports.LiteralString = exports.LiteralPrimitive = exports.PrefixNot = exports.Binary = exports.CallFunction = exports.CallMember = exports.CallScope = exports.AccessKeyed = exports.AccessMember = exports.AccessScope = exports.AccessThis = exports.Conditional = exports.Assign = exports.ValueConverter = exports.BindingBehavior = exports.Chain = exports.Expression = exports.getArrayObserver = exports.CollectionLengthObserver = exports.ModifyCollectionObserver = exports.ExpressionObserver = exports.sourceContext = undefined;
  exports.camelCase = camelCase;
  exports.createOverrideContext = createOverrideContext;
  exports.getContextFor = getContextFor;
  exports.createScopeForTest = createScopeForTest;
  exports.connectable = connectable;
  exports.enqueueBindingConnect = enqueueBindingConnect;
  exports.subscriberCollection = subscriberCollection;
  exports.calcSplices = calcSplices;
  exports.mergeSplice = mergeSplice;
  exports.projectArraySplices = projectArraySplices;
  exports.getChangeRecords = getChangeRecords;
  exports.cloneExpression = cloneExpression;
  exports.hasDeclaredDependencies = hasDeclaredDependencies;
  exports.declarePropertyDependencies = declarePropertyDependencies;
  exports.computedFrom = computedFrom;
  exports.createComputedObserver = createComputedObserver;
  exports.valueConverter = valueConverter;
  exports.bindingBehavior = bindingBehavior;
  exports.observable = observable;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  

  var _dec, _dec2, _class, _dec3, _class2, _dec4, _class3, _dec5, _class5, _dec6, _class7, _dec7, _class8, _dec8, _class9, _dec9, _class10, _class11, _temp, _dec10, _class12, _class13, _temp2;

  var map = Object.create(null);

  function camelCase(name) {
    if (name in map) {
      return map[name];
    }
    var result = name.charAt(0).toLowerCase() + name.slice(1).replace(/[_.-](\w|$)/g, function (_, x) {
      return x.toUpperCase();
    });
    map[name] = result;
    return result;
  }

  function createOverrideContext(bindingContext, parentOverrideContext) {
    return {
      bindingContext: bindingContext,
      parentOverrideContext: parentOverrideContext || null
    };
  }

  function getContextFor(name, scope, ancestor) {
    var oc = scope.overrideContext;

    if (ancestor) {
      while (ancestor && oc) {
        ancestor--;
        oc = oc.parentOverrideContext;
      }
      if (ancestor || !oc) {
        return undefined;
      }
      return name in oc ? oc : oc.bindingContext;
    }

    while (oc && !(name in oc) && !(oc.bindingContext && name in oc.bindingContext)) {
      oc = oc.parentOverrideContext;
    }
    if (oc) {
      return name in oc ? oc : oc.bindingContext;
    }

    return scope.bindingContext || scope.overrideContext;
  }

  function createScopeForTest(bindingContext, parentBindingContext) {
    if (parentBindingContext) {
      return {
        bindingContext: bindingContext,
        overrideContext: createOverrideContext(bindingContext, createOverrideContext(parentBindingContext))
      };
    }
    return {
      bindingContext: bindingContext,
      overrideContext: createOverrideContext(bindingContext)
    };
  }

  var sourceContext = exports.sourceContext = 'Binding:source';
  var slotNames = [];
  var versionSlotNames = [];

  for (var i = 0; i < 100; i++) {
    slotNames.push('_observer' + i);
    versionSlotNames.push('_observerVersion' + i);
  }

  function addObserver(observer) {
    var observerSlots = this._observerSlots === undefined ? 0 : this._observerSlots;
    var i = observerSlots;
    while (i-- && this[slotNames[i]] !== observer) {}

    if (i === -1) {
      i = 0;
      while (this[slotNames[i]]) {
        i++;
      }
      this[slotNames[i]] = observer;
      observer.subscribe(sourceContext, this);

      if (i === observerSlots) {
        this._observerSlots = i + 1;
      }
    }

    if (this._version === undefined) {
      this._version = 0;
    }
    this[versionSlotNames[i]] = this._version;
  }

  function observeProperty(obj, propertyName) {
    var observer = this.observerLocator.getObserver(obj, propertyName);
    addObserver.call(this, observer);
  }

  function observeArray(array) {
    var observer = this.observerLocator.getArrayObserver(array);
    addObserver.call(this, observer);
  }

  function unobserve(all) {
    var i = this._observerSlots;
    while (i--) {
      if (all || this[versionSlotNames[i]] !== this._version) {
        var observer = this[slotNames[i]];
        this[slotNames[i]] = null;
        if (observer) {
          observer.unsubscribe(sourceContext, this);
        }
      }
    }
  }

  function connectable() {
    return function (target) {
      target.prototype.observeProperty = observeProperty;
      target.prototype.observeArray = observeArray;
      target.prototype.unobserve = unobserve;
      target.prototype.addObserver = addObserver;
    };
  }

  var bindings = new Map();
  var minimumImmediate = 100;
  var frameBudget = 15;

  var isFlushRequested = false;
  var immediate = 0;

  function flush(animationFrameStart) {
    var i = 0;
    var keys = bindings.keys();
    var item = void 0;

    while (item = keys.next()) {
      if (item.done) {
        break;
      }

      var binding = item.value;
      bindings.delete(binding);
      binding.connect(true);
      i++;

      if (i % 100 === 0 && _aureliaPal.PLATFORM.performance.now() - animationFrameStart > frameBudget) {
        break;
      }
    }

    if (bindings.size) {
      _aureliaPal.PLATFORM.requestAnimationFrame(flush);
    } else {
      isFlushRequested = false;
      immediate = 0;
    }
  }

  function enqueueBindingConnect(binding) {
    if (immediate < minimumImmediate) {
      immediate++;
      binding.connect(false);
    } else {
      bindings.set(binding);
    }
    if (!isFlushRequested) {
      isFlushRequested = true;
      _aureliaPal.PLATFORM.requestAnimationFrame(flush);
    }
  }

  function addSubscriber(context, callable) {
    if (this.hasSubscriber(context, callable)) {
      return false;
    }
    if (!this._context0) {
      this._context0 = context;
      this._callable0 = callable;
      return true;
    }
    if (!this._context1) {
      this._context1 = context;
      this._callable1 = callable;
      return true;
    }
    if (!this._context2) {
      this._context2 = context;
      this._callable2 = callable;
      return true;
    }
    if (!this._contextsRest) {
      this._contextsRest = [context];
      this._callablesRest = [callable];
      return true;
    }
    this._contextsRest.push(context);
    this._callablesRest.push(callable);
    return true;
  }

  function removeSubscriber(context, callable) {
    if (this._context0 === context && this._callable0 === callable) {
      this._context0 = null;
      this._callable0 = null;
      return true;
    }
    if (this._context1 === context && this._callable1 === callable) {
      this._context1 = null;
      this._callable1 = null;
      return true;
    }
    if (this._context2 === context && this._callable2 === callable) {
      this._context2 = null;
      this._callable2 = null;
      return true;
    }
    var rest = this._contextsRest;
    var index = void 0;
    if (!rest || !rest.length || (index = rest.indexOf(context)) === -1 || this._callablesRest[index] !== callable) {
      return false;
    }
    rest.splice(index, 1);
    this._callablesRest.splice(index, 1);
    return true;
  }

  var arrayPool1 = [];
  var arrayPool2 = [];
  var poolUtilization = [];

  function callSubscribers(newValue, oldValue) {
    var context0 = this._context0;
    var callable0 = this._callable0;
    var context1 = this._context1;
    var callable1 = this._callable1;
    var context2 = this._context2;
    var callable2 = this._callable2;
    var length = this._contextsRest ? this._contextsRest.length : 0;
    var contextsRest = void 0;
    var callablesRest = void 0;
    var poolIndex = void 0;
    var i = void 0;
    if (length) {
      poolIndex = poolUtilization.length;
      while (poolIndex-- && poolUtilization[poolIndex]) {}
      if (poolIndex < 0) {
        poolIndex = poolUtilization.length;
        contextsRest = [];
        callablesRest = [];
        poolUtilization.push(true);
        arrayPool1.push(contextsRest);
        arrayPool2.push(callablesRest);
      } else {
        poolUtilization[poolIndex] = true;
        contextsRest = arrayPool1[poolIndex];
        callablesRest = arrayPool2[poolIndex];
      }

      i = length;
      while (i--) {
        contextsRest[i] = this._contextsRest[i];
        callablesRest[i] = this._callablesRest[i];
      }
    }

    if (context0) {
      if (callable0) {
        callable0.call(context0, newValue, oldValue);
      } else {
        context0(newValue, oldValue);
      }
    }
    if (context1) {
      if (callable1) {
        callable1.call(context1, newValue, oldValue);
      } else {
        context1(newValue, oldValue);
      }
    }
    if (context2) {
      if (callable2) {
        callable2.call(context2, newValue, oldValue);
      } else {
        context2(newValue, oldValue);
      }
    }
    if (length) {
      for (i = 0; i < length; i++) {
        var callable = callablesRest[i];
        var context = contextsRest[i];
        if (callable) {
          callable.call(context, newValue, oldValue);
        } else {
          context(newValue, oldValue);
        }
        contextsRest[i] = null;
        callablesRest[i] = null;
      }
      poolUtilization[poolIndex] = false;
    }
  }

  function hasSubscribers() {
    return !!(this._context0 || this._context1 || this._context2 || this._contextsRest && this._contextsRest.length);
  }

  function hasSubscriber(context, callable) {
    var has = this._context0 === context && this._callable0 === callable || this._context1 === context && this._callable1 === callable || this._context2 === context && this._callable2 === callable;
    if (has) {
      return true;
    }
    var index = void 0;
    var contexts = this._contextsRest;
    if (!contexts || (index = contexts.length) === 0) {
      return false;
    }
    var callables = this._callablesRest;
    while (index--) {
      if (contexts[index] === context && callables[index] === callable) {
        return true;
      }
    }
    return false;
  }

  function subscriberCollection() {
    return function (target) {
      target.prototype.addSubscriber = addSubscriber;
      target.prototype.removeSubscriber = removeSubscriber;
      target.prototype.callSubscribers = callSubscribers;
      target.prototype.hasSubscribers = hasSubscribers;
      target.prototype.hasSubscriber = hasSubscriber;
    };
  }

  var ExpressionObserver = exports.ExpressionObserver = (_dec = connectable(), _dec2 = subscriberCollection(), _dec(_class = _dec2(_class = function () {
    function ExpressionObserver(scope, expression, observerLocator, lookupFunctions) {
      

      this.scope = scope;
      this.expression = expression;
      this.observerLocator = observerLocator;
      this.lookupFunctions = lookupFunctions;
    }

    ExpressionObserver.prototype.getValue = function getValue() {
      return this.expression.evaluate(this.scope, this.lookupFunctions);
    };

    ExpressionObserver.prototype.setValue = function setValue(newValue) {
      this.expression.assign(this.scope, newValue);
    };

    ExpressionObserver.prototype.subscribe = function subscribe(context, callable) {
      var _this = this;

      if (!this.hasSubscribers()) {
        this.oldValue = this.expression.evaluate(this.scope, this.lookupFunctions);
        this.expression.connect(this, this.scope);
      }
      this.addSubscriber(context, callable);
      if (arguments.length === 1 && context instanceof Function) {
        return {
          dispose: function dispose() {
            _this.unsubscribe(context, callable);
          }
        };
      }
    };

    ExpressionObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
        this.unobserve(true);
        this.oldValue = undefined;
      }
    };

    ExpressionObserver.prototype.call = function call() {
      var newValue = this.expression.evaluate(this.scope, this.lookupFunctions);
      var oldValue = this.oldValue;
      if (newValue !== oldValue) {
        this.oldValue = newValue;
        this.callSubscribers(newValue, oldValue);
      }
      this._version++;
      this.expression.connect(this, this.scope);
      this.unobserve(false);
    };

    return ExpressionObserver;
  }()) || _class) || _class);


  function isIndex(s) {
    return +s === s >>> 0;
  }

  function toNumber(s) {
    return +s;
  }

  function newSplice(index, removed, addedCount) {
    return {
      index: index,
      removed: removed,
      addedCount: addedCount
    };
  }

  var EDIT_LEAVE = 0;
  var EDIT_UPDATE = 1;
  var EDIT_ADD = 2;
  var EDIT_DELETE = 3;

  function ArraySplice() {}

  ArraySplice.prototype = {
    calcEditDistances: function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
      var rowCount = oldEnd - oldStart + 1;
      var columnCount = currentEnd - currentStart + 1;
      var distances = new Array(rowCount);
      var north = void 0;
      var west = void 0;

      for (var _i = 0; _i < rowCount; ++_i) {
        distances[_i] = new Array(columnCount);
        distances[_i][0] = _i;
      }

      for (var j = 0; j < columnCount; ++j) {
        distances[0][j] = j;
      }

      for (var _i2 = 1; _i2 < rowCount; ++_i2) {
        for (var _j = 1; _j < columnCount; ++_j) {
          if (this.equals(current[currentStart + _j - 1], old[oldStart + _i2 - 1])) {
            distances[_i2][_j] = distances[_i2 - 1][_j - 1];
          } else {
            north = distances[_i2 - 1][_j] + 1;
            west = distances[_i2][_j - 1] + 1;
            distances[_i2][_j] = north < west ? north : west;
          }
        }
      }

      return distances;
    },

    spliceOperationsFromEditDistances: function spliceOperationsFromEditDistances(distances) {
      var i = distances.length - 1;
      var j = distances[0].length - 1;
      var current = distances[i][j];
      var edits = [];
      while (i > 0 || j > 0) {
        if (i === 0) {
          edits.push(EDIT_ADD);
          j--;
          continue;
        }
        if (j === 0) {
          edits.push(EDIT_DELETE);
          i--;
          continue;
        }
        var northWest = distances[i - 1][j - 1];
        var west = distances[i - 1][j];
        var north = distances[i][j - 1];

        var min = void 0;
        if (west < north) {
          min = west < northWest ? west : northWest;
        } else {
          min = north < northWest ? north : northWest;
        }

        if (min === northWest) {
          if (northWest === current) {
            edits.push(EDIT_LEAVE);
          } else {
            edits.push(EDIT_UPDATE);
            current = northWest;
          }
          i--;
          j--;
        } else if (min === west) {
          edits.push(EDIT_DELETE);
          i--;
          current = west;
        } else {
          edits.push(EDIT_ADD);
          j--;
          current = north;
        }
      }

      edits.reverse();
      return edits;
    },

    calcSplices: function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
      var prefixCount = 0;
      var suffixCount = 0;

      var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
      if (currentStart === 0 && oldStart === 0) {
        prefixCount = this.sharedPrefix(current, old, minLength);
      }

      if (currentEnd === current.length && oldEnd === old.length) {
        suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);
      }

      currentStart += prefixCount;
      oldStart += prefixCount;
      currentEnd -= suffixCount;
      oldEnd -= suffixCount;

      if (currentEnd - currentStart === 0 && oldEnd - oldStart === 0) {
        return [];
      }

      if (currentStart === currentEnd) {
        var _splice = newSplice(currentStart, [], 0);
        while (oldStart < oldEnd) {
          _splice.removed.push(old[oldStart++]);
        }

        return [_splice];
      } else if (oldStart === oldEnd) {
        return [newSplice(currentStart, [], currentEnd - currentStart)];
      }

      var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));

      var splice = undefined;
      var splices = [];
      var index = currentStart;
      var oldIndex = oldStart;
      for (var _i3 = 0; _i3 < ops.length; ++_i3) {
        switch (ops[_i3]) {
          case EDIT_LEAVE:
            if (splice) {
              splices.push(splice);
              splice = undefined;
            }

            index++;
            oldIndex++;
            break;
          case EDIT_UPDATE:
            if (!splice) {
              splice = newSplice(index, [], 0);
            }

            splice.addedCount++;
            index++;

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
          case EDIT_ADD:
            if (!splice) {
              splice = newSplice(index, [], 0);
            }

            splice.addedCount++;
            index++;
            break;
          case EDIT_DELETE:
            if (!splice) {
              splice = newSplice(index, [], 0);
            }

            splice.removed.push(old[oldIndex]);
            oldIndex++;
            break;
        }
      }

      if (splice) {
        splices.push(splice);
      }
      return splices;
    },

    sharedPrefix: function sharedPrefix(current, old, searchLength) {
      for (var _i4 = 0; _i4 < searchLength; ++_i4) {
        if (!this.equals(current[_i4], old[_i4])) {
          return _i4;
        }
      }

      return searchLength;
    },

    sharedSuffix: function sharedSuffix(current, old, searchLength) {
      var index1 = current.length;
      var index2 = old.length;
      var count = 0;
      while (count < searchLength && this.equals(current[--index1], old[--index2])) {
        count++;
      }

      return count;
    },

    calculateSplices: function calculateSplices(current, previous) {
      return this.calcSplices(current, 0, current.length, previous, 0, previous.length);
    },

    equals: function equals(currentValue, previousValue) {
      return currentValue === previousValue;
    }
  };

  var arraySplice = new ArraySplice();

  function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
    return arraySplice.calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd);
  }

  function intersect(start1, end1, start2, end2) {
    if (end1 < start2 || end2 < start1) {
      return -1;
    }

    if (end1 === start2 || end2 === start1) {
      return 0;
    }

    if (start1 < start2) {
      if (end1 < end2) {
        return end1 - start2;
      }

      return end2 - start2;
    }

    if (end2 < end1) {
      return end2 - start1;
    }

    return end1 - start1;
  }

  function mergeSplice(splices, index, removed, addedCount) {
    var splice = newSplice(index, removed, addedCount);

    var inserted = false;
    var insertionOffset = 0;

    for (var _i5 = 0; _i5 < splices.length; _i5++) {
      var current = splices[_i5];
      current.index += insertionOffset;

      if (inserted) {
        continue;
      }

      var intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);

      if (intersectCount >= 0) {

        splices.splice(_i5, 1);
        _i5--;

        insertionOffset -= current.addedCount - current.removed.length;

        splice.addedCount += current.addedCount - intersectCount;
        var deleteCount = splice.removed.length + current.removed.length - intersectCount;

        if (!splice.addedCount && !deleteCount) {
          inserted = true;
        } else {
          var currentRemoved = current.removed;

          if (splice.index < current.index) {
            var prepend = splice.removed.slice(0, current.index - splice.index);
            Array.prototype.push.apply(prepend, currentRemoved);
            currentRemoved = prepend;
          }

          if (splice.index + splice.removed.length > current.index + current.addedCount) {
            var append = splice.removed.slice(current.index + current.addedCount - splice.index);
            Array.prototype.push.apply(currentRemoved, append);
          }

          splice.removed = currentRemoved;
          if (current.index < splice.index) {
            splice.index = current.index;
          }
        }
      } else if (splice.index < current.index) {

        inserted = true;

        splices.splice(_i5, 0, splice);
        _i5++;

        var offset = splice.addedCount - splice.removed.length;
        current.index += offset;
        insertionOffset += offset;
      }
    }

    if (!inserted) {
      splices.push(splice);
    }
  }

  function createInitialSplices(array, changeRecords) {
    var splices = [];

    for (var _i6 = 0; _i6 < changeRecords.length; _i6++) {
      var record = changeRecords[_i6];
      switch (record.type) {
        case 'splice':
          mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
          break;
        case 'add':
        case 'update':
        case 'delete':
          if (!isIndex(record.name)) {
            continue;
          }

          var index = toNumber(record.name);
          if (index < 0) {
            continue;
          }

          mergeSplice(splices, index, [record.oldValue], record.type === 'delete' ? 0 : 1);
          break;
        default:
          console.error('Unexpected record type: ' + JSON.stringify(record));
          break;
      }
    }

    return splices;
  }

  function projectArraySplices(array, changeRecords) {
    var splices = [];

    createInitialSplices(array, changeRecords).forEach(function (splice) {
      if (splice.addedCount === 1 && splice.removed.length === 1) {
        if (splice.removed[0] !== array[splice.index]) {
          splices.push(splice);
        }

        return;
      }

      splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
    });

    return splices;
  }

  function newRecord(type, object, key, oldValue) {
    return {
      type: type,
      object: object,
      key: key,
      oldValue: oldValue
    };
  }

  function getChangeRecords(map) {
    var entries = new Array(map.size);
    var keys = map.keys();
    var i = 0;
    var item = void 0;

    while (item = keys.next()) {
      if (item.done) {
        break;
      }

      entries[i] = newRecord('added', map, item.value);
      i++;
    }

    return entries;
  }

  var ModifyCollectionObserver = exports.ModifyCollectionObserver = (_dec3 = subscriberCollection(), _dec3(_class2 = function () {
    function ModifyCollectionObserver(taskQueue, collection) {
      

      this.taskQueue = taskQueue;
      this.queued = false;
      this.changeRecords = null;
      this.oldCollection = null;
      this.collection = collection;
      this.lengthPropertyName = collection instanceof Map || collection instanceof Set ? 'size' : 'length';
    }

    ModifyCollectionObserver.prototype.subscribe = function subscribe(context, callable) {
      this.addSubscriber(context, callable);
    };

    ModifyCollectionObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      this.removeSubscriber(context, callable);
    };

    ModifyCollectionObserver.prototype.addChangeRecord = function addChangeRecord(changeRecord) {
      if (!this.hasSubscribers() && !this.lengthObserver) {
        return;
      }

      if (changeRecord.type === 'splice') {
        var index = changeRecord.index;
        var arrayLength = changeRecord.object.length;
        if (index > arrayLength) {
          index = arrayLength - changeRecord.addedCount;
        } else if (index < 0) {
          index = arrayLength + changeRecord.removed.length + index - changeRecord.addedCount;
        }
        if (index < 0) {
          index = 0;
        }
        changeRecord.index = index;
      }

      if (this.changeRecords === null) {
        this.changeRecords = [changeRecord];
      } else {
        this.changeRecords.push(changeRecord);
      }

      if (!this.queued) {
        this.queued = true;
        this.taskQueue.queueMicroTask(this);
      }
    };

    ModifyCollectionObserver.prototype.flushChangeRecords = function flushChangeRecords() {
      if (this.changeRecords && this.changeRecords.length || this.oldCollection) {
        this.call();
      }
    };

    ModifyCollectionObserver.prototype.reset = function reset(oldCollection) {
      this.oldCollection = oldCollection;

      if (this.hasSubscribers() && !this.queued) {
        this.queued = true;
        this.taskQueue.queueMicroTask(this);
      }
    };

    ModifyCollectionObserver.prototype.getLengthObserver = function getLengthObserver() {
      return this.lengthObserver || (this.lengthObserver = new CollectionLengthObserver(this.collection));
    };

    ModifyCollectionObserver.prototype.call = function call() {
      var changeRecords = this.changeRecords;
      var oldCollection = this.oldCollection;
      var records = void 0;

      this.queued = false;
      this.changeRecords = [];
      this.oldCollection = null;

      if (this.hasSubscribers()) {
        if (oldCollection) {
          if (this.collection instanceof Map || this.collection instanceof Set) {
            records = getChangeRecords(oldCollection);
          } else {
            records = calcSplices(this.collection, 0, this.collection.length, oldCollection, 0, oldCollection.length);
          }
        } else {
          if (this.collection instanceof Map || this.collection instanceof Set) {
            records = changeRecords;
          } else {
            records = projectArraySplices(this.collection, changeRecords);
          }
        }

        this.callSubscribers(records);
      }

      if (this.lengthObserver) {
        this.lengthObserver.call(this.collection[this.lengthPropertyName]);
      }
    };

    return ModifyCollectionObserver;
  }()) || _class2);
  var CollectionLengthObserver = exports.CollectionLengthObserver = (_dec4 = subscriberCollection(), _dec4(_class3 = function () {
    function CollectionLengthObserver(collection) {
      

      this.collection = collection;
      this.lengthPropertyName = collection instanceof Map || collection instanceof Set ? 'size' : 'length';
      this.currentValue = collection[this.lengthPropertyName];
    }

    CollectionLengthObserver.prototype.getValue = function getValue() {
      return this.collection[this.lengthPropertyName];
    };

    CollectionLengthObserver.prototype.setValue = function setValue(newValue) {
      this.collection[this.lengthPropertyName] = newValue;
    };

    CollectionLengthObserver.prototype.subscribe = function subscribe(context, callable) {
      this.addSubscriber(context, callable);
    };

    CollectionLengthObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      this.removeSubscriber(context, callable);
    };

    CollectionLengthObserver.prototype.call = function call(newValue) {
      var oldValue = this.currentValue;
      this.callSubscribers(newValue, oldValue);
      this.currentValue = newValue;
    };

    return CollectionLengthObserver;
  }()) || _class3);

  var pop = Array.prototype.pop;
  var push = Array.prototype.push;
  var reverse = Array.prototype.reverse;
  var shift = Array.prototype.shift;
  var sort = Array.prototype.sort;
  var splice = Array.prototype.splice;
  var unshift = Array.prototype.unshift;

  Array.prototype.pop = function () {
    var notEmpty = this.length > 0;
    var methodCallResult = pop.apply(this, arguments);
    if (notEmpty && this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'delete',
        object: this,
        name: this.length,
        oldValue: methodCallResult
      });
    }
    return methodCallResult;
  };

  Array.prototype.push = function () {
    var methodCallResult = push.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: this.length - arguments.length,
        removed: [],
        addedCount: arguments.length
      });
    }
    return methodCallResult;
  };

  Array.prototype.reverse = function () {
    var oldArray = void 0;
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.flushChangeRecords();
      oldArray = this.slice();
    }
    var methodCallResult = reverse.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.reset(oldArray);
    }
    return methodCallResult;
  };

  Array.prototype.shift = function () {
    var notEmpty = this.length > 0;
    var methodCallResult = shift.apply(this, arguments);
    if (notEmpty && this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'delete',
        object: this,
        name: 0,
        oldValue: methodCallResult
      });
    }
    return methodCallResult;
  };

  Array.prototype.sort = function () {
    var oldArray = void 0;
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.flushChangeRecords();
      oldArray = this.slice();
    }
    var methodCallResult = sort.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.reset(oldArray);
    }
    return methodCallResult;
  };

  Array.prototype.splice = function () {
    var methodCallResult = splice.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: arguments[0],
        removed: methodCallResult,
        addedCount: arguments.length > 2 ? arguments.length - 2 : 0
      });
    }
    return methodCallResult;
  };

  Array.prototype.unshift = function () {
    var methodCallResult = unshift.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: 0,
        removed: [],
        addedCount: arguments.length
      });
    }
    return methodCallResult;
  };

  function _getArrayObserver(taskQueue, array) {
    return ModifyArrayObserver.for(taskQueue, array);
  }

  exports.getArrayObserver = _getArrayObserver;

  var ModifyArrayObserver = function (_ModifyCollectionObse) {
    _inherits(ModifyArrayObserver, _ModifyCollectionObse);

    function ModifyArrayObserver(taskQueue, array) {
      

      return _possibleConstructorReturn(this, _ModifyCollectionObse.call(this, taskQueue, array));
    }

    ModifyArrayObserver.for = function _for(taskQueue, array) {
      if (!('__array_observer__' in array)) {
        Reflect.defineProperty(array, '__array_observer__', {
          value: ModifyArrayObserver.create(taskQueue, array),
          enumerable: false, configurable: false
        });
      }
      return array.__array_observer__;
    };

    ModifyArrayObserver.create = function create(taskQueue, array) {
      return new ModifyArrayObserver(taskQueue, array);
    };

    return ModifyArrayObserver;
  }(ModifyCollectionObserver);

  var Expression = exports.Expression = function () {
    function Expression() {
      

      this.isChain = false;
      this.isAssignable = false;
    }

    Expression.prototype.evaluate = function evaluate(scope, lookupFunctions, args) {
      throw new Error('Binding expression "' + this + '" cannot be evaluated.');
    };

    Expression.prototype.assign = function assign(scope, value, lookupFunctions) {
      throw new Error('Binding expression "' + this + '" cannot be assigned to.');
    };

    Expression.prototype.toString = function toString() {
      return Unparser.unparse(this);
    };

    return Expression;
  }();

  var Chain = exports.Chain = function (_Expression) {
    _inherits(Chain, _Expression);

    function Chain(expressions) {
      

      var _this3 = _possibleConstructorReturn(this, _Expression.call(this));

      _this3.expressions = expressions;
      _this3.isChain = true;
      return _this3;
    }

    Chain.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var result = void 0;
      var expressions = this.expressions;
      var last = void 0;

      for (var _i7 = 0, length = expressions.length; _i7 < length; ++_i7) {
        last = expressions[_i7].evaluate(scope, lookupFunctions);

        if (last !== null) {
          result = last;
        }
      }

      return result;
    };

    Chain.prototype.accept = function accept(visitor) {
      return visitor.visitChain(this);
    };

    return Chain;
  }(Expression);

  var BindingBehavior = exports.BindingBehavior = function (_Expression2) {
    _inherits(BindingBehavior, _Expression2);

    function BindingBehavior(expression, name, args) {
      

      var _this4 = _possibleConstructorReturn(this, _Expression2.call(this));

      _this4.expression = expression;
      _this4.name = name;
      _this4.args = args;
      return _this4;
    }

    BindingBehavior.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return this.expression.evaluate(scope, lookupFunctions);
    };

    BindingBehavior.prototype.assign = function assign(scope, value, lookupFunctions) {
      return this.expression.assign(scope, value, lookupFunctions);
    };

    BindingBehavior.prototype.accept = function accept(visitor) {
      return visitor.visitBindingBehavior(this);
    };

    BindingBehavior.prototype.connect = function connect(binding, scope) {
      this.expression.connect(binding, scope);
    };

    BindingBehavior.prototype.bind = function bind(binding, scope, lookupFunctions) {
      if (this.expression.expression && this.expression.bind) {
        this.expression.bind(binding, scope, lookupFunctions);
      }
      var behavior = lookupFunctions.bindingBehaviors(this.name);
      if (!behavior) {
        throw new Error('No BindingBehavior named "' + this.name + '" was found!');
      }
      var behaviorKey = 'behavior-' + this.name;
      if (binding[behaviorKey]) {
        throw new Error('A binding behavior named "' + this.name + '" has already been applied to "' + this.expression + '"');
      }
      binding[behaviorKey] = behavior;
      behavior.bind.apply(behavior, [binding, scope].concat(evalList(scope, this.args, binding.lookupFunctions)));
    };

    BindingBehavior.prototype.unbind = function unbind(binding, scope) {
      var behaviorKey = 'behavior-' + this.name;
      binding[behaviorKey].unbind(binding, scope);
      binding[behaviorKey] = null;
      if (this.expression.expression && this.expression.unbind) {
        this.expression.unbind(binding, scope);
      }
    };

    return BindingBehavior;
  }(Expression);

  var ValueConverter = exports.ValueConverter = function (_Expression3) {
    _inherits(ValueConverter, _Expression3);

    function ValueConverter(expression, name, args, allArgs) {
      

      var _this5 = _possibleConstructorReturn(this, _Expression3.call(this));

      _this5.expression = expression;
      _this5.name = name;
      _this5.args = args;
      _this5.allArgs = allArgs;
      return _this5;
    }

    ValueConverter.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var converter = lookupFunctions.valueConverters(this.name);
      if (!converter) {
        throw new Error('No ValueConverter named "' + this.name + '" was found!');
      }

      if ('toView' in converter) {
        return converter.toView.apply(converter, evalList(scope, this.allArgs, lookupFunctions));
      }

      return this.allArgs[0].evaluate(scope, lookupFunctions);
    };

    ValueConverter.prototype.assign = function assign(scope, value, lookupFunctions) {
      var converter = lookupFunctions.valueConverters(this.name);
      if (!converter) {
        throw new Error('No ValueConverter named "' + this.name + '" was found!');
      }

      if ('fromView' in converter) {
        value = converter.fromView.apply(converter, [value].concat(evalList(scope, this.args, lookupFunctions)));
      }

      return this.allArgs[0].assign(scope, value, lookupFunctions);
    };

    ValueConverter.prototype.accept = function accept(visitor) {
      return visitor.visitValueConverter(this);
    };

    ValueConverter.prototype.connect = function connect(binding, scope) {
      var expressions = this.allArgs;
      var i = expressions.length;
      while (i--) {
        expressions[i].connect(binding, scope);
      }
    };

    return ValueConverter;
  }(Expression);

  var Assign = exports.Assign = function (_Expression4) {
    _inherits(Assign, _Expression4);

    function Assign(target, value) {
      

      var _this6 = _possibleConstructorReturn(this, _Expression4.call(this));

      _this6.target = target;
      _this6.value = value;
      return _this6;
    }

    Assign.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return this.target.assign(scope, this.value.evaluate(scope, lookupFunctions));
    };

    Assign.prototype.accept = function accept(vistor) {
      vistor.visitAssign(this);
    };

    Assign.prototype.connect = function connect(binding, scope) {};

    return Assign;
  }(Expression);

  var Conditional = exports.Conditional = function (_Expression5) {
    _inherits(Conditional, _Expression5);

    function Conditional(condition, yes, no) {
      

      var _this7 = _possibleConstructorReturn(this, _Expression5.call(this));

      _this7.condition = condition;
      _this7.yes = yes;
      _this7.no = no;
      return _this7;
    }

    Conditional.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return !!this.condition.evaluate(scope) ? this.yes.evaluate(scope) : this.no.evaluate(scope);
    };

    Conditional.prototype.accept = function accept(visitor) {
      return visitor.visitConditional(this);
    };

    Conditional.prototype.connect = function connect(binding, scope) {
      this.condition.connect(binding, scope);
      if (this.condition.evaluate(scope)) {
        this.yes.connect(binding, scope);
      } else {
        this.no.connect(binding, scope);
      }
    };

    return Conditional;
  }(Expression);

  var AccessThis = exports.AccessThis = function (_Expression6) {
    _inherits(AccessThis, _Expression6);

    function AccessThis(ancestor) {
      

      var _this8 = _possibleConstructorReturn(this, _Expression6.call(this));

      _this8.ancestor = ancestor;
      return _this8;
    }

    AccessThis.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var oc = scope.overrideContext;
      var i = this.ancestor;
      while (i-- && oc) {
        oc = oc.parentOverrideContext;
      }
      return i < 1 && oc ? oc.bindingContext : undefined;
    };

    AccessThis.prototype.accept = function accept(visitor) {
      return visitor.visitAccessThis(this);
    };

    AccessThis.prototype.connect = function connect(binding, scope) {};

    return AccessThis;
  }(Expression);

  var AccessScope = exports.AccessScope = function (_Expression7) {
    _inherits(AccessScope, _Expression7);

    function AccessScope(name, ancestor) {
      

      var _this9 = _possibleConstructorReturn(this, _Expression7.call(this));

      _this9.name = name;
      _this9.ancestor = ancestor;
      _this9.isAssignable = true;
      return _this9;
    }

    AccessScope.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var context = getContextFor(this.name, scope, this.ancestor);
      return context[this.name];
    };

    AccessScope.prototype.assign = function assign(scope, value) {
      var context = getContextFor(this.name, scope, this.ancestor);
      return context ? context[this.name] = value : undefined;
    };

    AccessScope.prototype.accept = function accept(visitor) {
      return visitor.visitAccessScope(this);
    };

    AccessScope.prototype.connect = function connect(binding, scope) {
      var context = getContextFor(this.name, scope, this.ancestor);
      binding.observeProperty(context, this.name);
    };

    return AccessScope;
  }(Expression);

  var AccessMember = exports.AccessMember = function (_Expression8) {
    _inherits(AccessMember, _Expression8);

    function AccessMember(object, name) {
      

      var _this10 = _possibleConstructorReturn(this, _Expression8.call(this));

      _this10.object = object;
      _this10.name = name;
      _this10.isAssignable = true;
      return _this10;
    }

    AccessMember.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var instance = this.object.evaluate(scope, lookupFunctions);
      return instance === null || instance === undefined ? instance : instance[this.name];
    };

    AccessMember.prototype.assign = function assign(scope, value) {
      var instance = this.object.evaluate(scope);

      if (instance === null || instance === undefined) {
        instance = {};
        this.object.assign(scope, instance);
      }

      instance[this.name] = value;
      return value;
    };

    AccessMember.prototype.accept = function accept(visitor) {
      return visitor.visitAccessMember(this);
    };

    AccessMember.prototype.connect = function connect(binding, scope) {
      this.object.connect(binding, scope);
      var obj = this.object.evaluate(scope);
      if (obj) {
        binding.observeProperty(obj, this.name);
      }
    };

    return AccessMember;
  }(Expression);

  var AccessKeyed = exports.AccessKeyed = function (_Expression9) {
    _inherits(AccessKeyed, _Expression9);

    function AccessKeyed(object, key) {
      

      var _this11 = _possibleConstructorReturn(this, _Expression9.call(this));

      _this11.object = object;
      _this11.key = key;
      _this11.isAssignable = true;
      return _this11;
    }

    AccessKeyed.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var instance = this.object.evaluate(scope, lookupFunctions);
      var lookup = this.key.evaluate(scope, lookupFunctions);
      return getKeyed(instance, lookup);
    };

    AccessKeyed.prototype.assign = function assign(scope, value) {
      var instance = this.object.evaluate(scope);
      var lookup = this.key.evaluate(scope);
      return setKeyed(instance, lookup, value);
    };

    AccessKeyed.prototype.accept = function accept(visitor) {
      return visitor.visitAccessKeyed(this);
    };

    AccessKeyed.prototype.connect = function connect(binding, scope) {
      this.object.connect(binding, scope);
      var obj = this.object.evaluate(scope);
      if (obj instanceof Object) {
        this.key.connect(binding, scope);
        var key = this.key.evaluate(scope);

        if (key !== null && key !== undefined && !(Array.isArray(obj) && typeof key === 'number')) {
          binding.observeProperty(obj, key);
        }
      }
    };

    return AccessKeyed;
  }(Expression);

  var CallScope = exports.CallScope = function (_Expression10) {
    _inherits(CallScope, _Expression10);

    function CallScope(name, args, ancestor) {
      

      var _this12 = _possibleConstructorReturn(this, _Expression10.call(this));

      _this12.name = name;
      _this12.args = args;
      _this12.ancestor = ancestor;
      return _this12;
    }

    CallScope.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
      var args = evalList(scope, this.args, lookupFunctions);
      var context = getContextFor(this.name, scope, this.ancestor);
      var func = getFunction(context, this.name, mustEvaluate);
      if (func) {
        return func.apply(context, args);
      }
      return undefined;
    };

    CallScope.prototype.accept = function accept(visitor) {
      return visitor.visitCallScope(this);
    };

    CallScope.prototype.connect = function connect(binding, scope) {
      var args = this.args;
      var i = args.length;
      while (i--) {
        args[i].connect(binding, scope);
      }
    };

    return CallScope;
  }(Expression);

  var CallMember = exports.CallMember = function (_Expression11) {
    _inherits(CallMember, _Expression11);

    function CallMember(object, name, args) {
      

      var _this13 = _possibleConstructorReturn(this, _Expression11.call(this));

      _this13.object = object;
      _this13.name = name;
      _this13.args = args;
      return _this13;
    }

    CallMember.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
      var instance = this.object.evaluate(scope, lookupFunctions);
      var args = evalList(scope, this.args, lookupFunctions);
      var func = getFunction(instance, this.name, mustEvaluate);
      if (func) {
        return func.apply(instance, args);
      }
      return undefined;
    };

    CallMember.prototype.accept = function accept(visitor) {
      return visitor.visitCallMember(this);
    };

    CallMember.prototype.connect = function connect(binding, scope) {
      this.object.connect(binding, scope);
      var obj = this.object.evaluate(scope);
      if (getFunction(obj, this.name, false)) {
        var args = this.args;
        var _i8 = args.length;
        while (_i8--) {
          args[_i8].connect(binding, scope);
        }
      }
    };

    return CallMember;
  }(Expression);

  var CallFunction = exports.CallFunction = function (_Expression12) {
    _inherits(CallFunction, _Expression12);

    function CallFunction(func, args) {
      

      var _this14 = _possibleConstructorReturn(this, _Expression12.call(this));

      _this14.func = func;
      _this14.args = args;
      return _this14;
    }

    CallFunction.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
      var func = this.func.evaluate(scope, lookupFunctions);
      if (typeof func === 'function') {
        return func.apply(null, evalList(scope, this.args, lookupFunctions));
      }
      if (!mustEvaluate && (func === null || func === undefined)) {
        return undefined;
      }
      throw new Error(this.func + ' is not a function');
    };

    CallFunction.prototype.accept = function accept(visitor) {
      return visitor.visitCallFunction(this);
    };

    CallFunction.prototype.connect = function connect(binding, scope) {
      this.func.connect(binding, scope);
      var func = this.func.evaluate(scope);
      if (typeof func === 'function') {
        var args = this.args;
        var _i9 = args.length;
        while (_i9--) {
          args[_i9].connect(binding, scope);
        }
      }
    };

    return CallFunction;
  }(Expression);

  var Binary = exports.Binary = function (_Expression13) {
    _inherits(Binary, _Expression13);

    function Binary(operation, left, right) {
      

      var _this15 = _possibleConstructorReturn(this, _Expression13.call(this));

      _this15.operation = operation;
      _this15.left = left;
      _this15.right = right;
      return _this15;
    }

    Binary.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var left = this.left.evaluate(scope);

      switch (this.operation) {
        case '&&':
          return left && this.right.evaluate(scope);
        case '||':
          return left || this.right.evaluate(scope);
      }

      var right = this.right.evaluate(scope);

      switch (this.operation) {
        case '==':
          return left == right;
        case '===':
          return left === right;
        case '!=':
          return left != right;
        case '!==':
          return left !== right;
      }

      if (left === null || right === null || left === undefined || right === undefined) {
        switch (this.operation) {
          case '+':
            if (left !== null && left !== undefined) return left;
            if (right !== null && right !== undefined) return right;
            return 0;
          case '-':
            if (left !== null && left !== undefined) return left;
            if (right !== null && right !== undefined) return 0 - right;
            return 0;
        }

        return null;
      }

      switch (this.operation) {
        case '+':
          return autoConvertAdd(left, right);
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '<':
          return left < right;
        case '>':
          return left > right;
        case '<=':
          return left <= right;
        case '>=':
          return left >= right;
        case '^':
          return left ^ right;
      }

      throw new Error('Internal error [' + this.operation + '] not handled');
    };

    Binary.prototype.accept = function accept(visitor) {
      return visitor.visitBinary(this);
    };

    Binary.prototype.connect = function connect(binding, scope) {
      this.left.connect(binding, scope);
      var left = this.left.evaluate(scope);
      if (this.operation === '&&' && !left || this.operation === '||' && left) {
        return;
      }
      this.right.connect(binding, scope);
    };

    return Binary;
  }(Expression);

  var PrefixNot = exports.PrefixNot = function (_Expression14) {
    _inherits(PrefixNot, _Expression14);

    function PrefixNot(operation, expression) {
      

      var _this16 = _possibleConstructorReturn(this, _Expression14.call(this));

      _this16.operation = operation;
      _this16.expression = expression;
      return _this16;
    }

    PrefixNot.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return !this.expression.evaluate(scope);
    };

    PrefixNot.prototype.accept = function accept(visitor) {
      return visitor.visitPrefix(this);
    };

    PrefixNot.prototype.connect = function connect(binding, scope) {
      this.expression.connect(binding, scope);
    };

    return PrefixNot;
  }(Expression);

  var LiteralPrimitive = exports.LiteralPrimitive = function (_Expression15) {
    _inherits(LiteralPrimitive, _Expression15);

    function LiteralPrimitive(value) {
      

      var _this17 = _possibleConstructorReturn(this, _Expression15.call(this));

      _this17.value = value;
      return _this17;
    }

    LiteralPrimitive.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return this.value;
    };

    LiteralPrimitive.prototype.accept = function accept(visitor) {
      return visitor.visitLiteralPrimitive(this);
    };

    LiteralPrimitive.prototype.connect = function connect(binding, scope) {};

    return LiteralPrimitive;
  }(Expression);

  var LiteralString = exports.LiteralString = function (_Expression16) {
    _inherits(LiteralString, _Expression16);

    function LiteralString(value) {
      

      var _this18 = _possibleConstructorReturn(this, _Expression16.call(this));

      _this18.value = value;
      return _this18;
    }

    LiteralString.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return this.value;
    };

    LiteralString.prototype.accept = function accept(visitor) {
      return visitor.visitLiteralString(this);
    };

    LiteralString.prototype.connect = function connect(binding, scope) {};

    return LiteralString;
  }(Expression);

  var LiteralArray = exports.LiteralArray = function (_Expression17) {
    _inherits(LiteralArray, _Expression17);

    function LiteralArray(elements) {
      

      var _this19 = _possibleConstructorReturn(this, _Expression17.call(this));

      _this19.elements = elements;
      return _this19;
    }

    LiteralArray.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var elements = this.elements;
      var result = [];

      for (var _i10 = 0, length = elements.length; _i10 < length; ++_i10) {
        result[_i10] = elements[_i10].evaluate(scope, lookupFunctions);
      }

      return result;
    };

    LiteralArray.prototype.accept = function accept(visitor) {
      return visitor.visitLiteralArray(this);
    };

    LiteralArray.prototype.connect = function connect(binding, scope) {
      var length = this.elements.length;
      for (var _i11 = 0; _i11 < length; _i11++) {
        this.elements[_i11].connect(binding, scope);
      }
    };

    return LiteralArray;
  }(Expression);

  var LiteralObject = exports.LiteralObject = function (_Expression18) {
    _inherits(LiteralObject, _Expression18);

    function LiteralObject(keys, values) {
      

      var _this20 = _possibleConstructorReturn(this, _Expression18.call(this));

      _this20.keys = keys;
      _this20.values = values;
      return _this20;
    }

    LiteralObject.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      var instance = {};
      var keys = this.keys;
      var values = this.values;

      for (var _i12 = 0, length = keys.length; _i12 < length; ++_i12) {
        instance[keys[_i12]] = values[_i12].evaluate(scope, lookupFunctions);
      }

      return instance;
    };

    LiteralObject.prototype.accept = function accept(visitor) {
      return visitor.visitLiteralObject(this);
    };

    LiteralObject.prototype.connect = function connect(binding, scope) {
      var length = this.keys.length;
      for (var _i13 = 0; _i13 < length; _i13++) {
        this.values[_i13].connect(binding, scope);
      }
    };

    return LiteralObject;
  }(Expression);

  var evalListCache = [[], [0], [0, 0], [0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0]];

  function evalList(scope, list, lookupFunctions) {
    var length = list.length;

    for (var cacheLength = evalListCache.length; cacheLength <= length; ++cacheLength) {
      evalListCache.push([]);
    }

    var result = evalListCache[length];

    for (var _i14 = 0; _i14 < length; ++_i14) {
      result[_i14] = list[_i14].evaluate(scope, lookupFunctions);
    }

    return result;
  }

  function autoConvertAdd(a, b) {
    if (a !== null && b !== null) {
      if (typeof a === 'string' && typeof b !== 'string') {
        return a + b.toString();
      }

      if (typeof a !== 'string' && typeof b === 'string') {
        return a.toString() + b;
      }

      return a + b;
    }

    if (a !== null) {
      return a;
    }

    if (b !== null) {
      return b;
    }

    return 0;
  }

  function getFunction(obj, name, mustExist) {
    var func = obj === null || obj === undefined ? null : obj[name];
    if (typeof func === 'function') {
      return func;
    }
    if (!mustExist && (func === null || func === undefined)) {
      return null;
    }
    throw new Error(name + ' is not a function');
  }

  function getKeyed(obj, key) {
    if (Array.isArray(obj)) {
      return obj[parseInt(key, 10)];
    } else if (obj) {
      return obj[key];
    } else if (obj === null || obj === undefined) {
      return undefined;
    }

    return obj[key];
  }

  function setKeyed(obj, key, value) {
    if (Array.isArray(obj)) {
      var index = parseInt(key, 10);

      if (obj.length <= index) {
        obj.length = index + 1;
      }

      obj[index] = value;
    } else {
      obj[key] = value;
    }

    return value;
  }

  var Unparser = exports.Unparser = function () {
    function Unparser(buffer) {
      

      this.buffer = buffer;
    }

    Unparser.unparse = function unparse(expression) {
      var buffer = [];
      var visitor = new Unparser(buffer);

      expression.accept(visitor);

      return buffer.join('');
    };

    Unparser.prototype.write = function write(text) {
      this.buffer.push(text);
    };

    Unparser.prototype.writeArgs = function writeArgs(args) {
      this.write('(');

      for (var _i15 = 0, length = args.length; _i15 < length; ++_i15) {
        if (_i15 !== 0) {
          this.write(',');
        }

        args[_i15].accept(this);
      }

      this.write(')');
    };

    Unparser.prototype.visitChain = function visitChain(chain) {
      var expressions = chain.expressions;

      for (var _i16 = 0, length = expression.length; _i16 < length; ++_i16) {
        if (_i16 !== 0) {
          this.write(';');
        }

        expressions[_i16].accept(this);
      }
    };

    Unparser.prototype.visitBindingBehavior = function visitBindingBehavior(behavior) {
      var args = behavior.args;

      behavior.expression.accept(this);
      this.write('&' + behavior.name);

      for (var _i17 = 0, length = args.length; _i17 < length; ++_i17) {
        this.write(':');
        args[_i17].accept(this);
      }
    };

    Unparser.prototype.visitValueConverter = function visitValueConverter(converter) {
      var args = converter.args;

      converter.expression.accept(this);
      this.write('|' + converter.name);

      for (var _i18 = 0, length = args.length; _i18 < length; ++_i18) {
        this.write(':');
        args[_i18].accept(this);
      }
    };

    Unparser.prototype.visitAssign = function visitAssign(assign) {
      assign.target.accept(this);
      this.write('=');
      assign.value.accept(this);
    };

    Unparser.prototype.visitConditional = function visitConditional(conditional) {
      conditional.condition.accept(this);
      this.write('?');
      conditional.yes.accept(this);
      this.write(':');
      conditional.no.accept(this);
    };

    Unparser.prototype.visitAccessThis = function visitAccessThis(access) {
      if (access.ancestor === 0) {
        this.write('$this');
        return;
      }
      this.write('$parent');
      var i = access.ancestor - 1;
      while (i--) {
        this.write('.$parent');
      }
    };

    Unparser.prototype.visitAccessScope = function visitAccessScope(access) {
      var i = access.ancestor;
      while (i--) {
        this.write('$parent.');
      }
      this.write(access.name);
    };

    Unparser.prototype.visitAccessMember = function visitAccessMember(access) {
      access.object.accept(this);
      this.write('.' + access.name);
    };

    Unparser.prototype.visitAccessKeyed = function visitAccessKeyed(access) {
      access.object.accept(this);
      this.write('[');
      access.key.accept(this);
      this.write(']');
    };

    Unparser.prototype.visitCallScope = function visitCallScope(call) {
      var i = call.ancestor;
      while (i--) {
        this.write('$parent.');
      }
      this.write(call.name);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitCallFunction = function visitCallFunction(call) {
      call.func.accept(this);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitCallMember = function visitCallMember(call) {
      call.object.accept(this);
      this.write('.' + call.name);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitPrefix = function visitPrefix(prefix) {
      this.write('(' + prefix.operation);
      prefix.expression.accept(this);
      this.write(')');
    };

    Unparser.prototype.visitBinary = function visitBinary(binary) {
      binary.left.accept(this);
      this.write(binary.operation);
      binary.right.accept(this);
    };

    Unparser.prototype.visitLiteralPrimitive = function visitLiteralPrimitive(literal) {
      this.write('' + literal.value);
    };

    Unparser.prototype.visitLiteralArray = function visitLiteralArray(literal) {
      var elements = literal.elements;

      this.write('[');

      for (var _i19 = 0, length = elements.length; _i19 < length; ++_i19) {
        if (_i19 !== 0) {
          this.write(',');
        }

        elements[_i19].accept(this);
      }

      this.write(']');
    };

    Unparser.prototype.visitLiteralObject = function visitLiteralObject(literal) {
      var keys = literal.keys;
      var values = literal.values;

      this.write('{');

      for (var _i20 = 0, length = keys.length; _i20 < length; ++_i20) {
        if (_i20 !== 0) {
          this.write(',');
        }

        this.write('\'' + keys[_i20] + '\':');
        values[_i20].accept(this);
      }

      this.write('}');
    };

    Unparser.prototype.visitLiteralString = function visitLiteralString(literal) {
      var escaped = literal.value.replace(/'/g, "\'");
      this.write('\'' + escaped + '\'');
    };

    return Unparser;
  }();

  var ExpressionCloner = exports.ExpressionCloner = function () {
    function ExpressionCloner() {
      
    }

    ExpressionCloner.prototype.cloneExpressionArray = function cloneExpressionArray(array) {
      var clonedArray = [];
      var i = array.length;
      while (i--) {
        clonedArray[i] = array[i].accept(this);
      }
      return clonedArray;
    };

    ExpressionCloner.prototype.visitChain = function visitChain(chain) {
      return new Chain(this.cloneExpressionArray(chain.expressions));
    };

    ExpressionCloner.prototype.visitBindingBehavior = function visitBindingBehavior(behavior) {
      return new BindingBehavior(behavior.expression.accept(this), behavior.name, this.cloneExpressionArray(behavior.args));
    };

    ExpressionCloner.prototype.visitValueConverter = function visitValueConverter(converter) {
      return new ValueConverter(converter.expression.accept(this), converter.name, this.cloneExpressionArray(converter.args));
    };

    ExpressionCloner.prototype.visitAssign = function visitAssign(assign) {
      return new Assign(assign.target.accept(this), assign.value.accept(this));
    };

    ExpressionCloner.prototype.visitConditional = function visitConditional(conditional) {
      return new Conditional(conditional.condition.accept(this), conditional.yes.accept(this), conditional.no.accept(this));
    };

    ExpressionCloner.prototype.visitAccessThis = function visitAccessThis(access) {
      return new AccessThis(access.ancestor);
    };

    ExpressionCloner.prototype.visitAccessScope = function visitAccessScope(access) {
      return new AccessScope(access.name, access.ancestor);
    };

    ExpressionCloner.prototype.visitAccessMember = function visitAccessMember(access) {
      return new AccessMember(access.object.accept(this), access.name);
    };

    ExpressionCloner.prototype.visitAccessKeyed = function visitAccessKeyed(access) {
      return new AccessKeyed(access.object.accept(this), access.key.accept(this));
    };

    ExpressionCloner.prototype.visitCallScope = function visitCallScope(call) {
      return new CallScope(call.name, this.cloneExpressionArray(call.args), call.ancestor);
    };

    ExpressionCloner.prototype.visitCallFunction = function visitCallFunction(call) {
      return new CallFunction(call.func.accept(this), this.cloneExpressionArray(call.args));
    };

    ExpressionCloner.prototype.visitCallMember = function visitCallMember(call) {
      return new CallMember(call.object.accept(this), call.name, this.cloneExpressionArray(call.args));
    };

    ExpressionCloner.prototype.visitPrefix = function visitPrefix(prefix) {
      return new PrefixNot(prefix.operation, prefix.expression.accept(this));
    };

    ExpressionCloner.prototype.visitBinary = function visitBinary(binary) {
      return new Binary(binary.operation, binary.left.accept(this), binary.right.accept(this));
    };

    ExpressionCloner.prototype.visitLiteralPrimitive = function visitLiteralPrimitive(literal) {
      return new LiteralPrimitive(literal);
    };

    ExpressionCloner.prototype.visitLiteralArray = function visitLiteralArray(literal) {
      return new LiteralArray(this.cloneExpressionArray(literal.elements));
    };

    ExpressionCloner.prototype.visitLiteralObject = function visitLiteralObject(literal) {
      return new LiteralObject(literal.keys, this.cloneExpressionArray(literal.values));
    };

    ExpressionCloner.prototype.visitLiteralString = function visitLiteralString(literal) {
      return new LiteralString(literal.value);
    };

    return ExpressionCloner;
  }();

  function cloneExpression(expression) {
    var visitor = new ExpressionCloner();
    return expression.accept(visitor);
  }

  var bindingMode = exports.bindingMode = {
    oneTime: 0,
    oneWay: 1,
    twoWay: 2
  };

  var Token = exports.Token = function () {
    function Token(index, text) {
      

      this.index = index;
      this.text = text;
    }

    Token.prototype.withOp = function withOp(op) {
      this.opKey = op;
      return this;
    };

    Token.prototype.withGetterSetter = function withGetterSetter(key) {
      this.key = key;
      return this;
    };

    Token.prototype.withValue = function withValue(value) {
      this.value = value;
      return this;
    };

    Token.prototype.toString = function toString() {
      return 'Token(' + this.text + ')';
    };

    return Token;
  }();

  var Lexer = exports.Lexer = function () {
    function Lexer() {
      
    }

    Lexer.prototype.lex = function lex(text) {
      var scanner = new Scanner(text);
      var tokens = [];
      var token = scanner.scanToken();

      while (token) {
        tokens.push(token);
        token = scanner.scanToken();
      }

      return tokens;
    };

    return Lexer;
  }();

  var Scanner = exports.Scanner = function () {
    function Scanner(input) {
      

      this.input = input;
      this.length = input.length;
      this.peek = 0;
      this.index = -1;

      this.advance();
    }

    Scanner.prototype.scanToken = function scanToken() {
      while (this.peek <= $SPACE) {
        if (++this.index >= this.length) {
          this.peek = $EOF;
          return null;
        }

        this.peek = this.input.charCodeAt(this.index);
      }

      if (isIdentifierStart(this.peek)) {
        return this.scanIdentifier();
      }

      if (isDigit(this.peek)) {
        return this.scanNumber(this.index);
      }

      var start = this.index;

      switch (this.peek) {
        case $PERIOD:
          this.advance();
          return isDigit(this.peek) ? this.scanNumber(start) : new Token(start, '.');
        case $LPAREN:
        case $RPAREN:
        case $LBRACE:
        case $RBRACE:
        case $LBRACKET:
        case $RBRACKET:
        case $COMMA:
        case $COLON:
        case $SEMICOLON:
          return this.scanCharacter(start, String.fromCharCode(this.peek));
        case $SQ:
        case $DQ:
          return this.scanString();
        case $PLUS:
        case $MINUS:
        case $STAR:
        case $SLASH:
        case $PERCENT:
        case $CARET:
        case $QUESTION:
          return this.scanOperator(start, String.fromCharCode(this.peek));
        case $LT:
        case $GT:
        case $BANG:
        case $EQ:
          return this.scanComplexOperator(start, $EQ, String.fromCharCode(this.peek), '=');
        case $AMPERSAND:
          return this.scanComplexOperator(start, $AMPERSAND, '&', '&');
        case $BAR:
          return this.scanComplexOperator(start, $BAR, '|', '|');
        case $NBSP:
          while (isWhitespace(this.peek)) {
            this.advance();
          }

          return this.scanToken();
      }

      var character = String.fromCharCode(this.peek);
      this.error('Unexpected character [' + character + ']');
      return null;
    };

    Scanner.prototype.scanCharacter = function scanCharacter(start, text) {
      assert(this.peek === text.charCodeAt(0));
      this.advance();
      return new Token(start, text);
    };

    Scanner.prototype.scanOperator = function scanOperator(start, text) {
      assert(this.peek === text.charCodeAt(0));
      assert(OPERATORS.indexOf(text) !== -1);
      this.advance();
      return new Token(start, text).withOp(text);
    };

    Scanner.prototype.scanComplexOperator = function scanComplexOperator(start, code, one, two) {
      assert(this.peek === one.charCodeAt(0));
      this.advance();

      var text = one;

      if (this.peek === code) {
        this.advance();
        text += two;
      }

      if (this.peek === code) {
        this.advance();
        text += two;
      }

      assert(OPERATORS.indexOf(text) !== -1);

      return new Token(start, text).withOp(text);
    };

    Scanner.prototype.scanIdentifier = function scanIdentifier() {
      assert(isIdentifierStart(this.peek));
      var start = this.index;

      this.advance();

      while (isIdentifierPart(this.peek)) {
        this.advance();
      }

      var text = this.input.substring(start, this.index);
      var result = new Token(start, text);

      if (OPERATORS.indexOf(text) !== -1) {
        result.withOp(text);
      } else {
        result.withGetterSetter(text);
      }

      return result;
    };

    Scanner.prototype.scanNumber = function scanNumber(start) {
      assert(isDigit(this.peek));
      var simple = this.index === start;
      this.advance();

      while (true) {
        if (!isDigit(this.peek)) {
          if (this.peek === $PERIOD) {
            simple = false;
          } else if (isExponentStart(this.peek)) {
            this.advance();

            if (isExponentSign(this.peek)) {
              this.advance();
            }

            if (!isDigit(this.peek)) {
              this.error('Invalid exponent', -1);
            }

            simple = false;
          } else {
            break;
          }
        }

        this.advance();
      }

      var text = this.input.substring(start, this.index);
      var value = simple ? parseInt(text, 10) : parseFloat(text);
      return new Token(start, text).withValue(value);
    };

    Scanner.prototype.scanString = function scanString() {
      assert(this.peek === $SQ || this.peek === $DQ);

      var start = this.index;
      var quote = this.peek;

      this.advance();

      var buffer = void 0;
      var marker = this.index;

      while (this.peek !== quote) {
        if (this.peek === $BACKSLASH) {
          if (!buffer) {
            buffer = [];
          }

          buffer.push(this.input.substring(marker, this.index));
          this.advance();

          var _unescaped = void 0;

          if (this.peek === $u) {
            var hex = this.input.substring(this.index + 1, this.index + 5);

            if (!/[A-Z0-9]{4}/.test(hex)) {
              this.error('Invalid unicode escape [\\u' + hex + ']');
            }

            _unescaped = parseInt(hex, 16);

            for (var _i21 = 0; _i21 < 5; ++_i21) {
              this.advance();
            }
          } else {
            _unescaped = unescape(this.peek);
            this.advance();
          }

          buffer.push(String.fromCharCode(_unescaped));
          marker = this.index;
        } else if (this.peek === $EOF) {
          this.error('Unterminated quote');
        } else {
          this.advance();
        }
      }

      var last = this.input.substring(marker, this.index);
      this.advance();
      var text = this.input.substring(start, this.index);

      var unescaped = last;

      if (buffer !== null && buffer !== undefined) {
        buffer.push(last);
        unescaped = buffer.join('');
      }

      return new Token(start, text).withValue(unescaped);
    };

    Scanner.prototype.advance = function advance() {
      if (++this.index >= this.length) {
        this.peek = $EOF;
      } else {
        this.peek = this.input.charCodeAt(this.index);
      }
    };

    Scanner.prototype.error = function error(message) {
      var offset = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var position = this.index + offset;
      throw new Error('Lexer Error: ' + message + ' at column ' + position + ' in expression [' + this.input + ']');
    };

    return Scanner;
  }();

  var OPERATORS = ['undefined', 'null', 'true', 'false', '+', '-', '*', '/', '%', '^', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '&', '|', '!', '?'];

  var $EOF = 0;
  var $TAB = 9;
  var $LF = 10;
  var $VTAB = 11;
  var $FF = 12;
  var $CR = 13;
  var $SPACE = 32;
  var $BANG = 33;
  var $DQ = 34;
  var $$ = 36;
  var $PERCENT = 37;
  var $AMPERSAND = 38;
  var $SQ = 39;
  var $LPAREN = 40;
  var $RPAREN = 41;
  var $STAR = 42;
  var $PLUS = 43;
  var $COMMA = 44;
  var $MINUS = 45;
  var $PERIOD = 46;
  var $SLASH = 47;
  var $COLON = 58;
  var $SEMICOLON = 59;
  var $LT = 60;
  var $EQ = 61;
  var $GT = 62;
  var $QUESTION = 63;

  var $0 = 48;
  var $9 = 57;

  var $A = 65;
  var $E = 69;
  var $Z = 90;

  var $LBRACKET = 91;
  var $BACKSLASH = 92;
  var $RBRACKET = 93;
  var $CARET = 94;
  var $_ = 95;

  var $a = 97;
  var $e = 101;
  var $f = 102;
  var $n = 110;
  var $r = 114;
  var $t = 116;
  var $u = 117;
  var $v = 118;
  var $z = 122;

  var $LBRACE = 123;
  var $BAR = 124;
  var $RBRACE = 125;
  var $NBSP = 160;

  function isWhitespace(code) {
    return code >= $TAB && code <= $SPACE || code === $NBSP;
  }

  function isIdentifierStart(code) {
    return $a <= code && code <= $z || $A <= code && code <= $Z || code === $_ || code === $$;
  }

  function isIdentifierPart(code) {
    return $a <= code && code <= $z || $A <= code && code <= $Z || $0 <= code && code <= $9 || code === $_ || code === $$;
  }

  function isDigit(code) {
    return $0 <= code && code <= $9;
  }

  function isExponentStart(code) {
    return code === $e || code === $E;
  }

  function isExponentSign(code) {
    return code === $MINUS || code === $PLUS;
  }

  function unescape(code) {
    switch (code) {
      case $n:
        return $LF;
      case $f:
        return $FF;
      case $r:
        return $CR;
      case $t:
        return $TAB;
      case $v:
        return $VTAB;
      default:
        return code;
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw message || 'Assertion failed';
    }
  }

  var EOF = new Token(-1, null);

  var Parser = exports.Parser = function () {
    function Parser() {
      

      this.cache = {};
      this.lexer = new Lexer();
    }

    Parser.prototype.parse = function parse(input) {
      input = input || '';

      return this.cache[input] || (this.cache[input] = new ParserImplementation(this.lexer, input).parseChain());
    };

    return Parser;
  }();

  var ParserImplementation = exports.ParserImplementation = function () {
    function ParserImplementation(lexer, input) {
      

      this.index = 0;
      this.input = input;
      this.tokens = lexer.lex(input);
    }

    ParserImplementation.prototype.parseChain = function parseChain() {
      var isChain = false;
      var expressions = [];

      while (this.optional(';')) {
        isChain = true;
      }

      while (this.index < this.tokens.length) {
        if (this.peek.text === ')' || this.peek.text === '}' || this.peek.text === ']') {
          this.error('Unconsumed token ' + this.peek.text);
        }

        var expr = this.parseBindingBehavior();
        expressions.push(expr);

        while (this.optional(';')) {
          isChain = true;
        }

        if (isChain) {
          this.error('Multiple expressions are not allowed.');
        }
      }

      return expressions.length === 1 ? expressions[0] : new Chain(expressions);
    };

    ParserImplementation.prototype.parseBindingBehavior = function parseBindingBehavior() {
      var result = this.parseValueConverter();

      while (this.optional('&')) {
        var name = this.peek.text;
        var args = [];

        this.advance();

        while (this.optional(':')) {
          args.push(this.parseExpression());
        }

        result = new BindingBehavior(result, name, args);
      }

      return result;
    };

    ParserImplementation.prototype.parseValueConverter = function parseValueConverter() {
      var result = this.parseExpression();

      while (this.optional('|')) {
        var name = this.peek.text;
        var args = [];

        this.advance();

        while (this.optional(':')) {
          args.push(this.parseExpression());
        }

        result = new ValueConverter(result, name, args, [result].concat(args));
      }

      return result;
    };

    ParserImplementation.prototype.parseExpression = function parseExpression() {
      var start = this.peek.index;
      var result = this.parseConditional();

      while (this.peek.text === '=') {
        if (!result.isAssignable) {
          var end = this.index < this.tokens.length ? this.peek.index : this.input.length;
          var _expression = this.input.substring(start, end);

          this.error('Expression ' + _expression + ' is not assignable');
        }

        this.expect('=');
        result = new Assign(result, this.parseConditional());
      }

      return result;
    };

    ParserImplementation.prototype.parseConditional = function parseConditional() {
      var start = this.peek.index;
      var result = this.parseLogicalOr();

      if (this.optional('?')) {
        var yes = this.parseExpression();

        if (!this.optional(':')) {
          var end = this.index < this.tokens.length ? this.peek.index : this.input.length;
          var _expression2 = this.input.substring(start, end);

          this.error('Conditional expression ' + _expression2 + ' requires all 3 expressions');
        }

        var no = this.parseExpression();
        result = new Conditional(result, yes, no);
      }

      return result;
    };

    ParserImplementation.prototype.parseLogicalOr = function parseLogicalOr() {
      var result = this.parseLogicalAnd();

      while (this.optional('||')) {
        result = new Binary('||', result, this.parseLogicalAnd());
      }

      return result;
    };

    ParserImplementation.prototype.parseLogicalAnd = function parseLogicalAnd() {
      var result = this.parseEquality();

      while (this.optional('&&')) {
        result = new Binary('&&', result, this.parseEquality());
      }

      return result;
    };

    ParserImplementation.prototype.parseEquality = function parseEquality() {
      var result = this.parseRelational();

      while (true) {
        if (this.optional('==')) {
          result = new Binary('==', result, this.parseRelational());
        } else if (this.optional('!=')) {
          result = new Binary('!=', result, this.parseRelational());
        } else if (this.optional('===')) {
          result = new Binary('===', result, this.parseRelational());
        } else if (this.optional('!==')) {
          result = new Binary('!==', result, this.parseRelational());
        } else {
          return result;
        }
      }
    };

    ParserImplementation.prototype.parseRelational = function parseRelational() {
      var result = this.parseAdditive();

      while (true) {
        if (this.optional('<')) {
          result = new Binary('<', result, this.parseAdditive());
        } else if (this.optional('>')) {
          result = new Binary('>', result, this.parseAdditive());
        } else if (this.optional('<=')) {
          result = new Binary('<=', result, this.parseAdditive());
        } else if (this.optional('>=')) {
          result = new Binary('>=', result, this.parseAdditive());
        } else {
          return result;
        }
      }
    };

    ParserImplementation.prototype.parseAdditive = function parseAdditive() {
      var result = this.parseMultiplicative();

      while (true) {
        if (this.optional('+')) {
          result = new Binary('+', result, this.parseMultiplicative());
        } else if (this.optional('-')) {
          result = new Binary('-', result, this.parseMultiplicative());
        } else {
          return result;
        }
      }
    };

    ParserImplementation.prototype.parseMultiplicative = function parseMultiplicative() {
      var result = this.parsePrefix();

      while (true) {
        if (this.optional('*')) {
          result = new Binary('*', result, this.parsePrefix());
        } else if (this.optional('%')) {
          result = new Binary('%', result, this.parsePrefix());
        } else if (this.optional('/')) {
          result = new Binary('/', result, this.parsePrefix());
        } else {
          return result;
        }
      }
    };

    ParserImplementation.prototype.parsePrefix = function parsePrefix() {
      if (this.optional('+')) {
        return this.parsePrefix();
      } else if (this.optional('-')) {
          return new Binary('-', new LiteralPrimitive(0), this.parsePrefix());
        } else if (this.optional('!')) {
          return new PrefixNot('!', this.parsePrefix());
        }

      return this.parseAccessOrCallMember();
    };

    ParserImplementation.prototype.parseAccessOrCallMember = function parseAccessOrCallMember() {
      var result = this.parsePrimary();

      while (true) {
        if (this.optional('.')) {
          var name = this.peek.text;

          this.advance();

          if (this.optional('(')) {
            var args = this.parseExpressionList(')');
            this.expect(')');
            if (result instanceof AccessThis) {
              result = new CallScope(name, args, result.ancestor);
            } else {
              result = new CallMember(result, name, args);
            }
          } else {
            if (result instanceof AccessThis) {
              result = new AccessScope(name, result.ancestor);
            } else {
              result = new AccessMember(result, name);
            }
          }
        } else if (this.optional('[')) {
          var key = this.parseExpression();
          this.expect(']');
          result = new AccessKeyed(result, key);
        } else if (this.optional('(')) {
          var _args = this.parseExpressionList(')');
          this.expect(')');
          result = new CallFunction(result, _args);
        } else {
          return result;
        }
      }
    };

    ParserImplementation.prototype.parsePrimary = function parsePrimary() {
      if (this.optional('(')) {
        var result = this.parseExpression();
        this.expect(')');
        return result;
      } else if (this.optional('null')) {
        return new LiteralPrimitive(null);
      } else if (this.optional('undefined')) {
        return new LiteralPrimitive(undefined);
      } else if (this.optional('true')) {
        return new LiteralPrimitive(true);
      } else if (this.optional('false')) {
        return new LiteralPrimitive(false);
      } else if (this.optional('[')) {
        var elements = this.parseExpressionList(']');
        this.expect(']');
        return new LiteralArray(elements);
      } else if (this.peek.text === '{') {
        return this.parseObject();
      } else if (this.peek.key !== null && this.peek.key !== undefined) {
        return this.parseAccessOrCallScope();
      } else if (this.peek.value !== null && this.peek.value !== undefined) {
        var value = this.peek.value;
        this.advance();
        return value instanceof String || typeof value === 'string' ? new LiteralString(value) : new LiteralPrimitive(value);
      } else if (this.index >= this.tokens.length) {
        throw new Error('Unexpected end of expression: ' + this.input);
      } else {
        this.error('Unexpected token ' + this.peek.text);
      }
    };

    ParserImplementation.prototype.parseAccessOrCallScope = function parseAccessOrCallScope() {
      var name = this.peek.key;

      this.advance();

      if (name === '$this') {
        return new AccessThis(0);
      }

      var ancestor = 0;
      while (name === '$parent') {
        ancestor++;
        if (this.optional('.')) {
          name = this.peek.key;
          this.advance();
        } else if (this.peek === EOF || this.peek.text === '(' || this.peek.text === '[' || this.peek.text === '}') {
          return new AccessThis(ancestor);
        } else {
          this.error('Unexpected token ' + this.peek.text);
        }
      }

      if (this.optional('(')) {
        var args = this.parseExpressionList(')');
        this.expect(')');
        return new CallScope(name, args, ancestor);
      }

      return new AccessScope(name, ancestor);
    };

    ParserImplementation.prototype.parseObject = function parseObject() {
      var keys = [];
      var values = [];

      this.expect('{');

      if (this.peek.text !== '}') {
        do {
          var peek = this.peek;
          var value = peek.value;
          keys.push(typeof value === 'string' ? value : peek.text);

          this.advance();
          if (peek.key && (this.peek.text === ',' || this.peek.text === '}')) {
            --this.index;
            values.push(this.parseAccessOrCallScope());
          } else {
            this.expect(':');
            values.push(this.parseExpression());
          }
        } while (this.optional(','));
      }

      this.expect('}');

      return new LiteralObject(keys, values);
    };

    ParserImplementation.prototype.parseExpressionList = function parseExpressionList(terminator) {
      var result = [];

      if (this.peek.text !== terminator) {
        do {
          result.push(this.parseExpression());
        } while (this.optional(','));
      }

      return result;
    };

    ParserImplementation.prototype.optional = function optional(text) {
      if (this.peek.text === text) {
        this.advance();
        return true;
      }

      return false;
    };

    ParserImplementation.prototype.expect = function expect(text) {
      if (this.peek.text === text) {
        this.advance();
      } else {
        this.error('Missing expected ' + text);
      }
    };

    ParserImplementation.prototype.advance = function advance() {
      this.index++;
    };

    ParserImplementation.prototype.error = function error(message) {
      var location = this.index < this.tokens.length ? 'at column ' + (this.tokens[this.index].index + 1) + ' in' : 'at the end of the expression';

      throw new Error('Parser Error: ' + message + ' ' + location + ' [' + this.input + ']');
    };

    _createClass(ParserImplementation, [{
      key: 'peek',
      get: function get() {
        return this.index < this.tokens.length ? this.tokens[this.index] : EOF;
      }
    }]);

    return ParserImplementation;
  }();

  var mapProto = Map.prototype;

  function _getMapObserver(taskQueue, map) {
    return ModifyMapObserver.for(taskQueue, map);
  }

  exports.getMapObserver = _getMapObserver;

  var ModifyMapObserver = function (_ModifyCollectionObse2) {
    _inherits(ModifyMapObserver, _ModifyCollectionObse2);

    function ModifyMapObserver(taskQueue, map) {
      

      return _possibleConstructorReturn(this, _ModifyCollectionObse2.call(this, taskQueue, map));
    }

    ModifyMapObserver.for = function _for(taskQueue, map) {
      if (!('__map_observer__' in map)) {
        Reflect.defineProperty(map, '__map_observer__', {
          value: ModifyMapObserver.create(taskQueue, map),
          enumerable: false, configurable: false
        });
      }
      return map.__map_observer__;
    };

    ModifyMapObserver.create = function create(taskQueue, map) {
      var observer = new ModifyMapObserver(taskQueue, map);

      var proto = mapProto;
      if (proto.add !== map.add || proto.delete !== map.delete || proto.clear !== map.clear) {
        proto = {
          add: map.add,
          delete: map.delete,
          clear: map.clear
        };
      }

      map.set = function () {
        var hasValue = map.has(arguments[0]);
        var type = hasValue ? 'update' : 'add';
        var oldValue = map.get(arguments[0]);
        var methodCallResult = proto.set.apply(map, arguments);
        if (!hasValue || oldValue !== map.get(arguments[0])) {
          observer.addChangeRecord({
            type: type,
            object: map,
            key: arguments[0],
            oldValue: oldValue
          });
        }
        return methodCallResult;
      };

      map.delete = function () {
        var hasValue = map.has(arguments[0]);
        var oldValue = map.get(arguments[0]);
        var methodCallResult = proto.delete.apply(map, arguments);
        if (hasValue) {
          observer.addChangeRecord({
            type: 'delete',
            object: map,
            key: arguments[0],
            oldValue: oldValue
          });
        }
        return methodCallResult;
      };

      map.clear = function () {
        var methodCallResult = proto.clear.apply(map, arguments);
        observer.addChangeRecord({
          type: 'clear',
          object: map
        });
        return methodCallResult;
      };

      return observer;
    };

    return ModifyMapObserver;
  }(ModifyCollectionObserver);

  function findOriginalEventTarget(event) {
    return event.path && event.path[0] || event.deepPath && event.deepPath[0] || event.target;
  }

  function interceptStopPropagation(event) {
    event.standardStopPropagation = event.stopPropagation;
    event.stopPropagation = function () {
      this.propagationStopped = true;
      this.standardStopPropagation();
    };
  }

  function handleDelegatedEvent(event) {
    var interceptInstalled = false;
    event.propagationStopped = false;
    var target = findOriginalEventTarget(event);

    while (target && !event.propagationStopped) {
      if (target.delegatedCallbacks) {
        var callback = target.delegatedCallbacks[event.type];
        if (callback) {
          if (!interceptInstalled) {
            interceptStopPropagation(event);
            interceptInstalled = true;
          }
          callback(event);
        }
      }

      target = target.parentNode;
    }
  }

  var DelegateHandlerEntry = function () {
    function DelegateHandlerEntry(eventName) {
      

      this.eventName = eventName;
      this.count = 0;
    }

    DelegateHandlerEntry.prototype.increment = function increment() {
      this.count++;

      if (this.count === 1) {
        _aureliaPal.DOM.addEventListener(this.eventName, handleDelegatedEvent, false);
      }
    };

    DelegateHandlerEntry.prototype.decrement = function decrement() {
      this.count--;

      if (this.count === 0) {
        _aureliaPal.DOM.removeEventListener(this.eventName, handleDelegatedEvent);
      }
    };

    return DelegateHandlerEntry;
  }();

  var DefaultEventStrategy = function () {
    function DefaultEventStrategy() {
      

      this.delegatedHandlers = {};
    }

    DefaultEventStrategy.prototype.subscribe = function subscribe(target, targetEvent, callback, delegate) {
      var _this22 = this;

      if (delegate) {
        var _ret = function () {
          var delegatedHandlers = _this22.delegatedHandlers;
          var handlerEntry = delegatedHandlers[targetEvent] || (delegatedHandlers[targetEvent] = new DelegateHandlerEntry(targetEvent));
          var delegatedCallbacks = target.delegatedCallbacks || (target.delegatedCallbacks = {});

          handlerEntry.increment();
          delegatedCallbacks[targetEvent] = callback;

          return {
            v: function v() {
              handlerEntry.decrement();
              delegatedCallbacks[targetEvent] = null;
            }
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }

      target.addEventListener(targetEvent, callback, false);

      return function () {
        target.removeEventListener(targetEvent, callback);
      };
    };

    return DefaultEventStrategy;
  }();

  var EventManager = exports.EventManager = function () {
    function EventManager() {
      

      this.elementHandlerLookup = {};
      this.eventStrategyLookup = {};

      this.registerElementConfig({
        tagName: 'input',
        properties: {
          value: ['change', 'input'],
          checked: ['change', 'input'],
          files: ['change', 'input']
        }
      });

      this.registerElementConfig({
        tagName: 'textarea',
        properties: {
          value: ['change', 'input']
        }
      });

      this.registerElementConfig({
        tagName: 'select',
        properties: {
          value: ['change']
        }
      });

      this.registerElementConfig({
        tagName: 'content editable',
        properties: {
          value: ['change', 'input', 'blur', 'keyup', 'paste']
        }
      });

      this.registerElementConfig({
        tagName: 'scrollable element',
        properties: {
          scrollTop: ['scroll'],
          scrollLeft: ['scroll']
        }
      });

      this.defaultEventStrategy = new DefaultEventStrategy();
    }

    EventManager.prototype.registerElementConfig = function registerElementConfig(config) {
      var tagName = config.tagName.toLowerCase();
      var properties = config.properties;
      var propertyName = void 0;

      this.elementHandlerLookup[tagName] = {};

      for (propertyName in properties) {
        if (properties.hasOwnProperty(propertyName)) {
          this.registerElementPropertyConfig(tagName, propertyName, properties[propertyName]);
        }
      }
    };

    EventManager.prototype.registerElementPropertyConfig = function registerElementPropertyConfig(tagName, propertyName, events) {
      this.elementHandlerLookup[tagName][propertyName] = this.createElementHandler(events);
    };

    EventManager.prototype.createElementHandler = function createElementHandler(events) {
      return {
        subscribe: function subscribe(target, callback) {
          events.forEach(function (changeEvent) {
            target.addEventListener(changeEvent, callback, false);
          });

          return function () {
            events.forEach(function (changeEvent) {
              target.removeEventListener(changeEvent, callback);
            });
          };
        }
      };
    };

    EventManager.prototype.registerElementHandler = function registerElementHandler(tagName, handler) {
      this.elementHandlerLookup[tagName.toLowerCase()] = handler;
    };

    EventManager.prototype.registerEventStrategy = function registerEventStrategy(eventName, strategy) {
      this.eventStrategyLookup[eventName] = strategy;
    };

    EventManager.prototype.getElementHandler = function getElementHandler(target, propertyName) {
      var tagName = void 0;
      var lookup = this.elementHandlerLookup;

      if (target.tagName) {
        tagName = target.tagName.toLowerCase();

        if (lookup[tagName] && lookup[tagName][propertyName]) {
          return lookup[tagName][propertyName];
        }

        if (propertyName === 'textContent' || propertyName === 'innerHTML') {
          return lookup['content editable'].value;
        }

        if (propertyName === 'scrollTop' || propertyName === 'scrollLeft') {
          return lookup['scrollable element'][propertyName];
        }
      }

      return null;
    };

    EventManager.prototype.addEventListener = function addEventListener(target, targetEvent, callback, delegate) {
      return (this.eventStrategyLookup[targetEvent] || this.defaultEventStrategy).subscribe(target, targetEvent, callback, delegate);
    };

    return EventManager;
  }();

  var DirtyChecker = exports.DirtyChecker = function () {
    function DirtyChecker() {
      

      this.tracked = [];
      this.checkDelay = 120;
    }

    DirtyChecker.prototype.addProperty = function addProperty(property) {
      var tracked = this.tracked;

      tracked.push(property);

      if (tracked.length === 1) {
        this.scheduleDirtyCheck();
      }
    };

    DirtyChecker.prototype.removeProperty = function removeProperty(property) {
      var tracked = this.tracked;
      tracked.splice(tracked.indexOf(property), 1);
    };

    DirtyChecker.prototype.scheduleDirtyCheck = function scheduleDirtyCheck() {
      var _this23 = this;

      setTimeout(function () {
        return _this23.check();
      }, this.checkDelay);
    };

    DirtyChecker.prototype.check = function check() {
      var tracked = this.tracked;
      var i = tracked.length;

      while (i--) {
        var current = tracked[i];

        if (current.isDirty()) {
          current.call();
        }
      }

      if (tracked.length) {
        this.scheduleDirtyCheck();
      }
    };

    return DirtyChecker;
  }();

  var DirtyCheckProperty = exports.DirtyCheckProperty = (_dec5 = subscriberCollection(), _dec5(_class5 = function () {
    function DirtyCheckProperty(dirtyChecker, obj, propertyName) {
      

      this.dirtyChecker = dirtyChecker;
      this.obj = obj;
      this.propertyName = propertyName;
    }

    DirtyCheckProperty.prototype.getValue = function getValue() {
      return this.obj[this.propertyName];
    };

    DirtyCheckProperty.prototype.setValue = function setValue(newValue) {
      this.obj[this.propertyName] = newValue;
    };

    DirtyCheckProperty.prototype.call = function call() {
      var oldValue = this.oldValue;
      var newValue = this.getValue();

      this.callSubscribers(newValue, oldValue);

      this.oldValue = newValue;
    };

    DirtyCheckProperty.prototype.isDirty = function isDirty() {
      return this.oldValue !== this.obj[this.propertyName];
    };

    DirtyCheckProperty.prototype.subscribe = function subscribe(context, callable) {
      if (!this.hasSubscribers()) {
        this.oldValue = this.getValue();
        this.dirtyChecker.addProperty(this);
      }
      this.addSubscriber(context, callable);
    };

    DirtyCheckProperty.prototype.unsubscribe = function unsubscribe(context, callable) {
      if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
        this.dirtyChecker.removeProperty(this);
      }
    };

    return DirtyCheckProperty;
  }()) || _class5);


  var logger = LogManager.getLogger('property-observation');

  var propertyAccessor = exports.propertyAccessor = {
    getValue: function getValue(obj, propertyName) {
      return obj[propertyName];
    },
    setValue: function setValue(value, obj, propertyName) {
      obj[propertyName] = value;
    }
  };

  var PrimitiveObserver = exports.PrimitiveObserver = function () {
    function PrimitiveObserver(primitive, propertyName) {
      

      this.doNotCache = true;

      this.primitive = primitive;
      this.propertyName = propertyName;
    }

    PrimitiveObserver.prototype.getValue = function getValue() {
      return this.primitive[this.propertyName];
    };

    PrimitiveObserver.prototype.setValue = function setValue() {
      var type = _typeof(this.primitive);
      throw new Error('The ' + this.propertyName + ' property of a ' + type + ' (' + this.primitive + ') cannot be assigned.');
    };

    PrimitiveObserver.prototype.subscribe = function subscribe() {};

    PrimitiveObserver.prototype.unsubscribe = function unsubscribe() {};

    return PrimitiveObserver;
  }();

  var SetterObserver = exports.SetterObserver = (_dec6 = subscriberCollection(), _dec6(_class7 = function () {
    function SetterObserver(taskQueue, obj, propertyName) {
      

      this.taskQueue = taskQueue;
      this.obj = obj;
      this.propertyName = propertyName;
      this.queued = false;
      this.observing = false;
    }

    SetterObserver.prototype.getValue = function getValue() {
      return this.obj[this.propertyName];
    };

    SetterObserver.prototype.setValue = function setValue(newValue) {
      this.obj[this.propertyName] = newValue;
    };

    SetterObserver.prototype.getterValue = function getterValue() {
      return this.currentValue;
    };

    SetterObserver.prototype.setterValue = function setterValue(newValue) {
      var oldValue = this.currentValue;

      if (oldValue !== newValue) {
        if (!this.queued) {
          this.oldValue = oldValue;
          this.queued = true;
          this.taskQueue.queueMicroTask(this);
        }

        this.currentValue = newValue;
      }
    };

    SetterObserver.prototype.call = function call() {
      var oldValue = this.oldValue;
      var newValue = this.currentValue;

      this.queued = false;

      this.callSubscribers(newValue, oldValue);
    };

    SetterObserver.prototype.subscribe = function subscribe(context, callable) {
      if (!this.observing) {
        this.convertProperty();
      }
      this.addSubscriber(context, callable);
    };

    SetterObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      this.removeSubscriber(context, callable);
    };

    SetterObserver.prototype.convertProperty = function convertProperty() {
      this.observing = true;
      this.currentValue = this.obj[this.propertyName];
      this.setValue = this.setterValue;
      this.getValue = this.getterValue;

      if (!Reflect.defineProperty(this.obj, this.propertyName, {
        configurable: true,
        enumerable: this.propertyName in this.obj ? this.obj.propertyIsEnumerable(this.propertyName) : true,
        get: this.getValue.bind(this),
        set: this.setValue.bind(this)
      })) {
        logger.warn('Cannot observe property \'' + this.propertyName + '\' of object', this.obj);
      }
    };

    return SetterObserver;
  }()) || _class7);

  var XLinkAttributeObserver = exports.XLinkAttributeObserver = function () {
    function XLinkAttributeObserver(element, propertyName, attributeName) {
      

      this.element = element;
      this.propertyName = propertyName;
      this.attributeName = attributeName;
    }

    XLinkAttributeObserver.prototype.getValue = function getValue() {
      return this.element.getAttributeNS('http://www.w3.org/1999/xlink', this.attributeName);
    };

    XLinkAttributeObserver.prototype.setValue = function setValue(newValue) {
      return this.element.setAttributeNS('http://www.w3.org/1999/xlink', this.attributeName, newValue);
    };

    XLinkAttributeObserver.prototype.subscribe = function subscribe() {
      throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
    };

    return XLinkAttributeObserver;
  }();

  var dataAttributeAccessor = exports.dataAttributeAccessor = {
    getValue: function getValue(obj, propertyName) {
      return obj.getAttribute(propertyName);
    },
    setValue: function setValue(value, obj, propertyName) {
      return obj.setAttribute(propertyName, value);
    }
  };

  var DataAttributeObserver = exports.DataAttributeObserver = function () {
    function DataAttributeObserver(element, propertyName) {
      

      this.element = element;
      this.propertyName = propertyName;
    }

    DataAttributeObserver.prototype.getValue = function getValue() {
      return this.element.getAttribute(this.propertyName);
    };

    DataAttributeObserver.prototype.setValue = function setValue(newValue) {
      return this.element.setAttribute(this.propertyName, newValue);
    };

    DataAttributeObserver.prototype.subscribe = function subscribe() {
      throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
    };

    return DataAttributeObserver;
  }();

  var StyleObserver = exports.StyleObserver = function () {
    function StyleObserver(element, propertyName) {
      

      this.element = element;
      this.propertyName = propertyName;

      this.styles = null;
      this.version = 0;
    }

    StyleObserver.prototype.getValue = function getValue() {
      return this.element.style.cssText;
    };

    StyleObserver.prototype.setValue = function setValue(newValue) {
      var styles = this.styles || {};
      var style = void 0;
      var version = this.version;

      if (newValue !== null && newValue !== undefined) {
        if (newValue instanceof Object) {
          for (style in newValue) {
            if (newValue.hasOwnProperty(style)) {
              styles[style] = version;
              this.element.style[style] = newValue[style];
            }
          }
        } else if (newValue.length) {
          var pairs = newValue.split(/(?:;|:(?!\/))\s*/);
          for (var _i22 = 0, length = pairs.length; _i22 < length; _i22++) {
            style = pairs[_i22].trim();
            if (!style) {
              continue;
            }

            styles[style] = version;

            this.element.style[style] = pairs[++_i22];
          }
        }
      }

      this.styles = styles;
      this.version += 1;

      if (version === 0) {
        return;
      }

      version -= 1;
      for (style in styles) {
        if (!styles.hasOwnProperty(style) || styles[style] !== version) {
          continue;
        }

        this.element.style[style] = '';
      }
    };

    StyleObserver.prototype.subscribe = function subscribe() {
      throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
    };

    return StyleObserver;
  }();

  var ValueAttributeObserver = exports.ValueAttributeObserver = (_dec7 = subscriberCollection(), _dec7(_class8 = function () {
    function ValueAttributeObserver(element, propertyName, handler) {
      

      this.element = element;
      this.propertyName = propertyName;
      this.handler = handler;
      if (propertyName === 'files') {
        this.setValue = function () {};
      }
    }

    ValueAttributeObserver.prototype.getValue = function getValue() {
      return this.element[this.propertyName];
    };

    ValueAttributeObserver.prototype.setValue = function setValue(newValue) {
      newValue = newValue === undefined || newValue === null ? '' : newValue;
      if (this.element[this.propertyName] !== newValue) {
        this.element[this.propertyName] = newValue;
        this.notify();
      }
    };

    ValueAttributeObserver.prototype.notify = function notify() {
      var oldValue = this.oldValue;
      var newValue = this.getValue();

      this.callSubscribers(newValue, oldValue);

      this.oldValue = newValue;
    };

    ValueAttributeObserver.prototype.subscribe = function subscribe(context, callable) {
      if (!this.hasSubscribers()) {
        this.oldValue = this.getValue();
        this.disposeHandler = this.handler.subscribe(this.element, this.notify.bind(this));
      }

      this.addSubscriber(context, callable);
    };

    ValueAttributeObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
        this.disposeHandler();
        this.disposeHandler = null;
      }
    };

    return ValueAttributeObserver;
  }()) || _class8);


  var checkedArrayContext = 'CheckedObserver:array';
  var checkedValueContext = 'CheckedObserver:value';

  var CheckedObserver = exports.CheckedObserver = (_dec8 = subscriberCollection(), _dec8(_class9 = function () {
    function CheckedObserver(element, handler, observerLocator) {
      

      this.element = element;
      this.handler = handler;
      this.observerLocator = observerLocator;
    }

    CheckedObserver.prototype.getValue = function getValue() {
      return this.value;
    };

    CheckedObserver.prototype.setValue = function setValue(newValue) {
      if (this.value === newValue) {
        return;
      }

      if (this.arrayObserver) {
        this.arrayObserver.unsubscribe(checkedArrayContext, this);
        this.arrayObserver = null;
      }

      if (this.element.type === 'checkbox' && Array.isArray(newValue)) {
        this.arrayObserver = this.observerLocator.getArrayObserver(newValue);
        this.arrayObserver.subscribe(checkedArrayContext, this);
      }

      this.oldValue = this.value;
      this.value = newValue;
      this.synchronizeElement();
      this.notify();

      if (!this.initialSync) {
        this.initialSync = true;
        this.observerLocator.taskQueue.queueMicroTask(this);
      }
    };

    CheckedObserver.prototype.call = function call(context, splices) {
      this.synchronizeElement();

      if (!this.valueObserver) {
        this.valueObserver = this.element.__observers__.model || this.element.__observers__.value;
        if (this.valueObserver) {
          this.valueObserver.subscribe(checkedValueContext, this);
        }
      }
    };

    CheckedObserver.prototype.synchronizeElement = function synchronizeElement() {
      var value = this.value;
      var element = this.element;
      var elementValue = element.hasOwnProperty('model') ? element.model : element.value;
      var isRadio = element.type === 'radio';
      var matcher = element.matcher || function (a, b) {
        return a === b;
      };

      element.checked = isRadio && !!matcher(value, elementValue) || !isRadio && value === true || !isRadio && Array.isArray(value) && value.findIndex(function (item) {
        return !!matcher(item, elementValue);
      }) !== -1;
    };

    CheckedObserver.prototype.synchronizeValue = function synchronizeValue() {
      var value = this.value;
      var element = this.element;
      var elementValue = element.hasOwnProperty('model') ? element.model : element.value;
      var index = void 0;
      var matcher = element.matcher || function (a, b) {
        return a === b;
      };

      if (element.type === 'checkbox') {
        if (Array.isArray(value)) {
          index = value.findIndex(function (item) {
            return !!matcher(item, elementValue);
          });
          if (element.checked && index === -1) {
            value.push(elementValue);
          } else if (!element.checked && index !== -1) {
            value.splice(index, 1);
          }

          return;
        }

        value = element.checked;
      } else if (element.checked) {
        value = elementValue;
      } else {
        return;
      }

      this.oldValue = this.value;
      this.value = value;
      this.notify();
    };

    CheckedObserver.prototype.notify = function notify() {
      var oldValue = this.oldValue;
      var newValue = this.value;

      this.callSubscribers(newValue, oldValue);
    };

    CheckedObserver.prototype.subscribe = function subscribe(context, callable) {
      if (!this.hasSubscribers()) {
        this.disposeHandler = this.handler.subscribe(this.element, this.synchronizeValue.bind(this, false));
      }
      this.addSubscriber(context, callable);
    };

    CheckedObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
        this.disposeHandler();
        this.disposeHandler = null;
      }
    };

    CheckedObserver.prototype.unbind = function unbind() {
      if (this.arrayObserver) {
        this.arrayObserver.unsubscribe(checkedArrayContext, this);
        this.arrayObserver = null;
      }
      if (this.valueObserver) {
        this.valueObserver.unsubscribe(checkedValueContext, this);
      }
    };

    return CheckedObserver;
  }()) || _class9);


  var selectArrayContext = 'SelectValueObserver:array';

  var SelectValueObserver = exports.SelectValueObserver = (_dec9 = subscriberCollection(), _dec9(_class10 = function () {
    function SelectValueObserver(element, handler, observerLocator) {
      

      this.element = element;
      this.handler = handler;
      this.observerLocator = observerLocator;
    }

    SelectValueObserver.prototype.getValue = function getValue() {
      return this.value;
    };

    SelectValueObserver.prototype.setValue = function setValue(newValue) {
      if (newValue !== null && newValue !== undefined && this.element.multiple && !Array.isArray(newValue)) {
        throw new Error('Only null or Array instances can be bound to a multi-select.');
      }
      if (this.value === newValue) {
        return;
      }

      if (this.arrayObserver) {
        this.arrayObserver.unsubscribe(selectArrayContext, this);
        this.arrayObserver = null;
      }

      if (Array.isArray(newValue)) {
        this.arrayObserver = this.observerLocator.getArrayObserver(newValue);
        this.arrayObserver.subscribe(selectArrayContext, this);
      }

      this.oldValue = this.value;
      this.value = newValue;
      this.synchronizeOptions();
      this.notify();

      if (!this.initialSync) {
        this.initialSync = true;
        this.observerLocator.taskQueue.queueMicroTask(this);
      }
    };

    SelectValueObserver.prototype.call = function call(context, splices) {
      this.synchronizeOptions();
    };

    SelectValueObserver.prototype.synchronizeOptions = function synchronizeOptions() {
      var value = this.value;
      var clear = void 0;
      var isArray = void 0;

      if (value === null || value === undefined) {
        clear = true;
      } else if (Array.isArray(value)) {
        isArray = true;
      }

      var options = this.element.options;
      var i = options.length;
      var matcher = this.element.matcher || function (a, b) {
        return a === b;
      };

      var _loop = function _loop() {
        var option = options.item(i);
        if (clear) {
          option.selected = false;
          return 'continue';
        }
        var optionValue = option.hasOwnProperty('model') ? option.model : option.value;
        if (isArray) {
          option.selected = value.findIndex(function (item) {
            return !!matcher(optionValue, item);
          }) !== -1;
          return 'continue';
        }
        option.selected = !!matcher(optionValue, value);
      };

      while (i--) {
        var _ret2 = _loop();

        if (_ret2 === 'continue') continue;
      }
    };

    SelectValueObserver.prototype.synchronizeValue = function synchronizeValue() {
      var _this24 = this;

      var options = this.element.options;
      var count = 0;
      var value = [];

      for (var _i23 = 0, ii = options.length; _i23 < ii; _i23++) {
        var _option = options.item(_i23);
        if (!_option.selected) {
          continue;
        }
        value.push(_option.hasOwnProperty('model') ? _option.model : _option.value);
        count++;
      }

      if (this.element.multiple) {
        if (Array.isArray(this.value)) {
          var _ret3 = function () {
            var matcher = _this24.element.matcher || function (a, b) {
              return a === b;
            };

            var i = 0;

            var _loop2 = function _loop2() {
              var a = _this24.value[i];
              if (value.findIndex(function (b) {
                return matcher(a, b);
              }) === -1) {
                _this24.value.splice(i, 1);
              } else {
                i++;
              }
            };

            while (i < _this24.value.length) {
              _loop2();
            }

            i = 0;

            var _loop3 = function _loop3() {
              var a = value[i];
              if (_this24.value.findIndex(function (b) {
                return matcher(a, b);
              }) === -1) {
                _this24.value.push(a);
              }
              i++;
            };

            while (i < value.length) {
              _loop3();
            }
            return {
              v: void 0
            };
          }();

          if ((typeof _ret3 === 'undefined' ? 'undefined' : _typeof(_ret3)) === "object") return _ret3.v;
        }
      } else {
          if (count === 0) {
            value = null;
          } else {
            value = value[0];
          }
        }

      if (value !== this.value) {
        this.oldValue = this.value;
        this.value = value;
        this.notify();
      }
    };

    SelectValueObserver.prototype.notify = function notify() {
      var oldValue = this.oldValue;
      var newValue = this.value;

      this.callSubscribers(newValue, oldValue);
    };

    SelectValueObserver.prototype.subscribe = function subscribe(context, callable) {
      if (!this.hasSubscribers()) {
        this.disposeHandler = this.handler.subscribe(this.element, this.synchronizeValue.bind(this, false));
      }
      this.addSubscriber(context, callable);
    };

    SelectValueObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
        this.disposeHandler();
        this.disposeHandler = null;
      }
    };

    SelectValueObserver.prototype.bind = function bind() {
      var _this25 = this;

      this.domObserver = _aureliaPal.DOM.createMutationObserver(function () {
        _this25.synchronizeOptions();
        _this25.synchronizeValue();
      });
      this.domObserver.observe(this.element, { childList: true, subtree: true });
    };

    SelectValueObserver.prototype.unbind = function unbind() {
      this.domObserver.disconnect();
      this.domObserver = null;

      if (this.arrayObserver) {
        this.arrayObserver.unsubscribe(selectArrayContext, this);
        this.arrayObserver = null;
      }
    };

    return SelectValueObserver;
  }()) || _class10);

  var ClassObserver = exports.ClassObserver = function () {
    function ClassObserver(element) {
      

      this.element = element;
      this.doNotCache = true;
      this.value = '';
      this.version = 0;
    }

    ClassObserver.prototype.getValue = function getValue() {
      return this.value;
    };

    ClassObserver.prototype.setValue = function setValue(newValue) {
      var nameIndex = this.nameIndex || {};
      var version = this.version;
      var names = void 0;
      var name = void 0;

      if (newValue !== null && newValue !== undefined && newValue.length) {
        names = newValue.split(/\s+/);
        for (var _i24 = 0, length = names.length; _i24 < length; _i24++) {
          name = names[_i24];
          if (name === '') {
            continue;
          }
          nameIndex[name] = version;
          this.element.classList.add(name);
        }
      }

      this.value = newValue;
      this.nameIndex = nameIndex;
      this.version += 1;

      if (version === 0) {
        return;
      }

      version -= 1;
      for (name in nameIndex) {
        if (!nameIndex.hasOwnProperty(name) || nameIndex[name] !== version) {
          continue;
        }
        this.element.classList.remove(name);
      }
    };

    ClassObserver.prototype.subscribe = function subscribe() {
      throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "class" property is not supported.');
    };

    return ClassObserver;
  }();

  function hasDeclaredDependencies(descriptor) {
    return !!(descriptor && descriptor.get && descriptor.get.dependencies);
  }

  function declarePropertyDependencies(ctor, propertyName, dependencies) {
    var descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, propertyName);
    descriptor.get.dependencies = dependencies;
  }

  function computedFrom() {
    for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
      rest[_key] = arguments[_key];
    }

    return function (target, key, descriptor) {
      descriptor.get.dependencies = rest;
      return descriptor;
    };
  }

  var ComputedExpression = exports.ComputedExpression = function (_Expression19) {
    _inherits(ComputedExpression, _Expression19);

    function ComputedExpression(name, dependencies) {
      

      var _this26 = _possibleConstructorReturn(this, _Expression19.call(this));

      _this26.name = name;
      _this26.dependencies = dependencies;
      _this26.isAssignable = true;
      return _this26;
    }

    ComputedExpression.prototype.evaluate = function evaluate(scope, lookupFunctions) {
      return scope.bindingContext[this.name];
    };

    ComputedExpression.prototype.assign = function assign(scope, value) {
      scope.bindingContext[this.name] = value;
    };

    ComputedExpression.prototype.accept = function accept(visitor) {
      throw new Error('not implemented');
    };

    ComputedExpression.prototype.connect = function connect(binding, scope) {
      var dependencies = this.dependencies;
      var i = dependencies.length;
      while (i--) {
        dependencies[i].connect(binding, scope);
      }
    };

    return ComputedExpression;
  }(Expression);

  function createComputedObserver(obj, propertyName, descriptor, observerLocator) {
    var dependencies = descriptor.get.dependencies;
    if (!(dependencies instanceof ComputedExpression)) {
      var _i25 = dependencies.length;
      while (_i25--) {
        dependencies[_i25] = observerLocator.parser.parse(dependencies[_i25]);
      }
      dependencies = descriptor.get.dependencies = new ComputedExpression(propertyName, dependencies);
    }

    var scope = { bindingContext: obj, overrideContext: createOverrideContext(obj) };
    return new ExpressionObserver(scope, dependencies, observerLocator);
  }

  var elements = exports.elements = {
    a: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'target', 'transform', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyph: ['class', 'dx', 'dy', 'externalResourcesRequired', 'format', 'glyphRef', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    altGlyphDef: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyphItem: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    animate: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateColor: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateMotion: ['accumulate', 'additive', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keyPoints', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'origin', 'path', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'rotate', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateTransform: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'type', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    circle: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'r', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    clipPath: ['class', 'clipPathUnits', 'externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    'color-profile': ['id', 'local', 'name', 'rendering-intent', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    cursor: ['externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    defs: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    desc: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    ellipse: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    feBlend: ['class', 'height', 'id', 'in', 'in2', 'mode', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feColorMatrix: ['class', 'height', 'id', 'in', 'result', 'style', 'type', 'values', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComponentTransfer: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComposite: ['class', 'height', 'id', 'in', 'in2', 'k1', 'k2', 'k3', 'k4', 'operator', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feConvolveMatrix: ['bias', 'class', 'divisor', 'edgeMode', 'height', 'id', 'in', 'kernelMatrix', 'kernelUnitLength', 'order', 'preserveAlpha', 'result', 'style', 'targetX', 'targetY', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDiffuseLighting: ['class', 'diffuseConstant', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDisplacementMap: ['class', 'height', 'id', 'in', 'in2', 'result', 'scale', 'style', 'width', 'x', 'xChannelSelector', 'xml:base', 'xml:lang', 'xml:space', 'y', 'yChannelSelector'],
    feDistantLight: ['azimuth', 'elevation', 'id', 'xml:base', 'xml:lang', 'xml:space'],
    feFlood: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feFuncA: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncB: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncG: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncR: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feGaussianBlur: ['class', 'height', 'id', 'in', 'result', 'stdDeviation', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feImage: ['class', 'externalResourcesRequired', 'height', 'id', 'preserveAspectRatio', 'result', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMerge: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMergeNode: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    feMorphology: ['class', 'height', 'id', 'in', 'operator', 'radius', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feOffset: ['class', 'dx', 'dy', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    fePointLight: ['id', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feSpecularLighting: ['class', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'specularConstant', 'specularExponent', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feSpotLight: ['id', 'limitingConeAngle', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'specularExponent', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feTile: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feTurbulence: ['baseFrequency', 'class', 'height', 'id', 'numOctaves', 'result', 'seed', 'stitchTiles', 'style', 'type', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    filter: ['class', 'externalResourcesRequired', 'filterRes', 'filterUnits', 'height', 'id', 'primitiveUnits', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    font: ['class', 'externalResourcesRequired', 'horiz-adv-x', 'horiz-origin-x', 'horiz-origin-y', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face': ['accent-height', 'alphabetic', 'ascent', 'bbox', 'cap-height', 'descent', 'font-family', 'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight', 'hanging', 'id', 'ideographic', 'mathematical', 'overline-position', 'overline-thickness', 'panose-1', 'slope', 'stemh', 'stemv', 'strikethrough-position', 'strikethrough-thickness', 'underline-position', 'underline-thickness', 'unicode-range', 'units-per-em', 'v-alphabetic', 'v-hanging', 'v-ideographic', 'v-mathematical', 'widths', 'x-height', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-format': ['id', 'string', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-name': ['id', 'name', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-src': ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-uri': ['id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    foreignObject: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    g: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    glyph: ['arabic-form', 'class', 'd', 'glyph-name', 'horiz-adv-x', 'id', 'lang', 'orientation', 'style', 'unicode', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    glyphRef: ['class', 'dx', 'dy', 'format', 'glyphRef', 'id', 'style', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    hkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space'],
    image: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    line: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'x1', 'x2', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    linearGradient: ['class', 'externalResourcesRequired', 'gradientTransform', 'gradientUnits', 'id', 'spreadMethod', 'style', 'x1', 'x2', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    marker: ['class', 'externalResourcesRequired', 'id', 'markerHeight', 'markerUnits', 'markerWidth', 'orient', 'preserveAspectRatio', 'refX', 'refY', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    mask: ['class', 'externalResourcesRequired', 'height', 'id', 'maskContentUnits', 'maskUnits', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    metadata: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'missing-glyph': ['class', 'd', 'horiz-adv-x', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    mpath: ['externalResourcesRequired', 'id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    path: ['class', 'd', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'pathLength', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    pattern: ['class', 'externalResourcesRequired', 'height', 'id', 'patternContentUnits', 'patternTransform', 'patternUnits', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'viewBox', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    polygon: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    polyline: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    radialGradient: ['class', 'cx', 'cy', 'externalResourcesRequired', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'id', 'r', 'spreadMethod', 'style', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    rect: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    script: ['externalResourcesRequired', 'id', 'type', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    set: ['attributeName', 'attributeType', 'begin', 'dur', 'end', 'externalResourcesRequired', 'fill', 'id', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    stop: ['class', 'id', 'offset', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    style: ['id', 'media', 'title', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    svg: ['baseProfile', 'class', 'contentScriptType', 'contentStyleType', 'externalResourcesRequired', 'height', 'id', 'onabort', 'onactivate', 'onclick', 'onerror', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onresize', 'onscroll', 'onunload', 'onzoom', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'version', 'viewBox', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'zoomAndPan'],
    switch: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    symbol: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    text: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'transform', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    textPath: ['class', 'externalResourcesRequired', 'id', 'lengthAdjust', 'method', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'spacing', 'startOffset', 'style', 'systemLanguage', 'textLength', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    title: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    tref: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    tspan: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    use: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    view: ['externalResourcesRequired', 'id', 'preserveAspectRatio', 'viewBox', 'viewTarget', 'xml:base', 'xml:lang', 'xml:space', 'zoomAndPan'],
    vkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space']
  };
  var presentationElements = exports.presentationElements = {
    'a': true,
    'altGlyph': true,
    'animate': true,
    'animateColor': true,
    'circle': true,
    'clipPath': true,
    'defs': true,
    'ellipse': true,
    'feBlend': true,
    'feColorMatrix': true,
    'feComponentTransfer': true,
    'feComposite': true,
    'feConvolveMatrix': true,
    'feDiffuseLighting': true,
    'feDisplacementMap': true,
    'feFlood': true,
    'feGaussianBlur': true,
    'feImage': true,
    'feMerge': true,
    'feMorphology': true,
    'feOffset': true,
    'feSpecularLighting': true,
    'feTile': true,
    'feTurbulence': true,
    'filter': true,
    'font': true,
    'foreignObject': true,
    'g': true,
    'glyph': true,
    'glyphRef': true,
    'image': true,
    'line': true,
    'linearGradient': true,
    'marker': true,
    'mask': true,
    'missing-glyph': true,
    'path': true,
    'pattern': true,
    'polygon': true,
    'polyline': true,
    'radialGradient': true,
    'rect': true,
    'stop': true,
    'svg': true,
    'switch': true,
    'symbol': true,
    'text': true,
    'textPath': true,
    'tref': true,
    'tspan': true,
    'use': true
  };

  var presentationAttributes = exports.presentationAttributes = {
    'alignment-baseline': true,
    'baseline-shift': true,
    'clip-path': true,
    'clip-rule': true,
    'clip': true,
    'color-interpolation-filters': true,
    'color-interpolation': true,
    'color-profile': true,
    'color-rendering': true,
    'color': true,
    'cursor': true,
    'direction': true,
    'display': true,
    'dominant-baseline': true,
    'enable-background': true,
    'fill-opacity': true,
    'fill-rule': true,
    'fill': true,
    'filter': true,
    'flood-color': true,
    'flood-opacity': true,
    'font-family': true,
    'font-size-adjust': true,
    'font-size': true,
    'font-stretch': true,
    'font-style': true,
    'font-variant': true,
    'font-weight': true,
    'glyph-orientation-horizontal': true,
    'glyph-orientation-vertical': true,
    'image-rendering': true,
    'kerning': true,
    'letter-spacing': true,
    'lighting-color': true,
    'marker-end': true,
    'marker-mid': true,
    'marker-start': true,
    'mask': true,
    'opacity': true,
    'overflow': true,
    'pointer-events': true,
    'shape-rendering': true,
    'stop-color': true,
    'stop-opacity': true,
    'stroke-dasharray': true,
    'stroke-dashoffset': true,
    'stroke-linecap': true,
    'stroke-linejoin': true,
    'stroke-miterlimit': true,
    'stroke-opacity': true,
    'stroke-width': true,
    'stroke': true,
    'text-anchor': true,
    'text-decoration': true,
    'text-rendering': true,
    'unicode-bidi': true,
    'visibility': true,
    'word-spacing': true,
    'writing-mode': true
  };

  function createElement(html) {
    var div = _aureliaPal.DOM.createElement('div');
    div.innerHTML = html;
    return div.firstChild;
  }

  var SVGAnalyzer = exports.SVGAnalyzer = function () {
    function SVGAnalyzer() {
      

      if (createElement('<svg><altGlyph /></svg>').firstElementChild.nodeName === 'altglyph' && elements.altGlyph) {
        elements.altglyph = elements.altGlyph;
        delete elements.altGlyph;
        elements.altglyphdef = elements.altGlyphDef;
        delete elements.altGlyphDef;
        elements.altglyphitem = elements.altGlyphItem;
        delete elements.altGlyphItem;
        elements.glyphref = elements.glyphRef;
        delete elements.glyphRef;
      }
    }

    SVGAnalyzer.prototype.isStandardSvgAttribute = function isStandardSvgAttribute(nodeName, attributeName) {
      return presentationElements[nodeName] && presentationAttributes[attributeName] || elements[nodeName] && elements[nodeName].indexOf(attributeName) !== -1;
    };

    return SVGAnalyzer;
  }();

  var ObserverLocator = exports.ObserverLocator = (_temp = _class11 = function () {
    function ObserverLocator(taskQueue, eventManager, dirtyChecker, svgAnalyzer, parser) {
      

      this.taskQueue = taskQueue;
      this.eventManager = eventManager;
      this.dirtyChecker = dirtyChecker;
      this.svgAnalyzer = svgAnalyzer;
      this.parser = parser;
      this.adapters = [];
      this.logger = LogManager.getLogger('observer-locator');
    }

    ObserverLocator.prototype.getObserver = function getObserver(obj, propertyName) {
      var observersLookup = obj.__observers__;
      var observer = void 0;

      if (observersLookup && propertyName in observersLookup) {
        return observersLookup[propertyName];
      }

      observer = this.createPropertyObserver(obj, propertyName);

      if (!observer.doNotCache) {
        if (observersLookup === undefined) {
          observersLookup = this.getOrCreateObserversLookup(obj);
        }

        observersLookup[propertyName] = observer;
      }

      return observer;
    };

    ObserverLocator.prototype.getOrCreateObserversLookup = function getOrCreateObserversLookup(obj) {
      return obj.__observers__ || this.createObserversLookup(obj);
    };

    ObserverLocator.prototype.createObserversLookup = function createObserversLookup(obj) {
      var value = {};

      if (!Reflect.defineProperty(obj, '__observers__', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: value
      })) {
        this.logger.warn('Cannot add observers to object', obj);
      }

      return value;
    };

    ObserverLocator.prototype.addAdapter = function addAdapter(adapter) {
      this.adapters.push(adapter);
    };

    ObserverLocator.prototype.getAdapterObserver = function getAdapterObserver(obj, propertyName, descriptor) {
      for (var _i26 = 0, ii = this.adapters.length; _i26 < ii; _i26++) {
        var adapter = this.adapters[_i26];
        var observer = adapter.getObserver(obj, propertyName, descriptor);
        if (observer) {
          return observer;
        }
      }
      return null;
    };

    ObserverLocator.prototype.createPropertyObserver = function createPropertyObserver(obj, propertyName) {
      var descriptor = void 0;
      var handler = void 0;
      var xlinkResult = void 0;

      if (!(obj instanceof Object)) {
        return new PrimitiveObserver(obj, propertyName);
      }

      if (obj instanceof _aureliaPal.DOM.Element) {
        if (propertyName === 'class') {
          return new ClassObserver(obj);
        }
        if (propertyName === 'style' || propertyName === 'css') {
          return new StyleObserver(obj, propertyName);
        }
        handler = this.eventManager.getElementHandler(obj, propertyName);
        if (propertyName === 'value' && obj.tagName.toLowerCase() === 'select') {
          return new SelectValueObserver(obj, handler, this);
        }
        if (propertyName === 'checked' && obj.tagName.toLowerCase() === 'input') {
          return new CheckedObserver(obj, handler, this);
        }
        if (handler) {
          return new ValueAttributeObserver(obj, propertyName, handler);
        }
        xlinkResult = /^xlink:(.+)$/.exec(propertyName);
        if (xlinkResult) {
          return new XLinkAttributeObserver(obj, propertyName, xlinkResult[1]);
        }
        if (/^\w+:|^data-|^aria-/.test(propertyName) || obj instanceof _aureliaPal.DOM.SVGElement && this.svgAnalyzer.isStandardSvgAttribute(obj.nodeName, propertyName)) {
          return new DataAttributeObserver(obj, propertyName);
        }
      }

      descriptor = Object.getPropertyDescriptor(obj, propertyName);

      if (hasDeclaredDependencies(descriptor)) {
        return createComputedObserver(obj, propertyName, descriptor, this);
      }

      if (descriptor) {
        var existingGetterOrSetter = descriptor.get || descriptor.set;
        if (existingGetterOrSetter) {
          if (existingGetterOrSetter.getObserver) {
            return existingGetterOrSetter.getObserver(obj);
          }

          var adapterObserver = this.getAdapterObserver(obj, propertyName, descriptor);
          if (adapterObserver) {
            return adapterObserver;
          }
          return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
        }
      }

      if (obj instanceof Array) {
        if (propertyName === 'length') {
          return this.getArrayObserver(obj).getLengthObserver();
        }

        return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
      } else if (obj instanceof Map) {
        if (propertyName === 'size') {
          return this.getMapObserver(obj).getLengthObserver();
        }

        return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
      } else if (obj instanceof Set) {
        if (propertyName === 'size') {
          return this.getSetObserver(obj).getLengthObserver();
        }

        return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
      }

      return new SetterObserver(this.taskQueue, obj, propertyName);
    };

    ObserverLocator.prototype.getAccessor = function getAccessor(obj, propertyName) {
      if (obj instanceof _aureliaPal.DOM.Element) {
        if (propertyName === 'class' || propertyName === 'style' || propertyName === 'css' || propertyName === 'value' && (obj.tagName.toLowerCase() === 'input' || obj.tagName.toLowerCase() === 'select') || propertyName === 'checked' && obj.tagName.toLowerCase() === 'input' || propertyName === 'model' && obj.tagName.toLowerCase() === 'input' || /^xlink:.+$/.exec(propertyName)) {
          return this.getObserver(obj, propertyName);
        }
        if (/^\w+:|^data-|^aria-/.test(propertyName) || obj instanceof _aureliaPal.DOM.SVGElement && this.svgAnalyzer.isStandardSvgAttribute(obj.nodeName, propertyName)) {
          return dataAttributeAccessor;
        }
      }
      return propertyAccessor;
    };

    ObserverLocator.prototype.getArrayObserver = function getArrayObserver(array) {
      return _getArrayObserver(this.taskQueue, array);
    };

    ObserverLocator.prototype.getMapObserver = function getMapObserver(map) {
      return _getMapObserver(this.taskQueue, map);
    };

    ObserverLocator.prototype.getSetObserver = function getSetObserver(set) {
      return _getSetObserver(this.taskQueue, set);
    };

    return ObserverLocator;
  }(), _class11.inject = [_aureliaTaskQueue.TaskQueue, EventManager, DirtyChecker, SVGAnalyzer, Parser], _temp);

  var ObjectObservationAdapter = exports.ObjectObservationAdapter = function () {
    function ObjectObservationAdapter() {
      
    }

    ObjectObservationAdapter.prototype.getObserver = function getObserver(object, propertyName, descriptor) {
      throw new Error('BindingAdapters must implement getObserver(object, propertyName).');
    };

    return ObjectObservationAdapter;
  }();

  var BindingExpression = exports.BindingExpression = function () {
    function BindingExpression(observerLocator, targetProperty, sourceExpression, mode, lookupFunctions, attribute) {
      

      this.observerLocator = observerLocator;
      this.targetProperty = targetProperty;
      this.sourceExpression = sourceExpression;
      this.mode = mode;
      this.lookupFunctions = lookupFunctions;
      this.attribute = attribute;
      this.discrete = false;
    }

    BindingExpression.prototype.createBinding = function createBinding(target) {
      return new Binding(this.observerLocator, this.sourceExpression, target, this.targetProperty, this.mode, this.lookupFunctions);
    };

    return BindingExpression;
  }();

  var targetContext = 'Binding:target';

  var Binding = exports.Binding = (_dec10 = connectable(), _dec10(_class12 = function () {
    function Binding(observerLocator, sourceExpression, target, targetProperty, mode, lookupFunctions) {
      

      this.observerLocator = observerLocator;
      this.sourceExpression = sourceExpression;
      this.target = target;
      this.targetProperty = targetProperty;
      this.mode = mode;
      this.lookupFunctions = lookupFunctions;
    }

    Binding.prototype.updateTarget = function updateTarget(value) {
      this.targetObserver.setValue(value, this.target, this.targetProperty);
    };

    Binding.prototype.updateSource = function updateSource(value) {
      this.sourceExpression.assign(this.source, value, this.lookupFunctions);
    };

    Binding.prototype.call = function call(context, newValue, oldValue) {
      if (!this.isBound) {
        return;
      }
      if (context === sourceContext) {
        oldValue = this.targetObserver.getValue(this.target, this.targetProperty);
        newValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
        if (newValue !== oldValue) {
          this.updateTarget(newValue);
        }
        if (this.mode !== bindingMode.oneTime) {
          this._version++;
          this.sourceExpression.connect(this, this.source);
          this.unobserve(false);
        }
        return;
      }
      if (context === targetContext) {
        if (newValue !== this.sourceExpression.evaluate(this.source, this.lookupFunctions)) {
          this.updateSource(newValue);
        }
        return;
      }
      throw new Error('Unexpected call context ' + context);
    };

    Binding.prototype.bind = function bind(source) {
      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.isBound = true;
      this.source = source;

      if (this.sourceExpression.bind) {
        this.sourceExpression.bind(this, source, this.lookupFunctions);
      }

      var mode = this.mode;
      if (!this.targetObserver) {
        var method = mode === bindingMode.twoWay ? 'getObserver' : 'getAccessor';
        this.targetObserver = this.observerLocator[method](this.target, this.targetProperty);
      }

      if ('bind' in this.targetObserver) {
        this.targetObserver.bind();
      }
      var value = this.sourceExpression.evaluate(source, this.lookupFunctions);
      this.updateTarget(value);

      if (mode === bindingMode.oneWay) {
        enqueueBindingConnect(this);
      } else if (mode === bindingMode.twoWay) {
        this.sourceExpression.connect(this, source);
        this.targetObserver.subscribe(targetContext, this);
      }
    };

    Binding.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      if (this.sourceExpression.unbind) {
        this.sourceExpression.unbind(this, this.source);
      }
      this.source = null;
      if ('unbind' in this.targetObserver) {
        this.targetObserver.unbind();
      }
      if (this.targetObserver.unsubscribe) {
        this.targetObserver.unsubscribe(targetContext, this);
      }
      this.unobserve(true);
    };

    Binding.prototype.connect = function connect(evaluate) {
      if (!this.isBound) {
        return;
      }
      if (evaluate) {
        var value = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
        this.updateTarget(value);
      }
      this.sourceExpression.connect(this, this.source);
    };

    return Binding;
  }()) || _class12);

  var CallExpression = exports.CallExpression = function () {
    function CallExpression(observerLocator, targetProperty, sourceExpression, lookupFunctions) {
      

      this.observerLocator = observerLocator;
      this.targetProperty = targetProperty;
      this.sourceExpression = sourceExpression;
      this.lookupFunctions = lookupFunctions;
    }

    CallExpression.prototype.createBinding = function createBinding(target) {
      return new Call(this.observerLocator, this.sourceExpression, target, this.targetProperty, this.lookupFunctions);
    };

    return CallExpression;
  }();

  var Call = exports.Call = function () {
    function Call(observerLocator, sourceExpression, target, targetProperty, lookupFunctions) {
      

      this.sourceExpression = sourceExpression;
      this.target = target;
      this.targetProperty = observerLocator.getObserver(target, targetProperty);
      this.lookupFunctions = lookupFunctions;
    }

    Call.prototype.callSource = function callSource($event) {
      var overrideContext = this.source.overrideContext;
      Object.assign(overrideContext, $event);
      overrideContext.$event = $event;
      var mustEvaluate = true;
      var result = this.sourceExpression.evaluate(this.source, this.lookupFunctions, mustEvaluate);
      delete overrideContext.$event;
      for (var prop in $event) {
        delete overrideContext[prop];
      }
      return result;
    };

    Call.prototype.bind = function bind(source) {
      var _this27 = this;

      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.isBound = true;
      this.source = source;

      if (this.sourceExpression.bind) {
        this.sourceExpression.bind(this, source, this.lookupFunctions);
      }
      this.targetProperty.setValue(function ($event) {
        return _this27.callSource($event);
      });
    };

    Call.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      if (this.sourceExpression.unbind) {
        this.sourceExpression.unbind(this, this.source);
      }
      this.source = null;
      this.targetProperty.setValue(null);
    };

    return Call;
  }();

  var ValueConverterResource = exports.ValueConverterResource = function () {
    function ValueConverterResource(name) {
      

      this.name = name;
    }

    ValueConverterResource.convention = function convention(name) {
      if (name.endsWith('ValueConverter')) {
        return new ValueConverterResource(camelCase(name.substring(0, name.length - 14)));
      }
    };

    ValueConverterResource.prototype.initialize = function initialize(container, target) {
      this.instance = container.get(target);
    };

    ValueConverterResource.prototype.register = function register(registry, name) {
      registry.registerValueConverter(name || this.name, this.instance);
    };

    ValueConverterResource.prototype.load = function load(container, target) {};

    return ValueConverterResource;
  }();

  function valueConverter(nameOrTarget) {
    if (nameOrTarget === undefined || typeof nameOrTarget === 'string') {
      return function (target) {
        _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ValueConverterResource(nameOrTarget), target);
      };
    }

    _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ValueConverterResource(), nameOrTarget);
  }

  var BindingBehaviorResource = exports.BindingBehaviorResource = function () {
    function BindingBehaviorResource(name) {
      

      this.name = name;
    }

    BindingBehaviorResource.convention = function convention(name) {
      if (name.endsWith('BindingBehavior')) {
        return new BindingBehaviorResource(camelCase(name.substring(0, name.length - 15)));
      }
    };

    BindingBehaviorResource.prototype.initialize = function initialize(container, target) {
      this.instance = container.get(target);
    };

    BindingBehaviorResource.prototype.register = function register(registry, name) {
      registry.registerBindingBehavior(name || this.name, this.instance);
    };

    BindingBehaviorResource.prototype.load = function load(container, target) {};

    return BindingBehaviorResource;
  }();

  function bindingBehavior(nameOrTarget) {
    if (nameOrTarget === undefined || typeof nameOrTarget === 'string') {
      return function (target) {
        _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new BindingBehaviorResource(nameOrTarget), target);
      };
    }

    _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new BindingBehaviorResource(), nameOrTarget);
  }

  var ListenerExpression = exports.ListenerExpression = function () {
    function ListenerExpression(eventManager, targetEvent, sourceExpression, delegate, preventDefault, lookupFunctions) {
      

      this.eventManager = eventManager;
      this.targetEvent = targetEvent;
      this.sourceExpression = sourceExpression;
      this.delegate = delegate;
      this.discrete = true;
      this.preventDefault = preventDefault;
      this.lookupFunctions = lookupFunctions;
    }

    ListenerExpression.prototype.createBinding = function createBinding(target) {
      return new Listener(this.eventManager, this.targetEvent, this.delegate, this.sourceExpression, target, this.preventDefault, this.lookupFunctions);
    };

    return ListenerExpression;
  }();

  var Listener = exports.Listener = function () {
    function Listener(eventManager, targetEvent, delegate, sourceExpression, target, preventDefault, lookupFunctions) {
      

      this.eventManager = eventManager;
      this.targetEvent = targetEvent;
      this.delegate = delegate;
      this.sourceExpression = sourceExpression;
      this.target = target;
      this.preventDefault = preventDefault;
      this.lookupFunctions = lookupFunctions;
    }

    Listener.prototype.callSource = function callSource(event) {
      var overrideContext = this.source.overrideContext;
      overrideContext.$event = event;
      var mustEvaluate = true;
      var result = this.sourceExpression.evaluate(this.source, this.lookupFunctions, mustEvaluate);
      delete overrideContext.$event;
      if (result !== true && this.preventDefault) {
        event.preventDefault();
      }
      return result;
    };

    Listener.prototype.bind = function bind(source) {
      var _this28 = this;

      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.isBound = true;
      this.source = source;

      if (this.sourceExpression.bind) {
        this.sourceExpression.bind(this, source, this.lookupFunctions);
      }
      this._disposeListener = this.eventManager.addEventListener(this.target, this.targetEvent, function (event) {
        return _this28.callSource(event);
      }, this.delegate);
    };

    Listener.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      if (this.sourceExpression.unbind) {
        this.sourceExpression.unbind(this, this.source);
      }
      this.source = null;
      this._disposeListener();
      this._disposeListener = null;
    };

    return Listener;
  }();

  function getAU(element) {
    var au = element.au;

    if (au === undefined) {
      throw new Error('No Aurelia APIs are defined for the element: "' + element.tagName + '".');
    }

    return au;
  }

  var NameExpression = exports.NameExpression = function () {
    function NameExpression(sourceExpression, apiName, lookupFunctions) {
      

      this.sourceExpression = sourceExpression;
      this.apiName = apiName;
      this.lookupFunctions = lookupFunctions;
      this.discrete = true;
    }

    NameExpression.prototype.createBinding = function createBinding(target) {
      return new NameBinder(this.sourceExpression, NameExpression.locateAPI(target, this.apiName), this.lookupFunctions);
    };

    NameExpression.locateAPI = function locateAPI(element, apiName) {
      switch (apiName) {
        case 'element':
          return element;
        case 'controller':
          return getAU(element).controller;
        case 'view-model':
          return getAU(element).controller.viewModel;
        case 'view':
          return getAU(element).controller.view;
        default:
          var target = getAU(element)[apiName];

          if (target === undefined) {
            throw new Error('Attempted to reference "' + apiName + '", but it was not found amongst the target\'s API.');
          }

          return target.viewModel;
      }
    };

    return NameExpression;
  }();

  var NameBinder = function () {
    function NameBinder(sourceExpression, target, lookupFunctions) {
      

      this.sourceExpression = sourceExpression;
      this.target = target;
      this.lookupFunctions = lookupFunctions;
    }

    NameBinder.prototype.bind = function bind(source) {
      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.isBound = true;
      this.source = source;
      if (this.sourceExpression.bind) {
        this.sourceExpression.bind(this, source, this.lookupFunctions);
      }
      this.sourceExpression.assign(this.source, this.target, this.lookupFunctions);
    };

    NameBinder.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      this.sourceExpression.assign(this.source, null, this.lookupFunctions);
      if (this.sourceExpression.unbind) {
        this.sourceExpression.unbind(this, this.source);
      }
      this.source = null;
    };

    return NameBinder;
  }();

  var LookupFunctions = {
    bindingBehaviors: function bindingBehaviors(name) {
      return null;
    },
    valueConverters: function valueConverters(name) {
      return null;
    }
  };

  var BindingEngine = exports.BindingEngine = (_temp2 = _class13 = function () {
    function BindingEngine(observerLocator, parser) {
      

      this.observerLocator = observerLocator;
      this.parser = parser;
    }

    BindingEngine.prototype.createBindingExpression = function createBindingExpression(targetProperty, sourceExpression) {
      var mode = arguments.length <= 2 || arguments[2] === undefined ? bindingMode.oneWay : arguments[2];
      var lookupFunctions = arguments.length <= 3 || arguments[3] === undefined ? LookupFunctions : arguments[3];

      return new BindingExpression(this.observerLocator, targetProperty, this.parser.parse(sourceExpression), mode, lookupFunctions);
    };

    BindingEngine.prototype.propertyObserver = function propertyObserver(obj, propertyName) {
      var _this29 = this;

      return {
        subscribe: function subscribe(callback) {
          var observer = _this29.observerLocator.getObserver(obj, propertyName);
          observer.subscribe(callback);
          return {
            dispose: function dispose() {
              return observer.unsubscribe(callback);
            }
          };
        }
      };
    };

    BindingEngine.prototype.collectionObserver = function collectionObserver(collection) {
      var _this30 = this;

      return {
        subscribe: function subscribe(callback) {
          var observer = void 0;
          if (collection instanceof Array) {
            observer = _this30.observerLocator.getArrayObserver(collection);
          } else if (collection instanceof Map) {
            observer = _this30.observerLocator.getMapObserver(collection);
          } else if (collection instanceof Set) {
            observer = _this30.observerLocator.getSetObserver(collection);
          } else {
            throw new Error('collection must be an instance of Array, Map or Set.');
          }
          observer.subscribe(callback);
          return {
            dispose: function dispose() {
              return observer.unsubscribe(callback);
            }
          };
        }
      };
    };

    BindingEngine.prototype.expressionObserver = function expressionObserver(bindingContext, expression) {
      var scope = { bindingContext: bindingContext, overrideContext: createOverrideContext(bindingContext) };
      return new ExpressionObserver(scope, this.parser.parse(expression), this.observerLocator, LookupFunctions);
    };

    BindingEngine.prototype.parseExpression = function parseExpression(expression) {
      return this.parser.parse(expression);
    };

    BindingEngine.prototype.registerAdapter = function registerAdapter(adapter) {
      this.observerLocator.addAdapter(adapter);
    };

    return BindingEngine;
  }(), _class13.inject = [ObserverLocator, Parser], _temp2);


  var setProto = Set.prototype;

  function _getSetObserver(taskQueue, set) {
    return ModifySetObserver.for(taskQueue, set);
  }

  exports.getSetObserver = _getSetObserver;

  var ModifySetObserver = function (_ModifyCollectionObse3) {
    _inherits(ModifySetObserver, _ModifyCollectionObse3);

    function ModifySetObserver(taskQueue, set) {
      

      return _possibleConstructorReturn(this, _ModifyCollectionObse3.call(this, taskQueue, set));
    }

    ModifySetObserver.for = function _for(taskQueue, set) {
      if (!('__set_observer__' in set)) {
        Reflect.defineProperty(set, '__set_observer__', {
          value: ModifySetObserver.create(taskQueue, set),
          enumerable: false, configurable: false
        });
      }
      return set.__set_observer__;
    };

    ModifySetObserver.create = function create(taskQueue, set) {
      var observer = new ModifySetObserver(taskQueue, set);

      var proto = setProto;
      if (proto.add !== set.add || proto.delete !== set.delete || proto.clear !== set.clear) {
        proto = {
          add: set.add,
          delete: set.delete,
          clear: set.clear
        };
      }

      set.add = function () {
        var type = 'add';
        var oldSize = set.size;
        var methodCallResult = proto.add.apply(set, arguments);
        var hasValue = set.size === oldSize;
        if (!hasValue) {
          observer.addChangeRecord({
            type: type,
            object: set,
            value: Array.from(set).pop()
          });
        }
        return methodCallResult;
      };

      set.delete = function () {
        var hasValue = set.has(arguments[0]);
        var methodCallResult = proto.delete.apply(set, arguments);
        if (hasValue) {
          observer.addChangeRecord({
            type: 'delete',
            object: set,
            value: arguments[0]
          });
        }
        return methodCallResult;
      };

      set.clear = function () {
        var methodCallResult = proto.clear.apply(set, arguments);
        observer.addChangeRecord({
          type: 'clear',
          object: set
        });
        return methodCallResult;
      };

      return observer;
    };

    return ModifySetObserver;
  }(ModifyCollectionObserver);

  function observable(targetOrConfig, key, descriptor) {
    function deco(target, key, descriptor, config) {
      if (key === undefined) {
        target = target.prototype;
        key = typeof config === 'string' ? config : config.name;
      }

      var innerPropertyName = '_' + key;

      var callbackName = config && config.changeHandler || key + 'Changed';

      if (descriptor) {
        if (typeof descriptor.initializer === 'function') {
          target[innerPropertyName] = descriptor.initializer();
        }
      } else {
        descriptor = {};
      }

      delete descriptor.writable;
      delete descriptor.initializer;

      descriptor.get = function () {
        return this[innerPropertyName];
      };
      descriptor.set = function (newValue) {
        var oldValue = this[innerPropertyName];
        this[innerPropertyName] = newValue;
        if (this[callbackName]) {
          this[callbackName](newValue, oldValue);
        }
      };

      descriptor.get.dependencies = [innerPropertyName];

      Reflect.defineProperty(target, key, descriptor);
    }

    if (key === undefined) {
      return function (t, k, d) {
        return deco(t, k, d, targetOrConfig);
      };
    }
    return deco(targetOrConfig, key, descriptor);
  }
});
define('aurelia-framework',['exports', 'aurelia-dependency-injection', 'aurelia-binding', 'aurelia-metadata', 'aurelia-templating', 'aurelia-loader', 'aurelia-task-queue', 'aurelia-path', 'aurelia-pal', 'aurelia-logging'], function (exports, _aureliaDependencyInjection, _aureliaBinding, _aureliaMetadata, _aureliaTemplating, _aureliaLoader, _aureliaTaskQueue, _aureliaPath, _aureliaPal, _aureliaLogging) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.LogManager = exports.FrameworkConfiguration = exports.Aurelia = undefined;
  Object.keys(_aureliaDependencyInjection).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaDependencyInjection[key];
      }
    });
  });
  Object.keys(_aureliaBinding).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaBinding[key];
      }
    });
  });
  Object.keys(_aureliaMetadata).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaMetadata[key];
      }
    });
  });
  Object.keys(_aureliaTemplating).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaTemplating[key];
      }
    });
  });
  Object.keys(_aureliaLoader).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaLoader[key];
      }
    });
  });
  Object.keys(_aureliaTaskQueue).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaTaskQueue[key];
      }
    });
  });
  Object.keys(_aureliaPath).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaPath[key];
      }
    });
  });
  Object.keys(_aureliaPal).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
      enumerable: true,
      get: function () {
        return _aureliaPal[key];
      }
    });
  });

  var TheLogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  

  function preventActionlessFormSubmit() {
    _aureliaPal.DOM.addEventListener('submit', function (evt) {
      var target = evt.target;
      var action = target.action;

      if (target.tagName.toLowerCase() === 'form' && !action) {
        evt.preventDefault();
      }
    });
  }

  var Aurelia = exports.Aurelia = function () {
    function Aurelia(loader, container, resources) {
      

      this.loader = loader || new _aureliaPal.PLATFORM.Loader();
      this.container = container || new _aureliaDependencyInjection.Container().makeGlobal();
      this.resources = resources || new _aureliaTemplating.ViewResources();
      this.use = new FrameworkConfiguration(this);
      this.logger = TheLogManager.getLogger('aurelia');
      this.hostConfigured = false;
      this.host = null;

      this.use.instance(Aurelia, this);
      this.use.instance(_aureliaLoader.Loader, this.loader);
      this.use.instance(_aureliaTemplating.ViewResources, this.resources);
    }

    Aurelia.prototype.start = function start() {
      var _this = this;

      if (this.started) {
        return Promise.resolve(this);
      }

      this.started = true;
      this.logger.info('Aurelia Starting');

      return this.use.apply().then(function () {
        preventActionlessFormSubmit();

        if (!_this.container.hasResolver(_aureliaTemplating.BindingLanguage)) {
          var message = 'You must configure Aurelia with a BindingLanguage implementation.';
          _this.logger.error(message);
          throw new Error(message);
        }

        _this.logger.info('Aurelia Started');
        var evt = _aureliaPal.DOM.createCustomEvent('aurelia-started', { bubbles: true, cancelable: true });
        _aureliaPal.DOM.dispatchEvent(evt);
        return _this;
      });
    };

    Aurelia.prototype.enhance = function enhance() {
      var _this2 = this;

      var bindingContext = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      var applicationHost = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      this._configureHost(applicationHost || _aureliaPal.DOM.querySelectorAll('body')[0]);

      return new Promise(function (resolve) {
        var engine = _this2.container.get(_aureliaTemplating.TemplatingEngine);
        _this2.root = engine.enhance({ container: _this2.container, element: _this2.host, resources: _this2.resources, bindingContext: bindingContext });
        _this2.root.attached();
        _this2._onAureliaComposed();
        resolve(_this2);
      });
    };

    Aurelia.prototype.setRoot = function setRoot() {
      var _this3 = this;

      var root = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var applicationHost = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var instruction = {};

      if (this.root && this.root.viewModel && this.root.viewModel.router) {
        this.root.viewModel.router.deactivate();
        this.root.viewModel.router.reset();
      }

      this._configureHost(applicationHost);

      var engine = this.container.get(_aureliaTemplating.TemplatingEngine);
      var transaction = this.container.get(_aureliaTemplating.CompositionTransaction);
      delete transaction.initialComposition;

      if (!root) {
        if (this.configModuleId) {
          root = (0, _aureliaPath.relativeToFile)('./app', this.configModuleId);
        } else {
          root = 'app';
        }
      }

      instruction.viewModel = root;
      instruction.container = instruction.childContainer = this.container;
      instruction.viewSlot = this.hostSlot;
      instruction.host = this.host;

      return engine.compose(instruction).then(function (r) {
        _this3.root = r;
        instruction.viewSlot.attached();
        _this3._onAureliaComposed();
        return _this3;
      });
    };

    Aurelia.prototype._configureHost = function _configureHost(applicationHost) {
      if (this.hostConfigured) {
        return;
      }
      applicationHost = applicationHost || this.host;

      if (!applicationHost || typeof applicationHost === 'string') {
        this.host = _aureliaPal.DOM.getElementById(applicationHost || 'applicationHost');
      } else {
        this.host = applicationHost;
      }

      if (!this.host) {
        throw new Error('No applicationHost was specified.');
      }

      this.hostConfigured = true;
      this.host.aurelia = this;
      this.hostSlot = new _aureliaTemplating.ViewSlot(this.host, true);
      this.hostSlot.transformChildNodesIntoView();
      this.container.registerInstance(_aureliaPal.DOM.boundary, this.host);
    };

    Aurelia.prototype._onAureliaComposed = function _onAureliaComposed() {
      var evt = _aureliaPal.DOM.createCustomEvent('aurelia-composed', { bubbles: true, cancelable: true });
      setTimeout(function () {
        return _aureliaPal.DOM.dispatchEvent(evt);
      }, 1);
    };

    return Aurelia;
  }();

  var logger = TheLogManager.getLogger('aurelia');
  var extPattern = /\.[^/.]+$/;

  function runTasks(config, tasks) {
    var current = void 0;
    var next = function next() {
      current = tasks.shift();
      if (current) {
        return Promise.resolve(current(config)).then(next);
      }

      return Promise.resolve();
    };

    return next();
  }

  function loadPlugin(config, loader, info) {
    logger.debug('Loading plugin ' + info.moduleId + '.');
    config.resourcesRelativeTo = info.resourcesRelativeTo;

    var id = info.moduleId;

    if (info.resourcesRelativeTo.length > 1) {
      return loader.normalize(info.moduleId, info.resourcesRelativeTo[1]).then(function (normalizedId) {
        return _loadPlugin(normalizedId);
      });
    }

    return _loadPlugin(id);

    function _loadPlugin(moduleId) {
      return loader.loadModule(moduleId).then(function (m) {
        if ('configure' in m) {
          return Promise.resolve(m.configure(config, info.config || {})).then(function () {
            config.resourcesRelativeTo = null;
            logger.debug('Configured plugin ' + info.moduleId + '.');
          });
        }

        config.resourcesRelativeTo = null;
        logger.debug('Loaded plugin ' + info.moduleId + '.');
      });
    }
  }

  function loadResources(aurelia, resourcesToLoad, appResources) {
    var viewEngine = aurelia.container.get(_aureliaTemplating.ViewEngine);

    return Promise.all(Object.keys(resourcesToLoad).map(function (n) {
      return _normalize(resourcesToLoad[n]);
    })).then(function (loads) {
      var names = [];
      var importIds = [];

      loads.forEach(function (l) {
        names.push(undefined);
        importIds.push(l.importId);
      });

      return viewEngine.importViewResources(importIds, names, appResources);
    });

    function _normalize(load) {
      var moduleId = load.moduleId;
      var ext = getExt(moduleId);

      if (isOtherResource(moduleId)) {
        moduleId = removeExt(moduleId);
      }

      return aurelia.loader.normalize(moduleId, load.relativeTo).then(function (normalized) {
        return {
          name: load.moduleId,
          importId: isOtherResource(load.moduleId) ? addOriginalExt(normalized, ext) : normalized
        };
      });
    }

    function isOtherResource(name) {
      var ext = getExt(name);
      if (!ext) return false;
      if (ext === '') return false;
      if (ext === '.js' || ext === '.ts') return false;
      return true;
    }

    function removeExt(name) {
      return name.replace(extPattern, '');
    }

    function addOriginalExt(normalized, ext) {
      return removeExt(normalized) + '.' + ext;
    }
  }

  function getExt(name) {
    var match = name.match(extPattern);
    if (match && match.length > 0) {
      return match[0].split('.')[1];
    }
  }

  function assertProcessed(plugins) {
    if (plugins.processed) {
      throw new Error('This config instance has already been applied. To load more plugins or global resources, create a new FrameworkConfiguration instance.');
    }
  }

  var FrameworkConfiguration = function () {
    function FrameworkConfiguration(aurelia) {
      var _this4 = this;

      

      this.aurelia = aurelia;
      this.container = aurelia.container;
      this.info = [];
      this.processed = false;
      this.preTasks = [];
      this.postTasks = [];
      this.resourcesToLoad = {};
      this.preTask(function () {
        return aurelia.loader.normalize('aurelia-bootstrapper').then(function (name) {
          return _this4.bootstrapperName = name;
        });
      });
      this.postTask(function () {
        return loadResources(aurelia, _this4.resourcesToLoad, aurelia.resources);
      });
    }

    FrameworkConfiguration.prototype.instance = function instance(type, _instance) {
      this.container.registerInstance(type, _instance);
      return this;
    };

    FrameworkConfiguration.prototype.singleton = function singleton(type, implementation) {
      this.container.registerSingleton(type, implementation);
      return this;
    };

    FrameworkConfiguration.prototype.transient = function transient(type, implementation) {
      this.container.registerTransient(type, implementation);
      return this;
    };

    FrameworkConfiguration.prototype.preTask = function preTask(task) {
      assertProcessed(this);
      this.preTasks.push(task);
      return this;
    };

    FrameworkConfiguration.prototype.postTask = function postTask(task) {
      assertProcessed(this);
      this.postTasks.push(task);
      return this;
    };

    FrameworkConfiguration.prototype.feature = function feature(plugin, config) {
      if (getExt(plugin)) {
        return this.plugin({ moduleId: plugin, resourcesRelativeTo: [plugin, ''], config: config || {} });
      }

      return this.plugin({ moduleId: plugin + '/index', resourcesRelativeTo: [plugin, ''], config: config || {} });
    };

    FrameworkConfiguration.prototype.globalResources = function globalResources(resources) {
      assertProcessed(this);

      var toAdd = Array.isArray(resources) ? resources : arguments;
      var resource = void 0;
      var resourcesRelativeTo = this.resourcesRelativeTo || ['', ''];

      for (var i = 0, ii = toAdd.length; i < ii; ++i) {
        resource = toAdd[i];
        if (typeof resource !== 'string') {
          throw new Error('Invalid resource path [' + resource + ']. Resources must be specified as relative module IDs.');
        }

        var parent = resourcesRelativeTo[0];
        var grandParent = resourcesRelativeTo[1];
        var name = resource;

        if ((resource.startsWith('./') || resource.startsWith('../')) && parent !== '') {
          name = (0, _aureliaPath.join)(parent, resource);
        }

        this.resourcesToLoad[name] = { moduleId: name, relativeTo: grandParent };
      }

      return this;
    };

    FrameworkConfiguration.prototype.globalName = function globalName(resourcePath, newName) {
      assertProcessed(this);
      this.resourcesToLoad[resourcePath] = { moduleId: newName, relativeTo: '' };
      return this;
    };

    FrameworkConfiguration.prototype.plugin = function plugin(_plugin, config) {
      assertProcessed(this);

      if (typeof _plugin === 'string') {
        return this.plugin({ moduleId: _plugin, resourcesRelativeTo: [_plugin, ''], config: config || {} });
      }

      this.info.push(_plugin);
      return this;
    };

    FrameworkConfiguration.prototype._addNormalizedPlugin = function _addNormalizedPlugin(name, config) {
      var _this5 = this;

      var plugin = { moduleId: name, resourcesRelativeTo: [name, ''], config: config || {} };
      this.plugin(plugin);

      this.preTask(function () {
        var relativeTo = [name, _this5.bootstrapperName];
        plugin.moduleId = name;
        plugin.resourcesRelativeTo = relativeTo;
        return Promise.resolve();
      });

      return this;
    };

    FrameworkConfiguration.prototype.defaultBindingLanguage = function defaultBindingLanguage() {
      return this._addNormalizedPlugin('aurelia-templating-binding');
    };

    FrameworkConfiguration.prototype.router = function router() {
      return this._addNormalizedPlugin('aurelia-templating-router');
    };

    FrameworkConfiguration.prototype.history = function history() {
      return this._addNormalizedPlugin('aurelia-history-browser');
    };

    FrameworkConfiguration.prototype.defaultResources = function defaultResources() {
      return this._addNormalizedPlugin('aurelia-templating-resources');
    };

    FrameworkConfiguration.prototype.eventAggregator = function eventAggregator() {
      return this._addNormalizedPlugin('aurelia-event-aggregator');
    };

    FrameworkConfiguration.prototype.basicConfiguration = function basicConfiguration() {
      return this.defaultBindingLanguage().defaultResources().eventAggregator();
    };

    FrameworkConfiguration.prototype.standardConfiguration = function standardConfiguration() {
      return this.basicConfiguration().history().router();
    };

    FrameworkConfiguration.prototype.developmentLogging = function developmentLogging() {
      var _this6 = this;

      this.preTask(function () {
        return _this6.aurelia.loader.normalize('aurelia-logging-console', _this6.bootstrapperName).then(function (name) {
          return _this6.aurelia.loader.loadModule(name).then(function (m) {
            TheLogManager.addAppender(new m.ConsoleAppender());
            TheLogManager.setLevel(TheLogManager.logLevel.debug);
          });
        });
      });

      return this;
    };

    FrameworkConfiguration.prototype.apply = function apply() {
      var _this7 = this;

      if (this.processed) {
        return Promise.resolve();
      }

      return runTasks(this, this.preTasks).then(function () {
        var loader = _this7.aurelia.loader;
        var info = _this7.info;
        var current = void 0;

        var next = function next() {
          current = info.shift();
          if (current) {
            return loadPlugin(_this7, loader, current).then(next);
          }

          _this7.processed = true;
          return Promise.resolve();
        };

        return next().then(function () {
          return runTasks(_this7, _this7.postTasks);
        });
      });
    };

    return FrameworkConfiguration;
  }();

  exports.FrameworkConfiguration = FrameworkConfiguration;
  var LogManager = exports.LogManager = TheLogManager;
});
define('aurelia-event-aggregator',['exports', 'aurelia-logging'], function (exports, _aureliaLogging) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.EventAggregator = undefined;
  exports.includeEventsIn = includeEventsIn;
  exports.configure = configure;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  

  var logger = LogManager.getLogger('event-aggregator');

  var Handler = function () {
    function Handler(messageType, callback) {
      

      this.messageType = messageType;
      this.callback = callback;
    }

    Handler.prototype.handle = function handle(message) {
      if (message instanceof this.messageType) {
        this.callback.call(null, message);
      }
    };

    return Handler;
  }();

  var EventAggregator = exports.EventAggregator = function () {
    function EventAggregator() {
      

      this.eventLookup = {};
      this.messageHandlers = [];
    }

    EventAggregator.prototype.publish = function publish(event, data) {
      var subscribers = void 0;
      var i = void 0;

      if (!event) {
        throw new Error('Event was invalid.');
      }

      if (typeof event === 'string') {
        subscribers = this.eventLookup[event];
        if (subscribers) {
          subscribers = subscribers.slice();
          i = subscribers.length;

          try {
            while (i--) {
              subscribers[i](data, event);
            }
          } catch (e) {
            logger.error(e);
          }
        }
      } else {
        subscribers = this.messageHandlers.slice();
        i = subscribers.length;

        try {
          while (i--) {
            subscribers[i].handle(event);
          }
        } catch (e) {
          logger.error(e);
        }
      }
    };

    EventAggregator.prototype.subscribe = function subscribe(event, callback) {
      var handler = void 0;
      var subscribers = void 0;

      if (!event) {
        throw new Error('Event channel/type was invalid.');
      }

      if (typeof event === 'string') {
        handler = callback;
        subscribers = this.eventLookup[event] || (this.eventLookup[event] = []);
      } else {
        handler = new Handler(event, callback);
        subscribers = this.messageHandlers;
      }

      subscribers.push(handler);

      return {
        dispose: function dispose() {
          var idx = subscribers.indexOf(handler);
          if (idx !== -1) {
            subscribers.splice(idx, 1);
          }
        }
      };
    };

    EventAggregator.prototype.subscribeOnce = function subscribeOnce(event, callback) {
      var sub = this.subscribe(event, function (a, b) {
        sub.dispose();
        return callback(a, b);
      });

      return sub;
    };

    return EventAggregator;
  }();

  function includeEventsIn(obj) {
    var ea = new EventAggregator();

    obj.subscribeOnce = function (event, callback) {
      return ea.subscribeOnce(event, callback);
    };

    obj.subscribe = function (event, callback) {
      return ea.subscribe(event, callback);
    };

    obj.publish = function (event, data) {
      ea.publish(event, data);
    };

    return ea;
  }

  function configure(config) {
    config.instance(EventAggregator, includeEventsIn(config.aurelia));
  }
});
define('aurelia-history',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  function mi(name) {
    throw new Error('History must implement ' + name + '().');
  }

  var History = exports.History = function () {
    function History() {
      
    }

    History.prototype.activate = function activate(options) {
      mi('activate');
    };

    History.prototype.deactivate = function deactivate() {
      mi('deactivate');
    };

    History.prototype.getAbsoluteRoot = function getAbsoluteRoot() {
      mi('getAbsoluteRoot');
    };

    History.prototype.navigate = function navigate(fragment, options) {
      mi('navigate');
    };

    History.prototype.navigateBack = function navigateBack() {
      mi('navigateBack');
    };

    History.prototype.setTitle = function setTitle(title) {
      mi('setTitle');
    };

    return History;
  }();
});
define('aurelia-history-browser',['exports', 'aurelia-pal', 'aurelia-history'], function (exports, _aureliaPal, _aureliaHistory) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.BrowserHistory = exports.DefaultLinkHandler = exports.LinkHandler = undefined;
  exports.configure = configure;

  var _class, _temp;

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  

  var LinkHandler = exports.LinkHandler = function () {
    function LinkHandler() {
      
    }

    LinkHandler.prototype.activate = function activate(history) {};

    LinkHandler.prototype.deactivate = function deactivate() {};

    return LinkHandler;
  }();

  var DefaultLinkHandler = exports.DefaultLinkHandler = function (_LinkHandler) {
    _inherits(DefaultLinkHandler, _LinkHandler);

    function DefaultLinkHandler() {
      

      var _this = _possibleConstructorReturn(this, _LinkHandler.call(this));

      _this.handler = function (e) {
        var _DefaultLinkHandler$g = DefaultLinkHandler.getEventInfo(e);

        var shouldHandleEvent = _DefaultLinkHandler$g.shouldHandleEvent;
        var href = _DefaultLinkHandler$g.href;


        if (shouldHandleEvent) {
          e.preventDefault();
          _this.history.navigate(href);
        }
      };
      return _this;
    }

    DefaultLinkHandler.prototype.activate = function activate(history) {
      if (history._hasPushState) {
        this.history = history;
        _aureliaPal.DOM.addEventListener('click', this.handler, true);
      }
    };

    DefaultLinkHandler.prototype.deactivate = function deactivate() {
      _aureliaPal.DOM.removeEventListener('click', this.handler);
    };

    DefaultLinkHandler.getEventInfo = function getEventInfo(event) {
      var info = {
        shouldHandleEvent: false,
        href: null,
        anchor: null
      };

      var target = DefaultLinkHandler.findClosestAnchor(event.target);
      if (!target || !DefaultLinkHandler.targetIsThisWindow(target)) {
        return info;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return info;
      }

      var href = target.getAttribute('href');
      info.anchor = target;
      info.href = href;

      var leftButtonClicked = event.which === 1;
      var isRelative = href && !(href.charAt(0) === '#' || /^[a-z]+:/i.test(href));

      info.shouldHandleEvent = leftButtonClicked && isRelative;
      return info;
    };

    DefaultLinkHandler.findClosestAnchor = function findClosestAnchor(el) {
      while (el) {
        if (el.tagName === 'A') {
          return el;
        }

        el = el.parentNode;
      }
    };

    DefaultLinkHandler.targetIsThisWindow = function targetIsThisWindow(target) {
      var targetWindow = target.getAttribute('target');
      var win = _aureliaPal.PLATFORM.global;

      return !targetWindow || targetWindow === win.name || targetWindow === '_self' || targetWindow === 'top' && win === win.top;
    };

    return DefaultLinkHandler;
  }(LinkHandler);

  function configure(config) {
    config.singleton(_aureliaHistory.History, BrowserHistory);
    config.transient(LinkHandler, DefaultLinkHandler);
  }

  var BrowserHistory = exports.BrowserHistory = (_temp = _class = function (_History) {
    _inherits(BrowserHistory, _History);

    function BrowserHistory(linkHandler) {
      

      var _this2 = _possibleConstructorReturn(this, _History.call(this));

      _this2._isActive = false;
      _this2._checkUrlCallback = _this2._checkUrl.bind(_this2);

      _this2.location = _aureliaPal.PLATFORM.location;
      _this2.history = _aureliaPal.PLATFORM.history;
      _this2.linkHandler = linkHandler;
      return _this2;
    }

    BrowserHistory.prototype.activate = function activate(options) {
      if (this._isActive) {
        throw new Error('History has already been activated.');
      }

      var wantsPushState = !!options.pushState;

      this._isActive = true;
      this.options = Object.assign({}, { root: '/' }, this.options, options);

      this.root = ('/' + this.options.root + '/').replace(rootStripper, '/');

      this._wantsHashChange = this.options.hashChange !== false;
      this._hasPushState = !!(this.options.pushState && this.history && this.history.pushState);

      var eventName = void 0;
      if (this._hasPushState) {
        eventName = 'popstate';
      } else if (this._wantsHashChange) {
        eventName = 'hashchange';
      }

      _aureliaPal.PLATFORM.addEventListener(eventName, this._checkUrlCallback);

      if (this._wantsHashChange && wantsPushState) {
        var loc = this.location;
        var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

        if (!this._hasPushState && !atRoot) {
          this.fragment = this._getFragment(null, true);
          this.location.replace(this.root + this.location.search + '#' + this.fragment);

          return true;
        } else if (this._hasPushState && atRoot && loc.hash) {
            this.fragment = this._getHash().replace(routeStripper, '');
            this.history.replaceState({}, _aureliaPal.DOM.title, this.root + this.fragment + loc.search);
          }
      }

      if (!this.fragment) {
        this.fragment = this._getFragment();
      }

      this.linkHandler.activate(this);

      if (!this.options.silent) {
        return this._loadUrl();
      }
    };

    BrowserHistory.prototype.deactivate = function deactivate() {
      _aureliaPal.PLATFORM.removeEventListener('popstate', this._checkUrlCallback);
      _aureliaPal.PLATFORM.removeEventListener('hashchange', this._checkUrlCallback);
      this._isActive = false;
      this.linkHandler.deactivate();
    };

    BrowserHistory.prototype.getAbsoluteRoot = function getAbsoluteRoot() {
      var origin = createOrigin(this.location.protocol, this.location.hostname, this.location.port);
      return '' + origin + this.root;
    };

    BrowserHistory.prototype.navigate = function navigate(fragment) {
      var _ref = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var _ref$trigger = _ref.trigger;
      var trigger = _ref$trigger === undefined ? true : _ref$trigger;
      var _ref$replace = _ref.replace;
      var replace = _ref$replace === undefined ? false : _ref$replace;

      if (fragment && absoluteUrl.test(fragment)) {
        this.location.href = fragment;
        return true;
      }

      if (!this._isActive) {
        return false;
      }

      fragment = this._getFragment(fragment || '');

      if (this.fragment === fragment && !replace) {
        return false;
      }

      this.fragment = fragment;

      var url = this.root + fragment;

      if (fragment === '' && url !== '/') {
        url = url.slice(0, -1);
      }

      if (this._hasPushState) {
        url = url.replace('//', '/');
        this.history[replace ? 'replaceState' : 'pushState']({}, _aureliaPal.DOM.title, url);
      } else if (this._wantsHashChange) {
        updateHash(this.location, fragment, replace);
      } else {
        return this.location.assign(url);
      }

      if (trigger) {
        return this._loadUrl(fragment);
      }
    };

    BrowserHistory.prototype.navigateBack = function navigateBack() {
      this.history.back();
    };

    BrowserHistory.prototype.setTitle = function setTitle(title) {
      _aureliaPal.DOM.title = title;
    };

    BrowserHistory.prototype._getHash = function _getHash() {
      return this.location.hash.substr(1);
    };

    BrowserHistory.prototype._getFragment = function _getFragment(fragment, forcePushState) {
      var root = void 0;

      if (!fragment) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = this.location.pathname + this.location.search;
          root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) {
            fragment = fragment.substr(root.length);
          }
        } else {
          fragment = this._getHash();
        }
      }

      return '/' + fragment.replace(routeStripper, '');
    };

    BrowserHistory.prototype._checkUrl = function _checkUrl() {
      var current = this._getFragment();
      if (current !== this.fragment) {
        this._loadUrl();
      }
    };

    BrowserHistory.prototype._loadUrl = function _loadUrl(fragmentOverride) {
      var fragment = this.fragment = this._getFragment(fragmentOverride);

      return this.options.routeHandler ? this.options.routeHandler(fragment) : false;
    };

    return BrowserHistory;
  }(_aureliaHistory.History), _class.inject = [LinkHandler], _temp);

  var routeStripper = /^#?\/*|\s+$/g;

  var rootStripper = /^\/+|\/+$/g;

  var trailingSlash = /\/$/;

  var absoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

  function updateHash(location, fragment, replace) {
    if (replace) {
      var _href = location.href.replace(/(javascript:|#).*$/, '');
      location.replace(_href + '#' + fragment);
    } else {
      location.hash = '#' + fragment;
    }
  }

  function createOrigin(protocol, hostname, port) {
    return protocol + '//' + hostname + (port ? ':' + port : '');
  }
});
define('aurelia-loader',['exports', 'aurelia-path', 'aurelia-metadata'], function (exports, _aureliaPath, _aureliaMetadata) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Loader = exports.TemplateRegistryEntry = exports.TemplateDependency = undefined;

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  

  var TemplateDependency = exports.TemplateDependency = function TemplateDependency(src, name) {
    

    this.src = src;
    this.name = name;
  };

  var TemplateRegistryEntry = exports.TemplateRegistryEntry = function () {
    function TemplateRegistryEntry(address) {
      

      this.templateIsLoaded = false;
      this.factoryIsReady = false;
      this.resources = null;
      this.dependencies = null;

      this.address = address;
      this.onReady = null;
      this._template = null;
      this._factory = null;
    }

    TemplateRegistryEntry.prototype.addDependency = function addDependency(src, name) {
      var finalSrc = typeof src === 'string' ? (0, _aureliaPath.relativeToFile)(src, this.address) : _aureliaMetadata.Origin.get(src).moduleId;

      this.dependencies.push(new TemplateDependency(finalSrc, name));
    };

    _createClass(TemplateRegistryEntry, [{
      key: 'template',
      get: function get() {
        return this._template;
      },
      set: function set(value) {
        var address = this.address;
        var requires = void 0;
        var current = void 0;
        var src = void 0;
        var dependencies = void 0;

        this._template = value;
        this.templateIsLoaded = true;

        requires = value.content.querySelectorAll('require');
        dependencies = this.dependencies = new Array(requires.length);

        for (var i = 0, ii = requires.length; i < ii; ++i) {
          current = requires[i];
          src = current.getAttribute('from');

          if (!src) {
            throw new Error('<require> element in ' + address + ' has no "from" attribute.');
          }

          dependencies[i] = new TemplateDependency((0, _aureliaPath.relativeToFile)(src, address), current.getAttribute('as'));

          if (current.parentNode) {
            current.parentNode.removeChild(current);
          }
        }
      }
    }, {
      key: 'factory',
      get: function get() {
        return this._factory;
      },
      set: function set(value) {
        this._factory = value;
        this.factoryIsReady = true;
      }
    }]);

    return TemplateRegistryEntry;
  }();

  var Loader = exports.Loader = function () {
    function Loader() {
      

      this.templateRegistry = {};
    }

    Loader.prototype.map = function map(id, source) {
      throw new Error('Loaders must implement map(id, source).');
    };

    Loader.prototype.normalizeSync = function normalizeSync(moduleId, relativeTo) {
      throw new Error('Loaders must implement normalizeSync(moduleId, relativeTo).');
    };

    Loader.prototype.normalize = function normalize(moduleId, relativeTo) {
      throw new Error('Loaders must implement normalize(moduleId: string, relativeTo: string): Promise<string>.');
    };

    Loader.prototype.loadModule = function loadModule(id) {
      throw new Error('Loaders must implement loadModule(id).');
    };

    Loader.prototype.loadAllModules = function loadAllModules(ids) {
      throw new Error('Loader must implement loadAllModules(ids).');
    };

    Loader.prototype.loadTemplate = function loadTemplate(url) {
      throw new Error('Loader must implement loadTemplate(url).');
    };

    Loader.prototype.loadText = function loadText(url) {
      throw new Error('Loader must implement loadText(url).');
    };

    Loader.prototype.applyPluginToUrl = function applyPluginToUrl(url, pluginName) {
      throw new Error('Loader must implement applyPluginToUrl(url, pluginName).');
    };

    Loader.prototype.addPlugin = function addPlugin(pluginName, implementation) {
      throw new Error('Loader must implement addPlugin(pluginName, implementation).');
    };

    Loader.prototype.getOrCreateTemplateRegistryEntry = function getOrCreateTemplateRegistryEntry(address) {
      return this.templateRegistry[address] || (this.templateRegistry[address] = new TemplateRegistryEntry(address));
    };

    return Loader;
  }();
});
define('aurelia-metadata',['exports', 'aurelia-pal'], function (exports, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Origin = exports.metadata = undefined;
  exports.decorators = decorators;
  exports.deprecated = deprecated;
  exports.mixin = mixin;
  exports.protocol = protocol;

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  

  var metadata = exports.metadata = {
    resource: 'aurelia:resource',
    paramTypes: 'design:paramtypes',
    propertyType: 'design:type',
    properties: 'design:properties',
    get: function get(metadataKey, target, targetKey) {
      if (!target) {
        return undefined;
      }
      var result = metadata.getOwn(metadataKey, target, targetKey);
      return result === undefined ? metadata.get(metadataKey, Object.getPrototypeOf(target), targetKey) : result;
    },
    getOwn: function getOwn(metadataKey, target, targetKey) {
      if (!target) {
        return undefined;
      }
      return Reflect.getOwnMetadata(metadataKey, target, targetKey);
    },
    define: function define(metadataKey, metadataValue, target, targetKey) {
      Reflect.defineMetadata(metadataKey, metadataValue, target, targetKey);
    },
    getOrCreateOwn: function getOrCreateOwn(metadataKey, Type, target, targetKey) {
      var result = metadata.getOwn(metadataKey, target, targetKey);

      if (result === undefined) {
        result = new Type();
        Reflect.defineMetadata(metadataKey, result, target, targetKey);
      }

      return result;
    }
  };

  var originStorage = new Map();
  var unknownOrigin = Object.freeze({ moduleId: undefined, moduleMember: undefined });

  var Origin = exports.Origin = function () {
    function Origin(moduleId, moduleMember) {
      

      this.moduleId = moduleId;
      this.moduleMember = moduleMember;
    }

    Origin.get = function get(fn) {
      var origin = originStorage.get(fn);

      if (origin === undefined) {
        _aureliaPal.PLATFORM.eachModule(function (key, value) {
          for (var name in value) {
            var exp = value[name];
            if (exp === fn) {
              originStorage.set(fn, origin = new Origin(key, name));
              return true;
            }
          }

          if (value === fn) {
            originStorage.set(fn, origin = new Origin(key, 'default'));
            return true;
          }

          return false;
        });
      }

      return origin || unknownOrigin;
    };

    Origin.set = function set(fn, origin) {
      originStorage.set(fn, origin);
    };

    return Origin;
  }();

  function decorators() {
    for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
      rest[_key] = arguments[_key];
    }

    var applicator = function applicator(target, key, descriptor) {
      var i = rest.length;

      if (key) {
        descriptor = descriptor || {
          value: target[key],
          writable: true,
          configurable: true,
          enumerable: true
        };

        while (i--) {
          descriptor = rest[i](target, key, descriptor) || descriptor;
        }

        Object.defineProperty(target, key, descriptor);
      } else {
        while (i--) {
          target = rest[i](target) || target;
        }
      }

      return target;
    };

    applicator.on = applicator;
    return applicator;
  }

  function deprecated(optionsOrTarget, maybeKey, maybeDescriptor) {
    function decorator(target, key, descriptor) {
      var methodSignature = target.constructor.name + '#' + key;
      var options = maybeKey ? {} : optionsOrTarget || {};
      var message = 'DEPRECATION - ' + methodSignature;

      if (typeof descriptor.value !== 'function') {
        throw new SyntaxError('Only methods can be marked as deprecated.');
      }

      if (options.message) {
        message += ' - ' + options.message;
      }

      return _extends({}, descriptor, {
        value: function deprecationWrapper() {
          if (options.error) {
            throw new Error(message);
          } else {
            console.warn(message);
          }

          return descriptor.value.apply(this, arguments);
        }
      });
    }

    return maybeKey ? decorator(optionsOrTarget, maybeKey, maybeDescriptor) : decorator;
  }

  function mixin(behavior) {
    var instanceKeys = Object.keys(behavior);

    function _mixin(possible) {
      var decorator = function decorator(target) {
        var resolvedTarget = typeof target === 'function' ? target.prototype : target;

        var i = instanceKeys.length;
        while (i--) {
          var property = instanceKeys[i];
          Object.defineProperty(resolvedTarget, property, {
            value: behavior[property],
            writable: true
          });
        }
      };

      return possible ? decorator(possible) : decorator;
    }

    return _mixin;
  }

  function alwaysValid() {
    return true;
  }
  function noCompose() {}

  function ensureProtocolOptions(options) {
    if (options === undefined) {
      options = {};
    } else if (typeof options === 'function') {
      options = {
        validate: options
      };
    }

    if (!options.validate) {
      options.validate = alwaysValid;
    }

    if (!options.compose) {
      options.compose = noCompose;
    }

    return options;
  }

  function createProtocolValidator(validate) {
    return function (target) {
      var result = validate(target);
      return result === true;
    };
  }

  function createProtocolAsserter(name, validate) {
    return function (target) {
      var result = validate(target);
      if (result !== true) {
        throw new Error(result || name + ' was not correctly implemented.');
      }
    };
  }

  function protocol(name, options) {
    options = ensureProtocolOptions(options);

    var result = function result(target) {
      var resolvedTarget = typeof target === 'function' ? target.prototype : target;

      options.compose(resolvedTarget);
      result.assert(resolvedTarget);

      Object.defineProperty(resolvedTarget, 'protocol:' + name, {
        enumerable: false,
        configurable: false,
        writable: false,
        value: true
      });
    };

    result.validate = createProtocolValidator(options.validate);
    result.assert = createProtocolAsserter(name, options.validate);

    return result;
  }

  protocol.create = function (name, options) {
    options = ensureProtocolOptions(options);
    var hidden = 'protocol:' + name;
    var result = function result(target) {
      var decorator = protocol(name, options);
      return target ? decorator(target) : decorator;
    };

    result.decorates = function (obj) {
      return obj[hidden] === true;
    };
    result.validate = createProtocolValidator(options.validate);
    result.assert = createProtocolAsserter(name, options.validate);

    return result;
  };
});
define('aurelia-loader-default',['exports', 'aurelia-loader', 'aurelia-pal', 'aurelia-metadata'], function (exports, _aureliaLoader, _aureliaPal, _aureliaMetadata) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DefaultLoader = exports.TextTemplateLoader = undefined;

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  

  var TextTemplateLoader = exports.TextTemplateLoader = function () {
    function TextTemplateLoader() {
      
    }

    TextTemplateLoader.prototype.loadTemplate = function loadTemplate(loader, entry) {
      return loader.loadText(entry.address).then(function (text) {
        entry.template = _aureliaPal.DOM.createTemplateFromMarkup(text);
      });
    };

    return TextTemplateLoader;
  }();

  function ensureOriginOnExports(executed, name) {
    var target = executed;
    var key = void 0;
    var exportedValue = void 0;

    if (target.__useDefault) {
      target = target['default'];
    }

    _aureliaMetadata.Origin.set(target, new _aureliaMetadata.Origin(name, 'default'));

    for (key in target) {
      exportedValue = target[key];

      if (typeof exportedValue === 'function') {
        _aureliaMetadata.Origin.set(exportedValue, new _aureliaMetadata.Origin(name, key));
      }
    }

    return executed;
  }

  var DefaultLoader = exports.DefaultLoader = function (_Loader) {
    _inherits(DefaultLoader, _Loader);

    function DefaultLoader() {
      

      var _this = _possibleConstructorReturn(this, _Loader.call(this));

      _this.textPluginName = 'text';


      _this.moduleRegistry = Object.create(null);
      _this.useTemplateLoader(new TextTemplateLoader());

      var that = _this;

      _this.addPlugin('template-registry-entry', {
        'fetch': function fetch(address) {
          var entry = that.getOrCreateTemplateRegistryEntry(address);
          return entry.templateIsLoaded ? entry : that.templateLoader.loadTemplate(that, entry).then(function (x) {
            return entry;
          });
        }
      });
      return _this;
    }

    DefaultLoader.prototype.useTemplateLoader = function useTemplateLoader(templateLoader) {
      this.templateLoader = templateLoader;
    };

    DefaultLoader.prototype.loadAllModules = function loadAllModules(ids) {
      var loads = [];

      for (var i = 0, ii = ids.length; i < ii; ++i) {
        loads.push(this.loadModule(ids[i]));
      }

      return Promise.all(loads);
    };

    DefaultLoader.prototype.loadTemplate = function loadTemplate(url) {
      return this._import(this.applyPluginToUrl(url, 'template-registry-entry'));
    };

    DefaultLoader.prototype.loadText = function loadText(url) {
      return this._import(this.applyPluginToUrl(url, this.textPluginName)).then(function (textOrModule) {
        if (typeof textOrModule === 'string') {
          return textOrModule;
        }

        return textOrModule['default'];
      });
    };

    return DefaultLoader;
  }(_aureliaLoader.Loader);

  _aureliaPal.PLATFORM.Loader = DefaultLoader;

  if (!_aureliaPal.PLATFORM.global.System || !_aureliaPal.PLATFORM.global.System.import) {
    if (_aureliaPal.PLATFORM.global.requirejs && requirejs.s && requirejs.s.contexts && requirejs.s.contexts._ && requirejs.s.contexts._.defined) {
      _aureliaPal.PLATFORM.eachModule = function (callback) {
        var defined = requirejs.s.contexts._.defined;
        for (var key in defined) {
          try {
            if (callback(key, defined[key])) return;
          } catch (e) {}
        }
      };
    } else {
      _aureliaPal.PLATFORM.eachModule = function (callback) {};
    }

    DefaultLoader.prototype._import = function (moduleId) {
      return new Promise(function (resolve, reject) {
        require([moduleId], resolve, reject);
      });
    };

    DefaultLoader.prototype.loadModule = function (id) {
      var _this2 = this;

      var existing = this.moduleRegistry[id];
      if (existing !== undefined) {
        return Promise.resolve(existing);
      }

      return new Promise(function (resolve, reject) {
        require([id], function (m) {
          _this2.moduleRegistry[id] = m;
          resolve(ensureOriginOnExports(m, id));
        }, reject);
      });
    };

    DefaultLoader.prototype.map = function (id, source) {};

    DefaultLoader.prototype.normalize = function (moduleId, relativeTo) {
      return Promise.resolve(moduleId);
    };

    DefaultLoader.prototype.normalizeSync = function (moduleId, relativeTo) {
      return moduleId;
    };

    DefaultLoader.prototype.applyPluginToUrl = function (url, pluginName) {
      return pluginName + '!' + url;
    };

    DefaultLoader.prototype.addPlugin = function (pluginName, implementation) {
      var nonAnonDefine = define;
      nonAnonDefine(pluginName, [], {
        'load': function load(name, req, onload) {
          var result = implementation.fetch(name);
          Promise.resolve(result).then(onload);
        }
      });
    };
  } else {
    _aureliaPal.PLATFORM.eachModule = function (callback) {
      var modules = System._loader.modules;

      for (var key in modules) {
        try {
          if (callback(key, modules[key].module)) return;
        } catch (e) {}
      }
    };

    System.set('text', System.newModule({
      'translate': function translate(load) {
        return 'module.exports = "' + load.source.replace(/(["\\])/g, '\\$1').replace(/[\f]/g, '\\f').replace(/[\b]/g, '\\b').replace(/[\n]/g, '\\n').replace(/[\t]/g, '\\t').replace(/[\r]/g, '\\r').replace(/[\u2028]/g, '\\u2028').replace(/[\u2029]/g, '\\u2029') + '";';
      }
    }));

    DefaultLoader.prototype._import = function (moduleId) {
      return System.import(moduleId);
    };

    DefaultLoader.prototype.loadModule = function (id) {
      var _this3 = this;

      return System.normalize(id).then(function (newId) {
        var existing = _this3.moduleRegistry[newId];
        if (existing !== undefined) {
          return Promise.resolve(existing);
        }

        return System.import(newId).then(function (m) {
          _this3.moduleRegistry[newId] = m;
          return ensureOriginOnExports(m, newId);
        });
      });
    };

    DefaultLoader.prototype.map = function (id, source) {
      System.map[id] = source;
    };

    DefaultLoader.prototype.normalizeSync = function (moduleId, relativeTo) {
      return System.normalizeSync(moduleId, relativeTo);
    };

    DefaultLoader.prototype.normalize = function (moduleId, relativeTo) {
      return System.normalize(moduleId, relativeTo);
    };

    DefaultLoader.prototype.applyPluginToUrl = function (url, pluginName) {
      return url + '!' + pluginName;
    };

    DefaultLoader.prototype.addPlugin = function (pluginName, implementation) {
      System.set(pluginName, System.newModule({
        'fetch': function fetch(load, _fetch) {
          var result = implementation.fetch(load.address);
          return Promise.resolve(result).then(function (x) {
            load.metadata.result = x;
            return '';
          });
        },
        'instantiate': function instantiate(load) {
          return load.metadata.result;
        }
      }));
    };
  }
});
define('aurelia-pal',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AggregateError = AggregateError;
  exports.initializePAL = initializePAL;
  function AggregateError(message, innerError, skipIfAlreadyAggregate) {
    if (innerError) {
      if (innerError.innerError && skipIfAlreadyAggregate) {
        return innerError;
      }

      var separator = '\n------------------------------------------------\n';

      message += separator + 'Inner Error:\n';

      if (typeof innerError === 'string') {
        message += 'Message: ' + innerError;
      } else {
        if (innerError.message) {
          message += 'Message: ' + innerError.message;
        } else {
          message += 'Unknown Inner Error Type. Displaying Inner Error as JSON:\n ' + JSON.stringify(innerError, null, '  ');
        }

        if (innerError.stack) {
          message += '\nInner Error Stack:\n' + innerError.stack;
          message += '\nEnd Inner Error Stack';
        }
      }

      message += separator;
    }

    var e = new Error(message);
    if (innerError) {
      e.innerError = innerError;
    }

    return e;
  }

  var FEATURE = exports.FEATURE = {};

  var PLATFORM = exports.PLATFORM = {
    noop: function noop() {},
    eachModule: function eachModule() {}
  };

  PLATFORM.global = function () {
    if (typeof self !== 'undefined') {
      return self;
    }

    if (typeof global !== 'undefined') {
      return global;
    }

    return new Function('return this')();
  }();

  var DOM = exports.DOM = {};

  function initializePAL(callback) {
    if (typeof Object.getPropertyDescriptor !== 'function') {
      Object.getPropertyDescriptor = function (subject, name) {
        var pd = Object.getOwnPropertyDescriptor(subject, name);
        var proto = Object.getPrototypeOf(subject);
        while (typeof pd === 'undefined' && proto !== null) {
          pd = Object.getOwnPropertyDescriptor(proto, name);
          proto = Object.getPrototypeOf(proto);
        }
        return pd;
      };
    }

    callback(PLATFORM, FEATURE, DOM);
  }
});
define('aurelia-polyfills',['aurelia-pal'], function (_aureliaPal) {
  'use strict';

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  (function (Object, GOPS) {
    'use strict';

    if (GOPS in Object) return;

    var setDescriptor,
        G = _aureliaPal.PLATFORM.global,
        id = 0,
        random = '' + Math.random(),
        prefix = '__\x01symbol:',
        prefixLength = prefix.length,
        internalSymbol = '__\x01symbol@@' + random,
        DP = 'defineProperty',
        DPies = 'defineProperties',
        GOPN = 'getOwnPropertyNames',
        GOPD = 'getOwnPropertyDescriptor',
        PIE = 'propertyIsEnumerable',
        gOPN = Object[GOPN],
        gOPD = Object[GOPD],
        create = Object.create,
        keys = Object.keys,
        defineProperty = Object[DP],
        $defineProperties = Object[DPies],
        descriptor = gOPD(Object, GOPN),
        ObjectProto = Object.prototype,
        hOP = ObjectProto.hasOwnProperty,
        pIE = ObjectProto[PIE],
        toString = ObjectProto.toString,
        indexOf = Array.prototype.indexOf || function (v) {
      for (var i = this.length; i-- && this[i] !== v;) {}
      return i;
    },
        addInternalIfNeeded = function addInternalIfNeeded(o, uid, enumerable) {
      if (!hOP.call(o, internalSymbol)) {
        defineProperty(o, internalSymbol, {
          enumerable: false,
          configurable: false,
          writable: false,
          value: {}
        });
      }
      o[internalSymbol]['@@' + uid] = enumerable;
    },
        createWithSymbols = function createWithSymbols(proto, descriptors) {
      var self = create(proto);
      gOPN(descriptors).forEach(function (key) {
        if (propertyIsEnumerable.call(descriptors, key)) {
          $defineProperty(self, key, descriptors[key]);
        }
      });
      return self;
    },
        copyAsNonEnumerable = function copyAsNonEnumerable(descriptor) {
      var newDescriptor = create(descriptor);
      newDescriptor.enumerable = false;
      return newDescriptor;
    },
        get = function get() {},
        onlyNonSymbols = function onlyNonSymbols(name) {
      return name != internalSymbol && !hOP.call(source, name);
    },
        onlySymbols = function onlySymbols(name) {
      return name != internalSymbol && hOP.call(source, name);
    },
        propertyIsEnumerable = function propertyIsEnumerable(key) {
      var uid = '' + key;
      return onlySymbols(uid) ? hOP.call(this, uid) && this[internalSymbol]['@@' + uid] : pIE.call(this, key);
    },
        setAndGetSymbol = function setAndGetSymbol(uid) {
      var descriptor = {
        enumerable: false,
        configurable: true,
        get: get,
        set: function set(value) {
          setDescriptor(this, uid, {
            enumerable: false,
            configurable: true,
            writable: true,
            value: value
          });
          addInternalIfNeeded(this, uid, true);
        }
      };
      defineProperty(ObjectProto, uid, descriptor);
      return source[uid] = defineProperty(Object(uid), 'constructor', sourceConstructor);
    },
        _Symbol = function _Symbol2(description) {
      if (this && this !== G) {
        throw new TypeError('Symbol is not a constructor');
      }
      return setAndGetSymbol(prefix.concat(description || '', random, ++id));
    },
        source = create(null),
        sourceConstructor = { value: _Symbol },
        sourceMap = function sourceMap(uid) {
      return source[uid];
    },
        $defineProperty = function defineProp(o, key, descriptor) {
      var uid = '' + key;
      if (onlySymbols(uid)) {
        setDescriptor(o, uid, descriptor.enumerable ? copyAsNonEnumerable(descriptor) : descriptor);
        addInternalIfNeeded(o, uid, !!descriptor.enumerable);
      } else {
        defineProperty(o, key, descriptor);
      }
      return o;
    },
        $getOwnPropertySymbols = function getOwnPropertySymbols(o) {
      var cof = toString.call(o);
      o = cof === '[object String]' ? o.split('') : Object(o);
      return gOPN(o).filter(onlySymbols).map(sourceMap);
    };

    descriptor.value = $defineProperty;
    defineProperty(Object, DP, descriptor);

    descriptor.value = $getOwnPropertySymbols;
    defineProperty(Object, GOPS, descriptor);

    descriptor.value = function getOwnPropertyNames(o) {
      return gOPN(o).filter(onlyNonSymbols);
    };
    defineProperty(Object, GOPN, descriptor);

    descriptor.value = function defineProperties(o, descriptors) {
      var symbols = $getOwnPropertySymbols(descriptors);
      if (symbols.length) {
        keys(descriptors).concat(symbols).forEach(function (uid) {
          if (propertyIsEnumerable.call(descriptors, uid)) {
            $defineProperty(o, uid, descriptors[uid]);
          }
        });
      } else {
        $defineProperties(o, descriptors);
      }
      return o;
    };
    defineProperty(Object, DPies, descriptor);

    descriptor.value = propertyIsEnumerable;
    defineProperty(ObjectProto, PIE, descriptor);

    descriptor.value = _Symbol;
    defineProperty(G, 'Symbol', descriptor);

    descriptor.value = function (key) {
      var uid = prefix.concat(prefix, key, random);
      return uid in ObjectProto ? source[uid] : setAndGetSymbol(uid);
    };
    defineProperty(_Symbol, 'for', descriptor);

    descriptor.value = function (symbol) {
      return hOP.call(source, symbol) ? symbol.slice(prefixLength * 2, -random.length) : void 0;
    };
    defineProperty(_Symbol, 'keyFor', descriptor);

    descriptor.value = function getOwnPropertyDescriptor(o, key) {
      var descriptor = gOPD(o, key);
      if (descriptor && onlySymbols(key)) {
        descriptor.enumerable = propertyIsEnumerable.call(o, key);
      }
      return descriptor;
    };
    defineProperty(Object, GOPD, descriptor);

    descriptor.value = function (proto, descriptors) {
      return arguments.length === 1 ? create(proto) : createWithSymbols(proto, descriptors);
    };
    defineProperty(Object, 'create', descriptor);

    descriptor.value = function () {
      var str = toString.call(this);
      return str === '[object String]' && onlySymbols(this) ? '[object Symbol]' : str;
    };
    defineProperty(ObjectProto, 'toString', descriptor);

    try {
      setDescriptor = create(defineProperty({}, prefix, {
        get: function get() {
          return defineProperty(this, prefix, { value: false })[prefix];
        }
      }))[prefix] || defineProperty;
    } catch (o_O) {
      setDescriptor = function setDescriptor(o, key, descriptor) {
        var protoDescriptor = gOPD(ObjectProto, key);
        delete ObjectProto[key];
        defineProperty(o, key, descriptor);
        defineProperty(ObjectProto, key, protoDescriptor);
      };
    }
  })(Object, 'getOwnPropertySymbols');

  (function (O, S) {
    var dP = O.defineProperty,
        ObjectProto = O.prototype,
        toString = ObjectProto.toString,
        toStringTag = 'toStringTag',
        descriptor;
    ['iterator', 'match', 'replace', 'search', 'split', 'hasInstance', 'isConcatSpreadable', 'unscopables', 'species', 'toPrimitive', toStringTag].forEach(function (name) {
      if (!(name in Symbol)) {
        dP(Symbol, name, { value: Symbol(name) });
        switch (name) {
          case toStringTag:
            descriptor = O.getOwnPropertyDescriptor(ObjectProto, 'toString');
            descriptor.value = function () {
              var str = toString.call(this),
                  tst = typeof this === 'undefined' || this === null ? undefined : this[Symbol.toStringTag];
              return typeof tst === 'undefined' ? str : '[object ' + tst + ']';
            };
            dP(ObjectProto, 'toString', descriptor);
            break;
        }
      }
    });
  })(Object, Symbol);

  (function (Si, AP, SP) {

    function returnThis() {
      return this;
    }

    if (!AP[Si]) AP[Si] = function () {
      var i = 0,
          self = this,
          iterator = {
        next: function next() {
          var done = self.length <= i;
          return done ? { done: done } : { done: done, value: self[i++] };
        }
      };
      iterator[Si] = returnThis;
      return iterator;
    };

    if (!SP[Si]) SP[Si] = function () {
      var fromCodePoint = String.fromCodePoint,
          self = this,
          i = 0,
          length = self.length,
          iterator = {
        next: function next() {
          var done = length <= i,
              c = done ? '' : fromCodePoint(self.codePointAt(i));
          i += c.length;
          return done ? { done: done } : { done: done, value: c };
        }
      };
      iterator[Si] = returnThis;
      return iterator;
    };
  })(Symbol.iterator, Array.prototype, String.prototype);

  Number.isNaN = Number.isNaN || function (value) {
    return value !== value;
  };

  Number.isFinite = Number.isFinite || function (value) {
    return typeof value === "number" && isFinite(value);
  };
  if (!String.prototype.endsWith || function () {
    try {
      return !"ab".endsWith("a", 1);
    } catch (e) {
      return true;
    }
  }()) {
    String.prototype.endsWith = function (searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    };
  }

  if (!String.prototype.startsWith || function () {
    try {
      return !"ab".startsWith("b", 1);
    } catch (e) {
      return true;
    }
  }()) {
    String.prototype.startsWith = function (searchString, position) {
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
    };
  }

  if (!Array.from) {
    Array.from = function () {
      var toInteger = function toInteger(it) {
        return isNaN(it = +it) ? 0 : (it > 0 ? Math.floor : Math.ceil)(it);
      };
      var toLength = function toLength(it) {
        return it > 0 ? Math.min(toInteger(it), 0x1fffffffffffff) : 0;
      };
      var iterCall = function iterCall(iter, fn, a1, a2) {
        try {
          fn(a1, a2);
        } catch (E) {
          if (typeof iter.return == 'function') iter.return();
          throw E;
        }
      };

      return function from(arrayLike) {
        var O = Object(arrayLike),
            C = typeof this == 'function' ? this : Array,
            aLen = arguments.length,
            mapfn = aLen > 1 ? arguments[1] : undefined,
            mapping = mapfn !== undefined,
            index = 0,
            iterFn = O[Symbol.iterator],
            length,
            result,
            step,
            iterator;
        if (mapping) mapfn = mapfn.bind(aLen > 2 ? arguments[2] : undefined);
        if (iterFn != undefined && !Array.isArray(arrayLike)) {
          for (iterator = iterFn.call(O), result = new C(); !(step = iterator.next()).done; index++) {
            result[index] = mapping ? iterCall(mapfn, step.value, index) : step.value;
          }
        } else {
          length = toLength(O.length);
          for (result = new C(length); length > index; index++) {
            result[index] = mapping ? mapfn(O[index], index) : O[index];
          }
        }
        result.length = index;
        return result;
      };
    }();
  }

  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function value(predicate) {
        if (this === null) {
          throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return value;
          }
        }
        return undefined;
      }
    });
  }

  if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function value(predicate) {
        if (this === null) {
          throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return i;
          }
        }
        return -1;
      }
    });
  }

  if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function value(searchElement) {
        var O = Object(this);
        var len = parseInt(O.length) || 0;
        if (len === 0) {
          return false;
        }
        var n = parseInt(arguments[1]) || 0;
        var k;
        if (n >= 0) {
          k = n;
        } else {
          k = len + n;
          if (k < 0) {
            k = 0;
          }
        }
        var currentElement;
        while (k < len) {
          currentElement = O[k];
          if (searchElement === currentElement || searchElement !== searchElement && currentElement !== currentElement) {
            return true;
          }
          k++;
        }
        return false;
      }
    });
  }

  (function () {
    var needsFix = false;

    try {
      var s = Object.keys('a');
      needsFix = s.length !== 1 || s[0] !== '0';
    } catch (e) {
      needsFix = true;
    }

    if (needsFix) {
      Object.keys = function () {
        var hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !{ toString: null }.propertyIsEnumerable('toString'),
            dontEnums = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'],
            dontEnumsLength = dontEnums.length;

        return function (obj) {
          if (obj === undefined || obj === null) {
            throw TypeError('Cannot convert undefined or null to object');
          }

          obj = Object(obj);

          var result = [],
              prop,
              i;

          for (prop in obj) {
            if (hasOwnProperty.call(obj, prop)) {
              result.push(prop);
            }
          }

          if (hasDontEnumBug) {
            for (i = 0; i < dontEnumsLength; i++) {
              if (hasOwnProperty.call(obj, dontEnums[i])) {
                result.push(dontEnums[i]);
              }
            }
          }

          return result;
        };
      }();
    }
  })();

  (function (O) {
    if ('assign' in O) {
      return;
    }

    O.defineProperty(O, 'assign', {
      configurable: true,
      writable: true,
      value: function () {
        var gOPS = O.getOwnPropertySymbols,
            pIE = O.propertyIsEnumerable,
            filterOS = gOPS ? function (self) {
          return gOPS(self).filter(pIE, self);
        } : function () {
          return Array.prototype;
        };

        return function assign(where) {
          if (gOPS && !(where instanceof O)) {
            console.warn('problematic Symbols', where);
          }

          function set(keyOrSymbol) {
            where[keyOrSymbol] = arg[keyOrSymbol];
          }

          for (var i = 1, ii = arguments.length; i < ii; ++i) {
            var arg = arguments[i];

            if (arg === null || arg === undefined) {
              continue;
            }

            O.keys(arg).concat(filterOS(arg)).forEach(set);
          }

          return where;
        };
      }()
    });
  })(Object);

  (function (global) {
    var i;

    var defineProperty = Object.defineProperty,
        is = function is(a, b) {
      return a === b || a !== a && b !== b;
    };

    if (typeof WeakMap == 'undefined') {
      global.WeakMap = createCollection({
        'delete': sharedDelete,

        clear: sharedClear,

        get: sharedGet,

        has: mapHas,

        set: sharedSet
      }, true);
    }

    if (typeof Map == 'undefined' || typeof new Map().values !== 'function' || !new Map().values().next) {
      var _createCollection;

      global.Map = createCollection((_createCollection = {
        'delete': sharedDelete,

        has: mapHas,

        get: sharedGet,

        set: sharedSet,

        keys: sharedKeys,

        values: sharedValues,

        entries: mapEntries,

        forEach: sharedForEach,

        clear: sharedClear
      }, _createCollection[Symbol.iterator] = mapEntries, _createCollection));
    }

    if (typeof Set == 'undefined' || typeof new Set().values !== 'function' || !new Set().values().next) {
      var _createCollection2;

      global.Set = createCollection((_createCollection2 = {
        has: setHas,

        add: sharedAdd,

        'delete': sharedDelete,

        clear: sharedClear,

        keys: sharedValues,
        values: sharedValues,

        entries: setEntries,

        forEach: sharedForEach
      }, _createCollection2[Symbol.iterator] = sharedValues, _createCollection2));
    }

    if (typeof WeakSet == 'undefined') {
      global.WeakSet = createCollection({
        'delete': sharedDelete,

        add: sharedAdd,

        clear: sharedClear,

        has: setHas
      }, true);
    }

    function createCollection(proto, objectOnly) {
      function Collection(a) {
        if (!this || this.constructor !== Collection) return new Collection(a);
        this._keys = [];
        this._values = [];
        this._itp = [];
        this.objectOnly = objectOnly;

        if (a) init.call(this, a);
      }

      if (!objectOnly) {
        defineProperty(proto, 'size', {
          get: sharedSize
        });
      }

      proto.constructor = Collection;
      Collection.prototype = proto;

      return Collection;
    }

    function init(a) {
      var i;

      if (this.add) a.forEach(this.add, this);else a.forEach(function (a) {
          this.set(a[0], a[1]);
        }, this);
    }

    function sharedDelete(key) {
      if (this.has(key)) {
        this._keys.splice(i, 1);
        this._values.splice(i, 1);

        this._itp.forEach(function (p) {
          if (i < p[0]) p[0]--;
        });
      }

      return -1 < i;
    };

    function sharedGet(key) {
      return this.has(key) ? this._values[i] : undefined;
    }

    function has(list, key) {
      if (this.objectOnly && key !== Object(key)) throw new TypeError("Invalid value used as weak collection key");

      if (key != key || key === 0) for (i = list.length; i-- && !is(list[i], key);) {} else i = list.indexOf(key);
      return -1 < i;
    }

    function setHas(value) {
      return has.call(this, this._values, value);
    }

    function mapHas(value) {
      return has.call(this, this._keys, value);
    }

    function sharedSet(key, value) {
      this.has(key) ? this._values[i] = value : this._values[this._keys.push(key) - 1] = value;
      return this;
    }

    function sharedAdd(value) {
      if (!this.has(value)) this._values.push(value);
      return this;
    }

    function sharedClear() {
      (this._keys || 0).length = this._values.length = 0;
    }

    function sharedKeys() {
      return sharedIterator(this._itp, this._keys);
    }

    function sharedValues() {
      return sharedIterator(this._itp, this._values);
    }

    function mapEntries() {
      return sharedIterator(this._itp, this._keys, this._values);
    }

    function setEntries() {
      return sharedIterator(this._itp, this._values, this._values);
    }

    function sharedIterator(itp, array, array2) {
      var _ref;

      var p = [0],
          done = false;
      itp.push(p);
      return _ref = {}, _ref[Symbol.iterator] = function () {
        return this;
      }, _ref.next = function next() {
        var v,
            k = p[0];
        if (!done && k < array.length) {
          v = array2 ? [array[k], array2[k]] : array[k];
          p[0]++;
        } else {
          done = true;
          itp.splice(itp.indexOf(p), 1);
        }
        return { done: done, value: v };
      }, _ref;
    }

    function sharedSize() {
      return this._values.length;
    }

    function sharedForEach(callback, context) {
      var it = this.entries();
      for (;;) {
        var r = it.next();
        if (r.done) break;
        callback.call(context, r.value[1], r.value[0], this);
      }
    }
  })(_aureliaPal.PLATFORM.global);

  var emptyMetadata = Object.freeze({});
  var metadataContainerKey = '__metadata__';
  var bind = Function.prototype.bind;

  if (typeof _aureliaPal.PLATFORM.global.Reflect === 'undefined') {
    _aureliaPal.PLATFORM.global.Reflect = {};
  }

  if (typeof Reflect.getOwnMetadata !== 'function') {
    Reflect.getOwnMetadata = function (metadataKey, target, targetKey) {
      if (target.hasOwnProperty(metadataContainerKey)) {
        return (target[metadataContainerKey][targetKey] || emptyMetadata)[metadataKey];
      }
    };
  }

  if (typeof Reflect.defineMetadata !== 'function') {
    Reflect.defineMetadata = function (metadataKey, metadataValue, target, targetKey) {
      var metadataContainer = target.hasOwnProperty(metadataContainerKey) ? target[metadataContainerKey] : target[metadataContainerKey] = {};
      var targetContainer = metadataContainer[targetKey] || (metadataContainer[targetKey] = {});
      targetContainer[metadataKey] = metadataValue;
    };
  }

  if (typeof Reflect.metadata !== 'function') {
    Reflect.metadata = function (metadataKey, metadataValue) {
      return function (target, targetKey) {
        Reflect.defineMetadata(metadataKey, metadataValue, target, targetKey);
      };
    };
  }

  if (typeof Reflect.defineProperty !== 'function') {
    Reflect.defineProperty = function (target, propertyKey, descriptor) {
      if ((typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' ? target === null : typeof target !== 'function') {
        throw new TypeError('Reflect.defineProperty called on non-object');
      }
      try {
        Object.defineProperty(target, propertyKey, descriptor);
        return true;
      } catch (e) {
        return false;
      }
    };
  }

  if (typeof Reflect.construct !== 'function') {
    Reflect.construct = function (Target, args) {
      if (args) {
        switch (args.length) {
          case 0:
            return new Target();
          case 1:
            return new Target(args[0]);
          case 2:
            return new Target(args[0], args[1]);
          case 3:
            return new Target(args[0], args[1], args[2]);
          case 4:
            return new Target(args[0], args[1], args[2], args[3]);
        }
      }

      var a = [null];
      a.push.apply(a, args);
      return new (bind.apply(Target, a))();
    };
  }
});
define('aurelia-logging-console',['exports', 'aurelia-logging'], function (exports, _aureliaLogging) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ConsoleAppender = undefined;

  

  var ConsoleAppender = exports.ConsoleAppender = function () {
    function ConsoleAppender() {
      
    }

    ConsoleAppender.prototype.debug = function debug(logger) {
      var _console;

      for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        rest[_key - 1] = arguments[_key];
      }

      (_console = console).debug.apply(_console, ['DEBUG [' + logger.id + ']'].concat(rest));
    };

    ConsoleAppender.prototype.info = function info(logger) {
      var _console2;

      for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        rest[_key2 - 1] = arguments[_key2];
      }

      (_console2 = console).info.apply(_console2, ['INFO [' + logger.id + ']'].concat(rest));
    };

    ConsoleAppender.prototype.warn = function warn(logger) {
      var _console3;

      for (var _len3 = arguments.length, rest = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        rest[_key3 - 1] = arguments[_key3];
      }

      (_console3 = console).warn.apply(_console3, ['WARN [' + logger.id + ']'].concat(rest));
    };

    ConsoleAppender.prototype.error = function error(logger) {
      var _console4;

      for (var _len4 = arguments.length, rest = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        rest[_key4 - 1] = arguments[_key4];
      }

      (_console4 = console).error.apply(_console4, ['ERROR [' + logger.id + ']'].concat(rest));
    };

    return ConsoleAppender;
  }();
});
define('aurelia-pal-browser',['exports', 'aurelia-pal'], function (exports, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports._DOM = exports._FEATURE = exports._PLATFORM = undefined;
  exports._ensureFunctionName = _ensureFunctionName;
  exports._ensureClassList = _ensureClassList;
  exports._ensurePerformance = _ensurePerformance;
  exports._ensureCustomEvent = _ensureCustomEvent;
  exports._ensureElementMatches = _ensureElementMatches;
  exports._ensureHTMLTemplateElement = _ensureHTMLTemplateElement;
  exports.initialize = initialize;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var _PLATFORM = exports._PLATFORM = {
    location: window.location,
    history: window.history,
    addEventListener: function addEventListener(eventName, callback, capture) {
      this.global.addEventListener(eventName, callback, capture);
    },
    removeEventListener: function removeEventListener(eventName, callback, capture) {
      this.global.removeEventListener(eventName, callback, capture);
    },

    performance: window.performance,
    requestAnimationFrame: function requestAnimationFrame(callback) {
      return this.global.requestAnimationFrame(callback);
    }
  };

  function _ensureFunctionName() {
    function test() {}

    if (!test.name) {
      Object.defineProperty(Function.prototype, 'name', {
        get: function get() {
          var name = this.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];

          Object.defineProperty(this, 'name', { value: name });
          return name;
        }
      });
    }
  }

  function _ensureClassList() {
    if (!('classList' in document.createElement('_')) || document.createElementNS && !('classList' in document.createElementNS('http://www.w3.org/2000/svg', 'g'))) {
      (function () {
        var protoProp = 'prototype';
        var strTrim = String.prototype.trim;
        var arrIndexOf = Array.prototype.indexOf;
        var emptyArray = [];

        var DOMEx = function DOMEx(type, message) {
          this.name = type;
          this.code = DOMException[type];
          this.message = message;
        };

        var checkTokenAndGetIndex = function checkTokenAndGetIndex(classList, token) {
          if (token === '') {
            throw new DOMEx('SYNTAX_ERR', 'An invalid or illegal string was specified');
          }

          if (/\s/.test(token)) {
            throw new DOMEx('INVALID_CHARACTER_ERR', 'String contains an invalid character');
          }

          return arrIndexOf.call(classList, token);
        };

        var ClassList = function ClassList(elem) {
          var trimmedClasses = strTrim.call(elem.getAttribute('class') || '');
          var classes = trimmedClasses ? trimmedClasses.split(/\s+/) : emptyArray;

          for (var i = 0, ii = classes.length; i < ii; ++i) {
            this.push(classes[i]);
          }

          this._updateClassName = function () {
            elem.setAttribute('class', this.toString());
          };
        };

        var classListProto = ClassList[protoProp] = [];

        DOMEx[protoProp] = Error[protoProp];

        classListProto.item = function (i) {
          return this[i] || null;
        };

        classListProto.contains = function (token) {
          token += '';
          return checkTokenAndGetIndex(this, token) !== -1;
        };

        classListProto.add = function () {
          var tokens = arguments;
          var i = 0;
          var ii = tokens.length;
          var token = void 0;
          var updated = false;

          do {
            token = tokens[i] + '';
            if (checkTokenAndGetIndex(this, token) === -1) {
              this.push(token);
              updated = true;
            }
          } while (++i < ii);

          if (updated) {
            this._updateClassName();
          }
        };

        classListProto.remove = function () {
          var tokens = arguments;
          var i = 0;
          var ii = tokens.length;
          var token = void 0;
          var updated = false;
          var index = void 0;

          do {
            token = tokens[i] + '';
            index = checkTokenAndGetIndex(this, token);
            while (index !== -1) {
              this.splice(index, 1);
              updated = true;
              index = checkTokenAndGetIndex(this, token);
            }
          } while (++i < ii);

          if (updated) {
            this._updateClassName();
          }
        };

        classListProto.toggle = function (token, force) {
          token += '';

          var result = this.contains(token);
          var method = result ? force !== true && 'remove' : force !== false && 'add';

          if (method) {
            this[method](token);
          }

          if (force === true || force === false) {
            return force;
          }

          return !result;
        };

        classListProto.toString = function () {
          return this.join(' ');
        };

        Object.defineProperty(Element.prototype, 'classList', {
          get: function get() {
            return new ClassList(this);
          },
          enumerable: true,
          configurable: true
        });
      })();
    } else {
      var testElement = document.createElement('_');
      testElement.classList.add('c1', 'c2');

      if (!testElement.classList.contains('c2')) {
        var createMethod = function createMethod(method) {
          var original = DOMTokenList.prototype[method];

          DOMTokenList.prototype[method] = function (token) {
            for (var i = 0, ii = arguments.length; i < ii; ++i) {
              token = arguments[i];
              original.call(this, token);
            }
          };
        };

        createMethod('add');
        createMethod('remove');
      }

      testElement.classList.toggle('c3', false);

      if (testElement.classList.contains('c3')) {
        (function () {
          var _toggle = DOMTokenList.prototype.toggle;

          DOMTokenList.prototype.toggle = function (token, force) {
            if (1 in arguments && !this.contains(token) === !force) {
              return force;
            }

            return _toggle.call(this, token);
          };
        })();
      }

      testElement = null;
    }
  }

  function _ensurePerformance() {
    // @license http://opensource.org/licenses/MIT


    if ('performance' in window === false) {
      window.performance = {};
    }

    if ('now' in window.performance === false) {
      (function () {
        var nowOffset = Date.now();

        if (performance.timing && performance.timing.navigationStart) {
          nowOffset = performance.timing.navigationStart;
        }

        window.performance.now = function now() {
          return Date.now() - nowOffset;
        };
      })();
    }

    _PLATFORM.performance = window.performance;
  }

  function _ensureCustomEvent() {
    if (!window.CustomEvent || typeof window.CustomEvent !== 'function') {
      var _CustomEvent = function _CustomEvent(event, params) {
        params = params || {
          bubbles: false,
          cancelable: false,
          detail: undefined
        };

        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
        return evt;
      };

      _CustomEvent.prototype = window.Event.prototype;
      window.CustomEvent = _CustomEvent;
    }
  }

  function _ensureElementMatches() {
    if (Element && !Element.prototype.matches) {
      var proto = Element.prototype;
      proto.matches = proto.matchesSelector || proto.mozMatchesSelector || proto.msMatchesSelector || proto.oMatchesSelector || proto.webkitMatchesSelector;
    }
  }

  var _FEATURE = exports._FEATURE = {};

  _FEATURE.shadowDOM = function () {
    return !!HTMLElement.prototype.attachShadow;
  }();

  _FEATURE.scopedCSS = function () {
    return 'scoped' in document.createElement('style');
  }();

  _FEATURE.htmlTemplateElement = function () {
    return 'content' in document.createElement('template');
  }();

  _FEATURE.mutationObserver = function () {
    return !!(window.MutationObserver || window.WebKitMutationObserver);
  }();

  function _ensureHTMLTemplateElement() {
    function isSVGTemplate(el) {
      return el.tagName === 'template' && el.namespaceURI === 'http://www.w3.org/2000/svg';
    }

    function fixSVGTemplateElement(el) {
      var template = el.ownerDocument.createElement('template');
      var attrs = el.attributes;
      var length = attrs.length;
      var attr = void 0;

      el.parentNode.insertBefore(template, el);

      while (length-- > 0) {
        attr = attrs[length];
        template.setAttribute(attr.name, attr.value);
        el.removeAttribute(attr.name);
      }

      el.parentNode.removeChild(el);

      return fixHTMLTemplateElement(template);
    }

    function fixHTMLTemplateElement(template) {
      var content = template.content = document.createDocumentFragment();
      var child = void 0;

      while (child = template.firstChild) {
        content.appendChild(child);
      }

      return template;
    }

    function fixHTMLTemplateElementRoot(template) {
      var content = fixHTMLTemplateElement(template).content;
      var childTemplates = content.querySelectorAll('template');

      for (var i = 0, ii = childTemplates.length; i < ii; ++i) {
        var child = childTemplates[i];

        if (isSVGTemplate(child)) {
          fixSVGTemplateElement(child);
        } else {
          fixHTMLTemplateElement(child);
        }
      }

      return template;
    }

    if (_FEATURE.htmlTemplateElement) {
      _FEATURE.ensureHTMLTemplateElement = function (template) {
        return template;
      };
    } else {
      _FEATURE.ensureHTMLTemplateElement = fixHTMLTemplateElementRoot;
    }
  }

  var shadowPoly = window.ShadowDOMPolyfill || null;

  var _DOM = exports._DOM = {
    Element: Element,
    SVGElement: SVGElement,
    boundary: 'aurelia-dom-boundary',
    addEventListener: function addEventListener(eventName, callback, capture) {
      document.addEventListener(eventName, callback, capture);
    },
    removeEventListener: function removeEventListener(eventName, callback, capture) {
      document.removeEventListener(eventName, callback, capture);
    },
    adoptNode: function adoptNode(node) {
      return document.adoptNode(node, true);
    },
    createElement: function createElement(tagName) {
      return document.createElement(tagName);
    },
    createTextNode: function createTextNode(text) {
      return document.createTextNode(text);
    },
    createComment: function createComment(text) {
      return document.createComment(text);
    },
    createDocumentFragment: function createDocumentFragment() {
      return document.createDocumentFragment();
    },
    createMutationObserver: function createMutationObserver(callback) {
      return new (window.MutationObserver || window.WebKitMutationObserver)(callback);
    },
    createCustomEvent: function createCustomEvent(eventType, options) {
      return new window.CustomEvent(eventType, options);
    },
    dispatchEvent: function dispatchEvent(evt) {
      document.dispatchEvent(evt);
    },
    getComputedStyle: function getComputedStyle(element) {
      return window.getComputedStyle(element);
    },
    getElementById: function getElementById(id) {
      return document.getElementById(id);
    },
    querySelectorAll: function querySelectorAll(query) {
      return document.querySelectorAll(query);
    },
    nextElementSibling: function nextElementSibling(element) {
      if (element.nextElementSibling) {
        return element.nextElementSibling;
      }
      do {
        element = element.nextSibling;
      } while (element && element.nodeType !== 1);
      return element;
    },
    createTemplateFromMarkup: function createTemplateFromMarkup(markup) {
      var parser = document.createElement('div');
      parser.innerHTML = markup;

      var temp = parser.firstElementChild;
      if (!temp || temp.nodeName !== 'TEMPLATE') {
        throw new Error('Template markup must be wrapped in a <template> element e.g. <template> <!-- markup here --> </template>');
      }

      return _FEATURE.ensureHTMLTemplateElement(temp);
    },
    appendNode: function appendNode(newNode, parentNode) {
      (parentNode || document.body).appendChild(newNode);
    },
    replaceNode: function replaceNode(newNode, node, parentNode) {
      if (node.parentNode) {
        node.parentNode.replaceChild(newNode, node);
      } else if (shadowPoly !== null) {
        shadowPoly.unwrap(parentNode).replaceChild(shadowPoly.unwrap(newNode), shadowPoly.unwrap(node));
      } else {
        parentNode.replaceChild(newNode, node);
      }
    },
    removeNode: function removeNode(node, parentNode) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      } else if (parentNode) {
        if (shadowPoly !== null) {
          shadowPoly.unwrap(parentNode).removeChild(shadowPoly.unwrap(node));
        } else {
          parentNode.removeChild(node);
        }
      }
    },
    injectStyles: function injectStyles(styles, destination, prepend) {
      var node = document.createElement('style');
      node.innerHTML = styles;
      node.type = 'text/css';

      destination = destination || document.head;

      if (prepend && destination.childNodes.length > 0) {
        destination.insertBefore(node, destination.childNodes[0]);
      } else {
        destination.appendChild(node);
      }

      return node;
    }
  };

  var isInitialized = false;

  function initialize() {
    if (isInitialized) {
      return;
    }

    isInitialized = true;

    _ensureCustomEvent();
    _ensureFunctionName();
    _ensureHTMLTemplateElement();
    _ensureElementMatches();
    _ensureClassList();
    _ensurePerformance();

    (0, _aureliaPal.initializePAL)(function (platform, feature, dom) {
      Object.assign(platform, _PLATFORM);
      Object.assign(feature, _FEATURE);
      Object.assign(dom, _DOM);

      (function (global) {
        global.console = global.console || {};
        var con = global.console;
        var prop = void 0;
        var method = void 0;
        var empty = {};
        var dummy = function dummy() {};
        var properties = 'memory'.split(',');
        var methods = ('assert,clear,count,debug,dir,dirxml,error,exception,group,' + 'groupCollapsed,groupEnd,info,log,markTimeline,profile,profiles,profileEnd,' + 'show,table,time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn').split(',');
        while (prop = properties.pop()) {
          if (!con[prop]) con[prop] = empty;
        }while (method = methods.pop()) {
          if (!con[method]) con[method] = dummy;
        }
      })(platform.global);

      if (platform.global.console && _typeof(console.log) === 'object') {
        ['log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd'].forEach(function (method) {
          console[method] = this.bind(console[method], console);
        }, Function.prototype.call);
      }

      Object.defineProperty(dom, 'title', {
        get: function get() {
          return document.title;
        },
        set: function set(value) {
          document.title = value;
        }
      });

      Object.defineProperty(dom, 'activeElement', {
        get: function get() {
          return document.activeElement;
        }
      });

      Object.defineProperty(platform, 'XMLHttpRequest', {
        get: function get() {
          return platform.global.XMLHttpRequest;
        }
      });
    });
  }
});
define('aurelia-path',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.relativeToFile = relativeToFile;
  exports.join = join;
  exports.buildQueryString = buildQueryString;
  exports.parseQueryString = parseQueryString;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  function trimDots(ary) {
    for (var i = 0; i < ary.length; ++i) {
      var part = ary[i];
      if (part === '.') {
        ary.splice(i, 1);
        i -= 1;
      } else if (part === '..') {
        if (i === 0 || i === 1 && ary[2] === '..' || ary[i - 1] === '..') {
          continue;
        } else if (i > 0) {
          ary.splice(i - 1, 2);
          i -= 2;
        }
      }
    }
  }

  function relativeToFile(name, file) {
    var fileParts = file && file.split('/');
    var nameParts = name.trim().split('/');

    if (nameParts[0].charAt(0) === '.' && fileParts) {
      var normalizedBaseParts = fileParts.slice(0, fileParts.length - 1);
      nameParts.unshift.apply(nameParts, normalizedBaseParts);
    }

    trimDots(nameParts);

    return nameParts.join('/');
  }

  function join(path1, path2) {
    if (!path1) {
      return path2;
    }

    if (!path2) {
      return path1;
    }

    var schemeMatch = path1.match(/^([^/]*?:)\//);
    var scheme = schemeMatch && schemeMatch.length > 0 ? schemeMatch[1] : '';
    path1 = path1.substr(scheme.length);

    var urlPrefix = void 0;
    if (path1.indexOf('///') === 0 && scheme === 'file:') {
      urlPrefix = '///';
    } else if (path1.indexOf('//') === 0) {
      urlPrefix = '//';
    } else if (path1.indexOf('/') === 0) {
      urlPrefix = '/';
    } else {
      urlPrefix = '';
    }

    var trailingSlash = path2.slice(-1) === '/' ? '/' : '';

    var url1 = path1.split('/');
    var url2 = path2.split('/');
    var url3 = [];

    for (var i = 0, ii = url1.length; i < ii; ++i) {
      if (url1[i] === '..') {
        url3.pop();
      } else if (url1[i] === '.' || url1[i] === '') {
        continue;
      } else {
        url3.push(url1[i]);
      }
    }

    for (var _i = 0, _ii = url2.length; _i < _ii; ++_i) {
      if (url2[_i] === '..') {
        url3.pop();
      } else if (url2[_i] === '.' || url2[_i] === '') {
        continue;
      } else {
        url3.push(url2[_i]);
      }
    }

    return scheme + urlPrefix + url3.join('/') + trailingSlash;
  }

  var encode = encodeURIComponent;
  var encodeKey = function encodeKey(k) {
    return encode(k).replace('%24', '$');
  };

  function buildParam(key, value) {
    var result = [];
    if (value === null || value === undefined) {
      return result;
    }
    if (Array.isArray(value)) {
      for (var i = 0, l = value.length; i < l; i++) {
        var arrayKey = key + '[' + (_typeof(value[i]) === 'object' && value[i] !== null ? i : '') + ']';
        result = result.concat(buildParam(arrayKey, value[i]));
      }
    } else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
      for (var propertyName in value) {
        result = result.concat(buildParam(key + '[' + propertyName + ']', value[propertyName]));
      }
    } else {
      result.push(encodeKey(key) + '=' + encode(value));
    }
    return result;
  }

  function buildQueryString(params) {
    var pairs = [];
    var keys = Object.keys(params || {}).sort();
    for (var i = 0, len = keys.length; i < len; i++) {
      var key = keys[i];
      pairs = pairs.concat(buildParam(key, params[key]));
    }

    if (pairs.length === 0) {
      return '';
    }

    return pairs.join('&');
  }

  function processScalarParam(existedParam, value, isPrimitive) {
    if (Array.isArray(existedParam)) {
      existedParam.push(value);
      return existedParam;
    }
    if (existedParam !== undefined) {
      return isPrimitive ? value : [existedParam, value];
    }

    return value;
  }

  function parseComplexParam(queryParams, keys, value) {
    var currentParams = queryParams;
    var keysLastIndex = keys.length - 1;
    for (var j = 0; j <= keysLastIndex; j++) {
      var key = keys[j] === '' ? currentParams.length : keys[j];
      if (j < keysLastIndex) {
        currentParams = currentParams[key] = currentParams[key] || (isNaN(keys[j + 1]) ? {} : []);
      } else {
        currentParams = currentParams[key] = value;
      }
    }
  }

  function parseQueryString(queryString) {
    var queryParams = {};
    if (!queryString || typeof queryString !== 'string') {
      return queryParams;
    }

    var query = queryString;
    if (query.charAt(0) === '?') {
      query = query.substr(1);
    }

    var pairs = query.replace(/\+/g, ' ').split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      var key = decodeURIComponent(pair[0]);
      var isPrimitive = false;
      if (!key) {
        continue;
      }

      var keys = key.split('][');
      var keysLastIndex = keys.length - 1;

      if (/\[/.test(keys[0]) && /\]$/.test(keys[keysLastIndex])) {
        keys[keysLastIndex] = keys[keysLastIndex].replace(/\]$/, '');
        keys = keys.shift().split('[').concat(keys);
        keysLastIndex = keys.length - 1;
      } else {
        isPrimitive = true;
        keysLastIndex = 0;
      }

      if (pair.length >= 2) {
        var value = pair[1] ? decodeURIComponent(pair[1]) : '';
        if (keysLastIndex) {
          parseComplexParam(queryParams, keys, value);
        } else {
          queryParams[key] = processScalarParam(queryParams[key], value, isPrimitive);
        }
      } else {
        queryParams[key] = true;
      }
    }
    return queryParams;
  }
});
define('aurelia-logging',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getLogger = getLogger;
  exports.addAppender = addAppender;
  exports.setLevel = setLevel;

  

  var logLevel = exports.logLevel = {
    none: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
  };

  var loggers = {};
  var currentLevel = logLevel.none;
  var appenders = [];
  var slice = Array.prototype.slice;
  var loggerConstructionKey = {};

  function log(logger, level, args) {
    var i = appenders.length;
    var current = void 0;

    args = slice.call(args);
    args.unshift(logger);

    while (i--) {
      current = appenders[i];
      current[level].apply(current, args);
    }
  }

  function debug() {
    if (currentLevel < 4) {
      return;
    }

    log(this, 'debug', arguments);
  }

  function info() {
    if (currentLevel < 3) {
      return;
    }

    log(this, 'info', arguments);
  }

  function warn() {
    if (currentLevel < 2) {
      return;
    }

    log(this, 'warn', arguments);
  }

  function error() {
    if (currentLevel < 1) {
      return;
    }

    log(this, 'error', arguments);
  }

  function connectLogger(logger) {
    logger.debug = debug;
    logger.info = info;
    logger.warn = warn;
    logger.error = error;
  }

  function createLogger(id) {
    var logger = new Logger(id, loggerConstructionKey);

    if (appenders.length) {
      connectLogger(logger);
    }

    return logger;
  }

  function getLogger(id) {
    return loggers[id] || (loggers[id] = createLogger(id));
  }

  function addAppender(appender) {
    appenders.push(appender);

    if (appenders.length === 1) {
      for (var key in loggers) {
        connectLogger(loggers[key]);
      }
    }
  }

  function setLevel(level) {
    currentLevel = level;
  }

  var Logger = exports.Logger = function () {
    function Logger(id, key) {
      

      if (key !== loggerConstructionKey) {
        throw new Error('Cannot instantiate "Logger". Use "getLogger" instead.');
      }

      this.id = id;
    }

    Logger.prototype.debug = function debug(message) {};

    Logger.prototype.info = function info(message) {};

    Logger.prototype.warn = function warn(message) {};

    Logger.prototype.error = function error(message) {};

    return Logger;
  }();
});
define('aurelia-route-recognizer',['exports', 'aurelia-path'], function (exports, _aureliaPath) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.RouteRecognizer = exports.EpsilonSegment = exports.StarSegment = exports.DynamicSegment = exports.StaticSegment = exports.State = undefined;

  

  var State = exports.State = function () {
    function State(charSpec) {
      

      this.charSpec = charSpec;
      this.nextStates = [];
    }

    State.prototype.get = function get(charSpec) {
      for (var _iterator = this.nextStates, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref = _i.value;
        }

        var child = _ref;

        var isEqual = child.charSpec.validChars === charSpec.validChars && child.charSpec.invalidChars === charSpec.invalidChars;

        if (isEqual) {
          return child;
        }
      }

      return undefined;
    };

    State.prototype.put = function put(charSpec) {
      var state = this.get(charSpec);

      if (state) {
        return state;
      }

      state = new State(charSpec);

      this.nextStates.push(state);

      if (charSpec.repeat) {
        state.nextStates.push(state);
      }

      return state;
    };

    State.prototype.match = function match(ch) {
      var nextStates = this.nextStates;
      var results = [];

      for (var i = 0, l = nextStates.length; i < l; i++) {
        var child = nextStates[i];
        var charSpec = child.charSpec;

        if (charSpec.validChars !== undefined) {
          if (charSpec.validChars.indexOf(ch) !== -1) {
            results.push(child);
          }
        } else if (charSpec.invalidChars !== undefined) {
          if (charSpec.invalidChars.indexOf(ch) === -1) {
            results.push(child);
          }
        }
      }

      return results;
    };

    return State;
  }();

  var specials = ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'];

  var escapeRegex = new RegExp('(\\' + specials.join('|\\') + ')', 'g');

  var StaticSegment = exports.StaticSegment = function () {
    function StaticSegment(string, caseSensitive) {
      

      this.string = string;
      this.caseSensitive = caseSensitive;
    }

    StaticSegment.prototype.eachChar = function eachChar(callback) {
      var s = this.string;
      for (var i = 0, ii = s.length; i < ii; ++i) {
        var ch = s[i];
        callback({ validChars: this.caseSensitive ? ch : ch.toUpperCase() + ch.toLowerCase() });
      }
    };

    StaticSegment.prototype.regex = function regex() {
      return this.string.replace(escapeRegex, '\\$1');
    };

    StaticSegment.prototype.generate = function generate() {
      return this.string;
    };

    return StaticSegment;
  }();

  var DynamicSegment = exports.DynamicSegment = function () {
    function DynamicSegment(name) {
      

      this.name = name;
    }

    DynamicSegment.prototype.eachChar = function eachChar(callback) {
      callback({ invalidChars: '/', repeat: true });
    };

    DynamicSegment.prototype.regex = function regex() {
      return '([^/]+)';
    };

    DynamicSegment.prototype.generate = function generate(params, consumed) {
      consumed[this.name] = true;
      return params[this.name];
    };

    return DynamicSegment;
  }();

  var StarSegment = exports.StarSegment = function () {
    function StarSegment(name) {
      

      this.name = name;
    }

    StarSegment.prototype.eachChar = function eachChar(callback) {
      callback({ invalidChars: '', repeat: true });
    };

    StarSegment.prototype.regex = function regex() {
      return '(.+)';
    };

    StarSegment.prototype.generate = function generate(params, consumed) {
      consumed[this.name] = true;
      return params[this.name];
    };

    return StarSegment;
  }();

  var EpsilonSegment = exports.EpsilonSegment = function () {
    function EpsilonSegment() {
      
    }

    EpsilonSegment.prototype.eachChar = function eachChar() {};

    EpsilonSegment.prototype.regex = function regex() {
      return '';
    };

    EpsilonSegment.prototype.generate = function generate() {
      return '';
    };

    return EpsilonSegment;
  }();

  var RouteRecognizer = exports.RouteRecognizer = function () {
    function RouteRecognizer() {
      

      this.rootState = new State();
      this.names = {};
    }

    RouteRecognizer.prototype.add = function add(route) {
      var _this = this;

      if (Array.isArray(route)) {
        route.forEach(function (r) {
          return _this.add(r);
        });
        return undefined;
      }

      var currentState = this.rootState;
      var regex = '^';
      var types = { statics: 0, dynamics: 0, stars: 0 };
      var names = [];
      var routeName = route.handler.name;
      var isEmpty = true;
      var segments = parse(route.path, names, types, route.caseSensitive);

      for (var i = 0, ii = segments.length; i < ii; i++) {
        var segment = segments[i];
        if (segment instanceof EpsilonSegment) {
          continue;
        }

        isEmpty = false;

        currentState = currentState.put({ validChars: '/' });
        regex += '/';

        currentState = addSegment(currentState, segment);
        regex += segment.regex();
      }

      if (isEmpty) {
        currentState = currentState.put({ validChars: '/' });
        regex += '/';
      }

      var handlers = [{ handler: route.handler, names: names }];

      if (routeName) {
        var routeNames = Array.isArray(routeName) ? routeName : [routeName];
        for (var _i2 = 0; _i2 < routeNames.length; _i2++) {
          this.names[routeNames[_i2]] = {
            segments: segments,
            handlers: handlers
          };
        }
      }

      currentState.handlers = handlers;
      currentState.regex = new RegExp(regex + '$', route.caseSensitive ? '' : 'i');
      currentState.types = types;

      return currentState;
    };

    RouteRecognizer.prototype.handlersFor = function handlersFor(name) {
      var route = this.names[name];
      if (!route) {
        throw new Error('There is no route named ' + name);
      }

      return [].concat(route.handlers);
    };

    RouteRecognizer.prototype.hasRoute = function hasRoute(name) {
      return !!this.names[name];
    };

    RouteRecognizer.prototype.generate = function generate(name, params) {
      var route = this.names[name];
      if (!route) {
        throw new Error('There is no route named ' + name);
      }

      var handler = route.handlers[0].handler;
      if (handler.generationUsesHref) {
        return handler.href;
      }

      var routeParams = Object.assign({}, params);
      var segments = route.segments;
      var consumed = {};
      var output = '';

      for (var i = 0, l = segments.length; i < l; i++) {
        var segment = segments[i];

        if (segment instanceof EpsilonSegment) {
          continue;
        }

        output += '/';
        var segmentValue = segment.generate(routeParams, consumed);
        if (segmentValue === null || segmentValue === undefined) {
          throw new Error('A value is required for route parameter \'' + segment.name + '\' in route \'' + name + '\'.');
        }

        output += segmentValue;
      }

      if (output.charAt(0) !== '/') {
        output = '/' + output;
      }

      for (var param in consumed) {
        delete routeParams[param];
      }

      var queryString = (0, _aureliaPath.buildQueryString)(routeParams);
      output += queryString ? '?' + queryString : '';

      return output;
    };

    RouteRecognizer.prototype.recognize = function recognize(path) {
      var states = [this.rootState];
      var queryParams = {};
      var isSlashDropped = false;
      var normalizedPath = path;

      var queryStart = normalizedPath.indexOf('?');
      if (queryStart !== -1) {
        var queryString = normalizedPath.substr(queryStart + 1, normalizedPath.length);
        normalizedPath = normalizedPath.substr(0, queryStart);
        queryParams = (0, _aureliaPath.parseQueryString)(queryString);
      }

      normalizedPath = decodeURI(normalizedPath);

      if (normalizedPath.charAt(0) !== '/') {
        normalizedPath = '/' + normalizedPath;
      }

      var pathLen = normalizedPath.length;
      if (pathLen > 1 && normalizedPath.charAt(pathLen - 1) === '/') {
        normalizedPath = normalizedPath.substr(0, pathLen - 1);
        isSlashDropped = true;
      }

      for (var i = 0, l = normalizedPath.length; i < l; i++) {
        states = recognizeChar(states, normalizedPath.charAt(i));
        if (!states.length) {
          break;
        }
      }

      var solutions = [];
      for (var _i3 = 0, _l = states.length; _i3 < _l; _i3++) {
        if (states[_i3].handlers) {
          solutions.push(states[_i3]);
        }
      }

      states = sortSolutions(solutions);

      var state = solutions[0];
      if (state && state.handlers) {
        if (isSlashDropped && state.regex.source.slice(-5) === '(.+)$') {
          normalizedPath = normalizedPath + '/';
        }

        return findHandler(state, normalizedPath, queryParams);
      }

      return undefined;
    };

    return RouteRecognizer;
  }();

  var RecognizeResults = function RecognizeResults(queryParams) {
    

    this.splice = Array.prototype.splice;
    this.slice = Array.prototype.slice;
    this.push = Array.prototype.push;
    this.length = 0;
    this.queryParams = queryParams || {};
  };

  function parse(route, names, types, caseSensitive) {
    var normalizedRoute = route;
    if (route.charAt(0) === '/') {
      normalizedRoute = route.substr(1);
    }

    var results = [];

    var splitRoute = normalizedRoute.split('/');
    for (var i = 0, ii = splitRoute.length; i < ii; ++i) {
      var segment = splitRoute[i];
      var match = segment.match(/^:([^\/]+)$/);
      if (match) {
        results.push(new DynamicSegment(match[1]));
        names.push(match[1]);
        types.dynamics++;
        continue;
      }

      match = segment.match(/^\*([^\/]+)$/);
      if (match) {
        results.push(new StarSegment(match[1]));
        names.push(match[1]);
        types.stars++;
      } else if (segment === '') {
        results.push(new EpsilonSegment());
      } else {
        results.push(new StaticSegment(segment, caseSensitive));
        types.statics++;
      }
    }

    return results;
  }

  function sortSolutions(states) {
    return states.sort(function (a, b) {
      if (a.types.stars !== b.types.stars) {
        return a.types.stars - b.types.stars;
      }

      if (a.types.stars) {
        if (a.types.statics !== b.types.statics) {
          return b.types.statics - a.types.statics;
        }
        if (a.types.dynamics !== b.types.dynamics) {
          return b.types.dynamics - a.types.dynamics;
        }
      }

      if (a.types.dynamics !== b.types.dynamics) {
        return a.types.dynamics - b.types.dynamics;
      }

      if (a.types.statics !== b.types.statics) {
        return b.types.statics - a.types.statics;
      }

      return 0;
    });
  }

  function recognizeChar(states, ch) {
    var nextStates = [];

    for (var i = 0, l = states.length; i < l; i++) {
      var state = states[i];
      nextStates.push.apply(nextStates, state.match(ch));
    }

    return nextStates;
  }

  function findHandler(state, path, queryParams) {
    var handlers = state.handlers;
    var regex = state.regex;
    var captures = path.match(regex);
    var currentCapture = 1;
    var result = new RecognizeResults(queryParams);

    for (var i = 0, l = handlers.length; i < l; i++) {
      var _handler = handlers[i];
      var _names = _handler.names;
      var _params = {};

      for (var j = 0, m = _names.length; j < m; j++) {
        _params[_names[j]] = captures[currentCapture++];
      }

      result.push({ handler: _handler.handler, params: _params, isDynamic: !!_names.length });
    }

    return result;
  }

  function addSegment(currentState, segment) {
    var state = currentState;
    segment.eachChar(function (ch) {
      state = state.put(ch);
    });

    return state;
  }
});
define('aurelia-router',['exports', 'aurelia-logging', 'aurelia-route-recognizer', 'aurelia-dependency-injection', 'aurelia-history', 'aurelia-event-aggregator'], function (exports, _aureliaLogging, _aureliaRouteRecognizer, _aureliaDependencyInjection, _aureliaHistory, _aureliaEventAggregator) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AppRouter = exports.PipelineProvider = exports.LoadRouteStep = exports.RouteLoader = exports.ActivateNextStep = exports.DeactivatePreviousStep = exports.CanActivateNextStep = exports.CanDeactivatePreviousStep = exports.Router = exports.BuildNavigationPlanStep = exports.activationStrategy = exports.RouterConfiguration = exports.RedirectToRoute = exports.Redirect = exports.NavModel = exports.NavigationInstruction = exports.CommitChangesStep = exports.Pipeline = exports.pipelineStatus = undefined;
  exports._normalizeAbsolutePath = _normalizeAbsolutePath;
  exports._createRootedPath = _createRootedPath;
  exports._resolveUrl = _resolveUrl;
  exports.isNavigationCommand = isNavigationCommand;
  exports._buildNavigationPlan = _buildNavigationPlan;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  

  function _normalizeAbsolutePath(path, hasPushState) {
    var absolute = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

    if (!hasPushState && path[0] !== '#') {
      path = '#' + path;
    }

    if (hasPushState && absolute) {
      path = path.substring(1, path.length);
    }

    return path;
  }

  function _createRootedPath(fragment, baseUrl, hasPushState, absolute) {
    if (isAbsoluteUrl.test(fragment)) {
      return fragment;
    }

    var path = '';

    if (baseUrl.length && baseUrl[0] !== '/') {
      path += '/';
    }

    path += baseUrl;

    if ((!path.length || path[path.length - 1] !== '/') && fragment[0] !== '/') {
      path += '/';
    }

    if (path.length && path[path.length - 1] === '/' && fragment[0] === '/') {
      path = path.substring(0, path.length - 1);
    }

    return _normalizeAbsolutePath(path + fragment, hasPushState, absolute);
  }

  function _resolveUrl(fragment, baseUrl, hasPushState) {
    if (isRootedPath.test(fragment)) {
      return _normalizeAbsolutePath(fragment, hasPushState);
    }

    return _createRootedPath(fragment, baseUrl, hasPushState);
  }

  var isRootedPath = /^#?\//;
  var isAbsoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

  var pipelineStatus = exports.pipelineStatus = {
    completed: 'completed',
    canceled: 'canceled',
    rejected: 'rejected',
    running: 'running'
  };

  var Pipeline = exports.Pipeline = function () {
    function Pipeline() {
      

      this.steps = [];
    }

    Pipeline.prototype.addStep = function addStep(step) {
      var run = void 0;

      if (typeof step === 'function') {
        run = step;
      } else if (typeof step.getSteps === 'function') {
        var steps = step.getSteps();
        for (var i = 0, l = steps.length; i < l; i++) {
          this.addStep(steps[i]);
        }

        return this;
      } else {
        run = step.run.bind(step);
      }

      this.steps.push(run);

      return this;
    };

    Pipeline.prototype.run = function run(instruction) {
      var index = -1;
      var steps = this.steps;

      function next() {
        index++;

        if (index < steps.length) {
          var currentStep = steps[index];

          try {
            return currentStep(instruction, next);
          } catch (e) {
            return next.reject(e);
          }
        } else {
          return next.complete();
        }
      }

      next.complete = createCompletionHandler(next, pipelineStatus.completed);
      next.cancel = createCompletionHandler(next, pipelineStatus.canceled);
      next.reject = createCompletionHandler(next, pipelineStatus.rejected);

      return next();
    };

    return Pipeline;
  }();

  function createCompletionHandler(next, status) {
    return function (output) {
      return Promise.resolve({ status: status, output: output, completed: status === pipelineStatus.completed });
    };
  }

  var CommitChangesStep = exports.CommitChangesStep = function () {
    function CommitChangesStep() {
      
    }

    CommitChangesStep.prototype.run = function run(navigationInstruction, next) {
      return navigationInstruction._commitChanges(true).then(function () {
        navigationInstruction._updateTitle();
        return next();
      });
    };

    return CommitChangesStep;
  }();

  var NavigationInstruction = exports.NavigationInstruction = function () {
    function NavigationInstruction(init) {
      

      this.plan = null;
      this.options = {};

      Object.assign(this, init);

      this.params = this.params || {};
      this.viewPortInstructions = {};

      var ancestorParams = [];
      var current = this;
      do {
        var currentParams = Object.assign({}, current.params);
        if (current.config && current.config.hasChildRouter) {
          delete currentParams[current.getWildCardName()];
        }

        ancestorParams.unshift(currentParams);
        current = current.parentInstruction;
      } while (current);

      var allParams = Object.assign.apply(Object, [{}, this.queryParams].concat(ancestorParams));
      this.lifecycleArgs = [allParams, this.config, this];
    }

    NavigationInstruction.prototype.getAllInstructions = function getAllInstructions() {
      var instructions = [this];
      for (var key in this.viewPortInstructions) {
        var childInstruction = this.viewPortInstructions[key].childNavigationInstruction;
        if (childInstruction) {
          instructions.push.apply(instructions, childInstruction.getAllInstructions());
        }
      }

      return instructions;
    };

    NavigationInstruction.prototype.getAllPreviousInstructions = function getAllPreviousInstructions() {
      return this.getAllInstructions().map(function (c) {
        return c.previousInstruction;
      }).filter(function (c) {
        return c;
      });
    };

    NavigationInstruction.prototype.addViewPortInstruction = function addViewPortInstruction(viewPortName, strategy, moduleId, component) {
      var viewportInstruction = this.viewPortInstructions[viewPortName] = {
        name: viewPortName,
        strategy: strategy,
        moduleId: moduleId,
        component: component,
        childRouter: component.childRouter,
        lifecycleArgs: this.lifecycleArgs.slice()
      };

      return viewportInstruction;
    };

    NavigationInstruction.prototype.getWildCardName = function getWildCardName() {
      var wildcardIndex = this.config.route.lastIndexOf('*');
      return this.config.route.substr(wildcardIndex + 1);
    };

    NavigationInstruction.prototype.getWildcardPath = function getWildcardPath() {
      var wildcardName = this.getWildCardName();
      var path = this.params[wildcardName] || '';

      if (this.queryString) {
        path += '?' + this.queryString;
      }

      return path;
    };

    NavigationInstruction.prototype.getBaseUrl = function getBaseUrl() {
      if (!this.params) {
        return this.fragment;
      }

      var wildcardName = this.getWildCardName();
      var path = this.params[wildcardName] || '';

      if (!path) {
        return this.fragment;
      }

      path = encodeURI(path);
      return this.fragment.substr(0, this.fragment.lastIndexOf(path));
    };

    NavigationInstruction.prototype._commitChanges = function _commitChanges(waitToSwap) {
      var _this = this;

      var router = this.router;
      router.currentInstruction = this;

      if (this.previousInstruction) {
        this.previousInstruction.config.navModel.isActive = false;
      }

      this.config.navModel.isActive = true;

      router._refreshBaseUrl();
      router.refreshNavigation();

      var loads = [];
      var delaySwaps = [];

      var _loop = function _loop(viewPortName) {
        var viewPortInstruction = _this.viewPortInstructions[viewPortName];
        var viewPort = router.viewPorts[viewPortName];

        if (!viewPort) {
          throw new Error('There was no router-view found in the view for ' + viewPortInstruction.moduleId + '.');
        }

        if (viewPortInstruction.strategy === activationStrategy.replace) {
          if (waitToSwap) {
            delaySwaps.push({ viewPort: viewPort, viewPortInstruction: viewPortInstruction });
          }

          loads.push(viewPort.process(viewPortInstruction, waitToSwap).then(function (x) {
            if (viewPortInstruction.childNavigationInstruction) {
              return viewPortInstruction.childNavigationInstruction._commitChanges();
            }

            return undefined;
          }));
        } else {
          if (viewPortInstruction.childNavigationInstruction) {
            loads.push(viewPortInstruction.childNavigationInstruction._commitChanges(waitToSwap));
          }
        }
      };

      for (var viewPortName in this.viewPortInstructions) {
        _loop(viewPortName);
      }

      return Promise.all(loads).then(function () {
        delaySwaps.forEach(function (x) {
          return x.viewPort.swap(x.viewPortInstruction);
        });
        return null;
      }).then(function () {
        return prune(_this);
      });
    };

    NavigationInstruction.prototype._updateTitle = function _updateTitle() {
      var title = this._buildTitle();
      if (title) {
        this.router.history.setTitle(title);
      }
    };

    NavigationInstruction.prototype._buildTitle = function _buildTitle() {
      var separator = arguments.length <= 0 || arguments[0] === undefined ? ' | ' : arguments[0];

      var title = this.config.navModel.title || '';
      var childTitles = [];

      for (var viewPortName in this.viewPortInstructions) {
        var _viewPortInstruction = this.viewPortInstructions[viewPortName];

        if (_viewPortInstruction.childNavigationInstruction) {
          var childTitle = _viewPortInstruction.childNavigationInstruction._buildTitle(separator);
          if (childTitle) {
            childTitles.push(childTitle);
          }
        }
      }

      if (childTitles.length) {
        title = childTitles.join(separator) + (title ? separator : '') + title;
      }

      if (this.router.title) {
        title += (title ? separator : '') + this.router.title;
      }

      return title;
    };

    return NavigationInstruction;
  }();

  function prune(instruction) {
    instruction.previousInstruction = null;
    instruction.plan = null;
  }

  var NavModel = exports.NavModel = function () {
    function NavModel(router, relativeHref) {
      

      this.isActive = false;
      this.title = null;
      this.href = null;
      this.relativeHref = null;
      this.settings = {};
      this.config = null;

      this.router = router;
      this.relativeHref = relativeHref;
    }

    NavModel.prototype.setTitle = function setTitle(title) {
      this.title = title;

      if (this.isActive) {
        this.router.updateTitle();
      }
    };

    return NavModel;
  }();

  function isNavigationCommand(obj) {
    return obj && typeof obj.navigate === 'function';
  }

  var Redirect = exports.Redirect = function () {
    function Redirect(url) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      

      this.url = url;
      this.options = Object.assign({ trigger: true, replace: true }, options);
      this.shouldContinueProcessing = false;
    }

    Redirect.prototype.setRouter = function setRouter(router) {
      this.router = router;
    };

    Redirect.prototype.navigate = function navigate(appRouter) {
      var navigatingRouter = this.options.useAppRouter ? appRouter : this.router || appRouter;
      navigatingRouter.navigate(this.url, this.options);
    };

    return Redirect;
  }();

  var RedirectToRoute = exports.RedirectToRoute = function () {
    function RedirectToRoute(route) {
      var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      

      this.route = route;
      this.params = params;
      this.options = Object.assign({ trigger: true, replace: true }, options);
      this.shouldContinueProcessing = false;
    }

    RedirectToRoute.prototype.setRouter = function setRouter(router) {
      this.router = router;
    };

    RedirectToRoute.prototype.navigate = function navigate(appRouter) {
      var navigatingRouter = this.options.useAppRouter ? appRouter : this.router || appRouter;
      navigatingRouter.navigateToRoute(this.route, this.params, this.options);
    };

    return RedirectToRoute;
  }();

  var RouterConfiguration = exports.RouterConfiguration = function () {
    function RouterConfiguration() {
      

      this.instructions = [];
      this.options = {};
      this.pipelineSteps = [];
    }

    RouterConfiguration.prototype.addPipelineStep = function addPipelineStep(name, step) {
      this.pipelineSteps.push({ name: name, step: step });
      return this;
    };

    RouterConfiguration.prototype.addAuthorizeStep = function addAuthorizeStep(step) {
      return this.addPipelineStep('authorize', step);
    };

    RouterConfiguration.prototype.addPreActivateStep = function addPreActivateStep(step) {
      return this.addPipelineStep('preActivate', step);
    };

    RouterConfiguration.prototype.addPreRenderStep = function addPreRenderStep(step) {
      return this.addPipelineStep('preRender', step);
    };

    RouterConfiguration.prototype.addPostRenderStep = function addPostRenderStep(step) {
      return this.addPipelineStep('postRender', step);
    };

    RouterConfiguration.prototype.map = function map(route) {
      if (Array.isArray(route)) {
        route.forEach(this.map.bind(this));
        return this;
      }

      return this.mapRoute(route);
    };

    RouterConfiguration.prototype.mapRoute = function mapRoute(config) {
      this.instructions.push(function (router) {
        var routeConfigs = [];

        if (Array.isArray(config.route)) {
          for (var i = 0, ii = config.route.length; i < ii; ++i) {
            var current = Object.assign({}, config);
            current.route = config.route[i];
            routeConfigs.push(current);
          }
        } else {
          routeConfigs.push(Object.assign({}, config));
        }

        var navModel = void 0;
        for (var _i = 0, _ii = routeConfigs.length; _i < _ii; ++_i) {
          var _routeConfig = routeConfigs[_i];
          _routeConfig.settings = _routeConfig.settings || {};
          if (!navModel) {
            navModel = router.createNavModel(_routeConfig);
          }

          router.addRoute(_routeConfig, navModel);
        }
      });

      return this;
    };

    RouterConfiguration.prototype.mapUnknownRoutes = function mapUnknownRoutes(config) {
      this.unknownRouteConfig = config;
      return this;
    };

    RouterConfiguration.prototype.exportToRouter = function exportToRouter(router) {
      var instructions = this.instructions;
      for (var i = 0, ii = instructions.length; i < ii; ++i) {
        instructions[i](router);
      }

      if (this.title) {
        router.title = this.title;
      }

      if (this.unknownRouteConfig) {
        router.handleUnknownRoutes(this.unknownRouteConfig);
      }

      router.options = this.options;

      var pipelineSteps = this.pipelineSteps;
      if (pipelineSteps.length) {
        if (!router.isRoot) {
          throw new Error('Pipeline steps can only be added to the root router');
        }

        var pipelineProvider = router.pipelineProvider;
        for (var _i2 = 0, _ii2 = pipelineSteps.length; _i2 < _ii2; ++_i2) {
          var _pipelineSteps$_i = pipelineSteps[_i2];
          var _name = _pipelineSteps$_i.name;
          var step = _pipelineSteps$_i.step;

          pipelineProvider.addStep(_name, step);
        }
      }
    };

    return RouterConfiguration;
  }();

  var activationStrategy = exports.activationStrategy = {
    noChange: 'no-change',
    invokeLifecycle: 'invoke-lifecycle',
    replace: 'replace'
  };

  var BuildNavigationPlanStep = exports.BuildNavigationPlanStep = function () {
    function BuildNavigationPlanStep() {
      
    }

    BuildNavigationPlanStep.prototype.run = function run(navigationInstruction, next) {
      return _buildNavigationPlan(navigationInstruction).then(function (plan) {
        navigationInstruction.plan = plan;
        return next();
      }).catch(next.cancel);
    };

    return BuildNavigationPlanStep;
  }();

  function _buildNavigationPlan(instruction, forceLifecycleMinimum) {
    var prev = instruction.previousInstruction;
    var config = instruction.config;
    var plan = {};

    if ('redirect' in config) {
      var redirectLocation = _resolveUrl(config.redirect, getInstructionBaseUrl(instruction));
      if (instruction.queryString) {
        redirectLocation += '?' + instruction.queryString;
      }

      return Promise.reject(new Redirect(redirectLocation));
    }

    if (prev) {
      var newParams = hasDifferentParameterValues(prev, instruction);
      var pending = [];

      var _loop2 = function _loop2(viewPortName) {
        var prevViewPortInstruction = prev.viewPortInstructions[viewPortName];
        var nextViewPortConfig = config.viewPorts[viewPortName];

        if (!nextViewPortConfig) throw new Error('Invalid Route Config: Configuration for viewPort "' + viewPortName + '" was not found for route: "' + instruction.config.route + '."');

        var viewPortPlan = plan[viewPortName] = {
          name: viewPortName,
          config: nextViewPortConfig,
          prevComponent: prevViewPortInstruction.component,
          prevModuleId: prevViewPortInstruction.moduleId
        };

        if (prevViewPortInstruction.moduleId !== nextViewPortConfig.moduleId) {
          viewPortPlan.strategy = activationStrategy.replace;
        } else if ('determineActivationStrategy' in prevViewPortInstruction.component.viewModel) {
          var _prevViewPortInstruct;

          viewPortPlan.strategy = (_prevViewPortInstruct = prevViewPortInstruction.component.viewModel).determineActivationStrategy.apply(_prevViewPortInstruct, instruction.lifecycleArgs);
        } else if (config.activationStrategy) {
          viewPortPlan.strategy = config.activationStrategy;
        } else if (newParams || forceLifecycleMinimum) {
          viewPortPlan.strategy = activationStrategy.invokeLifecycle;
        } else {
          viewPortPlan.strategy = activationStrategy.noChange;
        }

        if (viewPortPlan.strategy !== activationStrategy.replace && prevViewPortInstruction.childRouter) {
          var path = instruction.getWildcardPath();
          var task = prevViewPortInstruction.childRouter._createNavigationInstruction(path, instruction).then(function (childInstruction) {
            viewPortPlan.childNavigationInstruction = childInstruction;

            return _buildNavigationPlan(childInstruction, viewPortPlan.strategy === activationStrategy.invokeLifecycle).then(function (childPlan) {
              childInstruction.plan = childPlan;
            });
          });

          pending.push(task);
        }
      };

      for (var viewPortName in prev.viewPortInstructions) {
        _loop2(viewPortName);
      }

      return Promise.all(pending).then(function () {
        return plan;
      });
    }

    for (var _viewPortName in config.viewPorts) {
      plan[_viewPortName] = {
        name: _viewPortName,
        strategy: activationStrategy.replace,
        config: instruction.config.viewPorts[_viewPortName]
      };
    }

    return Promise.resolve(plan);
  }

  function hasDifferentParameterValues(prev, next) {
    var prevParams = prev.params;
    var nextParams = next.params;
    var nextWildCardName = next.config.hasChildRouter ? next.getWildCardName() : null;

    for (var key in nextParams) {
      if (key === nextWildCardName) {
        continue;
      }

      if (prevParams[key] !== nextParams[key]) {
        return true;
      }
    }

    for (var _key in prevParams) {
      if (_key === nextWildCardName) {
        continue;
      }

      if (prevParams[_key] !== nextParams[_key]) {
        return true;
      }
    }

    if (!next.options.compareQueryParams) {
      return false;
    }

    var prevQueryParams = prev.queryParams;
    var nextQueryParams = next.queryParams;
    for (var _key2 in nextQueryParams) {
      if (prevQueryParams[_key2] !== nextQueryParams[_key2]) {
        return true;
      }
    }

    for (var _key3 in prevQueryParams) {
      if (prevQueryParams[_key3] !== nextQueryParams[_key3]) {
        return true;
      }
    }

    return false;
  }

  function getInstructionBaseUrl(instruction) {
    var instructionBaseUrlParts = [];
    instruction = instruction.parentInstruction;

    while (instruction) {
      instructionBaseUrlParts.unshift(instruction.getBaseUrl());
      instruction = instruction.parentInstruction;
    }

    instructionBaseUrlParts.unshift('/');
    return instructionBaseUrlParts.join('');
  }

  var Router = exports.Router = function () {
    function Router(container, history) {
      

      this.parent = null;
      this.options = {};

      this.container = container;
      this.history = history;
      this.reset();
    }

    Router.prototype.reset = function reset() {
      var _this2 = this;

      this.viewPorts = {};
      this.routes = [];
      this.baseUrl = '';
      this.isConfigured = false;
      this.isNavigating = false;
      this.navigation = [];
      this.currentInstruction = null;
      this._fallbackOrder = 100;
      this._recognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this._childRecognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this._configuredPromise = new Promise(function (resolve) {
        _this2._resolveConfiguredPromise = resolve;
      });
    };

    Router.prototype.registerViewPort = function registerViewPort(viewPort, name) {
      name = name || 'default';
      this.viewPorts[name] = viewPort;
    };

    Router.prototype.ensureConfigured = function ensureConfigured() {
      return this._configuredPromise;
    };

    Router.prototype.configure = function configure(callbackOrConfig) {
      var _this3 = this;

      this.isConfigured = true;

      var result = callbackOrConfig;
      var config = void 0;
      if (typeof callbackOrConfig === 'function') {
        config = new RouterConfiguration();
        result = callbackOrConfig(config);
      }

      return Promise.resolve(result).then(function (c) {
        if (c && c.exportToRouter) {
          config = c;
        }

        config.exportToRouter(_this3);
        _this3.isConfigured = true;
        _this3._resolveConfiguredPromise();
      });
    };

    Router.prototype.navigate = function navigate(fragment, options) {
      if (!this.isConfigured && this.parent) {
        return this.parent.navigate(fragment, options);
      }

      return this.history.navigate(_resolveUrl(fragment, this.baseUrl, this.history._hasPushState), options);
    };

    Router.prototype.navigateToRoute = function navigateToRoute(route, params, options) {
      var path = this.generate(route, params);
      return this.navigate(path, options);
    };

    Router.prototype.navigateBack = function navigateBack() {
      this.history.navigateBack();
    };

    Router.prototype.createChild = function createChild(container) {
      var childRouter = new Router(container || this.container.createChild(), this.history);
      childRouter.parent = this;
      return childRouter;
    };

    Router.prototype.generate = function generate(name, params) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var hasRoute = this._recognizer.hasRoute(name);
      if ((!this.isConfigured || !hasRoute) && this.parent) {
        return this.parent.generate(name, params);
      }

      if (!hasRoute) {
        throw new Error('A route with name \'' + name + '\' could not be found. Check that `name: \'' + name + '\'` was specified in the route\'s config.');
      }

      var path = this._recognizer.generate(name, params);
      var rootedPath = _createRootedPath(path, this.baseUrl, this.history._hasPushState, options.absolute);
      return options.absolute ? '' + this.history.getAbsoluteRoot() + rootedPath : rootedPath;
    };

    Router.prototype.createNavModel = function createNavModel(config) {
      var navModel = new NavModel(this, 'href' in config ? config.href : config.route);
      navModel.title = config.title;
      navModel.order = config.nav;
      navModel.href = config.href;
      navModel.settings = config.settings;
      navModel.config = config;

      return navModel;
    };

    Router.prototype.addRoute = function addRoute(config, navModel) {
      validateRouteConfig(config, this.routes);

      if (!('viewPorts' in config) && !config.navigationStrategy) {
        config.viewPorts = {
          'default': {
            moduleId: config.moduleId,
            view: config.view
          }
        };
      }

      if (!navModel) {
        navModel = this.createNavModel(config);
      }

      this.routes.push(config);

      var path = config.route;
      if (path.charAt(0) === '/') {
        path = path.substr(1);
      }
      var caseSensitive = config.caseSensitive === true;
      var state = this._recognizer.add({ path: path, handler: config, caseSensitive: caseSensitive });

      if (path) {
        var _settings = config.settings;
        delete config.settings;
        var withChild = JSON.parse(JSON.stringify(config));
        config.settings = _settings;
        withChild.route = path + '/*childRoute';
        withChild.hasChildRouter = true;
        this._childRecognizer.add({
          path: withChild.route,
          handler: withChild,
          caseSensitive: caseSensitive
        });

        withChild.navModel = navModel;
        withChild.settings = config.settings;
      }

      config.navModel = navModel;

      if ((navModel.order || navModel.order === 0) && this.navigation.indexOf(navModel) === -1) {
        if (!navModel.href && navModel.href !== '' && (state.types.dynamics || state.types.stars)) {
          throw new Error('Invalid route config for "' + config.route + '" : dynamic routes must specify an "href:" to be included in the navigation model.');
        }

        if (typeof navModel.order !== 'number') {
          navModel.order = ++this._fallbackOrder;
        }

        this.navigation.push(navModel);
        this.navigation = this.navigation.sort(function (a, b) {
          return a.order - b.order;
        });
      }
    };

    Router.prototype.hasRoute = function hasRoute(name) {
      return !!(this._recognizer.hasRoute(name) || this.parent && this.parent.hasRoute(name));
    };

    Router.prototype.hasOwnRoute = function hasOwnRoute(name) {
      return this._recognizer.hasRoute(name);
    };

    Router.prototype.handleUnknownRoutes = function handleUnknownRoutes(config) {
      var _this4 = this;

      if (!config) {
        throw new Error('Invalid unknown route handler');
      }

      this.catchAllHandler = function (instruction) {
        return _this4._createRouteConfig(config, instruction).then(function (c) {
          instruction.config = c;
          return instruction;
        });
      };
    };

    Router.prototype.updateTitle = function updateTitle() {
      if (this.parent) {
        return this.parent.updateTitle();
      }

      this.currentInstruction._updateTitle();
      return undefined;
    };

    Router.prototype.refreshNavigation = function refreshNavigation() {
      var nav = this.navigation;

      for (var i = 0, length = nav.length; i < length; i++) {
        var current = nav[i];
        if (!current.config.href) {
          current.href = _createRootedPath(current.relativeHref, this.baseUrl, this.history._hasPushState);
        } else {
          current.href = _normalizeAbsolutePath(current.config.href, this.history._hasPushState);
        }
      }
    };

    Router.prototype._refreshBaseUrl = function _refreshBaseUrl() {
      if (this.parent) {
        var baseUrl = this.parent.currentInstruction.getBaseUrl();
        this.baseUrl = this.parent.baseUrl + baseUrl;
      }
    };

    Router.prototype._createNavigationInstruction = function _createNavigationInstruction() {
      var url = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var parentInstruction = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var fragment = url;
      var queryString = '';

      var queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        fragment = url.substr(0, queryIndex);
        queryString = url.substr(queryIndex + 1);
      }

      var results = this._recognizer.recognize(url);
      if (!results || !results.length) {
        results = this._childRecognizer.recognize(url);
      }

      var instructionInit = {
        fragment: fragment,
        queryString: queryString,
        config: null,
        parentInstruction: parentInstruction,
        previousInstruction: this.currentInstruction,
        router: this,
        options: {
          compareQueryParams: this.options.compareQueryParams
        }
      };

      if (results && results.length) {
        var first = results[0];
        var _instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
          params: first.params,
          queryParams: first.queryParams || results.queryParams,
          config: first.config || first.handler
        }));

        if (typeof first.handler === 'function') {
          return evaluateNavigationStrategy(_instruction, first.handler, first);
        } else if (first.handler && 'navigationStrategy' in first.handler) {
          return evaluateNavigationStrategy(_instruction, first.handler.navigationStrategy, first.handler);
        }

        return Promise.resolve(_instruction);
      } else if (this.catchAllHandler) {
        var _instruction2 = new NavigationInstruction(Object.assign({}, instructionInit, {
          params: { path: fragment },
          queryParams: results && results.queryParams,
          config: null }));

        return evaluateNavigationStrategy(_instruction2, this.catchAllHandler);
      }

      return Promise.reject(new Error('Route not found: ' + url));
    };

    Router.prototype._createRouteConfig = function _createRouteConfig(config, instruction) {
      var _this5 = this;

      return Promise.resolve(config).then(function (c) {
        if (typeof c === 'string') {
          return { moduleId: c };
        } else if (typeof c === 'function') {
          return c(instruction);
        }

        return c;
      }).then(function (c) {
        return typeof c === 'string' ? { moduleId: c } : c;
      }).then(function (c) {
        c.route = instruction.params.path;
        validateRouteConfig(c, _this5.routes);

        if (!c.navModel) {
          c.navModel = _this5.createNavModel(c);
        }

        return c;
      });
    };

    _createClass(Router, [{
      key: 'isRoot',
      get: function get() {
        return !this.parent;
      }
    }]);

    return Router;
  }();

  function validateRouteConfig(config, routes) {
    if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) !== 'object') {
      throw new Error('Invalid Route Config');
    }

    if (typeof config.route !== 'string') {
      var _name2 = config.name || '(no name)';
      throw new Error('Invalid Route Config for "' + _name2 + '": You must specify a "route:" pattern.');
    }

    if (!('redirect' in config || config.moduleId || config.navigationStrategy || config.viewPorts)) {
      throw new Error('Invalid Route Config for "' + config.route + '": You must specify a "moduleId:", "redirect:", "navigationStrategy:", or "viewPorts:".');
    }
  }

  function evaluateNavigationStrategy(instruction, evaluator, context) {
    return Promise.resolve(evaluator.call(context, instruction)).then(function () {
      if (!('viewPorts' in instruction.config)) {
        instruction.config.viewPorts = {
          'default': {
            moduleId: instruction.config.moduleId
          }
        };
      }

      return instruction;
    });
  }

  var CanDeactivatePreviousStep = exports.CanDeactivatePreviousStep = function () {
    function CanDeactivatePreviousStep() {
      
    }

    CanDeactivatePreviousStep.prototype.run = function run(navigationInstruction, next) {
      return processDeactivatable(navigationInstruction.plan, 'canDeactivate', next);
    };

    return CanDeactivatePreviousStep;
  }();

  var CanActivateNextStep = exports.CanActivateNextStep = function () {
    function CanActivateNextStep() {
      
    }

    CanActivateNextStep.prototype.run = function run(navigationInstruction, next) {
      return processActivatable(navigationInstruction, 'canActivate', next);
    };

    return CanActivateNextStep;
  }();

  var DeactivatePreviousStep = exports.DeactivatePreviousStep = function () {
    function DeactivatePreviousStep() {
      
    }

    DeactivatePreviousStep.prototype.run = function run(navigationInstruction, next) {
      return processDeactivatable(navigationInstruction.plan, 'deactivate', next, true);
    };

    return DeactivatePreviousStep;
  }();

  var ActivateNextStep = exports.ActivateNextStep = function () {
    function ActivateNextStep() {
      
    }

    ActivateNextStep.prototype.run = function run(navigationInstruction, next) {
      return processActivatable(navigationInstruction, 'activate', next, true);
    };

    return ActivateNextStep;
  }();

  function processDeactivatable(plan, callbackName, next, ignoreResult) {
    var infos = findDeactivatable(plan, callbackName);
    var i = infos.length;

    function inspect(val) {
      if (ignoreResult || shouldContinue(val)) {
        return iterate();
      }

      return next.cancel(val);
    }

    function iterate() {
      if (i--) {
        try {
          var viewModel = infos[i];
          var _result = viewModel[callbackName]();
          return processPotential(_result, inspect, next.cancel);
        } catch (error) {
          return next.cancel(error);
        }
      }

      return next();
    }

    return iterate();
  }

  function findDeactivatable(plan, callbackName) {
    var list = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];

    for (var viewPortName in plan) {
      var _viewPortPlan = plan[viewPortName];
      var prevComponent = _viewPortPlan.prevComponent;

      if ((_viewPortPlan.strategy === activationStrategy.invokeLifecycle || _viewPortPlan.strategy === activationStrategy.replace) && prevComponent) {
        var viewModel = prevComponent.viewModel;

        if (callbackName in viewModel) {
          list.push(viewModel);
        }
      }

      if (_viewPortPlan.childNavigationInstruction) {
        findDeactivatable(_viewPortPlan.childNavigationInstruction.plan, callbackName, list);
      } else if (prevComponent) {
        addPreviousDeactivatable(prevComponent, callbackName, list);
      }
    }

    return list;
  }

  function addPreviousDeactivatable(component, callbackName, list) {
    var childRouter = component.childRouter;

    if (childRouter && childRouter.currentInstruction) {
      var viewPortInstructions = childRouter.currentInstruction.viewPortInstructions;

      for (var viewPortName in viewPortInstructions) {
        var _viewPortInstruction2 = viewPortInstructions[viewPortName];
        var prevComponent = _viewPortInstruction2.component;
        var prevViewModel = prevComponent.viewModel;

        if (callbackName in prevViewModel) {
          list.push(prevViewModel);
        }

        addPreviousDeactivatable(prevComponent, callbackName, list);
      }
    }
  }

  function processActivatable(navigationInstruction, callbackName, next, ignoreResult) {
    var infos = findActivatable(navigationInstruction, callbackName);
    var length = infos.length;
    var i = -1;

    function inspect(val, router) {
      if (ignoreResult || shouldContinue(val, router)) {
        return iterate();
      }

      return next.cancel(val);
    }

    function iterate() {
      i++;

      if (i < length) {
        try {
          var _ret3 = function () {
            var _current$viewModel;

            var current = infos[i];
            var result = (_current$viewModel = current.viewModel)[callbackName].apply(_current$viewModel, current.lifecycleArgs);
            return {
              v: processPotential(result, function (val) {
                return inspect(val, current.router);
              }, next.cancel)
            };
          }();

          if ((typeof _ret3 === 'undefined' ? 'undefined' : _typeof(_ret3)) === "object") return _ret3.v;
        } catch (error) {
          return next.cancel(error);
        }
      }

      return next();
    }

    return iterate();
  }

  function findActivatable(navigationInstruction, callbackName) {
    var list = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];
    var router = arguments[3];

    var plan = navigationInstruction.plan;

    Object.keys(plan).filter(function (viewPortName) {
      var viewPortPlan = plan[viewPortName];
      var viewPortInstruction = navigationInstruction.viewPortInstructions[viewPortName];
      var viewModel = viewPortInstruction.component.viewModel;

      if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle || viewPortPlan.strategy === activationStrategy.replace) && callbackName in viewModel) {
        list.push({
          viewModel: viewModel,
          lifecycleArgs: viewPortInstruction.lifecycleArgs,
          router: router
        });
      }

      if (viewPortPlan.childNavigationInstruction) {
        findActivatable(viewPortPlan.childNavigationInstruction, callbackName, list, viewPortInstruction.component.childRouter || router);
      }
    });

    return list;
  }

  function shouldContinue(output, router) {
    if (output instanceof Error) {
      return false;
    }

    if (isNavigationCommand(output)) {
      if (typeof output.setRouter === 'function') {
        output.setRouter(router);
      }

      return !!output.shouldContinueProcessing;
    }

    if (output === undefined) {
      return true;
    }

    return output;
  }

  var SafeSubscription = function () {
    function SafeSubscription(subscriptionFunc) {
      

      this._subscribed = true;
      this._subscription = subscriptionFunc(this);

      if (!this._subscribed) this.unsubscribe();
    }

    SafeSubscription.prototype.unsubscribe = function unsubscribe() {
      if (this._subscribed && this._subscription) this._subscription.unsubscribe();

      this._subscribed = false;
    };

    _createClass(SafeSubscription, [{
      key: 'subscribed',
      get: function get() {
        return this._subscribed;
      }
    }]);

    return SafeSubscription;
  }();

  function processPotential(obj, resolve, reject) {
    if (obj && typeof obj.then === 'function') {
      return Promise.resolve(obj).then(resolve).catch(reject);
    }

    if (obj && typeof obj.subscribe === 'function') {
      var _ret4 = function () {
        var obs = obj;
        return {
          v: new SafeSubscription(function (sub) {
            return obs.subscribe({
              next: function next() {
                if (sub.subscribed) {
                  sub.unsubscribe();
                  resolve(obj);
                }
              },
              error: function error(_error) {
                if (sub.subscribed) {
                  sub.unsubscribe();
                  reject(_error);
                }
              },
              complete: function complete() {
                if (sub.subscribed) {
                  sub.unsubscribe();
                  resolve(obj);
                }
              }
            });
          })
        };
      }();

      if ((typeof _ret4 === 'undefined' ? 'undefined' : _typeof(_ret4)) === "object") return _ret4.v;
    }

    try {
      return resolve(obj);
    } catch (error) {
      return reject(error);
    }
  }

  var RouteLoader = exports.RouteLoader = function () {
    function RouteLoader() {
      
    }

    RouteLoader.prototype.loadRoute = function loadRoute(router, config, navigationInstruction) {
      throw Error('Route loaders must implement "loadRoute(router, config, navigationInstruction)".');
    };

    return RouteLoader;
  }();

  var LoadRouteStep = exports.LoadRouteStep = function () {
    LoadRouteStep.inject = function inject() {
      return [RouteLoader];
    };

    function LoadRouteStep(routeLoader) {
      

      this.routeLoader = routeLoader;
    }

    LoadRouteStep.prototype.run = function run(navigationInstruction, next) {
      return loadNewRoute(this.routeLoader, navigationInstruction).then(next).catch(next.cancel);
    };

    return LoadRouteStep;
  }();

  function loadNewRoute(routeLoader, navigationInstruction) {
    var toLoad = determineWhatToLoad(navigationInstruction);
    var loadPromises = toLoad.map(function (current) {
      return loadRoute(routeLoader, current.navigationInstruction, current.viewPortPlan);
    });

    return Promise.all(loadPromises);
  }

  function determineWhatToLoad(navigationInstruction) {
    var toLoad = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

    var plan = navigationInstruction.plan;

    for (var viewPortName in plan) {
      var _viewPortPlan2 = plan[viewPortName];

      if (_viewPortPlan2.strategy === activationStrategy.replace) {
        toLoad.push({ viewPortPlan: _viewPortPlan2, navigationInstruction: navigationInstruction });

        if (_viewPortPlan2.childNavigationInstruction) {
          determineWhatToLoad(_viewPortPlan2.childNavigationInstruction, toLoad);
        }
      } else {
        var _viewPortInstruction3 = navigationInstruction.addViewPortInstruction(viewPortName, _viewPortPlan2.strategy, _viewPortPlan2.prevModuleId, _viewPortPlan2.prevComponent);

        if (_viewPortPlan2.childNavigationInstruction) {
          _viewPortInstruction3.childNavigationInstruction = _viewPortPlan2.childNavigationInstruction;
          determineWhatToLoad(_viewPortPlan2.childNavigationInstruction, toLoad);
        }
      }
    }

    return toLoad;
  }

  function loadRoute(routeLoader, navigationInstruction, viewPortPlan) {
    var moduleId = viewPortPlan.config.moduleId;

    return loadComponent(routeLoader, navigationInstruction, viewPortPlan.config).then(function (component) {
      var viewPortInstruction = navigationInstruction.addViewPortInstruction(viewPortPlan.name, viewPortPlan.strategy, moduleId, component);

      var childRouter = component.childRouter;
      if (childRouter) {
        var path = navigationInstruction.getWildcardPath();

        return childRouter._createNavigationInstruction(path, navigationInstruction).then(function (childInstruction) {
          viewPortPlan.childNavigationInstruction = childInstruction;

          return _buildNavigationPlan(childInstruction).then(function (childPlan) {
            childInstruction.plan = childPlan;
            viewPortInstruction.childNavigationInstruction = childInstruction;

            return loadNewRoute(routeLoader, childInstruction);
          });
        });
      }

      return undefined;
    });
  }

  function loadComponent(routeLoader, navigationInstruction, config) {
    var router = navigationInstruction.router;
    var lifecycleArgs = navigationInstruction.lifecycleArgs;

    return routeLoader.loadRoute(router, config, navigationInstruction).then(function (component) {
      var viewModel = component.viewModel;
      var childContainer = component.childContainer;

      component.router = router;
      component.config = config;

      if ('configureRouter' in viewModel) {
        var _ret5 = function () {
          var childRouter = childContainer.getChildRouter();
          component.childRouter = childRouter;

          return {
            v: childRouter.configure(function (c) {
              return viewModel.configureRouter.apply(viewModel, [c, childRouter].concat(lifecycleArgs));
            }).then(function () {
              return component;
            })
          };
        }();

        if ((typeof _ret5 === 'undefined' ? 'undefined' : _typeof(_ret5)) === "object") return _ret5.v;
      }

      return component;
    });
  }

  var PipelineSlot = function () {
    function PipelineSlot(container, name, alias) {
      

      this.steps = [];

      this.container = container;
      this.slotName = name;
      this.slotAlias = alias;
    }

    PipelineSlot.prototype.getSteps = function getSteps() {
      var _this6 = this;

      return this.steps.map(function (x) {
        return _this6.container.get(x);
      });
    };

    return PipelineSlot;
  }();

  var PipelineProvider = exports.PipelineProvider = function () {
    PipelineProvider.inject = function inject() {
      return [_aureliaDependencyInjection.Container];
    };

    function PipelineProvider(container) {
      

      this.container = container;
      this.steps = [BuildNavigationPlanStep, CanDeactivatePreviousStep, LoadRouteStep, this._createPipelineSlot('authorize'), CanActivateNextStep, this._createPipelineSlot('preActivate', 'modelbind'), DeactivatePreviousStep, ActivateNextStep, this._createPipelineSlot('preRender', 'precommit'), CommitChangesStep, this._createPipelineSlot('postRender', 'postcomplete')];
    }

    PipelineProvider.prototype.createPipeline = function createPipeline() {
      var _this7 = this;

      var pipeline = new Pipeline();
      this.steps.forEach(function (step) {
        return pipeline.addStep(_this7.container.get(step));
      });
      return pipeline;
    };

    PipelineProvider.prototype._findStep = function _findStep(name) {
      return this.steps.find(function (x) {
        return x.slotName === name || x.slotAlias === name;
      });
    };

    PipelineProvider.prototype.addStep = function addStep(name, step) {
      var found = this._findStep(name);
      if (found) {
        if (!found.steps.includes(step)) {
          found.steps.push(step);
        }
      } else {
        throw new Error('Invalid pipeline slot name: ' + name + '.');
      }
    };

    PipelineProvider.prototype.removeStep = function removeStep(name, step) {
      var slot = this._findStep(name);
      if (slot) {
        slot.steps.splice(slot.steps.indexOf(step), 1);
      }
    };

    PipelineProvider.prototype._clearSteps = function _clearSteps() {
      var name = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

      var slot = this._findStep(name);
      if (slot) {
        slot.steps = [];
      }
    };

    PipelineProvider.prototype.reset = function reset() {
      this._clearSteps('authorize');
      this._clearSteps('preActivate');
      this._clearSteps('preRender');
      this._clearSteps('postRender');
    };

    PipelineProvider.prototype._createPipelineSlot = function _createPipelineSlot(name, alias) {
      return new PipelineSlot(this.container, name, alias);
    };

    return PipelineProvider;
  }();

  var logger = LogManager.getLogger('app-router');

  var AppRouter = exports.AppRouter = function (_Router) {
    _inherits(AppRouter, _Router);

    AppRouter.inject = function inject() {
      return [_aureliaDependencyInjection.Container, _aureliaHistory.History, PipelineProvider, _aureliaEventAggregator.EventAggregator];
    };

    function AppRouter(container, history, pipelineProvider, events) {
      

      var _this8 = _possibleConstructorReturn(this, _Router.call(this, container, history));

      _this8.pipelineProvider = pipelineProvider;
      _this8.events = events;
      return _this8;
    }

    AppRouter.prototype.reset = function reset() {
      _Router.prototype.reset.call(this);
      this.maxInstructionCount = 10;
      if (!this._queue) {
        this._queue = [];
      } else {
        this._queue.length = 0;
      }
    };

    AppRouter.prototype.loadUrl = function loadUrl(url) {
      var _this9 = this;

      return this._createNavigationInstruction(url).then(function (instruction) {
        return _this9._queueInstruction(instruction);
      }).catch(function (error) {
        logger.error(error);
        restorePreviousLocation(_this9);
      });
    };

    AppRouter.prototype.registerViewPort = function registerViewPort(viewPort, name) {
      var _this10 = this;

      _Router.prototype.registerViewPort.call(this, viewPort, name);

      if (!this.isActive) {
        var _ret6 = function () {
          var viewModel = _this10._findViewModel(viewPort);
          if ('configureRouter' in viewModel) {
            if (!_this10.isConfigured) {
              var _ret7 = function () {
                var resolveConfiguredPromise = _this10._resolveConfiguredPromise;
                _this10._resolveConfiguredPromise = function () {};
                return {
                  v: {
                    v: _this10.configure(function (config) {
                      return viewModel.configureRouter(config, _this10);
                    }).then(function () {
                      _this10.activate();
                      resolveConfiguredPromise();
                    })
                  }
                };
              }();

              if ((typeof _ret7 === 'undefined' ? 'undefined' : _typeof(_ret7)) === "object") return _ret7.v;
            }
          } else {
            _this10.activate();
          }
        }();

        if ((typeof _ret6 === 'undefined' ? 'undefined' : _typeof(_ret6)) === "object") return _ret6.v;
      } else {
        this._dequeueInstruction();
      }

      return Promise.resolve();
    };

    AppRouter.prototype.activate = function activate(options) {
      if (this.isActive) {
        return;
      }

      this.isActive = true;
      this.options = Object.assign({ routeHandler: this.loadUrl.bind(this) }, this.options, options);
      this.history.activate(this.options);
      this._dequeueInstruction();
    };

    AppRouter.prototype.deactivate = function deactivate() {
      this.isActive = false;
      this.history.deactivate();
    };

    AppRouter.prototype._queueInstruction = function _queueInstruction(instruction) {
      var _this11 = this;

      return new Promise(function (resolve) {
        instruction.resolve = resolve;
        _this11._queue.unshift(instruction);
        _this11._dequeueInstruction();
      });
    };

    AppRouter.prototype._dequeueInstruction = function _dequeueInstruction() {
      var _this12 = this;

      var instructionCount = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      return Promise.resolve().then(function () {
        if (_this12.isNavigating && !instructionCount) {
          return undefined;
        }

        var instruction = _this12._queue.shift();
        _this12._queue.length = 0;

        if (!instruction) {
          return undefined;
        }

        _this12.isNavigating = true;
        instruction.previousInstruction = _this12.currentInstruction;

        if (!instructionCount) {
          _this12.events.publish('router:navigation:processing', { instruction: instruction });
        } else if (instructionCount === _this12.maxInstructionCount - 1) {
          logger.error(instructionCount + 1 + ' navigation instructions have been attempted without success. Restoring last known good location.');
          restorePreviousLocation(_this12);
          return _this12._dequeueInstruction(instructionCount + 1);
        } else if (instructionCount > _this12.maxInstructionCount) {
          throw new Error('Maximum navigation attempts exceeded. Giving up.');
        }

        var pipeline = _this12.pipelineProvider.createPipeline();

        return pipeline.run(instruction).then(function (result) {
          return processResult(instruction, result, instructionCount, _this12);
        }).catch(function (error) {
          return { output: error instanceof Error ? error : new Error(error) };
        }).then(function (result) {
          return resolveInstruction(instruction, result, !!instructionCount, _this12);
        });
      });
    };

    AppRouter.prototype._findViewModel = function _findViewModel(viewPort) {
      if (this.container.viewModel) {
        return this.container.viewModel;
      }

      if (viewPort.container) {
        var container = viewPort.container;

        while (container) {
          if (container.viewModel) {
            this.container.viewModel = container.viewModel;
            return container.viewModel;
          }

          container = container.parent;
        }
      }

      return undefined;
    };

    return AppRouter;
  }(Router);

  function processResult(instruction, result, instructionCount, router) {
    if (!(result && 'completed' in result && 'output' in result)) {
      result = result || {};
      result.output = new Error('Expected router pipeline to return a navigation result, but got [' + JSON.stringify(result) + '] instead.');
    }

    var finalResult = null;
    if (isNavigationCommand(result.output)) {
      result.output.navigate(router);
    } else {
      finalResult = result;

      if (!result.completed) {
        if (result.output instanceof Error) {
          logger.error(result.output);
        }

        restorePreviousLocation(router);
      }
    }

    return router._dequeueInstruction(instructionCount + 1).then(function (innerResult) {
      return finalResult || innerResult || result;
    });
  }

  function resolveInstruction(instruction, result, isInnerInstruction, router) {
    instruction.resolve(result);

    if (!isInnerInstruction) {
      router.isNavigating = false;
      var eventArgs = { instruction: instruction, result: result };
      var eventName = void 0;

      if (result.output instanceof Error) {
        eventName = 'error';
      } else if (!result.completed) {
        eventName = 'canceled';
      } else {
        var _queryString = instruction.queryString ? '?' + instruction.queryString : '';
        router.history.previousLocation = instruction.fragment + _queryString;
        eventName = 'success';
      }

      router.events.publish('router:navigation:' + eventName, eventArgs);
      router.events.publish('router:navigation:complete', eventArgs);
    }

    return result;
  }

  function restorePreviousLocation(router) {
    var previousLocation = router.history.previousLocation;
    if (previousLocation) {
      router.navigate(router.history.previousLocation, { trigger: false, replace: true });
    } else {
      logger.error('Router navigation failed, and no previous location could be restored.');
    }
  }
});
define('aurelia-task-queue',['exports', 'aurelia-pal'], function (exports, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.TaskQueue = undefined;

  

  var hasSetImmediate = typeof setImmediate === 'function';

  function makeRequestFlushFromMutationObserver(flush) {
    var toggle = 1;
    var observer = _aureliaPal.DOM.createMutationObserver(flush);
    var node = _aureliaPal.DOM.createTextNode('');
    observer.observe(node, { characterData: true });
    return function requestFlush() {
      toggle = -toggle;
      node.data = toggle;
    };
  }

  function makeRequestFlushFromTimer(flush) {
    return function requestFlush() {
      var timeoutHandle = setTimeout(handleFlushTimer, 0);

      var intervalHandle = setInterval(handleFlushTimer, 50);
      function handleFlushTimer() {
        clearTimeout(timeoutHandle);
        clearInterval(intervalHandle);
        flush();
      }
    };
  }

  function onError(error, task) {
    if ('onError' in task) {
      task.onError(error);
    } else if (hasSetImmediate) {
      setImmediate(function () {
        throw error;
      });
    } else {
      setTimeout(function () {
        throw error;
      }, 0);
    }
  }

  var TaskQueue = exports.TaskQueue = function () {
    function TaskQueue() {
      var _this = this;

      

      this.microTaskQueue = [];
      this.microTaskQueueCapacity = 1024;
      this.taskQueue = [];

      if (_aureliaPal.FEATURE.mutationObserver) {
        this.requestFlushMicroTaskQueue = makeRequestFlushFromMutationObserver(function () {
          return _this.flushMicroTaskQueue();
        });
      } else {
        this.requestFlushMicroTaskQueue = makeRequestFlushFromTimer(function () {
          return _this.flushMicroTaskQueue();
        });
      }

      this.requestFlushTaskQueue = makeRequestFlushFromTimer(function () {
        return _this.flushTaskQueue();
      });
    }

    TaskQueue.prototype.queueMicroTask = function queueMicroTask(task) {
      if (this.microTaskQueue.length < 1) {
        this.requestFlushMicroTaskQueue();
      }

      this.microTaskQueue.push(task);
    };

    TaskQueue.prototype.queueTask = function queueTask(task) {
      if (this.taskQueue.length < 1) {
        this.requestFlushTaskQueue();
      }

      this.taskQueue.push(task);
    };

    TaskQueue.prototype.flushTaskQueue = function flushTaskQueue() {
      var queue = this.taskQueue;
      var index = 0;
      var task = void 0;

      this.taskQueue = [];

      try {
        while (index < queue.length) {
          task = queue[index];
          task.call();
          index++;
        }
      } catch (error) {
        onError(error, task);
      }
    };

    TaskQueue.prototype.flushMicroTaskQueue = function flushMicroTaskQueue() {
      var queue = this.microTaskQueue;
      var capacity = this.microTaskQueueCapacity;
      var index = 0;
      var task = void 0;

      try {
        while (index < queue.length) {
          task = queue[index];
          task.call();
          index++;

          if (index > capacity) {
            for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
              queue[scan] = queue[scan + index];
            }

            queue.length -= index;
            index = 0;
          }
        }
      } catch (error) {
        onError(error, task);
      }

      queue.length = 0;
    };

    return TaskQueue;
  }();
});
define('aurelia-templating',['exports', 'aurelia-logging', 'aurelia-metadata', 'aurelia-pal', 'aurelia-path', 'aurelia-loader', 'aurelia-dependency-injection', 'aurelia-binding', 'aurelia-task-queue'], function (exports, _aureliaLogging, _aureliaMetadata, _aureliaPal, _aureliaPath, _aureliaLoader, _aureliaDependencyInjection, _aureliaBinding, _aureliaTaskQueue) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.TemplatingEngine = exports.ElementConfigResource = exports.CompositionEngine = exports.HtmlBehaviorResource = exports.BindableProperty = exports.BehaviorPropertyObserver = exports.Controller = exports.ViewEngine = exports.ModuleAnalyzer = exports.ResourceDescription = exports.ResourceModule = exports.ViewCompiler = exports.ViewFactory = exports.BoundViewFactory = exports.ViewSlot = exports.View = exports.ViewResources = exports.ShadowDOM = exports.ShadowSlot = exports.PassThroughSlot = exports.SlotCustomAttribute = exports.BindingLanguage = exports.ViewLocator = exports.InlineViewStrategy = exports.TemplateRegistryViewStrategy = exports.NoViewStrategy = exports.ConventionalViewStrategy = exports.RelativeViewStrategy = exports.viewStrategy = exports.TargetInstruction = exports.BehaviorInstruction = exports.ViewCompileInstruction = exports.ResourceLoadContext = exports.ElementEvents = exports.ViewEngineHooksResource = exports.CompositionTransaction = exports.CompositionTransactionOwnershipToken = exports.CompositionTransactionNotifier = exports.Animator = exports.animationEvent = undefined;
  exports._hyphenate = _hyphenate;
  exports._isAllWhitespace = _isAllWhitespace;
  exports.viewEngineHooks = viewEngineHooks;
  exports.children = children;
  exports.child = child;
  exports.resource = resource;
  exports.behavior = behavior;
  exports.customElement = customElement;
  exports.customAttribute = customAttribute;
  exports.templateController = templateController;
  exports.bindable = bindable;
  exports.dynamicOptions = dynamicOptions;
  exports.useShadowDOM = useShadowDOM;
  exports.processAttributes = processAttributes;
  exports.processContent = processContent;
  exports.containerless = containerless;
  exports.useViewStrategy = useViewStrategy;
  exports.useView = useView;
  exports.inlineView = inlineView;
  exports.noView = noView;
  exports.elementConfig = elementConfig;
  exports.viewResources = viewResources;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var _class4, _temp, _dec, _class5, _dec2, _class6, _dec3, _class7, _dec4, _class8, _dec5, _class9, _class10, _temp2, _dec6, _class11, _class12, _temp3, _class15, _dec7, _class17, _dec8, _class18, _class19, _temp4, _dec9, _class21, _dec10, _class22, _dec11, _class23;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  

  var animationEvent = exports.animationEvent = {
    enterBegin: 'animation:enter:begin',
    enterActive: 'animation:enter:active',
    enterDone: 'animation:enter:done',
    enterTimeout: 'animation:enter:timeout',

    leaveBegin: 'animation:leave:begin',
    leaveActive: 'animation:leave:active',
    leaveDone: 'animation:leave:done',
    leaveTimeout: 'animation:leave:timeout',

    staggerNext: 'animation:stagger:next',

    removeClassBegin: 'animation:remove-class:begin',
    removeClassActive: 'animation:remove-class:active',
    removeClassDone: 'animation:remove-class:done',
    removeClassTimeout: 'animation:remove-class:timeout',

    addClassBegin: 'animation:add-class:begin',
    addClassActive: 'animation:add-class:active',
    addClassDone: 'animation:add-class:done',
    addClassTimeout: 'animation:add-class:timeout',

    animateBegin: 'animation:animate:begin',
    animateActive: 'animation:animate:active',
    animateDone: 'animation:animate:done',
    animateTimeout: 'animation:animate:timeout',

    sequenceBegin: 'animation:sequence:begin',
    sequenceDone: 'animation:sequence:done'
  };

  var Animator = exports.Animator = function () {
    function Animator() {
      
    }

    Animator.prototype.enter = function enter(element) {
      return Promise.resolve(false);
    };

    Animator.prototype.leave = function leave(element) {
      return Promise.resolve(false);
    };

    Animator.prototype.removeClass = function removeClass(element, className) {
      element.classList.remove(className);
      return Promise.resolve(false);
    };

    Animator.prototype.addClass = function addClass(element, className) {
      element.classList.add(className);
      return Promise.resolve(false);
    };

    Animator.prototype.animate = function animate(element, className) {
      return Promise.resolve(false);
    };

    Animator.prototype.runSequence = function runSequence(animations) {};

    Animator.prototype.registerEffect = function registerEffect(effectName, properties) {};

    Animator.prototype.unregisterEffect = function unregisterEffect(effectName) {};

    return Animator;
  }();

  var CompositionTransactionNotifier = exports.CompositionTransactionNotifier = function () {
    function CompositionTransactionNotifier(owner) {
      

      this.owner = owner;
      this.owner._compositionCount++;
    }

    CompositionTransactionNotifier.prototype.done = function done() {
      this.owner._compositionCount--;
      this.owner._tryCompleteTransaction();
    };

    return CompositionTransactionNotifier;
  }();

  var CompositionTransactionOwnershipToken = exports.CompositionTransactionOwnershipToken = function () {
    function CompositionTransactionOwnershipToken(owner) {
      

      this.owner = owner;
      this.owner._ownershipToken = this;
      this.thenable = this._createThenable();
    }

    CompositionTransactionOwnershipToken.prototype.waitForCompositionComplete = function waitForCompositionComplete() {
      this.owner._tryCompleteTransaction();
      return this.thenable;
    };

    CompositionTransactionOwnershipToken.prototype.resolve = function resolve() {
      this._resolveCallback();
    };

    CompositionTransactionOwnershipToken.prototype._createThenable = function _createThenable() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this._resolveCallback = resolve;
      });
    };

    return CompositionTransactionOwnershipToken;
  }();

  var CompositionTransaction = exports.CompositionTransaction = function () {
    function CompositionTransaction() {
      

      this._ownershipToken = null;
      this._compositionCount = 0;
    }

    CompositionTransaction.prototype.tryCapture = function tryCapture() {
      return this._ownershipToken === null ? new CompositionTransactionOwnershipToken(this) : null;
    };

    CompositionTransaction.prototype.enlist = function enlist() {
      return new CompositionTransactionNotifier(this);
    };

    CompositionTransaction.prototype._tryCompleteTransaction = function _tryCompleteTransaction() {
      if (this._compositionCount <= 0) {
        this._compositionCount = 0;

        if (this._ownershipToken !== null) {
          var token = this._ownershipToken;
          this._ownershipToken = null;
          token.resolve();
        }
      }
    };

    return CompositionTransaction;
  }();

  var capitalMatcher = /([A-Z])/g;

  function addHyphenAndLower(char) {
    return '-' + char.toLowerCase();
  }

  function _hyphenate(name) {
    return (name.charAt(0).toLowerCase() + name.slice(1)).replace(capitalMatcher, addHyphenAndLower);
  }

  function _isAllWhitespace(node) {
    return !(node.auInterpolationTarget || /[^\t\n\r ]/.test(node.textContent));
  }

  var ViewEngineHooksResource = exports.ViewEngineHooksResource = function () {
    function ViewEngineHooksResource() {
      
    }

    ViewEngineHooksResource.prototype.initialize = function initialize(container, target) {
      this.instance = container.get(target);
    };

    ViewEngineHooksResource.prototype.register = function register(registry, name) {
      registry.registerViewEngineHooks(this.instance);
    };

    ViewEngineHooksResource.prototype.load = function load(container, target) {};

    ViewEngineHooksResource.convention = function convention(name) {
      if (name.endsWith('ViewEngineHooks')) {
        return new ViewEngineHooksResource();
      }
    };

    return ViewEngineHooksResource;
  }();

  function viewEngineHooks(target) {
    var deco = function deco(t) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ViewEngineHooksResource(), t);
    };

    return target ? deco(target) : deco;
  }

  var ElementEvents = exports.ElementEvents = function () {
    function ElementEvents(element) {
      

      this.element = element;
      this.subscriptions = {};
    }

    ElementEvents.prototype._enqueueHandler = function _enqueueHandler(handler) {
      this.subscriptions[handler.eventName] = this.subscriptions[handler.eventName] || [];
      this.subscriptions[handler.eventName].push(handler);
    };

    ElementEvents.prototype._dequeueHandler = function _dequeueHandler(handler) {
      var index = void 0;
      var subscriptions = this.subscriptions[handler.eventName];
      if (subscriptions) {
        index = subscriptions.indexOf(handler);
        if (index > -1) {
          subscriptions.splice(index, 1);
        }
      }
      return handler;
    };

    ElementEvents.prototype.publish = function publish(eventName) {
      var detail = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var bubbles = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];
      var cancelable = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

      var event = _aureliaPal.DOM.createCustomEvent(eventName, { cancelable: cancelable, bubbles: bubbles, detail: detail });
      this.element.dispatchEvent(event);
    };

    ElementEvents.prototype.subscribe = function subscribe(eventName, handler) {
      var _this2 = this;

      var bubbles = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

      if (handler && typeof handler === 'function') {
        handler.eventName = eventName;
        handler.handler = handler;
        handler.bubbles = bubbles;
        handler.dispose = function () {
          _this2.element.removeEventListener(eventName, handler, bubbles);
          _this2._dequeueHandler(handler);
        };
        this.element.addEventListener(eventName, handler, bubbles);
        this._enqueueHandler(handler);
        return handler;
      }

      return undefined;
    };

    ElementEvents.prototype.subscribeOnce = function subscribeOnce(eventName, handler) {
      var _this3 = this;

      var bubbles = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

      if (handler && typeof handler === 'function') {
        var _ret = function () {
          var _handler = function _handler(event) {
            handler(event);
            _handler.dispose();
          };
          return {
            v: _this3.subscribe(eventName, _handler, bubbles)
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }

      return undefined;
    };

    ElementEvents.prototype.dispose = function dispose(eventName) {
      if (eventName && typeof eventName === 'string') {
        var subscriptions = this.subscriptions[eventName];
        if (subscriptions) {
          while (subscriptions.length) {
            var subscription = subscriptions.pop();
            if (subscription) {
              subscription.dispose();
            }
          }
        }
      } else {
        this.disposeAll();
      }
    };

    ElementEvents.prototype.disposeAll = function disposeAll() {
      for (var key in this.subscriptions) {
        this.dispose(key);
      }
    };

    return ElementEvents;
  }();

  var ResourceLoadContext = exports.ResourceLoadContext = function () {
    function ResourceLoadContext() {
      

      this.dependencies = {};
    }

    ResourceLoadContext.prototype.addDependency = function addDependency(url) {
      this.dependencies[url] = true;
    };

    ResourceLoadContext.prototype.hasDependency = function hasDependency(url) {
      return url in this.dependencies;
    };

    return ResourceLoadContext;
  }();

  var ViewCompileInstruction = exports.ViewCompileInstruction = function ViewCompileInstruction() {
    var targetShadowDOM = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];
    var compileSurrogate = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

    

    this.targetShadowDOM = targetShadowDOM;
    this.compileSurrogate = compileSurrogate;
    this.associatedModuleId = null;
  };

  ViewCompileInstruction.normal = new ViewCompileInstruction();

  var BehaviorInstruction = exports.BehaviorInstruction = function () {
    BehaviorInstruction.enhance = function enhance() {
      var instruction = new BehaviorInstruction();
      instruction.enhance = true;
      return instruction;
    };

    BehaviorInstruction.unitTest = function unitTest(type, attributes) {
      var instruction = new BehaviorInstruction();
      instruction.type = type;
      instruction.attributes = attributes || {};
      return instruction;
    };

    BehaviorInstruction.element = function element(node, type) {
      var instruction = new BehaviorInstruction();
      instruction.type = type;
      instruction.attributes = {};
      instruction.anchorIsContainer = !(node.hasAttribute('containerless') || type.containerless);
      instruction.initiatedByBehavior = true;
      return instruction;
    };

    BehaviorInstruction.attribute = function attribute(attrName, type) {
      var instruction = new BehaviorInstruction();
      instruction.attrName = attrName;
      instruction.type = type || null;
      instruction.attributes = {};
      return instruction;
    };

    BehaviorInstruction.dynamic = function dynamic(host, viewModel, viewFactory) {
      var instruction = new BehaviorInstruction();
      instruction.host = host;
      instruction.viewModel = viewModel;
      instruction.viewFactory = viewFactory;
      instruction.inheritBindingContext = true;
      return instruction;
    };

    function BehaviorInstruction() {
      

      this.initiatedByBehavior = false;
      this.enhance = false;
      this.partReplacements = null;
      this.viewFactory = null;
      this.originalAttrName = null;
      this.skipContentProcessing = false;
      this.contentFactory = null;
      this.viewModel = null;
      this.anchorIsContainer = false;
      this.host = null;
      this.attributes = null;
      this.type = null;
      this.attrName = null;
      this.inheritBindingContext = false;
    }

    return BehaviorInstruction;
  }();

  BehaviorInstruction.normal = new BehaviorInstruction();

  var TargetInstruction = exports.TargetInstruction = (_temp = _class4 = function () {
    TargetInstruction.shadowSlot = function shadowSlot(parentInjectorId) {
      var instruction = new TargetInstruction();
      instruction.parentInjectorId = parentInjectorId;
      instruction.shadowSlot = true;
      return instruction;
    };

    TargetInstruction.contentExpression = function contentExpression(expression) {
      var instruction = new TargetInstruction();
      instruction.contentExpression = expression;
      return instruction;
    };

    TargetInstruction.lifting = function lifting(parentInjectorId, liftingInstruction) {
      var instruction = new TargetInstruction();
      instruction.parentInjectorId = parentInjectorId;
      instruction.expressions = TargetInstruction.noExpressions;
      instruction.behaviorInstructions = [liftingInstruction];
      instruction.viewFactory = liftingInstruction.viewFactory;
      instruction.providers = [liftingInstruction.type.target];
      instruction.lifting = true;
      return instruction;
    };

    TargetInstruction.normal = function normal(injectorId, parentInjectorId, providers, behaviorInstructions, expressions, elementInstruction) {
      var instruction = new TargetInstruction();
      instruction.injectorId = injectorId;
      instruction.parentInjectorId = parentInjectorId;
      instruction.providers = providers;
      instruction.behaviorInstructions = behaviorInstructions;
      instruction.expressions = expressions;
      instruction.anchorIsContainer = elementInstruction ? elementInstruction.anchorIsContainer : true;
      instruction.elementInstruction = elementInstruction;
      return instruction;
    };

    TargetInstruction.surrogate = function surrogate(providers, behaviorInstructions, expressions, values) {
      var instruction = new TargetInstruction();
      instruction.expressions = expressions;
      instruction.behaviorInstructions = behaviorInstructions;
      instruction.providers = providers;
      instruction.values = values;
      return instruction;
    };

    function TargetInstruction() {
      

      this.injectorId = null;
      this.parentInjectorId = null;

      this.shadowSlot = false;
      this.slotName = null;
      this.slotFallbackFactory = null;

      this.contentExpression = null;

      this.expressions = null;
      this.behaviorInstructions = null;
      this.providers = null;

      this.viewFactory = null;

      this.anchorIsContainer = false;
      this.elementInstruction = null;
      this.lifting = false;

      this.values = null;
    }

    return TargetInstruction;
  }(), _class4.noExpressions = Object.freeze([]), _temp);
  var viewStrategy = exports.viewStrategy = _aureliaMetadata.protocol.create('aurelia:view-strategy', {
    validate: function validate(target) {
      if (!(typeof target.loadViewFactory === 'function')) {
        return 'View strategies must implement: loadViewFactory(viewEngine: ViewEngine, compileInstruction: ViewCompileInstruction, loadContext?: ResourceLoadContext): Promise<ViewFactory>';
      }

      return true;
    },
    compose: function compose(target) {
      if (!(typeof target.makeRelativeTo === 'function')) {
        target.makeRelativeTo = _aureliaPal.PLATFORM.noop;
      }
    }
  });

  var RelativeViewStrategy = exports.RelativeViewStrategy = (_dec = viewStrategy(), _dec(_class5 = function () {
    function RelativeViewStrategy(path) {
      

      this.path = path;
      this.absolutePath = null;
    }

    RelativeViewStrategy.prototype.loadViewFactory = function loadViewFactory(viewEngine, compileInstruction, loadContext, target) {
      if (this.absolutePath === null && this.moduleId) {
        this.absolutePath = (0, _aureliaPath.relativeToFile)(this.path, this.moduleId);
      }

      compileInstruction.associatedModuleId = this.moduleId;
      return viewEngine.loadViewFactory(this.absolutePath || this.path, compileInstruction, loadContext, target);
    };

    RelativeViewStrategy.prototype.makeRelativeTo = function makeRelativeTo(file) {
      if (this.absolutePath === null) {
        this.absolutePath = (0, _aureliaPath.relativeToFile)(this.path, file);
      }
    };

    return RelativeViewStrategy;
  }()) || _class5);
  var ConventionalViewStrategy = exports.ConventionalViewStrategy = (_dec2 = viewStrategy(), _dec2(_class6 = function () {
    function ConventionalViewStrategy(viewLocator, origin) {
      

      this.moduleId = origin.moduleId;
      this.viewUrl = viewLocator.convertOriginToViewUrl(origin);
    }

    ConventionalViewStrategy.prototype.loadViewFactory = function loadViewFactory(viewEngine, compileInstruction, loadContext, target) {
      compileInstruction.associatedModuleId = this.moduleId;
      return viewEngine.loadViewFactory(this.viewUrl, compileInstruction, loadContext, target);
    };

    return ConventionalViewStrategy;
  }()) || _class6);
  var NoViewStrategy = exports.NoViewStrategy = (_dec3 = viewStrategy(), _dec3(_class7 = function () {
    function NoViewStrategy(dependencies, dependencyBaseUrl) {
      

      this.dependencies = dependencies || null;
      this.dependencyBaseUrl = dependencyBaseUrl || '';
    }

    NoViewStrategy.prototype.loadViewFactory = function loadViewFactory(viewEngine, compileInstruction, loadContext, target) {
      var entry = this.entry;
      var dependencies = this.dependencies;

      if (entry && entry.factoryIsReady) {
        return Promise.resolve(null);
      }

      this.entry = entry = new _aureliaLoader.TemplateRegistryEntry(this.moduleId || this.dependencyBaseUrl);

      entry.dependencies = [];
      entry.templateIsLoaded = true;

      if (dependencies !== null) {
        for (var i = 0, ii = dependencies.length; i < ii; ++i) {
          var current = dependencies[i];

          if (typeof current === 'string' || typeof current === 'function') {
            entry.addDependency(current);
          } else {
            entry.addDependency(current.from, current.as);
          }
        }
      }

      compileInstruction.associatedModuleId = this.moduleId;

      return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };

    return NoViewStrategy;
  }()) || _class7);
  var TemplateRegistryViewStrategy = exports.TemplateRegistryViewStrategy = (_dec4 = viewStrategy(), _dec4(_class8 = function () {
    function TemplateRegistryViewStrategy(moduleId, entry) {
      

      this.moduleId = moduleId;
      this.entry = entry;
    }

    TemplateRegistryViewStrategy.prototype.loadViewFactory = function loadViewFactory(viewEngine, compileInstruction, loadContext, target) {
      var entry = this.entry;

      if (entry.factoryIsReady) {
        return Promise.resolve(entry.factory);
      }

      compileInstruction.associatedModuleId = this.moduleId;
      return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };

    return TemplateRegistryViewStrategy;
  }()) || _class8);
  var InlineViewStrategy = exports.InlineViewStrategy = (_dec5 = viewStrategy(), _dec5(_class9 = function () {
    function InlineViewStrategy(markup, dependencies, dependencyBaseUrl) {
      

      this.markup = markup;
      this.dependencies = dependencies || null;
      this.dependencyBaseUrl = dependencyBaseUrl || '';
    }

    InlineViewStrategy.prototype.loadViewFactory = function loadViewFactory(viewEngine, compileInstruction, loadContext, target) {
      var entry = this.entry;
      var dependencies = this.dependencies;

      if (entry && entry.factoryIsReady) {
        return Promise.resolve(entry.factory);
      }

      this.entry = entry = new _aureliaLoader.TemplateRegistryEntry(this.moduleId || this.dependencyBaseUrl);
      entry.template = _aureliaPal.DOM.createTemplateFromMarkup(this.markup);

      if (dependencies !== null) {
        for (var i = 0, ii = dependencies.length; i < ii; ++i) {
          var current = dependencies[i];

          if (typeof current === 'string' || typeof current === 'function') {
            entry.addDependency(current);
          } else {
            entry.addDependency(current.from, current.as);
          }
        }
      }

      compileInstruction.associatedModuleId = this.moduleId;
      return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };

    return InlineViewStrategy;
  }()) || _class9);
  var ViewLocator = exports.ViewLocator = (_temp2 = _class10 = function () {
    function ViewLocator() {
      
    }

    ViewLocator.prototype.getViewStrategy = function getViewStrategy(value) {
      if (!value) {
        return null;
      }

      if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && 'getViewStrategy' in value) {
        var _origin = _aureliaMetadata.Origin.get(value.constructor);

        value = value.getViewStrategy();

        if (typeof value === 'string') {
          value = new RelativeViewStrategy(value);
        }

        viewStrategy.assert(value);

        if (_origin.moduleId) {
          value.makeRelativeTo(_origin.moduleId);
        }

        return value;
      }

      if (typeof value === 'string') {
        value = new RelativeViewStrategy(value);
      }

      if (viewStrategy.validate(value)) {
        return value;
      }

      if (typeof value !== 'function') {
        value = value.constructor;
      }

      var origin = _aureliaMetadata.Origin.get(value);
      var strategy = _aureliaMetadata.metadata.get(ViewLocator.viewStrategyMetadataKey, value);

      if (!strategy) {
        if (!origin.moduleId) {
          throw new Error('Cannot determine default view strategy for object.', value);
        }

        strategy = this.createFallbackViewStrategy(origin);
      } else if (origin.moduleId) {
        strategy.moduleId = origin.moduleId;
      }

      return strategy;
    };

    ViewLocator.prototype.createFallbackViewStrategy = function createFallbackViewStrategy(origin) {
      return new ConventionalViewStrategy(this, origin);
    };

    ViewLocator.prototype.convertOriginToViewUrl = function convertOriginToViewUrl(origin) {
      var moduleId = origin.moduleId;
      var id = moduleId.endsWith('.js') || moduleId.endsWith('.ts') ? moduleId.substring(0, moduleId.length - 3) : moduleId;
      return id + '.html';
    };

    return ViewLocator;
  }(), _class10.viewStrategyMetadataKey = 'aurelia:view-strategy', _temp2);


  function mi(name) {
    throw new Error('BindingLanguage must implement ' + name + '().');
  }

  var BindingLanguage = exports.BindingLanguage = function () {
    function BindingLanguage() {
      
    }

    BindingLanguage.prototype.inspectAttribute = function inspectAttribute(resources, elementName, attrName, attrValue) {
      mi('inspectAttribute');
    };

    BindingLanguage.prototype.createAttributeInstruction = function createAttributeInstruction(resources, element, info, existingInstruction) {
      mi('createAttributeInstruction');
    };

    BindingLanguage.prototype.inspectTextContent = function inspectTextContent(resources, value) {
      mi('inspectTextContent');
    };

    return BindingLanguage;
  }();

  var noNodes = Object.freeze([]);

  var SlotCustomAttribute = exports.SlotCustomAttribute = (_dec6 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element), _dec6(_class11 = function () {
    function SlotCustomAttribute(element) {
      

      this.element = element;
      this.element.auSlotAttribute = this;
    }

    SlotCustomAttribute.prototype.valueChanged = function valueChanged(newValue, oldValue) {};

    return SlotCustomAttribute;
  }()) || _class11);

  var PassThroughSlot = exports.PassThroughSlot = function () {
    function PassThroughSlot(anchor, name, destinationName, fallbackFactory) {
      

      this.anchor = anchor;
      this.anchor.viewSlot = this;
      this.name = name;
      this.destinationName = destinationName;
      this.fallbackFactory = fallbackFactory;
      this.destinationSlot = null;
      this.projections = 0;
      this.contentView = null;

      var attr = new SlotCustomAttribute(this.anchor);
      attr.value = this.destinationName;
    }

    PassThroughSlot.prototype.renderFallbackContent = function renderFallbackContent(view, nodes, projectionSource, index) {
      if (this.contentView === null) {
        this.contentView = this.fallbackFactory.create(this.ownerView.container);
        this.contentView.bind(this.ownerView.bindingContext, this.ownerView.overrideContext);

        var slots = Object.create(null);
        slots[this.destinationSlot.name] = this.destinationSlot;

        ShadowDOM.distributeView(this.contentView, slots, projectionSource, index, this.destinationSlot.name);
      }
    };

    PassThroughSlot.prototype.passThroughTo = function passThroughTo(destinationSlot) {
      this.destinationSlot = destinationSlot;
    };

    PassThroughSlot.prototype.addNode = function addNode(view, node, projectionSource, index) {
      if (this.contentView !== null) {
        this.contentView.removeNodes();
        this.contentView.detached();
        this.contentView.unbind();
        this.contentView = null;
      }

      if (node.viewSlot instanceof PassThroughSlot) {
        node.viewSlot.passThroughTo(this);
        return;
      }

      this.projections++;
      this.destinationSlot.addNode(view, node, projectionSource, index);
    };

    PassThroughSlot.prototype.removeView = function removeView(view, projectionSource) {
      this.projections--;
      this.destinationSlot.removeView(view, projectionSource);

      if (this.needsFallbackRendering) {
        this.renderFallbackContent(null, noNodes, projectionSource);
      }
    };

    PassThroughSlot.prototype.removeAll = function removeAll(projectionSource) {
      this.projections = 0;
      this.destinationSlot.removeAll(projectionSource);

      if (this.needsFallbackRendering) {
        this.renderFallbackContent(null, noNodes, projectionSource);
      }
    };

    PassThroughSlot.prototype.projectFrom = function projectFrom(view, projectionSource) {
      this.destinationSlot.projectFrom(view, projectionSource);
    };

    PassThroughSlot.prototype.created = function created(ownerView) {
      this.ownerView = ownerView;
    };

    PassThroughSlot.prototype.bind = function bind(view) {
      if (this.contentView) {
        this.contentView.bind(view.bindingContext, view.overrideContext);
      }
    };

    PassThroughSlot.prototype.attached = function attached() {
      if (this.contentView) {
        this.contentView.attached();
      }
    };

    PassThroughSlot.prototype.detached = function detached() {
      if (this.contentView) {
        this.contentView.detached();
      }
    };

    PassThroughSlot.prototype.unbind = function unbind() {
      if (this.contentView) {
        this.contentView.unbind();
      }
    };

    _createClass(PassThroughSlot, [{
      key: 'needsFallbackRendering',
      get: function get() {
        return this.fallbackFactory && this.projections === 0;
      }
    }]);

    return PassThroughSlot;
  }();

  var ShadowSlot = exports.ShadowSlot = function () {
    function ShadowSlot(anchor, name, fallbackFactory) {
      

      this.anchor = anchor;
      this.anchor.isContentProjectionSource = true;
      this.anchor.viewSlot = this;
      this.name = name;
      this.fallbackFactory = fallbackFactory;
      this.contentView = null;
      this.projections = 0;
      this.children = [];
      this.projectFromAnchors = null;
      this.destinationSlots = null;
    }

    ShadowSlot.prototype.addNode = function addNode(view, node, projectionSource, index, destination) {
      if (this.contentView !== null) {
        this.contentView.removeNodes();
        this.contentView.detached();
        this.contentView.unbind();
        this.contentView = null;
      }

      if (node.viewSlot instanceof PassThroughSlot) {
        node.viewSlot.passThroughTo(this);
        return;
      }

      if (this.destinationSlots !== null) {
        ShadowDOM.distributeNodes(view, [node], this.destinationSlots, this, index);
      } else {
        node.auOwnerView = view;
        node.auProjectionSource = projectionSource;
        node.auAssignedSlot = this;

        var anchor = this._findAnchor(view, node, projectionSource, index);
        var parent = anchor.parentNode;

        parent.insertBefore(node, anchor);
        this.children.push(node);
        this.projections++;
      }
    };

    ShadowSlot.prototype.removeView = function removeView(view, projectionSource) {
      if (this.destinationSlots !== null) {
        ShadowDOM.undistributeView(view, this.destinationSlots, this);
      } else if (this.contentView && this.contentView.hasSlots) {
        ShadowDOM.undistributeView(view, this.contentView.slots, projectionSource);
      } else {
        var found = this.children.find(function (x) {
          return x.auSlotProjectFrom === projectionSource;
        });
        if (found) {
          var _children = found.auProjectionChildren;

          for (var i = 0, ii = _children.length; i < ii; ++i) {
            var _child = _children[i];

            if (_child.auOwnerView === view) {
              _children.splice(i, 1);
              view.fragment.appendChild(_child);
              i--;ii--;
              this.projections--;
            }
          }

          if (this.needsFallbackRendering) {
            this.renderFallbackContent(view, noNodes, projectionSource);
          }
        }
      }
    };

    ShadowSlot.prototype.removeAll = function removeAll(projectionSource) {
      if (this.destinationSlots !== null) {
        ShadowDOM.undistributeAll(this.destinationSlots, this);
      } else if (this.contentView && this.contentView.hasSlots) {
        ShadowDOM.undistributeAll(this.contentView.slots, projectionSource);
      } else {
        var found = this.children.find(function (x) {
          return x.auSlotProjectFrom === projectionSource;
        });

        if (found) {
          var _children2 = found.auProjectionChildren;
          for (var i = 0, ii = _children2.length; i < ii; ++i) {
            var _child2 = _children2[i];
            _child2.auOwnerView.fragment.appendChild(_child2);
            this.projections--;
          }

          found.auProjectionChildren = [];

          if (this.needsFallbackRendering) {
            this.renderFallbackContent(null, noNodes, projectionSource);
          }
        }
      }
    };

    ShadowSlot.prototype._findAnchor = function _findAnchor(view, node, projectionSource, index) {
      if (projectionSource) {
        var found = this.children.find(function (x) {
          return x.auSlotProjectFrom === projectionSource;
        });
        if (found) {
          if (index !== undefined) {
            var _children3 = found.auProjectionChildren;
            var viewIndex = -1;
            var lastView = void 0;

            for (var i = 0, ii = _children3.length; i < ii; ++i) {
              var current = _children3[i];

              if (current.auOwnerView !== lastView) {
                viewIndex++;
                lastView = current.auOwnerView;

                if (viewIndex >= index && lastView !== view) {
                  _children3.splice(i, 0, node);
                  return current;
                }
              }
            }
          }

          found.auProjectionChildren.push(node);
          return found;
        }
      }

      return this.anchor;
    };

    ShadowSlot.prototype.projectTo = function projectTo(slots) {
      this.destinationSlots = slots;
    };

    ShadowSlot.prototype.projectFrom = function projectFrom(view, projectionSource) {
      var anchor = _aureliaPal.DOM.createComment('anchor');
      var parent = this.anchor.parentNode;
      anchor.auSlotProjectFrom = projectionSource;
      anchor.auOwnerView = view;
      anchor.auProjectionChildren = [];
      parent.insertBefore(anchor, this.anchor);
      this.children.push(anchor);

      if (this.projectFromAnchors === null) {
        this.projectFromAnchors = [];
      }

      this.projectFromAnchors.push(anchor);
    };

    ShadowSlot.prototype.renderFallbackContent = function renderFallbackContent(view, nodes, projectionSource, index) {
      if (this.contentView === null) {
        this.contentView = this.fallbackFactory.create(this.ownerView.container);
        this.contentView.bind(this.ownerView.bindingContext, this.ownerView.overrideContext);
        this.contentView.insertNodesBefore(this.anchor);
      }

      if (this.contentView.hasSlots) {
        var slots = this.contentView.slots;
        var projectFromAnchors = this.projectFromAnchors;

        if (projectFromAnchors !== null) {
          for (var slotName in slots) {
            var slot = slots[slotName];

            for (var i = 0, ii = projectFromAnchors.length; i < ii; ++i) {
              var anchor = projectFromAnchors[i];
              slot.projectFrom(anchor.auOwnerView, anchor.auSlotProjectFrom);
            }
          }
        }

        this.fallbackSlots = slots;
        ShadowDOM.distributeNodes(view, nodes, slots, projectionSource, index);
      }
    };

    ShadowSlot.prototype.created = function created(ownerView) {
      this.ownerView = ownerView;
    };

    ShadowSlot.prototype.bind = function bind(view) {
      if (this.contentView) {
        this.contentView.bind(view.bindingContext, view.overrideContext);
      }
    };

    ShadowSlot.prototype.attached = function attached() {
      if (this.contentView) {
        this.contentView.attached();
      }
    };

    ShadowSlot.prototype.detached = function detached() {
      if (this.contentView) {
        this.contentView.detached();
      }
    };

    ShadowSlot.prototype.unbind = function unbind() {
      if (this.contentView) {
        this.contentView.unbind();
      }
    };

    _createClass(ShadowSlot, [{
      key: 'needsFallbackRendering',
      get: function get() {
        return this.fallbackFactory && this.projections === 0;
      }
    }]);

    return ShadowSlot;
  }();

  var ShadowDOM = exports.ShadowDOM = (_temp3 = _class12 = function () {
    function ShadowDOM() {
      
    }

    ShadowDOM.getSlotName = function getSlotName(node) {
      if (node.auSlotAttribute === undefined) {
        return ShadowDOM.defaultSlotKey;
      }

      return node.auSlotAttribute.value;
    };

    ShadowDOM.distributeView = function distributeView(view, slots, projectionSource, index, destinationOverride) {
      var nodes = void 0;

      if (view === null) {
        nodes = noNodes;
      } else {
        var childNodes = view.fragment.childNodes;
        var ii = childNodes.length;
        nodes = new Array(ii);

        for (var i = 0; i < ii; ++i) {
          nodes[i] = childNodes[i];
        }
      }

      ShadowDOM.distributeNodes(view, nodes, slots, projectionSource, index, destinationOverride);
    };

    ShadowDOM.undistributeView = function undistributeView(view, slots, projectionSource) {
      for (var slotName in slots) {
        slots[slotName].removeView(view, projectionSource);
      }
    };

    ShadowDOM.undistributeAll = function undistributeAll(slots, projectionSource) {
      for (var slotName in slots) {
        slots[slotName].removeAll(projectionSource);
      }
    };

    ShadowDOM.distributeNodes = function distributeNodes(view, nodes, slots, projectionSource, index, destinationOverride) {
      for (var i = 0, ii = nodes.length; i < ii; ++i) {
        var currentNode = nodes[i];
        var nodeType = currentNode.nodeType;

        if (currentNode.isContentProjectionSource) {
          currentNode.viewSlot.projectTo(slots);

          for (var slotName in slots) {
            slots[slotName].projectFrom(view, currentNode.viewSlot);
          }

          nodes.splice(i, 1);
          ii--;i--;
        } else if (nodeType === 1 || nodeType === 3 || currentNode.viewSlot instanceof PassThroughSlot) {
          if (nodeType === 3 && _isAllWhitespace(currentNode)) {
            nodes.splice(i, 1);
            ii--;i--;
          } else {
            var found = slots[destinationOverride || ShadowDOM.getSlotName(currentNode)];

            if (found) {
              found.addNode(view, currentNode, projectionSource, index);
              nodes.splice(i, 1);
              ii--;i--;
            }
          }
        } else {
          nodes.splice(i, 1);
          ii--;i--;
        }
      }

      for (var _slotName in slots) {
        var slot = slots[_slotName];

        if (slot.needsFallbackRendering) {
          slot.renderFallbackContent(view, nodes, projectionSource, index);
        }
      }
    };

    return ShadowDOM;
  }(), _class12.defaultSlotKey = '__au-default-slot-key__', _temp3);


  function register(lookup, name, resource, type) {
    if (!name) {
      return;
    }

    var existing = lookup[name];
    if (existing) {
      if (existing !== resource) {
        throw new Error('Attempted to register ' + type + ' when one with the same name already exists. Name: ' + name + '.');
      }

      return;
    }

    lookup[name] = resource;
  }

  var ViewResources = exports.ViewResources = function () {
    function ViewResources(parent, viewUrl) {
      

      this.bindingLanguage = null;

      this.parent = parent || null;
      this.hasParent = this.parent !== null;
      this.viewUrl = viewUrl || '';
      this.lookupFunctions = {
        valueConverters: this.getValueConverter.bind(this),
        bindingBehaviors: this.getBindingBehavior.bind(this)
      };
      this.attributes = Object.create(null);
      this.elements = Object.create(null);
      this.valueConverters = Object.create(null);
      this.bindingBehaviors = Object.create(null);
      this.attributeMap = Object.create(null);
      this.values = Object.create(null);
      this.beforeCompile = this.afterCompile = this.beforeCreate = this.afterCreate = this.beforeBind = this.beforeUnbind = false;
    }

    ViewResources.prototype._tryAddHook = function _tryAddHook(obj, name) {
      if (typeof obj[name] === 'function') {
        var func = obj[name].bind(obj);
        var counter = 1;
        var callbackName = void 0;

        while (this[callbackName = name + counter.toString()] !== undefined) {
          counter++;
        }

        this[name] = true;
        this[callbackName] = func;
      }
    };

    ViewResources.prototype._invokeHook = function _invokeHook(name, one, two, three, four) {
      if (this.hasParent) {
        this.parent._invokeHook(name, one, two, three, four);
      }

      if (this[name]) {
        this[name + '1'](one, two, three, four);

        var callbackName = name + '2';
        if (this[callbackName]) {
          this[callbackName](one, two, three, four);

          callbackName = name + '3';
          if (this[callbackName]) {
            this[callbackName](one, two, three, four);

            var counter = 4;

            while (this[callbackName = name + counter.toString()] !== undefined) {
              this[callbackName](one, two, three, four);
              counter++;
            }
          }
        }
      }
    };

    ViewResources.prototype.registerViewEngineHooks = function registerViewEngineHooks(hooks) {
      this._tryAddHook(hooks, 'beforeCompile');
      this._tryAddHook(hooks, 'afterCompile');
      this._tryAddHook(hooks, 'beforeCreate');
      this._tryAddHook(hooks, 'afterCreate');
      this._tryAddHook(hooks, 'beforeBind');
      this._tryAddHook(hooks, 'beforeUnbind');
    };

    ViewResources.prototype.getBindingLanguage = function getBindingLanguage(bindingLanguageFallback) {
      return this.bindingLanguage || (this.bindingLanguage = bindingLanguageFallback);
    };

    ViewResources.prototype.patchInParent = function patchInParent(newParent) {
      var originalParent = this.parent;

      this.parent = newParent || null;
      this.hasParent = this.parent !== null;

      if (newParent.parent === null) {
        newParent.parent = originalParent;
        newParent.hasParent = originalParent !== null;
      }
    };

    ViewResources.prototype.relativeToView = function relativeToView(path) {
      return (0, _aureliaPath.relativeToFile)(path, this.viewUrl);
    };

    ViewResources.prototype.registerElement = function registerElement(tagName, behavior) {
      register(this.elements, tagName, behavior, 'an Element');
    };

    ViewResources.prototype.getElement = function getElement(tagName) {
      return this.elements[tagName] || (this.hasParent ? this.parent.getElement(tagName) : null);
    };

    ViewResources.prototype.mapAttribute = function mapAttribute(attribute) {
      return this.attributeMap[attribute] || (this.hasParent ? this.parent.mapAttribute(attribute) : null);
    };

    ViewResources.prototype.registerAttribute = function registerAttribute(attribute, behavior, knownAttribute) {
      this.attributeMap[attribute] = knownAttribute;
      register(this.attributes, attribute, behavior, 'an Attribute');
    };

    ViewResources.prototype.getAttribute = function getAttribute(attribute) {
      return this.attributes[attribute] || (this.hasParent ? this.parent.getAttribute(attribute) : null);
    };

    ViewResources.prototype.registerValueConverter = function registerValueConverter(name, valueConverter) {
      register(this.valueConverters, name, valueConverter, 'a ValueConverter');
    };

    ViewResources.prototype.getValueConverter = function getValueConverter(name) {
      return this.valueConverters[name] || (this.hasParent ? this.parent.getValueConverter(name) : null);
    };

    ViewResources.prototype.registerBindingBehavior = function registerBindingBehavior(name, bindingBehavior) {
      register(this.bindingBehaviors, name, bindingBehavior, 'a BindingBehavior');
    };

    ViewResources.prototype.getBindingBehavior = function getBindingBehavior(name) {
      return this.bindingBehaviors[name] || (this.hasParent ? this.parent.getBindingBehavior(name) : null);
    };

    ViewResources.prototype.registerValue = function registerValue(name, value) {
      register(this.values, name, value, 'a value');
    };

    ViewResources.prototype.getValue = function getValue(name) {
      return this.values[name] || (this.hasParent ? this.parent.getValue(name) : null);
    };

    return ViewResources;
  }();

  var View = exports.View = function () {
    function View(container, viewFactory, fragment, controllers, bindings, children, slots) {
      

      this.container = container;
      this.viewFactory = viewFactory;
      this.resources = viewFactory.resources;
      this.fragment = fragment;
      this.firstChild = fragment.firstChild;
      this.lastChild = fragment.lastChild;
      this.controllers = controllers;
      this.bindings = bindings;
      this.children = children;
      this.slots = slots;
      this.hasSlots = false;
      this.fromCache = false;
      this.isBound = false;
      this.isAttached = false;
      this.bindingContext = null;
      this.overrideContext = null;
      this.controller = null;
      this.viewModelScope = null;
      this.animatableElement = undefined;
      this._isUserControlled = false;
      this.contentView = null;

      for (var key in slots) {
        this.hasSlots = true;
        break;
      }
    }

    View.prototype.returnToCache = function returnToCache() {
      this.viewFactory.returnViewToCache(this);
    };

    View.prototype.created = function created() {
      var i = void 0;
      var ii = void 0;
      var controllers = this.controllers;

      for (i = 0, ii = controllers.length; i < ii; ++i) {
        controllers[i].created(this);
      }
    };

    View.prototype.bind = function bind(bindingContext, overrideContext, _systemUpdate) {
      var controllers = void 0;
      var bindings = void 0;
      var children = void 0;
      var i = void 0;
      var ii = void 0;

      if (_systemUpdate && this._isUserControlled) {
        return;
      }

      if (this.isBound) {
        if (this.bindingContext === bindingContext) {
          return;
        }

        this.unbind();
      }

      this.isBound = true;
      this.bindingContext = bindingContext;
      this.overrideContext = overrideContext || (0, _aureliaBinding.createOverrideContext)(bindingContext);

      this.resources._invokeHook('beforeBind', this);

      bindings = this.bindings;
      for (i = 0, ii = bindings.length; i < ii; ++i) {
        bindings[i].bind(this);
      }

      if (this.viewModelScope !== null) {
        bindingContext.bind(this.viewModelScope.bindingContext, this.viewModelScope.overrideContext);
        this.viewModelScope = null;
      }

      controllers = this.controllers;
      for (i = 0, ii = controllers.length; i < ii; ++i) {
        controllers[i].bind(this);
      }

      children = this.children;
      for (i = 0, ii = children.length; i < ii; ++i) {
        children[i].bind(bindingContext, overrideContext, true);
      }

      if (this.hasSlots) {
        ShadowDOM.distributeView(this.contentView, this.slots);
      }
    };

    View.prototype.addBinding = function addBinding(binding) {
      this.bindings.push(binding);

      if (this.isBound) {
        binding.bind(this);
      }
    };

    View.prototype.unbind = function unbind() {
      var controllers = void 0;
      var bindings = void 0;
      var children = void 0;
      var i = void 0;
      var ii = void 0;

      if (this.isBound) {
        this.isBound = false;
        this.resources._invokeHook('beforeUnbind', this);

        if (this.controller !== null) {
          this.controller.unbind();
        }

        bindings = this.bindings;
        for (i = 0, ii = bindings.length; i < ii; ++i) {
          bindings[i].unbind();
        }

        controllers = this.controllers;
        for (i = 0, ii = controllers.length; i < ii; ++i) {
          controllers[i].unbind();
        }

        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
          children[i].unbind();
        }

        this.bindingContext = null;
        this.overrideContext = null;
      }
    };

    View.prototype.insertNodesBefore = function insertNodesBefore(refNode) {
      refNode.parentNode.insertBefore(this.fragment, refNode);
    };

    View.prototype.appendNodesTo = function appendNodesTo(parent) {
      parent.appendChild(this.fragment);
    };

    View.prototype.removeNodes = function removeNodes() {
      var fragment = this.fragment;
      var current = this.firstChild;
      var end = this.lastChild;
      var next = void 0;

      while (current) {
        next = current.nextSibling;
        fragment.appendChild(current);

        if (current === end) {
          break;
        }

        current = next;
      }
    };

    View.prototype.attached = function attached() {
      var controllers = void 0;
      var children = void 0;
      var i = void 0;
      var ii = void 0;

      if (this.isAttached) {
        return;
      }

      this.isAttached = true;

      if (this.controller !== null) {
        this.controller.attached();
      }

      controllers = this.controllers;
      for (i = 0, ii = controllers.length; i < ii; ++i) {
        controllers[i].attached();
      }

      children = this.children;
      for (i = 0, ii = children.length; i < ii; ++i) {
        children[i].attached();
      }
    };

    View.prototype.detached = function detached() {
      var controllers = void 0;
      var children = void 0;
      var i = void 0;
      var ii = void 0;

      if (this.isAttached) {
        this.isAttached = false;

        if (this.controller !== null) {
          this.controller.detached();
        }

        controllers = this.controllers;
        for (i = 0, ii = controllers.length; i < ii; ++i) {
          controllers[i].detached();
        }

        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
          children[i].detached();
        }
      }
    };

    return View;
  }();

  function getAnimatableElement(view) {
    if (view.animatableElement !== undefined) {
      return view.animatableElement;
    }

    var current = view.firstChild;

    while (current && current.nodeType !== 1) {
      current = current.nextSibling;
    }

    if (current && current.nodeType === 1) {
      return view.animatableElement = current.classList.contains('au-animate') ? current : null;
    }

    return view.animatableElement = null;
  }

  var ViewSlot = exports.ViewSlot = function () {
    function ViewSlot(anchor, anchorIsContainer) {
      var animator = arguments.length <= 2 || arguments[2] === undefined ? Animator.instance : arguments[2];

      

      this.anchor = anchor;
      this.anchorIsContainer = anchorIsContainer;
      this.bindingContext = null;
      this.overrideContext = null;
      this.animator = animator;
      this.children = [];
      this.isBound = false;
      this.isAttached = false;
      this.contentSelectors = null;
      anchor.viewSlot = this;
      anchor.isContentProjectionSource = false;
    }

    ViewSlot.prototype.animateView = function animateView(view) {
      var direction = arguments.length <= 1 || arguments[1] === undefined ? 'enter' : arguments[1];

      var animatableElement = getAnimatableElement(view);

      if (animatableElement !== null) {
        switch (direction) {
          case 'enter':
            return this.animator.enter(animatableElement);
          case 'leave':
            return this.animator.leave(animatableElement);
          default:
            throw new Error('Invalid animation direction: ' + direction);
        }
      }
    };

    ViewSlot.prototype.transformChildNodesIntoView = function transformChildNodesIntoView() {
      var parent = this.anchor;

      this.children.push({
        fragment: parent,
        firstChild: parent.firstChild,
        lastChild: parent.lastChild,
        returnToCache: function returnToCache() {},
        removeNodes: function removeNodes() {
          var last = void 0;

          while (last = parent.lastChild) {
            parent.removeChild(last);
          }
        },
        created: function created() {},
        bind: function bind() {},
        unbind: function unbind() {},
        attached: function attached() {},
        detached: function detached() {}
      });
    };

    ViewSlot.prototype.bind = function bind(bindingContext, overrideContext) {
      var i = void 0;
      var ii = void 0;
      var children = void 0;

      if (this.isBound) {
        if (this.bindingContext === bindingContext) {
          return;
        }

        this.unbind();
      }

      this.isBound = true;
      this.bindingContext = bindingContext = bindingContext || this.bindingContext;
      this.overrideContext = overrideContext = overrideContext || this.overrideContext;

      children = this.children;
      for (i = 0, ii = children.length; i < ii; ++i) {
        children[i].bind(bindingContext, overrideContext, true);
      }
    };

    ViewSlot.prototype.unbind = function unbind() {
      if (this.isBound) {
        var i = void 0;
        var ii = void 0;
        var _children4 = this.children;

        this.isBound = false;
        this.bindingContext = null;
        this.overrideContext = null;

        for (i = 0, ii = _children4.length; i < ii; ++i) {
          _children4[i].unbind();
        }
      }
    };

    ViewSlot.prototype.add = function add(view) {
      if (this.anchorIsContainer) {
        view.appendNodesTo(this.anchor);
      } else {
        view.insertNodesBefore(this.anchor);
      }

      this.children.push(view);

      if (this.isAttached) {
        view.attached();
        return this.animateView(view, 'enter');
      }
    };

    ViewSlot.prototype.insert = function insert(index, view) {
      var children = this.children;
      var length = children.length;

      if (index === 0 && length === 0 || index >= length) {
        return this.add(view);
      }

      view.insertNodesBefore(children[index].firstChild);
      children.splice(index, 0, view);

      if (this.isAttached) {
        view.attached();
        return this.animateView(view, 'enter');
      }
    };

    ViewSlot.prototype.move = function move(sourceIndex, targetIndex) {
      if (sourceIndex === targetIndex) {
        return;
      }

      var children = this.children;
      var view = children[sourceIndex];

      view.removeNodes();
      view.insertNodesBefore(children[targetIndex].firstChild);
      children.splice(sourceIndex, 1);
      children.splice(targetIndex, 0, view);
    };

    ViewSlot.prototype.remove = function remove(view, returnToCache, skipAnimation) {
      return this.removeAt(this.children.indexOf(view), returnToCache, skipAnimation);
    };

    ViewSlot.prototype.removeMany = function removeMany(viewsToRemove, returnToCache, skipAnimation) {
      var _this4 = this;

      var children = this.children;
      var ii = viewsToRemove.length;
      var i = void 0;
      var rmPromises = [];

      viewsToRemove.forEach(function (child) {
        if (skipAnimation) {
          child.removeNodes();
          return;
        }

        var animation = _this4.animateView(child, 'leave');
        if (animation) {
          rmPromises.push(animation.then(function () {
            return child.removeNodes();
          }));
        } else {
          child.removeNodes();
        }
      });

      var removeAction = function removeAction() {
        if (_this4.isAttached) {
          for (i = 0; i < ii; ++i) {
            viewsToRemove[i].detached();
          }
        }

        if (returnToCache) {
          for (i = 0; i < ii; ++i) {
            viewsToRemove[i].returnToCache();
          }
        }

        for (i = 0; i < ii; ++i) {
          var index = children.indexOf(viewsToRemove[i]);
          if (index >= 0) {
            children.splice(index, 1);
          }
        }
      };

      if (rmPromises.length > 0) {
        return Promise.all(rmPromises).then(function () {
          return removeAction();
        });
      }

      return removeAction();
    };

    ViewSlot.prototype.removeAt = function removeAt(index, returnToCache, skipAnimation) {
      var _this5 = this;

      var view = this.children[index];

      var removeAction = function removeAction() {
        index = _this5.children.indexOf(view);
        view.removeNodes();
        _this5.children.splice(index, 1);

        if (_this5.isAttached) {
          view.detached();
        }

        if (returnToCache) {
          view.returnToCache();
        }

        return view;
      };

      if (!skipAnimation) {
        var animation = this.animateView(view, 'leave');
        if (animation) {
          return animation.then(function () {
            return removeAction();
          });
        }
      }

      return removeAction();
    };

    ViewSlot.prototype.removeAll = function removeAll(returnToCache, skipAnimation) {
      var _this6 = this;

      var children = this.children;
      var ii = children.length;
      var i = void 0;
      var rmPromises = [];

      children.forEach(function (child) {
        if (skipAnimation) {
          child.removeNodes();
          return;
        }

        var animation = _this6.animateView(child, 'leave');
        if (animation) {
          rmPromises.push(animation.then(function () {
            return child.removeNodes();
          }));
        } else {
          child.removeNodes();
        }
      });

      var removeAction = function removeAction() {
        if (_this6.isAttached) {
          for (i = 0; i < ii; ++i) {
            children[i].detached();
          }
        }

        if (returnToCache) {
          for (i = 0; i < ii; ++i) {
            children[i].returnToCache();
          }
        }

        _this6.children = [];
      };

      if (rmPromises.length > 0) {
        return Promise.all(rmPromises).then(function () {
          return removeAction();
        });
      }

      return removeAction();
    };

    ViewSlot.prototype.attached = function attached() {
      var i = void 0;
      var ii = void 0;
      var children = void 0;
      var child = void 0;

      if (this.isAttached) {
        return;
      }

      this.isAttached = true;

      children = this.children;
      for (i = 0, ii = children.length; i < ii; ++i) {
        child = children[i];
        child.attached();
        this.animateView(child, 'enter');
      }
    };

    ViewSlot.prototype.detached = function detached() {
      var i = void 0;
      var ii = void 0;
      var children = void 0;

      if (this.isAttached) {
        this.isAttached = false;
        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
          children[i].detached();
        }
      }
    };

    ViewSlot.prototype.projectTo = function projectTo(slots) {
      var _this7 = this;

      this.projectToSlots = slots;
      this.add = this._projectionAdd;
      this.insert = this._projectionInsert;
      this.move = this._projectionMove;
      this.remove = this._projectionRemove;
      this.removeAt = this._projectionRemoveAt;
      this.removeMany = this._projectionRemoveMany;
      this.removeAll = this._projectionRemoveAll;
      this.children.forEach(function (view) {
        return ShadowDOM.distributeView(view, slots, _this7);
      });
    };

    ViewSlot.prototype._projectionAdd = function _projectionAdd(view) {
      ShadowDOM.distributeView(view, this.projectToSlots, this);

      this.children.push(view);

      if (this.isAttached) {
        view.attached();
      }
    };

    ViewSlot.prototype._projectionInsert = function _projectionInsert(index, view) {
      if (index === 0 && !this.children.length || index >= this.children.length) {
        this.add(view);
      } else {
        ShadowDOM.distributeView(view, this.projectToSlots, this, index);

        this.children.splice(index, 0, view);

        if (this.isAttached) {
          view.attached();
        }
      }
    };

    ViewSlot.prototype._projectionMove = function _projectionMove(sourceIndex, targetIndex) {
      if (sourceIndex === targetIndex) {
        return;
      }

      var children = this.children;
      var view = children[sourceIndex];

      ShadowDOM.undistributeView(view, this.projectToSlots, this);
      ShadowDOM.distributeView(view, this.projectToSlots, this, targetIndex);

      children.splice(sourceIndex, 1);
      children.splice(targetIndex, 0, view);
    };

    ViewSlot.prototype._projectionRemove = function _projectionRemove(view, returnToCache) {
      ShadowDOM.undistributeView(view, this.projectToSlots, this);
      this.children.splice(this.children.indexOf(view), 1);

      if (this.isAttached) {
        view.detached();
      }
    };

    ViewSlot.prototype._projectionRemoveAt = function _projectionRemoveAt(index, returnToCache) {
      var view = this.children[index];

      ShadowDOM.undistributeView(view, this.projectToSlots, this);
      this.children.splice(index, 1);

      if (this.isAttached) {
        view.detached();
      }
    };

    ViewSlot.prototype._projectionRemoveMany = function _projectionRemoveMany(viewsToRemove, returnToCache) {
      var _this8 = this;

      viewsToRemove.forEach(function (view) {
        return _this8.remove(view, returnToCache);
      });
    };

    ViewSlot.prototype._projectionRemoveAll = function _projectionRemoveAll(returnToCache) {
      ShadowDOM.undistributeAll(this.projectToSlots, this);

      var children = this.children;

      if (this.isAttached) {
        for (var i = 0, ii = children.length; i < ii; ++i) {
          children[i].detached();
        }
      }

      this.children = [];
    };

    return ViewSlot;
  }();

  var ProviderResolver = (0, _aureliaDependencyInjection.resolver)(_class15 = function () {
    function ProviderResolver() {
      
    }

    ProviderResolver.prototype.get = function get(container, key) {
      var id = key.__providerId__;
      return id in container ? container[id] : container[id] = container.invoke(key);
    };

    return ProviderResolver;
  }()) || _class15;

  var providerResolverInstance = new ProviderResolver();

  function elementContainerGet(key) {
    if (key === _aureliaPal.DOM.Element) {
      return this.element;
    }

    if (key === BoundViewFactory) {
      if (this.boundViewFactory) {
        return this.boundViewFactory;
      }

      var factory = this.instruction.viewFactory;
      var _partReplacements = this.partReplacements;

      if (_partReplacements) {
        factory = _partReplacements[factory.part] || factory;
      }

      this.boundViewFactory = new BoundViewFactory(this, factory, _partReplacements);
      return this.boundViewFactory;
    }

    if (key === ViewSlot) {
      if (this.viewSlot === undefined) {
        this.viewSlot = new ViewSlot(this.element, this.instruction.anchorIsContainer);
        this.element.isContentProjectionSource = this.instruction.lifting;
        this.children.push(this.viewSlot);
      }

      return this.viewSlot;
    }

    if (key === ElementEvents) {
      return this.elementEvents || (this.elementEvents = new ElementEvents(this.element));
    }

    if (key === CompositionTransaction) {
      return this.compositionTransaction || (this.compositionTransaction = this.parent.get(key));
    }

    if (key === ViewResources) {
      return this.viewResources;
    }

    if (key === TargetInstruction) {
      return this.instruction;
    }

    return this.superGet(key);
  }

  function createElementContainer(parent, element, instruction, children, partReplacements, resources) {
    var container = parent.createChild();
    var providers = void 0;
    var i = void 0;

    container.element = element;
    container.instruction = instruction;
    container.children = children;
    container.viewResources = resources;
    container.partReplacements = partReplacements;

    providers = instruction.providers;
    i = providers.length;

    while (i--) {
      container._resolvers.set(providers[i], providerResolverInstance);
    }

    container.superGet = container.get;
    container.get = elementContainerGet;

    return container;
  }

  function makeElementIntoAnchor(element, elementInstruction) {
    var anchor = _aureliaPal.DOM.createComment('anchor');

    if (elementInstruction) {
      var firstChild = element.firstChild;

      if (firstChild && firstChild.tagName === 'AU-CONTENT') {
        anchor.contentElement = firstChild;
      }

      anchor.hasAttribute = function (name) {
        return element.hasAttribute(name);
      };
      anchor.getAttribute = function (name) {
        return element.getAttribute(name);
      };
      anchor.setAttribute = function (name, value) {
        element.setAttribute(name, value);
      };
    }

    _aureliaPal.DOM.replaceNode(anchor, element);

    return anchor;
  }

  function applyInstructions(containers, element, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources) {
    var behaviorInstructions = instruction.behaviorInstructions;
    var expressions = instruction.expressions;
    var elementContainer = void 0;
    var i = void 0;
    var ii = void 0;
    var current = void 0;
    var instance = void 0;

    if (instruction.contentExpression) {
      bindings.push(instruction.contentExpression.createBinding(element.nextSibling));
      element.nextSibling.auInterpolationTarget = true;
      element.parentNode.removeChild(element);
      return;
    }

    if (instruction.shadowSlot) {
      var commentAnchor = _aureliaPal.DOM.createComment('slot');
      var slot = void 0;

      if (instruction.slotDestination) {
        slot = new PassThroughSlot(commentAnchor, instruction.slotName, instruction.slotDestination, instruction.slotFallbackFactory);
      } else {
        slot = new ShadowSlot(commentAnchor, instruction.slotName, instruction.slotFallbackFactory);
      }

      _aureliaPal.DOM.replaceNode(commentAnchor, element);
      shadowSlots[instruction.slotName] = slot;
      controllers.push(slot);
      return;
    }

    if (behaviorInstructions.length) {
      if (!instruction.anchorIsContainer) {
        element = makeElementIntoAnchor(element, instruction.elementInstruction);
      }

      containers[instruction.injectorId] = elementContainer = createElementContainer(containers[instruction.parentInjectorId], element, instruction, children, partReplacements, resources);

      for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
        current = behaviorInstructions[i];
        instance = current.type.create(elementContainer, current, element, bindings);
        controllers.push(instance);
      }
    }

    for (i = 0, ii = expressions.length; i < ii; ++i) {
      bindings.push(expressions[i].createBinding(element));
    }
  }

  function styleStringToObject(style, target) {
    var attributes = style.split(';');
    var firstIndexOfColon = void 0;
    var i = void 0;
    var current = void 0;
    var key = void 0;
    var value = void 0;

    target = target || {};

    for (i = 0; i < attributes.length; i++) {
      current = attributes[i];
      firstIndexOfColon = current.indexOf(':');
      key = current.substring(0, firstIndexOfColon).trim();
      value = current.substring(firstIndexOfColon + 1).trim();
      target[key] = value;
    }

    return target;
  }

  function styleObjectToString(obj) {
    var result = '';

    for (var key in obj) {
      result += key + ':' + obj[key] + ';';
    }

    return result;
  }

  function applySurrogateInstruction(container, element, instruction, controllers, bindings, children) {
    var behaviorInstructions = instruction.behaviorInstructions;
    var expressions = instruction.expressions;
    var providers = instruction.providers;
    var values = instruction.values;
    var i = void 0;
    var ii = void 0;
    var current = void 0;
    var instance = void 0;
    var currentAttributeValue = void 0;

    i = providers.length;
    while (i--) {
      container._resolvers.set(providers[i], providerResolverInstance);
    }

    for (var key in values) {
      currentAttributeValue = element.getAttribute(key);

      if (currentAttributeValue) {
        if (key === 'class') {
          element.setAttribute('class', currentAttributeValue + ' ' + values[key]);
        } else if (key === 'style') {
          var styleObject = styleStringToObject(values[key]);
          styleStringToObject(currentAttributeValue, styleObject);
          element.setAttribute('style', styleObjectToString(styleObject));
        }
      } else {
          element.setAttribute(key, values[key]);
        }
    }

    if (behaviorInstructions.length) {
      for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
        current = behaviorInstructions[i];
        instance = current.type.create(container, current, element, bindings);

        if (instance.contentView) {
          children.push(instance.contentView);
        }

        controllers.push(instance);
      }
    }

    for (i = 0, ii = expressions.length; i < ii; ++i) {
      bindings.push(expressions[i].createBinding(element));
    }
  }

  var BoundViewFactory = exports.BoundViewFactory = function () {
    function BoundViewFactory(parentContainer, viewFactory, partReplacements) {
      

      this.parentContainer = parentContainer;
      this.viewFactory = viewFactory;
      this.factoryCreateInstruction = { partReplacements: partReplacements };
    }

    BoundViewFactory.prototype.create = function create() {
      var view = this.viewFactory.create(this.parentContainer.createChild(), this.factoryCreateInstruction);
      view._isUserControlled = true;
      return view;
    };

    BoundViewFactory.prototype.setCacheSize = function setCacheSize(size, doNotOverrideIfAlreadySet) {
      this.viewFactory.setCacheSize(size, doNotOverrideIfAlreadySet);
    };

    BoundViewFactory.prototype.getCachedView = function getCachedView() {
      return this.viewFactory.getCachedView();
    };

    BoundViewFactory.prototype.returnViewToCache = function returnViewToCache(view) {
      this.viewFactory.returnViewToCache(view);
    };

    _createClass(BoundViewFactory, [{
      key: 'isCaching',
      get: function get() {
        return this.viewFactory.isCaching;
      }
    }]);

    return BoundViewFactory;
  }();

  var ViewFactory = exports.ViewFactory = function () {
    function ViewFactory(template, instructions, resources) {
      

      this.isCaching = false;

      this.template = template;
      this.instructions = instructions;
      this.resources = resources;
      this.cacheSize = -1;
      this.cache = null;
    }

    ViewFactory.prototype.setCacheSize = function setCacheSize(size, doNotOverrideIfAlreadySet) {
      if (size) {
        if (size === '*') {
          size = Number.MAX_VALUE;
        } else if (typeof size === 'string') {
          size = parseInt(size, 10);
        }
      }

      if (this.cacheSize === -1 || !doNotOverrideIfAlreadySet) {
        this.cacheSize = size;
      }

      if (this.cacheSize > 0) {
        this.cache = [];
      } else {
        this.cache = null;
      }

      this.isCaching = this.cacheSize > 0;
    };

    ViewFactory.prototype.getCachedView = function getCachedView() {
      return this.cache !== null ? this.cache.pop() || null : null;
    };

    ViewFactory.prototype.returnViewToCache = function returnViewToCache(view) {
      if (view.isAttached) {
        view.detached();
      }

      if (view.isBound) {
        view.unbind();
      }

      if (this.cache !== null && this.cache.length < this.cacheSize) {
        view.fromCache = true;
        this.cache.push(view);
      }
    };

    ViewFactory.prototype.create = function create(container, createInstruction, element) {
      createInstruction = createInstruction || BehaviorInstruction.normal;

      var cachedView = this.getCachedView();
      if (cachedView !== null) {
        return cachedView;
      }

      var fragment = createInstruction.enhance ? this.template : this.template.cloneNode(true);
      var instructables = fragment.querySelectorAll('.au-target');
      var instructions = this.instructions;
      var resources = this.resources;
      var controllers = [];
      var bindings = [];
      var children = [];
      var shadowSlots = Object.create(null);
      var containers = { root: container };
      var partReplacements = createInstruction.partReplacements;
      var i = void 0;
      var ii = void 0;
      var view = void 0;
      var instructable = void 0;
      var instruction = void 0;

      this.resources._invokeHook('beforeCreate', this, container, fragment, createInstruction);

      if (element && this.surrogateInstruction !== null) {
        applySurrogateInstruction(container, element, this.surrogateInstruction, controllers, bindings, children);
      }

      if (createInstruction.enhance && fragment.hasAttribute('au-target-id')) {
        instructable = fragment;
        instruction = instructions[instructable.getAttribute('au-target-id')];
        applyInstructions(containers, instructable, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources);
      }

      for (i = 0, ii = instructables.length; i < ii; ++i) {
        instructable = instructables[i];
        instruction = instructions[instructable.getAttribute('au-target-id')];
        applyInstructions(containers, instructable, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources);
      }

      view = new View(container, this, fragment, controllers, bindings, children, shadowSlots);

      if (!createInstruction.initiatedByBehavior) {
        view.created();
      }

      this.resources._invokeHook('afterCreate', view);

      return view;
    };

    return ViewFactory;
  }();

  var nextInjectorId = 0;
  function getNextInjectorId() {
    return ++nextInjectorId;
  }

  function configureProperties(instruction, resources) {
    var type = instruction.type;
    var attrName = instruction.attrName;
    var attributes = instruction.attributes;
    var property = void 0;
    var key = void 0;
    var value = void 0;

    var knownAttribute = resources.mapAttribute(attrName);
    if (knownAttribute && attrName in attributes && knownAttribute !== attrName) {
      attributes[knownAttribute] = attributes[attrName];
      delete attributes[attrName];
    }

    for (key in attributes) {
      value = attributes[key];

      if (value !== null && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
        property = type.attributes[key];

        if (property !== undefined) {
          value.targetProperty = property.name;
        } else {
          value.targetProperty = key;
        }
      }
    }
  }

  var lastAUTargetID = 0;
  function getNextAUTargetID() {
    return (++lastAUTargetID).toString();
  }

  function makeIntoInstructionTarget(element) {
    var value = element.getAttribute('class');
    var auTargetID = getNextAUTargetID();

    element.setAttribute('class', value ? value += ' au-target' : 'au-target');
    element.setAttribute('au-target-id', auTargetID);

    return auTargetID;
  }

  function makeShadowSlot(compiler, resources, node, instructions, parentInjectorId) {
    var auShadowSlot = _aureliaPal.DOM.createElement('au-shadow-slot');
    _aureliaPal.DOM.replaceNode(auShadowSlot, node);

    var auTargetID = makeIntoInstructionTarget(auShadowSlot);
    var instruction = TargetInstruction.shadowSlot(parentInjectorId);

    instruction.slotName = node.getAttribute('name') || ShadowDOM.defaultSlotKey;
    instruction.slotDestination = node.getAttribute('slot');

    if (node.innerHTML.trim()) {
      var fragment = _aureliaPal.DOM.createDocumentFragment();
      var _child3 = void 0;

      while (_child3 = node.firstChild) {
        fragment.appendChild(_child3);
      }

      instruction.slotFallbackFactory = compiler.compile(fragment, resources);
    }

    instructions[auTargetID] = instruction;

    return auShadowSlot;
  }

  var ViewCompiler = exports.ViewCompiler = (_dec7 = (0, _aureliaDependencyInjection.inject)(BindingLanguage, ViewResources), _dec7(_class17 = function () {
    function ViewCompiler(bindingLanguage, resources) {
      

      this.bindingLanguage = bindingLanguage;
      this.resources = resources;
    }

    ViewCompiler.prototype.compile = function compile(source, resources, compileInstruction) {
      resources = resources || this.resources;
      compileInstruction = compileInstruction || ViewCompileInstruction.normal;
      source = typeof source === 'string' ? _aureliaPal.DOM.createTemplateFromMarkup(source) : source;

      var content = void 0;
      var part = void 0;
      var cacheSize = void 0;

      if (source.content) {
        part = source.getAttribute('part');
        cacheSize = source.getAttribute('view-cache');
        content = _aureliaPal.DOM.adoptNode(source.content);
      } else {
        content = source;
      }

      compileInstruction.targetShadowDOM = compileInstruction.targetShadowDOM && _aureliaPal.FEATURE.shadowDOM;
      resources._invokeHook('beforeCompile', content, resources, compileInstruction);

      var instructions = {};
      this._compileNode(content, resources, instructions, source, 'root', !compileInstruction.targetShadowDOM);

      var firstChild = content.firstChild;
      if (firstChild && firstChild.nodeType === 1) {
        var targetId = firstChild.getAttribute('au-target-id');
        if (targetId) {
          var ins = instructions[targetId];

          if (ins.shadowSlot || ins.lifting) {
            content.insertBefore(_aureliaPal.DOM.createComment('view'), firstChild);
          }
        }
      }

      var factory = new ViewFactory(content, instructions, resources);

      factory.surrogateInstruction = compileInstruction.compileSurrogate ? this._compileSurrogate(source, resources) : null;
      factory.part = part;

      if (cacheSize) {
        factory.setCacheSize(cacheSize);
      }

      resources._invokeHook('afterCompile', factory);

      return factory;
    };

    ViewCompiler.prototype._compileNode = function _compileNode(node, resources, instructions, parentNode, parentInjectorId, targetLightDOM) {
      switch (node.nodeType) {
        case 1:
          return this._compileElement(node, resources, instructions, parentNode, parentInjectorId, targetLightDOM);
        case 3:
          var expression = resources.getBindingLanguage(this.bindingLanguage).inspectTextContent(resources, node.wholeText);
          if (expression) {
            var marker = _aureliaPal.DOM.createElement('au-marker');
            var auTargetID = makeIntoInstructionTarget(marker);
            (node.parentNode || parentNode).insertBefore(marker, node);
            node.textContent = ' ';
            instructions[auTargetID] = TargetInstruction.contentExpression(expression);

            while (node.nextSibling && node.nextSibling.nodeType === 3) {
              (node.parentNode || parentNode).removeChild(node.nextSibling);
            }
          } else {
            while (node.nextSibling && node.nextSibling.nodeType === 3) {
              node = node.nextSibling;
            }
          }
          return node.nextSibling;
        case 11:
          var currentChild = node.firstChild;
          while (currentChild) {
            currentChild = this._compileNode(currentChild, resources, instructions, node, parentInjectorId, targetLightDOM);
          }
          break;
        default:
          break;
      }

      return node.nextSibling;
    };

    ViewCompiler.prototype._compileSurrogate = function _compileSurrogate(node, resources) {
      var tagName = node.tagName.toLowerCase();
      var attributes = node.attributes;
      var bindingLanguage = resources.getBindingLanguage(this.bindingLanguage);
      var knownAttribute = void 0;
      var property = void 0;
      var instruction = void 0;
      var i = void 0;
      var ii = void 0;
      var attr = void 0;
      var attrName = void 0;
      var attrValue = void 0;
      var info = void 0;
      var type = void 0;
      var expressions = [];
      var expression = void 0;
      var behaviorInstructions = [];
      var values = {};
      var hasValues = false;
      var providers = [];

      for (i = 0, ii = attributes.length; i < ii; ++i) {
        attr = attributes[i];
        attrName = attr.name;
        attrValue = attr.value;

        info = bindingLanguage.inspectAttribute(resources, tagName, attrName, attrValue);
        type = resources.getAttribute(info.attrName);

        if (type) {
          knownAttribute = resources.mapAttribute(info.attrName);
          if (knownAttribute) {
            property = type.attributes[knownAttribute];

            if (property) {
              info.defaultBindingMode = property.defaultBindingMode;

              if (!info.command && !info.expression) {
                info.command = property.hasOptions ? 'options' : null;
              }
            }
          }
        }

        instruction = bindingLanguage.createAttributeInstruction(resources, node, info, undefined, type);

        if (instruction) {
          if (instruction.alteredAttr) {
            type = resources.getAttribute(instruction.attrName);
          }

          if (instruction.discrete) {
            expressions.push(instruction);
          } else {
            if (type) {
              instruction.type = type;
              configureProperties(instruction, resources);

              if (type.liftsContent) {
                throw new Error('You cannot place a template controller on a surrogate element.');
              } else {
                behaviorInstructions.push(instruction);
              }
            } else {
              expressions.push(instruction.attributes[instruction.attrName]);
            }
          }
        } else {
          if (type) {
            instruction = BehaviorInstruction.attribute(attrName, type);
            instruction.attributes[resources.mapAttribute(attrName)] = attrValue;

            if (type.liftsContent) {
              throw new Error('You cannot place a template controller on a surrogate element.');
            } else {
              behaviorInstructions.push(instruction);
            }
          } else if (attrName !== 'id' && attrName !== 'part' && attrName !== 'replace-part') {
            hasValues = true;
            values[attrName] = attrValue;
          }
        }
      }

      if (expressions.length || behaviorInstructions.length || hasValues) {
        for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
          instruction = behaviorInstructions[i];
          instruction.type.compile(this, resources, node, instruction);
          providers.push(instruction.type.target);
        }

        for (i = 0, ii = expressions.length; i < ii; ++i) {
          expression = expressions[i];
          if (expression.attrToRemove !== undefined) {
            node.removeAttribute(expression.attrToRemove);
          }
        }

        return TargetInstruction.surrogate(providers, behaviorInstructions, expressions, values);
      }

      return null;
    };

    ViewCompiler.prototype._compileElement = function _compileElement(node, resources, instructions, parentNode, parentInjectorId, targetLightDOM) {
      var tagName = node.tagName.toLowerCase();
      var attributes = node.attributes;
      var expressions = [];
      var expression = void 0;
      var behaviorInstructions = [];
      var providers = [];
      var bindingLanguage = resources.getBindingLanguage(this.bindingLanguage);
      var liftingInstruction = void 0;
      var viewFactory = void 0;
      var type = void 0;
      var elementInstruction = void 0;
      var elementProperty = void 0;
      var i = void 0;
      var ii = void 0;
      var attr = void 0;
      var attrName = void 0;
      var attrValue = void 0;
      var instruction = void 0;
      var info = void 0;
      var property = void 0;
      var knownAttribute = void 0;
      var auTargetID = void 0;
      var injectorId = void 0;

      if (tagName === 'slot') {
        if (targetLightDOM) {
          node = makeShadowSlot(this, resources, node, instructions, parentInjectorId);
        }
        return node.nextSibling;
      } else if (tagName === 'template') {
        viewFactory = this.compile(node, resources);
        viewFactory.part = node.getAttribute('part');
      } else {
        type = resources.getElement(node.getAttribute('as-element') || tagName);
        if (type) {
          elementInstruction = BehaviorInstruction.element(node, type);
          type.processAttributes(this, resources, node, attributes, elementInstruction);
          behaviorInstructions.push(elementInstruction);
        }
      }

      for (i = 0, ii = attributes.length; i < ii; ++i) {
        attr = attributes[i];
        attrName = attr.name;
        attrValue = attr.value;
        info = bindingLanguage.inspectAttribute(resources, tagName, attrName, attrValue);

        if (targetLightDOM && info.attrName === 'slot') {
          info.attrName = attrName = 'au-slot';
        }

        type = resources.getAttribute(info.attrName);
        elementProperty = null;

        if (type) {
          knownAttribute = resources.mapAttribute(info.attrName);
          if (knownAttribute) {
            property = type.attributes[knownAttribute];

            if (property) {
              info.defaultBindingMode = property.defaultBindingMode;

              if (!info.command && !info.expression) {
                info.command = property.hasOptions ? 'options' : null;
              }
            }
          }
        } else if (elementInstruction) {
            elementProperty = elementInstruction.type.attributes[info.attrName];
            if (elementProperty) {
              info.defaultBindingMode = elementProperty.defaultBindingMode;
            }
          }

        if (elementProperty) {
          instruction = bindingLanguage.createAttributeInstruction(resources, node, info, elementInstruction);
        } else {
          instruction = bindingLanguage.createAttributeInstruction(resources, node, info, undefined, type);
        }

        if (instruction) {
          if (instruction.alteredAttr) {
            type = resources.getAttribute(instruction.attrName);
          }

          if (instruction.discrete) {
            expressions.push(instruction);
          } else {
            if (type) {
              instruction.type = type;
              configureProperties(instruction, resources);

              if (type.liftsContent) {
                instruction.originalAttrName = attrName;
                liftingInstruction = instruction;
                break;
              } else {
                behaviorInstructions.push(instruction);
              }
            } else if (elementProperty) {
              elementInstruction.attributes[info.attrName].targetProperty = elementProperty.name;
            } else {
              expressions.push(instruction.attributes[instruction.attrName]);
            }
          }
        } else {
          if (type) {
            instruction = BehaviorInstruction.attribute(attrName, type);
            instruction.attributes[resources.mapAttribute(attrName)] = attrValue;

            if (type.liftsContent) {
              instruction.originalAttrName = attrName;
              liftingInstruction = instruction;
              break;
            } else {
              behaviorInstructions.push(instruction);
            }
          } else if (elementProperty) {
            elementInstruction.attributes[attrName] = attrValue;
          }
        }
      }

      if (liftingInstruction) {
        liftingInstruction.viewFactory = viewFactory;
        node = liftingInstruction.type.compile(this, resources, node, liftingInstruction, parentNode);
        auTargetID = makeIntoInstructionTarget(node);
        instructions[auTargetID] = TargetInstruction.lifting(parentInjectorId, liftingInstruction);
      } else {
        if (expressions.length || behaviorInstructions.length) {
          injectorId = behaviorInstructions.length ? getNextInjectorId() : false;

          for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
            instruction = behaviorInstructions[i];
            instruction.type.compile(this, resources, node, instruction, parentNode);
            providers.push(instruction.type.target);
          }

          for (i = 0, ii = expressions.length; i < ii; ++i) {
            expression = expressions[i];
            if (expression.attrToRemove !== undefined) {
              node.removeAttribute(expression.attrToRemove);
            }
          }

          auTargetID = makeIntoInstructionTarget(node);
          instructions[auTargetID] = TargetInstruction.normal(injectorId, parentInjectorId, providers, behaviorInstructions, expressions, elementInstruction);
        }

        if (elementInstruction && elementInstruction.skipContentProcessing) {
          return node.nextSibling;
        }

        var currentChild = node.firstChild;
        while (currentChild) {
          currentChild = this._compileNode(currentChild, resources, instructions, node, injectorId || parentInjectorId, targetLightDOM);
        }
      }

      return node.nextSibling;
    };

    return ViewCompiler;
  }()) || _class17);

  var ResourceModule = exports.ResourceModule = function () {
    function ResourceModule(moduleId) {
      

      this.id = moduleId;
      this.moduleInstance = null;
      this.mainResource = null;
      this.resources = null;
      this.viewStrategy = null;
      this.isInitialized = false;
      this.onLoaded = null;
      this.loadContext = null;
    }

    ResourceModule.prototype.initialize = function initialize(container) {
      var current = this.mainResource;
      var resources = this.resources;
      var vs = this.viewStrategy;

      if (this.isInitialized) {
        return;
      }

      this.isInitialized = true;

      if (current !== undefined) {
        current.metadata.viewStrategy = vs;
        current.initialize(container);
      }

      for (var i = 0, ii = resources.length; i < ii; ++i) {
        current = resources[i];
        current.metadata.viewStrategy = vs;
        current.initialize(container);
      }
    };

    ResourceModule.prototype.register = function register(registry, name) {
      var main = this.mainResource;
      var resources = this.resources;

      if (main !== undefined) {
        main.register(registry, name);
        name = null;
      }

      for (var i = 0, ii = resources.length; i < ii; ++i) {
        resources[i].register(registry, name);
        name = null;
      }
    };

    ResourceModule.prototype.load = function load(container, loadContext) {
      if (this.onLoaded !== null) {
        return this.loadContext === loadContext ? Promise.resolve() : this.onLoaded;
      }

      var main = this.mainResource;
      var resources = this.resources;
      var loads = void 0;

      if (main !== undefined) {
        loads = new Array(resources.length + 1);
        loads[0] = main.load(container, loadContext);
        for (var i = 0, ii = resources.length; i < ii; ++i) {
          loads[i + 1] = resources[i].load(container, loadContext);
        }
      } else {
        loads = new Array(resources.length);
        for (var _i = 0, _ii = resources.length; _i < _ii; ++_i) {
          loads[_i] = resources[_i].load(container, loadContext);
        }
      }

      this.loadContext = loadContext;
      this.onLoaded = Promise.all(loads);
      return this.onLoaded;
    };

    return ResourceModule;
  }();

  var ResourceDescription = exports.ResourceDescription = function () {
    function ResourceDescription(key, exportedValue, resourceTypeMeta) {
      

      if (!resourceTypeMeta) {
        resourceTypeMeta = _aureliaMetadata.metadata.get(_aureliaMetadata.metadata.resource, exportedValue);

        if (!resourceTypeMeta) {
          resourceTypeMeta = new HtmlBehaviorResource();
          resourceTypeMeta.elementName = _hyphenate(key);
          _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, resourceTypeMeta, exportedValue);
        }
      }

      if (resourceTypeMeta instanceof HtmlBehaviorResource) {
        if (resourceTypeMeta.elementName === undefined) {
          resourceTypeMeta.elementName = _hyphenate(key);
        } else if (resourceTypeMeta.attributeName === undefined) {
          resourceTypeMeta.attributeName = _hyphenate(key);
        } else if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
          HtmlBehaviorResource.convention(key, resourceTypeMeta);
        }
      } else if (!resourceTypeMeta.name) {
        resourceTypeMeta.name = _hyphenate(key);
      }

      this.metadata = resourceTypeMeta;
      this.value = exportedValue;
    }

    ResourceDescription.prototype.initialize = function initialize(container) {
      this.metadata.initialize(container, this.value);
    };

    ResourceDescription.prototype.register = function register(registry, name) {
      this.metadata.register(registry, name);
    };

    ResourceDescription.prototype.load = function load(container, loadContext) {
      return this.metadata.load(container, this.value, loadContext);
    };

    return ResourceDescription;
  }();

  var ModuleAnalyzer = exports.ModuleAnalyzer = function () {
    function ModuleAnalyzer() {
      

      this.cache = Object.create(null);
    }

    ModuleAnalyzer.prototype.getAnalysis = function getAnalysis(moduleId) {
      return this.cache[moduleId];
    };

    ModuleAnalyzer.prototype.analyze = function analyze(moduleId, moduleInstance, mainResourceKey) {
      var mainResource = void 0;
      var fallbackValue = void 0;
      var fallbackKey = void 0;
      var resourceTypeMeta = void 0;
      var key = void 0;
      var exportedValue = void 0;
      var resources = [];
      var conventional = void 0;
      var vs = void 0;
      var resourceModule = void 0;

      resourceModule = this.cache[moduleId];
      if (resourceModule) {
        return resourceModule;
      }

      resourceModule = new ResourceModule(moduleId);
      this.cache[moduleId] = resourceModule;

      if (typeof moduleInstance === 'function') {
        moduleInstance = { 'default': moduleInstance };
      }

      if (mainResourceKey) {
        mainResource = new ResourceDescription(mainResourceKey, moduleInstance[mainResourceKey]);
      }

      for (key in moduleInstance) {
        exportedValue = moduleInstance[key];

        if (key === mainResourceKey || typeof exportedValue !== 'function') {
          continue;
        }

        resourceTypeMeta = _aureliaMetadata.metadata.get(_aureliaMetadata.metadata.resource, exportedValue);

        if (resourceTypeMeta) {
          if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
            HtmlBehaviorResource.convention(key, resourceTypeMeta);
          }

          if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
            resourceTypeMeta.elementName = _hyphenate(key);
          }

          if (!mainResource && resourceTypeMeta instanceof HtmlBehaviorResource && resourceTypeMeta.elementName !== null) {
            mainResource = new ResourceDescription(key, exportedValue, resourceTypeMeta);
          } else {
            resources.push(new ResourceDescription(key, exportedValue, resourceTypeMeta));
          }
        } else if (viewStrategy.decorates(exportedValue)) {
          vs = exportedValue;
        } else if (exportedValue instanceof _aureliaLoader.TemplateRegistryEntry) {
          vs = new TemplateRegistryViewStrategy(moduleId, exportedValue);
        } else {
          if (conventional = HtmlBehaviorResource.convention(key)) {
            if (conventional.elementName !== null && !mainResource) {
              mainResource = new ResourceDescription(key, exportedValue, conventional);
            } else {
              resources.push(new ResourceDescription(key, exportedValue, conventional));
            }

            _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, conventional, exportedValue);
          } else if (conventional = _aureliaBinding.ValueConverterResource.convention(key) || _aureliaBinding.BindingBehaviorResource.convention(key) || ViewEngineHooksResource.convention(key)) {
            resources.push(new ResourceDescription(key, exportedValue, conventional));
            _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, conventional, exportedValue);
          } else if (!fallbackValue) {
            fallbackValue = exportedValue;
            fallbackKey = key;
          }
        }
      }

      if (!mainResource && fallbackValue) {
        mainResource = new ResourceDescription(fallbackKey, fallbackValue);
      }

      resourceModule.moduleInstance = moduleInstance;
      resourceModule.mainResource = mainResource;
      resourceModule.resources = resources;
      resourceModule.viewStrategy = vs;

      return resourceModule;
    };

    return ModuleAnalyzer;
  }();

  var logger = LogManager.getLogger('templating');

  function ensureRegistryEntry(loader, urlOrRegistryEntry) {
    if (urlOrRegistryEntry instanceof _aureliaLoader.TemplateRegistryEntry) {
      return Promise.resolve(urlOrRegistryEntry);
    }

    return loader.loadTemplate(urlOrRegistryEntry);
  }

  var ProxyViewFactory = function () {
    function ProxyViewFactory(promise) {
      var _this9 = this;

      

      promise.then(function (x) {
        return _this9.viewFactory = x;
      });
    }

    ProxyViewFactory.prototype.create = function create(container, bindingContext, createInstruction, element) {
      return this.viewFactory.create(container, bindingContext, createInstruction, element);
    };

    ProxyViewFactory.prototype.setCacheSize = function setCacheSize(size, doNotOverrideIfAlreadySet) {
      this.viewFactory.setCacheSize(size, doNotOverrideIfAlreadySet);
    };

    ProxyViewFactory.prototype.getCachedView = function getCachedView() {
      return this.viewFactory.getCachedView();
    };

    ProxyViewFactory.prototype.returnViewToCache = function returnViewToCache(view) {
      this.viewFactory.returnViewToCache(view);
    };

    _createClass(ProxyViewFactory, [{
      key: 'isCaching',
      get: function get() {
        return this.viewFactory.isCaching;
      }
    }]);

    return ProxyViewFactory;
  }();

  var ViewEngine = exports.ViewEngine = (_dec8 = (0, _aureliaDependencyInjection.inject)(_aureliaLoader.Loader, _aureliaDependencyInjection.Container, ViewCompiler, ModuleAnalyzer, ViewResources), _dec8(_class18 = (_temp4 = _class19 = function () {
    function ViewEngine(loader, container, viewCompiler, moduleAnalyzer, appResources) {
      

      this.loader = loader;
      this.container = container;
      this.viewCompiler = viewCompiler;
      this.moduleAnalyzer = moduleAnalyzer;
      this.appResources = appResources;
      this._pluginMap = {};

      var auSlotBehavior = new HtmlBehaviorResource();
      auSlotBehavior.attributeName = 'au-slot';
      auSlotBehavior.initialize(container, SlotCustomAttribute);
      auSlotBehavior.register(appResources);
    }

    ViewEngine.prototype.addResourcePlugin = function addResourcePlugin(extension, implementation) {
      var name = extension.replace('.', '') + '-resource-plugin';
      this._pluginMap[extension] = name;
      this.loader.addPlugin(name, implementation);
    };

    ViewEngine.prototype.loadViewFactory = function loadViewFactory(urlOrRegistryEntry, compileInstruction, loadContext, target) {
      var _this10 = this;

      loadContext = loadContext || new ResourceLoadContext();

      return ensureRegistryEntry(this.loader, urlOrRegistryEntry).then(function (registryEntry) {
        if (registryEntry.onReady) {
          if (!loadContext.hasDependency(urlOrRegistryEntry)) {
            loadContext.addDependency(urlOrRegistryEntry);
            return registryEntry.onReady;
          }

          if (registryEntry.template === null) {
            return registryEntry.onReady;
          }

          return Promise.resolve(new ProxyViewFactory(registryEntry.onReady));
        }

        loadContext.addDependency(urlOrRegistryEntry);

        registryEntry.onReady = _this10.loadTemplateResources(registryEntry, compileInstruction, loadContext, target).then(function (resources) {
          registryEntry.resources = resources;

          if (registryEntry.template === null) {
            return registryEntry.factory = null;
          }

          var viewFactory = _this10.viewCompiler.compile(registryEntry.template, resources, compileInstruction);
          return registryEntry.factory = viewFactory;
        });

        return registryEntry.onReady;
      });
    };

    ViewEngine.prototype.loadTemplateResources = function loadTemplateResources(registryEntry, compileInstruction, loadContext, target) {
      var resources = new ViewResources(this.appResources, registryEntry.address);
      var dependencies = registryEntry.dependencies;
      var importIds = void 0;
      var names = void 0;

      compileInstruction = compileInstruction || ViewCompileInstruction.normal;

      if (dependencies.length === 0 && !compileInstruction.associatedModuleId) {
        return Promise.resolve(resources);
      }

      importIds = dependencies.map(function (x) {
        return x.src;
      });
      names = dependencies.map(function (x) {
        return x.name;
      });
      logger.debug('importing resources for ' + registryEntry.address, importIds);

      if (target) {
        var viewModelRequires = _aureliaMetadata.metadata.get(ViewEngine.viewModelRequireMetadataKey, target);
        if (viewModelRequires) {
          var templateImportCount = importIds.length;
          for (var i = 0, ii = viewModelRequires.length; i < ii; ++i) {
            var req = viewModelRequires[i];
            var importId = typeof req === 'function' ? _aureliaMetadata.Origin.get(req).moduleId : (0, _aureliaPath.relativeToFile)(req.src || req, registryEntry.address);

            if (importIds.indexOf(importId) === -1) {
              importIds.push(importId);
              names.push(req.as);
            }
          }
          logger.debug('importing ViewModel resources for ' + compileInstruction.associatedModuleId, importIds.slice(templateImportCount));
        }
      }

      return this.importViewResources(importIds, names, resources, compileInstruction, loadContext);
    };

    ViewEngine.prototype.importViewModelResource = function importViewModelResource(moduleImport, moduleMember) {
      var _this11 = this;

      return this.loader.loadModule(moduleImport).then(function (viewModelModule) {
        var normalizedId = _aureliaMetadata.Origin.get(viewModelModule).moduleId;
        var resourceModule = _this11.moduleAnalyzer.analyze(normalizedId, viewModelModule, moduleMember);

        if (!resourceModule.mainResource) {
          throw new Error('No view model found in module "' + moduleImport + '".');
        }

        resourceModule.initialize(_this11.container);

        return resourceModule.mainResource;
      });
    };

    ViewEngine.prototype.importViewResources = function importViewResources(moduleIds, names, resources, compileInstruction, loadContext) {
      var _this12 = this;

      loadContext = loadContext || new ResourceLoadContext();
      compileInstruction = compileInstruction || ViewCompileInstruction.normal;

      moduleIds = moduleIds.map(function (x) {
        return _this12._applyLoaderPlugin(x);
      });

      return this.loader.loadAllModules(moduleIds).then(function (imports) {
        var i = void 0;
        var ii = void 0;
        var analysis = void 0;
        var normalizedId = void 0;
        var current = void 0;
        var associatedModule = void 0;
        var container = _this12.container;
        var moduleAnalyzer = _this12.moduleAnalyzer;
        var allAnalysis = new Array(imports.length);

        for (i = 0, ii = imports.length; i < ii; ++i) {
          current = imports[i];
          normalizedId = _aureliaMetadata.Origin.get(current).moduleId;

          analysis = moduleAnalyzer.analyze(normalizedId, current);
          analysis.initialize(container);
          analysis.register(resources, names[i]);

          allAnalysis[i] = analysis;
        }

        if (compileInstruction.associatedModuleId) {
          associatedModule = moduleAnalyzer.getAnalysis(compileInstruction.associatedModuleId);

          if (associatedModule) {
            associatedModule.register(resources);
          }
        }

        for (i = 0, ii = allAnalysis.length; i < ii; ++i) {
          allAnalysis[i] = allAnalysis[i].load(container, loadContext);
        }

        return Promise.all(allAnalysis).then(function () {
          return resources;
        });
      });
    };

    ViewEngine.prototype._applyLoaderPlugin = function _applyLoaderPlugin(id) {
      var index = id.lastIndexOf('.');
      if (index !== -1) {
        var ext = id.substring(index);
        var pluginName = this._pluginMap[ext];

        if (pluginName === undefined) {
          return id;
        }

        return this.loader.applyPluginToUrl(id, pluginName);
      }

      return id;
    };

    return ViewEngine;
  }(), _class19.viewModelRequireMetadataKey = 'aurelia:view-model-require', _temp4)) || _class18);

  var Controller = exports.Controller = function () {
    function Controller(behavior, instruction, viewModel, elementEvents) {
      

      this.behavior = behavior;
      this.instruction = instruction;
      this.viewModel = viewModel;
      this.isAttached = false;
      this.view = null;
      this.isBound = false;
      this.scope = null;
      this.elementEvents = elementEvents || null;

      var observerLookup = behavior.observerLocator.getOrCreateObserversLookup(viewModel);
      var handlesBind = behavior.handlesBind;
      var attributes = instruction.attributes;
      var boundProperties = this.boundProperties = [];
      var properties = behavior.properties;
      var i = void 0;
      var ii = void 0;

      behavior._ensurePropertiesDefined(viewModel, observerLookup);

      for (i = 0, ii = properties.length; i < ii; ++i) {
        properties[i]._initialize(viewModel, observerLookup, attributes, handlesBind, boundProperties);
      }
    }

    Controller.prototype.created = function created(owningView) {
      if (this.behavior.handlesCreated) {
        this.viewModel.created(owningView, this.view);
      }
    };

    Controller.prototype.automate = function automate(overrideContext, owningView) {
      this.view.bindingContext = this.viewModel;
      this.view.overrideContext = overrideContext || (0, _aureliaBinding.createOverrideContext)(this.viewModel);
      this.view._isUserControlled = true;

      if (this.behavior.handlesCreated) {
        this.viewModel.created(owningView || null, this.view);
      }

      this.bind(this.view);
    };

    Controller.prototype.bind = function bind(scope) {
      var skipSelfSubscriber = this.behavior.handlesBind;
      var boundProperties = this.boundProperties;
      var i = void 0;
      var ii = void 0;
      var x = void 0;
      var observer = void 0;
      var selfSubscriber = void 0;

      if (this.isBound) {
        if (this.scope === scope) {
          return;
        }

        this.unbind();
      }

      this.isBound = true;
      this.scope = scope;

      for (i = 0, ii = boundProperties.length; i < ii; ++i) {
        x = boundProperties[i];
        observer = x.observer;
        selfSubscriber = observer.selfSubscriber;
        observer.publishing = false;

        if (skipSelfSubscriber) {
          observer.selfSubscriber = null;
        }

        x.binding.bind(scope);
        observer.call();

        observer.publishing = true;
        observer.selfSubscriber = selfSubscriber;
      }

      var overrideContext = void 0;
      if (this.view !== null) {
        if (skipSelfSubscriber) {
          this.view.viewModelScope = scope;
        }

        if (this.viewModel === scope.overrideContext.bindingContext) {
          overrideContext = scope.overrideContext;
        } else if (this.instruction.inheritBindingContext) {
            overrideContext = (0, _aureliaBinding.createOverrideContext)(this.viewModel, scope.overrideContext);
          } else {
              overrideContext = (0, _aureliaBinding.createOverrideContext)(this.viewModel);
              overrideContext.__parentOverrideContext = scope.overrideContext;
            }

        this.view.bind(this.viewModel, overrideContext);
      } else if (skipSelfSubscriber) {
        overrideContext = scope.overrideContext;

        if (scope.overrideContext.__parentOverrideContext !== undefined && this.viewModel.viewFactory && this.viewModel.viewFactory.factoryCreateInstruction.partReplacements) {
          overrideContext = Object.assign({}, scope.overrideContext);
          overrideContext.parentOverrideContext = scope.overrideContext.__parentOverrideContext;
        }
        this.viewModel.bind(scope.bindingContext, overrideContext);
      }
    };

    Controller.prototype.unbind = function unbind() {
      if (this.isBound) {
        var boundProperties = this.boundProperties;
        var i = void 0;
        var ii = void 0;

        this.isBound = false;
        this.scope = null;

        if (this.view !== null) {
          this.view.unbind();
        }

        if (this.behavior.handlesUnbind) {
          this.viewModel.unbind();
        }

        if (this.elementEvents !== null) {
          this.elementEvents.disposeAll();
        }

        for (i = 0, ii = boundProperties.length; i < ii; ++i) {
          boundProperties[i].binding.unbind();
        }
      }
    };

    Controller.prototype.attached = function attached() {
      if (this.isAttached) {
        return;
      }

      this.isAttached = true;

      if (this.behavior.handlesAttached) {
        this.viewModel.attached();
      }

      if (this.view !== null) {
        this.view.attached();
      }
    };

    Controller.prototype.detached = function detached() {
      if (this.isAttached) {
        this.isAttached = false;

        if (this.view !== null) {
          this.view.detached();
        }

        if (this.behavior.handlesDetached) {
          this.viewModel.detached();
        }
      }
    };

    return Controller;
  }();

  var BehaviorPropertyObserver = exports.BehaviorPropertyObserver = (_dec9 = (0, _aureliaBinding.subscriberCollection)(), _dec9(_class21 = function () {
    function BehaviorPropertyObserver(taskQueue, obj, propertyName, selfSubscriber, initialValue) {
      

      this.taskQueue = taskQueue;
      this.obj = obj;
      this.propertyName = propertyName;
      this.notqueued = true;
      this.publishing = false;
      this.selfSubscriber = selfSubscriber;
      this.currentValue = this.oldValue = initialValue;
    }

    BehaviorPropertyObserver.prototype.getValue = function getValue() {
      return this.currentValue;
    };

    BehaviorPropertyObserver.prototype.setValue = function setValue(newValue) {
      var oldValue = this.currentValue;

      if (oldValue !== newValue) {
        if (this.publishing && this.notqueued) {
          this.notqueued = false;
          this.taskQueue.queueMicroTask(this);
        }

        this.oldValue = oldValue;
        this.currentValue = newValue;
      }
    };

    BehaviorPropertyObserver.prototype.call = function call() {
      var oldValue = this.oldValue;
      var newValue = this.currentValue;

      this.notqueued = true;

      if (newValue === oldValue) {
        return;
      }

      if (this.selfSubscriber) {
        this.selfSubscriber(newValue, oldValue);
      }

      this.callSubscribers(newValue, oldValue);
      this.oldValue = newValue;
    };

    BehaviorPropertyObserver.prototype.subscribe = function subscribe(context, callable) {
      this.addSubscriber(context, callable);
    };

    BehaviorPropertyObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
      this.removeSubscriber(context, callable);
    };

    return BehaviorPropertyObserver;
  }()) || _class21);


  function getObserver(behavior, instance, name) {
    var lookup = instance.__observers__;

    if (lookup === undefined) {
      if (!behavior.isInitialized) {
        behavior.initialize(_aureliaDependencyInjection.Container.instance || new _aureliaDependencyInjection.Container(), instance.constructor);
      }

      lookup = behavior.observerLocator.getOrCreateObserversLookup(instance);
      behavior._ensurePropertiesDefined(instance, lookup);
    }

    return lookup[name];
  }

  var BindableProperty = exports.BindableProperty = function () {
    function BindableProperty(nameOrConfig) {
      

      if (typeof nameOrConfig === 'string') {
        this.name = nameOrConfig;
      } else {
        Object.assign(this, nameOrConfig);
      }

      this.attribute = this.attribute || _hyphenate(this.name);
      if (this.defaultBindingMode === null || this.defaultBindingMode === undefined) {
        this.defaultBindingMode = _aureliaBinding.bindingMode.oneWay;
      }
      this.changeHandler = this.changeHandler || null;
      this.owner = null;
      this.descriptor = null;
    }

    BindableProperty.prototype.registerWith = function registerWith(target, behavior, descriptor) {
      behavior.properties.push(this);
      behavior.attributes[this.attribute] = this;
      this.owner = behavior;

      if (descriptor) {
        this.descriptor = descriptor;
        return this._configureDescriptor(behavior, descriptor);
      }

      return undefined;
    };

    BindableProperty.prototype._configureDescriptor = function _configureDescriptor(behavior, descriptor) {
      var name = this.name;

      descriptor.configurable = true;
      descriptor.enumerable = true;

      if ('initializer' in descriptor) {
        this.defaultValue = descriptor.initializer;
        delete descriptor.initializer;
        delete descriptor.writable;
      }

      if ('value' in descriptor) {
        this.defaultValue = descriptor.value;
        delete descriptor.value;
        delete descriptor.writable;
      }

      descriptor.get = function () {
        return getObserver(behavior, this, name).getValue();
      };

      descriptor.set = function (value) {
        getObserver(behavior, this, name).setValue(value);
      };

      descriptor.get.getObserver = function (obj) {
        return getObserver(behavior, obj, name);
      };

      return descriptor;
    };

    BindableProperty.prototype.defineOn = function defineOn(target, behavior) {
      var name = this.name;
      var handlerName = void 0;

      if (this.changeHandler === null) {
        handlerName = name + 'Changed';
        if (handlerName in target.prototype) {
          this.changeHandler = handlerName;
        }
      }

      if (this.descriptor === null) {
        Object.defineProperty(target.prototype, name, this._configureDescriptor(behavior, {}));
      }
    };

    BindableProperty.prototype.createObserver = function createObserver(viewModel) {
      var selfSubscriber = null;
      var defaultValue = this.defaultValue;
      var changeHandlerName = this.changeHandler;
      var name = this.name;
      var initialValue = void 0;

      if (this.hasOptions) {
        return undefined;
      }

      if (changeHandlerName in viewModel) {
        if ('propertyChanged' in viewModel) {
          selfSubscriber = function selfSubscriber(newValue, oldValue) {
            viewModel[changeHandlerName](newValue, oldValue);
            viewModel.propertyChanged(name, newValue, oldValue);
          };
        } else {
          selfSubscriber = function selfSubscriber(newValue, oldValue) {
            return viewModel[changeHandlerName](newValue, oldValue);
          };
        }
      } else if ('propertyChanged' in viewModel) {
        selfSubscriber = function selfSubscriber(newValue, oldValue) {
          return viewModel.propertyChanged(name, newValue, oldValue);
        };
      } else if (changeHandlerName !== null) {
        throw new Error('Change handler ' + changeHandlerName + ' was specified but not declared on the class.');
      }

      if (defaultValue !== undefined) {
        initialValue = typeof defaultValue === 'function' ? defaultValue.call(viewModel) : defaultValue;
      }

      return new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, this.name, selfSubscriber, initialValue);
    };

    BindableProperty.prototype._initialize = function _initialize(viewModel, observerLookup, attributes, behaviorHandlesBind, boundProperties) {
      var selfSubscriber = void 0;
      var observer = void 0;
      var attribute = void 0;
      var defaultValue = this.defaultValue;

      if (this.isDynamic) {
        for (var key in attributes) {
          this._createDynamicProperty(viewModel, observerLookup, behaviorHandlesBind, key, attributes[key], boundProperties);
        }
      } else if (!this.hasOptions) {
        observer = observerLookup[this.name];

        if (attributes !== null) {
          selfSubscriber = observer.selfSubscriber;
          attribute = attributes[this.attribute];

          if (behaviorHandlesBind) {
            observer.selfSubscriber = null;
          }

          if (typeof attribute === 'string') {
            viewModel[this.name] = attribute;
            observer.call();
          } else if (attribute) {
            boundProperties.push({ observer: observer, binding: attribute.createBinding(viewModel) });
          } else if (defaultValue !== undefined) {
            observer.call();
          }

          observer.selfSubscriber = selfSubscriber;
        }

        observer.publishing = true;
      }
    };

    BindableProperty.prototype._createDynamicProperty = function _createDynamicProperty(viewModel, observerLookup, behaviorHandlesBind, name, attribute, boundProperties) {
      var changeHandlerName = name + 'Changed';
      var selfSubscriber = null;
      var observer = void 0;
      var info = void 0;

      if (changeHandlerName in viewModel) {
        if ('propertyChanged' in viewModel) {
          selfSubscriber = function selfSubscriber(newValue, oldValue) {
            viewModel[changeHandlerName](newValue, oldValue);
            viewModel.propertyChanged(name, newValue, oldValue);
          };
        } else {
          selfSubscriber = function selfSubscriber(newValue, oldValue) {
            return viewModel[changeHandlerName](newValue, oldValue);
          };
        }
      } else if ('propertyChanged' in viewModel) {
        selfSubscriber = function selfSubscriber(newValue, oldValue) {
          return viewModel.propertyChanged(name, newValue, oldValue);
        };
      }

      observer = observerLookup[name] = new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, name, selfSubscriber);

      Object.defineProperty(viewModel, name, {
        configurable: true,
        enumerable: true,
        get: observer.getValue.bind(observer),
        set: observer.setValue.bind(observer)
      });

      if (behaviorHandlesBind) {
        observer.selfSubscriber = null;
      }

      if (typeof attribute === 'string') {
        viewModel[name] = attribute;
        observer.call();
      } else if (attribute) {
        info = { observer: observer, binding: attribute.createBinding(viewModel) };
        boundProperties.push(info);
      }

      observer.publishing = true;
      observer.selfSubscriber = selfSubscriber;
    };

    return BindableProperty;
  }();

  var lastProviderId = 0;

  function nextProviderId() {
    return ++lastProviderId;
  }

  function doProcessContent() {
    return true;
  }
  function doProcessAttributes() {}

  var HtmlBehaviorResource = exports.HtmlBehaviorResource = function () {
    function HtmlBehaviorResource() {
      

      this.elementName = null;
      this.attributeName = null;
      this.attributeDefaultBindingMode = undefined;
      this.liftsContent = false;
      this.targetShadowDOM = false;
      this.shadowDOMOptions = null;
      this.processAttributes = doProcessAttributes;
      this.processContent = doProcessContent;
      this.usesShadowDOM = false;
      this.childBindings = null;
      this.hasDynamicOptions = false;
      this.containerless = false;
      this.properties = [];
      this.attributes = {};
      this.isInitialized = false;
    }

    HtmlBehaviorResource.convention = function convention(name, existing) {
      var behavior = void 0;

      if (name.endsWith('CustomAttribute')) {
        behavior = existing || new HtmlBehaviorResource();
        behavior.attributeName = _hyphenate(name.substring(0, name.length - 15));
      }

      if (name.endsWith('CustomElement')) {
        behavior = existing || new HtmlBehaviorResource();
        behavior.elementName = _hyphenate(name.substring(0, name.length - 13));
      }

      return behavior;
    };

    HtmlBehaviorResource.prototype.addChildBinding = function addChildBinding(behavior) {
      if (this.childBindings === null) {
        this.childBindings = [];
      }

      this.childBindings.push(behavior);
    };

    HtmlBehaviorResource.prototype.initialize = function initialize(container, target) {
      var proto = target.prototype;
      var properties = this.properties;
      var attributeName = this.attributeName;
      var attributeDefaultBindingMode = this.attributeDefaultBindingMode;
      var i = void 0;
      var ii = void 0;
      var current = void 0;

      if (this.isInitialized) {
        return;
      }

      this.isInitialized = true;
      target.__providerId__ = nextProviderId();

      this.observerLocator = container.get(_aureliaBinding.ObserverLocator);
      this.taskQueue = container.get(_aureliaTaskQueue.TaskQueue);

      this.target = target;
      this.usesShadowDOM = this.targetShadowDOM && _aureliaPal.FEATURE.shadowDOM;
      this.handlesCreated = 'created' in proto;
      this.handlesBind = 'bind' in proto;
      this.handlesUnbind = 'unbind' in proto;
      this.handlesAttached = 'attached' in proto;
      this.handlesDetached = 'detached' in proto;
      this.htmlName = this.elementName || this.attributeName;

      if (attributeName !== null) {
        if (properties.length === 0) {
          new BindableProperty({
            name: 'value',
            changeHandler: 'valueChanged' in proto ? 'valueChanged' : null,
            attribute: attributeName,
            defaultBindingMode: attributeDefaultBindingMode
          }).registerWith(target, this);
        }

        current = properties[0];

        if (properties.length === 1 && current.name === 'value') {
          current.isDynamic = current.hasOptions = this.hasDynamicOptions;
          current.defineOn(target, this);
        } else {
          for (i = 0, ii = properties.length; i < ii; ++i) {
            properties[i].defineOn(target, this);
          }

          current = new BindableProperty({
            name: 'value',
            changeHandler: 'valueChanged' in proto ? 'valueChanged' : null,
            attribute: attributeName,
            defaultBindingMode: attributeDefaultBindingMode
          });

          current.hasOptions = true;
          current.registerWith(target, this);
        }
      } else {
        for (i = 0, ii = properties.length; i < ii; ++i) {
          properties[i].defineOn(target, this);
        }
      }
    };

    HtmlBehaviorResource.prototype.register = function register(registry, name) {
      if (this.attributeName !== null) {
        registry.registerAttribute(name || this.attributeName, this, this.attributeName);
      }

      if (this.elementName !== null) {
        registry.registerElement(name || this.elementName, this);
      }
    };

    HtmlBehaviorResource.prototype.load = function load(container, target, loadContext, viewStrategy, transientView) {
      var _this13 = this;

      var options = void 0;

      if (this.elementName !== null) {
        viewStrategy = container.get(ViewLocator).getViewStrategy(viewStrategy || this.viewStrategy || target);
        options = new ViewCompileInstruction(this.targetShadowDOM, true);

        if (!viewStrategy.moduleId) {
          viewStrategy.moduleId = _aureliaMetadata.Origin.get(target).moduleId;
        }

        return viewStrategy.loadViewFactory(container.get(ViewEngine), options, loadContext, target).then(function (viewFactory) {
          if (!transientView || !_this13.viewFactory) {
            _this13.viewFactory = viewFactory;
          }

          return viewFactory;
        });
      }

      return Promise.resolve(this);
    };

    HtmlBehaviorResource.prototype.compile = function compile(compiler, resources, node, instruction, parentNode) {
      if (this.liftsContent) {
        if (!instruction.viewFactory) {
          var template = _aureliaPal.DOM.createElement('template');
          var fragment = _aureliaPal.DOM.createDocumentFragment();
          var cacheSize = node.getAttribute('view-cache');
          var part = node.getAttribute('part');

          node.removeAttribute(instruction.originalAttrName);
          _aureliaPal.DOM.replaceNode(template, node, parentNode);
          fragment.appendChild(node);
          instruction.viewFactory = compiler.compile(fragment, resources);

          if (part) {
            instruction.viewFactory.part = part;
            node.removeAttribute('part');
          }

          if (cacheSize) {
            instruction.viewFactory.setCacheSize(cacheSize);
            node.removeAttribute('view-cache');
          }

          node = template;
        }
      } else if (this.elementName !== null) {
        var _partReplacements2 = {};

        if (this.processContent(compiler, resources, node, instruction) && node.hasChildNodes()) {
          var currentChild = node.firstChild;
          var contentElement = this.usesShadowDOM ? null : _aureliaPal.DOM.createElement('au-content');
          var nextSibling = void 0;
          var toReplace = void 0;

          while (currentChild) {
            nextSibling = currentChild.nextSibling;

            if (currentChild.tagName === 'TEMPLATE' && (toReplace = currentChild.getAttribute('replace-part'))) {
              _partReplacements2[toReplace] = compiler.compile(currentChild, resources);
              _aureliaPal.DOM.removeNode(currentChild, parentNode);
              instruction.partReplacements = _partReplacements2;
            } else if (contentElement !== null) {
              if (currentChild.nodeType === 3 && _isAllWhitespace(currentChild)) {
                _aureliaPal.DOM.removeNode(currentChild, parentNode);
              } else {
                contentElement.appendChild(currentChild);
              }
            }

            currentChild = nextSibling;
          }

          if (contentElement !== null && contentElement.hasChildNodes()) {
            node.appendChild(contentElement);
          }

          instruction.skipContentProcessing = false;
        } else {
          instruction.skipContentProcessing = true;
        }
      }

      return node;
    };

    HtmlBehaviorResource.prototype.create = function create(container, instruction, element, bindings) {
      var viewHost = void 0;
      var au = null;

      instruction = instruction || BehaviorInstruction.normal;
      element = element || null;
      bindings = bindings || null;

      if (this.elementName !== null && element) {
        if (this.usesShadowDOM) {
          viewHost = element.attachShadow(this.shadowDOMOptions);
          container.registerInstance(_aureliaPal.DOM.boundary, viewHost);
        } else {
          viewHost = element;
          if (this.targetShadowDOM) {
            container.registerInstance(_aureliaPal.DOM.boundary, viewHost);
          }
        }
      }

      if (element !== null) {
        element.au = au = element.au || {};
      }

      var viewModel = instruction.viewModel || container.get(this.target);
      var controller = new Controller(this, instruction, viewModel, container.elementEvents);
      var childBindings = this.childBindings;
      var viewFactory = void 0;

      if (this.liftsContent) {
        au.controller = controller;
      } else if (this.elementName !== null) {
        viewFactory = instruction.viewFactory || this.viewFactory;
        container.viewModel = viewModel;

        if (viewFactory) {
          controller.view = viewFactory.create(container, instruction, element);
        }

        if (element !== null) {
          au.controller = controller;

          if (controller.view) {
            if (!this.usesShadowDOM && (element.childNodes.length === 1 || element.contentElement)) {
              var contentElement = element.childNodes[0] || element.contentElement;
              controller.view.contentView = { fragment: contentElement };
              contentElement.parentNode && _aureliaPal.DOM.removeNode(contentElement);
            }

            if (instruction.anchorIsContainer) {
              if (childBindings !== null) {
                for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                  controller.view.addBinding(childBindings[i].create(element, viewModel, controller));
                }
              }

              controller.view.appendNodesTo(viewHost);
            } else {
              controller.view.insertNodesBefore(viewHost);
            }
          } else if (childBindings !== null) {
            for (var _i2 = 0, _ii2 = childBindings.length; _i2 < _ii2; ++_i2) {
              bindings.push(childBindings[_i2].create(element, viewModel, controller));
            }
          }
        } else if (controller.view) {
          controller.view.controller = controller;

          if (childBindings !== null) {
            for (var _i3 = 0, _ii3 = childBindings.length; _i3 < _ii3; ++_i3) {
              controller.view.addBinding(childBindings[_i3].create(instruction.host, viewModel, controller));
            }
          }
        } else if (childBindings !== null) {
          for (var _i4 = 0, _ii4 = childBindings.length; _i4 < _ii4; ++_i4) {
            bindings.push(childBindings[_i4].create(instruction.host, viewModel, controller));
          }
        }
      } else if (childBindings !== null) {
        for (var _i5 = 0, _ii5 = childBindings.length; _i5 < _ii5; ++_i5) {
          bindings.push(childBindings[_i5].create(element, viewModel, controller));
        }
      }

      if (au !== null) {
        au[this.htmlName] = controller;
      }

      if (instruction.initiatedByBehavior && viewFactory) {
        controller.view.created();
      }

      return controller;
    };

    HtmlBehaviorResource.prototype._ensurePropertiesDefined = function _ensurePropertiesDefined(instance, lookup) {
      var properties = void 0;
      var i = void 0;
      var ii = void 0;
      var observer = void 0;

      if ('__propertiesDefined__' in lookup) {
        return;
      }

      lookup.__propertiesDefined__ = true;
      properties = this.properties;

      for (i = 0, ii = properties.length; i < ii; ++i) {
        observer = properties[i].createObserver(instance);

        if (observer !== undefined) {
          lookup[observer.propertyName] = observer;
        }
      }
    };

    return HtmlBehaviorResource;
  }();

  function createChildObserverDecorator(selectorOrConfig, all) {
    return function (target, key, descriptor) {
      var actualTarget = typeof key === 'string' ? target.constructor : target;
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, actualTarget);

      if (typeof selectorOrConfig === 'string') {
        selectorOrConfig = {
          selector: selectorOrConfig,
          name: key
        };
      }

      if (descriptor) {
        descriptor.writable = true;
      }

      selectorOrConfig.all = all;
      r.addChildBinding(new ChildObserver(selectorOrConfig));
    };
  }

  function children(selectorOrConfig) {
    return createChildObserverDecorator(selectorOrConfig, true);
  }

  function child(selectorOrConfig) {
    return createChildObserverDecorator(selectorOrConfig, false);
  }

  var ChildObserver = function () {
    function ChildObserver(config) {
      

      this.name = config.name;
      this.changeHandler = config.changeHandler || this.name + 'Changed';
      this.selector = config.selector;
      this.all = config.all;
    }

    ChildObserver.prototype.create = function create(viewHost, viewModel, controller) {
      return new ChildObserverBinder(this.selector, viewHost, this.name, viewModel, controller, this.changeHandler, this.all);
    };

    return ChildObserver;
  }();

  var noMutations = [];

  function trackMutation(groupedMutations, binder, record) {
    var mutations = groupedMutations.get(binder);

    if (!mutations) {
      mutations = [];
      groupedMutations.set(binder, mutations);
    }

    mutations.push(record);
  }

  function onChildChange(mutations, observer) {
    var binders = observer.binders;
    var bindersLength = binders.length;
    var groupedMutations = new Map();

    for (var i = 0, ii = mutations.length; i < ii; ++i) {
      var record = mutations[i];
      var added = record.addedNodes;
      var removed = record.removedNodes;

      for (var j = 0, jj = removed.length; j < jj; ++j) {
        var node = removed[j];
        if (node.nodeType === 1) {
          for (var k = 0; k < bindersLength; ++k) {
            var binder = binders[k];
            if (binder.onRemove(node)) {
              trackMutation(groupedMutations, binder, record);
            }
          }
        }
      }

      for (var _j = 0, _jj = added.length; _j < _jj; ++_j) {
        var _node = added[_j];
        if (_node.nodeType === 1) {
          for (var _k = 0; _k < bindersLength; ++_k) {
            var _binder = binders[_k];
            if (_binder.onAdd(_node)) {
              trackMutation(groupedMutations, _binder, record);
            }
          }
        }
      }
    }

    groupedMutations.forEach(function (value, key) {
      if (key.changeHandler !== null) {
        key.viewModel[key.changeHandler](value);
      }
    });
  }

  var ChildObserverBinder = function () {
    function ChildObserverBinder(selector, viewHost, property, viewModel, controller, changeHandler, all) {
      

      this.selector = selector;
      this.viewHost = viewHost;
      this.property = property;
      this.viewModel = viewModel;
      this.controller = controller;
      this.changeHandler = changeHandler in viewModel ? changeHandler : null;
      this.usesShadowDOM = controller.behavior.usesShadowDOM;
      this.all = all;

      if (!this.usesShadowDOM && controller.view && controller.view.contentView) {
        this.contentView = controller.view.contentView;
      } else {
        this.contentView = null;
      }
    }

    ChildObserverBinder.prototype.matches = function matches(element) {
      if (element.matches(this.selector)) {
        if (this.contentView === null) {
          return true;
        }

        var contentView = this.contentView;
        var assignedSlot = element.auAssignedSlot;

        if (assignedSlot && assignedSlot.projectFromAnchors) {
          var anchors = assignedSlot.projectFromAnchors;

          for (var i = 0, ii = anchors.length; i < ii; ++i) {
            if (anchors[i].auOwnerView === contentView) {
              return true;
            }
          }

          return false;
        }

        return element.auOwnerView === contentView;
      }

      return false;
    };

    ChildObserverBinder.prototype.bind = function bind(source) {
      var viewHost = this.viewHost;
      var viewModel = this.viewModel;
      var observer = viewHost.__childObserver__;

      if (!observer) {
        observer = viewHost.__childObserver__ = _aureliaPal.DOM.createMutationObserver(onChildChange);

        var options = {
          childList: true,
          subtree: !this.usesShadowDOM
        };

        observer.observe(viewHost, options);
        observer.binders = [];
      }

      observer.binders.push(this);

      if (this.usesShadowDOM) {
        var current = viewHost.firstElementChild;

        if (this.all) {
          var items = viewModel[this.property];
          if (!items) {
            items = viewModel[this.property] = [];
          } else {
            items.length = 0;
          }

          while (current) {
            if (this.matches(current)) {
              items.push(current.au && current.au.controller ? current.au.controller.viewModel : current);
            }

            current = current.nextElementSibling;
          }

          if (this.changeHandler !== null) {
            this.viewModel[this.changeHandler](noMutations);
          }
        } else {
          while (current) {
            if (this.matches(current)) {
              var value = current.au && current.au.controller ? current.au.controller.viewModel : current;
              this.viewModel[this.property] = value;

              if (this.changeHandler !== null) {
                this.viewModel[this.changeHandler](value);
              }

              break;
            }

            current = current.nextElementSibling;
          }
        }
      }
    };

    ChildObserverBinder.prototype.onRemove = function onRemove(element) {
      if (this.matches(element)) {
        var value = element.au && element.au.controller ? element.au.controller.viewModel : element;

        if (this.all) {
          var items = this.viewModel[this.property] || (this.viewModel[this.property] = []);
          var index = items.indexOf(value);

          if (index !== -1) {
            items.splice(index, 1);
          }

          return true;
        }

        return false;
      }

      return false;
    };

    ChildObserverBinder.prototype.onAdd = function onAdd(element) {
      if (this.matches(element)) {
        var value = element.au && element.au.controller ? element.au.controller.viewModel : element;

        if (this.all) {
          var items = this.viewModel[this.property] || (this.viewModel[this.property] = []);
          var index = 0;
          var prev = element.previousElementSibling;

          while (prev) {
            if (this.matches(prev)) {
              index++;
            }

            prev = prev.previousElementSibling;
          }

          items.splice(index, 0, value);
          return true;
        }

        this.viewModel[this.property] = value;

        if (this.changeHandler !== null) {
          this.viewModel[this.changeHandler](value);
        }
      }

      return false;
    };

    ChildObserverBinder.prototype.unbind = function unbind() {
      if (this.viewHost.__childObserver__) {
        this.viewHost.__childObserver__.disconnect();
        this.viewHost.__childObserver__ = null;
      }
    };

    return ChildObserverBinder;
  }();

  function tryActivateViewModel(context) {
    if (context.skipActivation || typeof context.viewModel.activate !== 'function') {
      return Promise.resolve();
    }

    return context.viewModel.activate(context.model) || Promise.resolve();
  }

  var CompositionEngine = exports.CompositionEngine = (_dec10 = (0, _aureliaDependencyInjection.inject)(ViewEngine, ViewLocator), _dec10(_class22 = function () {
    function CompositionEngine(viewEngine, viewLocator) {
      

      this.viewEngine = viewEngine;
      this.viewLocator = viewLocator;
    }

    CompositionEngine.prototype._createControllerAndSwap = function _createControllerAndSwap(context) {
      function swap(controller) {
        return Promise.resolve(context.viewSlot.removeAll(true)).then(function () {
          if (context.currentController) {
            context.currentController.unbind();
          }

          context.viewSlot.add(controller.view);

          if (context.compositionTransactionNotifier) {
            context.compositionTransactionNotifier.done();
          }

          return controller;
        });
      }

      return this.createController(context).then(function (controller) {
        controller.automate(context.overrideContext, context.owningView);

        if (context.compositionTransactionOwnershipToken) {
          return context.compositionTransactionOwnershipToken.waitForCompositionComplete().then(function () {
            return swap(controller);
          });
        }

        return swap(controller);
      });
    };

    CompositionEngine.prototype.createController = function createController(context) {
      var _this14 = this;

      var childContainer = void 0;
      var viewModel = void 0;
      var viewModelResource = void 0;
      var m = void 0;

      return this.ensureViewModel(context).then(tryActivateViewModel).then(function () {
        childContainer = context.childContainer;
        viewModel = context.viewModel;
        viewModelResource = context.viewModelResource;
        m = viewModelResource.metadata;

        var viewStrategy = _this14.viewLocator.getViewStrategy(context.view || viewModel);

        if (context.viewResources) {
          viewStrategy.makeRelativeTo(context.viewResources.viewUrl);
        }

        return m.load(childContainer, viewModelResource.value, null, viewStrategy, true);
      }).then(function (viewFactory) {
        return m.create(childContainer, BehaviorInstruction.dynamic(context.host, viewModel, viewFactory));
      });
    };

    CompositionEngine.prototype.ensureViewModel = function ensureViewModel(context) {
      var childContainer = context.childContainer = context.childContainer || context.container.createChild();

      if (typeof context.viewModel === 'string') {
        context.viewModel = context.viewResources ? context.viewResources.relativeToView(context.viewModel) : context.viewModel;

        return this.viewEngine.importViewModelResource(context.viewModel).then(function (viewModelResource) {
          childContainer.autoRegister(viewModelResource.value);

          if (context.host) {
            childContainer.registerInstance(_aureliaPal.DOM.Element, context.host);
          }

          context.viewModel = childContainer.viewModel = childContainer.get(viewModelResource.value);
          context.viewModelResource = viewModelResource;
          return context;
        });
      }

      var m = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, context.viewModel.constructor);
      m.elementName = m.elementName || 'dynamic-element';
      m.initialize(context.container || childContainer, context.viewModel.constructor);
      context.viewModelResource = { metadata: m, value: context.viewModel.constructor };
      childContainer.viewModel = context.viewModel;
      return Promise.resolve(context);
    };

    CompositionEngine.prototype.compose = function compose(context) {
      context.childContainer = context.childContainer || context.container.createChild();
      context.view = this.viewLocator.getViewStrategy(context.view);

      var transaction = context.childContainer.get(CompositionTransaction);
      var compositionTransactionOwnershipToken = transaction.tryCapture();

      if (compositionTransactionOwnershipToken) {
        context.compositionTransactionOwnershipToken = compositionTransactionOwnershipToken;
      } else {
        context.compositionTransactionNotifier = transaction.enlist();
      }

      if (context.viewModel) {
        return this._createControllerAndSwap(context);
      } else if (context.view) {
        if (context.viewResources) {
          context.view.makeRelativeTo(context.viewResources.viewUrl);
        }

        return context.view.loadViewFactory(this.viewEngine, new ViewCompileInstruction()).then(function (viewFactory) {
          var result = viewFactory.create(context.childContainer);
          result.bind(context.bindingContext, context.overrideContext);

          var work = function work() {
            return Promise.resolve(context.viewSlot.removeAll(true)).then(function () {
              context.viewSlot.add(result);

              if (context.compositionTransactionNotifier) {
                context.compositionTransactionNotifier.done();
              }

              return result;
            });
          };

          if (context.compositionTransactionOwnershipToken) {
            return context.compositionTransactionOwnershipToken.waitForCompositionComplete().then(work);
          }

          return work();
        });
      } else if (context.viewSlot) {
        context.viewSlot.removeAll();

        if (context.compositionTransactionNotifier) {
          context.compositionTransactionNotifier.done();
        }

        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    };

    return CompositionEngine;
  }()) || _class22);

  var ElementConfigResource = exports.ElementConfigResource = function () {
    function ElementConfigResource() {
      
    }

    ElementConfigResource.prototype.initialize = function initialize(container, target) {};

    ElementConfigResource.prototype.register = function register(registry, name) {};

    ElementConfigResource.prototype.load = function load(container, target) {
      var config = new target();
      var eventManager = container.get(_aureliaBinding.EventManager);
      eventManager.registerElementConfig(config);
    };

    return ElementConfigResource;
  }();

  function validateBehaviorName(name, type) {
    if (/[A-Z]/.test(name)) {
      var newName = _hyphenate(name);
      LogManager.getLogger('templating').warn('\'' + name + '\' is not a valid ' + type + ' name and has been converted to \'' + newName + '\'. Upper-case letters are not allowed because the DOM is not case-sensitive.');
      return newName;
    }
    return name;
  }

  function resource(instance) {
    return function (target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, instance, target);
    };
  }

  function behavior(override) {
    return function (target) {
      if (override instanceof HtmlBehaviorResource) {
        _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, override, target);
      } else {
        var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
        Object.assign(r, override);
      }
    };
  }

  function customElement(name) {
    return function (target) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
      r.elementName = validateBehaviorName(name, 'custom element');
    };
  }

  function customAttribute(name, defaultBindingMode) {
    return function (target) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
      r.attributeName = validateBehaviorName(name, 'custom attribute');
      r.attributeDefaultBindingMode = defaultBindingMode;
    };
  }

  function templateController(target) {
    var deco = function deco(t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.liftsContent = true;
    };

    return target ? deco(target) : deco;
  }

  function bindable(nameOrConfigOrTarget, key, descriptor) {
    var deco = function deco(target, key2, descriptor2) {
      var actualTarget = key2 ? target.constructor : target;
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, actualTarget);
      var prop = void 0;

      if (key2) {
        nameOrConfigOrTarget = nameOrConfigOrTarget || {};
        nameOrConfigOrTarget.name = key2;
      }

      prop = new BindableProperty(nameOrConfigOrTarget);
      return prop.registerWith(actualTarget, r, descriptor2);
    };

    if (!nameOrConfigOrTarget) {
      return deco;
    }

    if (key) {
      var _target = nameOrConfigOrTarget;
      nameOrConfigOrTarget = null;
      return deco(_target, key, descriptor);
    }

    return deco;
  }

  function dynamicOptions(target) {
    var deco = function deco(t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.hasDynamicOptions = true;
    };

    return target ? deco(target) : deco;
  }

  var defaultShadowDOMOptions = { mode: 'open' };
  function useShadowDOM(targetOrOptions) {
    var options = typeof targetOrOptions === 'function' || !targetOrOptions ? defaultShadowDOMOptions : targetOrOptions;

    var deco = function deco(t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.targetShadowDOM = true;
      r.shadowDOMOptions = options;
    };

    return typeof targetOrOptions === 'function' ? deco(targetOrOptions) : deco;
  }

  function processAttributes(processor) {
    return function (t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.processAttributes = function (compiler, resources, node, attributes, elementInstruction) {
        try {
          processor(compiler, resources, node, attributes, elementInstruction);
        } catch (error) {
          LogManager.getLogger('templating').error(error);
        }
      };
    };
  }

  function doNotProcessContent() {
    return false;
  }

  function processContent(processor) {
    return function (t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.processContent = processor ? function (compiler, resources, node, instruction) {
        try {
          return processor(compiler, resources, node, instruction);
        } catch (error) {
          LogManager.getLogger('templating').error(error);
          return false;
        }
      } : doNotProcessContent;
    };
  }

  function containerless(target) {
    var deco = function deco(t) {
      var r = _aureliaMetadata.metadata.getOrCreateOwn(_aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
      r.containerless = true;
    };

    return target ? deco(target) : deco;
  }

  function useViewStrategy(strategy) {
    return function (target) {
      _aureliaMetadata.metadata.define(ViewLocator.viewStrategyMetadataKey, strategy, target);
    };
  }

  function useView(path) {
    return useViewStrategy(new RelativeViewStrategy(path));
  }

  function inlineView(markup, dependencies, dependencyBaseUrl) {
    return useViewStrategy(new InlineViewStrategy(markup, dependencies, dependencyBaseUrl));
  }

  function noView(targetOrDependencies, dependencyBaseUrl) {
    var target = void 0;
    var dependencies = void 0;
    if (typeof targetOrDependencies === 'function') {
      target = targetOrDependencies;
    } else {
      dependencies = targetOrDependencies;
      target = undefined;
    }

    var deco = function deco(t) {
      _aureliaMetadata.metadata.define(ViewLocator.viewStrategyMetadataKey, new NoViewStrategy(dependencies, dependencyBaseUrl), t);
    };

    return target ? deco(target) : deco;
  }

  function elementConfig(target) {
    var deco = function deco(t) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ElementConfigResource(), t);
    };

    return target ? deco(target) : deco;
  }

  function viewResources() {
    return function (target) {
      _aureliaMetadata.metadata.define(ViewEngine.viewModelRequireMetadataKey, resources, target);
    };
  }

  var TemplatingEngine = exports.TemplatingEngine = (_dec11 = (0, _aureliaDependencyInjection.inject)(_aureliaDependencyInjection.Container, ModuleAnalyzer, ViewCompiler, CompositionEngine), _dec11(_class23 = function () {
    function TemplatingEngine(container, moduleAnalyzer, viewCompiler, compositionEngine) {
      

      this._container = container;
      this._moduleAnalyzer = moduleAnalyzer;
      this._viewCompiler = viewCompiler;
      this._compositionEngine = compositionEngine;
      container.registerInstance(Animator, Animator.instance = new Animator());
    }

    TemplatingEngine.prototype.configureAnimator = function configureAnimator(animator) {
      this._container.unregister(Animator);
      this._container.registerInstance(Animator, Animator.instance = animator);
    };

    TemplatingEngine.prototype.compose = function compose(context) {
      return this._compositionEngine.compose(context);
    };

    TemplatingEngine.prototype.enhance = function enhance(instruction) {
      if (instruction instanceof _aureliaPal.DOM.Element) {
        instruction = { element: instruction };
      }

      var compilerInstructions = {};
      var resources = instruction.resources || this._container.get(ViewResources);

      this._viewCompiler._compileNode(instruction.element, resources, compilerInstructions, instruction.element.parentNode, 'root', true);

      var factory = new ViewFactory(instruction.element, compilerInstructions, resources);
      var container = instruction.container || this._container.createChild();
      var view = factory.create(container, BehaviorInstruction.enhance());

      view.bind(instruction.bindingContext || {}, instruction.overrideContext);

      return view;
    };

    return TemplatingEngine;
  }()) || _class23);
});
define('aurelia-fetch-client',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.json = json;

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  

  function json(body) {
    return new Blob([JSON.stringify(body)], { type: 'application/json' });
  }

  var HttpClientConfiguration = exports.HttpClientConfiguration = function () {
    function HttpClientConfiguration() {
      

      this.baseUrl = '';
      this.defaults = {};
      this.interceptors = [];
    }

    HttpClientConfiguration.prototype.withBaseUrl = function withBaseUrl(baseUrl) {
      this.baseUrl = baseUrl;
      return this;
    };

    HttpClientConfiguration.prototype.withDefaults = function withDefaults(defaults) {
      this.defaults = defaults;
      return this;
    };

    HttpClientConfiguration.prototype.withInterceptor = function withInterceptor(interceptor) {
      this.interceptors.push(interceptor);
      return this;
    };

    HttpClientConfiguration.prototype.useStandardConfiguration = function useStandardConfiguration() {
      var standardConfig = { credentials: 'same-origin' };
      Object.assign(this.defaults, standardConfig, this.defaults);
      return this.rejectErrorResponses();
    };

    HttpClientConfiguration.prototype.rejectErrorResponses = function rejectErrorResponses() {
      return this.withInterceptor({ response: rejectOnError });
    };

    return HttpClientConfiguration;
  }();

  function rejectOnError(response) {
    if (!response.ok) {
      throw response;
    }

    return response;
  }

  var HttpClient = exports.HttpClient = function () {
    function HttpClient() {
      

      this.activeRequestCount = 0;
      this.isRequesting = false;
      this.isConfigured = false;
      this.baseUrl = '';
      this.defaults = null;
      this.interceptors = [];

      if (typeof fetch === 'undefined') {
        throw new Error('HttpClient requires a Fetch API implementation, but the current environment doesn\'t support it. You may need to load a polyfill such as https://github.com/github/fetch.');
      }
    }

    HttpClient.prototype.configure = function configure(config) {
      var _interceptors;

      var normalizedConfig = void 0;

      if ((typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object') {
        normalizedConfig = { defaults: config };
      } else if (typeof config === 'function') {
        normalizedConfig = new HttpClientConfiguration();
        var c = config(normalizedConfig);
        if (HttpClientConfiguration.prototype.isPrototypeOf(c)) {
          normalizedConfig = c;
        }
      } else {
        throw new Error('invalid config');
      }

      var defaults = normalizedConfig.defaults;
      if (defaults && Headers.prototype.isPrototypeOf(defaults.headers)) {
        throw new Error('Default headers must be a plain object.');
      }

      this.baseUrl = normalizedConfig.baseUrl;
      this.defaults = defaults;
      (_interceptors = this.interceptors).push.apply(_interceptors, normalizedConfig.interceptors || []);
      this.isConfigured = true;

      return this;
    };

    HttpClient.prototype.fetch = function (_fetch) {
      function fetch(_x, _x2) {
        return _fetch.apply(this, arguments);
      }

      fetch.toString = function () {
        return _fetch.toString();
      };

      return fetch;
    }(function (input, init) {
      var _this = this;

      trackRequestStart.call(this);

      var request = Promise.resolve().then(function () {
        return buildRequest.call(_this, input, init, _this.defaults);
      });
      var promise = processRequest(request, this.interceptors).then(function (result) {
        var response = null;

        if (Response.prototype.isPrototypeOf(result)) {
          response = result;
        } else if (Request.prototype.isPrototypeOf(result)) {
          request = Promise.resolve(result);
          response = fetch(result);
        } else {
          throw new Error('An invalid result was returned by the interceptor chain. Expected a Request or Response instance, but got [' + result + ']');
        }

        return request.then(function (_request) {
          return processResponse(response, _this.interceptors, _request);
        });
      });

      return trackRequestEndWith.call(this, promise);
    });

    return HttpClient;
  }();

  var absoluteUrlRegexp = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

  function trackRequestStart() {
    this.isRequesting = !! ++this.activeRequestCount;
  }

  function trackRequestEnd() {
    this.isRequesting = !! --this.activeRequestCount;
  }

  function trackRequestEndWith(promise) {
    var handle = trackRequestEnd.bind(this);
    promise.then(handle, handle);
    return promise;
  }

  function parseHeaderValues(headers) {
    var parsedHeaders = {};
    for (var name in headers || {}) {
      if (headers.hasOwnProperty(name)) {
        parsedHeaders[name] = typeof headers[name] === 'function' ? headers[name]() : headers[name];
      }
    }
    return parsedHeaders;
  }

  function buildRequest(input, init) {
    var defaults = this.defaults || {};
    var request = void 0;
    var body = void 0;
    var requestContentType = void 0;

    var parsedDefaultHeaders = parseHeaderValues(defaults.headers);
    if (Request.prototype.isPrototypeOf(input)) {
      request = input;
      requestContentType = new Headers(request.headers).get('Content-Type');
    } else {
      init || (init = {});
      body = init.body;
      var bodyObj = body ? { body: body } : null;
      var requestInit = Object.assign({}, defaults, { headers: {} }, init, bodyObj);
      requestContentType = new Headers(requestInit.headers).get('Content-Type');
      request = new Request(getRequestUrl(this.baseUrl, input), requestInit);
    }
    if (!requestContentType && new Headers(parsedDefaultHeaders).has('content-type')) {
      request.headers.set('Content-Type', new Headers(parsedDefaultHeaders).get('content-type'));
    }
    setDefaultHeaders(request.headers, parsedDefaultHeaders);
    if (body && Blob.prototype.isPrototypeOf(body) && body.type) {
      request.headers.set('Content-Type', body.type);
    }
    return request;
  }

  function getRequestUrl(baseUrl, url) {
    if (absoluteUrlRegexp.test(url)) {
      return url;
    }

    return (baseUrl || '') + url;
  }

  function setDefaultHeaders(headers, defaultHeaders) {
    for (var name in defaultHeaders || {}) {
      if (defaultHeaders.hasOwnProperty(name) && !headers.has(name)) {
        headers.set(name, defaultHeaders[name]);
      }
    }
  }

  function processRequest(request, interceptors) {
    return applyInterceptors(request, interceptors, 'request', 'requestError');
  }

  function processResponse(response, interceptors, request) {
    return applyInterceptors(response, interceptors, 'response', 'responseError', request);
  }

  function applyInterceptors(input, interceptors, successName, errorName) {
    for (var _len = arguments.length, interceptorArgs = Array(_len > 4 ? _len - 4 : 0), _key = 4; _key < _len; _key++) {
      interceptorArgs[_key - 4] = arguments[_key];
    }

    return (interceptors || []).reduce(function (chain, interceptor) {
      var successHandler = interceptor[successName];
      var errorHandler = interceptor[errorName];

      return chain.then(successHandler && function (value) {
        return successHandler.call.apply(successHandler, [interceptor, value].concat(interceptorArgs));
      } || identity, errorHandler && function (reason) {
        return errorHandler.call.apply(errorHandler, [interceptor, reason].concat(interceptorArgs));
      } || thrower);
    }, Promise.resolve(input));
  }

  function identity(x) {
    return x;
  }

  function thrower(x) {
    throw x;
  }
});
define('aurelia-templating-binding',['exports', 'aurelia-logging', 'aurelia-binding', 'aurelia-templating'], function (exports, _aureliaLogging, _aureliaBinding, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.TemplatingBindingLanguage = exports.SyntaxInterpreter = exports.ChildInterpolationBinding = exports.InterpolationBinding = exports.InterpolationBindingExpression = exports.AttributeMap = undefined;
  exports.configure = configure;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  

  var _class, _temp, _dec, _class2, _class3, _temp2, _class4, _temp3;

  var AttributeMap = exports.AttributeMap = (_temp = _class = function () {
    function AttributeMap(svg) {
      

      this.elements = Object.create(null);
      this.allElements = Object.create(null);

      this.svg = svg;

      this.registerUniversal('accesskey', 'accessKey');
      this.registerUniversal('contenteditable', 'contentEditable');
      this.registerUniversal('tabindex', 'tabIndex');
      this.registerUniversal('textcontent', 'textContent');
      this.registerUniversal('innerhtml', 'innerHTML');
      this.registerUniversal('scrolltop', 'scrollTop');
      this.registerUniversal('scrollleft', 'scrollLeft');
      this.registerUniversal('readonly', 'readOnly');

      this.register('label', 'for', 'htmlFor');

      this.register('input', 'maxlength', 'maxLength');
      this.register('input', 'minlength', 'minLength');
      this.register('input', 'formaction', 'formAction');
      this.register('input', 'formenctype', 'formEncType');
      this.register('input', 'formmethod', 'formMethod');
      this.register('input', 'formnovalidate', 'formNoValidate');
      this.register('input', 'formtarget', 'formTarget');

      this.register('textarea', 'maxlength', 'maxLength');

      this.register('td', 'rowspan', 'rowSpan');
      this.register('td', 'colspan', 'colSpan');
      this.register('th', 'rowspan', 'rowSpan');
      this.register('th', 'colspan', 'colSpan');
    }

    AttributeMap.prototype.register = function register(elementName, attributeName, propertyName) {
      elementName = elementName.toLowerCase();
      attributeName = attributeName.toLowerCase();
      var element = this.elements[elementName] = this.elements[elementName] || Object.create(null);
      element[attributeName] = propertyName;
    };

    AttributeMap.prototype.registerUniversal = function registerUniversal(attributeName, propertyName) {
      attributeName = attributeName.toLowerCase();
      this.allElements[attributeName] = propertyName;
    };

    AttributeMap.prototype.map = function map(elementName, attributeName) {
      if (this.svg.isStandardSvgAttribute(elementName, attributeName)) {
        return attributeName;
      }
      elementName = elementName.toLowerCase();
      attributeName = attributeName.toLowerCase();
      var element = this.elements[elementName];
      if (element !== undefined && attributeName in element) {
        return element[attributeName];
      }
      if (attributeName in this.allElements) {
        return this.allElements[attributeName];
      }

      if (/(^data-)|(^aria-)|:/.test(attributeName)) {
        return attributeName;
      }
      return (0, _aureliaBinding.camelCase)(attributeName);
    };

    return AttributeMap;
  }(), _class.inject = [_aureliaBinding.SVGAnalyzer], _temp);

  var InterpolationBindingExpression = exports.InterpolationBindingExpression = function () {
    function InterpolationBindingExpression(observerLocator, targetProperty, parts, mode, lookupFunctions, attribute) {
      

      this.observerLocator = observerLocator;
      this.targetProperty = targetProperty;
      this.parts = parts;
      this.mode = mode;
      this.lookupFunctions = lookupFunctions;
      this.attribute = this.attrToRemove = attribute;
      this.discrete = false;
    }

    InterpolationBindingExpression.prototype.createBinding = function createBinding(target) {
      if (this.parts.length === 3) {
        return new ChildInterpolationBinding(target, this.observerLocator, this.parts[1], this.mode, this.lookupFunctions, this.targetProperty, this.parts[0], this.parts[2]);
      }
      return new InterpolationBinding(this.observerLocator, this.parts, target, this.targetProperty, this.mode, this.lookupFunctions);
    };

    return InterpolationBindingExpression;
  }();

  function validateTarget(target, propertyName) {
    if (propertyName === 'style') {
      LogManager.getLogger('templating-binding').info('Internet Explorer does not support interpolation in "style" attributes.  Use the style attribute\'s alias, "css" instead.');
    } else if (target.parentElement && target.parentElement.nodeName === 'TEXTAREA' && propertyName === 'textContent') {
      throw new Error('Interpolation binding cannot be used in the content of a textarea element.  Use <textarea value.bind="expression"></textarea> instead.');
    }
  }

  var InterpolationBinding = exports.InterpolationBinding = function () {
    function InterpolationBinding(observerLocator, parts, target, targetProperty, mode, lookupFunctions) {
      

      validateTarget(target, targetProperty);
      this.observerLocator = observerLocator;
      this.parts = parts;
      this.target = target;
      this.targetProperty = targetProperty;
      this.targetAccessor = observerLocator.getAccessor(target, targetProperty);
      this.mode = mode;
      this.lookupFunctions = lookupFunctions;
    }

    InterpolationBinding.prototype.interpolate = function interpolate() {
      if (this.isBound) {
        var value = '';
        var parts = this.parts;
        for (var i = 0, ii = parts.length; i < ii; i++) {
          value += i % 2 === 0 ? parts[i] : this['childBinding' + i].value;
        }
        this.targetAccessor.setValue(value, this.target, this.targetProperty);
      }
    };

    InterpolationBinding.prototype.updateOneTimeBindings = function updateOneTimeBindings() {
      for (var i = 1, ii = this.parts.length; i < ii; i += 2) {
        var child = this['childBinding' + i];
        if (child.mode === _aureliaBinding.bindingMode.oneTime) {
          child.call();
        }
      }
    };

    InterpolationBinding.prototype.bind = function bind(source) {
      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.source = source;

      var parts = this.parts;
      for (var i = 1, ii = parts.length; i < ii; i += 2) {
        var binding = new ChildInterpolationBinding(this, this.observerLocator, parts[i], this.mode, this.lookupFunctions);
        binding.bind(source);
        this['childBinding' + i] = binding;
      }

      this.isBound = true;
      this.interpolate();
    };

    InterpolationBinding.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      this.source = null;
      var parts = this.parts;
      for (var i = 1, ii = parts.length; i < ii; i += 2) {
        var name = 'childBinding' + i;
        this[name].unbind();
      }
    };

    return InterpolationBinding;
  }();

  var ChildInterpolationBinding = exports.ChildInterpolationBinding = (_dec = (0, _aureliaBinding.connectable)(), _dec(_class2 = function () {
    function ChildInterpolationBinding(target, observerLocator, sourceExpression, mode, lookupFunctions, targetProperty, left, right) {
      

      if (target instanceof InterpolationBinding) {
        this.parent = target;
      } else {
        validateTarget(target, targetProperty);
        this.target = target;
        this.targetProperty = targetProperty;
        this.targetAccessor = observerLocator.getAccessor(target, targetProperty);
      }
      this.observerLocator = observerLocator;
      this.sourceExpression = sourceExpression;
      this.mode = mode;
      this.lookupFunctions = lookupFunctions;
      this.left = left;
      this.right = right;
    }

    ChildInterpolationBinding.prototype.updateTarget = function updateTarget(value) {
      value = value === null || value === undefined ? '' : value.toString();
      if (value !== this.value) {
        this.value = value;
        if (this.parent) {
          this.parent.interpolate();
        } else {
          this.targetAccessor.setValue(this.left + value + this.right, this.target, this.targetProperty);
        }
      }
    };

    ChildInterpolationBinding.prototype.call = function call() {
      if (!this.isBound) {
        return;
      }

      this.rawValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
      this.updateTarget(this.rawValue);

      if (this.mode !== _aureliaBinding.bindingMode.oneTime) {
        this._version++;
        this.sourceExpression.connect(this, this.source);
        if (this.rawValue instanceof Array) {
          this.observeArray(this.rawValue);
        }
        this.unobserve(false);
      }
    };

    ChildInterpolationBinding.prototype.bind = function bind(source) {
      if (this.isBound) {
        if (this.source === source) {
          return;
        }
        this.unbind();
      }
      this.isBound = true;
      this.source = source;

      var sourceExpression = this.sourceExpression;
      if (sourceExpression.bind) {
        sourceExpression.bind(this, source, this.lookupFunctions);
      }

      this.rawValue = sourceExpression.evaluate(source, this.lookupFunctions);
      this.updateTarget(this.rawValue);

      if (this.mode === _aureliaBinding.bindingMode.oneWay) {
        (0, _aureliaBinding.enqueueBindingConnect)(this);
      }
    };

    ChildInterpolationBinding.prototype.unbind = function unbind() {
      if (!this.isBound) {
        return;
      }
      this.isBound = false;
      var sourceExpression = this.sourceExpression;
      if (sourceExpression.unbind) {
        sourceExpression.unbind(this, this.source);
      }
      this.source = null;
      this.value = null;
      this.rawValue = null;
      this.unobserve(true);
    };

    ChildInterpolationBinding.prototype.connect = function connect(evaluate) {
      if (!this.isBound) {
        return;
      }
      if (evaluate) {
        this.rawValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
        this.updateTarget(this.rawValue);
      }
      this.sourceExpression.connect(this, this.source);
      if (this.rawValue instanceof Array) {
        this.observeArray(this.rawValue);
      }
    };

    return ChildInterpolationBinding;
  }()) || _class2);
  var SyntaxInterpreter = exports.SyntaxInterpreter = (_temp2 = _class3 = function () {
    function SyntaxInterpreter(parser, observerLocator, eventManager, attributeMap) {
      

      this.parser = parser;
      this.observerLocator = observerLocator;
      this.eventManager = eventManager;
      this.attributeMap = attributeMap;
    }

    SyntaxInterpreter.prototype.interpret = function interpret(resources, element, info, existingInstruction, context) {
      if (info.command in this) {
        return this[info.command](resources, element, info, existingInstruction, context);
      }

      return this.handleUnknownCommand(resources, element, info, existingInstruction, context);
    };

    SyntaxInterpreter.prototype.handleUnknownCommand = function handleUnknownCommand(resources, element, info, existingInstruction, context) {
      LogManager.getLogger('templating-binding').warn('Unknown binding command.', info);
      return existingInstruction;
    };

    SyntaxInterpreter.prototype.determineDefaultBindingMode = function determineDefaultBindingMode(element, attrName, context) {
      var tagName = element.tagName.toLowerCase();

      if (tagName === 'input' && (attrName === 'value' || attrName === 'files') && element.type !== 'checkbox' && element.type !== 'radio' || tagName === 'input' && attrName === 'checked' && (element.type === 'checkbox' || element.type === 'radio') || (tagName === 'textarea' || tagName === 'select') && attrName === 'value' || (attrName === 'textcontent' || attrName === 'innerhtml') && element.contentEditable === 'true' || attrName === 'scrolltop' || attrName === 'scrollleft') {
        return _aureliaBinding.bindingMode.twoWay;
      }

      if (context && attrName in context.attributes && context.attributes[attrName] && context.attributes[attrName].defaultBindingMode >= _aureliaBinding.bindingMode.oneTime) {
        return context.attributes[attrName].defaultBindingMode;
      }

      return _aureliaBinding.bindingMode.oneWay;
    };

    SyntaxInterpreter.prototype.bind = function bind(resources, element, info, existingInstruction, context) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      instruction.attributes[info.attrName] = new _aureliaBinding.BindingExpression(this.observerLocator, this.attributeMap.map(element.tagName, info.attrName), this.parser.parse(info.attrValue), info.defaultBindingMode || this.determineDefaultBindingMode(element, info.attrName, context), resources.lookupFunctions);

      return instruction;
    };

    SyntaxInterpreter.prototype.trigger = function trigger(resources, element, info) {
      return new _aureliaBinding.ListenerExpression(this.eventManager, info.attrName, this.parser.parse(info.attrValue), false, true, resources.lookupFunctions);
    };

    SyntaxInterpreter.prototype.delegate = function delegate(resources, element, info) {
      return new _aureliaBinding.ListenerExpression(this.eventManager, info.attrName, this.parser.parse(info.attrValue), true, true, resources.lookupFunctions);
    };

    SyntaxInterpreter.prototype.call = function call(resources, element, info, existingInstruction) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      instruction.attributes[info.attrName] = new _aureliaBinding.CallExpression(this.observerLocator, info.attrName, this.parser.parse(info.attrValue), resources.lookupFunctions);

      return instruction;
    };

    SyntaxInterpreter.prototype.options = function options(resources, element, info, existingInstruction, context) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);
      var attrValue = info.attrValue;
      var language = this.language;
      var name = null;
      var target = '';
      var current = void 0;
      var i = void 0;
      var ii = void 0;
      var inString = false;
      var inEscape = false;

      for (i = 0, ii = attrValue.length; i < ii; ++i) {
        current = attrValue[i];

        if (current === ';' && !inString) {
          info = language.inspectAttribute(resources, '?', name, target.trim());
          language.createAttributeInstruction(resources, element, info, instruction, context);

          if (!instruction.attributes[info.attrName]) {
            instruction.attributes[info.attrName] = info.attrValue;
          }

          target = '';
          name = null;
        } else if (current === ':' && name === null) {
          name = target.trim();
          target = '';
        } else if (current === '\\') {
          target += current;
          inEscape = true;
          continue;
        } else {
          target += current;

          if (name !== null && inEscape === false && current === '\'') {
            inString = !inString;
          }
        }

        inEscape = false;
      }

      if (name !== null) {
        info = language.inspectAttribute(resources, '?', name, target.trim());
        language.createAttributeInstruction(resources, element, info, instruction, context);

        if (!instruction.attributes[info.attrName]) {
          instruction.attributes[info.attrName] = info.attrValue;
        }
      }

      return instruction;
    };

    SyntaxInterpreter.prototype['for'] = function _for(resources, element, info, existingInstruction) {
      var parts = void 0;
      var keyValue = void 0;
      var instruction = void 0;
      var attrValue = void 0;
      var isDestructuring = void 0;

      attrValue = info.attrValue;
      isDestructuring = attrValue.match(/^ *[[].+[\]]/);
      parts = isDestructuring ? attrValue.split('of ') : attrValue.split(' of ');

      if (parts.length !== 2) {
        throw new Error('Incorrect syntax for "for". The form is: "$local of $items" or "[$key, $value] of $items".');
      }

      instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      if (isDestructuring) {
        keyValue = parts[0].replace(/[[\]]/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
        instruction.attributes.key = keyValue[0];
        instruction.attributes.value = keyValue[1];
      } else {
        instruction.attributes.local = parts[0];
      }

      instruction.attributes.items = new _aureliaBinding.BindingExpression(this.observerLocator, 'items', this.parser.parse(parts[1]), _aureliaBinding.bindingMode.oneWay, resources.lookupFunctions);

      return instruction;
    };

    SyntaxInterpreter.prototype['two-way'] = function twoWay(resources, element, info, existingInstruction) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      instruction.attributes[info.attrName] = new _aureliaBinding.BindingExpression(this.observerLocator, this.attributeMap.map(element.tagName, info.attrName), this.parser.parse(info.attrValue), _aureliaBinding.bindingMode.twoWay, resources.lookupFunctions);

      return instruction;
    };

    SyntaxInterpreter.prototype['one-way'] = function oneWay(resources, element, info, existingInstruction) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      instruction.attributes[info.attrName] = new _aureliaBinding.BindingExpression(this.observerLocator, this.attributeMap.map(element.tagName, info.attrName), this.parser.parse(info.attrValue), _aureliaBinding.bindingMode.oneWay, resources.lookupFunctions);

      return instruction;
    };

    SyntaxInterpreter.prototype['one-time'] = function oneTime(resources, element, info, existingInstruction) {
      var instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(info.attrName);

      instruction.attributes[info.attrName] = new _aureliaBinding.BindingExpression(this.observerLocator, this.attributeMap.map(element.tagName, info.attrName), this.parser.parse(info.attrValue), _aureliaBinding.bindingMode.oneTime, resources.lookupFunctions);

      return instruction;
    };

    return SyntaxInterpreter;
  }(), _class3.inject = [_aureliaBinding.Parser, _aureliaBinding.ObserverLocator, _aureliaBinding.EventManager, AttributeMap], _temp2);

  var info = {};

  var TemplatingBindingLanguage = exports.TemplatingBindingLanguage = (_temp3 = _class4 = function (_BindingLanguage) {
    _inherits(TemplatingBindingLanguage, _BindingLanguage);

    function TemplatingBindingLanguage(parser, observerLocator, syntaxInterpreter, attributeMap) {
      

      var _this = _possibleConstructorReturn(this, _BindingLanguage.call(this));

      _this.parser = parser;
      _this.observerLocator = observerLocator;
      _this.syntaxInterpreter = syntaxInterpreter;
      _this.emptyStringExpression = _this.parser.parse('\'\'');
      syntaxInterpreter.language = _this;
      _this.attributeMap = attributeMap;
      return _this;
    }

    TemplatingBindingLanguage.prototype.inspectAttribute = function inspectAttribute(resources, elementName, attrName, attrValue) {
      var parts = attrName.split('.');

      info.defaultBindingMode = null;

      if (parts.length === 2) {
        info.attrName = parts[0].trim();
        info.attrValue = attrValue;
        info.command = parts[1].trim();

        if (info.command === 'ref') {
          info.expression = new _aureliaBinding.NameExpression(this.parser.parse(attrValue), info.attrName, resources.lookupFunctions);
          info.command = null;
          info.attrName = 'ref';
        } else {
          info.expression = null;
        }
      } else if (attrName === 'ref') {
        info.attrName = attrName;
        info.attrValue = attrValue;
        info.command = null;
        info.expression = new _aureliaBinding.NameExpression(this.parser.parse(attrValue), 'element', resources.lookupFunctions);
      } else {
        info.attrName = attrName;
        info.attrValue = attrValue;
        info.command = null;
        var interpolationParts = this.parseInterpolation(resources, attrValue);
        if (interpolationParts === null) {
          info.expression = null;
        } else {
          info.expression = new InterpolationBindingExpression(this.observerLocator, this.attributeMap.map(elementName, attrName), interpolationParts, _aureliaBinding.bindingMode.oneWay, resources.lookupFunctions, attrName);
        }
      }

      return info;
    };

    TemplatingBindingLanguage.prototype.createAttributeInstruction = function createAttributeInstruction(resources, element, theInfo, existingInstruction, context) {
      var instruction = void 0;

      if (theInfo.expression) {
        if (theInfo.attrName === 'ref') {
          return theInfo.expression;
        }

        instruction = existingInstruction || _aureliaTemplating.BehaviorInstruction.attribute(theInfo.attrName);
        instruction.attributes[theInfo.attrName] = theInfo.expression;
      } else if (theInfo.command) {
        instruction = this.syntaxInterpreter.interpret(resources, element, theInfo, existingInstruction, context);
      }

      return instruction;
    };

    TemplatingBindingLanguage.prototype.inspectTextContent = function inspectTextContent(resources, value) {
      var parts = this.parseInterpolation(resources, value);
      if (parts === null) {
        return null;
      }
      return new InterpolationBindingExpression(this.observerLocator, 'textContent', parts, _aureliaBinding.bindingMode.oneWay, resources.lookupFunctions, 'textContent');
    };

    TemplatingBindingLanguage.prototype.parseInterpolation = function parseInterpolation(resources, value) {
      var i = value.indexOf('${', 0);
      var ii = value.length;
      var char = void 0;
      var pos = 0;
      var open = 0;
      var quote = null;
      var interpolationStart = void 0;
      var parts = void 0;
      var partIndex = 0;

      while (i >= 0 && i < ii - 2) {
        open = 1;
        interpolationStart = i;
        i += 2;

        do {
          char = value[i];
          i++;

          if (char === "'" || char === '"') {
            if (quote === null) {
              quote = char;
            } else if (quote === char) {
              quote = null;
            }
            continue;
          }

          if (char === '\\') {
            i++;
            continue;
          }

          if (quote !== null) {
            continue;
          }

          if (char === '{') {
            open++;
          } else if (char === '}') {
            open--;
          }
        } while (open > 0 && i < ii);

        if (open === 0) {
          parts = parts || [];
          if (value[interpolationStart - 1] === '\\' && value[interpolationStart - 2] !== '\\') {
            parts[partIndex] = value.substring(pos, interpolationStart - 1) + value.substring(interpolationStart, i);
            partIndex++;
            parts[partIndex] = this.emptyStringExpression;
            partIndex++;
          } else {
            parts[partIndex] = value.substring(pos, interpolationStart);
            partIndex++;
            parts[partIndex] = this.parser.parse(value.substring(interpolationStart + 2, i - 1));
            partIndex++;
          }
          pos = i;
          i = value.indexOf('${', i);
        } else {
          break;
        }
      }

      if (partIndex === 0) {
        return null;
      }

      parts[partIndex] = value.substr(pos);
      return parts;
    };

    return TemplatingBindingLanguage;
  }(_aureliaTemplating.BindingLanguage), _class4.inject = [_aureliaBinding.Parser, _aureliaBinding.ObserverLocator, SyntaxInterpreter, AttributeMap], _temp3);
  function configure(config) {
    config.container.registerSingleton(_aureliaTemplating.BindingLanguage, TemplatingBindingLanguage);
    config.container.registerAlias(_aureliaTemplating.BindingLanguage, TemplatingBindingLanguage);
  }
});
define('aurelia-templating-resources/aurelia-templating-resources',['exports', './compose', './if', './with', './repeat', './show', './hide', './sanitize-html', './replaceable', './focus', 'aurelia-templating', './css-resource', './html-sanitizer', './binding-mode-behaviors', './throttle-binding-behavior', './debounce-binding-behavior', './signal-binding-behavior', './binding-signaler', './update-trigger-binding-behavior', './abstract-repeater', './repeat-strategy-locator', './html-resource-plugin', './null-repeat-strategy', './array-repeat-strategy', './map-repeat-strategy', './set-repeat-strategy', './number-repeat-strategy', './repeat-utilities', './analyze-view-factory', './aurelia-hide-style'], function (exports, _compose, _if, _with, _repeat, _show, _hide, _sanitizeHtml, _replaceable, _focus, _aureliaTemplating, _cssResource, _htmlSanitizer, _bindingModeBehaviors, _throttleBindingBehavior, _debounceBindingBehavior, _signalBindingBehavior, _bindingSignaler, _updateTriggerBindingBehavior, _abstractRepeater, _repeatStrategyLocator, _htmlResourcePlugin, _nullRepeatStrategy, _arrayRepeatStrategy, _mapRepeatStrategy, _setRepeatStrategy, _numberRepeatStrategy, _repeatUtilities, _analyzeViewFactory, _aureliaHideStyle) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.viewsRequireLifecycle = exports.unwrapExpression = exports.updateOneTimeBinding = exports.isOneTime = exports.getItemsSourceExpression = exports.updateOverrideContext = exports.createFullOverrideContext = exports.NumberRepeatStrategy = exports.SetRepeatStrategy = exports.MapRepeatStrategy = exports.ArrayRepeatStrategy = exports.NullRepeatStrategy = exports.RepeatStrategyLocator = exports.AbstractRepeater = exports.UpdateTriggerBindingBehavior = exports.BindingSignaler = exports.SignalBindingBehavior = exports.DebounceBindingBehavior = exports.ThrottleBindingBehavior = exports.TwoWayBindingBehavior = exports.OneWayBindingBehavior = exports.OneTimeBindingBehavior = exports.configure = exports.Focus = exports.Replaceable = exports.SanitizeHTMLValueConverter = exports.HTMLSanitizer = exports.Hide = exports.Show = exports.Repeat = exports.With = exports.If = exports.Compose = undefined;


  function configure(config) {
    (0, _aureliaHideStyle.injectAureliaHideStyleAtHead)();

    config.globalResources('./compose', './if', './with', './repeat', './show', './hide', './replaceable', './sanitize-html', './focus', './binding-mode-behaviors', './throttle-binding-behavior', './debounce-binding-behavior', './signal-binding-behavior', './update-trigger-binding-behavior');

    (0, _htmlResourcePlugin.configure)(config);

    var viewEngine = config.container.get(_aureliaTemplating.ViewEngine);
    viewEngine.addResourcePlugin('.css', {
      'fetch': function fetch(address) {
        var _ref;

        return _ref = {}, _ref[address] = (0, _cssResource._createCSSResource)(address), _ref;
      }
    });
  }

  exports.Compose = _compose.Compose;
  exports.If = _if.If;
  exports.With = _with.With;
  exports.Repeat = _repeat.Repeat;
  exports.Show = _show.Show;
  exports.Hide = _hide.Hide;
  exports.HTMLSanitizer = _htmlSanitizer.HTMLSanitizer;
  exports.SanitizeHTMLValueConverter = _sanitizeHtml.SanitizeHTMLValueConverter;
  exports.Replaceable = _replaceable.Replaceable;
  exports.Focus = _focus.Focus;
  exports.configure = configure;
  exports.OneTimeBindingBehavior = _bindingModeBehaviors.OneTimeBindingBehavior;
  exports.OneWayBindingBehavior = _bindingModeBehaviors.OneWayBindingBehavior;
  exports.TwoWayBindingBehavior = _bindingModeBehaviors.TwoWayBindingBehavior;
  exports.ThrottleBindingBehavior = _throttleBindingBehavior.ThrottleBindingBehavior;
  exports.DebounceBindingBehavior = _debounceBindingBehavior.DebounceBindingBehavior;
  exports.SignalBindingBehavior = _signalBindingBehavior.SignalBindingBehavior;
  exports.BindingSignaler = _bindingSignaler.BindingSignaler;
  exports.UpdateTriggerBindingBehavior = _updateTriggerBindingBehavior.UpdateTriggerBindingBehavior;
  exports.AbstractRepeater = _abstractRepeater.AbstractRepeater;
  exports.RepeatStrategyLocator = _repeatStrategyLocator.RepeatStrategyLocator;
  exports.NullRepeatStrategy = _nullRepeatStrategy.NullRepeatStrategy;
  exports.ArrayRepeatStrategy = _arrayRepeatStrategy.ArrayRepeatStrategy;
  exports.MapRepeatStrategy = _mapRepeatStrategy.MapRepeatStrategy;
  exports.SetRepeatStrategy = _setRepeatStrategy.SetRepeatStrategy;
  exports.NumberRepeatStrategy = _numberRepeatStrategy.NumberRepeatStrategy;
  exports.createFullOverrideContext = _repeatUtilities.createFullOverrideContext;
  exports.updateOverrideContext = _repeatUtilities.updateOverrideContext;
  exports.getItemsSourceExpression = _repeatUtilities.getItemsSourceExpression;
  exports.isOneTime = _repeatUtilities.isOneTime;
  exports.updateOneTimeBinding = _repeatUtilities.updateOneTimeBinding;
  exports.unwrapExpression = _repeatUtilities.unwrapExpression;
  exports.viewsRequireLifecycle = _analyzeViewFactory.viewsRequireLifecycle;
});;define('aurelia-templating-resources', ['aurelia-templating-resources/aurelia-templating-resources'], function (main) { return main; });

define('aurelia-templating-resources/compose',['exports', 'aurelia-dependency-injection', 'aurelia-task-queue', 'aurelia-templating', 'aurelia-pal'], function (exports, _aureliaDependencyInjection, _aureliaTaskQueue, _aureliaTemplating, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Compose = undefined;

  function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: descriptor.writable,
      value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
  }

  

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  function _initializerWarningHelper(descriptor, context) {
    throw new Error('Decorating class property failed. Please ensure that transform-class-properties is enabled.');
  }

  var _dec, _dec2, _class, _desc, _value, _class2, _descriptor, _descriptor2, _descriptor3;

  var Compose = exports.Compose = (_dec = (0, _aureliaTemplating.customElement)('compose'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaDependencyInjection.Container, _aureliaTemplating.CompositionEngine, _aureliaTemplating.ViewSlot, _aureliaTemplating.ViewResources, _aureliaTaskQueue.TaskQueue), _dec(_class = (0, _aureliaTemplating.noView)(_class = _dec2(_class = (_class2 = function () {
    function Compose(element, container, compositionEngine, viewSlot, viewResources, taskQueue) {
      

      _initDefineProp(this, 'model', _descriptor, this);

      _initDefineProp(this, 'view', _descriptor2, this);

      _initDefineProp(this, 'viewModel', _descriptor3, this);

      this.element = element;
      this.container = container;
      this.compositionEngine = compositionEngine;
      this.viewSlot = viewSlot;
      this.viewResources = viewResources;
      this.taskQueue = taskQueue;
      this.currentController = null;
      this.currentViewModel = null;
    }

    Compose.prototype.created = function created(owningView) {
      this.owningView = owningView;
    };

    Compose.prototype.bind = function bind(bindingContext, overrideContext) {
      this.bindingContext = bindingContext;
      this.overrideContext = overrideContext;
      processInstruction(this, createInstruction(this, {
        view: this.view,
        viewModel: this.viewModel,
        model: this.model
      }));
    };

    Compose.prototype.unbind = function unbind(bindingContext, overrideContext) {
      this.bindingContext = null;
      this.overrideContext = null;
      var returnToCache = true;
      var skipAnimation = true;
      this.viewSlot.removeAll(returnToCache, skipAnimation);
    };

    Compose.prototype.modelChanged = function modelChanged(newValue, oldValue) {
      var _this = this;

      if (this.currentInstruction) {
        this.currentInstruction.model = newValue;
        return;
      }

      this.taskQueue.queueMicroTask(function () {
        if (_this.currentInstruction) {
          _this.currentInstruction.model = newValue;
          return;
        }

        var vm = _this.currentViewModel;

        if (vm && typeof vm.activate === 'function') {
          vm.activate(newValue);
        }
      });
    };

    Compose.prototype.viewChanged = function viewChanged(newValue, oldValue) {
      var _this2 = this;

      var instruction = createInstruction(this, {
        view: newValue,
        viewModel: this.currentViewModel || this.viewModel,
        model: this.model
      });

      if (this.currentInstruction) {
        this.currentInstruction = instruction;
        return;
      }

      this.currentInstruction = instruction;
      this.taskQueue.queueMicroTask(function () {
        return processInstruction(_this2, _this2.currentInstruction);
      });
    };

    Compose.prototype.viewModelChanged = function viewModelChanged(newValue, oldValue) {
      var _this3 = this;

      var instruction = createInstruction(this, {
        viewModel: newValue,
        view: this.view,
        model: this.model
      });

      if (this.currentInstruction) {
        this.currentInstruction = instruction;
        return;
      }

      this.currentInstruction = instruction;
      this.taskQueue.queueMicroTask(function () {
        return processInstruction(_this3, _this3.currentInstruction);
      });
    };

    return Compose;
  }(), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, 'model', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, 'view', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, 'viewModel', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  })), _class2)) || _class) || _class) || _class);


  function createInstruction(composer, instruction) {
    return Object.assign(instruction, {
      bindingContext: composer.bindingContext,
      overrideContext: composer.overrideContext,
      owningView: composer.owningView,
      container: composer.container,
      viewSlot: composer.viewSlot,
      viewResources: composer.viewResources,
      currentController: composer.currentController,
      host: composer.element
    });
  }

  function processInstruction(composer, instruction) {
    composer.currentInstruction = null;
    composer.compositionEngine.compose(instruction).then(function (controller) {
      composer.currentController = controller;
      composer.currentViewModel = controller ? controller.viewModel : null;
    });
  }
});
define('aurelia-templating-resources/if',['exports', 'aurelia-templating', 'aurelia-dependency-injection'], function (exports, _aureliaTemplating, _aureliaDependencyInjection) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.If = undefined;

  

  var _dec, _dec2, _class;

  var If = exports.If = (_dec = (0, _aureliaTemplating.customAttribute)('if'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaTemplating.BoundViewFactory, _aureliaTemplating.ViewSlot), _dec(_class = (0, _aureliaTemplating.templateController)(_class = _dec2(_class = function () {
    function If(viewFactory, viewSlot) {
      

      this.viewFactory = viewFactory;
      this.viewSlot = viewSlot;
      this.showing = false;
      this.view = null;
      this.bindingContext = null;
      this.overrideContext = null;
    }

    If.prototype.bind = function bind(bindingContext, overrideContext) {
      this.bindingContext = bindingContext;
      this.overrideContext = overrideContext;
      this.valueChanged(this.value);
    };

    If.prototype.valueChanged = function valueChanged(newValue) {
      var _this = this;

      if (this.__queuedChanges) {
        this.__queuedChanges.push(newValue);
        return;
      }

      var maybePromise = this._runValueChanged(newValue);
      if (maybePromise instanceof Promise) {
        (function () {
          var queuedChanges = _this.__queuedChanges = [];

          var runQueuedChanges = function runQueuedChanges() {
            if (!queuedChanges.length) {
              _this.__queuedChanges = undefined;
              return;
            }

            var nextPromise = _this._runValueChanged(queuedChanges.shift()) || Promise.resolve();
            nextPromise.then(runQueuedChanges);
          };

          maybePromise.then(runQueuedChanges);
        })();
      }
    };

    If.prototype._runValueChanged = function _runValueChanged(newValue) {
      var _this2 = this;

      if (!newValue) {
        var viewOrPromise = void 0;
        if (this.view !== null && this.showing) {
          viewOrPromise = this.viewSlot.remove(this.view);
          if (viewOrPromise instanceof Promise) {
            viewOrPromise.then(function () {
              return _this2.view.unbind();
            });
          } else {
            this.view.unbind();
          }
        }

        this.showing = false;
        return viewOrPromise;
      }

      if (this.view === null) {
        this.view = this.viewFactory.create();
      }

      if (!this.view.isBound) {
        this.view.bind(this.bindingContext, this.overrideContext);
      }

      if (!this.showing) {
        this.showing = true;
        return this.viewSlot.add(this.view);
      }

      return undefined;
    };

    If.prototype.unbind = function unbind() {
      if (this.view === null) {
        return;
      }

      this.view.unbind();

      if (!this.viewFactory.isCaching) {
        return;
      }

      if (this.showing) {
        this.showing = false;
        this.viewSlot.remove(this.view, true, true);
      }
      this.view.returnToCache();
      this.view = null;
    };

    return If;
  }()) || _class) || _class) || _class);
});
define('aurelia-templating-resources/with',['exports', 'aurelia-dependency-injection', 'aurelia-templating', 'aurelia-binding'], function (exports, _aureliaDependencyInjection, _aureliaTemplating, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.With = undefined;

  

  var _dec, _dec2, _class;

  var With = exports.With = (_dec = (0, _aureliaTemplating.customAttribute)('with'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaTemplating.BoundViewFactory, _aureliaTemplating.ViewSlot), _dec(_class = (0, _aureliaTemplating.templateController)(_class = _dec2(_class = function () {
    function With(viewFactory, viewSlot) {
      

      this.viewFactory = viewFactory;
      this.viewSlot = viewSlot;
      this.parentOverrideContext = null;
      this.view = null;
    }

    With.prototype.bind = function bind(bindingContext, overrideContext) {
      this.parentOverrideContext = overrideContext;
      this.valueChanged(this.value);
    };

    With.prototype.valueChanged = function valueChanged(newValue) {
      var overrideContext = (0, _aureliaBinding.createOverrideContext)(newValue, this.parentOverrideContext);
      if (!this.view) {
        this.view = this.viewFactory.create();
        this.view.bind(newValue, overrideContext);
        this.viewSlot.add(this.view);
      } else {
        this.view.bind(newValue, overrideContext);
      }
    };

    With.prototype.unbind = function unbind() {
      this.parentOverrideContext = null;

      if (this.view) {
        this.view.unbind();
      }
    };

    return With;
  }()) || _class) || _class) || _class);
});
define('aurelia-templating-resources/repeat',['exports', 'aurelia-dependency-injection', 'aurelia-binding', 'aurelia-templating', './repeat-strategy-locator', './repeat-utilities', './analyze-view-factory', './abstract-repeater'], function (exports, _aureliaDependencyInjection, _aureliaBinding, _aureliaTemplating, _repeatStrategyLocator, _repeatUtilities, _analyzeViewFactory, _abstractRepeater) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Repeat = undefined;

  function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: descriptor.writable,
      value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
  }

  

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  function _initializerWarningHelper(descriptor, context) {
    throw new Error('Decorating class property failed. Please ensure that transform-class-properties is enabled.');
  }

  var _dec, _dec2, _class, _desc, _value, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4;

  var Repeat = exports.Repeat = (_dec = (0, _aureliaTemplating.customAttribute)('repeat'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaTemplating.BoundViewFactory, _aureliaTemplating.TargetInstruction, _aureliaTemplating.ViewSlot, _aureliaTemplating.ViewResources, _aureliaBinding.ObserverLocator, _repeatStrategyLocator.RepeatStrategyLocator), _dec(_class = (0, _aureliaTemplating.templateController)(_class = _dec2(_class = (_class2 = function (_AbstractRepeater) {
    _inherits(Repeat, _AbstractRepeater);

    function Repeat(viewFactory, instruction, viewSlot, viewResources, observerLocator, strategyLocator) {
      

      var _this = _possibleConstructorReturn(this, _AbstractRepeater.call(this, {
        local: 'item',
        viewsRequireLifecycle: (0, _analyzeViewFactory.viewsRequireLifecycle)(viewFactory)
      }));

      _initDefineProp(_this, 'items', _descriptor, _this);

      _initDefineProp(_this, 'local', _descriptor2, _this);

      _initDefineProp(_this, 'key', _descriptor3, _this);

      _initDefineProp(_this, 'value', _descriptor4, _this);

      _this.viewFactory = viewFactory;
      _this.instruction = instruction;
      _this.viewSlot = viewSlot;
      _this.lookupFunctions = viewResources.lookupFunctions;
      _this.observerLocator = observerLocator;
      _this.key = 'key';
      _this.value = 'value';
      _this.strategyLocator = strategyLocator;
      _this.ignoreMutation = false;
      _this.sourceExpression = (0, _repeatUtilities.getItemsSourceExpression)(_this.instruction, 'repeat.for');
      _this.isOneTime = (0, _repeatUtilities.isOneTime)(_this.sourceExpression);
      _this.viewsRequireLifecycle = (0, _analyzeViewFactory.viewsRequireLifecycle)(viewFactory);
      return _this;
    }

    Repeat.prototype.call = function call(context, changes) {
      this[context](this.items, changes);
    };

    Repeat.prototype.bind = function bind(bindingContext, overrideContext) {
      this.scope = { bindingContext: bindingContext, overrideContext: overrideContext };
      this.matcherBinding = this._captureAndRemoveMatcherBinding();
      this.itemsChanged();
    };

    Repeat.prototype.unbind = function unbind() {
      this.scope = null;
      this.items = null;
      this.matcherBinding = null;
      this.viewSlot.removeAll(true);
      this._unsubscribeCollection();
    };

    Repeat.prototype._unsubscribeCollection = function _unsubscribeCollection() {
      if (this.collectionObserver) {
        this.collectionObserver.unsubscribe(this.callContext, this);
        this.collectionObserver = null;
        this.callContext = null;
      }
    };

    Repeat.prototype.itemsChanged = function itemsChanged() {
      this._unsubscribeCollection();

      if (!this.scope) {
        return;
      }

      var items = this.items;
      this.strategy = this.strategyLocator.getStrategy(items);
      if (!this.strategy) {
        throw new Error('Value for \'' + this.sourceExpression + '\' is non-repeatable');
      }

      if (!this.isOneTime && !this._observeInnerCollection()) {
        this._observeCollection();
      }
      this.strategy.instanceChanged(this, items);
    };

    Repeat.prototype._getInnerCollection = function _getInnerCollection() {
      var expression = (0, _repeatUtilities.unwrapExpression)(this.sourceExpression);
      if (!expression) {
        return null;
      }
      return expression.evaluate(this.scope, null);
    };

    Repeat.prototype.handleCollectionMutated = function handleCollectionMutated(collection, changes) {
      if (!this.collectionObserver) {
        return;
      }
      this.strategy.instanceMutated(this, collection, changes);
    };

    Repeat.prototype.handleInnerCollectionMutated = function handleInnerCollectionMutated(collection, changes) {
      var _this2 = this;

      if (!this.collectionObserver) {
        return;
      }

      if (this.ignoreMutation) {
        return;
      }
      this.ignoreMutation = true;
      var newItems = this.sourceExpression.evaluate(this.scope, this.lookupFunctions);
      this.observerLocator.taskQueue.queueMicroTask(function () {
        return _this2.ignoreMutation = false;
      });

      if (newItems === this.items) {
        this.itemsChanged();
      } else {
        this.items = newItems;
      }
    };

    Repeat.prototype._observeInnerCollection = function _observeInnerCollection() {
      var items = this._getInnerCollection();
      var strategy = this.strategyLocator.getStrategy(items);
      if (!strategy) {
        return false;
      }
      this.collectionObserver = strategy.getCollectionObserver(this.observerLocator, items);
      if (!this.collectionObserver) {
        return false;
      }
      this.callContext = 'handleInnerCollectionMutated';
      this.collectionObserver.subscribe(this.callContext, this);
      return true;
    };

    Repeat.prototype._observeCollection = function _observeCollection() {
      var items = this.items;
      this.collectionObserver = this.strategy.getCollectionObserver(this.observerLocator, items);
      if (this.collectionObserver) {
        this.callContext = 'handleCollectionMutated';
        this.collectionObserver.subscribe(this.callContext, this);
      }
    };

    Repeat.prototype._captureAndRemoveMatcherBinding = function _captureAndRemoveMatcherBinding() {
      if (this.viewFactory.viewFactory) {
        var instructions = this.viewFactory.viewFactory.instructions;
        var instructionIds = Object.keys(instructions);
        for (var i = 0; i < instructionIds.length; i++) {
          var expressions = instructions[instructionIds[i]].expressions;
          if (expressions) {
            for (var ii = 0; i < expressions.length; i++) {
              if (expressions[ii].targetProperty === 'matcher') {
                var matcherBinding = expressions[ii];
                expressions.splice(ii, 1);
                return matcherBinding;
              }
            }
          }
        }
      }

      return undefined;
    };

    Repeat.prototype.viewCount = function viewCount() {
      return this.viewSlot.children.length;
    };

    Repeat.prototype.views = function views() {
      return this.viewSlot.children;
    };

    Repeat.prototype.view = function view(index) {
      return this.viewSlot.children[index];
    };

    Repeat.prototype.matcher = function matcher() {
      return this.matcherBinding ? this.matcherBinding.sourceExpression.evaluate(this.scope, this.matcherBinding.lookupFunctions) : null;
    };

    Repeat.prototype.addView = function addView(bindingContext, overrideContext) {
      var view = this.viewFactory.create();
      view.bind(bindingContext, overrideContext);
      this.viewSlot.add(view);
    };

    Repeat.prototype.insertView = function insertView(index, bindingContext, overrideContext) {
      var view = this.viewFactory.create();
      view.bind(bindingContext, overrideContext);
      this.viewSlot.insert(index, view);
    };

    Repeat.prototype.moveView = function moveView(sourceIndex, targetIndex) {
      this.viewSlot.move(sourceIndex, targetIndex);
    };

    Repeat.prototype.removeAllViews = function removeAllViews(returnToCache, skipAnimation) {
      return this.viewSlot.removeAll(returnToCache, skipAnimation);
    };

    Repeat.prototype.removeViews = function removeViews(viewsToRemove, returnToCache, skipAnimation) {
      return this.viewSlot.removeMany(viewsToRemove, returnToCache, skipAnimation);
    };

    Repeat.prototype.removeView = function removeView(index, returnToCache, skipAnimation) {
      return this.viewSlot.removeAt(index, returnToCache, skipAnimation);
    };

    Repeat.prototype.updateBindings = function updateBindings(view) {
      var j = view.bindings.length;
      while (j--) {
        (0, _repeatUtilities.updateOneTimeBinding)(view.bindings[j]);
      }
      j = view.controllers.length;
      while (j--) {
        var k = view.controllers[j].boundProperties.length;
        while (k--) {
          var binding = view.controllers[j].boundProperties[k].binding;
          (0, _repeatUtilities.updateOneTimeBinding)(binding);
        }
      }
    };

    return Repeat;
  }(_abstractRepeater.AbstractRepeater), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, 'items', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, 'local', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, 'key', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, 'value', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  })), _class2)) || _class) || _class) || _class);
});
define('aurelia-templating-resources/repeat-strategy-locator',['exports', './null-repeat-strategy', './array-repeat-strategy', './map-repeat-strategy', './set-repeat-strategy', './number-repeat-strategy'], function (exports, _nullRepeatStrategy, _arrayRepeatStrategy, _mapRepeatStrategy, _setRepeatStrategy, _numberRepeatStrategy) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.RepeatStrategyLocator = undefined;

  

  var RepeatStrategyLocator = exports.RepeatStrategyLocator = function () {
    function RepeatStrategyLocator() {
      

      this.matchers = [];
      this.strategies = [];

      this.addStrategy(function (items) {
        return items === null || items === undefined;
      }, new _nullRepeatStrategy.NullRepeatStrategy());
      this.addStrategy(function (items) {
        return items instanceof Array;
      }, new _arrayRepeatStrategy.ArrayRepeatStrategy());
      this.addStrategy(function (items) {
        return items instanceof Map;
      }, new _mapRepeatStrategy.MapRepeatStrategy());
      this.addStrategy(function (items) {
        return items instanceof Set;
      }, new _setRepeatStrategy.SetRepeatStrategy());
      this.addStrategy(function (items) {
        return typeof items === 'number';
      }, new _numberRepeatStrategy.NumberRepeatStrategy());
    }

    RepeatStrategyLocator.prototype.addStrategy = function addStrategy(matcher, strategy) {
      this.matchers.push(matcher);
      this.strategies.push(strategy);
    };

    RepeatStrategyLocator.prototype.getStrategy = function getStrategy(items) {
      var matchers = this.matchers;

      for (var i = 0, ii = matchers.length; i < ii; ++i) {
        if (matchers[i](items)) {
          return this.strategies[i];
        }
      }

      return null;
    };

    return RepeatStrategyLocator;
  }();
});
define('aurelia-templating-resources/null-repeat-strategy',["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  var NullRepeatStrategy = exports.NullRepeatStrategy = function () {
    function NullRepeatStrategy() {
      
    }

    NullRepeatStrategy.prototype.instanceChanged = function instanceChanged(repeat, items) {
      repeat.removeAllViews(true);
    };

    NullRepeatStrategy.prototype.getCollectionObserver = function getCollectionObserver(observerLocator, items) {};

    return NullRepeatStrategy;
  }();
});
define('aurelia-templating-resources/array-repeat-strategy',['exports', './repeat-utilities', 'aurelia-binding'], function (exports, _repeatUtilities, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ArrayRepeatStrategy = undefined;

  

  var ArrayRepeatStrategy = exports.ArrayRepeatStrategy = function () {
    function ArrayRepeatStrategy() {
      
    }

    ArrayRepeatStrategy.prototype.getCollectionObserver = function getCollectionObserver(observerLocator, items) {
      return observerLocator.getArrayObserver(items);
    };

    ArrayRepeatStrategy.prototype.instanceChanged = function instanceChanged(repeat, items) {
      var _this = this;

      var itemsLength = items.length;

      if (!items || itemsLength === 0) {
        repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
        return;
      }

      var children = repeat.views();
      var viewsLength = children.length;

      if (viewsLength === 0) {
        this._standardProcessInstanceChanged(repeat, items);
        return;
      }

      if (repeat.viewsRequireLifecycle) {
        (function () {
          var childrenSnapshot = children.slice(0);
          var itemNameInBindingContext = repeat.local;
          var matcher = repeat.matcher();

          var itemsPreviouslyInViews = [];
          var viewsToRemove = [];

          for (var index = 0; index < viewsLength; index++) {
            var view = childrenSnapshot[index];
            var oldItem = view.bindingContext[itemNameInBindingContext];

            if ((0, _repeatUtilities.indexOf)(items, oldItem, matcher) === -1) {
              viewsToRemove.push(view);
            } else {
              itemsPreviouslyInViews.push(oldItem);
            }
          }

          var updateViews = void 0;
          var removePromise = void 0;

          if (itemsPreviouslyInViews.length > 0) {
            removePromise = repeat.removeViews(viewsToRemove, true, !repeat.viewsRequireLifecycle);
            updateViews = function updateViews() {
              for (var _index = 0; _index < itemsLength; _index++) {
                var item = items[_index];
                var indexOfView = (0, _repeatUtilities.indexOf)(itemsPreviouslyInViews, item, matcher, _index);
                var _view = void 0;

                if (indexOfView === -1) {
                  var overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, items[_index], _index, itemsLength);
                  repeat.insertView(_index, overrideContext.bindingContext, overrideContext);

                  itemsPreviouslyInViews.splice(_index, 0, undefined);
                } else if (indexOfView === _index) {
                  _view = children[indexOfView];
                  itemsPreviouslyInViews[indexOfView] = undefined;
                } else {
                  _view = children[indexOfView];
                  repeat.moveView(indexOfView, _index);
                  itemsPreviouslyInViews.splice(indexOfView, 1);
                  itemsPreviouslyInViews.splice(_index, 0, undefined);
                }

                if (_view) {
                  (0, _repeatUtilities.updateOverrideContext)(_view.overrideContext, _index, itemsLength);
                }
              }

              _this._inPlaceProcessItems(repeat, items);
            };
          } else {
            removePromise = repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
            updateViews = function updateViews() {
              return _this._standardProcessInstanceChanged(repeat, items);
            };
          }

          if (removePromise instanceof Promise) {
            removePromise.then(updateViews);
          } else {
            updateViews();
          }
        })();
      } else {
        this._inPlaceProcessItems(repeat, items);
      }
    };

    ArrayRepeatStrategy.prototype._standardProcessInstanceChanged = function _standardProcessInstanceChanged(repeat, items) {
      for (var i = 0, ii = items.length; i < ii; i++) {
        var overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, items[i], i, ii);
        repeat.addView(overrideContext.bindingContext, overrideContext);
      }
    };

    ArrayRepeatStrategy.prototype._inPlaceProcessItems = function _inPlaceProcessItems(repeat, items) {
      var itemsLength = items.length;
      var viewsLength = repeat.viewCount();

      while (viewsLength > itemsLength) {
        viewsLength--;
        repeat.removeView(viewsLength, true, !repeat.viewsRequireLifecycle);
      }

      var local = repeat.local;

      for (var i = 0; i < viewsLength; i++) {
        var view = repeat.view(i);
        var last = i === itemsLength - 1;
        var middle = i !== 0 && !last;

        if (view.bindingContext[local] === items[i] && view.overrideContext.$middle === middle && view.overrideContext.$last === last) {
          continue;
        }

        view.bindingContext[local] = items[i];
        view.overrideContext.$middle = middle;
        view.overrideContext.$last = last;
        repeat.updateBindings(view);
      }

      for (var _i = viewsLength; _i < itemsLength; _i++) {
        var overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, items[_i], _i, itemsLength);
        repeat.addView(overrideContext.bindingContext, overrideContext);
      }
    };

    ArrayRepeatStrategy.prototype.instanceMutated = function instanceMutated(repeat, array, splices) {
      var _this2 = this;

      if (repeat.__queuedSplices) {
        for (var i = 0, ii = splices.length; i < ii; ++i) {
          var _splices$i = splices[i];
          var index = _splices$i.index;
          var removed = _splices$i.removed;
          var addedCount = _splices$i.addedCount;

          (0, _aureliaBinding.mergeSplice)(repeat.__queuedSplices, index, removed, addedCount);
        }

        repeat.__array = array.slice(0);
        return;
      }

      var maybePromise = this._runSplices(repeat, array.slice(0), splices);
      if (maybePromise instanceof Promise) {
        (function () {
          var queuedSplices = repeat.__queuedSplices = [];

          var runQueuedSplices = function runQueuedSplices() {
            if (!queuedSplices.length) {
              repeat.__queuedSplices = undefined;
              repeat.__array = undefined;
              return;
            }

            var nextPromise = _this2._runSplices(repeat, repeat.__array, queuedSplices) || Promise.resolve();
            queuedSplices = repeat.__queuedSplices = [];
            nextPromise.then(runQueuedSplices);
          };

          maybePromise.then(runQueuedSplices);
        })();
      }
    };

    ArrayRepeatStrategy.prototype._runSplices = function _runSplices(repeat, array, splices) {
      var _this3 = this;

      var removeDelta = 0;
      var rmPromises = [];

      for (var i = 0, ii = splices.length; i < ii; ++i) {
        var splice = splices[i];
        var removed = splice.removed;

        for (var j = 0, jj = removed.length; j < jj; ++j) {
          var viewOrPromise = repeat.removeView(splice.index + removeDelta + rmPromises.length, true);
          if (viewOrPromise instanceof Promise) {
            rmPromises.push(viewOrPromise);
          }
        }
        removeDelta -= splice.addedCount;
      }

      if (rmPromises.length > 0) {
        return Promise.all(rmPromises).then(function () {
          var spliceIndexLow = _this3._handleAddedSplices(repeat, array, splices);
          (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), spliceIndexLow);
        });
      }

      var spliceIndexLow = this._handleAddedSplices(repeat, array, splices);
      (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), spliceIndexLow);

      return undefined;
    };

    ArrayRepeatStrategy.prototype._handleAddedSplices = function _handleAddedSplices(repeat, array, splices) {
      var spliceIndex = void 0;
      var spliceIndexLow = void 0;
      var arrayLength = array.length;
      for (var i = 0, ii = splices.length; i < ii; ++i) {
        var splice = splices[i];
        var addIndex = spliceIndex = splice.index;
        var end = splice.index + splice.addedCount;

        if (typeof spliceIndexLow === 'undefined' || spliceIndexLow === null || spliceIndexLow > splice.index) {
          spliceIndexLow = spliceIndex;
        }

        for (; addIndex < end; ++addIndex) {
          var overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, array[addIndex], addIndex, arrayLength);
          repeat.insertView(addIndex, overrideContext.bindingContext, overrideContext);
        }
      }

      return spliceIndexLow;
    };

    return ArrayRepeatStrategy;
  }();
});
define('aurelia-templating-resources/repeat-utilities',['exports', 'aurelia-binding'], function (exports, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.updateOverrideContexts = updateOverrideContexts;
  exports.createFullOverrideContext = createFullOverrideContext;
  exports.updateOverrideContext = updateOverrideContext;
  exports.getItemsSourceExpression = getItemsSourceExpression;
  exports.unwrapExpression = unwrapExpression;
  exports.isOneTime = isOneTime;
  exports.updateOneTimeBinding = updateOneTimeBinding;
  exports.indexOf = indexOf;


  var oneTime = _aureliaBinding.bindingMode.oneTime;

  function updateOverrideContexts(views, startIndex) {
    var length = views.length;

    if (startIndex > 0) {
      startIndex = startIndex - 1;
    }

    for (; startIndex < length; ++startIndex) {
      updateOverrideContext(views[startIndex].overrideContext, startIndex, length);
    }
  }

  function createFullOverrideContext(repeat, data, index, length, key) {
    var bindingContext = {};
    var overrideContext = (0, _aureliaBinding.createOverrideContext)(bindingContext, repeat.scope.overrideContext);

    if (typeof key !== 'undefined') {
      bindingContext[repeat.key] = key;
      bindingContext[repeat.value] = data;
    } else {
      bindingContext[repeat.local] = data;
    }
    updateOverrideContext(overrideContext, index, length);
    return overrideContext;
  }

  function updateOverrideContext(overrideContext, index, length) {
    var first = index === 0;
    var last = index === length - 1;
    var even = index % 2 === 0;

    overrideContext.$index = index;
    overrideContext.$first = first;
    overrideContext.$last = last;
    overrideContext.$middle = !(first || last);
    overrideContext.$odd = !even;
    overrideContext.$even = even;
  }

  function getItemsSourceExpression(instruction, attrName) {
    return instruction.behaviorInstructions.filter(function (bi) {
      return bi.originalAttrName === attrName;
    })[0].attributes.items.sourceExpression;
  }

  function unwrapExpression(expression) {
    var unwrapped = false;
    while (expression instanceof _aureliaBinding.BindingBehavior) {
      expression = expression.expression;
    }
    while (expression instanceof _aureliaBinding.ValueConverter) {
      expression = expression.expression;
      unwrapped = true;
    }
    return unwrapped ? expression : null;
  }

  function isOneTime(expression) {
    while (expression instanceof _aureliaBinding.BindingBehavior) {
      if (expression.name === 'oneTime') {
        return true;
      }
      expression = expression.expression;
    }
    return false;
  }

  function updateOneTimeBinding(binding) {
    if (binding.call && binding.mode === oneTime) {
      binding.call(_aureliaBinding.sourceContext);
    } else if (binding.updateOneTimeBindings) {
      binding.updateOneTimeBindings();
    }
  }

  function indexOf(array, item, matcher, startIndex) {
    if (!matcher) {
      return array.indexOf(item);
    }
    var length = array.length;
    for (var index = startIndex || 0; index < length; index++) {
      if (matcher(array[index], item)) {
        return index;
      }
    }
    return -1;
  }
});
define('aurelia-templating-resources/map-repeat-strategy',['exports', './repeat-utilities'], function (exports, _repeatUtilities) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.MapRepeatStrategy = undefined;

  

  var MapRepeatStrategy = exports.MapRepeatStrategy = function () {
    function MapRepeatStrategy() {
      
    }

    MapRepeatStrategy.prototype.getCollectionObserver = function getCollectionObserver(observerLocator, items) {
      return observerLocator.getMapObserver(items);
    };

    MapRepeatStrategy.prototype.instanceChanged = function instanceChanged(repeat, items) {
      var _this = this;

      var removePromise = repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
      if (removePromise instanceof Promise) {
        removePromise.then(function () {
          return _this._standardProcessItems(repeat, items);
        });
        return;
      }
      this._standardProcessItems(repeat, items);
    };

    MapRepeatStrategy.prototype._standardProcessItems = function _standardProcessItems(repeat, items) {
      var index = 0;
      var overrideContext = void 0;

      items.forEach(function (value, key) {
        overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, value, index, items.size, key);
        repeat.addView(overrideContext.bindingContext, overrideContext);
        ++index;
      });
    };

    MapRepeatStrategy.prototype.instanceMutated = function instanceMutated(repeat, map, records) {
      var key = void 0;
      var i = void 0;
      var ii = void 0;
      var overrideContext = void 0;
      var removeIndex = void 0;
      var record = void 0;
      var rmPromises = [];
      var viewOrPromise = void 0;

      for (i = 0, ii = records.length; i < ii; ++i) {
        record = records[i];
        key = record.key;
        switch (record.type) {
          case 'update':
            removeIndex = this._getViewIndexByKey(repeat, key);
            viewOrPromise = repeat.removeView(removeIndex, true, !repeat.viewsRequireLifecycle);
            if (viewOrPromise instanceof Promise) {
              rmPromises.push(viewOrPromise);
            }
            overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, map.get(key), removeIndex, map.size, key);
            repeat.insertView(removeIndex, overrideContext.bindingContext, overrideContext);
            break;
          case 'add':
            overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, map.get(key), map.size - 1, map.size, key);
            repeat.insertView(map.size - 1, overrideContext.bindingContext, overrideContext);
            break;
          case 'delete':
            if (record.oldValue === undefined) {
              return;
            }
            removeIndex = this._getViewIndexByKey(repeat, key);
            viewOrPromise = repeat.removeView(removeIndex, true, !repeat.viewsRequireLifecycle);
            if (viewOrPromise instanceof Promise) {
              rmPromises.push(viewOrPromise);
            }
            break;
          case 'clear':
            repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
            break;
          default:
            continue;
        }
      }

      if (rmPromises.length > 0) {
        Promise.all(rmPromises).then(function () {
          (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), 0);
        });
      } else {
        (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), 0);
      }
    };

    MapRepeatStrategy.prototype._getViewIndexByKey = function _getViewIndexByKey(repeat, key) {
      var i = void 0;
      var ii = void 0;
      var child = void 0;

      for (i = 0, ii = repeat.viewCount(); i < ii; ++i) {
        child = repeat.view(i);
        if (child.bindingContext[repeat.key] === key) {
          return i;
        }
      }

      return undefined;
    };

    return MapRepeatStrategy;
  }();
});
define('aurelia-templating-resources/set-repeat-strategy',['exports', './repeat-utilities'], function (exports, _repeatUtilities) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.SetRepeatStrategy = undefined;

  

  var SetRepeatStrategy = exports.SetRepeatStrategy = function () {
    function SetRepeatStrategy() {
      
    }

    SetRepeatStrategy.prototype.getCollectionObserver = function getCollectionObserver(observerLocator, items) {
      return observerLocator.getSetObserver(items);
    };

    SetRepeatStrategy.prototype.instanceChanged = function instanceChanged(repeat, items) {
      var _this = this;

      var removePromise = repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
      if (removePromise instanceof Promise) {
        removePromise.then(function () {
          return _this._standardProcessItems(repeat, items);
        });
        return;
      }
      this._standardProcessItems(repeat, items);
    };

    SetRepeatStrategy.prototype._standardProcessItems = function _standardProcessItems(repeat, items) {
      var index = 0;
      var overrideContext = void 0;

      items.forEach(function (value) {
        overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, value, index, items.size);
        repeat.addView(overrideContext.bindingContext, overrideContext);
        ++index;
      });
    };

    SetRepeatStrategy.prototype.instanceMutated = function instanceMutated(repeat, set, records) {
      var value = void 0;
      var i = void 0;
      var ii = void 0;
      var overrideContext = void 0;
      var removeIndex = void 0;
      var record = void 0;
      var rmPromises = [];
      var viewOrPromise = void 0;

      for (i = 0, ii = records.length; i < ii; ++i) {
        record = records[i];
        value = record.value;
        switch (record.type) {
          case 'add':
            overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, value, set.size - 1, set.size);
            repeat.insertView(set.size - 1, overrideContext.bindingContext, overrideContext);
            break;
          case 'delete':
            removeIndex = this._getViewIndexByValue(repeat, value);
            viewOrPromise = repeat.removeView(removeIndex, true, !repeat.viewsRequireLifecycle);
            if (viewOrPromise instanceof Promise) {
              rmPromises.push(viewOrPromise);
            }
            break;
          case 'clear':
            repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
            break;
          default:
            continue;
        }
      }

      if (rmPromises.length > 0) {
        Promise.all(rmPromises).then(function () {
          (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), 0);
        });
      } else {
        (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), 0);
      }
    };

    SetRepeatStrategy.prototype._getViewIndexByValue = function _getViewIndexByValue(repeat, value) {
      var i = void 0;
      var ii = void 0;
      var child = void 0;

      for (i = 0, ii = repeat.viewCount(); i < ii; ++i) {
        child = repeat.view(i);
        if (child.bindingContext[repeat.local] === value) {
          return i;
        }
      }

      return undefined;
    };

    return SetRepeatStrategy;
  }();
});
define('aurelia-templating-resources/number-repeat-strategy',['exports', './repeat-utilities'], function (exports, _repeatUtilities) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.NumberRepeatStrategy = undefined;

  

  var NumberRepeatStrategy = exports.NumberRepeatStrategy = function () {
    function NumberRepeatStrategy() {
      
    }

    NumberRepeatStrategy.prototype.getCollectionObserver = function getCollectionObserver() {
      return null;
    };

    NumberRepeatStrategy.prototype.instanceChanged = function instanceChanged(repeat, value) {
      var _this = this;

      var removePromise = repeat.removeAllViews(true, !repeat.viewsRequireLifecycle);
      if (removePromise instanceof Promise) {
        removePromise.then(function () {
          return _this._standardProcessItems(repeat, value);
        });
        return;
      }
      this._standardProcessItems(repeat, value);
    };

    NumberRepeatStrategy.prototype._standardProcessItems = function _standardProcessItems(repeat, value) {
      var childrenLength = repeat.viewCount();
      var i = void 0;
      var ii = void 0;
      var overrideContext = void 0;
      var viewsToRemove = void 0;

      value = Math.floor(value);
      viewsToRemove = childrenLength - value;

      if (viewsToRemove > 0) {
        if (viewsToRemove > childrenLength) {
          viewsToRemove = childrenLength;
        }

        for (i = 0, ii = viewsToRemove; i < ii; ++i) {
          repeat.removeView(childrenLength - (i + 1), true, !repeat.viewsRequireLifecycle);
        }

        return;
      }

      for (i = childrenLength, ii = value; i < ii; ++i) {
        overrideContext = (0, _repeatUtilities.createFullOverrideContext)(repeat, i, i, ii);
        repeat.addView(overrideContext.bindingContext, overrideContext);
      }

      (0, _repeatUtilities.updateOverrideContexts)(repeat.views(), 0);
    };

    return NumberRepeatStrategy;
  }();
});
define('aurelia-templating-resources/analyze-view-factory',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.viewsRequireLifecycle = viewsRequireLifecycle;
  var lifecycleOptionalBehaviors = exports.lifecycleOptionalBehaviors = ['focus', 'if', 'repeat', 'show', 'with'];

  function behaviorRequiresLifecycle(instruction) {
    var t = instruction.type;
    var name = t.elementName !== null ? t.elementName : t.attributeName;
    return lifecycleOptionalBehaviors.indexOf(name) === -1 && (t.handlesAttached || t.handlesBind || t.handlesCreated || t.handlesDetached || t.handlesUnbind) || t.viewFactory && viewsRequireLifecycle(t.viewFactory) || instruction.viewFactory && viewsRequireLifecycle(instruction.viewFactory);
  }

  function targetRequiresLifecycle(instruction) {
    var behaviors = instruction.behaviorInstructions;
    if (behaviors) {
      var i = behaviors.length;
      while (i--) {
        if (behaviorRequiresLifecycle(behaviors[i])) {
          return true;
        }
      }
    }

    return instruction.viewFactory && viewsRequireLifecycle(instruction.viewFactory);
  }

  function viewsRequireLifecycle(viewFactory) {
    if ('_viewsRequireLifecycle' in viewFactory) {
      return viewFactory._viewsRequireLifecycle;
    }

    viewFactory._viewsRequireLifecycle = false;

    if (viewFactory.viewFactory) {
      viewFactory._viewsRequireLifecycle = viewsRequireLifecycle(viewFactory.viewFactory);
      return viewFactory._viewsRequireLifecycle;
    }

    if (viewFactory.template.querySelector('.au-animate')) {
      viewFactory._viewsRequireLifecycle = true;
      return true;
    }

    for (var id in viewFactory.instructions) {
      if (targetRequiresLifecycle(viewFactory.instructions[id])) {
        viewFactory._viewsRequireLifecycle = true;
        return true;
      }
    }

    viewFactory._viewsRequireLifecycle = false;
    return false;
  }
});
define('aurelia-templating-resources/abstract-repeater',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  var AbstractRepeater = exports.AbstractRepeater = function () {
    function AbstractRepeater(options) {
      

      Object.assign(this, {
        local: 'items',
        viewsRequireLifecycle: true
      }, options);
    }

    AbstractRepeater.prototype.viewCount = function viewCount() {
      throw new Error('subclass must implement `viewCount`');
    };

    AbstractRepeater.prototype.views = function views() {
      throw new Error('subclass must implement `views`');
    };

    AbstractRepeater.prototype.view = function view(index) {
      throw new Error('subclass must implement `view`');
    };

    AbstractRepeater.prototype.matcher = function matcher() {
      throw new Error('subclass must implement `matcher`');
    };

    AbstractRepeater.prototype.addView = function addView(bindingContext, overrideContext) {
      throw new Error('subclass must implement `addView`');
    };

    AbstractRepeater.prototype.insertView = function insertView(index, bindingContext, overrideContext) {
      throw new Error('subclass must implement `insertView`');
    };

    AbstractRepeater.prototype.moveView = function moveView(sourceIndex, targetIndex) {
      throw new Error('subclass must implement `moveView`');
    };

    AbstractRepeater.prototype.removeAllViews = function removeAllViews(returnToCache, skipAnimation) {
      throw new Error('subclass must implement `removeAllViews`');
    };

    AbstractRepeater.prototype.removeViews = function removeViews(viewsToRemove, returnToCache, skipAnimation) {
      throw new Error('subclass must implement `removeView`');
    };

    AbstractRepeater.prototype.removeView = function removeView(index, returnToCache, skipAnimation) {
      throw new Error('subclass must implement `removeView`');
    };

    AbstractRepeater.prototype.updateBindings = function updateBindings(view) {
      throw new Error('subclass must implement `updateBindings`');
    };

    return AbstractRepeater;
  }();
});
define('aurelia-templating-resources/show',['exports', 'aurelia-dependency-injection', 'aurelia-templating', 'aurelia-pal', './aurelia-hide-style'], function (exports, _aureliaDependencyInjection, _aureliaTemplating, _aureliaPal, _aureliaHideStyle) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Show = undefined;

  

  var _dec, _dec2, _class;

  var Show = exports.Show = (_dec = (0, _aureliaTemplating.customAttribute)('show'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaTemplating.Animator, _aureliaDependencyInjection.Optional.of(_aureliaPal.DOM.boundary, true)), _dec(_class = _dec2(_class = function () {
    function Show(element, animator, domBoundary) {
      

      this.element = element;
      this.animator = animator;
      this.domBoundary = domBoundary;
    }

    Show.prototype.created = function created() {
      (0, _aureliaHideStyle.injectAureliaHideStyleAtBoundary)(this.domBoundary);
    };

    Show.prototype.valueChanged = function valueChanged(newValue) {
      if (newValue) {
        this.animator.removeClass(this.element, _aureliaHideStyle.aureliaHideClassName);
      } else {
        this.animator.addClass(this.element, _aureliaHideStyle.aureliaHideClassName);
      }
    };

    Show.prototype.bind = function bind(bindingContext) {
      this.valueChanged(this.value);
    };

    return Show;
  }()) || _class) || _class);
});
define('aurelia-templating-resources/aurelia-hide-style',['exports', 'aurelia-pal'], function (exports, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.aureliaHideClassName = undefined;
  exports.injectAureliaHideStyleAtHead = injectAureliaHideStyleAtHead;
  exports.injectAureliaHideStyleAtBoundary = injectAureliaHideStyleAtBoundary;
  var aureliaHideClassName = exports.aureliaHideClassName = 'aurelia-hide';

  var aureliaHideClass = '.' + aureliaHideClassName + ' { display:none !important; }';

  function injectAureliaHideStyleAtHead() {
    _aureliaPal.DOM.injectStyles(aureliaHideClass);
  }

  function injectAureliaHideStyleAtBoundary(domBoundary) {
    if (_aureliaPal.FEATURE.shadowDOM && domBoundary && !domBoundary.hasAureliaHideStyle) {
      domBoundary.hasAureliaHideStyle = true;
      _aureliaPal.DOM.injectStyles(aureliaHideClass, domBoundary);
    }
  }
});
define('aurelia-templating-resources/hide',['exports', 'aurelia-dependency-injection', 'aurelia-templating', 'aurelia-pal', './aurelia-hide-style'], function (exports, _aureliaDependencyInjection, _aureliaTemplating, _aureliaPal, _aureliaHideStyle) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Hide = undefined;

  

  var _dec, _dec2, _class;

  var Hide = exports.Hide = (_dec = (0, _aureliaTemplating.customAttribute)('hide'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaTemplating.Animator, _aureliaDependencyInjection.Optional.of(_aureliaPal.DOM.boundary, true)), _dec(_class = _dec2(_class = function () {
    function Hide(element, animator, domBoundary) {
      

      this.element = element;
      this.animator = animator;
      this.domBoundary = domBoundary;
    }

    Hide.prototype.created = function created() {
      (0, _aureliaHideStyle.injectAureliaHideStyleAtBoundary)(this.domBoundary);
    };

    Hide.prototype.valueChanged = function valueChanged(newValue) {
      if (newValue) {
        this.animator.addClass(this.element, _aureliaHideStyle.aureliaHideClassName);
      } else {
        this.animator.removeClass(this.element, _aureliaHideStyle.aureliaHideClassName);
      }
    };

    Hide.prototype.bind = function bind(bindingContext) {
      this.valueChanged(this.value);
    };

    return Hide;
  }()) || _class) || _class);
});
define('aurelia-templating-resources/sanitize-html',['exports', 'aurelia-binding', 'aurelia-dependency-injection', './html-sanitizer'], function (exports, _aureliaBinding, _aureliaDependencyInjection, _htmlSanitizer) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.SanitizeHTMLValueConverter = undefined;

  

  var _dec, _dec2, _class;

  var SanitizeHTMLValueConverter = exports.SanitizeHTMLValueConverter = (_dec = (0, _aureliaBinding.valueConverter)('sanitizeHTML'), _dec2 = (0, _aureliaDependencyInjection.inject)(_htmlSanitizer.HTMLSanitizer), _dec(_class = _dec2(_class = function () {
    function SanitizeHTMLValueConverter(sanitizer) {
      

      this.sanitizer = sanitizer;
    }

    SanitizeHTMLValueConverter.prototype.toView = function toView(untrustedMarkup) {
      if (untrustedMarkup === null || untrustedMarkup === undefined) {
        return null;
      }

      return this.sanitizer.sanitize(untrustedMarkup);
    };

    return SanitizeHTMLValueConverter;
  }()) || _class) || _class);
});
define('aurelia-templating-resources/html-sanitizer',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  var SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

  var HTMLSanitizer = exports.HTMLSanitizer = function () {
    function HTMLSanitizer() {
      
    }

    HTMLSanitizer.prototype.sanitize = function sanitize(input) {
      return input.replace(SCRIPT_REGEX, '');
    };

    return HTMLSanitizer;
  }();
});
define('aurelia-templating-resources/replaceable',['exports', 'aurelia-dependency-injection', 'aurelia-templating'], function (exports, _aureliaDependencyInjection, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Replaceable = undefined;

  

  var _dec, _dec2, _class;

  var Replaceable = exports.Replaceable = (_dec = (0, _aureliaTemplating.customAttribute)('replaceable'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaTemplating.BoundViewFactory, _aureliaTemplating.ViewSlot), _dec(_class = (0, _aureliaTemplating.templateController)(_class = _dec2(_class = function () {
    function Replaceable(viewFactory, viewSlot) {
      

      this.viewFactory = viewFactory;
      this.viewSlot = viewSlot;
      this.view = null;
    }

    Replaceable.prototype.bind = function bind(bindingContext, overrideContext) {
      if (this.view === null) {
        this.view = this.viewFactory.create();
        this.viewSlot.add(this.view);
      }

      this.view.bind(bindingContext, overrideContext);
    };

    Replaceable.prototype.unbind = function unbind() {
      this.view.unbind();
    };

    return Replaceable;
  }()) || _class) || _class) || _class);
});
define('aurelia-templating-resources/focus',['exports', 'aurelia-templating', 'aurelia-binding', 'aurelia-dependency-injection', 'aurelia-task-queue', 'aurelia-pal'], function (exports, _aureliaTemplating, _aureliaBinding, _aureliaDependencyInjection, _aureliaTaskQueue, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.Focus = undefined;

  

  var _dec, _dec2, _class;

  var Focus = exports.Focus = (_dec = (0, _aureliaTemplating.customAttribute)('focus', _aureliaBinding.bindingMode.twoWay), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaTaskQueue.TaskQueue), _dec(_class = _dec2(_class = function () {
    function Focus(element, taskQueue) {
      var _this = this;

      

      this.element = element;
      this.taskQueue = taskQueue;
      this.isAttached = false;
      this.needsApply = false;

      this.focusListener = function (e) {
        _this.value = true;
      };
      this.blurListener = function (e) {
        if (_aureliaPal.DOM.activeElement !== _this.element) {
          _this.value = false;
        }
      };
    }

    Focus.prototype.valueChanged = function valueChanged(newValue) {
      if (this.isAttached) {
        this._apply();
      } else {
        this.needsApply = true;
      }
    };

    Focus.prototype._apply = function _apply() {
      var _this2 = this;

      if (this.value) {
        this.taskQueue.queueMicroTask(function () {
          if (_this2.value) {
            _this2.element.focus();
          }
        });
      } else {
        this.element.blur();
      }
    };

    Focus.prototype.attached = function attached() {
      this.isAttached = true;
      if (this.needsApply) {
        this.needsApply = false;
        this._apply();
      }
      this.element.addEventListener('focus', this.focusListener);
      this.element.addEventListener('blur', this.blurListener);
    };

    Focus.prototype.detached = function detached() {
      this.isAttached = false;
      this.element.removeEventListener('focus', this.focusListener);
      this.element.removeEventListener('blur', this.blurListener);
    };

    return Focus;
  }()) || _class) || _class);
});
define('aurelia-templating-resources/css-resource',['exports', 'aurelia-templating', 'aurelia-loader', 'aurelia-dependency-injection', 'aurelia-path', 'aurelia-pal'], function (exports, _aureliaTemplating, _aureliaLoader, _aureliaDependencyInjection, _aureliaPath, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports._createCSSResource = _createCSSResource;

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  

  var cssUrlMatcher = /url\((?!['"]data)([^)]+)\)/gi;

  function fixupCSSUrls(address, css) {
    if (typeof css !== 'string') {
      throw new Error('Failed loading required CSS file: ' + address);
    }
    return css.replace(cssUrlMatcher, function (match, p1) {
      var quote = p1.charAt(0);
      if (quote === '\'' || quote === '"') {
        p1 = p1.substr(1, p1.length - 2);
      }
      return 'url(\'' + (0, _aureliaPath.relativeToFile)(p1, address) + '\')';
    });
  }

  var CSSResource = function () {
    function CSSResource(address) {
      

      this.address = address;
      this._scoped = null;
      this._global = false;
      this._alreadyGloballyInjected = false;
    }

    CSSResource.prototype.initialize = function initialize(container, target) {
      this._scoped = new target(this);
    };

    CSSResource.prototype.register = function register(registry, name) {
      if (name === 'scoped') {
        registry.registerViewEngineHooks(this._scoped);
      } else {
        this._global = true;
      }
    };

    CSSResource.prototype.load = function load(container) {
      var _this = this;

      return container.get(_aureliaLoader.Loader).loadText(this.address).catch(function (err) {
        return null;
      }).then(function (text) {
        text = fixupCSSUrls(_this.address, text);
        _this._scoped.css = text;
        if (_this._global) {
          _this._alreadyGloballyInjected = true;
          _aureliaPal.DOM.injectStyles(text);
        }
      });
    };

    return CSSResource;
  }();

  var CSSViewEngineHooks = function () {
    function CSSViewEngineHooks(owner) {
      

      this.owner = owner;
      this.css = null;
    }

    CSSViewEngineHooks.prototype.beforeCompile = function beforeCompile(content, resources, instruction) {
      if (instruction.targetShadowDOM) {
        _aureliaPal.DOM.injectStyles(this.css, content, true);
      } else if (_aureliaPal.FEATURE.scopedCSS) {
        var styleNode = _aureliaPal.DOM.injectStyles(this.css, content, true);
        styleNode.setAttribute('scoped', 'scoped');
      } else if (!this.owner._alreadyGloballyInjected) {
        _aureliaPal.DOM.injectStyles(this.css);
        this.owner._alreadyGloballyInjected = true;
      }
    };

    return CSSViewEngineHooks;
  }();

  function _createCSSResource(address) {
    var _dec, _class;

    var ViewCSS = (_dec = (0, _aureliaTemplating.resource)(new CSSResource(address)), _dec(_class = function (_CSSViewEngineHooks) {
      _inherits(ViewCSS, _CSSViewEngineHooks);

      function ViewCSS() {
        

        return _possibleConstructorReturn(this, _CSSViewEngineHooks.apply(this, arguments));
      }

      return ViewCSS;
    }(CSSViewEngineHooks)) || _class);

    return ViewCSS;
  }
});
define('aurelia-templating-resources/binding-mode-behaviors',['exports', 'aurelia-binding', 'aurelia-metadata'], function (exports, _aureliaBinding, _aureliaMetadata) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.TwoWayBindingBehavior = exports.OneWayBindingBehavior = exports.OneTimeBindingBehavior = undefined;

  

  var _dec, _class, _dec2, _class2, _dec3, _class3;

  var modeBindingBehavior = {
    bind: function bind(binding, source, lookupFunctions) {
      binding.originalMode = binding.mode;
      binding.mode = this.mode;
    },
    unbind: function unbind(binding, source) {
      binding.mode = binding.originalMode;
      binding.originalMode = null;
    }
  };

  var OneTimeBindingBehavior = exports.OneTimeBindingBehavior = (_dec = (0, _aureliaMetadata.mixin)(modeBindingBehavior), _dec(_class = function OneTimeBindingBehavior() {
    

    this.mode = _aureliaBinding.bindingMode.oneTime;
  }) || _class);
  var OneWayBindingBehavior = exports.OneWayBindingBehavior = (_dec2 = (0, _aureliaMetadata.mixin)(modeBindingBehavior), _dec2(_class2 = function OneWayBindingBehavior() {
    

    this.mode = _aureliaBinding.bindingMode.oneWay;
  }) || _class2);
  var TwoWayBindingBehavior = exports.TwoWayBindingBehavior = (_dec3 = (0, _aureliaMetadata.mixin)(modeBindingBehavior), _dec3(_class3 = function TwoWayBindingBehavior() {
    

    this.mode = _aureliaBinding.bindingMode.twoWay;
  }) || _class3);
});
define('aurelia-templating-resources/throttle-binding-behavior',['exports', 'aurelia-binding'], function (exports, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ThrottleBindingBehavior = undefined;

  

  function throttle(newValue) {
    var _this = this;

    var state = this.throttleState;
    var elapsed = +new Date() - state.last;
    if (elapsed >= state.delay) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
      state.last = +new Date();
      this.throttledMethod(newValue);
      return;
    }
    state.newValue = newValue;
    if (state.timeoutId === null) {
      state.timeoutId = setTimeout(function () {
        state.timeoutId = null;
        state.last = +new Date();
        _this.throttledMethod(state.newValue);
      }, state.delay - elapsed);
    }
  }

  var ThrottleBindingBehavior = exports.ThrottleBindingBehavior = function () {
    function ThrottleBindingBehavior() {
      
    }

    ThrottleBindingBehavior.prototype.bind = function bind(binding, source) {
      var delay = arguments.length <= 2 || arguments[2] === undefined ? 200 : arguments[2];

      var methodToThrottle = 'updateTarget';
      if (binding.callSource) {
        methodToThrottle = 'callSource';
      } else if (binding.updateSource && binding.mode === _aureliaBinding.bindingMode.twoWay) {
          methodToThrottle = 'updateSource';
        }

      binding.throttledMethod = binding[methodToThrottle];
      binding.throttledMethod.originalName = methodToThrottle;

      binding[methodToThrottle] = throttle;

      binding.throttleState = {
        delay: delay,
        last: 0,
        timeoutId: null
      };
    };

    ThrottleBindingBehavior.prototype.unbind = function unbind(binding, source) {
      var methodToRestore = binding.throttledMethod.originalName;
      binding[methodToRestore] = binding.throttledMethod;
      binding.throttledMethod = null;
      clearTimeout(binding.throttleState.timeoutId);
      binding.throttleState = null;
    };

    return ThrottleBindingBehavior;
  }();
});
define('aurelia-templating-resources/debounce-binding-behavior',['exports', 'aurelia-binding'], function (exports, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DebounceBindingBehavior = undefined;

  

  function debounce(newValue) {
    var _this = this;

    var state = this.debounceState;
    if (state.immediate) {
      state.immediate = false;
      this.debouncedMethod(newValue);
      return;
    }
    clearTimeout(state.timeoutId);
    state.timeoutId = setTimeout(function () {
      return _this.debouncedMethod(newValue);
    }, state.delay);
  }

  var DebounceBindingBehavior = exports.DebounceBindingBehavior = function () {
    function DebounceBindingBehavior() {
      
    }

    DebounceBindingBehavior.prototype.bind = function bind(binding, source) {
      var delay = arguments.length <= 2 || arguments[2] === undefined ? 200 : arguments[2];

      var methodToDebounce = 'updateTarget';
      if (binding.callSource) {
        methodToDebounce = 'callSource';
      } else if (binding.updateSource && binding.mode === _aureliaBinding.bindingMode.twoWay) {
          methodToDebounce = 'updateSource';
        }

      binding.debouncedMethod = binding[methodToDebounce];
      binding.debouncedMethod.originalName = methodToDebounce;

      binding[methodToDebounce] = debounce;

      binding.debounceState = {
        delay: delay,
        timeoutId: null,
        immediate: methodToDebounce === 'updateTarget' };
    };

    DebounceBindingBehavior.prototype.unbind = function unbind(binding, source) {
      var methodToRestore = binding.debouncedMethod.originalName;
      binding[methodToRestore] = binding.debouncedMethod;
      binding.debouncedMethod = null;
      clearTimeout(binding.debounceState.timeoutId);
      binding.debounceState = null;
    };

    return DebounceBindingBehavior;
  }();
});
define('aurelia-templating-resources/signal-binding-behavior',['exports', './binding-signaler'], function (exports, _bindingSignaler) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.SignalBindingBehavior = undefined;

  

  var SignalBindingBehavior = exports.SignalBindingBehavior = function () {
    SignalBindingBehavior.inject = function inject() {
      return [_bindingSignaler.BindingSignaler];
    };

    function SignalBindingBehavior(bindingSignaler) {
      

      this.signals = bindingSignaler.signals;
    }

    SignalBindingBehavior.prototype.bind = function bind(binding, source) {
      if (!binding.updateTarget) {
        throw new Error('Only property bindings and string interpolation bindings can be signaled.  Trigger, delegate and call bindings cannot be signaled.');
      }
      if (arguments.length === 3) {
        var name = arguments[2];
        var bindings = this.signals[name] || (this.signals[name] = []);
        bindings.push(binding);
        binding.signalName = name;
      } else if (arguments.length > 3) {
        var names = Array.prototype.slice.call(arguments, 2);
        var i = names.length;
        while (i--) {
          var _name = names[i];
          var _bindings = this.signals[_name] || (this.signals[_name] = []);
          _bindings.push(binding);
        }
        binding.signalName = names;
      } else {
        throw new Error('Signal name is required.');
      }
    };

    SignalBindingBehavior.prototype.unbind = function unbind(binding, source) {
      var name = binding.signalName;
      binding.signalName = null;
      if (Array.isArray(name)) {
        var names = name;
        var i = names.length;
        while (i--) {
          var n = names[i];
          var bindings = this.signals[n];
          bindings.splice(bindings.indexOf(binding), 1);
        }
      } else {
        var _bindings2 = this.signals[name];
        _bindings2.splice(_bindings2.indexOf(binding), 1);
      }
    };

    return SignalBindingBehavior;
  }();
});
define('aurelia-templating-resources/binding-signaler',['exports', 'aurelia-binding'], function (exports, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.BindingSignaler = undefined;

  

  var BindingSignaler = exports.BindingSignaler = function () {
    function BindingSignaler() {
      

      this.signals = {};
    }

    BindingSignaler.prototype.signal = function signal(name) {
      var bindings = this.signals[name];
      if (!bindings) {
        return;
      }
      var i = bindings.length;
      while (i--) {
        bindings[i].call(_aureliaBinding.sourceContext);
      }
    };

    return BindingSignaler;
  }();
});
define('aurelia-templating-resources/update-trigger-binding-behavior',['exports', 'aurelia-binding'], function (exports, _aureliaBinding) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.UpdateTriggerBindingBehavior = undefined;

  

  var _class, _temp;

  var eventNamesRequired = 'The updateTrigger binding behavior requires at least one event name argument: eg <input value.bind="firstName & updateTrigger:\'blur\'">';
  var notApplicableMessage = 'The updateTrigger binding behavior can only be applied to two-way bindings on input/select elements.';

  var UpdateTriggerBindingBehavior = exports.UpdateTriggerBindingBehavior = (_temp = _class = function () {
    function UpdateTriggerBindingBehavior(eventManager) {
      

      this.eventManager = eventManager;
    }

    UpdateTriggerBindingBehavior.prototype.bind = function bind(binding, source) {
      for (var _len = arguments.length, events = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        events[_key - 2] = arguments[_key];
      }

      if (events.length === 0) {
        throw new Error(eventNamesRequired);
      }
      if (binding.mode !== _aureliaBinding.bindingMode.twoWay) {
        throw new Error(notApplicableMessage);
      }

      var targetObserver = binding.observerLocator.getObserver(binding.target, binding.targetProperty);
      if (!targetObserver.handler) {
        throw new Error(notApplicableMessage);
      }
      binding.targetObserver = targetObserver;

      targetObserver.originalHandler = binding.targetObserver.handler;

      var handler = this.eventManager.createElementHandler(events);
      targetObserver.handler = handler;
    };

    UpdateTriggerBindingBehavior.prototype.unbind = function unbind(binding, source) {
      binding.targetObserver.handler = binding.targetObserver.originalHandler;
      binding.targetObserver.originalHandler = null;
    };

    return UpdateTriggerBindingBehavior;
  }(), _class.inject = [_aureliaBinding.EventManager], _temp);
});
define('aurelia-templating-resources/html-resource-plugin',['exports', 'aurelia-templating', './dynamic-element'], function (exports, _aureliaTemplating, _dynamicElement) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.getElementName = getElementName;
  exports.configure = configure;
  function getElementName(address) {
    return (/([^\/^\?]+)\.html/i.exec(address)[1].toLowerCase()
    );
  }

  function configure(config) {
    var viewEngine = config.container.get(_aureliaTemplating.ViewEngine);
    var loader = config.aurelia.loader;

    viewEngine.addResourcePlugin('.html', {
      'fetch': function fetch(address) {
        return loader.loadTemplate(address).then(function (registryEntry) {
          var _ref;

          var bindable = registryEntry.template.getAttribute('bindable');
          var elementName = getElementName(address);

          if (bindable) {
            bindable = bindable.split(',').map(function (x) {
              return x.trim();
            });
            registryEntry.template.removeAttribute('bindable');
          } else {
            bindable = [];
          }

          return _ref = {}, _ref[elementName] = (0, _dynamicElement._createDynamicElement)(elementName, address, bindable), _ref;
        });
      }
    });
  }
});
define('aurelia-templating-resources/dynamic-element',['exports', 'aurelia-templating'], function (exports, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports._createDynamicElement = _createDynamicElement;

  

  function _createDynamicElement(name, viewUrl, bindableNames) {
    var _dec, _dec2, _class;

    var DynamicElement = (_dec = (0, _aureliaTemplating.customElement)(name), _dec2 = (0, _aureliaTemplating.useView)(viewUrl), _dec(_class = _dec2(_class = function () {
      function DynamicElement() {
        
      }

      DynamicElement.prototype.bind = function bind(bindingContext) {
        this.$parent = bindingContext;
      };

      return DynamicElement;
    }()) || _class) || _class);

    for (var i = 0, ii = bindableNames.length; i < ii; ++i) {
      (0, _aureliaTemplating.bindable)(bindableNames[i])(DynamicElement);
    }
    return DynamicElement;
  }
});
!function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var c="function"==typeof require&&require;if(!u&&c)return c(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var a=n[o]={exports:{}};t[o][0].call(a.exports,function(n){var r=t[o][1][n];return s(r?r:n)},a,a.exports,e,t,n,r)}return n[o].exports}for(var i="function"==typeof require&&require,o=0;o<r.length;o++)s(r[o]);return s}({1:[function(t,n,r){(function(n){"use strict";function define(t,n,e){t[n]||Object[r](t,n,{writable:!0,configurable:!0,value:e})}if(t(295),t(296),t(2),n._babelPolyfill)throw new Error("only one instance of babel-polyfill is allowed");n._babelPolyfill=!0;var r="defineProperty";define(String.prototype,"padLeft","".padStart),define(String.prototype,"padRight","".padEnd),"pop,reverse,shift,keys,values,entries,indexOf,every,some,forEach,map,filter,find,findIndex,includes,join,slice,concat,push,splice,unshift,sort,lastIndexOf,reduce,reduceRight,copyWithin,fill".split(",").forEach(function(t){[][t]&&define(Array,t,Function.call.bind([][t]))})}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{2:2,295:295,296:296}],2:[function(t,n,r){t(119),n.exports=t(23).RegExp.escape},{119:119,23:23}],3:[function(t,n,r){n.exports=function(t){if("function"!=typeof t)throw TypeError(t+" is not a function!");return t}},{}],4:[function(t,n,r){var e=t(18);n.exports=function(t,n){if("number"!=typeof t&&"Number"!=e(t))throw TypeError(n);return+t}},{18:18}],5:[function(t,n,r){var e=t(117)("unscopables"),i=Array.prototype;void 0==i[e]&&t(40)(i,e,{}),n.exports=function(t){i[e][t]=!0}},{117:117,40:40}],6:[function(t,n,r){n.exports=function(t,n,r,e){if(!(t instanceof n)||void 0!==e&&e in t)throw TypeError(r+": incorrect invocation!");return t}},{}],7:[function(t,n,r){var e=t(49);n.exports=function(t){if(!e(t))throw TypeError(t+" is not an object!");return t}},{49:49}],8:[function(t,n,r){"use strict";var e=t(109),i=t(105),o=t(108);n.exports=[].copyWithin||function copyWithin(t,n){var r=e(this),u=o(r.length),c=i(t,u),f=i(n,u),a=arguments.length>2?arguments[2]:void 0,s=Math.min((void 0===a?u:i(a,u))-f,u-c),l=1;for(f<c&&c<f+s&&(l=-1,f+=s-1,c+=s-1);s-- >0;)f in r?r[c]=r[f]:delete r[c],c+=l,f+=l;return r}},{105:105,108:108,109:109}],9:[function(t,n,r){"use strict";var e=t(109),i=t(105),o=t(108);n.exports=function fill(t){for(var n=e(this),r=o(n.length),u=arguments.length,c=i(u>1?arguments[1]:void 0,r),f=u>2?arguments[2]:void 0,a=void 0===f?r:i(f,r);a>c;)n[c++]=t;return n}},{105:105,108:108,109:109}],10:[function(t,n,r){var e=t(37);n.exports=function(t,n){var r=[];return e(t,!1,r.push,r,n),r}},{37:37}],11:[function(t,n,r){var e=t(107),i=t(108),o=t(105);n.exports=function(t){return function(n,r,u){var c,f=e(n),a=i(f.length),s=o(u,a);if(t&&r!=r){for(;a>s;)if(c=f[s++],c!=c)return!0}else for(;a>s;s++)if((t||s in f)&&f[s]===r)return t||s||0;return!t&&-1}}},{105:105,107:107,108:108}],12:[function(t,n,r){var e=t(25),i=t(45),o=t(109),u=t(108),c=t(15);n.exports=function(t,n){var r=1==t,f=2==t,a=3==t,s=4==t,l=6==t,h=5==t||l,v=n||c;return function(n,c,p){for(var d,y,g=o(n),b=i(g),x=e(c,p,3),m=u(b.length),w=0,S=r?v(n,m):f?v(n,0):void 0;m>w;w++)if((h||w in b)&&(d=b[w],y=x(d,w,g),t))if(r)S[w]=y;else if(y)switch(t){case 3:return!0;case 5:return d;case 6:return w;case 2:S.push(d)}else if(s)return!1;return l?-1:a||s?s:S}}},{108:108,109:109,15:15,25:25,45:45}],13:[function(t,n,r){var e=t(3),i=t(109),o=t(45),u=t(108);n.exports=function(t,n,r,c,f){e(n);var a=i(t),s=o(a),l=u(a.length),h=f?l-1:0,v=f?-1:1;if(r<2)for(;;){if(h in s){c=s[h],h+=v;break}if(h+=v,f?h<0:l<=h)throw TypeError("Reduce of empty array with no initial value")}for(;f?h>=0:l>h;h+=v)h in s&&(c=n(c,s[h],h,a));return c}},{108:108,109:109,3:3,45:45}],14:[function(t,n,r){var e=t(49),i=t(47),o=t(117)("species");n.exports=function(t){var n;return i(t)&&(n=t.constructor,"function"!=typeof n||n!==Array&&!i(n.prototype)||(n=void 0),e(n)&&(n=n[o],null===n&&(n=void 0))),void 0===n?Array:n}},{117:117,47:47,49:49}],15:[function(t,n,r){var e=t(14);n.exports=function(t,n){return new(e(t))(n)}},{14:14}],16:[function(t,n,r){"use strict";var e=t(3),i=t(49),o=t(44),u=[].slice,c={},f=function(t,n,r){if(!(n in c)){for(var e=[],i=0;i<n;i++)e[i]="a["+i+"]";c[n]=Function("F,a","return new F("+e.join(",")+")")}return c[n](t,r)};n.exports=Function.bind||function bind(t){var n=e(this),r=u.call(arguments,1),c=function(){var e=r.concat(u.call(arguments));return this instanceof c?f(n,e.length,e):o(n,e,t)};return i(n.prototype)&&(c.prototype=n.prototype),c}},{3:3,44:44,49:49}],17:[function(t,n,r){var e=t(18),i=t(117)("toStringTag"),o="Arguments"==e(function(){return arguments}()),u=function(t,n){try{return t[n]}catch(t){}};n.exports=function(t){var n,r,c;return void 0===t?"Undefined":null===t?"Null":"string"==typeof(r=u(n=Object(t),i))?r:o?e(n):"Object"==(c=e(n))&&"function"==typeof n.callee?"Arguments":c}},{117:117,18:18}],18:[function(t,n,r){var e={}.toString;n.exports=function(t){return e.call(t).slice(8,-1)}},{}],19:[function(t,n,r){"use strict";var e=t(67).f,i=t(66),o=t(86),u=t(25),c=t(6),f=t(27),a=t(37),s=t(53),l=t(55),h=t(91),v=t(28),p=t(62).fastKey,d=v?"_s":"size",y=function(t,n){var r,e=p(n);if("F"!==e)return t._i[e];for(r=t._f;r;r=r.n)if(r.k==n)return r};n.exports={getConstructor:function(t,n,r,s){var l=t(function(t,e){c(t,l,n,"_i"),t._i=i(null),t._f=void 0,t._l=void 0,t[d]=0,void 0!=e&&a(e,r,t[s],t)});return o(l.prototype,{clear:function clear(){for(var t=this,n=t._i,r=t._f;r;r=r.n)r.r=!0,r.p&&(r.p=r.p.n=void 0),delete n[r.i];t._f=t._l=void 0,t[d]=0},delete:function(t){var n=this,r=y(n,t);if(r){var e=r.n,i=r.p;delete n._i[r.i],r.r=!0,i&&(i.n=e),e&&(e.p=i),n._f==r&&(n._f=e),n._l==r&&(n._l=i),n[d]--}return!!r},forEach:function forEach(t){c(this,l,"forEach");for(var n,r=u(t,arguments.length>1?arguments[1]:void 0,3);n=n?n.n:this._f;)for(r(n.v,n.k,this);n&&n.r;)n=n.p},has:function has(t){return!!y(this,t)}}),v&&e(l.prototype,"size",{get:function(){return f(this[d])}}),l},def:function(t,n,r){var e,i,o=y(t,n);return o?o.v=r:(t._l=o={i:i=p(n,!0),k:n,v:r,p:e=t._l,n:void 0,r:!1},t._f||(t._f=o),e&&(e.n=o),t[d]++,"F"!==i&&(t._i[i]=o)),t},getEntry:y,setStrong:function(t,n,r){s(t,n,function(t,n){this._t=t,this._k=n,this._l=void 0},function(){for(var t=this,n=t._k,r=t._l;r&&r.r;)r=r.p;return t._t&&(t._l=r=r?r.n:t._t._f)?"keys"==n?l(0,r.k):"values"==n?l(0,r.v):l(0,[r.k,r.v]):(t._t=void 0,l(1))},r?"entries":"values",!r,!0),h(n)}}},{25:25,27:27,28:28,37:37,53:53,55:55,6:6,62:62,66:66,67:67,86:86,91:91}],20:[function(t,n,r){var e=t(17),i=t(10);n.exports=function(t){return function toJSON(){if(e(this)!=t)throw TypeError(t+"#toJSON isn't generic");return i(this)}}},{10:10,17:17}],21:[function(t,n,r){"use strict";var e=t(86),i=t(62).getWeak,o=t(7),u=t(49),c=t(6),f=t(37),a=t(12),s=t(39),l=a(5),h=a(6),v=0,p=function(t){return t._l||(t._l=new d)},d=function(){this.a=[]},y=function(t,n){return l(t.a,function(t){return t[0]===n})};d.prototype={get:function(t){var n=y(this,t);if(n)return n[1]},has:function(t){return!!y(this,t)},set:function(t,n){var r=y(this,t);r?r[1]=n:this.a.push([t,n])},delete:function(t){var n=h(this.a,function(n){return n[0]===t});return~n&&this.a.splice(n,1),!!~n}},n.exports={getConstructor:function(t,n,r,o){var a=t(function(t,e){c(t,a,n,"_i"),t._i=v++,t._l=void 0,void 0!=e&&f(e,r,t[o],t)});return e(a.prototype,{delete:function(t){if(!u(t))return!1;var n=i(t);return n===!0?p(this).delete(t):n&&s(n,this._i)&&delete n[this._i]},has:function has(t){if(!u(t))return!1;var n=i(t);return n===!0?p(this).has(t):n&&s(n,this._i)}}),a},def:function(t,n,r){var e=i(o(n),!0);return e===!0?p(t).set(n,r):e[t._i]=r,t},ufstore:p}},{12:12,37:37,39:39,49:49,6:6,62:62,7:7,86:86}],22:[function(t,n,r){"use strict";var e=t(38),i=t(32),o=t(87),u=t(86),c=t(62),f=t(37),a=t(6),s=t(49),l=t(34),h=t(54),v=t(92),p=t(43);n.exports=function(t,n,r,d,y,g){var b=e[t],x=b,m=y?"set":"add",w=x&&x.prototype,S={},_=function(t){var n=w[t];o(w,t,"delete"==t?function(t){return!(g&&!s(t))&&n.call(this,0===t?0:t)}:"has"==t?function has(t){return!(g&&!s(t))&&n.call(this,0===t?0:t)}:"get"==t?function get(t){return g&&!s(t)?void 0:n.call(this,0===t?0:t)}:"add"==t?function add(t){return n.call(this,0===t?0:t),this}:function set(t,r){return n.call(this,0===t?0:t,r),this})};if("function"==typeof x&&(g||w.forEach&&!l(function(){(new x).entries().next()}))){var E=new x,O=E[m](g?{}:-0,1)!=E,F=l(function(){E.has(1)}),P=h(function(t){new x(t)}),A=!g&&l(function(){for(var t=new x,n=5;n--;)t[m](n,n);return!t.has(-0)});P||(x=n(function(n,r){a(n,x,t);var e=p(new b,n,x);return void 0!=r&&f(r,y,e[m],e),e}),x.prototype=w,w.constructor=x),(F||A)&&(_("delete"),_("has"),y&&_("get")),(A||O)&&_(m),g&&w.clear&&delete w.clear}else x=d.getConstructor(n,t,y,m),u(x.prototype,r),c.NEED=!0;return v(x,t),S[t]=x,i(i.G+i.W+i.F*(x!=b),S),g||d.setStrong(x,t,y),x}},{32:32,34:34,37:37,38:38,43:43,49:49,54:54,6:6,62:62,86:86,87:87,92:92}],23:[function(t,n,r){var e=n.exports={version:"2.4.0"};"number"==typeof __e&&(__e=e)},{}],24:[function(t,n,r){"use strict";var e=t(67),i=t(85);n.exports=function(t,n,r){n in t?e.f(t,n,i(0,r)):t[n]=r}},{67:67,85:85}],25:[function(t,n,r){var e=t(3);n.exports=function(t,n,r){if(e(t),void 0===n)return t;switch(r){case 1:return function(r){return t.call(n,r)};case 2:return function(r,e){return t.call(n,r,e)};case 3:return function(r,e,i){return t.call(n,r,e,i)}}return function(){return t.apply(n,arguments)}}},{3:3}],26:[function(t,n,r){"use strict";var e=t(7),i=t(110),o="number";n.exports=function(t){if("string"!==t&&t!==o&&"default"!==t)throw TypeError("Incorrect hint");return i(e(this),t!=o)}},{110:110,7:7}],27:[function(t,n,r){n.exports=function(t){if(void 0==t)throw TypeError("Can't call method on  "+t);return t}},{}],28:[function(t,n,r){n.exports=!t(34)(function(){return 7!=Object.defineProperty({},"a",{get:function(){return 7}}).a})},{34:34}],29:[function(t,n,r){var e=t(49),i=t(38).document,o=e(i)&&e(i.createElement);n.exports=function(t){return o?i.createElement(t):{}}},{38:38,49:49}],30:[function(t,n,r){n.exports="constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",")},{}],31:[function(t,n,r){var e=t(76),i=t(73),o=t(77);n.exports=function(t){var n=e(t),r=i.f;if(r)for(var u,c=r(t),f=o.f,a=0;c.length>a;)f.call(t,u=c[a++])&&n.push(u);return n}},{73:73,76:76,77:77}],32:[function(t,n,r){var e=t(38),i=t(23),o=t(40),u=t(87),c=t(25),f="prototype",a=function(t,n,r){var s,l,h,v,p=t&a.F,d=t&a.G,y=t&a.S,g=t&a.P,b=t&a.B,x=d?e:y?e[n]||(e[n]={}):(e[n]||{})[f],m=d?i:i[n]||(i[n]={}),w=m[f]||(m[f]={});d&&(r=n);for(s in r)l=!p&&x&&void 0!==x[s],h=(l?x:r)[s],v=b&&l?c(h,e):g&&"function"==typeof h?c(Function.call,h):h,x&&u(x,s,h,t&a.U),m[s]!=h&&o(m,s,v),g&&w[s]!=h&&(w[s]=h)};e.core=i,a.F=1,a.G=2,a.S=4,a.P=8,a.B=16,a.W=32,a.U=64,a.R=128,n.exports=a},{23:23,25:25,38:38,40:40,87:87}],33:[function(t,n,r){var e=t(117)("match");n.exports=function(t){var n=/./;try{"/./"[t](n)}catch(r){try{return n[e]=!1,!"/./"[t](n)}catch(t){}}return!0}},{117:117}],34:[function(t,n,r){n.exports=function(t){try{return!!t()}catch(t){return!0}}},{}],35:[function(t,n,r){"use strict";var e=t(40),i=t(87),o=t(34),u=t(27),c=t(117);n.exports=function(t,n,r){var f=c(t),a=r(u,f,""[t]),s=a[0],l=a[1];o(function(){var n={};return n[f]=function(){return 7},7!=""[t](n)})&&(i(String.prototype,t,s),e(RegExp.prototype,f,2==n?function(t,n){return l.call(t,this,n)}:function(t){return l.call(t,this)}))}},{117:117,27:27,34:34,40:40,87:87}],36:[function(t,n,r){"use strict";var e=t(7);n.exports=function(){var t=e(this),n="";return t.global&&(n+="g"),t.ignoreCase&&(n+="i"),t.multiline&&(n+="m"),t.unicode&&(n+="u"),t.sticky&&(n+="y"),n}},{7:7}],37:[function(t,n,r){var e=t(25),i=t(51),o=t(46),u=t(7),c=t(108),f=t(118),a={},s={},r=n.exports=function(t,n,r,l,h){var v,p,d,y,g=h?function(){return t}:f(t),b=e(r,l,n?2:1),x=0;if("function"!=typeof g)throw TypeError(t+" is not iterable!");if(o(g)){for(v=c(t.length);v>x;x++)if(y=n?b(u(p=t[x])[0],p[1]):b(t[x]),y===a||y===s)return y}else for(d=g.call(t);!(p=d.next()).done;)if(y=i(d,b,p.value,n),y===a||y===s)return y};r.BREAK=a,r.RETURN=s},{108:108,118:118,25:25,46:46,51:51,7:7}],38:[function(t,n,r){var e=n.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=e)},{}],39:[function(t,n,r){var e={}.hasOwnProperty;n.exports=function(t,n){return e.call(t,n)}},{}],40:[function(t,n,r){var e=t(67),i=t(85);n.exports=t(28)?function(t,n,r){return e.f(t,n,i(1,r))}:function(t,n,r){return t[n]=r,t}},{28:28,67:67,85:85}],41:[function(t,n,r){n.exports=t(38).document&&document.documentElement},{38:38}],42:[function(t,n,r){n.exports=!t(28)&&!t(34)(function(){return 7!=Object.defineProperty(t(29)("div"),"a",{get:function(){return 7}}).a})},{28:28,29:29,34:34}],43:[function(t,n,r){var e=t(49),i=t(90).set;n.exports=function(t,n,r){var o,u=n.constructor;return u!==r&&"function"==typeof u&&(o=u.prototype)!==r.prototype&&e(o)&&i&&i(t,o),t}},{49:49,90:90}],44:[function(t,n,r){n.exports=function(t,n,r){var e=void 0===r;switch(n.length){case 0:return e?t():t.call(r);case 1:return e?t(n[0]):t.call(r,n[0]);case 2:return e?t(n[0],n[1]):t.call(r,n[0],n[1]);case 3:return e?t(n[0],n[1],n[2]):t.call(r,n[0],n[1],n[2]);case 4:return e?t(n[0],n[1],n[2],n[3]):t.call(r,n[0],n[1],n[2],n[3])}return t.apply(r,n)}},{}],45:[function(t,n,r){var e=t(18);n.exports=Object("z").propertyIsEnumerable(0)?Object:function(t){return"String"==e(t)?t.split(""):Object(t)}},{18:18}],46:[function(t,n,r){var e=t(56),i=t(117)("iterator"),o=Array.prototype;n.exports=function(t){return void 0!==t&&(e.Array===t||o[i]===t)}},{117:117,56:56}],47:[function(t,n,r){var e=t(18);n.exports=Array.isArray||function isArray(t){return"Array"==e(t)}},{18:18}],48:[function(t,n,r){var e=t(49),i=Math.floor;n.exports=function isInteger(t){return!e(t)&&isFinite(t)&&i(t)===t}},{49:49}],49:[function(t,n,r){n.exports=function(t){return"object"==typeof t?null!==t:"function"==typeof t}},{}],50:[function(t,n,r){var e=t(49),i=t(18),o=t(117)("match");n.exports=function(t){var n;return e(t)&&(void 0!==(n=t[o])?!!n:"RegExp"==i(t))}},{117:117,18:18,49:49}],51:[function(t,n,r){var e=t(7);n.exports=function(t,n,r,i){try{return i?n(e(r)[0],r[1]):n(r)}catch(n){var o=t.return;throw void 0!==o&&e(o.call(t)),n}}},{7:7}],52:[function(t,n,r){"use strict";var e=t(66),i=t(85),o=t(92),u={};t(40)(u,t(117)("iterator"),function(){return this}),n.exports=function(t,n,r){t.prototype=e(u,{next:i(1,r)}),o(t,n+" Iterator")}},{117:117,40:40,66:66,85:85,92:92}],53:[function(t,n,r){"use strict";var e=t(58),i=t(32),o=t(87),u=t(40),c=t(39),f=t(56),a=t(52),s=t(92),l=t(74),h=t(117)("iterator"),v=!([].keys&&"next"in[].keys()),p="@@iterator",d="keys",y="values",g=function(){return this};n.exports=function(t,n,r,b,x,m,w){a(r,n,b);var S,_,E,O=function(t){if(!v&&t in M)return M[t];switch(t){case d:return function keys(){return new r(this,t)};case y:return function values(){return new r(this,t)}}return function entries(){return new r(this,t)}},F=n+" Iterator",P=x==y,A=!1,M=t.prototype,I=M[h]||M[p]||x&&M[x],j=I||O(x),N=x?P?O("entries"):j:void 0,k="Array"==n?M.entries||I:I;if(k&&(E=l(k.call(new t)),E!==Object.prototype&&(s(E,F,!0),e||c(E,h)||u(E,h,g))),P&&I&&I.name!==y&&(A=!0,j=function values(){return I.call(this)}),e&&!w||!v&&!A&&M[h]||u(M,h,j),f[n]=j,f[F]=g,x)if(S={values:P?j:O(y),keys:m?j:O(d),entries:N},w)for(_ in S)_ in M||o(M,_,S[_]);else i(i.P+i.F*(v||A),n,S);return S}},{117:117,32:32,39:39,40:40,52:52,56:56,58:58,74:74,87:87,92:92}],54:[function(t,n,r){var e=t(117)("iterator"),i=!1;try{var o=[7][e]();o.return=function(){i=!0},Array.from(o,function(){throw 2})}catch(t){}n.exports=function(t,n){if(!n&&!i)return!1;var r=!1;try{var o=[7],u=o[e]();u.next=function(){return{done:r=!0}},o[e]=function(){return u},t(o)}catch(t){}return r}},{117:117}],55:[function(t,n,r){n.exports=function(t,n){return{value:n,done:!!t}}},{}],56:[function(t,n,r){n.exports={}},{}],57:[function(t,n,r){var e=t(76),i=t(107);n.exports=function(t,n){for(var r,o=i(t),u=e(o),c=u.length,f=0;c>f;)if(o[r=u[f++]]===n)return r}},{107:107,76:76}],58:[function(t,n,r){n.exports=!1},{}],59:[function(t,n,r){var e=Math.expm1;n.exports=!e||e(10)>22025.465794806718||e(10)<22025.465794806718||e(-2e-17)!=-2e-17?function expm1(t){return 0==(t=+t)?t:t>-1e-6&&t<1e-6?t+t*t/2:Math.exp(t)-1}:e},{}],60:[function(t,n,r){n.exports=Math.log1p||function log1p(t){return(t=+t)>-1e-8&&t<1e-8?t-t*t/2:Math.log(1+t)}},{}],61:[function(t,n,r){n.exports=Math.sign||function sign(t){return 0==(t=+t)||t!=t?t:t<0?-1:1}},{}],62:[function(t,n,r){var e=t(114)("meta"),i=t(49),o=t(39),u=t(67).f,c=0,f=Object.isExtensible||function(){return!0},a=!t(34)(function(){return f(Object.preventExtensions({}))}),s=function(t){u(t,e,{value:{i:"O"+ ++c,w:{}}})},l=function(t,n){if(!i(t))return"symbol"==typeof t?t:("string"==typeof t?"S":"P")+t;if(!o(t,e)){if(!f(t))return"F";if(!n)return"E";s(t)}return t[e].i},h=function(t,n){if(!o(t,e)){if(!f(t))return!0;if(!n)return!1;s(t)}return t[e].w},v=function(t){return a&&p.NEED&&f(t)&&!o(t,e)&&s(t),t},p=n.exports={KEY:e,NEED:!1,fastKey:l,getWeak:h,onFreeze:v}},{114:114,34:34,39:39,49:49,67:67}],63:[function(t,n,r){var e=t(149),i=t(32),o=t(94)("metadata"),u=o.store||(o.store=new(t(255))),c=function(t,n,r){var i=u.get(t);if(!i){if(!r)return;u.set(t,i=new e)}var o=i.get(n);if(!o){if(!r)return;i.set(n,o=new e)}return o},f=function(t,n,r){var e=c(n,r,!1);return void 0!==e&&e.has(t)},a=function(t,n,r){var e=c(n,r,!1);return void 0===e?void 0:e.get(t)},s=function(t,n,r,e){c(r,e,!0).set(t,n)},l=function(t,n){var r=c(t,n,!1),e=[];return r&&r.forEach(function(t,n){e.push(n)}),e},h=function(t){return void 0===t||"symbol"==typeof t?t:String(t)},v=function(t){i(i.S,"Reflect",t)};n.exports={store:u,map:c,has:f,get:a,set:s,keys:l,key:h,exp:v}},{149:149,255:255,32:32,94:94}],64:[function(t,n,r){var e=t(38),i=t(104).set,o=e.MutationObserver||e.WebKitMutationObserver,u=e.process,c=e.Promise,f="process"==t(18)(u);n.exports=function(){var t,n,r,a=function(){var e,i;for(f&&(e=u.domain)&&e.exit();t;){i=t.fn,t=t.next;try{i()}catch(e){throw t?r():n=void 0,e}}n=void 0,e&&e.enter()};if(f)r=function(){u.nextTick(a)};else if(o){var s=!0,l=document.createTextNode("");new o(a).observe(l,{characterData:!0}),r=function(){l.data=s=!s}}else if(c&&c.resolve){var h=c.resolve();r=function(){h.then(a)}}else r=function(){i.call(e,a)};return function(e){var i={fn:e,next:void 0};n&&(n.next=i),t||(t=i,r()),n=i}}},{104:104,18:18,38:38}],65:[function(t,n,r){"use strict";var e=t(76),i=t(73),o=t(77),u=t(109),c=t(45),f=Object.assign;n.exports=!f||t(34)(function(){var t={},n={},r=Symbol(),e="abcdefghijklmnopqrst";return t[r]=7,e.split("").forEach(function(t){n[t]=t}),7!=f({},t)[r]||Object.keys(f({},n)).join("")!=e})?function assign(t,n){for(var r=u(t),f=arguments.length,a=1,s=i.f,l=o.f;f>a;)for(var h,v=c(arguments[a++]),p=s?e(v).concat(s(v)):e(v),d=p.length,y=0;d>y;)l.call(v,h=p[y++])&&(r[h]=v[h]);return r}:f},{109:109,34:34,45:45,73:73,76:76,77:77}],66:[function(t,n,r){var e=t(7),i=t(68),o=t(30),u=t(93)("IE_PROTO"),c=function(){},f="prototype",a=function(){var n,r=t(29)("iframe"),e=o.length,i="<",u=">";for(r.style.display="none",t(41).appendChild(r),r.src="javascript:",n=r.contentWindow.document,n.open(),n.write(i+"script"+u+"document.F=Object"+i+"/script"+u),n.close(),a=n.F;e--;)delete a[f][o[e]];return a()};n.exports=Object.create||function create(t,n){var r;return null!==t?(c[f]=e(t),r=new c,c[f]=null,r[u]=t):r=a(),void 0===n?r:i(r,n)}},{29:29,30:30,41:41,68:68,7:7,93:93}],67:[function(t,n,r){var e=t(7),i=t(42),o=t(110),u=Object.defineProperty;r.f=t(28)?Object.defineProperty:function defineProperty(t,n,r){if(e(t),n=o(n,!0),e(r),i)try{return u(t,n,r)}catch(t){}if("get"in r||"set"in r)throw TypeError("Accessors not supported!");return"value"in r&&(t[n]=r.value),t}},{110:110,28:28,42:42,7:7}],68:[function(t,n,r){var e=t(67),i=t(7),o=t(76);n.exports=t(28)?Object.defineProperties:function defineProperties(t,n){i(t);for(var r,u=o(n),c=u.length,f=0;c>f;)e.f(t,r=u[f++],n[r]);return t}},{28:28,67:67,7:7,76:76}],69:[function(t,n,r){n.exports=t(58)||!t(34)(function(){var n=Math.random();__defineSetter__.call(null,n,function(){}),delete t(38)[n]})},{34:34,38:38,58:58}],70:[function(t,n,r){var e=t(77),i=t(85),o=t(107),u=t(110),c=t(39),f=t(42),a=Object.getOwnPropertyDescriptor;r.f=t(28)?a:function getOwnPropertyDescriptor(t,n){if(t=o(t),n=u(n,!0),f)try{return a(t,n)}catch(t){}if(c(t,n))return i(!e.f.call(t,n),t[n])}},{107:107,110:110,28:28,39:39,42:42,77:77,85:85}],71:[function(t,n,r){var e=t(107),i=t(72).f,o={}.toString,u="object"==typeof window&&window&&Object.getOwnPropertyNames?Object.getOwnPropertyNames(window):[],c=function(t){try{return i(t)}catch(t){return u.slice()}};n.exports.f=function getOwnPropertyNames(t){return u&&"[object Window]"==o.call(t)?c(t):i(e(t))}},{107:107,72:72}],72:[function(t,n,r){var e=t(75),i=t(30).concat("length","prototype");r.f=Object.getOwnPropertyNames||function getOwnPropertyNames(t){return e(t,i)}},{30:30,75:75}],73:[function(t,n,r){r.f=Object.getOwnPropertySymbols},{}],74:[function(t,n,r){var e=t(39),i=t(109),o=t(93)("IE_PROTO"),u=Object.prototype;n.exports=Object.getPrototypeOf||function(t){return t=i(t),e(t,o)?t[o]:"function"==typeof t.constructor&&t instanceof t.constructor?t.constructor.prototype:t instanceof Object?u:null}},{109:109,39:39,93:93}],75:[function(t,n,r){var e=t(39),i=t(107),o=t(11)(!1),u=t(93)("IE_PROTO");n.exports=function(t,n){var r,c=i(t),f=0,a=[];for(r in c)r!=u&&e(c,r)&&a.push(r);for(;n.length>f;)e(c,r=n[f++])&&(~o(a,r)||a.push(r));return a}},{107:107,11:11,39:39,93:93}],76:[function(t,n,r){var e=t(75),i=t(30);n.exports=Object.keys||function keys(t){return e(t,i)}},{30:30,75:75}],77:[function(t,n,r){r.f={}.propertyIsEnumerable},{}],78:[function(t,n,r){var e=t(32),i=t(23),o=t(34);n.exports=function(t,n){var r=(i.Object||{})[t]||Object[t],u={};u[t]=n(r),e(e.S+e.F*o(function(){r(1)}),"Object",u)}},{23:23,32:32,34:34}],79:[function(t,n,r){var e=t(76),i=t(107),o=t(77).f;n.exports=function(t){return function(n){for(var r,u=i(n),c=e(u),f=c.length,a=0,s=[];f>a;)o.call(u,r=c[a++])&&s.push(t?[r,u[r]]:u[r]);return s}}},{107:107,76:76,77:77}],80:[function(t,n,r){var e=t(72),i=t(73),o=t(7),u=t(38).Reflect;n.exports=u&&u.ownKeys||function ownKeys(t){var n=e.f(o(t)),r=i.f;return r?n.concat(r(t)):n}},{38:38,7:7,72:72,73:73}],81:[function(t,n,r){var e=t(38).parseFloat,i=t(102).trim;n.exports=1/e(t(103)+"-0")!==-(1/0)?function parseFloat(t){var n=i(String(t),3),r=e(n);return 0===r&&"-"==n.charAt(0)?-0:r}:e},{102:102,103:103,38:38}],82:[function(t,n,r){var e=t(38).parseInt,i=t(102).trim,o=t(103),u=/^[\-+]?0[xX]/;n.exports=8!==e(o+"08")||22!==e(o+"0x16")?function parseInt(t,n){var r=i(String(t),3);return e(r,n>>>0||(u.test(r)?16:10))}:e},{102:102,103:103,38:38}],83:[function(t,n,r){"use strict";var e=t(84),i=t(44),o=t(3);n.exports=function(){for(var t=o(this),n=arguments.length,r=Array(n),u=0,c=e._,f=!1;n>u;)(r[u]=arguments[u++])===c&&(f=!0);return function(){var e,o=this,u=arguments.length,a=0,s=0;if(!f&&!u)return i(t,r,o);if(e=r.slice(),f)for(;n>a;a++)e[a]===c&&(e[a]=arguments[s++]);for(;u>s;)e.push(arguments[s++]);return i(t,e,o)}}},{3:3,44:44,84:84}],84:[function(t,n,r){n.exports=t(38)},{38:38}],85:[function(t,n,r){n.exports=function(t,n){return{enumerable:!(1&t),configurable:!(2&t),writable:!(4&t),value:n}}},{}],86:[function(t,n,r){var e=t(87);n.exports=function(t,n,r){for(var i in n)e(t,i,n[i],r);return t}},{87:87}],87:[function(t,n,r){var e=t(38),i=t(40),o=t(39),u=t(114)("src"),c="toString",f=Function[c],a=(""+f).split(c);t(23).inspectSource=function(t){return f.call(t)},(n.exports=function(t,n,r,c){var f="function"==typeof r;f&&(o(r,"name")||i(r,"name",n)),t[n]!==r&&(f&&(o(r,u)||i(r,u,t[n]?""+t[n]:a.join(String(n)))),t===e?t[n]=r:c?t[n]?t[n]=r:i(t,n,r):(delete t[n],i(t,n,r)))})(Function.prototype,c,function toString(){return"function"==typeof this&&this[u]||f.call(this)})},{114:114,23:23,38:38,39:39,40:40}],88:[function(t,n,r){n.exports=function(t,n){var r=n===Object(n)?function(t){return n[t]}:n;return function(n){return String(n).replace(t,r)}}},{}],89:[function(t,n,r){n.exports=Object.is||function is(t,n){return t===n?0!==t||1/t===1/n:t!=t&&n!=n}},{}],90:[function(t,n,r){var e=t(49),i=t(7),o=function(t,n){if(i(t),!e(n)&&null!==n)throw TypeError(n+": can't set as prototype!")};n.exports={set:Object.setPrototypeOf||("__proto__"in{}?function(n,r,e){try{e=t(25)(Function.call,t(70).f(Object.prototype,"__proto__").set,2),e(n,[]),r=!(n instanceof Array)}catch(t){r=!0}return function setPrototypeOf(t,n){return o(t,n),r?t.__proto__=n:e(t,n),t}}({},!1):void 0),check:o}},{25:25,49:49,7:7,70:70}],91:[function(t,n,r){"use strict";var e=t(38),i=t(67),o=t(28),u=t(117)("species");n.exports=function(t){var n=e[t];o&&n&&!n[u]&&i.f(n,u,{configurable:!0,get:function(){return this}})}},{117:117,28:28,38:38,67:67}],92:[function(t,n,r){var e=t(67).f,i=t(39),o=t(117)("toStringTag");n.exports=function(t,n,r){t&&!i(t=r?t:t.prototype,o)&&e(t,o,{configurable:!0,value:n})}},{117:117,39:39,67:67}],93:[function(t,n,r){var e=t(94)("keys"),i=t(114);n.exports=function(t){return e[t]||(e[t]=i(t))}},{114:114,94:94}],94:[function(t,n,r){var e=t(38),i="__core-js_shared__",o=e[i]||(e[i]={});n.exports=function(t){return o[t]||(o[t]={})}},{38:38}],95:[function(t,n,r){var e=t(7),i=t(3),o=t(117)("species");n.exports=function(t,n){var r,u=e(t).constructor;return void 0===u||void 0==(r=e(u)[o])?n:i(r)}},{117:117,3:3,7:7}],96:[function(t,n,r){var e=t(34);n.exports=function(t,n){return!!t&&e(function(){n?t.call(null,function(){},1):t.call(null)})}},{34:34}],97:[function(t,n,r){var e=t(106),i=t(27);n.exports=function(t){return function(n,r){var o,u,c=String(i(n)),f=e(r),a=c.length;return f<0||f>=a?t?"":void 0:(o=c.charCodeAt(f),o<55296||o>56319||f+1===a||(u=c.charCodeAt(f+1))<56320||u>57343?t?c.charAt(f):o:t?c.slice(f,f+2):(o-55296<<10)+(u-56320)+65536)}}},{106:106,27:27}],98:[function(t,n,r){var e=t(50),i=t(27);n.exports=function(t,n,r){if(e(n))throw TypeError("String#"+r+" doesn't accept regex!");return String(i(t))}},{27:27,50:50}],99:[function(t,n,r){var e=t(32),i=t(34),o=t(27),u=/"/g,c=function(t,n,r,e){var i=String(o(t)),c="<"+n;return""!==r&&(c+=" "+r+'="'+String(e).replace(u,"&quot;")+'"'),c+">"+i+"</"+n+">"};n.exports=function(t,n){var r={};r[t]=n(c),e(e.P+e.F*i(function(){var n=""[t]('"');return n!==n.toLowerCase()||n.split('"').length>3}),"String",r)}},{27:27,32:32,34:34}],100:[function(t,n,r){var e=t(108),i=t(101),o=t(27);n.exports=function(t,n,r,u){var c=String(o(t)),f=c.length,a=void 0===r?" ":String(r),s=e(n);if(s<=f||""==a)return c;var l=s-f,h=i.call(a,Math.ceil(l/a.length));return h.length>l&&(h=h.slice(0,l)),u?h+c:c+h}},{101:101,108:108,27:27}],101:[function(t,n,r){"use strict";var e=t(106),i=t(27);n.exports=function repeat(t){var n=String(i(this)),r="",o=e(t);if(o<0||o==1/0)throw RangeError("Count can't be negative");for(;o>0;(o>>>=1)&&(n+=n))1&o&&(r+=n);return r}},{106:106,27:27}],102:[function(t,n,r){var e=t(32),i=t(27),o=t(34),u=t(103),c="["+u+"]",f="​",a=RegExp("^"+c+c+"*"),s=RegExp(c+c+"*$"),l=function(t,n,r){var i={},c=o(function(){return!!u[t]()||f[t]()!=f}),a=i[t]=c?n(h):u[t];r&&(i[r]=a),e(e.P+e.F*c,"String",i)},h=l.trim=function(t,n){return t=String(i(t)),1&n&&(t=t.replace(a,"")),2&n&&(t=t.replace(s,"")),t};n.exports=l},{103:103,27:27,32:32,34:34}],103:[function(t,n,r){n.exports="\t\n\v\f\r   ᠎             　\u2028\u2029\ufeff"},{}],104:[function(t,n,r){var e,i,o,u=t(25),c=t(44),f=t(41),a=t(29),s=t(38),l=s.process,h=s.setImmediate,v=s.clearImmediate,p=s.MessageChannel,d=0,y={},g="onreadystatechange",b=function(){var t=+this;if(y.hasOwnProperty(t)){var n=y[t];delete y[t],n()}},x=function(t){b.call(t.data)};h&&v||(h=function setImmediate(t){for(var n=[],r=1;arguments.length>r;)n.push(arguments[r++]);return y[++d]=function(){c("function"==typeof t?t:Function(t),n)},e(d),d},v=function clearImmediate(t){delete y[t]},"process"==t(18)(l)?e=function(t){l.nextTick(u(b,t,1))}:p?(i=new p,o=i.port2,i.port1.onmessage=x,e=u(o.postMessage,o,1)):s.addEventListener&&"function"==typeof postMessage&&!s.importScripts?(e=function(t){s.postMessage(t+"","*")},s.addEventListener("message",x,!1)):e=g in a("script")?function(t){f.appendChild(a("script"))[g]=function(){f.removeChild(this),b.call(t)}}:function(t){setTimeout(u(b,t,1),0)}),n.exports={set:h,clear:v}},{18:18,25:25,29:29,38:38,41:41,44:44}],105:[function(t,n,r){var e=t(106),i=Math.max,o=Math.min;n.exports=function(t,n){return t=e(t),t<0?i(t+n,0):o(t,n)}},{106:106}],106:[function(t,n,r){var e=Math.ceil,i=Math.floor;n.exports=function(t){return isNaN(t=+t)?0:(t>0?i:e)(t)}},{}],107:[function(t,n,r){var e=t(45),i=t(27);n.exports=function(t){return e(i(t))}},{27:27,45:45}],108:[function(t,n,r){var e=t(106),i=Math.min;n.exports=function(t){return t>0?i(e(t),9007199254740991):0}},{106:106}],109:[function(t,n,r){var e=t(27);n.exports=function(t){return Object(e(t))}},{27:27}],110:[function(t,n,r){var e=t(49);n.exports=function(t,n){if(!e(t))return t;var r,i;if(n&&"function"==typeof(r=t.toString)&&!e(i=r.call(t)))return i;if("function"==typeof(r=t.valueOf)&&!e(i=r.call(t)))return i;if(!n&&"function"==typeof(r=t.toString)&&!e(i=r.call(t)))return i;throw TypeError("Can't convert object to primitive value")}},{49:49}],111:[function(t,n,r){"use strict";if(t(28)){var e=t(58),i=t(38),o=t(34),u=t(32),c=t(113),f=t(112),a=t(25),s=t(6),l=t(85),h=t(40),v=t(86),p=t(106),d=t(108),y=t(105),g=t(110),b=t(39),x=t(89),m=t(17),w=t(49),S=t(109),_=t(46),E=t(66),O=t(74),F=t(72).f,P=t(118),A=t(114),M=t(117),I=t(12),j=t(11),N=t(95),k=t(130),R=t(56),T=t(54),L=t(91),C=t(9),U=t(8),G=t(67),D=t(70),W=G.f,B=D.f,V=i.RangeError,z=i.TypeError,K=i.Uint8Array,J="ArrayBuffer",Y="Shared"+J,q="BYTES_PER_ELEMENT",X="prototype",$=Array[X],H=f.ArrayBuffer,Z=f.DataView,Q=I(0),tt=I(2),nt=I(3),rt=I(4),et=I(5),it=I(6),ot=j(!0),ut=j(!1),ct=k.values,ft=k.keys,at=k.entries,st=$.lastIndexOf,lt=$.reduce,ht=$.reduceRight,vt=$.join,pt=$.sort,dt=$.slice,yt=$.toString,gt=$.toLocaleString,bt=M("iterator"),xt=M("toStringTag"),mt=A("typed_constructor"),wt=A("def_constructor"),St=c.CONSTR,_t=c.TYPED,Et=c.VIEW,Ot="Wrong length!",Ft=I(1,function(t,n){return Nt(N(t,t[wt]),n)}),Pt=o(function(){return 1===new K(new Uint16Array([1]).buffer)[0]}),At=!!K&&!!K[X].set&&o(function(){new K(1).set({})}),Mt=function(t,n){if(void 0===t)throw z(Ot);var r=+t,e=d(t);if(n&&!x(r,e))throw V(Ot);return e},It=function(t,n){var r=p(t);if(r<0||r%n)throw V("Wrong offset!");return r},jt=function(t){if(w(t)&&_t in t)return t;throw z(t+" is not a typed array!")},Nt=function(t,n){if(!(w(t)&&mt in t))throw z("It is not a typed array constructor!");return new t(n)},kt=function(t,n){return Rt(N(t,t[wt]),n)},Rt=function(t,n){for(var r=0,e=n.length,i=Nt(t,e);e>r;)i[r]=n[r++];return i},Tt=function(t,n,r){W(t,n,{get:function(){return this._d[r]}})},Lt=function from(t){var n,r,e,i,o,u,c=S(t),f=arguments.length,s=f>1?arguments[1]:void 0,l=void 0!==s,h=P(c);if(void 0!=h&&!_(h)){for(u=h.call(c),e=[],n=0;!(o=u.next()).done;n++)e.push(o.value);c=e}for(l&&f>2&&(s=a(s,arguments[2],2)),n=0,r=d(c.length),i=Nt(this,r);r>n;n++)i[n]=l?s(c[n],n):c[n];return i},Ct=function of(){for(var t=0,n=arguments.length,r=Nt(this,n);n>t;)r[t]=arguments[t++];return r},Ut=!!K&&o(function(){gt.call(new K(1))}),Gt=function toLocaleString(){return gt.apply(Ut?dt.call(jt(this)):jt(this),arguments)},Dt={copyWithin:function copyWithin(t,n){return U.call(jt(this),t,n,arguments.length>2?arguments[2]:void 0)},every:function every(t){return rt(jt(this),t,arguments.length>1?arguments[1]:void 0)},fill:function fill(t){return C.apply(jt(this),arguments)},filter:function filter(t){return kt(this,tt(jt(this),t,arguments.length>1?arguments[1]:void 0))},find:function find(t){return et(jt(this),t,arguments.length>1?arguments[1]:void 0)},findIndex:function findIndex(t){
return it(jt(this),t,arguments.length>1?arguments[1]:void 0)},forEach:function forEach(t){Q(jt(this),t,arguments.length>1?arguments[1]:void 0)},indexOf:function indexOf(t){return ut(jt(this),t,arguments.length>1?arguments[1]:void 0)},includes:function includes(t){return ot(jt(this),t,arguments.length>1?arguments[1]:void 0)},join:function join(t){return vt.apply(jt(this),arguments)},lastIndexOf:function lastIndexOf(t){return st.apply(jt(this),arguments)},map:function map(t){return Ft(jt(this),t,arguments.length>1?arguments[1]:void 0)},reduce:function reduce(t){return lt.apply(jt(this),arguments)},reduceRight:function reduceRight(t){return ht.apply(jt(this),arguments)},reverse:function reverse(){for(var t,n=this,r=jt(n).length,e=Math.floor(r/2),i=0;i<e;)t=n[i],n[i++]=n[--r],n[r]=t;return n},some:function some(t){return nt(jt(this),t,arguments.length>1?arguments[1]:void 0)},sort:function sort(t){return pt.call(jt(this),t)},subarray:function subarray(t,n){var r=jt(this),e=r.length,i=y(t,e);return new(N(r,r[wt]))(r.buffer,r.byteOffset+i*r.BYTES_PER_ELEMENT,d((void 0===n?e:y(n,e))-i))}},Wt=function slice(t,n){return kt(this,dt.call(jt(this),t,n))},Bt=function set(t){jt(this);var n=It(arguments[1],1),r=this.length,e=S(t),i=d(e.length),o=0;if(i+n>r)throw V(Ot);for(;o<i;)this[n+o]=e[o++]},Vt={entries:function entries(){return at.call(jt(this))},keys:function keys(){return ft.call(jt(this))},values:function values(){return ct.call(jt(this))}},zt=function(t,n){return w(t)&&t[_t]&&"symbol"!=typeof n&&n in t&&String(+n)==String(n)},Kt=function getOwnPropertyDescriptor(t,n){return zt(t,n=g(n,!0))?l(2,t[n]):B(t,n)},Jt=function defineProperty(t,n,r){return!(zt(t,n=g(n,!0))&&w(r)&&b(r,"value"))||b(r,"get")||b(r,"set")||r.configurable||b(r,"writable")&&!r.writable||b(r,"enumerable")&&!r.enumerable?W(t,n,r):(t[n]=r.value,t)};St||(D.f=Kt,G.f=Jt),u(u.S+u.F*!St,"Object",{getOwnPropertyDescriptor:Kt,defineProperty:Jt}),o(function(){yt.call({})})&&(yt=gt=function toString(){return vt.call(this)});var Yt=v({},Dt);v(Yt,Vt),h(Yt,bt,Vt.values),v(Yt,{slice:Wt,set:Bt,constructor:function(){},toString:yt,toLocaleString:Gt}),Tt(Yt,"buffer","b"),Tt(Yt,"byteOffset","o"),Tt(Yt,"byteLength","l"),Tt(Yt,"length","e"),W(Yt,xt,{get:function(){return this[_t]}}),n.exports=function(t,n,r,f){f=!!f;var a=t+(f?"Clamped":"")+"Array",l="Uint8Array"!=a,v="get"+t,p="set"+t,y=i[a],g=y||{},b=y&&O(y),x=!y||!c.ABV,S={},_=y&&y[X],P=function(t,r){var e=t._d;return e.v[v](r*n+e.o,Pt)},A=function(t,r,e){var i=t._d;f&&(e=(e=Math.round(e))<0?0:e>255?255:255&e),i.v[p](r*n+i.o,e,Pt)},M=function(t,n){W(t,n,{get:function(){return P(this,n)},set:function(t){return A(this,n,t)},enumerable:!0})};x?(y=r(function(t,r,e,i){s(t,y,a,"_d");var o,u,c,f,l=0,v=0;if(w(r)){if(!(r instanceof H||(f=m(r))==J||f==Y))return _t in r?Rt(y,r):Lt.call(y,r);o=r,v=It(e,n);var p=r.byteLength;if(void 0===i){if(p%n)throw V(Ot);if(u=p-v,u<0)throw V(Ot)}else if(u=d(i)*n,u+v>p)throw V(Ot);c=u/n}else c=Mt(r,!0),u=c*n,o=new H(u);for(h(t,"_d",{b:o,o:v,l:u,e:c,v:new Z(o)});l<c;)M(t,l++)}),_=y[X]=E(Yt),h(_,"constructor",y)):T(function(t){new y(null),new y(t)},!0)||(y=r(function(t,r,e,i){s(t,y,a);var o;return w(r)?r instanceof H||(o=m(r))==J||o==Y?void 0!==i?new g(r,It(e,n),i):void 0!==e?new g(r,It(e,n)):new g(r):_t in r?Rt(y,r):Lt.call(y,r):new g(Mt(r,l))}),Q(b!==Function.prototype?F(g).concat(F(b)):F(g),function(t){t in y||h(y,t,g[t])}),y[X]=_,e||(_.constructor=y));var I=_[bt],j=!!I&&("values"==I.name||void 0==I.name),N=Vt.values;h(y,mt,!0),h(_,_t,a),h(_,Et,!0),h(_,wt,y),(f?new y(1)[xt]==a:xt in _)||W(_,xt,{get:function(){return a}}),S[a]=y,u(u.G+u.W+u.F*(y!=g),S),u(u.S,a,{BYTES_PER_ELEMENT:n,from:Lt,of:Ct}),q in _||h(_,q,n),u(u.P,a,Dt),L(a),u(u.P+u.F*At,a,{set:Bt}),u(u.P+u.F*!j,a,Vt),u(u.P+u.F*(_.toString!=yt),a,{toString:yt}),u(u.P+u.F*o(function(){new y(1).slice()}),a,{slice:Wt}),u(u.P+u.F*(o(function(){return[1,2].toLocaleString()!=new y([1,2]).toLocaleString()})||!o(function(){_.toLocaleString.call([1,2])})),a,{toLocaleString:Gt}),R[a]=j?I:N,e||j||h(_,bt,N)}}else n.exports=function(){}},{105:105,106:106,108:108,109:109,11:11,110:110,112:112,113:113,114:114,117:117,118:118,12:12,130:130,17:17,25:25,28:28,32:32,34:34,38:38,39:39,40:40,46:46,49:49,54:54,56:56,58:58,6:6,66:66,67:67,70:70,72:72,74:74,8:8,85:85,86:86,89:89,9:9,91:91,95:95}],112:[function(t,n,r){"use strict";var e=t(38),i=t(28),o=t(58),u=t(113),c=t(40),f=t(86),a=t(34),s=t(6),l=t(106),h=t(108),v=t(72).f,p=t(67).f,d=t(9),y=t(92),g="ArrayBuffer",b="DataView",x="prototype",m="Wrong length!",w="Wrong index!",S=e[g],_=e[b],E=e.Math,O=e.RangeError,F=e.Infinity,P=S,A=E.abs,M=E.pow,I=E.floor,j=E.log,N=E.LN2,k="buffer",R="byteLength",T="byteOffset",L=i?"_b":k,C=i?"_l":R,U=i?"_o":T,G=function(t,n,r){var e,i,o,u=Array(r),c=8*r-n-1,f=(1<<c)-1,a=f>>1,s=23===n?M(2,-24)-M(2,-77):0,l=0,h=t<0||0===t&&1/t<0?1:0;for(t=A(t),t!=t||t===F?(i=t!=t?1:0,e=f):(e=I(j(t)/N),t*(o=M(2,-e))<1&&(e--,o*=2),t+=e+a>=1?s/o:s*M(2,1-a),t*o>=2&&(e++,o/=2),e+a>=f?(i=0,e=f):e+a>=1?(i=(t*o-1)*M(2,n),e+=a):(i=t*M(2,a-1)*M(2,n),e=0));n>=8;u[l++]=255&i,i/=256,n-=8);for(e=e<<n|i,c+=n;c>0;u[l++]=255&e,e/=256,c-=8);return u[--l]|=128*h,u},D=function(t,n,r){var e,i=8*r-n-1,o=(1<<i)-1,u=o>>1,c=i-7,f=r-1,a=t[f--],s=127&a;for(a>>=7;c>0;s=256*s+t[f],f--,c-=8);for(e=s&(1<<-c)-1,s>>=-c,c+=n;c>0;e=256*e+t[f],f--,c-=8);if(0===s)s=1-u;else{if(s===o)return e?NaN:a?-F:F;e+=M(2,n),s-=u}return(a?-1:1)*e*M(2,s-n)},W=function(t){return t[3]<<24|t[2]<<16|t[1]<<8|t[0]},B=function(t){return[255&t]},V=function(t){return[255&t,t>>8&255]},z=function(t){return[255&t,t>>8&255,t>>16&255,t>>24&255]},K=function(t){return G(t,52,8)},J=function(t){return G(t,23,4)},Y=function(t,n,r){p(t[x],n,{get:function(){return this[r]}})},q=function(t,n,r,e){var i=+r,o=l(i);if(i!=o||o<0||o+n>t[C])throw O(w);var u=t[L]._b,c=o+t[U],f=u.slice(c,c+n);return e?f:f.reverse()},X=function(t,n,r,e,i,o){var u=+r,c=l(u);if(u!=c||c<0||c+n>t[C])throw O(w);for(var f=t[L]._b,a=c+t[U],s=e(+i),h=0;h<n;h++)f[a+h]=s[o?h:n-h-1]},$=function(t,n){s(t,S,g);var r=+n,e=h(r);if(r!=e)throw O(m);return e};if(u.ABV){if(!a(function(){new S})||!a(function(){new S(.5)})){S=function ArrayBuffer(t){return new P($(this,t))};for(var H,Z=S[x]=P[x],Q=v(P),tt=0;Q.length>tt;)(H=Q[tt++])in S||c(S,H,P[H]);o||(Z.constructor=S)}var nt=new _(new S(2)),rt=_[x].setInt8;nt.setInt8(0,2147483648),nt.setInt8(1,2147483649),!nt.getInt8(0)&&nt.getInt8(1)||f(_[x],{setInt8:function setInt8(t,n){rt.call(this,t,n<<24>>24)},setUint8:function setUint8(t,n){rt.call(this,t,n<<24>>24)}},!0)}else S=function ArrayBuffer(t){var n=$(this,t);this._b=d.call(Array(n),0),this[C]=n},_=function DataView(t,n,r){s(this,_,b),s(t,S,b);var e=t[C],i=l(n);if(i<0||i>e)throw O("Wrong offset!");if(r=void 0===r?e-i:h(r),i+r>e)throw O(m);this[L]=t,this[U]=i,this[C]=r},i&&(Y(S,R,"_l"),Y(_,k,"_b"),Y(_,R,"_l"),Y(_,T,"_o")),f(_[x],{getInt8:function getInt8(t){return q(this,1,t)[0]<<24>>24},getUint8:function getUint8(t){return q(this,1,t)[0]},getInt16:function getInt16(t){var n=q(this,2,t,arguments[1]);return(n[1]<<8|n[0])<<16>>16},getUint16:function getUint16(t){var n=q(this,2,t,arguments[1]);return n[1]<<8|n[0]},getInt32:function getInt32(t){return W(q(this,4,t,arguments[1]))},getUint32:function getUint32(t){return W(q(this,4,t,arguments[1]))>>>0},getFloat32:function getFloat32(t){return D(q(this,4,t,arguments[1]),23,4)},getFloat64:function getFloat64(t){return D(q(this,8,t,arguments[1]),52,8)},setInt8:function setInt8(t,n){X(this,1,t,B,n)},setUint8:function setUint8(t,n){X(this,1,t,B,n)},setInt16:function setInt16(t,n){X(this,2,t,V,n,arguments[2])},setUint16:function setUint16(t,n){X(this,2,t,V,n,arguments[2])},setInt32:function setInt32(t,n){X(this,4,t,z,n,arguments[2])},setUint32:function setUint32(t,n){X(this,4,t,z,n,arguments[2])},setFloat32:function setFloat32(t,n){X(this,4,t,J,n,arguments[2])},setFloat64:function setFloat64(t,n){X(this,8,t,K,n,arguments[2])}});y(S,g),y(_,b),c(_[x],u.VIEW,!0),r[g]=S,r[b]=_},{106:106,108:108,113:113,28:28,34:34,38:38,40:40,58:58,6:6,67:67,72:72,86:86,9:9,92:92}],113:[function(t,n,r){for(var e,i=t(38),o=t(40),u=t(114),c=u("typed_array"),f=u("view"),a=!(!i.ArrayBuffer||!i.DataView),s=a,l=0,h=9,v="Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array".split(",");l<h;)(e=i[v[l++]])?(o(e.prototype,c,!0),o(e.prototype,f,!0)):s=!1;n.exports={ABV:a,CONSTR:s,TYPED:c,VIEW:f}},{114:114,38:38,40:40}],114:[function(t,n,r){var e=0,i=Math.random();n.exports=function(t){return"Symbol(".concat(void 0===t?"":t,")_",(++e+i).toString(36))}},{}],115:[function(t,n,r){var e=t(38),i=t(23),o=t(58),u=t(116),c=t(67).f;n.exports=function(t){var n=i.Symbol||(i.Symbol=o?{}:e.Symbol||{});"_"==t.charAt(0)||t in n||c(n,t,{value:u.f(t)})}},{116:116,23:23,38:38,58:58,67:67}],116:[function(t,n,r){r.f=t(117)},{117:117}],117:[function(t,n,r){var e=t(94)("wks"),i=t(114),o=t(38).Symbol,u="function"==typeof o,c=n.exports=function(t){return e[t]||(e[t]=u&&o[t]||(u?o:i)("Symbol."+t))};c.store=e},{114:114,38:38,94:94}],118:[function(t,n,r){var e=t(17),i=t(117)("iterator"),o=t(56);n.exports=t(23).getIteratorMethod=function(t){if(void 0!=t)return t[i]||t["@@iterator"]||o[e(t)]}},{117:117,17:17,23:23,56:56}],119:[function(t,n,r){var e=t(32),i=t(88)(/[\\^$*+?.()|[\]{}]/g,"\\$&");e(e.S,"RegExp",{escape:function escape(t){return i(t)}})},{32:32,88:88}],120:[function(t,n,r){var e=t(32);e(e.P,"Array",{copyWithin:t(8)}),t(5)("copyWithin")},{32:32,5:5,8:8}],121:[function(t,n,r){"use strict";var e=t(32),i=t(12)(4);e(e.P+e.F*!t(96)([].every,!0),"Array",{every:function every(t){return i(this,t,arguments[1])}})},{12:12,32:32,96:96}],122:[function(t,n,r){var e=t(32);e(e.P,"Array",{fill:t(9)}),t(5)("fill")},{32:32,5:5,9:9}],123:[function(t,n,r){"use strict";var e=t(32),i=t(12)(2);e(e.P+e.F*!t(96)([].filter,!0),"Array",{filter:function filter(t){return i(this,t,arguments[1])}})},{12:12,32:32,96:96}],124:[function(t,n,r){"use strict";var e=t(32),i=t(12)(6),o="findIndex",u=!0;o in[]&&Array(1)[o](function(){u=!1}),e(e.P+e.F*u,"Array",{findIndex:function findIndex(t){return i(this,t,arguments.length>1?arguments[1]:void 0)}}),t(5)(o)},{12:12,32:32,5:5}],125:[function(t,n,r){"use strict";var e=t(32),i=t(12)(5),o="find",u=!0;o in[]&&Array(1)[o](function(){u=!1}),e(e.P+e.F*u,"Array",{find:function find(t){return i(this,t,arguments.length>1?arguments[1]:void 0)}}),t(5)(o)},{12:12,32:32,5:5}],126:[function(t,n,r){"use strict";var e=t(32),i=t(12)(0),o=t(96)([].forEach,!0);e(e.P+e.F*!o,"Array",{forEach:function forEach(t){return i(this,t,arguments[1])}})},{12:12,32:32,96:96}],127:[function(t,n,r){"use strict";var e=t(25),i=t(32),o=t(109),u=t(51),c=t(46),f=t(108),a=t(24),s=t(118);i(i.S+i.F*!t(54)(function(t){Array.from(t)}),"Array",{from:function from(t){var n,r,i,l,h=o(t),v="function"==typeof this?this:Array,p=arguments.length,d=p>1?arguments[1]:void 0,y=void 0!==d,g=0,b=s(h);if(y&&(d=e(d,p>2?arguments[2]:void 0,2)),void 0==b||v==Array&&c(b))for(n=f(h.length),r=new v(n);n>g;g++)a(r,g,y?d(h[g],g):h[g]);else for(l=b.call(h),r=new v;!(i=l.next()).done;g++)a(r,g,y?u(l,d,[i.value,g],!0):i.value);return r.length=g,r}})},{108:108,109:109,118:118,24:24,25:25,32:32,46:46,51:51,54:54}],128:[function(t,n,r){"use strict";var e=t(32),i=t(11)(!1),o=[].indexOf,u=!!o&&1/[1].indexOf(1,-0)<0;e(e.P+e.F*(u||!t(96)(o)),"Array",{indexOf:function indexOf(t){return u?o.apply(this,arguments)||0:i(this,t,arguments[1])}})},{11:11,32:32,96:96}],129:[function(t,n,r){var e=t(32);e(e.S,"Array",{isArray:t(47)})},{32:32,47:47}],130:[function(t,n,r){"use strict";var e=t(5),i=t(55),o=t(56),u=t(107);n.exports=t(53)(Array,"Array",function(t,n){this._t=u(t),this._i=0,this._k=n},function(){var t=this._t,n=this._k,r=this._i++;return!t||r>=t.length?(this._t=void 0,i(1)):"keys"==n?i(0,r):"values"==n?i(0,t[r]):i(0,[r,t[r]])},"values"),o.Arguments=o.Array,e("keys"),e("values"),e("entries")},{107:107,5:5,53:53,55:55,56:56}],131:[function(t,n,r){"use strict";var e=t(32),i=t(107),o=[].join;e(e.P+e.F*(t(45)!=Object||!t(96)(o)),"Array",{join:function join(t){return o.call(i(this),void 0===t?",":t)}})},{107:107,32:32,45:45,96:96}],132:[function(t,n,r){"use strict";var e=t(32),i=t(107),o=t(106),u=t(108),c=[].lastIndexOf,f=!!c&&1/[1].lastIndexOf(1,-0)<0;e(e.P+e.F*(f||!t(96)(c)),"Array",{lastIndexOf:function lastIndexOf(t){if(f)return c.apply(this,arguments)||0;var n=i(this),r=u(n.length),e=r-1;for(arguments.length>1&&(e=Math.min(e,o(arguments[1]))),e<0&&(e=r+e);e>=0;e--)if(e in n&&n[e]===t)return e||0;return-1}})},{106:106,107:107,108:108,32:32,96:96}],133:[function(t,n,r){"use strict";var e=t(32),i=t(12)(1);e(e.P+e.F*!t(96)([].map,!0),"Array",{map:function map(t){return i(this,t,arguments[1])}})},{12:12,32:32,96:96}],134:[function(t,n,r){"use strict";var e=t(32),i=t(24);e(e.S+e.F*t(34)(function(){function F(){}return!(Array.of.call(F)instanceof F)}),"Array",{of:function of(){for(var t=0,n=arguments.length,r=new("function"==typeof this?this:Array)(n);n>t;)i(r,t,arguments[t++]);return r.length=n,r}})},{24:24,32:32,34:34}],135:[function(t,n,r){"use strict";var e=t(32),i=t(13);e(e.P+e.F*!t(96)([].reduceRight,!0),"Array",{reduceRight:function reduceRight(t){return i(this,t,arguments.length,arguments[1],!0)}})},{13:13,32:32,96:96}],136:[function(t,n,r){"use strict";var e=t(32),i=t(13);e(e.P+e.F*!t(96)([].reduce,!0),"Array",{reduce:function reduce(t){return i(this,t,arguments.length,arguments[1],!1)}})},{13:13,32:32,96:96}],137:[function(t,n,r){"use strict";var e=t(32),i=t(41),o=t(18),u=t(105),c=t(108),f=[].slice;e(e.P+e.F*t(34)(function(){i&&f.call(i)}),"Array",{slice:function slice(t,n){var r=c(this.length),e=o(this);if(n=void 0===n?r:n,"Array"==e)return f.call(this,t,n);for(var i=u(t,r),a=u(n,r),s=c(a-i),l=Array(s),h=0;h<s;h++)l[h]="String"==e?this.charAt(i+h):this[i+h];return l}})},{105:105,108:108,18:18,32:32,34:34,41:41}],138:[function(t,n,r){"use strict";var e=t(32),i=t(12)(3);e(e.P+e.F*!t(96)([].some,!0),"Array",{some:function some(t){return i(this,t,arguments[1])}})},{12:12,32:32,96:96}],139:[function(t,n,r){"use strict";var e=t(32),i=t(3),o=t(109),u=t(34),c=[].sort,f=[1,2,3];e(e.P+e.F*(u(function(){f.sort(void 0)})||!u(function(){f.sort(null)})||!t(96)(c)),"Array",{sort:function sort(t){return void 0===t?c.call(o(this)):c.call(o(this),i(t))}})},{109:109,3:3,32:32,34:34,96:96}],140:[function(t,n,r){t(91)("Array")},{91:91}],141:[function(t,n,r){var e=t(32);e(e.S,"Date",{now:function(){return(new Date).getTime()}})},{32:32}],142:[function(t,n,r){"use strict";var e=t(32),i=t(34),o=Date.prototype.getTime,u=function(t){return t>9?t:"0"+t};e(e.P+e.F*(i(function(){return"0385-07-25T07:06:39.999Z"!=new Date(-5e13-1).toISOString()})||!i(function(){new Date(NaN).toISOString()})),"Date",{toISOString:function toISOString(){if(!isFinite(o.call(this)))throw RangeError("Invalid time value");var t=this,n=t.getUTCFullYear(),r=t.getUTCMilliseconds(),e=n<0?"-":n>9999?"+":"";return e+("00000"+Math.abs(n)).slice(e?-6:-4)+"-"+u(t.getUTCMonth()+1)+"-"+u(t.getUTCDate())+"T"+u(t.getUTCHours())+":"+u(t.getUTCMinutes())+":"+u(t.getUTCSeconds())+"."+(r>99?r:"0"+u(r))+"Z"}})},{32:32,34:34}],143:[function(t,n,r){"use strict";var e=t(32),i=t(109),o=t(110);e(e.P+e.F*t(34)(function(){return null!==new Date(NaN).toJSON()||1!==Date.prototype.toJSON.call({toISOString:function(){return 1}})}),"Date",{toJSON:function toJSON(t){var n=i(this),r=o(n);return"number"!=typeof r||isFinite(r)?n.toISOString():null}})},{109:109,110:110,32:32,34:34}],144:[function(t,n,r){var e=t(117)("toPrimitive"),i=Date.prototype;e in i||t(40)(i,e,t(26))},{117:117,26:26,40:40}],145:[function(t,n,r){var e=Date.prototype,i="Invalid Date",o="toString",u=e[o],c=e.getTime;new Date(NaN)+""!=i&&t(87)(e,o,function toString(){var t=c.call(this);return t===t?u.call(this):i})},{87:87}],146:[function(t,n,r){var e=t(32);e(e.P,"Function",{bind:t(16)})},{16:16,32:32}],147:[function(t,n,r){"use strict";var e=t(49),i=t(74),o=t(117)("hasInstance"),u=Function.prototype;o in u||t(67).f(u,o,{value:function(t){if("function"!=typeof this||!e(t))return!1;if(!e(this.prototype))return t instanceof this;for(;t=i(t);)if(this.prototype===t)return!0;return!1}})},{117:117,49:49,67:67,74:74}],148:[function(t,n,r){var e=t(67).f,i=t(85),o=t(39),u=Function.prototype,c=/^\s*function ([^ (]*)/,f="name",a=Object.isExtensible||function(){return!0};f in u||t(28)&&e(u,f,{configurable:!0,get:function(){try{var t=this,n=(""+t).match(c)[1];return o(t,f)||!a(t)||e(t,f,i(5,n)),n}catch(t){return""}}})},{28:28,39:39,67:67,85:85}],149:[function(t,n,r){"use strict";var e=t(19);n.exports=t(22)("Map",function(t){return function Map(){return t(this,arguments.length>0?arguments[0]:void 0)}},{get:function get(t){var n=e.getEntry(this,t);return n&&n.v},set:function set(t,n){return e.def(this,0===t?0:t,n)}},e,!0)},{19:19,22:22}],150:[function(t,n,r){var e=t(32),i=t(60),o=Math.sqrt,u=Math.acosh;e(e.S+e.F*!(u&&710==Math.floor(u(Number.MAX_VALUE))&&u(1/0)==1/0),"Math",{acosh:function acosh(t){return(t=+t)<1?NaN:t>94906265.62425156?Math.log(t)+Math.LN2:i(t-1+o(t-1)*o(t+1))}})},{32:32,60:60}],151:[function(t,n,r){function asinh(t){return isFinite(t=+t)&&0!=t?t<0?-asinh(-t):Math.log(t+Math.sqrt(t*t+1)):t}var e=t(32),i=Math.asinh;e(e.S+e.F*!(i&&1/i(0)>0),"Math",{asinh:asinh})},{32:32}],152:[function(t,n,r){var e=t(32),i=Math.atanh;e(e.S+e.F*!(i&&1/i(-0)<0),"Math",{atanh:function atanh(t){return 0==(t=+t)?t:Math.log((1+t)/(1-t))/2}})},{32:32}],153:[function(t,n,r){var e=t(32),i=t(61);e(e.S,"Math",{cbrt:function cbrt(t){return i(t=+t)*Math.pow(Math.abs(t),1/3)}})},{32:32,61:61}],154:[function(t,n,r){var e=t(32);e(e.S,"Math",{clz32:function clz32(t){return(t>>>=0)?31-Math.floor(Math.log(t+.5)*Math.LOG2E):32}})},{32:32}],155:[function(t,n,r){var e=t(32),i=Math.exp;e(e.S,"Math",{cosh:function cosh(t){return(i(t=+t)+i(-t))/2}})},{32:32}],156:[function(t,n,r){var e=t(32),i=t(59);e(e.S+e.F*(i!=Math.expm1),"Math",{expm1:i})},{32:32,59:59}],157:[function(t,n,r){var e=t(32),i=t(61),o=Math.pow,u=o(2,-52),c=o(2,-23),f=o(2,127)*(2-c),a=o(2,-126),s=function(t){return t+1/u-1/u};e(e.S,"Math",{fround:function fround(t){var n,r,e=Math.abs(t),o=i(t);return e<a?o*s(e/a/c)*a*c:(n=(1+c/u)*e,r=n-(n-e),r>f||r!=r?o*(1/0):o*r)}})},{32:32,61:61}],158:[function(t,n,r){var e=t(32),i=Math.abs;e(e.S,"Math",{hypot:function hypot(t,n){for(var r,e,o=0,u=0,c=arguments.length,f=0;u<c;)r=i(arguments[u++]),f<r?(e=f/r,o=o*e*e+1,f=r):r>0?(e=r/f,o+=e*e):o+=r;return f===1/0?1/0:f*Math.sqrt(o)}})},{32:32}],159:[function(t,n,r){var e=t(32),i=Math.imul;e(e.S+e.F*t(34)(function(){return i(4294967295,5)!=-5||2!=i.length}),"Math",{imul:function imul(t,n){var r=65535,e=+t,i=+n,o=r&e,u=r&i;return 0|o*u+((r&e>>>16)*u+o*(r&i>>>16)<<16>>>0)}})},{32:32,34:34}],160:[function(t,n,r){var e=t(32);e(e.S,"Math",{log10:function log10(t){return Math.log(t)/Math.LN10}})},{32:32}],161:[function(t,n,r){var e=t(32);e(e.S,"Math",{log1p:t(60)})},{32:32,60:60}],162:[function(t,n,r){var e=t(32);e(e.S,"Math",{log2:function log2(t){return Math.log(t)/Math.LN2}})},{32:32}],163:[function(t,n,r){var e=t(32);e(e.S,"Math",{sign:t(61)})},{32:32,61:61}],164:[function(t,n,r){var e=t(32),i=t(59),o=Math.exp;e(e.S+e.F*t(34)(function(){return!Math.sinh(-2e-17)!=-2e-17}),"Math",{sinh:function sinh(t){return Math.abs(t=+t)<1?(i(t)-i(-t))/2:(o(t-1)-o(-t-1))*(Math.E/2)}})},{32:32,34:34,59:59}],165:[function(t,n,r){var e=t(32),i=t(59),o=Math.exp;e(e.S,"Math",{tanh:function tanh(t){var n=i(t=+t),r=i(-t);return n==1/0?1:r==1/0?-1:(n-r)/(o(t)+o(-t))}})},{32:32,59:59}],166:[function(t,n,r){var e=t(32);e(e.S,"Math",{trunc:function trunc(t){return(t>0?Math.floor:Math.ceil)(t)}})},{32:32}],167:[function(t,n,r){"use strict";var e=t(38),i=t(39),o=t(18),u=t(43),c=t(110),f=t(34),a=t(72).f,s=t(70).f,l=t(67).f,h=t(102).trim,v="Number",p=e[v],d=p,y=p.prototype,g=o(t(66)(y))==v,b="trim"in String.prototype,x=function(t){var n=c(t,!1);if("string"==typeof n&&n.length>2){n=b?n.trim():h(n,3);var r,e,i,o=n.charCodeAt(0);if(43===o||45===o){if(r=n.charCodeAt(2),88===r||120===r)return NaN}else if(48===o){switch(n.charCodeAt(1)){case 66:case 98:e=2,i=49;break;case 79:case 111:e=8,i=55;break;default:return+n}for(var u,f=n.slice(2),a=0,s=f.length;a<s;a++)if(u=f.charCodeAt(a),u<48||u>i)return NaN;return parseInt(f,e)}}return+n};if(!p(" 0o1")||!p("0b1")||p("+0x1")){p=function Number(t){var n=arguments.length<1?0:t,r=this;return r instanceof p&&(g?f(function(){y.valueOf.call(r)}):o(r)!=v)?u(new d(x(n)),r,p):x(n)};for(var m,w=t(28)?a(d):"MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger".split(","),S=0;w.length>S;S++)i(d,m=w[S])&&!i(p,m)&&l(p,m,s(d,m));p.prototype=y,y.constructor=p,t(87)(e,v,p)}},{102:102,110:110,18:18,28:28,34:34,38:38,39:39,43:43,66:66,67:67,70:70,72:72,87:87}],168:[function(t,n,r){var e=t(32);e(e.S,"Number",{EPSILON:Math.pow(2,-52)})},{32:32}],169:[function(t,n,r){var e=t(32),i=t(38).isFinite;e(e.S,"Number",{isFinite:function isFinite(t){return"number"==typeof t&&i(t)}})},{32:32,38:38}],170:[function(t,n,r){var e=t(32);e(e.S,"Number",{isInteger:t(48)})},{32:32,48:48}],171:[function(t,n,r){var e=t(32);e(e.S,"Number",{isNaN:function isNaN(t){return t!=t}})},{32:32}],172:[function(t,n,r){var e=t(32),i=t(48),o=Math.abs;e(e.S,"Number",{isSafeInteger:function isSafeInteger(t){return i(t)&&o(t)<=9007199254740991}})},{32:32,48:48}],173:[function(t,n,r){var e=t(32);e(e.S,"Number",{MAX_SAFE_INTEGER:9007199254740991})},{32:32}],174:[function(t,n,r){var e=t(32);e(e.S,"Number",{MIN_SAFE_INTEGER:-9007199254740991})},{32:32}],175:[function(t,n,r){var e=t(32),i=t(81);e(e.S+e.F*(Number.parseFloat!=i),"Number",{parseFloat:i})},{32:32,81:81}],176:[function(t,n,r){var e=t(32),i=t(82);e(e.S+e.F*(Number.parseInt!=i),"Number",{parseInt:i})},{32:32,82:82}],177:[function(t,n,r){"use strict";var e=t(32),i=t(106),o=t(4),u=t(101),c=1..toFixed,f=Math.floor,a=[0,0,0,0,0,0],s="Number.toFixed: incorrect invocation!",l="0",h=function(t,n){for(var r=-1,e=n;++r<6;)e+=t*a[r],a[r]=e%1e7,e=f(e/1e7)},v=function(t){for(var n=6,r=0;--n>=0;)r+=a[n],a[n]=f(r/t),r=r%t*1e7},p=function(){for(var t=6,n="";--t>=0;)if(""!==n||0===t||0!==a[t]){var r=String(a[t]);n=""===n?r:n+u.call(l,7-r.length)+r}return n},d=function(t,n,r){return 0===n?r:n%2===1?d(t,n-1,r*t):d(t*t,n/2,r)},y=function(t){for(var n=0,r=t;r>=4096;)n+=12,r/=4096;for(;r>=2;)n+=1,r/=2;return n};e(e.P+e.F*(!!c&&("0.000"!==8e-5.toFixed(3)||"1"!==.9.toFixed(0)||"1.25"!==1.255.toFixed(2)||"1000000000000000128"!==(0xde0b6b3a7640080).toFixed(0))||!t(34)(function(){c.call({})})),"Number",{toFixed:function toFixed(t){var n,r,e,c,f=o(this,s),a=i(t),g="",b=l;if(a<0||a>20)throw RangeError(s);if(f!=f)return"NaN";if(f<=-1e21||f>=1e21)return String(f);if(f<0&&(g="-",f=-f),f>1e-21)if(n=y(f*d(2,69,1))-69,r=n<0?f*d(2,-n,1):f/d(2,n,1),r*=4503599627370496,n=52-n,n>0){for(h(0,r),e=a;e>=7;)h(1e7,0),e-=7;for(h(d(10,e,1),0),e=n-1;e>=23;)v(1<<23),e-=23;v(1<<e),h(1,1),v(2),b=p()}else h(0,r),h(1<<-n,0),b=p()+u.call(l,a);return a>0?(c=b.length,b=g+(c<=a?"0."+u.call(l,a-c)+b:b.slice(0,c-a)+"."+b.slice(c-a))):b=g+b,b}})},{101:101,106:106,32:32,34:34,4:4}],178:[function(t,n,r){"use strict";var e=t(32),i=t(34),o=t(4),u=1..toPrecision;e(e.P+e.F*(i(function(){return"1"!==u.call(1,void 0)})||!i(function(){u.call({})})),"Number",{toPrecision:function toPrecision(t){var n=o(this,"Number#toPrecision: incorrect invocation!");return void 0===t?u.call(n):u.call(n,t)}})},{32:32,34:34,4:4}],179:[function(t,n,r){var e=t(32);e(e.S+e.F,"Object",{assign:t(65)})},{32:32,65:65}],180:[function(t,n,r){var e=t(32);e(e.S,"Object",{create:t(66)})},{32:32,66:66}],181:[function(t,n,r){var e=t(32);e(e.S+e.F*!t(28),"Object",{defineProperties:t(68)})},{28:28,32:32,68:68}],182:[function(t,n,r){var e=t(32);e(e.S+e.F*!t(28),"Object",{defineProperty:t(67).f})},{28:28,32:32,67:67}],183:[function(t,n,r){var e=t(49),i=t(62).onFreeze;t(78)("freeze",function(t){return function freeze(n){return t&&e(n)?t(i(n)):n}})},{49:49,62:62,78:78}],184:[function(t,n,r){var e=t(107),i=t(70).f;t(78)("getOwnPropertyDescriptor",function(){return function getOwnPropertyDescriptor(t,n){return i(e(t),n)}})},{107:107,70:70,78:78}],185:[function(t,n,r){t(78)("getOwnPropertyNames",function(){return t(71).f})},{71:71,78:78}],186:[function(t,n,r){var e=t(109),i=t(74);t(78)("getPrototypeOf",function(){return function getPrototypeOf(t){return i(e(t))}})},{109:109,74:74,78:78}],187:[function(t,n,r){var e=t(49);t(78)("isExtensible",function(t){return function isExtensible(n){return!!e(n)&&(!t||t(n))}})},{49:49,78:78}],188:[function(t,n,r){var e=t(49);t(78)("isFrozen",function(t){return function isFrozen(n){return!e(n)||!!t&&t(n)}})},{49:49,78:78}],189:[function(t,n,r){var e=t(49);t(78)("isSealed",function(t){return function isSealed(n){return!e(n)||!!t&&t(n)}})},{49:49,78:78}],190:[function(t,n,r){var e=t(32);e(e.S,"Object",{is:t(89)})},{32:32,89:89}],191:[function(t,n,r){var e=t(109),i=t(76);t(78)("keys",function(){return function keys(t){return i(e(t))}})},{109:109,76:76,78:78}],192:[function(t,n,r){var e=t(49),i=t(62).onFreeze;t(78)("preventExtensions",function(t){return function preventExtensions(n){return t&&e(n)?t(i(n)):n}})},{49:49,62:62,78:78}],193:[function(t,n,r){var e=t(49),i=t(62).onFreeze;t(78)("seal",function(t){return function seal(n){return t&&e(n)?t(i(n)):n}})},{49:49,62:62,78:78}],194:[function(t,n,r){var e=t(32);e(e.S,"Object",{setPrototypeOf:t(90).set})},{32:32,90:90}],195:[function(t,n,r){"use strict";var e=t(17),i={};i[t(117)("toStringTag")]="z",i+""!="[object z]"&&t(87)(Object.prototype,"toString",function toString(){return"[object "+e(this)+"]"},!0)},{117:117,17:17,87:87}],196:[function(t,n,r){var e=t(32),i=t(81);e(e.G+e.F*(parseFloat!=i),{parseFloat:i})},{32:32,81:81}],197:[function(t,n,r){var e=t(32),i=t(82);e(e.G+e.F*(parseInt!=i),{parseInt:i})},{32:32,82:82}],198:[function(t,n,r){"use strict";var e,i,o,u=t(58),c=t(38),f=t(25),a=t(17),s=t(32),l=t(49),h=t(3),v=t(6),p=t(37),d=t(95),y=t(104).set,g=t(64)(),b="Promise",x=c.TypeError,m=c.process,w=c[b],m=c.process,S="process"==a(m),_=function(){},E=!!function(){try{var n=w.resolve(1),r=(n.constructor={})[t(117)("species")]=function(t){t(_,_)};return(S||"function"==typeof PromiseRejectionEvent)&&n.then(_)instanceof r}catch(t){}}(),O=function(t,n){return t===n||t===w&&n===o},F=function(t){var n;return!(!l(t)||"function"!=typeof(n=t.then))&&n},P=function(t){return O(w,t)?new A(t):new i(t)},A=i=function(t){var n,r;this.promise=new t(function(t,e){if(void 0!==n||void 0!==r)throw x("Bad Promise constructor");n=t,r=e}),this.resolve=h(n),this.reject=h(r)},M=function(t){try{t()}catch(t){return{error:t}}},I=function(t,n){if(!t._n){t._n=!0;var r=t._c;g(function(){for(var e=t._v,i=1==t._s,o=0,u=function(n){var r,o,u=i?n.ok:n.fail,c=n.resolve,f=n.reject,a=n.domain;try{u?(i||(2==t._h&&k(t),t._h=1),u===!0?r=e:(a&&a.enter(),r=u(e),a&&a.exit()),r===n.promise?f(x("Promise-chain cycle")):(o=F(r))?o.call(r,c,f):c(r)):f(e)}catch(t){f(t)}};r.length>o;)u(r[o++]);t._c=[],t._n=!1,n&&!t._h&&j(t)})}},j=function(t){y.call(c,function(){var n,r,e,i=t._v;if(N(t)&&(n=M(function(){S?m.emit("unhandledRejection",i,t):(r=c.onunhandledrejection)?r({promise:t,reason:i}):(e=c.console)&&e.error&&e.error("Unhandled promise rejection",i)}),t._h=S||N(t)?2:1),t._a=void 0,n)throw n.error})},N=function(t){if(1==t._h)return!1;for(var n,r=t._a||t._c,e=0;r.length>e;)if(n=r[e++],n.fail||!N(n.promise))return!1;return!0},k=function(t){y.call(c,function(){var n;S?m.emit("rejectionHandled",t):(n=c.onrejectionhandled)&&n({promise:t,reason:t._v})})},R=function(t){var n=this;n._d||(n._d=!0,n=n._w||n,n._v=t,n._s=2,n._a||(n._a=n._c.slice()),I(n,!0))},T=function(t){var n,r=this;if(!r._d){r._d=!0,r=r._w||r;try{if(r===t)throw x("Promise can't be resolved itself");(n=F(t))?g(function(){var e={_w:r,_d:!1};try{n.call(t,f(T,e,1),f(R,e,1))}catch(t){R.call(e,t)}}):(r._v=t,r._s=1,I(r,!1))}catch(t){R.call({_w:r,_d:!1},t)}}};E||(w=function Promise(t){v(this,w,b,"_h"),h(t),e.call(this);try{t(f(T,this,1),f(R,this,1))}catch(t){R.call(this,t)}},e=function Promise(t){this._c=[],this._a=void 0,this._s=0,this._d=!1,this._v=void 0,this._h=0,this._n=!1},e.prototype=t(86)(w.prototype,{then:function then(t,n){var r=P(d(this,w));return r.ok="function"!=typeof t||t,r.fail="function"==typeof n&&n,r.domain=S?m.domain:void 0,this._c.push(r),this._a&&this._a.push(r),this._s&&I(this,!1),r.promise},catch:function(t){return this.then(void 0,t)}}),A=function(){var t=new e;this.promise=t,this.resolve=f(T,t,1),this.reject=f(R,t,1)}),s(s.G+s.W+s.F*!E,{Promise:w}),t(92)(w,b),t(91)(b),o=t(23)[b],s(s.S+s.F*!E,b,{reject:function reject(t){var n=P(this),r=n.reject;return r(t),n.promise}}),s(s.S+s.F*(u||!E),b,{resolve:function resolve(t){if(t instanceof w&&O(t.constructor,this))return t;var n=P(this),r=n.resolve;return r(t),n.promise}}),s(s.S+s.F*!(E&&t(54)(function(t){w.all(t).catch(_)})),b,{all:function all(t){var n=this,r=P(n),e=r.resolve,i=r.reject,o=M(function(){var r=[],o=0,u=1;p(t,!1,function(t){var c=o++,f=!1;r.push(void 0),u++,n.resolve(t).then(function(t){f||(f=!0,r[c]=t,--u||e(r))},i)}),--u||e(r)});return o&&i(o.error),r.promise},race:function race(t){var n=this,r=P(n),e=r.reject,i=M(function(){p(t,!1,function(t){n.resolve(t).then(r.resolve,e)})});return i&&e(i.error),r.promise}})},{104:104,117:117,17:17,23:23,25:25,3:3,32:32,37:37,38:38,49:49,54:54,58:58,6:6,64:64,86:86,91:91,92:92,95:95}],199:[function(t,n,r){var e=t(32),i=t(3),o=t(7),u=(t(38).Reflect||{}).apply,c=Function.apply;e(e.S+e.F*!t(34)(function(){u(function(){})}),"Reflect",{apply:function apply(t,n,r){var e=i(t),f=o(r);return u?u(e,n,f):c.call(e,n,f)}})},{3:3,32:32,34:34,38:38,7:7}],200:[function(t,n,r){var e=t(32),i=t(66),o=t(3),u=t(7),c=t(49),f=t(34),a=t(16),s=(t(38).Reflect||{}).construct,l=f(function(){function F(){}return!(s(function(){},[],F)instanceof F)}),h=!f(function(){s(function(){})});e(e.S+e.F*(l||h),"Reflect",{construct:function construct(t,n){o(t),u(n);var r=arguments.length<3?t:o(arguments[2]);if(h&&!l)return s(t,n,r);if(t==r){switch(n.length){case 0:return new t;case 1:return new t(n[0]);case 2:return new t(n[0],n[1]);case 3:return new t(n[0],n[1],n[2]);case 4:return new t(n[0],n[1],n[2],n[3])}var e=[null];return e.push.apply(e,n),new(a.apply(t,e))}var f=r.prototype,v=i(c(f)?f:Object.prototype),p=Function.apply.call(t,v,n);return c(p)?p:v}})},{16:16,3:3,32:32,34:34,38:38,49:49,66:66,7:7}],201:[function(t,n,r){var e=t(67),i=t(32),o=t(7),u=t(110);i(i.S+i.F*t(34)(function(){Reflect.defineProperty(e.f({},1,{value:1}),1,{value:2})}),"Reflect",{defineProperty:function defineProperty(t,n,r){o(t),n=u(n,!0),o(r);try{return e.f(t,n,r),!0}catch(t){return!1}}})},{110:110,32:32,34:34,67:67,7:7}],202:[function(t,n,r){var e=t(32),i=t(70).f,o=t(7);e(e.S,"Reflect",{deleteProperty:function deleteProperty(t,n){var r=i(o(t),n);return!(r&&!r.configurable)&&delete t[n]}})},{32:32,7:7,70:70}],203:[function(t,n,r){"use strict";var e=t(32),i=t(7),o=function(t){this._t=i(t),this._i=0;var n,r=this._k=[];for(n in t)r.push(n)};t(52)(o,"Object",function(){var t,n=this,r=n._k;do if(n._i>=r.length)return{value:void 0,done:!0};while(!((t=r[n._i++])in n._t));return{value:t,done:!1}}),e(e.S,"Reflect",{enumerate:function enumerate(t){return new o(t)}})},{32:32,52:52,7:7}],204:[function(t,n,r){var e=t(70),i=t(32),o=t(7);i(i.S,"Reflect",{getOwnPropertyDescriptor:function getOwnPropertyDescriptor(t,n){return e.f(o(t),n)}})},{32:32,7:7,70:70}],205:[function(t,n,r){var e=t(32),i=t(74),o=t(7);e(e.S,"Reflect",{getPrototypeOf:function getPrototypeOf(t){return i(o(t))}})},{32:32,7:7,74:74}],206:[function(t,n,r){function get(t,n){var r,u,a=arguments.length<3?t:arguments[2];return f(t)===a?t[n]:(r=e.f(t,n))?o(r,"value")?r.value:void 0!==r.get?r.get.call(a):void 0:c(u=i(t))?get(u,n,a):void 0}var e=t(70),i=t(74),o=t(39),u=t(32),c=t(49),f=t(7);u(u.S,"Reflect",{get:get})},{32:32,39:39,49:49,7:7,70:70,74:74}],207:[function(t,n,r){var e=t(32);e(e.S,"Reflect",{has:function has(t,n){return n in t;
}})},{32:32}],208:[function(t,n,r){var e=t(32),i=t(7),o=Object.isExtensible;e(e.S,"Reflect",{isExtensible:function isExtensible(t){return i(t),!o||o(t)}})},{32:32,7:7}],209:[function(t,n,r){var e=t(32);e(e.S,"Reflect",{ownKeys:t(80)})},{32:32,80:80}],210:[function(t,n,r){var e=t(32),i=t(7),o=Object.preventExtensions;e(e.S,"Reflect",{preventExtensions:function preventExtensions(t){i(t);try{return o&&o(t),!0}catch(t){return!1}}})},{32:32,7:7}],211:[function(t,n,r){var e=t(32),i=t(90);i&&e(e.S,"Reflect",{setPrototypeOf:function setPrototypeOf(t,n){i.check(t,n);try{return i.set(t,n),!0}catch(t){return!1}}})},{32:32,90:90}],212:[function(t,n,r){function set(t,n,r){var c,l,h=arguments.length<4?t:arguments[3],v=i.f(a(t),n);if(!v){if(s(l=o(t)))return set(l,n,r,h);v=f(0)}return u(v,"value")?!(v.writable===!1||!s(h))&&(c=i.f(h,n)||f(0),c.value=r,e.f(h,n,c),!0):void 0!==v.set&&(v.set.call(h,r),!0)}var e=t(67),i=t(70),o=t(74),u=t(39),c=t(32),f=t(85),a=t(7),s=t(49);c(c.S,"Reflect",{set:set})},{32:32,39:39,49:49,67:67,7:7,70:70,74:74,85:85}],213:[function(t,n,r){var e=t(38),i=t(43),o=t(67).f,u=t(72).f,c=t(50),f=t(36),a=e.RegExp,s=a,l=a.prototype,h=/a/g,v=/a/g,p=new a(h)!==h;if(t(28)&&(!p||t(34)(function(){return v[t(117)("match")]=!1,a(h)!=h||a(v)==v||"/a/i"!=a(h,"i")}))){a=function RegExp(t,n){var r=this instanceof a,e=c(t),o=void 0===n;return!r&&e&&t.constructor===a&&o?t:i(p?new s(e&&!o?t.source:t,n):s((e=t instanceof a)?t.source:t,e&&o?f.call(t):n),r?this:l,a)};for(var d=(function(t){t in a||o(a,t,{configurable:!0,get:function(){return s[t]},set:function(n){s[t]=n}})}),y=u(s),g=0;y.length>g;)d(y[g++]);l.constructor=a,a.prototype=l,t(87)(e,"RegExp",a)}t(91)("RegExp")},{117:117,28:28,34:34,36:36,38:38,43:43,50:50,67:67,72:72,87:87,91:91}],214:[function(t,n,r){t(28)&&"g"!=/./g.flags&&t(67).f(RegExp.prototype,"flags",{configurable:!0,get:t(36)})},{28:28,36:36,67:67}],215:[function(t,n,r){t(35)("match",1,function(t,n,r){return[function match(r){"use strict";var e=t(this),i=void 0==r?void 0:r[n];return void 0!==i?i.call(r,e):new RegExp(r)[n](String(e))},r]})},{35:35}],216:[function(t,n,r){t(35)("replace",2,function(t,n,r){return[function replace(e,i){"use strict";var o=t(this),u=void 0==e?void 0:e[n];return void 0!==u?u.call(e,o,i):r.call(String(o),e,i)},r]})},{35:35}],217:[function(t,n,r){t(35)("search",1,function(t,n,r){return[function search(r){"use strict";var e=t(this),i=void 0==r?void 0:r[n];return void 0!==i?i.call(r,e):new RegExp(r)[n](String(e))},r]})},{35:35}],218:[function(t,n,r){t(35)("split",2,function(n,r,e){"use strict";var i=t(50),o=e,u=[].push,c="split",f="length",a="lastIndex";if("c"=="abbc"[c](/(b)*/)[1]||4!="test"[c](/(?:)/,-1)[f]||2!="ab"[c](/(?:ab)*/)[f]||4!="."[c](/(.?)(.?)/)[f]||"."[c](/()()/)[f]>1||""[c](/.?/)[f]){var s=void 0===/()??/.exec("")[1];e=function(t,n){var r=String(this);if(void 0===t&&0===n)return[];if(!i(t))return o.call(r,t,n);var e,c,l,h,v,p=[],d=(t.ignoreCase?"i":"")+(t.multiline?"m":"")+(t.unicode?"u":"")+(t.sticky?"y":""),y=0,g=void 0===n?4294967295:n>>>0,b=new RegExp(t.source,d+"g");for(s||(e=new RegExp("^"+b.source+"$(?!\\s)",d));(c=b.exec(r))&&(l=c.index+c[0][f],!(l>y&&(p.push(r.slice(y,c.index)),!s&&c[f]>1&&c[0].replace(e,function(){for(v=1;v<arguments[f]-2;v++)void 0===arguments[v]&&(c[v]=void 0)}),c[f]>1&&c.index<r[f]&&u.apply(p,c.slice(1)),h=c[0][f],y=l,p[f]>=g)));)b[a]===c.index&&b[a]++;return y===r[f]?!h&&b.test("")||p.push(""):p.push(r.slice(y)),p[f]>g?p.slice(0,g):p}}else"0"[c](void 0,0)[f]&&(e=function(t,n){return void 0===t&&0===n?[]:o.call(this,t,n)});return[function split(t,i){var o=n(this),u=void 0==t?void 0:t[r];return void 0!==u?u.call(t,o,i):e.call(String(o),t,i)},e]})},{35:35,50:50}],219:[function(t,n,r){"use strict";t(214);var e=t(7),i=t(36),o=t(28),u="toString",c=/./[u],f=function(n){t(87)(RegExp.prototype,u,n,!0)};t(34)(function(){return"/a/b"!=c.call({source:"a",flags:"b"})})?f(function toString(){var t=e(this);return"/".concat(t.source,"/","flags"in t?t.flags:!o&&t instanceof RegExp?i.call(t):void 0)}):c.name!=u&&f(function toString(){return c.call(this)})},{214:214,28:28,34:34,36:36,7:7,87:87}],220:[function(t,n,r){"use strict";var e=t(19);n.exports=t(22)("Set",function(t){return function Set(){return t(this,arguments.length>0?arguments[0]:void 0)}},{add:function add(t){return e.def(this,t=0===t?0:t,t)}},e)},{19:19,22:22}],221:[function(t,n,r){"use strict";t(99)("anchor",function(t){return function anchor(n){return t(this,"a","name",n)}})},{99:99}],222:[function(t,n,r){"use strict";t(99)("big",function(t){return function big(){return t(this,"big","","")}})},{99:99}],223:[function(t,n,r){"use strict";t(99)("blink",function(t){return function blink(){return t(this,"blink","","")}})},{99:99}],224:[function(t,n,r){"use strict";t(99)("bold",function(t){return function bold(){return t(this,"b","","")}})},{99:99}],225:[function(t,n,r){"use strict";var e=t(32),i=t(97)(!1);e(e.P,"String",{codePointAt:function codePointAt(t){return i(this,t)}})},{32:32,97:97}],226:[function(t,n,r){"use strict";var e=t(32),i=t(108),o=t(98),u="endsWith",c=""[u];e(e.P+e.F*t(33)(u),"String",{endsWith:function endsWith(t){var n=o(this,t,u),r=arguments.length>1?arguments[1]:void 0,e=i(n.length),f=void 0===r?e:Math.min(i(r),e),a=String(t);return c?c.call(n,a,f):n.slice(f-a.length,f)===a}})},{108:108,32:32,33:33,98:98}],227:[function(t,n,r){"use strict";t(99)("fixed",function(t){return function fixed(){return t(this,"tt","","")}})},{99:99}],228:[function(t,n,r){"use strict";t(99)("fontcolor",function(t){return function fontcolor(n){return t(this,"font","color",n)}})},{99:99}],229:[function(t,n,r){"use strict";t(99)("fontsize",function(t){return function fontsize(n){return t(this,"font","size",n)}})},{99:99}],230:[function(t,n,r){var e=t(32),i=t(105),o=String.fromCharCode,u=String.fromCodePoint;e(e.S+e.F*(!!u&&1!=u.length),"String",{fromCodePoint:function fromCodePoint(t){for(var n,r=[],e=arguments.length,u=0;e>u;){if(n=+arguments[u++],i(n,1114111)!==n)throw RangeError(n+" is not a valid code point");r.push(n<65536?o(n):o(((n-=65536)>>10)+55296,n%1024+56320))}return r.join("")}})},{105:105,32:32}],231:[function(t,n,r){"use strict";var e=t(32),i=t(98),o="includes";e(e.P+e.F*t(33)(o),"String",{includes:function includes(t){return!!~i(this,t,o).indexOf(t,arguments.length>1?arguments[1]:void 0)}})},{32:32,33:33,98:98}],232:[function(t,n,r){"use strict";t(99)("italics",function(t){return function italics(){return t(this,"i","","")}})},{99:99}],233:[function(t,n,r){"use strict";var e=t(97)(!0);t(53)(String,"String",function(t){this._t=String(t),this._i=0},function(){var t,n=this._t,r=this._i;return r>=n.length?{value:void 0,done:!0}:(t=e(n,r),this._i+=t.length,{value:t,done:!1})})},{53:53,97:97}],234:[function(t,n,r){"use strict";t(99)("link",function(t){return function link(n){return t(this,"a","href",n)}})},{99:99}],235:[function(t,n,r){var e=t(32),i=t(107),o=t(108);e(e.S,"String",{raw:function raw(t){for(var n=i(t.raw),r=o(n.length),e=arguments.length,u=[],c=0;r>c;)u.push(String(n[c++])),c<e&&u.push(String(arguments[c]));return u.join("")}})},{107:107,108:108,32:32}],236:[function(t,n,r){var e=t(32);e(e.P,"String",{repeat:t(101)})},{101:101,32:32}],237:[function(t,n,r){"use strict";t(99)("small",function(t){return function small(){return t(this,"small","","")}})},{99:99}],238:[function(t,n,r){"use strict";var e=t(32),i=t(108),o=t(98),u="startsWith",c=""[u];e(e.P+e.F*t(33)(u),"String",{startsWith:function startsWith(t){var n=o(this,t,u),r=i(Math.min(arguments.length>1?arguments[1]:void 0,n.length)),e=String(t);return c?c.call(n,e,r):n.slice(r,r+e.length)===e}})},{108:108,32:32,33:33,98:98}],239:[function(t,n,r){"use strict";t(99)("strike",function(t){return function strike(){return t(this,"strike","","")}})},{99:99}],240:[function(t,n,r){"use strict";t(99)("sub",function(t){return function sub(){return t(this,"sub","","")}})},{99:99}],241:[function(t,n,r){"use strict";t(99)("sup",function(t){return function sup(){return t(this,"sup","","")}})},{99:99}],242:[function(t,n,r){"use strict";t(102)("trim",function(t){return function trim(){return t(this,3)}})},{102:102}],243:[function(t,n,r){"use strict";var e=t(38),i=t(39),o=t(28),u=t(32),c=t(87),f=t(62).KEY,a=t(34),s=t(94),l=t(92),h=t(114),v=t(117),p=t(116),d=t(115),y=t(57),g=t(31),b=t(47),x=t(7),m=t(107),w=t(110),S=t(85),_=t(66),E=t(71),O=t(70),F=t(67),P=t(76),A=O.f,M=F.f,I=E.f,j=e.Symbol,N=e.JSON,k=N&&N.stringify,R="prototype",T=v("_hidden"),L=v("toPrimitive"),C={}.propertyIsEnumerable,U=s("symbol-registry"),G=s("symbols"),D=s("op-symbols"),W=Object[R],B="function"==typeof j,V=e.QObject,z=!V||!V[R]||!V[R].findChild,K=o&&a(function(){return 7!=_(M({},"a",{get:function(){return M(this,"a",{value:7}).a}})).a})?function(t,n,r){var e=A(W,n);e&&delete W[n],M(t,n,r),e&&t!==W&&M(W,n,e)}:M,J=function(t){var n=G[t]=_(j[R]);return n._k=t,n},Y=B&&"symbol"==typeof j.iterator?function(t){return"symbol"==typeof t}:function(t){return t instanceof j},q=function defineProperty(t,n,r){return t===W&&q(D,n,r),x(t),n=w(n,!0),x(r),i(G,n)?(r.enumerable?(i(t,T)&&t[T][n]&&(t[T][n]=!1),r=_(r,{enumerable:S(0,!1)})):(i(t,T)||M(t,T,S(1,{})),t[T][n]=!0),K(t,n,r)):M(t,n,r)},X=function defineProperties(t,n){x(t);for(var r,e=g(n=m(n)),i=0,o=e.length;o>i;)q(t,r=e[i++],n[r]);return t},$=function create(t,n){return void 0===n?_(t):X(_(t),n)},H=function propertyIsEnumerable(t){var n=C.call(this,t=w(t,!0));return!(this===W&&i(G,t)&&!i(D,t))&&(!(n||!i(this,t)||!i(G,t)||i(this,T)&&this[T][t])||n)},Z=function getOwnPropertyDescriptor(t,n){if(t=m(t),n=w(n,!0),t!==W||!i(G,n)||i(D,n)){var r=A(t,n);return!r||!i(G,n)||i(t,T)&&t[T][n]||(r.enumerable=!0),r}},Q=function getOwnPropertyNames(t){for(var n,r=I(m(t)),e=[],o=0;r.length>o;)i(G,n=r[o++])||n==T||n==f||e.push(n);return e},tt=function getOwnPropertySymbols(t){for(var n,r=t===W,e=I(r?D:m(t)),o=[],u=0;e.length>u;)!i(G,n=e[u++])||r&&!i(W,n)||o.push(G[n]);return o};B||(j=function Symbol(){if(this instanceof j)throw TypeError("Symbol is not a constructor!");var t=h(arguments.length>0?arguments[0]:void 0),n=function(r){this===W&&n.call(D,r),i(this,T)&&i(this[T],t)&&(this[T][t]=!1),K(this,t,S(1,r))};return o&&z&&K(W,t,{configurable:!0,set:n}),J(t)},c(j[R],"toString",function toString(){return this._k}),O.f=Z,F.f=q,t(72).f=E.f=Q,t(77).f=H,t(73).f=tt,o&&!t(58)&&c(W,"propertyIsEnumerable",H,!0),p.f=function(t){return J(v(t))}),u(u.G+u.W+u.F*!B,{Symbol:j});for(var nt="hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables".split(","),rt=0;nt.length>rt;)v(nt[rt++]);for(var nt=P(v.store),rt=0;nt.length>rt;)d(nt[rt++]);u(u.S+u.F*!B,"Symbol",{for:function(t){return i(U,t+="")?U[t]:U[t]=j(t)},keyFor:function keyFor(t){if(Y(t))return y(U,t);throw TypeError(t+" is not a symbol!")},useSetter:function(){z=!0},useSimple:function(){z=!1}}),u(u.S+u.F*!B,"Object",{create:$,defineProperty:q,defineProperties:X,getOwnPropertyDescriptor:Z,getOwnPropertyNames:Q,getOwnPropertySymbols:tt}),N&&u(u.S+u.F*(!B||a(function(){var t=j();return"[null]"!=k([t])||"{}"!=k({a:t})||"{}"!=k(Object(t))})),"JSON",{stringify:function stringify(t){if(void 0!==t&&!Y(t)){for(var n,r,e=[t],i=1;arguments.length>i;)e.push(arguments[i++]);return n=e[1],"function"==typeof n&&(r=n),!r&&b(n)||(n=function(t,n){if(r&&(n=r.call(this,t,n)),!Y(n))return n}),e[1]=n,k.apply(N,e)}}}),j[R][L]||t(40)(j[R],L,j[R].valueOf),l(j,"Symbol"),l(Math,"Math",!0),l(e.JSON,"JSON",!0)},{107:107,110:110,114:114,115:115,116:116,117:117,28:28,31:31,32:32,34:34,38:38,39:39,40:40,47:47,57:57,58:58,62:62,66:66,67:67,7:7,70:70,71:71,72:72,73:73,76:76,77:77,85:85,87:87,92:92,94:94}],244:[function(t,n,r){"use strict";var e=t(32),i=t(113),o=t(112),u=t(7),c=t(105),f=t(108),a=t(49),s=t(38).ArrayBuffer,l=t(95),h=o.ArrayBuffer,v=o.DataView,p=i.ABV&&s.isView,d=h.prototype.slice,y=i.VIEW,g="ArrayBuffer";e(e.G+e.W+e.F*(s!==h),{ArrayBuffer:h}),e(e.S+e.F*!i.CONSTR,g,{isView:function isView(t){return p&&p(t)||a(t)&&y in t}}),e(e.P+e.U+e.F*t(34)(function(){return!new h(2).slice(1,void 0).byteLength}),g,{slice:function slice(t,n){if(void 0!==d&&void 0===n)return d.call(u(this),t);for(var r=u(this).byteLength,e=c(t,r),i=c(void 0===n?r:n,r),o=new(l(this,h))(f(i-e)),a=new v(this),s=new v(o),p=0;e<i;)s.setUint8(p++,a.getUint8(e++));return o}}),t(91)(g)},{105:105,108:108,112:112,113:113,32:32,34:34,38:38,49:49,7:7,91:91,95:95}],245:[function(t,n,r){var e=t(32);e(e.G+e.W+e.F*!t(113).ABV,{DataView:t(112).DataView})},{112:112,113:113,32:32}],246:[function(t,n,r){t(111)("Float32",4,function(t){return function Float32Array(n,r,e){return t(this,n,r,e)}})},{111:111}],247:[function(t,n,r){t(111)("Float64",8,function(t){return function Float64Array(n,r,e){return t(this,n,r,e)}})},{111:111}],248:[function(t,n,r){t(111)("Int16",2,function(t){return function Int16Array(n,r,e){return t(this,n,r,e)}})},{111:111}],249:[function(t,n,r){t(111)("Int32",4,function(t){return function Int32Array(n,r,e){return t(this,n,r,e)}})},{111:111}],250:[function(t,n,r){t(111)("Int8",1,function(t){return function Int8Array(n,r,e){return t(this,n,r,e)}})},{111:111}],251:[function(t,n,r){t(111)("Uint16",2,function(t){return function Uint16Array(n,r,e){return t(this,n,r,e)}})},{111:111}],252:[function(t,n,r){t(111)("Uint32",4,function(t){return function Uint32Array(n,r,e){return t(this,n,r,e)}})},{111:111}],253:[function(t,n,r){t(111)("Uint8",1,function(t){return function Uint8Array(n,r,e){return t(this,n,r,e)}})},{111:111}],254:[function(t,n,r){t(111)("Uint8",1,function(t){return function Uint8ClampedArray(n,r,e){return t(this,n,r,e)}},!0)},{111:111}],255:[function(t,n,r){"use strict";var e,i=t(12)(0),o=t(87),u=t(62),c=t(65),f=t(21),a=t(49),s=u.getWeak,l=Object.isExtensible,h=f.ufstore,v={},p=function(t){return function WeakMap(){return t(this,arguments.length>0?arguments[0]:void 0)}},d={get:function get(t){if(a(t)){var n=s(t);return n===!0?h(this).get(t):n?n[this._i]:void 0}},set:function set(t,n){return f.def(this,t,n)}},y=n.exports=t(22)("WeakMap",p,d,f,!0,!0);7!=(new y).set((Object.freeze||Object)(v),7).get(v)&&(e=f.getConstructor(p),c(e.prototype,d),u.NEED=!0,i(["delete","has","get","set"],function(t){var n=y.prototype,r=n[t];o(n,t,function(n,i){if(a(n)&&!l(n)){this._f||(this._f=new e);var o=this._f[t](n,i);return"set"==t?this:o}return r.call(this,n,i)})}))},{12:12,21:21,22:22,49:49,62:62,65:65,87:87}],256:[function(t,n,r){"use strict";var e=t(21);t(22)("WeakSet",function(t){return function WeakSet(){return t(this,arguments.length>0?arguments[0]:void 0)}},{add:function add(t){return e.def(this,t,!0)}},e,!1,!0)},{21:21,22:22}],257:[function(t,n,r){"use strict";var e=t(32),i=t(11)(!0);e(e.P,"Array",{includes:function includes(t){return i(this,t,arguments.length>1?arguments[1]:void 0)}}),t(5)("includes")},{11:11,32:32,5:5}],258:[function(t,n,r){var e=t(32),i=t(64)(),o=t(38).process,u="process"==t(18)(o);e(e.G,{asap:function asap(t){var n=u&&o.domain;i(n?n.bind(t):t)}})},{18:18,32:32,38:38,64:64}],259:[function(t,n,r){var e=t(32),i=t(18);e(e.S,"Error",{isError:function isError(t){return"Error"===i(t)}})},{18:18,32:32}],260:[function(t,n,r){var e=t(32);e(e.P+e.R,"Map",{toJSON:t(20)("Map")})},{20:20,32:32}],261:[function(t,n,r){var e=t(32);e(e.S,"Math",{iaddh:function iaddh(t,n,r,e){var i=t>>>0,o=n>>>0,u=r>>>0;return o+(e>>>0)+((i&u|(i|u)&~(i+u>>>0))>>>31)|0}})},{32:32}],262:[function(t,n,r){var e=t(32);e(e.S,"Math",{imulh:function imulh(t,n){var r=65535,e=+t,i=+n,o=e&r,u=i&r,c=e>>16,f=i>>16,a=(c*u>>>0)+(o*u>>>16);return c*f+(a>>16)+((o*f>>>0)+(a&r)>>16)}})},{32:32}],263:[function(t,n,r){var e=t(32);e(e.S,"Math",{isubh:function isubh(t,n,r,e){var i=t>>>0,o=n>>>0,u=r>>>0;return o-(e>>>0)-((~i&u|~(i^u)&i-u>>>0)>>>31)|0}})},{32:32}],264:[function(t,n,r){var e=t(32);e(e.S,"Math",{umulh:function umulh(t,n){var r=65535,e=+t,i=+n,o=e&r,u=i&r,c=e>>>16,f=i>>>16,a=(c*u>>>0)+(o*u>>>16);return c*f+(a>>>16)+((o*f>>>0)+(a&r)>>>16)}})},{32:32}],265:[function(t,n,r){"use strict";var e=t(32),i=t(109),o=t(3),u=t(67);t(28)&&e(e.P+t(69),"Object",{__defineGetter__:function __defineGetter__(t,n){u.f(i(this),t,{get:o(n),enumerable:!0,configurable:!0})}})},{109:109,28:28,3:3,32:32,67:67,69:69}],266:[function(t,n,r){"use strict";var e=t(32),i=t(109),o=t(3),u=t(67);t(28)&&e(e.P+t(69),"Object",{__defineSetter__:function __defineSetter__(t,n){u.f(i(this),t,{set:o(n),enumerable:!0,configurable:!0})}})},{109:109,28:28,3:3,32:32,67:67,69:69}],267:[function(t,n,r){var e=t(32),i=t(79)(!0);e(e.S,"Object",{entries:function entries(t){return i(t)}})},{32:32,79:79}],268:[function(t,n,r){var e=t(32),i=t(80),o=t(107),u=t(70),c=t(24);e(e.S,"Object",{getOwnPropertyDescriptors:function getOwnPropertyDescriptors(t){for(var n,r=o(t),e=u.f,f=i(r),a={},s=0;f.length>s;)c(a,n=f[s++],e(r,n));return a}})},{107:107,24:24,32:32,70:70,80:80}],269:[function(t,n,r){"use strict";var e=t(32),i=t(109),o=t(110),u=t(74),c=t(70).f;t(28)&&e(e.P+t(69),"Object",{__lookupGetter__:function __lookupGetter__(t){var n,r=i(this),e=o(t,!0);do if(n=c(r,e))return n.get;while(r=u(r))}})},{109:109,110:110,28:28,32:32,69:69,70:70,74:74}],270:[function(t,n,r){"use strict";var e=t(32),i=t(109),o=t(110),u=t(74),c=t(70).f;t(28)&&e(e.P+t(69),"Object",{__lookupSetter__:function __lookupSetter__(t){var n,r=i(this),e=o(t,!0);do if(n=c(r,e))return n.set;while(r=u(r))}})},{109:109,110:110,28:28,32:32,69:69,70:70,74:74}],271:[function(t,n,r){var e=t(32),i=t(79)(!1);e(e.S,"Object",{values:function values(t){return i(t)}})},{32:32,79:79}],272:[function(t,n,r){"use strict";var e=t(32),i=t(38),o=t(23),u=t(64)(),c=t(117)("observable"),f=t(3),a=t(7),s=t(6),l=t(86),h=t(40),v=t(37),p=v.RETURN,d=function(t){return null==t?void 0:f(t)},y=function(t){var n=t._c;n&&(t._c=void 0,n())},g=function(t){return void 0===t._o},b=function(t){g(t)||(t._o=void 0,y(t))},x=function(t,n){a(t),this._c=void 0,this._o=t,t=new m(this);try{var r=n(t),e=r;null!=r&&("function"==typeof r.unsubscribe?r=function(){e.unsubscribe()}:f(r),this._c=r)}catch(n){return void t.error(n)}g(this)&&y(this)};x.prototype=l({},{unsubscribe:function unsubscribe(){b(this)}});var m=function(t){this._s=t};m.prototype=l({},{next:function next(t){var n=this._s;if(!g(n)){var r=n._o;try{var e=d(r.next);if(e)return e.call(r,t)}catch(t){try{b(n)}finally{throw t}}}},error:function error(t){var n=this._s;if(g(n))throw t;var r=n._o;n._o=void 0;try{var e=d(r.error);if(!e)throw t;t=e.call(r,t)}catch(t){try{y(n)}finally{throw t}}return y(n),t},complete:function complete(t){var n=this._s;if(!g(n)){var r=n._o;n._o=void 0;try{var e=d(r.complete);t=e?e.call(r,t):void 0}catch(t){try{y(n)}finally{throw t}}return y(n),t}}});var w=function Observable(t){s(this,w,"Observable","_f")._f=f(t)};l(w.prototype,{subscribe:function subscribe(t){return new x(t,this._f)},forEach:function forEach(t){var n=this;return new(o.Promise||i.Promise)(function(r,e){f(t);var i=n.subscribe({next:function(n){try{return t(n)}catch(t){e(t),i.unsubscribe()}},error:e,complete:r})})}}),l(w,{from:function from(t){var n="function"==typeof this?this:w,r=d(a(t)[c]);if(r){var e=a(r.call(t));return e.constructor===n?e:new n(function(t){return e.subscribe(t)})}return new n(function(n){var r=!1;return u(function(){if(!r){try{if(v(t,!1,function(t){if(n.next(t),r)return p})===p)return}catch(t){if(r)throw t;return void n.error(t)}n.complete()}}),function(){r=!0}})},of:function of(){for(var t=0,n=arguments.length,r=Array(n);t<n;)r[t]=arguments[t++];return new("function"==typeof this?this:w)(function(t){var n=!1;return u(function(){if(!n){for(var e=0;e<r.length;++e)if(t.next(r[e]),n)return;t.complete()}}),function(){n=!0}})}}),h(w.prototype,c,function(){return this}),e(e.G,{Observable:w}),t(91)("Observable")},{117:117,23:23,3:3,32:32,37:37,38:38,40:40,6:6,64:64,7:7,86:86,91:91}],273:[function(t,n,r){var e=t(63),i=t(7),o=e.key,u=e.set;e.exp({defineMetadata:function defineMetadata(t,n,r,e){u(t,n,i(r),o(e))}})},{63:63,7:7}],274:[function(t,n,r){var e=t(63),i=t(7),o=e.key,u=e.map,c=e.store;e.exp({deleteMetadata:function deleteMetadata(t,n){var r=arguments.length<3?void 0:o(arguments[2]),e=u(i(n),r,!1);if(void 0===e||!e.delete(t))return!1;if(e.size)return!0;var f=c.get(n);return f.delete(r),!!f.size||c.delete(n)}})},{63:63,7:7}],275:[function(t,n,r){var e=t(220),i=t(10),o=t(63),u=t(7),c=t(74),f=o.keys,a=o.key,s=function(t,n){var r=f(t,n),o=c(t);if(null===o)return r;var u=s(o,n);return u.length?r.length?i(new e(r.concat(u))):u:r};o.exp({getMetadataKeys:function getMetadataKeys(t){return s(u(t),arguments.length<2?void 0:a(arguments[1]))}})},{10:10,220:220,63:63,7:7,74:74}],276:[function(t,n,r){var e=t(63),i=t(7),o=t(74),u=e.has,c=e.get,f=e.key,a=function(t,n,r){var e=u(t,n,r);if(e)return c(t,n,r);var i=o(n);return null!==i?a(t,i,r):void 0};e.exp({getMetadata:function getMetadata(t,n){return a(t,i(n),arguments.length<3?void 0:f(arguments[2]))}})},{63:63,7:7,74:74}],277:[function(t,n,r){var e=t(63),i=t(7),o=e.keys,u=e.key;e.exp({getOwnMetadataKeys:function getOwnMetadataKeys(t){return o(i(t),arguments.length<2?void 0:u(arguments[1]))}})},{63:63,7:7}],278:[function(t,n,r){var e=t(63),i=t(7),o=e.get,u=e.key;e.exp({getOwnMetadata:function getOwnMetadata(t,n){return o(t,i(n),arguments.length<3?void 0:u(arguments[2]))}})},{63:63,7:7}],279:[function(t,n,r){var e=t(63),i=t(7),o=t(74),u=e.has,c=e.key,f=function(t,n,r){var e=u(t,n,r);if(e)return!0;var i=o(n);return null!==i&&f(t,i,r)};e.exp({hasMetadata:function hasMetadata(t,n){return f(t,i(n),arguments.length<3?void 0:c(arguments[2]))}})},{63:63,7:7,74:74}],280:[function(t,n,r){var e=t(63),i=t(7),o=e.has,u=e.key;e.exp({hasOwnMetadata:function hasOwnMetadata(t,n){return o(t,i(n),arguments.length<3?void 0:u(arguments[2]))}})},{63:63,7:7}],281:[function(t,n,r){var e=t(63),i=t(7),o=t(3),u=e.key,c=e.set;e.exp({metadata:function metadata(t,n){return function decorator(r,e){c(t,n,(void 0!==e?i:o)(r),u(e))}}})},{3:3,63:63,7:7}],282:[function(t,n,r){var e=t(32);e(e.P+e.R,"Set",{toJSON:t(20)("Set")})},{20:20,32:32}],283:[function(t,n,r){"use strict";var e=t(32),i=t(97)(!0);e(e.P,"String",{at:function at(t){return i(this,t)}})},{32:32,97:97}],284:[function(t,n,r){"use strict";var e=t(32),i=t(27),o=t(108),u=t(50),c=t(36),f=RegExp.prototype,a=function(t,n){this._r=t,this._s=n};t(52)(a,"RegExp String",function next(){var t=this._r.exec(this._s);return{value:t,done:null===t}}),e(e.P,"String",{matchAll:function matchAll(t){if(i(this),!u(t))throw TypeError(t+" is not a regexp!");var n=String(this),r="flags"in f?String(t.flags):c.call(t),e=new RegExp(t.source,~r.indexOf("g")?r:"g"+r);return e.lastIndex=o(t.lastIndex),new a(e,n)}})},{108:108,27:27,32:32,36:36,50:50,52:52}],285:[function(t,n,r){"use strict";var e=t(32),i=t(100);e(e.P,"String",{padEnd:function padEnd(t){return i(this,t,arguments.length>1?arguments[1]:void 0,!1)}})},{100:100,32:32}],286:[function(t,n,r){"use strict";var e=t(32),i=t(100);e(e.P,"String",{padStart:function padStart(t){return i(this,t,arguments.length>1?arguments[1]:void 0,!0)}})},{100:100,32:32}],287:[function(t,n,r){"use strict";t(102)("trimLeft",function(t){return function trimLeft(){return t(this,1)}},"trimStart")},{102:102}],288:[function(t,n,r){"use strict";t(102)("trimRight",function(t){return function trimRight(){return t(this,2)}},"trimEnd")},{102:102}],289:[function(t,n,r){t(115)("asyncIterator")},{115:115}],290:[function(t,n,r){t(115)("observable")},{115:115}],291:[function(t,n,r){var e=t(32);e(e.S,"System",{global:t(38)})},{32:32,38:38}],292:[function(t,n,r){for(var e=t(130),i=t(87),o=t(38),u=t(40),c=t(56),f=t(117),a=f("iterator"),s=f("toStringTag"),l=c.Array,h=["NodeList","DOMTokenList","MediaList","StyleSheetList","CSSRuleList"],v=0;v<5;v++){var p,d=h[v],y=o[d],g=y&&y.prototype;if(g){g[a]||u(g,a,l),g[s]||u(g,s,d),c[d]=l;for(p in e)g[p]||i(g,p,e[p],!0)}}},{117:117,130:130,38:38,40:40,56:56,87:87}],293:[function(t,n,r){var e=t(32),i=t(104);e(e.G+e.B,{setImmediate:i.set,clearImmediate:i.clear})},{104:104,32:32}],294:[function(t,n,r){var e=t(38),i=t(32),o=t(44),u=t(83),c=e.navigator,f=!!c&&/MSIE .\./.test(c.userAgent),a=function(t){return f?function(n,r){return t(o(u,[].slice.call(arguments,2),"function"==typeof n?n:Function(n)),r)}:t};i(i.G+i.B+i.F*f,{setTimeout:a(e.setTimeout),setInterval:a(e.setInterval)})},{32:32,38:38,44:44,83:83}],295:[function(t,n,r){t(243),t(180),t(182),t(181),t(184),t(186),t(191),t(185),t(183),t(193),t(192),t(188),t(189),t(187),t(179),t(190),t(194),t(195),t(146),t(148),t(147),t(197),t(196),t(167),t(177),t(178),t(168),t(169),t(170),t(171),t(172),t(173),t(174),t(175),t(176),t(150),t(151),t(152),t(153),t(154),t(155),t(156),t(157),t(158),t(159),t(160),t(161),t(162),t(163),t(164),t(165),t(166),t(230),t(235),t(242),t(233),t(225),t(226),t(231),t(236),t(238),t(221),t(222),t(223),t(224),t(227),t(228),t(229),t(232),t(234),t(237),t(239),t(240),t(241),t(141),t(143),t(142),t(145),t(144),t(129),t(127),t(134),t(131),t(137),t(139),t(126),t(133),t(123),t(138),t(121),t(136),t(135),t(128),t(132),t(120),t(122),t(125),t(124),t(140),t(130),t(213),t(219),t(214),t(215),t(216),t(217),t(218),t(198),t(149),t(220),t(255),t(256),t(244),t(245),t(250),t(253),t(254),t(248),t(251),t(249),t(252),t(246),t(247),t(199),t(200),t(201),t(202),t(203),t(206),t(204),t(205),t(207),t(208),t(209),t(210),t(212),t(211),t(257),t(283),t(286),t(285),t(287),t(288),t(284),t(289),t(290),t(268),t(271),t(267),t(265),t(266),t(269),t(270),t(260),t(282),t(291),t(259),t(261),t(263),t(262),t(264),t(273),t(274),t(276),t(275),t(278),t(277),t(279),t(280),t(281),t(258),t(272),t(294),t(293),t(292),n.exports=t(23)},{120:120,121:121,122:122,123:123,124:124,125:125,126:126,127:127,128:128,129:129,130:130,131:131,132:132,133:133,134:134,135:135,136:136,137:137,138:138,139:139,140:140,141:141,142:142,143:143,144:144,145:145,146:146,147:147,148:148,149:149,150:150,151:151,152:152,153:153,154:154,155:155,156:156,157:157,158:158,159:159,160:160,161:161,162:162,163:163,164:164,165:165,166:166,167:167,168:168,169:169,170:170,171:171,172:172,173:173,174:174,175:175,176:176,177:177,178:178,179:179,180:180,181:181,182:182,183:183,184:184,185:185,186:186,187:187,188:188,189:189,190:190,191:191,192:192,193:193,194:194,195:195,196:196,197:197,198:198,199:199,200:200,201:201,202:202,203:203,204:204,205:205,206:206,207:207,208:208,209:209,210:210,211:211,212:212,213:213,214:214,215:215,216:216,217:217,218:218,219:219,220:220,221:221,222:222,223:223,224:224,225:225,226:226,227:227,228:228,229:229,23:23,230:230,231:231,232:232,233:233,234:234,235:235,236:236,237:237,238:238,239:239,240:240,241:241,242:242,243:243,244:244,245:245,246:246,247:247,248:248,249:249,250:250,251:251,252:252,253:253,254:254,255:255,256:256,257:257,258:258,259:259,260:260,261:261,262:262,263:263,264:264,265:265,266:266,267:267,268:268,269:269,270:270,271:271,272:272,273:273,274:274,275:275,276:276,277:277,278:278,279:279,280:280,281:281,282:282,283:283,284:284,285:285,286:286,287:287,288:288,289:289,290:290,291:291,292:292,293:293,294:294}],296:[function(t,n,r){(function(t){!function(t){"use strict";function wrap(t,n,r,e){var i=Object.create((n||Generator).prototype),o=new Context(e||[]);return i._invoke=makeInvokeMethod(t,r,o),i}function tryCatch(t,n,r){try{return{type:"normal",arg:t.call(n,r)}}catch(t){return{type:"throw",arg:t}}}function Generator(){}function GeneratorFunction(){}function GeneratorFunctionPrototype(){}function defineIteratorMethods(t){["next","throw","return"].forEach(function(n){t[n]=function(t){return this._invoke(n,t)}})}function AwaitArgument(t){this.arg=t}function AsyncIterator(t){function invoke(n,r,e,i){var o=tryCatch(t[n],t,r);if("throw"!==o.type){var u=o.arg,c=u.value;return c instanceof AwaitArgument?Promise.resolve(c.arg).then(function(t){invoke("next",t,e,i)},function(t){invoke("throw",t,e,i)}):Promise.resolve(c).then(function(t){u.value=t,e(u)},i)}i(o.arg)}function enqueue(t,r){function callInvokeWithMethodAndArg(){return new Promise(function(n,e){invoke(t,r,n,e)})}return n=n?n.then(callInvokeWithMethodAndArg,callInvokeWithMethodAndArg):callInvokeWithMethodAndArg()}"object"==typeof process&&process.domain&&(invoke=process.domain.bind(invoke));var n;this._invoke=enqueue}function makeInvokeMethod(t,n,e){var i=a;return function invoke(o,u){if(i===l)throw new Error("Generator is already running");if(i===h){if("throw"===o)throw u;return doneResult()}for(;;){var c=e.delegate;if(c){if("return"===o||"throw"===o&&c.iterator[o]===r){e.delegate=null;var f=c.iterator.return;if(f){var p=tryCatch(f,c.iterator,u);if("throw"===p.type){o="throw",u=p.arg;continue}}if("return"===o)continue}var p=tryCatch(c.iterator[o],c.iterator,u);if("throw"===p.type){e.delegate=null,o="throw",u=p.arg;continue}o="next",u=r;var d=p.arg;if(!d.done)return i=s,d;e[c.resultName]=d.value,e.next=c.nextLoc,e.delegate=null}if("next"===o)e.sent=e._sent=u;else if("throw"===o){if(i===a)throw i=h,u;e.dispatchException(u)&&(o="next",u=r)}else"return"===o&&e.abrupt("return",u);i=l;var p=tryCatch(t,n,e);if("normal"===p.type){i=e.done?h:s;var d={value:p.arg,done:e.done};if(p.arg!==v)return d;e.delegate&&"next"===o&&(u=r)}else"throw"===p.type&&(i=h,o="throw",u=p.arg)}}}function pushTryEntry(t){var n={tryLoc:t[0]};1 in t&&(n.catchLoc=t[1]),2 in t&&(n.finallyLoc=t[2],n.afterLoc=t[3]),this.tryEntries.push(n)}function resetTryEntry(t){var n=t.completion||{};n.type="normal",delete n.arg,t.completion=n}function Context(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(pushTryEntry,this),this.reset(!0)}function values(t){if(t){var n=t[o];if(n)return n.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var i=-1,u=function next(){for(;++i<t.length;)if(e.call(t,i))return next.value=t[i],next.done=!1,next;return next.value=r,next.done=!0,next};return u.next=u}}return{next:doneResult}}function doneResult(){return{value:r,done:!0}}var r,e=Object.prototype.hasOwnProperty,i="function"==typeof Symbol?Symbol:{},o=i.iterator||"@@iterator",u=i.toStringTag||"@@toStringTag",c="object"==typeof n,f=t.regeneratorRuntime;if(f)return void(c&&(n.exports=f));f=t.regeneratorRuntime=c?n.exports:{},f.wrap=wrap;var a="suspendedStart",s="suspendedYield",l="executing",h="completed",v={},p=GeneratorFunctionPrototype.prototype=Generator.prototype;GeneratorFunction.prototype=p.constructor=GeneratorFunctionPrototype,GeneratorFunctionPrototype.constructor=GeneratorFunction,GeneratorFunctionPrototype[u]=GeneratorFunction.displayName="GeneratorFunction",f.isGeneratorFunction=function(t){var n="function"==typeof t&&t.constructor;return!!n&&(n===GeneratorFunction||"GeneratorFunction"===(n.displayName||n.name))},f.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,GeneratorFunctionPrototype):(t.__proto__=GeneratorFunctionPrototype,u in t||(t[u]="GeneratorFunction")),t.prototype=Object.create(p),t},f.awrap=function(t){return new AwaitArgument(t)},defineIteratorMethods(AsyncIterator.prototype),f.async=function(t,n,r,e){var i=new AsyncIterator(wrap(t,n,r,e));return f.isGeneratorFunction(n)?i:i.next().then(function(t){return t.done?t.value:i.next()})},defineIteratorMethods(p),p[o]=function(){return this},p[u]="Generator",p.toString=function(){return"[object Generator]"},f.keys=function(t){var n=[];for(var r in t)n.push(r);return n.reverse(),function next(){for(;n.length;){var r=n.pop();if(r in t)return next.value=r,next.done=!1,next}return next.done=!0,next}},f.values=values,Context.prototype={constructor:Context,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=r,this.done=!1,this.delegate=null,this.tryEntries.forEach(resetTryEntry),!t)for(var n in this)"t"===n.charAt(0)&&e.call(this,n)&&!isNaN(+n.slice(1))&&(this[n]=r)},stop:function(){this.done=!0;var t=this.tryEntries[0],n=t.completion;if("throw"===n.type)throw n.arg;return this.rval},dispatchException:function(t){function handle(r,e){return o.type="throw",o.arg=t,n.next=r,!!e}if(this.done)throw t;for(var n=this,r=this.tryEntries.length-1;r>=0;--r){var i=this.tryEntries[r],o=i.completion;if("root"===i.tryLoc)return handle("end");if(i.tryLoc<=this.prev){var u=e.call(i,"catchLoc"),c=e.call(i,"finallyLoc");
if(u&&c){if(this.prev<i.catchLoc)return handle(i.catchLoc,!0);if(this.prev<i.finallyLoc)return handle(i.finallyLoc)}else if(u){if(this.prev<i.catchLoc)return handle(i.catchLoc,!0)}else{if(!c)throw new Error("try statement without catch or finally");if(this.prev<i.finallyLoc)return handle(i.finallyLoc)}}}},abrupt:function(t,n){for(var r=this.tryEntries.length-1;r>=0;--r){var i=this.tryEntries[r];if(i.tryLoc<=this.prev&&e.call(i,"finallyLoc")&&this.prev<i.finallyLoc){var o=i;break}}o&&("break"===t||"continue"===t)&&o.tryLoc<=n&&n<=o.finallyLoc&&(o=null);var u=o?o.completion:{};return u.type=t,u.arg=n,o?this.next=o.finallyLoc:this.complete(u),v},complete:function(t,n){if("throw"===t.type)throw t.arg;"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=t.arg,this.next="end"):"normal"===t.type&&n&&(this.next=n)},finish:function(t){for(var n=this.tryEntries.length-1;n>=0;--n){var r=this.tryEntries[n];if(r.finallyLoc===t)return this.complete(r.completion,r.afterLoc),resetTryEntry(r),v}},catch:function(t){for(var n=this.tryEntries.length-1;n>=0;--n){var r=this.tryEntries[n];if(r.tryLoc===t){var e=r.completion;if("throw"===e.type){var i=e.arg;resetTryEntry(r)}return i}}throw new Error("illegal catch attempt")},delegateYield:function(t,n,r){return this.delegate={iterator:values(t),resultName:n,nextLoc:r},v}}}("object"==typeof t?t:"object"==typeof window?window:"object"==typeof self?self:this)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}]},{},[1]);

define("babel-polyfill", [],function(){});

define('aurelia-http-client',['exports', 'aurelia-path', 'aurelia-pal'], function (exports, _aureliaPath, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.HttpClient = exports.RequestBuilder = exports.HttpRequestMessage = exports.JSONPRequestMessage = exports.RequestMessageProcessor = exports.mimeTypes = exports.HttpResponseMessage = exports.RequestMessage = exports.Headers = undefined;
  exports.timeoutTransformer = timeoutTransformer;
  exports.callbackParameterNameTransformer = callbackParameterNameTransformer;
  exports.credentialsTransformer = credentialsTransformer;
  exports.progressTransformer = progressTransformer;
  exports.responseTypeTransformer = responseTypeTransformer;
  exports.headerTransformer = headerTransformer;
  exports.contentTransformer = contentTransformer;
  exports.createJSONPRequestMessageProcessor = createJSONPRequestMessageProcessor;
  exports.createHttpRequestMessageProcessor = createHttpRequestMessageProcessor;

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  

  var Headers = exports.Headers = function () {
    function Headers() {
      var headers = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      

      this.headers = headers;
    }

    Headers.prototype.add = function add(key, value) {
      this.headers[key] = value;
    };

    Headers.prototype.get = function get(key) {
      return this.headers[key];
    };

    Headers.prototype.clear = function clear() {
      this.headers = {};
    };

    Headers.prototype.has = function has(header) {
      var lowered = header.toLowerCase();
      var headers = this.headers;

      for (var _key in headers) {
        if (_key.toLowerCase() === lowered) {
          return true;
        }
      }

      return false;
    };

    Headers.prototype.configureXHR = function configureXHR(xhr) {
      var headers = this.headers;

      for (var _key2 in headers) {
        xhr.setRequestHeader(_key2, headers[_key2]);
      }
    };

    Headers.parse = function parse(headerStr) {
      var headers = new Headers();
      if (!headerStr) {
        return headers;
      }

      var headerPairs = headerStr.split('\r\n');
      for (var i = 0; i < headerPairs.length; i++) {
        var headerPair = headerPairs[i];

        var index = headerPair.indexOf(': ');
        if (index > 0) {
          var _key3 = headerPair.substring(0, index);
          var val = headerPair.substring(index + 2);
          headers.add(_key3, val);
        }
      }

      return headers;
    };

    return Headers;
  }();

  var RequestMessage = exports.RequestMessage = function () {
    function RequestMessage(method, url, content, headers) {
      

      this.method = method;
      this.url = url;
      this.content = content;
      this.headers = headers || new Headers();
      this.baseUrl = '';
    }

    RequestMessage.prototype.buildFullUrl = function buildFullUrl() {
      var absoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;
      var url = absoluteUrl.test(this.url) ? this.url : (0, _aureliaPath.join)(this.baseUrl, this.url);

      if (this.params) {
        var qs = (0, _aureliaPath.buildQueryString)(this.params);
        url = qs ? url + (this.url.indexOf('?') < 0 ? '?' : '&') + qs : url;
      }

      return url;
    };

    return RequestMessage;
  }();

  var HttpResponseMessage = exports.HttpResponseMessage = function () {
    function HttpResponseMessage(requestMessage, xhr, responseType, reviver) {
      

      this.requestMessage = requestMessage;
      this.statusCode = xhr.status;
      this.response = xhr.response || xhr.responseText;
      this.isSuccess = xhr.status >= 200 && xhr.status < 400;
      this.statusText = xhr.statusText;
      this.reviver = reviver;
      this.mimeType = null;

      if (xhr.getAllResponseHeaders) {
        try {
          this.headers = Headers.parse(xhr.getAllResponseHeaders());
        } catch (err) {
          if (xhr.requestHeaders) this.headers = { headers: xhr.requestHeaders };
        }
      } else {
        this.headers = new Headers();
      }

      var contentType = void 0;
      if (this.headers && this.headers.headers) contentType = this.headers.headers['Content-Type'];
      if (contentType) {
        this.mimeType = responseType = contentType.split(';')[0].trim();
        if (mimeTypes.hasOwnProperty(this.mimeType)) responseType = mimeTypes[this.mimeType];
      }

      this.responseType = responseType;
    }

    _createClass(HttpResponseMessage, [{
      key: 'content',
      get: function get() {
        try {
          if (this._content !== undefined) {
            return this._content;
          }

          if (this.response === undefined || this.response === null) {
            this._content = this.response;
            return this._content;
          }

          if (this.responseType === 'json') {
            this._content = JSON.parse(this.response, this.reviver);
            return this._content;
          }

          if (this.reviver) {
            this._content = this.reviver(this.response);
            return this._content;
          }

          this._content = this.response;
          return this._content;
        } catch (e) {
          if (this.isSuccess) {
            throw e;
          }

          this._content = null;
          return this._content;
        }
      }
    }]);

    return HttpResponseMessage;
  }();

  var mimeTypes = exports.mimeTypes = {
    'text/html': 'html',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'text/json': 'json',
    'application/json': 'json',
    'application/rss+xml': 'rss',
    'application/atom+xml': 'atom',
    'application/xhtml+xml': 'xhtml',
    'text/markdown': 'md',
    'text/xml': 'xml',
    'text/mathml': 'mml',
    'application/xml': 'xml',
    'text/yml': 'yml',
    'text/csv': 'csv',
    'text/css': 'css',
    'text/less': 'less',
    'text/stylus': 'styl',
    'text/scss': 'scss',
    'text/sass': 'sass',
    'text/plain': 'txt'
  };

  function applyXhrTransformers(xhrTransformers, client, processor, message, xhr) {
    var i = void 0;
    var ii = void 0;

    for (i = 0, ii = xhrTransformers.length; i < ii; ++i) {
      xhrTransformers[i](client, processor, message, xhr);
    }
  }

  var RequestMessageProcessor = exports.RequestMessageProcessor = function () {
    function RequestMessageProcessor(xhrType, xhrTransformers) {
      

      this.XHRType = xhrType;
      this.xhrTransformers = xhrTransformers;
      this.isAborted = false;
    }

    RequestMessageProcessor.prototype.abort = function abort() {
      if (this.xhr && this.xhr.readyState !== _aureliaPal.PLATFORM.XMLHttpRequest.UNSENT) {
        this.xhr.abort();
      }

      this.isAborted = true;
    };

    RequestMessageProcessor.prototype.process = function process(client, requestMessage) {
      var _this = this;

      var promise = new Promise(function (resolve, reject) {
        var xhr = _this.xhr = new _this.XHRType();

        xhr.onload = function (e) {
          var response = new HttpResponseMessage(requestMessage, xhr, requestMessage.responseType, requestMessage.reviver);
          if (response.isSuccess) {
            resolve(response);
          } else {
            reject(response);
          }
        };

        xhr.ontimeout = function (e) {
          reject(new HttpResponseMessage(requestMessage, {
            response: e,
            status: xhr.status,
            statusText: xhr.statusText
          }, 'timeout'));
        };

        xhr.onerror = function (e) {
          reject(new HttpResponseMessage(requestMessage, {
            response: e,
            status: xhr.status,
            statusText: xhr.statusText
          }, 'error'));
        };

        xhr.onabort = function (e) {
          reject(new HttpResponseMessage(requestMessage, {
            response: e,
            status: xhr.status,
            statusText: xhr.statusText
          }, 'abort'));
        };
      });

      return Promise.resolve(requestMessage).then(function (message) {
        var processRequest = function processRequest() {
          if (_this.isAborted) {
            _this.xhr.abort();
          } else {
            _this.xhr.open(message.method, message.buildFullUrl(), true, message.user, message.password);
            applyXhrTransformers(_this.xhrTransformers, client, _this, message, _this.xhr);
            if (typeof message.content === 'undefined') {
              _this.xhr.send();
            } else {
              _this.xhr.send(message.content);
            }
          }

          return promise;
        };

        var chain = [[processRequest, undefined]];

        var interceptors = message.interceptors || [];
        interceptors.forEach(function (interceptor) {
          if (interceptor.request || interceptor.requestError) {
            chain.unshift([interceptor.request ? interceptor.request.bind(interceptor) : undefined, interceptor.requestError ? interceptor.requestError.bind(interceptor) : undefined]);
          }

          if (interceptor.response || interceptor.responseError) {
            chain.push([interceptor.response ? interceptor.response.bind(interceptor) : undefined, interceptor.responseError ? interceptor.responseError.bind(interceptor) : undefined]);
          }
        });

        var interceptorsPromise = Promise.resolve(message);

        while (chain.length) {
          var _interceptorsPromise;

          interceptorsPromise = (_interceptorsPromise = interceptorsPromise).then.apply(_interceptorsPromise, chain.shift());
        }

        return interceptorsPromise;
      });
    };

    return RequestMessageProcessor;
  }();

  function timeoutTransformer(client, processor, message, xhr) {
    if (message.timeout !== undefined) {
      xhr.timeout = message.timeout;
    }
  }

  function callbackParameterNameTransformer(client, processor, message, xhr) {
    if (message.callbackParameterName !== undefined) {
      xhr.callbackParameterName = message.callbackParameterName;
    }
  }

  function credentialsTransformer(client, processor, message, xhr) {
    if (message.withCredentials !== undefined) {
      xhr.withCredentials = message.withCredentials;
    }
  }

  function progressTransformer(client, processor, message, xhr) {
    if (message.progressCallback) {
      xhr.upload.onprogress = message.progressCallback;
    }
  }

  function responseTypeTransformer(client, processor, message, xhr) {
    var responseType = message.responseType;

    if (responseType === 'json') {
      responseType = 'text';
    }

    xhr.responseType = responseType;
  }

  function headerTransformer(client, processor, message, xhr) {
    message.headers.configureXHR(xhr);
  }

  function contentTransformer(client, processor, message, xhr) {
    if (message.skipContentProcessing) {
      return;
    }

    if (_aureliaPal.PLATFORM.global.FormData && message.content instanceof FormData) {
      return;
    }

    if (_aureliaPal.PLATFORM.global.Blob && message.content instanceof Blob) {
      return;
    }

    if (_aureliaPal.PLATFORM.global.ArrayBufferView && message.content instanceof ArrayBufferView) {
      return;
    }

    if (message.content instanceof Document) {
      return;
    }

    if (typeof message.content === 'string') {
      return;
    }

    if (message.content === null || message.content === undefined) {
      return;
    }

    message.content = JSON.stringify(message.content, message.replacer);

    if (!message.headers.has('Content-Type')) {
      message.headers.add('Content-Type', 'application/json');
    }
  }

  var JSONPRequestMessage = exports.JSONPRequestMessage = function (_RequestMessage) {
    _inherits(JSONPRequestMessage, _RequestMessage);

    function JSONPRequestMessage(url, callbackParameterName) {
      

      var _this2 = _possibleConstructorReturn(this, _RequestMessage.call(this, 'JSONP', url));

      _this2.responseType = 'jsonp';
      _this2.callbackParameterName = callbackParameterName;
      return _this2;
    }

    return JSONPRequestMessage;
  }(RequestMessage);

  var JSONPXHR = function () {
    function JSONPXHR() {
      
    }

    JSONPXHR.prototype.open = function open(method, url) {
      this.method = method;
      this.url = url;
      this.callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    };

    JSONPXHR.prototype.send = function send() {
      var _this3 = this;

      var url = this.url + (this.url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(this.callbackParameterName) + '=' + this.callbackName;
      var script = _aureliaPal.DOM.createElement('script');

      script.src = url;
      script.onerror = function (e) {
        cleanUp();

        _this3.status = 0;
        _this3.onerror(new Error('error'));
      };

      var cleanUp = function cleanUp() {
        delete _aureliaPal.PLATFORM.global[_this3.callbackName];
        _aureliaPal.DOM.removeNode(script);
      };

      _aureliaPal.PLATFORM.global[this.callbackName] = function (data) {
        cleanUp();

        if (_this3.status === undefined) {
          _this3.status = 200;
          _this3.statusText = 'OK';
          _this3.response = data;
          _this3.onload(_this3);
        }
      };

      _aureliaPal.DOM.appendNode(script);

      if (this.timeout !== undefined) {
        setTimeout(function () {
          if (_this3.status === undefined) {
            _this3.status = 0;
            _this3.ontimeout(new Error('timeout'));
          }
        }, this.timeout);
      }
    };

    JSONPXHR.prototype.abort = function abort() {
      if (this.status === undefined) {
        this.status = 0;
        this.onabort(new Error('abort'));
      }
    };

    JSONPXHR.prototype.setRequestHeader = function setRequestHeader() {};

    return JSONPXHR;
  }();

  function createJSONPRequestMessageProcessor() {
    return new RequestMessageProcessor(JSONPXHR, [timeoutTransformer, callbackParameterNameTransformer]);
  }

  var HttpRequestMessage = exports.HttpRequestMessage = function (_RequestMessage2) {
    _inherits(HttpRequestMessage, _RequestMessage2);

    function HttpRequestMessage(method, url, content, headers) {
      

      var _this4 = _possibleConstructorReturn(this, _RequestMessage2.call(this, method, url, content, headers));

      _this4.responseType = 'json';return _this4;
    }

    return HttpRequestMessage;
  }(RequestMessage);

  function createHttpRequestMessageProcessor() {
    return new RequestMessageProcessor(_aureliaPal.PLATFORM.XMLHttpRequest, [timeoutTransformer, credentialsTransformer, progressTransformer, responseTypeTransformer, contentTransformer, headerTransformer]);
  }

  var RequestBuilder = exports.RequestBuilder = function () {
    function RequestBuilder(client) {
      

      this.client = client;
      this.transformers = client.requestTransformers.slice(0);
      this.useJsonp = false;
    }

    RequestBuilder.prototype.asDelete = function asDelete() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'DELETE';
      });
    };

    RequestBuilder.prototype.asGet = function asGet() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'GET';
      });
    };

    RequestBuilder.prototype.asHead = function asHead() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'HEAD';
      });
    };

    RequestBuilder.prototype.asOptions = function asOptions() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'OPTIONS';
      });
    };

    RequestBuilder.prototype.asPatch = function asPatch() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'PATCH';
      });
    };

    RequestBuilder.prototype.asPost = function asPost() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'POST';
      });
    };

    RequestBuilder.prototype.asPut = function asPut() {
      return this._addTransformer(function (client, processor, message) {
        message.method = 'PUT';
      });
    };

    RequestBuilder.prototype.asJsonp = function asJsonp(callbackParameterName) {
      this.useJsonp = true;
      return this._addTransformer(function (client, processor, message) {
        message.callbackParameterName = callbackParameterName;
      });
    };

    RequestBuilder.prototype.withUrl = function withUrl(url) {
      return this._addTransformer(function (client, processor, message) {
        message.url = url;
      });
    };

    RequestBuilder.prototype.withContent = function withContent(content) {
      return this._addTransformer(function (client, processor, message) {
        message.content = content;
      });
    };

    RequestBuilder.prototype.withBaseUrl = function withBaseUrl(baseUrl) {
      return this._addTransformer(function (client, processor, message) {
        message.baseUrl = baseUrl;
      });
    };

    RequestBuilder.prototype.withParams = function withParams(params) {
      return this._addTransformer(function (client, processor, message) {
        message.params = params;
      });
    };

    RequestBuilder.prototype.withResponseType = function withResponseType(responseType) {
      return this._addTransformer(function (client, processor, message) {
        message.responseType = responseType;
      });
    };

    RequestBuilder.prototype.withTimeout = function withTimeout(timeout) {
      return this._addTransformer(function (client, processor, message) {
        message.timeout = timeout;
      });
    };

    RequestBuilder.prototype.withHeader = function withHeader(key, value) {
      return this._addTransformer(function (client, processor, message) {
        message.headers.add(key, value);
      });
    };

    RequestBuilder.prototype.withCredentials = function withCredentials(value) {
      return this._addTransformer(function (client, processor, message) {
        message.withCredentials = value;
      });
    };

    RequestBuilder.prototype.withLogin = function withLogin(user, password) {
      return this._addTransformer(function (client, processor, message) {
        message.user = user;message.password = password;
      });
    };

    RequestBuilder.prototype.withReviver = function withReviver(reviver) {
      return this._addTransformer(function (client, processor, message) {
        message.reviver = reviver;
      });
    };

    RequestBuilder.prototype.withReplacer = function withReplacer(replacer) {
      return this._addTransformer(function (client, processor, message) {
        message.replacer = replacer;
      });
    };

    RequestBuilder.prototype.withProgressCallback = function withProgressCallback(progressCallback) {
      return this._addTransformer(function (client, processor, message) {
        message.progressCallback = progressCallback;
      });
    };

    RequestBuilder.prototype.withCallbackParameterName = function withCallbackParameterName(callbackParameterName) {
      return this._addTransformer(function (client, processor, message) {
        message.callbackParameterName = callbackParameterName;
      });
    };

    RequestBuilder.prototype.withInterceptor = function withInterceptor(interceptor) {
      return this._addTransformer(function (client, processor, message) {
        message.interceptors = message.interceptors || [];
        message.interceptors.unshift(interceptor);
      });
    };

    RequestBuilder.prototype.skipContentProcessing = function skipContentProcessing() {
      return this._addTransformer(function (client, processor, message) {
        message.skipContentProcessing = true;
      });
    };

    RequestBuilder.prototype._addTransformer = function _addTransformer(fn) {
      this.transformers.push(fn);
      return this;
    };

    RequestBuilder.addHelper = function addHelper(name, fn) {
      RequestBuilder.prototype[name] = function () {
        return this._addTransformer(fn.apply(this, arguments));
      };
    };

    RequestBuilder.prototype.send = function send() {
      var message = this.useJsonp ? new JSONPRequestMessage() : new HttpRequestMessage();
      return this.client.send(message, this.transformers);
    };

    return RequestBuilder;
  }();

  function trackRequestStart(client, processor) {
    client.pendingRequests.push(processor);
    client.isRequesting = true;
  }

  function trackRequestEnd(client, processor) {
    var index = client.pendingRequests.indexOf(processor);

    client.pendingRequests.splice(index, 1);
    client.isRequesting = client.pendingRequests.length > 0;

    if (!client.isRequesting) {
      (function () {
        var evt = _aureliaPal.DOM.createCustomEvent('aurelia-http-client-requests-drained', { bubbles: true, cancelable: true });
        setTimeout(function () {
          return _aureliaPal.DOM.dispatchEvent(evt);
        }, 1);
      })();
    }
  }

  var HttpClient = exports.HttpClient = function () {
    function HttpClient() {
      

      this.isRequesting = false;

      this.requestTransformers = [];
      this.requestProcessorFactories = new Map();
      this.requestProcessorFactories.set(HttpRequestMessage, createHttpRequestMessageProcessor);
      this.requestProcessorFactories.set(JSONPRequestMessage, createJSONPRequestMessageProcessor);
      this.pendingRequests = [];
    }

    HttpClient.prototype.configure = function configure(fn) {
      var builder = new RequestBuilder(this);
      fn(builder);
      this.requestTransformers = builder.transformers;
      return this;
    };

    HttpClient.prototype.createRequest = function createRequest(url) {
      var builder = new RequestBuilder(this);

      if (url) {
        builder.withUrl(url);
      }

      return builder;
    };

    HttpClient.prototype.send = function send(requestMessage, transformers) {
      var _this5 = this;

      var createProcessor = this.requestProcessorFactories.get(requestMessage.constructor);
      var processor = void 0;
      var promise = void 0;
      var i = void 0;
      var ii = void 0;

      if (!createProcessor) {
        throw new Error('No request message processor factory for ' + requestMessage.constructor + '.');
      }

      processor = createProcessor();
      trackRequestStart(this, processor);

      transformers = transformers || this.requestTransformers;

      promise = Promise.resolve(requestMessage).then(function (message) {
        for (i = 0, ii = transformers.length; i < ii; ++i) {
          transformers[i](_this5, processor, message);
        }

        return processor.process(_this5, message).then(function (response) {
          trackRequestEnd(_this5, processor);
          return response;
        }).catch(function (response) {
          trackRequestEnd(_this5, processor);
          throw response;
        });
      });

      promise.abort = promise.cancel = function () {
        processor.abort();
      };

      return promise;
    };

    HttpClient.prototype.delete = function _delete(url) {
      return this.createRequest(url).asDelete().send();
    };

    HttpClient.prototype.get = function get(url) {
      return this.createRequest(url).asGet().send();
    };

    HttpClient.prototype.head = function head(url) {
      return this.createRequest(url).asHead().send();
    };

    HttpClient.prototype.jsonp = function jsonp(url) {
      var callbackParameterName = arguments.length <= 1 || arguments[1] === undefined ? 'jsoncallback' : arguments[1];

      return this.createRequest(url).asJsonp(callbackParameterName).send();
    };

    HttpClient.prototype.options = function options(url) {
      return this.createRequest(url).asOptions().send();
    };

    HttpClient.prototype.put = function put(url, content) {
      return this.createRequest(url).asPut().withContent(content).send();
    };

    HttpClient.prototype.patch = function patch(url, content) {
      return this.createRequest(url).asPatch().withContent(content).send();
    };

    HttpClient.prototype.post = function post(url, content) {
      return this.createRequest(url).asPost().withContent(content).send();
    };

    return HttpClient;
  }();
});
define('aurelia-templating-router/aurelia-templating-router',['exports', 'aurelia-router', './route-loader', './router-view', './route-href'], function (exports, _aureliaRouter, _routeLoader, _routerView, _routeHref) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.configure = exports.RouteHref = exports.RouterView = exports.TemplatingRouteLoader = undefined;


  function configure(config) {
    config.singleton(_aureliaRouter.RouteLoader, _routeLoader.TemplatingRouteLoader).singleton(_aureliaRouter.Router, _aureliaRouter.AppRouter).globalResources('./router-view', './route-href');

    config.container.registerAlias(_aureliaRouter.Router, _aureliaRouter.AppRouter);
  }

  exports.TemplatingRouteLoader = _routeLoader.TemplatingRouteLoader;
  exports.RouterView = _routerView.RouterView;
  exports.RouteHref = _routeHref.RouteHref;
  exports.configure = configure;
});;define('aurelia-templating-router', ['aurelia-templating-router/aurelia-templating-router'], function (main) { return main; });

define('aurelia-templating-router/route-loader',['exports', 'aurelia-dependency-injection', 'aurelia-templating', 'aurelia-router', 'aurelia-path', 'aurelia-metadata'], function (exports, _aureliaDependencyInjection, _aureliaTemplating, _aureliaRouter, _aureliaPath, _aureliaMetadata) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.TemplatingRouteLoader = undefined;

  

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  var _dec, _class;

  var TemplatingRouteLoader = exports.TemplatingRouteLoader = (_dec = (0, _aureliaDependencyInjection.inject)(_aureliaTemplating.CompositionEngine), _dec(_class = function (_RouteLoader) {
    _inherits(TemplatingRouteLoader, _RouteLoader);

    function TemplatingRouteLoader(compositionEngine) {
      

      var _this = _possibleConstructorReturn(this, _RouteLoader.call(this));

      _this.compositionEngine = compositionEngine;
      return _this;
    }

    TemplatingRouteLoader.prototype.loadRoute = function loadRoute(router, config) {
      var childContainer = router.container.createChild();
      var instruction = {
        viewModel: (0, _aureliaPath.relativeToFile)(config.moduleId, _aureliaMetadata.Origin.get(router.container.viewModel.constructor).moduleId),
        childContainer: childContainer,
        view: config.view || config.viewStrategy,
        router: router
      };

      childContainer.getChildRouter = function () {
        var childRouter = void 0;

        childContainer.registerHandler(_aureliaRouter.Router, function (c) {
          return childRouter || (childRouter = router.createChild(childContainer));
        });

        return childContainer.get(_aureliaRouter.Router);
      };

      return this.compositionEngine.ensureViewModel(instruction);
    };

    return TemplatingRouteLoader;
  }(_aureliaRouter.RouteLoader)) || _class);
});
define('aurelia-templating-router/router-view',['exports', 'aurelia-dependency-injection', 'aurelia-templating', 'aurelia-router', 'aurelia-metadata', 'aurelia-pal'], function (exports, _aureliaDependencyInjection, _aureliaTemplating, _aureliaRouter, _aureliaMetadata, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.RouterView = undefined;

  function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: descriptor.writable,
      value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
  }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  function _initializerWarningHelper(descriptor, context) {
    throw new Error('Decorating class property failed. Please ensure that transform-class-properties is enabled.');
  }

  var _dec, _dec2, _class, _desc, _value, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4;

  

  var SwapStrategies = function () {
    function SwapStrategies() {
      
    }

    SwapStrategies.prototype.before = function before(viewSlot, previousView, callback) {
      var promise = Promise.resolve(callback());

      if (previousView !== undefined) {
        return promise.then(function () {
          return viewSlot.remove(previousView, true);
        });
      }

      return promise;
    };

    SwapStrategies.prototype.with = function _with(viewSlot, previousView, callback) {
      var promise = Promise.resolve(callback());

      if (previousView !== undefined) {
        return Promise.all([viewSlot.remove(previousView, true), promise]);
      }

      return promise;
    };

    SwapStrategies.prototype.after = function after(viewSlot, previousView, callback) {
      return Promise.resolve(viewSlot.removeAll(true)).then(callback);
    };

    return SwapStrategies;
  }();

  var swapStrategies = new SwapStrategies();

  var RouterView = exports.RouterView = (_dec = (0, _aureliaTemplating.customElement)('router-view'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaDependencyInjection.Container, _aureliaTemplating.ViewSlot, _aureliaRouter.Router, _aureliaTemplating.ViewLocator, _aureliaTemplating.CompositionTransaction, _aureliaTemplating.CompositionEngine), _dec(_class = (0, _aureliaTemplating.noView)(_class = _dec2(_class = (_class2 = function () {
    function RouterView(element, container, viewSlot, router, viewLocator, compositionTransaction, compositionEngine) {
      

      _initDefineProp(this, 'swapOrder', _descriptor, this);

      _initDefineProp(this, 'layoutView', _descriptor2, this);

      _initDefineProp(this, 'layoutViewModel', _descriptor3, this);

      _initDefineProp(this, 'layoutModel', _descriptor4, this);

      this.element = element;
      this.container = container;
      this.viewSlot = viewSlot;
      this.router = router;
      this.viewLocator = viewLocator;
      this.compositionTransaction = compositionTransaction;
      this.compositionEngine = compositionEngine;
      this.router.registerViewPort(this, this.element.getAttribute('name'));

      if (!('initialComposition' in compositionTransaction)) {
        compositionTransaction.initialComposition = true;
        this.compositionTransactionNotifier = compositionTransaction.enlist();
      }
    }

    RouterView.prototype.created = function created(owningView) {
      this.owningView = owningView;
    };

    RouterView.prototype.bind = function bind(bindingContext, overrideContext) {
      this.container.viewModel = bindingContext;
      this.overrideContext = overrideContext;
    };

    RouterView.prototype.process = function process(viewPortInstruction, waitToSwap) {
      var _this = this;

      var component = viewPortInstruction.component;
      var childContainer = component.childContainer;
      var viewModel = component.viewModel;
      var viewModelResource = component.viewModelResource;
      var metadata = viewModelResource.metadata;
      var config = component.router.currentInstruction.config;
      var viewPort = config.viewPorts ? config.viewPorts[viewPortInstruction.name] : {};

      var layoutInstruction = {
        viewModel: viewPort.layoutViewModel || config.layoutViewModel || this.layoutViewModel,
        view: viewPort.layoutView || config.layoutView || this.layoutView,
        model: viewPort.layoutModel || config.layoutModel || this.layoutModel,
        router: viewPortInstruction.component.router,
        childContainer: childContainer,
        viewSlot: this.viewSlot
      };

      var viewStrategy = this.viewLocator.getViewStrategy(component.view || viewModel);
      if (viewStrategy && component.view) {
        viewStrategy.makeRelativeTo(_aureliaMetadata.Origin.get(component.router.container.viewModel.constructor).moduleId);
      }

      return metadata.load(childContainer, viewModelResource.value, null, viewStrategy, true).then(function (viewFactory) {
        if (!_this.compositionTransactionNotifier) {
          _this.compositionTransactionOwnershipToken = _this.compositionTransaction.tryCapture();
        }

        if (layoutInstruction.viewModel || layoutInstruction.view) {
          viewPortInstruction.layoutInstruction = layoutInstruction;
        }

        viewPortInstruction.controller = metadata.create(childContainer, _aureliaTemplating.BehaviorInstruction.dynamic(_this.element, viewModel, viewFactory));

        if (waitToSwap) {
          return;
        }

        _this.swap(viewPortInstruction);
      });
    };

    RouterView.prototype.swap = function swap(viewPortInstruction) {
      var _this2 = this;

      var work = function work() {
        var previousView = _this2.view;
        var swapStrategy = void 0;
        var viewSlot = _this2.viewSlot;
        var layoutInstruction = viewPortInstruction.layoutInstruction;

        swapStrategy = _this2.swapOrder in swapStrategies ? swapStrategies[_this2.swapOrder] : swapStrategies.after;

        swapStrategy(viewSlot, previousView, function () {
          var waitForView = void 0;

          if (layoutInstruction) {
            if (!layoutInstruction.viewModel) {
              layoutInstruction.viewModel = {};
            }

            waitForView = _this2.compositionEngine.createController(layoutInstruction).then(function (layout) {
              _aureliaTemplating.ShadowDOM.distributeView(viewPortInstruction.controller.view, layout.slots || layout.view.slots);
              return layout.view || layout;
            });
          } else {
            waitForView = Promise.resolve(viewPortInstruction.controller.view);
          }

          return waitForView.then(function (newView) {
            _this2.view = newView;
            return viewSlot.add(newView);
          }).then(function () {
            _this2._notify();
          });
        });
      };

      viewPortInstruction.controller.automate(this.overrideContext, this.owningView);

      if (this.compositionTransactionOwnershipToken) {
        return this.compositionTransactionOwnershipToken.waitForCompositionComplete().then(function () {
          _this2.compositionTransactionOwnershipToken = null;
          return work();
        });
      }

      return work();
    };

    RouterView.prototype._notify = function _notify() {
      if (this.compositionTransactionNotifier) {
        this.compositionTransactionNotifier.done();
        this.compositionTransactionNotifier = null;
      }
    };

    return RouterView;
  }(), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, 'swapOrder', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, 'layoutView', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, 'layoutViewModel', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, 'layoutModel', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: null
  })), _class2)) || _class) || _class) || _class);
});
define('aurelia-templating-router/route-href',['exports', 'aurelia-templating', 'aurelia-dependency-injection', 'aurelia-router', 'aurelia-pal', 'aurelia-logging'], function (exports, _aureliaTemplating, _aureliaDependencyInjection, _aureliaRouter, _aureliaPal, _aureliaLogging) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.RouteHref = undefined;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  

  var _dec, _dec2, _dec3, _dec4, _dec5, _class;

  var logger = LogManager.getLogger('route-href');

  var RouteHref = exports.RouteHref = (_dec = (0, _aureliaTemplating.customAttribute)('route-href'), _dec2 = (0, _aureliaTemplating.bindable)({ name: 'route', changeHandler: 'processChange' }), _dec3 = (0, _aureliaTemplating.bindable)({ name: 'params', changeHandler: 'processChange' }), _dec4 = (0, _aureliaTemplating.bindable)({ name: 'attribute', defaultValue: 'href' }), _dec5 = (0, _aureliaDependencyInjection.inject)(_aureliaRouter.Router, _aureliaPal.DOM.Element), _dec(_class = _dec2(_class = _dec3(_class = _dec4(_class = _dec5(_class = function () {
    function RouteHref(router, element) {
      

      this.router = router;
      this.element = element;
    }

    RouteHref.prototype.bind = function bind() {
      this.isActive = true;
      this.processChange();
    };

    RouteHref.prototype.unbind = function unbind() {
      this.isActive = false;
    };

    RouteHref.prototype.attributeChanged = function attributeChanged(value, previous) {
      if (previous) {
        this.element.removeAttribute(previous);
      }

      this.processChange();
    };

    RouteHref.prototype.processChange = function processChange() {
      var _this = this;

      return this.router.ensureConfigured().then(function () {
        if (!_this.isActive) {
          return null;
        }

        var href = _this.router.generate(_this.route, _this.params);
        _this.element.setAttribute(_this.attribute, href);
        return null;
      }).catch(function (reason) {
        logger.error(reason);
      });
    };

    return RouteHref;
  }()) || _class) || _class) || _class) || _class) || _class);
});
define('aurelia-testing/aurelia-testing',['exports', './compile-spy', './view-spy', './component-tester'], function (exports, _compileSpy, _viewSpy, _componentTester) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.configure = exports.ComponentTester = exports.StageComponent = exports.ViewSpy = exports.CompileSpy = undefined;


  function configure(config) {
    config.globalResources('./compile-spy', './view-spy');
  }

  exports.CompileSpy = _compileSpy.CompileSpy;
  exports.ViewSpy = _viewSpy.ViewSpy;
  exports.StageComponent = _componentTester.StageComponent;
  exports.ComponentTester = _componentTester.ComponentTester;
  exports.configure = configure;
});;define('aurelia-testing', ['aurelia-testing/aurelia-testing'], function (main) { return main; });

define('aurelia-testing/compile-spy',['exports', 'aurelia-templating', 'aurelia-dependency-injection', 'aurelia-logging', 'aurelia-pal'], function (exports, _aureliaTemplating, _aureliaDependencyInjection, _aureliaLogging, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.CompileSpy = undefined;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  

  var _dec, _dec2, _class;

  var CompileSpy = exports.CompileSpy = (_dec = (0, _aureliaTemplating.customAttribute)('compile-spy'), _dec2 = (0, _aureliaDependencyInjection.inject)(_aureliaPal.DOM.Element, _aureliaTemplating.TargetInstruction), _dec(_class = _dec2(_class = function CompileSpy(element, instruction) {
    

    LogManager.getLogger('compile-spy').info(element, instruction);
  }) || _class) || _class);
});
define('aurelia-testing/view-spy',['exports', 'aurelia-templating', 'aurelia-logging'], function (exports, _aureliaTemplating, _aureliaLogging) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ViewSpy = undefined;

  var LogManager = _interopRequireWildcard(_aureliaLogging);

  function _interopRequireWildcard(obj) {
    if (obj && obj.__esModule) {
      return obj;
    } else {
      var newObj = {};

      if (obj != null) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
        }
      }

      newObj.default = obj;
      return newObj;
    }
  }

  

  var _dec, _class;

  var ViewSpy = exports.ViewSpy = (_dec = (0, _aureliaTemplating.customAttribute)('view-spy'), _dec(_class = function () {
    function ViewSpy() {
      

      this.logger = LogManager.getLogger('view-spy');
    }

    ViewSpy.prototype._log = function _log(lifecycleName, context) {
      if (!this.value && lifecycleName === 'created') {
        this.logger.info(lifecycleName, this.view);
      } else if (this.value && this.value.indexOf(lifecycleName) !== -1) {
        this.logger.info(lifecycleName, this.view, context);
      }
    };

    ViewSpy.prototype.created = function created(view) {
      this.view = view;
      this._log('created');
    };

    ViewSpy.prototype.bind = function bind(bindingContext) {
      this._log('bind', bindingContext);
    };

    ViewSpy.prototype.attached = function attached() {
      this._log('attached');
    };

    ViewSpy.prototype.detached = function detached() {
      this._log('detached');
    };

    ViewSpy.prototype.unbind = function unbind() {
      this._log('unbind');
    };

    return ViewSpy;
  }()) || _class);
});
define('aurelia-testing/component-tester',['exports', 'aurelia-templating', 'aurelia-framework'], function (exports, _aureliaTemplating, _aureliaFramework) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.ComponentTester = exports.StageComponent = undefined;

  

  var StageComponent = exports.StageComponent = {
    withResources: function withResources(resources) {
      return new ComponentTester().withResources(resources);
    }
  };

  var ComponentTester = exports.ComponentTester = function () {
    function ComponentTester() {
      

      this.configure = function (aurelia) {
        return aurelia.use.standardConfiguration();
      };

      this._resources = [];
    }

    ComponentTester.prototype.bootstrap = function bootstrap(configure) {
      this.configure = configure;
    };

    ComponentTester.prototype.withResources = function withResources(resources) {
      this._resources = resources;
      return this;
    };

    ComponentTester.prototype.inView = function inView(html) {
      this._html = html;
      return this;
    };

    ComponentTester.prototype.boundTo = function boundTo(bindingContext) {
      this._bindingContext = bindingContext;
      return this;
    };

    ComponentTester.prototype.manuallyHandleLifecycle = function manuallyHandleLifecycle() {
      this._prepareLifecycle();
      return this;
    };

    ComponentTester.prototype.create = function create(bootstrap) {
      var _this = this;

      return bootstrap(function (aurelia) {
        return Promise.resolve(_this.configure(aurelia)).then(function () {
          if (_this._resources) {
            aurelia.use.globalResources(_this._resources);
          }

          return aurelia.start().then(function (a) {
            _this.host = document.createElement('div');
            _this.host.innerHTML = _this._html;

            document.body.appendChild(_this.host);

            return aurelia.enhance(_this._bindingContext, _this.host).then(function () {
              _this._rootView = aurelia.root;
              _this.element = _this.host.firstElementChild;

              if (aurelia.root.controllers.length) {
                _this.viewModel = aurelia.root.controllers[0].viewModel;
              }

              return new Promise(function (resolve) {
                return setTimeout(function () {
                  return resolve();
                }, 0);
              });
            });
          });
        });
      });
    };

    ComponentTester.prototype.dispose = function dispose() {
      if (this.host === undefined || this._rootView === undefined) {
        throw new Error('Cannot call ComponentTester.dispose() before ComponentTester.create()');
      }

      this._rootView.detached();
      this._rootView.unbind();

      return this.host.parentNode.removeChild(this.host);
    };

    ComponentTester.prototype._prepareLifecycle = function _prepareLifecycle() {
      var _this2 = this;

      var bindPrototype = _aureliaTemplating.View.prototype.bind;
      _aureliaTemplating.View.prototype.bind = function () {};
      this.bind = function (bindingContext) {
        return new Promise(function (resolve) {
          _aureliaTemplating.View.prototype.bind = bindPrototype;
          if (bindingContext !== undefined) {
            _this2._bindingContext = bindingContext;
          }
          _this2._rootView.bind(_this2._bindingContext);
          setTimeout(function () {
            return resolve();
          }, 0);
        });
      };

      var attachedPrototype = _aureliaTemplating.View.prototype.attached;
      _aureliaTemplating.View.prototype.attached = function () {};
      this.attached = function () {
        return new Promise(function (resolve) {
          _aureliaTemplating.View.prototype.attached = attachedPrototype;
          _this2._rootView.attached();
          setTimeout(function () {
            return resolve();
          }, 0);
        });
      };

      this.detached = function () {
        return new Promise(function (resolve) {
          _this2._rootView.detached();
          setTimeout(function () {
            return resolve();
          }, 0);
        });
      };

      this.unbind = function () {
        return new Promise(function (resolve) {
          _this2._rootView.unbind();
          setTimeout(function () {
            return resolve();
          }, 0);
        });
      };
    };

    return ComponentTester;
  }();
});
define('aurelia-dialog/aurelia-dialog',['exports', './ai-dialog', './ai-dialog-header', './ai-dialog-body', './ai-dialog-footer', './attach-focus', './dialog-configuration', './dialog-service', './dialog-controller', './dialog-result'], function (exports, _aiDialog, _aiDialogHeader, _aiDialogBody, _aiDialogFooter, _attachFocus, _dialogConfiguration, _dialogService, _dialogController, _dialogResult) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DialogResult = exports.DialogController = exports.DialogService = exports.DialogConfiguration = exports.AttachFocus = exports.AiDialogFooter = exports.AiDialogBody = exports.AiDialogHeader = exports.AiDialog = undefined;
  Object.defineProperty(exports, 'AiDialog', {
    enumerable: true,
    get: function () {
      return _aiDialog.AiDialog;
    }
  });
  Object.defineProperty(exports, 'AiDialogHeader', {
    enumerable: true,
    get: function () {
      return _aiDialogHeader.AiDialogHeader;
    }
  });
  Object.defineProperty(exports, 'AiDialogBody', {
    enumerable: true,
    get: function () {
      return _aiDialogBody.AiDialogBody;
    }
  });
  Object.defineProperty(exports, 'AiDialogFooter', {
    enumerable: true,
    get: function () {
      return _aiDialogFooter.AiDialogFooter;
    }
  });
  Object.defineProperty(exports, 'AttachFocus', {
    enumerable: true,
    get: function () {
      return _attachFocus.AttachFocus;
    }
  });
  exports.configure = configure;
  Object.defineProperty(exports, 'DialogConfiguration', {
    enumerable: true,
    get: function () {
      return _dialogConfiguration.DialogConfiguration;
    }
  });
  Object.defineProperty(exports, 'DialogService', {
    enumerable: true,
    get: function () {
      return _dialogService.DialogService;
    }
  });
  Object.defineProperty(exports, 'DialogController', {
    enumerable: true,
    get: function () {
      return _dialogController.DialogController;
    }
  });
  Object.defineProperty(exports, 'DialogResult', {
    enumerable: true,
    get: function () {
      return _dialogResult.DialogResult;
    }
  });
  function configure(aurelia, callback) {
    var config = new _dialogConfiguration.DialogConfiguration(aurelia);

    if (typeof callback === 'function') {
      callback(config);
    } else {
      config.useDefaults();
    }

    config._apply();
  }
});;define('aurelia-dialog', ['aurelia-dialog/aurelia-dialog'], function (main) { return main; });

define('aurelia-dialog/ai-dialog',['exports', 'aurelia-templating'], function (exports, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AiDialog = undefined;

  

  var _dec, _dec2, _class;

  var AiDialog = exports.AiDialog = (_dec = (0, _aureliaTemplating.customElement)('ai-dialog'), _dec2 = (0, _aureliaTemplating.inlineView)('\n  <template>\n    <slot></slot>\n  </template>\n'), _dec(_class = _dec2(_class = function AiDialog() {
    
  }) || _class) || _class);
});
define('aurelia-dialog/ai-dialog-header',['exports', 'aurelia-templating', './dialog-controller'], function (exports, _aureliaTemplating, _dialogController) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AiDialogHeader = undefined;

  

  var _dec, _dec2, _class, _class2, _temp;

  var AiDialogHeader = exports.AiDialogHeader = (_dec = (0, _aureliaTemplating.customElement)('ai-dialog-header'), _dec2 = (0, _aureliaTemplating.inlineView)('\n  <template>\n    <button type="button" class="dialog-close" aria-label="Close" if.bind="!controller.settings.lock" click.trigger="controller.cancel()">\n      <span aria-hidden="true">&times;</span>\n    </button>\n\n    <div class="dialog-header-content">\n      <slot></slot>\n    </div>\n  </template>\n'), _dec(_class = _dec2(_class = (_temp = _class2 = function AiDialogHeader(controller) {
    

    this.controller = controller;
  }, _class2.inject = [_dialogController.DialogController], _temp)) || _class) || _class);
});
define('aurelia-dialog/dialog-controller',['exports', './lifecycle', './dialog-result'], function (exports, _lifecycle, _dialogResult) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DialogController = undefined;

  

  var DialogController = exports.DialogController = function () {
    function DialogController(renderer, settings, resolve, reject) {
      

      this.renderer = renderer;
      this.settings = settings;
      this._resolve = resolve;
      this._reject = reject;
    }

    DialogController.prototype.ok = function ok(output) {
      return this.close(true, output);
    };

    DialogController.prototype.cancel = function cancel(output) {
      return this.close(false, output);
    };

    DialogController.prototype.error = function error(message) {
      var _this = this;

      return (0, _lifecycle.invokeLifecycle)(this.viewModel, 'deactivate').then(function () {
        return _this.renderer.hideDialog(_this);
      }).then(function () {
        _this.controller.unbind();
        _this._reject(message);
      });
    };

    DialogController.prototype.close = function close(ok, output) {
      var _this2 = this;

      if (this._closePromise) return this._closePromise;

      this._closePromise = (0, _lifecycle.invokeLifecycle)(this.viewModel, 'canDeactivate').then(function (canDeactivate) {
        if (canDeactivate) {
          return (0, _lifecycle.invokeLifecycle)(_this2.viewModel, 'deactivate').then(function () {
            return _this2.renderer.hideDialog(_this2);
          }).then(function () {
            var result = new _dialogResult.DialogResult(!ok, output);
            _this2.controller.unbind();
            _this2._resolve(result);
            return result;
          });
        }

        return Promise.resolve();
      });

      return this._closePromise;
    };

    return DialogController;
  }();
});
define('aurelia-dialog/lifecycle',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.invokeLifecycle = invokeLifecycle;
  function invokeLifecycle(instance, name, model) {
    if (typeof instance[name] === 'function') {
      var result = instance[name](model);

      if (result instanceof Promise) {
        return result;
      }

      if (result !== null && result !== undefined) {
        return Promise.resolve(result);
      }

      return Promise.resolve(true);
    }

    return Promise.resolve(true);
  }
});
define('aurelia-dialog/dialog-result',["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  var DialogResult = exports.DialogResult = function DialogResult(cancelled, output) {
    

    this.wasCancelled = false;

    this.wasCancelled = cancelled;
    this.output = output;
  };
});
define('aurelia-dialog/ai-dialog-body',['exports', 'aurelia-templating'], function (exports, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AiDialogBody = undefined;

  

  var _dec, _dec2, _class;

  var AiDialogBody = exports.AiDialogBody = (_dec = (0, _aureliaTemplating.customElement)('ai-dialog-body'), _dec2 = (0, _aureliaTemplating.inlineView)('\n  <template>\n    <slot></slot>\n  </template>\n'), _dec(_class = _dec2(_class = function AiDialogBody() {
    
  }) || _class) || _class);
});
define('aurelia-dialog/ai-dialog-footer',['exports', 'aurelia-templating', './dialog-controller'], function (exports, _aureliaTemplating, _dialogController) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AiDialogFooter = undefined;

  function _initDefineProp(target, property, descriptor, context) {
    if (!descriptor) return;
    Object.defineProperty(target, property, {
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      writable: descriptor.writable,
      value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
    });
  }

  

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {};
    Object['ke' + 'ys'](descriptor).forEach(function (key) {
      desc[key] = descriptor[key];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;

    if ('value' in desc || desc.initializer) {
      desc.writable = true;
    }

    desc = decorators.slice().reverse().reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc;
    }, desc);

    if (context && desc.initializer !== void 0) {
      desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
      desc.initializer = undefined;
    }

    if (desc.initializer === void 0) {
      Object['define' + 'Property'](target, property, desc);
      desc = null;
    }

    return desc;
  }

  function _initializerWarningHelper(descriptor, context) {
    throw new Error('Decorating class property failed. Please ensure that transform-class-properties is enabled.');
  }

  var _dec, _dec2, _class, _desc, _value, _class2, _descriptor, _descriptor2, _class3, _temp;

  var AiDialogFooter = exports.AiDialogFooter = (_dec = (0, _aureliaTemplating.customElement)('ai-dialog-footer'), _dec2 = (0, _aureliaTemplating.inlineView)('\n  <template>\n    <slot></slot>\n\n    <template if.bind="buttons.length > 0">\n      <button type="button" class="btn btn-default" repeat.for="button of buttons" click.trigger="close(button)">${button}</button>\n    </template>\n  </template>\n'), _dec(_class = _dec2(_class = (_class2 = (_temp = _class3 = function () {
    function AiDialogFooter(controller) {
      

      _initDefineProp(this, 'buttons', _descriptor, this);

      _initDefineProp(this, 'useDefaultButtons', _descriptor2, this);

      this.controller = controller;
    }

    AiDialogFooter.prototype.close = function close(buttonValue) {
      if (AiDialogFooter.isCancelButton(buttonValue)) {
        this.controller.cancel(buttonValue);
      } else {
        this.controller.ok(buttonValue);
      }
    };

    AiDialogFooter.prototype.useDefaultButtonsChanged = function useDefaultButtonsChanged(newValue) {
      if (newValue) {
        this.buttons = ['Cancel', 'Ok'];
      }
    };

    AiDialogFooter.isCancelButton = function isCancelButton(value) {
      return value === 'Cancel';
    };

    return AiDialogFooter;
  }(), _class3.inject = [_dialogController.DialogController], _temp), (_descriptor = _applyDecoratedDescriptor(_class2.prototype, 'buttons', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: function initializer() {
      return [];
    }
  }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, 'useDefaultButtons', [_aureliaTemplating.bindable], {
    enumerable: true,
    initializer: function initializer() {
      return false;
    }
  })), _class2)) || _class) || _class);
});
define('aurelia-dialog/attach-focus',['exports', 'aurelia-templating'], function (exports, _aureliaTemplating) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.AttachFocus = undefined;

  

  var _dec, _class, _class2, _temp;

  var AttachFocus = exports.AttachFocus = (_dec = (0, _aureliaTemplating.customAttribute)('attach-focus'), _dec(_class = (_temp = _class2 = function () {
    function AttachFocus(element) {
      

      this.value = true;

      this.element = element;
    }

    AttachFocus.prototype.attached = function attached() {
      if (this.value && this.value !== 'false') {
        this.element.focus();
      }
    };

    AttachFocus.prototype.valueChanged = function valueChanged(newValue) {
      this.value = newValue;
    };

    return AttachFocus;
  }(), _class2.inject = [Element], _temp)) || _class);
});
define('aurelia-dialog/dialog-configuration',['exports', './renderer', './dialog-renderer', './dialog-options', 'aurelia-pal'], function (exports, _renderer, _dialogRenderer, _dialogOptions, _aureliaPal) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DialogConfiguration = undefined;

  

  var defaultRenderer = _dialogRenderer.DialogRenderer;

  var resources = {
    'ai-dialog': './ai-dialog',
    'ai-dialog-header': './ai-dialog-header',
    'ai-dialog-body': './ai-dialog-body',
    'ai-dialog-footer': './ai-dialog-footer',
    'attach-focus': './attach-focus'
  };

  var defaultCSSText = 'ai-dialog-container,ai-dialog-overlay{position:fixed;top:0;right:0;bottom:0;left:0}ai-dialog,ai-dialog-container>div>div{min-width:300px;margin:auto;display:block}ai-dialog-overlay{opacity:0}ai-dialog-overlay.active{opacity:1}ai-dialog-container{display:block;transition:opacity .2s linear;opacity:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch}ai-dialog-container.active{opacity:1}ai-dialog-container>div{padding:30px}ai-dialog-container>div>div{width:-moz-fit-content;width:-webkit-fit-content;width:fit-content;height:-moz-fit-content;height:-webkit-fit-content;height:fit-content}ai-dialog-container,ai-dialog-container>div,ai-dialog-container>div>div{outline:0}ai-dialog{box-shadow:0 5px 15px rgba(0,0,0,.5);border:1px solid rgba(0,0,0,.2);border-radius:5px;padding:3;width:-moz-fit-content;width:-webkit-fit-content;width:fit-content;height:-moz-fit-content;height:-webkit-fit-content;height:fit-content;border-image-source:initial;border-image-slice:initial;border-image-width:initial;border-image-outset:initial;border-image-repeat:initial;background:#fff}ai-dialog>ai-dialog-header{display:block;padding:16px;border-bottom:1px solid #e5e5e5}ai-dialog>ai-dialog-header>button{float:right;border:none;display:block;width:32px;height:32px;background:0 0;font-size:22px;line-height:16px;margin:-14px -16px 0 0;padding:0;cursor:pointer}ai-dialog>ai-dialog-body{display:block;padding:16px}ai-dialog>ai-dialog-footer{display:block;padding:6px;border-top:1px solid #e5e5e5;text-align:right}ai-dialog>ai-dialog-footer button{color:#333;background-color:#fff;padding:6px 12px;font-size:14px;text-align:center;white-space:nowrap;vertical-align:middle;-ms-touch-action:manipulation;touch-action:manipulation;cursor:pointer;background-image:none;border:1px solid #ccc;border-radius:4px;margin:5px 0 5px 5px}ai-dialog>ai-dialog-footer button:disabled{cursor:default;opacity:.45}ai-dialog>ai-dialog-footer button:hover:enabled{color:#333;background-color:#e6e6e6;border-color:#adadad}.ai-dialog-open{overflow:hidden}';

  var DialogConfiguration = exports.DialogConfiguration = function () {
    function DialogConfiguration(aurelia) {
      

      this.aurelia = aurelia;
      this.settings = _dialogOptions.dialogOptions;
      this.resources = [];
      this.cssText = defaultCSSText;
      this.renderer = defaultRenderer;
    }

    DialogConfiguration.prototype.useDefaults = function useDefaults() {
      return this.useRenderer(defaultRenderer).useCSS(defaultCSSText).useStandardResources();
    };

    DialogConfiguration.prototype.useStandardResources = function useStandardResources() {
      return this.useResource('ai-dialog').useResource('ai-dialog-header').useResource('ai-dialog-body').useResource('ai-dialog-footer').useResource('attach-focus');
    };

    DialogConfiguration.prototype.useResource = function useResource(resourceName) {
      this.resources.push(resourceName);
      return this;
    };

    DialogConfiguration.prototype.useRenderer = function useRenderer(renderer, settings) {
      this.renderer = renderer;
      this.settings = Object.assign(this.settings, settings || {});
      return this;
    };

    DialogConfiguration.prototype.useCSS = function useCSS(cssText) {
      this.cssText = cssText;
      return this;
    };

    DialogConfiguration.prototype._apply = function _apply() {
      var _this = this;

      this.aurelia.transient(_renderer.Renderer, this.renderer);
      this.resources.forEach(function (resourceName) {
        return _this.aurelia.globalResources(resources[resourceName]);
      });

      if (this.cssText) {
        _aureliaPal.DOM.injectStyles(this.cssText);
      }
    };

    return DialogConfiguration;
  }();
});
define('aurelia-dialog/renderer',['exports'], function (exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  

  var Renderer = exports.Renderer = function () {
    function Renderer() {
      
    }

    Renderer.prototype.getDialogContainer = function getDialogContainer() {
      throw new Error('DialogRenderer must implement getDialogContainer().');
    };

    Renderer.prototype.showDialog = function showDialog(dialogController) {
      throw new Error('DialogRenderer must implement showDialog().');
    };

    Renderer.prototype.hideDialog = function hideDialog(dialogController) {
      throw new Error('DialogRenderer must implement hideDialog().');
    };

    return Renderer;
  }();
});
define('aurelia-dialog/dialog-renderer',['exports', './dialog-options', 'aurelia-pal', 'aurelia-dependency-injection'], function (exports, _dialogOptions, _aureliaPal, _aureliaDependencyInjection) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DialogRenderer = undefined;

  

  var _dec, _class;

  var containerTagName = 'ai-dialog-container';
  var overlayTagName = 'ai-dialog-overlay';
  var transitionEvent = function () {
    var transition = null;

    return function () {
      if (transition) return transition;

      var t = void 0;
      var el = _aureliaPal.DOM.createElement('fakeelement');
      var transitions = {
        'transition': 'transitionend',
        'OTransition': 'oTransitionEnd',
        'MozTransition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd'
      };
      for (t in transitions) {
        if (el.style[t] !== undefined) {
          transition = transitions[t];
          return transition;
        }
      }
    };
  }();

  var DialogRenderer = exports.DialogRenderer = (_dec = (0, _aureliaDependencyInjection.transient)(), _dec(_class = function () {
    function DialogRenderer() {
      var _this = this;

      

      this.dialogControllers = [];

      this.escapeKeyEvent = function (e) {
        if (e.keyCode === 27) {
          var top = _this.dialogControllers[_this.dialogControllers.length - 1];
          if (top && top.settings.lock !== true) {
            top.cancel();
          }
        }
      };

      this.defaultSettings = _dialogOptions.dialogOptions;
    }

    DialogRenderer.prototype.getDialogContainer = function getDialogContainer() {
      return _aureliaPal.DOM.createElement('div');
    };

    DialogRenderer.prototype.showDialog = function showDialog(dialogController) {
      var _this2 = this;

      var settings = Object.assign({}, this.defaultSettings, dialogController.settings);
      var body = _aureliaPal.DOM.querySelectorAll('body')[0];
      var wrapper = document.createElement('div');

      this.modalOverlay = _aureliaPal.DOM.createElement(overlayTagName);
      this.modalContainer = _aureliaPal.DOM.createElement(containerTagName);
      this.anchor = dialogController.slot.anchor;
      wrapper.appendChild(this.anchor);
      this.modalContainer.appendChild(wrapper);

      this.stopPropagation = function (e) {
        e._aureliaDialogHostClicked = true;
      };
      this.closeModalClick = function (e) {
        if (!settings.lock && !e._aureliaDialogHostClicked) {
          dialogController.cancel();
        } else {
          return false;
        }
      };

      dialogController.centerDialog = function () {
        if (settings.centerHorizontalOnly) return;
        centerDialog(_this2.modalContainer);
      };

      this.modalOverlay.style.zIndex = this.defaultSettings.startingZIndex;
      this.modalContainer.style.zIndex = this.defaultSettings.startingZIndex;

      var lastContainer = Array.from(body.querySelectorAll(containerTagName)).pop();

      if (lastContainer) {
        lastContainer.parentNode.insertBefore(this.modalContainer, lastContainer.nextSibling);
        lastContainer.parentNode.insertBefore(this.modalOverlay, lastContainer.nextSibling);
      } else {
        body.insertBefore(this.modalContainer, body.firstChild);
        body.insertBefore(this.modalOverlay, body.firstChild);
      }

      if (!this.dialogControllers.length) {
        _aureliaPal.DOM.addEventListener('keyup', this.escapeKeyEvent);
      }

      this.dialogControllers.push(dialogController);

      dialogController.slot.attached();

      if (typeof settings.position === 'function') {
        settings.position(this.modalContainer, this.modalOverlay);
      } else {
        dialogController.centerDialog();
      }

      this.modalContainer.addEventListener('click', this.closeModalClick);
      this.anchor.addEventListener('click', this.stopPropagation);

      return new Promise(function (resolve) {
        var renderer = _this2;
        if (settings.ignoreTransitions) {
          resolve();
        } else {
          _this2.modalContainer.addEventListener(transitionEvent(), onTransitionEnd);
        }

        _this2.modalOverlay.classList.add('active');
        _this2.modalContainer.classList.add('active');
        body.classList.add('ai-dialog-open');

        function onTransitionEnd(e) {
          if (e.target !== renderer.modalContainer) {
            return;
          }
          renderer.modalContainer.removeEventListener(transitionEvent(), onTransitionEnd);
          resolve();
        }
      });
    };

    DialogRenderer.prototype.hideDialog = function hideDialog(dialogController) {
      var _this3 = this;

      var settings = Object.assign({}, this.defaultSettings, dialogController.settings);
      var body = _aureliaPal.DOM.querySelectorAll('body')[0];

      this.modalContainer.removeEventListener('click', this.closeModalClick);
      this.anchor.removeEventListener('click', this.stopPropagation);

      var i = this.dialogControllers.indexOf(dialogController);
      if (i !== -1) {
        this.dialogControllers.splice(i, 1);
      }

      if (!this.dialogControllers.length) {
        _aureliaPal.DOM.removeEventListener('keyup', this.escapeKeyEvent);
      }

      return new Promise(function (resolve) {
        var renderer = _this3;
        if (settings.ignoreTransitions) {
          resolve();
        } else {
          _this3.modalContainer.addEventListener(transitionEvent(), onTransitionEnd);
        }

        _this3.modalOverlay.classList.remove('active');
        _this3.modalContainer.classList.remove('active');

        function onTransitionEnd() {
          renderer.modalContainer.removeEventListener(transitionEvent(), onTransitionEnd);
          resolve();
        }
      }).then(function () {
        body.removeChild(_this3.modalOverlay);
        body.removeChild(_this3.modalContainer);
        dialogController.slot.detached();

        if (!_this3.dialogControllers.length) {
          body.classList.remove('ai-dialog-open');
        }

        return Promise.resolve();
      });
    };

    return DialogRenderer;
  }()) || _class);


  function centerDialog(modalContainer) {
    var child = modalContainer.children[0];
    var vh = Math.max(_aureliaPal.DOM.querySelectorAll('html')[0].clientHeight, window.innerHeight || 0);

    child.style.marginTop = Math.max((vh - child.offsetHeight) / 2, 30) + 'px';
    child.style.marginBottom = Math.max((vh - child.offsetHeight) / 2, 30) + 'px';
  }
});
define('aurelia-dialog/dialog-options',["exports"], function (exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var dialogOptions = exports.dialogOptions = {
    lock: true,
    centerHorizontalOnly: false,
    startingZIndex: 1000,
    ignoreTransitions: false
  };
});
define('aurelia-dialog/dialog-service',['exports', 'aurelia-metadata', 'aurelia-dependency-injection', 'aurelia-templating', './dialog-controller', './renderer', './lifecycle', './dialog-result'], function (exports, _aureliaMetadata, _aureliaDependencyInjection, _aureliaTemplating, _dialogController, _renderer, _lifecycle, _dialogResult) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.DialogService = undefined;

  

  var _class, _temp;

  var DialogService = exports.DialogService = (_temp = _class = function () {
    function DialogService(container, compositionEngine) {
      

      this.container = container;
      this.compositionEngine = compositionEngine;
      this.controllers = [];
      this.hasActiveDialog = false;
    }

    DialogService.prototype.open = function open(settings) {
      var _this = this;

      var dialogController = void 0;

      var promise = new Promise(function (resolve, reject) {
        var childContainer = _this.container.createChild();
        dialogController = new _dialogController.DialogController(childContainer.get(_renderer.Renderer), settings, resolve, reject);
        childContainer.registerInstance(_dialogController.DialogController, dialogController);
        return _openDialog(_this, childContainer, dialogController);
      });

      return promise.then(function (result) {
        var i = _this.controllers.indexOf(dialogController);
        if (i !== -1) {
          _this.controllers.splice(i, 1);
          _this.hasActiveDialog = !!_this.controllers.length;
        }

        return result;
      });
    };

    DialogService.prototype.openAndYieldController = function openAndYieldController(settings) {
      var _this2 = this;

      var childContainer = this.container.createChild();
      var dialogController = new _dialogController.DialogController(childContainer.get(_renderer.Renderer), settings, null, null);
      childContainer.registerInstance(_dialogController.DialogController, dialogController);

      dialogController.result = new Promise(function (resolve, reject) {
        dialogController._resolve = resolve;
        dialogController._reject = reject;
      }).then(function (result) {
        var i = _this2.controllers.indexOf(dialogController);
        if (i !== -1) {
          _this2.controllers.splice(i, 1);
          _this2.hasActiveDialog = !!_this2.controllers.length;
        }
        return result;
      });

      return _openDialog(this, childContainer, dialogController).then(function () {
        return dialogController;
      });
    };

    return DialogService;
  }(), _class.inject = [_aureliaDependencyInjection.Container, _aureliaTemplating.CompositionEngine], _temp);


  function _openDialog(service, childContainer, dialogController) {
    var host = dialogController.renderer.getDialogContainer();
    var instruction = {
      container: service.container,
      childContainer: childContainer,
      model: dialogController.settings.model,
      view: dialogController.settings.view,
      viewModel: dialogController.settings.viewModel,
      viewSlot: new _aureliaTemplating.ViewSlot(host, true),
      host: host
    };

    return _getViewModel(instruction, service.compositionEngine).then(function (returnedInstruction) {
      dialogController.viewModel = returnedInstruction.viewModel;
      dialogController.slot = returnedInstruction.viewSlot;

      return (0, _lifecycle.invokeLifecycle)(dialogController.viewModel, 'canActivate', dialogController.settings.model).then(function (canActivate) {
        if (canActivate) {
          service.controllers.push(dialogController);
          service.hasActiveDialog = !!service.controllers.length;

          return service.compositionEngine.compose(returnedInstruction).then(function (controller) {
            dialogController.controller = controller;
            dialogController.view = controller.view;

            return dialogController.renderer.showDialog(dialogController);
          });
        }
      });
    });
  }

  function _getViewModel(instruction, compositionEngine) {
    if (typeof instruction.viewModel === 'function') {
      instruction.viewModel = _aureliaMetadata.Origin.get(instruction.viewModel).moduleId;
    }

    if (typeof instruction.viewModel === 'string') {
      return compositionEngine.ensureViewModel(instruction);
    }

    return Promise.resolve(instruction);
  }
});