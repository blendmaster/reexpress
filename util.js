// reexpress: performance-driven non-photorealistic face drawing
// Authors: Steven Ruppert and Daria Tolmacheva
// For Final Project, CSCI 561 Advanced Graphics, Spring 2014,
// at the Colorado School of Mines
//
// Utility functions.
"use strict";

function debounce(delay, fn) {
  var context, args, timeout, call = function () {
    fn.apply(context, args);
  };
  return function () {
    context = this;
    args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(call, delay);
  }
}
