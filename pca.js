function pca(X) {
    /*
        Return matrix of all principle components as column vectors
    */
    var m = X.length;
    var sigma = numeric.div(numeric.dot(numeric.transpose(X), X), m);
    console.log(sigma);
    console.log(numeric.svd(sigma));
    return numeric.svd(sigma).U;
}
