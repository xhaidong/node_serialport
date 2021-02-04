'use strict';

const sleep = (ms) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  })
}

const doOnce = (func) => {
  let done = false;
  return function innerOnce(...args) {
    if (done) {
      return;
    }
    done = true;
    Reflect.apply(func, this, args);
  };
}

module.exports = {
  sleep,
  doOnce
};