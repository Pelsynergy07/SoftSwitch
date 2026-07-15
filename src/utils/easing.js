/**
 * @fileoverview Easing functions. Sets window.SS_Easing.
 */
(function () {
  'use strict';

  function linear(t) { return t; }

  function easeIn(t) { return t * t; }

  function easeOut(t) { return t * (2 - t); }

  function easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : -1 + (4 - 2 * t) * t;
  }

  /**
   * @param {string} name
   * @returns {function(number): number}
   */
  function getEasing(name) {
    switch (name) {
      case 'linear':   return linear;
      case 'easeIn':   return easeIn;
      case 'easeOut':  return easeOut;
      case 'easeInOut':
      default:         return easeInOut;
    }
  }

  window.SS_Easing = {
    linear: linear,
    easeIn: easeIn,
    easeOut: easeOut,
    easeInOut: easeInOut,
    getEasing: getEasing,
  };
})();
