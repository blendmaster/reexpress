var a = [[1,1], [2,2]];
var b = [[1,1], [2,2]];

function perpendicular(vec) {
  	var x = vec[1];
  	if (vec[0] == 0){
  		if (x!=0)
  			x = x*-1;
  		else 
  			y = 0;
  	}
  	else {
  		y = vec[0] * -1;
  	}
  	return [x, y];
}

function scalarMult(scalar, vec) {
	var x = vec[0] * scalar;
	var y = vec[1] * scalar;
	return [x, y];

}


function warp(a, b) {
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
		return source;
	}
}


var warper = warp(a, b);
var dest  = warper([0,0]);
console.log(dest[0] + " " + dest[1]);

// for (var i = 0; i < width; ++i) {
// 	for (var j = 0; j < height; ++j) {
// 		var dest = warper([i, j]);
// 		var dx = dest[0], dy = dest[1];

// 		destinationImage.setPixel(i, j, sourceImage.getPixel(dx, dy));
// 		console.log("i: " + i + " j: " + j + " " + "dx: " + dx + " dy: " + dy + "\n");
// 	}

// }