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
      // "nostrils": [
      //   [170, 325.00001525878906],
      //   [261, 327.00001525878906]
      // ],
      // "leftCheek": [
      //   [133, 355],
      //   [106, 437]
      // ],
      // "rightCheek": [
      //   [285, 355],
      //   [305, 443]
      // ],
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
      // "teeth": [
      //   [174, 391],
      //   [243, 389]
      // ]
    }
  };

input = simba[Object.keys(simba)[0]];

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
var lines = getLines(input)
function getLines(input) {
  return [
    input.eyes.left.brow,
    input.eyes.right.brow,
    input.eyes.left.lid,
    input.eyes.right.lid,
  ];
}

// drawn as closed shapes
var shapes = getShapes(input);
function getShapes(input) {
  return [
    input.eyes.left.eye,
    input.eyes.right.eye,
    input.mouth.outerLips,
    input.mouth.innerLips,
  ];
}

// all points, for moving (flap mapped)
var points = [].concat.apply([], lines.concat(shapes));

function pointsOf(input) {
  return [].concat(
    input.eyes.left.brow,
    input.eyes.right.brow,
    input.eyes.left.lid,
    input.eyes.right.lid,
    // input.mouth.nostrils
    // XXX ignore for now
    //input.mouth.leftCheek,
    //input.mouth.rightCheek,
    //input.mouth.teeth
    input.eyes.left.eye,
    input.eyes.right.eye,
    input.mouth.outerLips,
    input.mouth.innerLips
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
    // reseat cursor
    var pos = dimOf(input);
    $cursor.attr('cx', xscale(pos[0])).attr('cy', yscale(pos[1]));

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
    cimage: image('templates/simba/' + f + '.png'),
    control: inp,
    dim: dimOf(inp)
  });
}

var xscale = d3.scale.linear()
  .domain(d3.extent(ps, function (it) { return it.dim[0] }))
  .range([50, 450]);
var yscale = d3.scale.linear()
  .domain(d3.extent(ps, function (it) { return it.dim[1] }))
  .range([450, 50]);

var tri = d3.geom.delaunay(ps.map(function (it) { return it.dim }))
var s =d3.select('#tri').selectAll('.tri').data(
    tri.map(function(d) { return "M" + d.map(function (it) { return [xscale(it[0]), yscale(it[1])] }).join("L") + "Z"; }))
s.enter().append('path').attr('class', 'tri')
s.attr('d', String);

var s =d3.select('#space-img').selectAll('.image').data(ps)
s.exit().remove();
s.enter().append('image')
  .attr('class', 'image')
  .attr('width', 50)
  .attr('height', 50)
  .attr('xlink:href', function (it) { return 'templates/simba/' + it.image + '.png'; })
s.attr('x', function (it) { return xscale(it.dim[0]) - 25})
s.attr('y', function (it) { return yscale(it.dim[1]) - 25})

function dist(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}
// ((x1, y1), (x2, y2), (x3, y3)) -> (x, y) -> (u, v, w)
// w is technically redundant, since u + v + w = 1
// https://en.wikipedia.org/wiki/Barycentric_coordinate_system#Converting_to_barycentric_coordinates
function barycentric(t, cursor) {
  var x = cursor[0], y = cursor[1]
    , x1 = t[0][0], y1 = t[0][1]
    , x2 = t[1][0], y2 = t[1][1]
    , x3 = t[2][0], y3 = t[2][1]
    , det = ((y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3))
    , u, v;

  return [
    u = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det,
    v = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det,
    1 - u - v
  ];
}

function close(a, b) {
  return Math.abs(a - b) < 0.0001;
}

var $cursor = d3.select('#cursor');

var pos = dimOf(input);
$cursor.attr('cx', xscale(pos[0])).attr('cy', yscale(pos[1]));

var closest, weights;

d3.select('#space').on('click', function () {
  var pos = d3.mouse(this);
  var x = xscale.invert(pos[0])
    , y = yscale.invert(pos[1]);

  var p = [x, y];

  // find containing triangle
  var t = tri.filter(function (tr) {
    var w = barycentric(tr, p);
    return w[0] > 0 && w[0] < 1
        && w[1] > 0 && w[1] < 1
        && w[2] > 0 && w[2] < 1;
  });

  // find corresponding points, which
  // d3 doesn't make easy.
  if (t[0] != null) {
    closest = t[0].map(function (coord) {
      for (var i = 0, len = ps.length; i < len; ++i) {
        if (close(coord[0], ps[i].dim[0])
         && close(coord[1], ps[i].dim[1])) {
           return ps[i];
         }
      }
    });

    // okay, mutate input to match linear combination
    // of three closest, weight by barycentric
    weights = barycentric(t[0], p);

    var avgp = averagePoints(
        pointsOf(closest[0].control),
        pointsOf(closest[1].control),
        pointsOf(closest[2].control),
        weights);

    // map back onto input
    avgp.forEach(function (av, i) {
      // points is by reference, so we can mutate
      points[i][0] = av[0];
      points[i][1] = av[1];
    });

    $cursor.attr('cx', pos[0]).attr('cy', pos[1]);

    draw();
  }
})

