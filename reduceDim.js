function reduceDim(X, O) //X: original Feature Vector , O: original dataset
{
	//choose first two eigenvectors to transform into two-dimension
	var PC = X.slice(0,2);
  console.log(PC);
	return final_data = numeric.dot(numeric.transpose(PC), numeric.transpose(O));
}
