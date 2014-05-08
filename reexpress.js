// reexpress: performance-driven non-photorealistic face drawing
// Authors: Steven Ruppert and Daria Tolmacheva
// For Final Project, CSCI 561 Advanced Graphics, Spring 2014,
// at the Colorado School of Mines
//
// Based on the techniques described in
// "Performance-Driven Hand-Drawn Animation"
// http://gfx.cs.princeton.edu/gfx/pubs/Buck_2000_PHA/index.php
"use strict";

/*
Model:

- input control points, representing facial expression:
  - eyes + eyebrows
  - lips
  - head pose is not tracked (i.e. rotation/scale)

- Hand-drawn image templates:
  - one head model, with holes for eye/eyebrows
    and lips
  - 6 lip images, to morph between
  - 4 eye images, to morph between

- Control points for all templates.

Model is kept in simple javascript global state, and mutated
by the view bindings (d3)
*/
var
  input = {
    // array of [x, y] pairs, in image coordinates
    // basic shape:
    //
    //  ___         ___
    // /               \  (eyebrows, 3 points each)
    //  /\          /\    (eyelids,  3 points each)
    //  __          __
    // /  \        /  \   (eyes, 6 points each)
    // \__/        \__/
    //
    //      _______
    //       _____        (nose bridge, 2 points)
    // |    / ___ \    |  (left/right cheecks, 2 points each)
    // |   / /___\ \   |  (outer lip, 6 points)
    // |  / /     \ \  |  (inner lip, 6 points)
    // |  \ \_____/ /  |  (teeth, 2 points)
    // |   \_______/   |
    //
    eyes: {
      "left": {
        "brow": [
          [34, 66],
          [100, 50],
          [169, 64.99999618530273]
        ],
        "lid": [
          [38, 141],
          [105, 120],
          [152, 143]
        ],
        "eye": [
          [64, 151],
          [111, 140],
          [146, 165],
          [133, 201],
          [79, 205],
          [46, 182]
        ]
      },
      "right": {
        "brow": [
          [240, 71.99999618530273],
          [300, 50],
          [361, 70.99999618530273]
        ],
        "lid": [
          [245, 140],
          [313, 125],
          [367, 159]
        ],
        "eye": [
          [282, 148],
          [322, 150],
          [351, 176],
          [339, 209],
          [284, 209],
          [245, 187]
        ]
      }
    },
    mouth: {
      "nostrils": [
        [170, 325.00001525878906],
        [261, 327.00001525878906]
      ],
      "leftCheek": [
        [133, 355],
        [106, 437]
      ],
      "rightCheek": [
        [285, 355],
        [305, 443]
      ],
      "outerLips": [
        [126, 398],
        [200, 350],
        [225, 350],
        [276, 402],
        [225, 450],
        [200, 450]
      ],
      "innerLips": [
        [162, 399],
        [184, 382],
        [228, 379],
        [258, 401],
        [225, 425],
        [200, 425]
      ],
      "teeth": [
        [174, 391],
        [243, 389]
      ]
    }
  };

/*
View:

- `#input` svg, to move input control points
  - interactions and drawing using d3
- `#output` canvas
  - from input control points and templates,
    template images are warped into the correct facial pose
    using delaunay triangulation in feature space and
    [Bieier-Neely warping][0].
- actual warping/triangulation/drawing algorithms are
  stateless, and are called by binding functions when
  input state changes to update view state.

[0]: http://www.hammerhead.com/thad/morph.html
*/

// inputs that should be drawn as lines (not closed)
var lines = [
  input.eyes.left.brow,
  input.eyes.right.brow,
  input.eyes.left.lid,
  input.eyes.right.lid,
  // input.mouth.nostrils,
  // input.mouth.leftCheek,
  // input.mouth.rightCheek,
 // input.mouth.teeth,
];

// drawn as closed shapes
var shapes = [
  input.eyes.left.eye,
  input.eyes.right.eye,
  input.mouth.outerLips,
  input.mouth.innerLips,
];

// all points, for moving (flap mapped)
var points = [].concat.apply([], lines.concat(shapes));