function averagePoints(a, b, c, w) {
  return a.map(function (aa, i) {
    return [
      w[0] * aa[0] + w[1] * b[i][0] + w[2] * c[i][0],
      w[0] * aa[1] + w[1] * b[i][1] + w[2] * c[i][1],
    ];
  });
}

var WIDTH = 500, HEIGHT = 500;
var buf = document.createElement('canvas')
buf.width = WIDTH;
buf.height = HEIGHT;
var btx = buf.getContext('2d')
var outputs = [
  document.createElement('canvas'),
  document.createElement('canvas'),
  document.createElement('canvas'),
];
outputs.forEach(function (o) {
  o.width = WIDTH;
  o.height = HEIGHT;
});

var otx = document.getElementById('output').getContext('2d')

function pairpoints(s, d, closed) {
  var ret = [];
  for (var j = 0, len = s.length - 1; j < len; ++j) {
      var s1 = s[j], s2 = s[j + 1]
        , d1 = d[j], d2 = d[j + 1];

      ret.push([[s1, s2], [d1, d2]]);
  }
  if (closed) {
      s1 = s[len], s2 = s[0]
      , d1 = d[len], d2 = d[0];

      ret.push([[s1, s2], [d1, d2]]);
  }
  return ret;
}

// transform control paths to list of 2-tuples of lines,
// paired by source (1) and dest (2)
function toPairedLines(s, d) {
  return [].concat.apply([], [
    pairpoints(s.eyes.left.brow,  d.eyes.left.brow, false),
    pairpoints(s.eyes.left.lid,   d.eyes.left.lid, false),
    pairpoints(s.eyes.left.eye,   d.eyes.left.eye, true),

    pairpoints(s.eyes.right.brow, d.eyes.right.brow, false),
    pairpoints(s.eyes.right.lid,  d.eyes.right.lid, false),
    pairpoints(s.eyes.right.eye,  d.eyes.right.eye, true),

    pairpoints(s.mouth.outerLips, d.mouth.outerLips, true),
    pairpoints(s.mouth.innerLips, d.mouth.innerLips, true)
  ]);
}

// initial draw
['a', 'b', 'p'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', dragdraw);
})
draw();
function draw() {
  $lines.attr('d', line);
  $shapes.attr('d', shape);
  $points.attr('cx', x).attr('cy', y);

  var aa = parseFloat(document.getElementById('a').value);
  var bb = parseFloat(document.getElementById('b').value);
  var pp = parseFloat(document.getElementById('p').value);

  if (closest != null) {
    // warp
    for (var p = 0; p < 3; ++p) {
      var sourceControl = closest[p].control;
      var pairedLines = toPairedLines(input, sourceControl);
      var out = outputs[p].getContext('2d');

      // since the actual image is unscaled, draw the image to
      // be sampled onto a canvas with correct scaling
      btx.drawImage(closest[p].cimage, 0, 0, WIDTH, HEIGHT);

      // XXX sample points, because sampling every point is kinda slow
      // TODO move this off main thread (worker), or use webGL with
      // texture sampling.
      out.clearRect(0, 0, WIDTH, HEIGHT);
      var SAMPLE = 4;
      for (var i = 0; i < WIDTH; i += SAMPLE) {
        for (var j = 0; j < HEIGHT; j += SAMPLE) {
          var src = warp(pairedLines, [i, j], pp /* p */, aa/*a*/, bb/*b*/);
          // draw source pixel to destination pixel
          if (src[0] >= 0 && src[0] < WIDTH
           && src[1] >= 0 && src[1] < HEIGHT) {
            out.drawImage(buf, src[0], src[1], SAMPLE, SAMPLE, i, j, SAMPLE, SAMPLE);
          }
        }
      }
    }

    // now draw output, with barycentric points as weight
    otx.clearRect(0, 0, WIDTH, HEIGHT);
    otx.globalAlpha = weights[0];
    otx.drawImage(outputs[0], 0, 0, WIDTH, HEIGHT);
    otx.globalAlpha = weights[1];
    otx.drawImage(outputs[1], 0, 0, WIDTH, HEIGHT);
    otx.globalAlpha = weights[2];
    otx.drawImage(outputs[2], 0, 0, WIDTH, HEIGHT);
  }
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

document.getElementById('show').addEventListener('click', function () {
  d3.select('#input').style('opacity',
    this.checked ? null : 0);
})

d3.select('#input').style('opacity',
  document.getElementById('show').checked ? null : 0);

