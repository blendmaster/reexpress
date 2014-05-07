var a = [[1,1], [2,2]];
var b = [[1,1], [2,2]];

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


function warpLine(a, b) {
	var P = a[0];
	var Q = a[1];
	var Phat = b[0];
	var Qhat = b[1];

	return function (dest) {
		var magnQP =  Math.sqrt( Math.pow(Q[0]-P[0], 2) + Math.pow(Q[1]-P[1], 2) );
		var magnQPhat = Math.sqrt( Math.pow(Qhat[0]-Phat[0], 2) + Math.pow(Qhat[1]-Phat[1], 2) );
		 
		var u =  numeric.dot( numeric.sub(dest, P), numeric.sub(Q,P) ) / Math.pow(magnQP, 2);
		var v =  numeric.dot( numeric.sub(dest, P), perpendicular( numeric.sub(Q,P) ) ) / magnQP;

		var source = numeric.add( numeric.add( Phat, scalarMult( u, numeric.sub(Qhat,Phat) )), numeric.div(scalarMult( v, perpendicular( numeric.sub(Qhat,Phat) ) ), magnQPhat ) );
		var displacement = numeric.sub(source, dest);
		var p = 0;
		var a = 0.001;
		var b = 0.3;
		var weight = Math.pow(Math.pow(magnQP, p) / (a + v), b);
		return [displacement, weight];
	}
}

function warp(lines, destpix) {
	var numLines = lines.length;
	var DSUM = [0,0];
	var weightsum = 0;
	for (var i = 0; i < numLines; i++) {
		var warper = warpLine(lines[i][0], lines[i][1]);
		var dw = warper(destpix);
		DSUM = numeric.add(DSUM, scalarMult(dw[1], dw[0]));
		weightsum += dw[1];
	}
	var sourcepix = numeric.add(destpix, numeric.div(DSUM, weightsum));
	return sourcepix;
}


var lines = [[a,b]];
var source = warp(lines, [100,100]);
console.log("source: (" + source[0] + ", " + source[1] + ")" );

