function pca(X) {
    /*
        Return matrix of all principle components as column vectors
    */        
    var m = X.length;
    var sigma = numeric.div(numeric.dot(numeric.transpose(X), X), m);
    return numeric.svd(sigma).U;
}