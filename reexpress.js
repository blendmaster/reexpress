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
      left: {
        brow: [
          [10, 10],
          [20, 10],
          [30, 10],
        ],
        lid: [
          [10, 20],
          [20, 20],
          [30, 20],
        ],
        eye: [
          [10, 30],
          [20, 30],
          [30, 30],
          [30, 40],
          [20, 40],
          [10, 40],
        ],
      },
      right: {
        brow: [
          [50, 10],
          [60, 10],
          [70, 10],
        ],
        lid: [
          [50, 20],
          [60, 20],
          [70, 20],
        ],
        eye: [
          [50, 30],
          [60, 30],
          [70, 30],
          [70, 40],
          [60, 40],
          [50, 40],
        ],
      }
    },
    mouth: {
      nostrils: [
        [30, 50],
        [50, 50],
      ],
      leftCheek: [
        [20, 70],
        [20, 90],
      ],
      rightCheek: [
        [60, 70],
        [60, 90],
      ],
      outerLips: [
        [35, 80],
        [40, 70],
        [45, 70],
        [50, 80],
        [45, 90],
        [40, 90],
      ],
      innerLips: [
        [36, 80],
        [40, 75],
        [45, 75],
        [49, 80],
        [45, 85],
        [40, 85],
      ],
      teeth: [
        [40, 75],
        [45, 75],
      ]
    }
  },
  // TODO for other templates, parameterize this
  // by a folder id or something, and load points from JSON,
  // instead of writing this out manually.
  templates = {
    face: {
      image: image("templates/face.png"),
      points: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]
    },
    eyes: [
      {
        image: image("templates/eye1.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/eye2.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/eye3.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/eye4.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
    ],
    lips: [
      {
        image: image("templates/lips1.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/lips2.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/lips3.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
      {
        image: image("models/lips4.png"),
        points: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]
      },
    ]
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
  input.mouth.nostrils,
  input.mouth.leftCheek,
  input.mouth.rightCheek,
  input.mouth.teeth,
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

// XXX scale points
points.forEach(function (p) {
  p[0] = p[0] * 5;
  p[1] = p[1] * 5;
});

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
