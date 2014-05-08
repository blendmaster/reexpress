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

// 2d vector specializations:

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function mag(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

// lines: pairs of [destLine, srcLine]
// destpix: [x, y]
// p, a, b are multiline weight parameters
function warp(lines, destpix, p, a, b) {
  var numLines = lines.length;
  var us = 0, vs = 0;
  var weightsum = 0;
  for (var i = 0; i < numLines; i++) {
    var P = lines[i][0][0];
    var Q = lines[i][0][1];
    var Phat = lines[i][1][0];
    var Qhat = lines[i][1][1];

    var pq = sub(Q,P);
    var pqhat = sub(Qhat,Phat);

    var pd = sub(destpix, P);

    var magnQP = mag(pq);
    var magnQPhat = mag(pqhat);

    var u = dot(pd, pq) / Math.pow(magnQP, 2);
    var v = dot(pd, perpendicular(pq)) / magnQP;

    var source =
      add(
        add(Phat, scalarMult(u, pqhat)),
        numeric.div(
          scalarMult(v, perpendicular(pqhat)),
          magnQPhat
        )
      );

    var displacement = sub(source, destpix);

    var weight = Math.pow(
      Math.abs(Math.pow(magnQP, p) / (a + v)),
      b
    );

    us += displacement[0] * weight;
    vs += displacement[1] * weight;
    weightsum += weight;
  }
  return add(destpix, [us/weightsum, vs/weightsum]);
}
