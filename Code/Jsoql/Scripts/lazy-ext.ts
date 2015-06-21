﻿var lazy: LazyJS.LazyStatic = require('./Hacks/lazy.node')  

export function PromisedSequence(promise: Q.Promise<LazyJS.Sequence<any>|LazyJS.AsyncSequence<any>>) {

    this.promise = promise;
}

PromisedSequence.prototype = new (<any>lazy).Sequence();

PromisedSequence.prototype.isAsync = function isAsync() {
    return true;
};
    
/**
* Throws an exception. You cannot manually iterate over an asynchronous
* sequence.
*
* @public
* @example
* Lazy([1, 2, 3]).async().getIterator() // throws
*/
PromisedSequence.prototype.getIterator = function getIterator() {
    throw new Error('A PromisedSequence does not support synchronous iteration.');
};
    
/**
* An asynchronous version of {@link Sequence#each}.
*
* @public
* @param {Function} fn The function to invoke asynchronously on each element in
*     the sequence one by one.
* @returns {AsyncHandle} An {@link AsyncHandle} providing the ability to
*     cancel the asynchronous iteration (by calling `cancel()`) as well as
*     supply callback(s) for when an error is encountered (`onError`) or when
*     iteration is complete (`onComplete`).
*/
PromisedSequence.prototype.each = function each(fn) {

    var cancelled = false;

    var handle = new (<any>lazy).AsyncHandle(function cancel() {
        cancelled = true;
    });


    this.promise.then(function (parent) {
        var i = 0;
        var parentHandle = parent.each(function (item) {
            try {
                if (cancelled || fn(item, i++) === false) handle._resolve();
            }
            catch (ex) {
                handle._reject(ex);
            }
        });

        if (parentHandle['onComplete']) parentHandle['onComplete'](() => handle._resolve());

    });

    return handle;
};