function pointsOf(input) {
  return [].concat(
    input.eyes.left.eye,
    input.eyes.right.eye,
    input.mouth.outerLips,
    input.mouth.innerLips,
    input.eyes.left.brow,
    input.eyes.right.brow,
    input.eyes.left.lid,
    input.eyes.right.lid
    // input.mouth.nostrils
    // XXX ignore for now
    //input.mouth.leftCheek,
    //input.mouth.rightCheek,
    //input.mouth.teeth
  );
}

// setup dragging
var dragdraw = debounce(100, draw);
var drag = d3.behavior.drag()
  .origin(function (d) {
    return {x: d[0], y: d[1]};
  })
  .on('dragstart', function () {
    $in.style('cursor', 'pointer');
  })
  .on('dragend', function () {
    $in.style('cursor', null);
  })
  .on('drag', function (d) {
    d3.select(this)
      .attr('cx', d[0] = d3.event.x)
      .attr('cy', d[1] = d3.event.y);
    dragdraw();
  });

// bind to svg elements
var $in = d3.select('#input');

var $lines = $in.selectAll('.line').data(lines);
$lines.enter().append('path').attr('class', 'line') ;

var $shapes = $in.selectAll('.shape').data(shapes);
$shapes.enter().append('path').attr('class', 'shape');

var $points = $in.selectAll('.point').data(points);
$points.enter().append('circle').attr('class', 'point').attr('r', 10)
  .call(drag);

var x = function (d) { return d[0]; };
var y = function (d) { return d[1]; };
var line = d3.svg.line();
var shape = function (d) { return line(d) + "Z"; };

function cov(x, y) {
  var xm = d3.mean(x);
  var ym = d3.mean(y);
  return d3.sum(d3.range(x.length).map(function (i) {
    return (x[i] - xm) * (y[i] - ym);
  }));
}

var $cursor = d3.select('#cursor');

function dimOf(input) {
  // use first singular value set as 2d point
  // pretty sure this is equivalent to PCA -> 2 dimensions
  return numeric.svd(pointsOf(input)).S;
}

var ps = []
for (var f in simba) {
  var inp = simba[f];

  ps.push({
    image: f,
    dim: dimOf(inp)
  });
}

var xscale = d3.scale.linear()
  .domain(d3.extent(ps, function (it) { return it.dim[0] }))
  .range([50, 450]);
var yscale = d3.scale.linear()
  .domain(d3.extent(ps, function (it) { return it.dim[1] }))
  .range([450, 50]);

var tri = d3.geom.delaunay(ps.map(function (it) { return [xscale(it.dim[0]), yscale(it.dim[1])] }))
  .map(function(d) { return "M" + d.join("L") + "Z"; });
var s =d3.select('#space').selectAll('.tri').data(tri)
s.enter().append('path').attr('class', 'tri')
s.attr('d', String);

var s =d3.select('#space').selectAll('.image').data(ps)
s.exit().remove();
s.enter().append('image')
  .attr('class', 'image')
  .attr('width', 50)
  .attr('height', 50)
  .attr('xlink:href', function (it) { return 'templates/simba/' + it.image + '.png'; })
s.attr('x', function (it) { return xscale(it.dim[0]) - 25})
s.attr('y', function (it) { return yscale(it.dim[1]) - 25})
// initial draw
draw();
function draw() {
  $lines.attr('d', line);
  $shapes.attr('d', shape);
  $points.attr('cx', x).attr('cy', y);
}

// convenience for image with source
// String -> Image
function image(src) {
  var img = new Image();
  img.src = src;
  return img;
}

document.getElementById('save').addEventListener('click', function () {
  prompt('', JSON.stringify(input));
});

var inimg = document.getElementById('inimg');

function bind() {
  if (inimg.files.length === 0) {
    d3.select('#sinimg').attr('xlink:href', null);
  } else {
    var url = window.URL.createObjectURL(inimg.files[0]);
    d3.select('#sinimg').attr('xlink:href', url);
  }
}

inimg.addEventListener('change', bind);

// when page is loaded, the inimg element should
// retain its selection, so also try to bind right now.
bind();

document.getElementById('reset').addEventListener('click', function () {
  setTimeout(bind, 100);
});
