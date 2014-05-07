"use strict";

function perpendicular(vec) {
  var x = vec[1];
  var y = vec[0] * -1;
  return [x, y];
}

function scalarMult(scalar, vec) {
  var x = vec[0] * scalar;
  var y = vec[1] * scalar;
  return [x, y];
}

// dest: [[x, y], [x, y]]
// source: [[x, y], [x, y]]
function warpLine(dest, src, point, p, a, b) {
  var P = dest[0];
  var Q = dest[1];
  var Phat = src[0];
  var Qhat = src[1];

  var magnQP =  Math.sqrt(
      Math.pow(Q[0]-P[0], 2) + Math.pow(Q[1]-P[1], 2) );
  var magnQPhat = Math.sqrt(
      Math.pow(Qhat[0]-Phat[0], 2) + Math.pow(Qhat[1]-Phat[1], 2) );
  var u =
    numeric.dot(
     numeric.sub(point, P),
     numeric.sub(Q,P)
    ) / Math.pow(magnQP, 2);

  var v =
    numeric.dot(
      numeric.sub(point, P),
      perpendicular(numeric.sub(Q,P))
    ) / magnQP;

  var source =
    numeric.add(
      numeric.add(
        Phat,
        scalarMult(u, numeric.sub(Qhat,Phat))
      ),
      numeric.div(
        scalarMult(
          v,
          perpendicular(numeric.sub(Qhat,Phat))
        ),
        magnQPhat
      )
    );

  var displacement = numeric.sub(source, point);
  var weight = Math.pow(
    Math.abs(Math.pow(magnQP, p) / (a + v)),
    b
  );
  return [displacement, weight];
}

// lines: pairs of [destLine, srcLine]
// destpix: [x, y]
// p, a, b are multiline weight parameters
function warp(lines, destpix, p, a, b) {
  var numLines = lines.length;
  var DSUM = [0,0];
  var weightsum = 0;
  for (var i = 0; i < numLines; i++) {
    var dw = warpLine(lines[i][0], lines[i][1], destpix, p, a, b);
    DSUM = numeric.add(DSUM, scalarMult(dw[1], dw[0]));
    weightsum += dw[1];
  }
  var sourcepix = numeric.add(destpix, numeric.div(DSUM, weightsum));
  return sourcepix;
}
