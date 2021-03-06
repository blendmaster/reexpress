// Beier-Neely polymorphing
// Authors: Steven Ruppert and Daria Tolmacheva
// For Final Project, CSCI 561 Advanced Graphics, Spring 2014,
// at the Colorado School of Mines
//
// Based on the techniques described in
// "Performance-Driven Hand-Drawn Animation"
// http://gfx.cs.princeton.edu/gfx/pubs/Buck_2000_PHA/index.php
//
// Specifically, "Polymorph: Morphing Among Multiple Images",
// http://cg.postech.ac.kr/research/papers/morphing_among_multiple_images/cgna98.pdf
"use strict";

var otx = document.getElementById('output').getContext('2d');

var points = [
  [25, 25],
  [225, 25],
  [125, 225],
];

var cursor = [125, 100];

var inputs = [
  document.getElementById('i1'),
  document.getElementById('i2'),
  document.getElementById('i3'),
];

var images = [
  new Image,
  new Image,
  new Image,
];

var outputs = [
  document.getElementById('o1'),
  document.getElementById('o2'),
  document.getElementById('o3'),
]

var $triangle = d3.select('#triangle')
  , $cursor = d3.select('#cursor')
  , $images = d3.selectAll('#input > .image');

$images.data(points)
  .attr('x', function (d) { return d[0] - 25; })
  .attr('y', function (d) { return d[1] - 25; })
  .attr('width', 50)
  .attr('height', 50);

$triangle.attr('d', d3.svg.line()(points) + 'Z');

// for each image, we want to edit control lines on
// top of them for parameterizing the warp.
// goals:
// - drag points to edit
// - show correspondence to other points
// - show lines between points (open)
// - edit control lines
//  - but this is complicated, how to split them?
//  - could do individual lines (not multipoint path)
//    - drag for new line
//    - click one line for new point
//    - click on point to delete
//      - if only two points, delete line
//
// Point :: (Double, Double)
// Path :: [Point]
// [Path] -> String -> callback -> ()
// Binds dragging/adding/deleting lines on svg element
// to the `lines` reference. Calls `callback` when stuff
// changes.
//
// This is only a one-way binding (DOM -> JS).
var WIDTH = 250, HEIGHT = 250;
var line = d3.svg.line();
function bindEditor(paths, svgId, callback) {
  var svg = d3.select(svgId);

  var dragging = false; // whether a new line is being added;
  var start, end; // points for new line to add;

  var pending = svg.append('path')
    .attr('class', 'pending')
    .style('display', 'none');

  // bind add line behavior
  svg.call(d3.behavior.drag()
    .on('drag', function () {
      var pos = d3.mouse(svg[0][0]);
      if (start == null) {
        start = pos;
      } else {
        end = pos;
        pending.style('display', null);
        drawPending();
      }
    })
    .on('dragstart', function () {
      start = end = void 0;
    })
    .on('dragend', function () {
      // if start/end line is long enough, add to paths array
      if (start != null && end != null
          && dist(start, end) > 10) {

        paths.push([start, end]);
        bind();
        callback();
      }
      pending.style('display', 'none');
    }));

  function drawPending() {
    if (start == null || end == null) return;
    pending.attr('d', line([start, end]));
  }

  function bind() {
    var s = svg.selectAll('.control').data(paths);
    s.exit().remove();
    s.enter().append('g')
      .attr('class', 'control')
      .append('path').attr('class', function (_, i) {
        return 'path path-' + i; // for correlation
      })
      .on('click', function (d) { // add point to line
        var pos = d3.mouse(svg[0][0]);
        // find where we are in line

        for (var i = 0, len = d.length - 1; i < len; ++i) {
          var p1 = d[i];
          var p2 = d[i+1];

          var p1a = Math.atan2(pos[1] - p1[1], pos[0] - p1[0]);
          var p2a = Math.atan2(pos[1] - p2[1], pos[0] - p2[0]);
          if (p1a < 0) p1a += Math.PI * 2;
          if (p2a < 0) p2a += Math.PI * 2;
          if (p1a > p2a) p1a -= Math.PI; else p2a -= Math.PI;

          if (Math.abs(p2a - p1a) < 0.5) {
            // pos is on p1/p2 line
            d.splice(i + 1, 0, pos);

            bind();
            callback();
            return;
          }
        }
      })
    s.select('path').attr('d', line);

    var p = s.selectAll('.point').data(function (d) { return d });
    p.exit().remove();
    p.enter().append('circle')
      // parallel hover
      .on('mouseenter', function (_, i, j) {
        d3.selectAll('.p-' + i + '-' + j)
          .classed('hover', true)
      })
      .on('mouseleave', function (_, i, j) {
        d3.selectAll('.p-' + i + '-' + j)
          .classed('hover', false)
      })
      .attr('r', 15)
      .call(pointDrag);

    p.attr('class', function (_, i, j) {
      return 'point p-' + i + '-' + j;
    })
    p.attr('cx', function (d) { return d[0] });
    p.attr('cy', function (d) { return d[1] });
  }

  var pointDrag = d3.behavior.drag()
    .origin(function (d) {
      return {x: d[0], y: d[1]};
    })
    .on('dragstart', function () {
      d3.event.sourceEvent.stopPropagation();
    })
    .on('dragend', function (d, i, j) {
      // if point is outside image, remove it
      if (d[0] < 0 || d[0] > WIDTH || d[1] < 0 || d[1] > HEIGHT) {
        var path = paths[j];
        path.splice(i, 1);

        // if path doesn't have 2 points, remove
        if (path.length < 2) {
          paths.splice(j, 1);
        }
        bind();
        callback();
      }
    })
    .on('drag', function (d, i, j) { // move point
      d[0] = d3.event.x;
      d[1] = d3.event.y;
      bind();
      callback();
    })

  return bind;
}

var controls = [
  [[[80, 125], [160, 125]]],
  [[[80, 125], [160, 125]]],
  [[[80, 125], [160, 125]]],
];

function correlate(ours, t1, t2) {
  return function () {
    // update other two controls with new control points
    while (t1.length > ours.length) t1.pop();
    while (t2.length > ours.length) t2.pop();
    ours.forEach(function (path, i) {
      var p1 = t1[i], p2 = t2[i];
      if (p1 != null) {
        while (p1.length > path.length) p1.pop();
        path.forEach(function (p, j) {
          if (p1[j] == null) { p1[j] = [p[0], p[1]]; }
        });
      } else {
        // copy value
        t1[i] = path.map(function (p) { return [p[0], p[1]]});
      }
      if (p2 != null) {
        while (p2.length > path.length) p2.pop();
        path.forEach(function (p, j) {
          if (p2[j] == null) { p2[j] = [p[0], p[1]]; }
        });
      } else {
        // copy value
        t2[i] = path.map(function (p) { return [p[0], p[1]]});
      }
    });
    debounced();
  }
}

var b1 =
  bindEditor(controls[0], '#p0', correlate(controls[0], controls[1], controls[2]));
var b2 =
  bindEditor(controls[1], '#p1', correlate(controls[1], controls[0], controls[2]));
var b3 =
  bindEditor(controls[2], '#p2', correlate(controls[2], controls[0], controls[1]));

function drawAverage(svg, average) {
  var d = d3.select(svg).select('.avg').selectAll('.apath').data(average)
  d.exit().remove();
  d.enter().append('path').attr('class', 'apath');
  d.attr('d', line);
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

// transform control paths to list of 2-tuples of lines,
// paired by source (1) and dest (2)
function toPairedLines(sourceControl, destControl) {
  var ret = [];
  sourceControl.forEach(function (s, i) {
    var d = destControl[i];
    for (var j = 0, len = s.length - 1; j < len; ++j) {
      var s1 = s[j], s2 = s[j + 1]
        , d1 = d[j], d2 = d[j + 1];

      ret.push([[s1, s2], [d1, d2]]);
    }
  });
  return ret;
}

var buf = document.createElement('canvas')
buf.width = WIDTH;
buf.height = HEIGHT;
var btx = buf.getContext('2d')

function averageControl(controls, weights) {
  var ret = [];
  controls[0].forEach(function (c1, i) {
    var c2 = controls[1][i];
    var c3 = controls[2][i];

    var ps = []
    for (var j = 0, len = c1.length; j < len; ++j) {
      var p1 = c1[j]; var p2 = c2[j]; var p3 = c3[j];
      ps.push([
        p1[0] * weights[0] + p2[0] * weights[1] + p3[0] * weights[2],
        p1[1] * weights[0] + p2[1] * weights[1] + p3[1] * weights[2]
      ]);
    }
    ret.push(ps);
  });
  return ret;
}


var debounced = debounce(100, draw);
['a', 'b', 'p'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', debounced);
})
var showLines = document.getElementById('show-lines')
showLines.addEventListener('click', debounced);
function draw() {
  // redraw input bindings
  b1();
  b2();
  b3();

  var aa = parseFloat(document.getElementById('a').value);
  var bb = parseFloat(document.getElementById('b').value);
  var pp = parseFloat(document.getElementById('p').value);

  // calculate barycentric coordinates of cursor
  var bary = barycentric(points, cursor);

  // calculate average of control points.
  var destControl = averageControl(controls, bary);

  drawAverage('#p0', destControl);
  drawAverage('#p1', destControl);
  drawAverage('#p2', destControl);

  for (var p = 0; p < 3; ++p) {
    var sourceControl = controls[p];
    var pairedLines = toPairedLines(destControl, sourceControl);
    var out = outputs[p].getContext('2d');

    // since the actual image is unscaled, draw the image to
    // be sampled onto a canvas with correct scaling
    btx.drawImage(images[p], 0, 0, WIDTH, HEIGHT);

    if (showLines.checked) {
      btx.strokeStyle = 'green';
      btx.lineWidth = 5;
      for (var i = 0, len = sourceControl.length; i < len; ++i) {
        var path = sourceControl[i];
        btx.beginPath();
        btx.moveTo(path[0][0], path[0][1]);
        for (var j = 1, len2 = path.length; j < len2; ++j) {
          btx.lineTo(path[j][0], path[j][1]);
        }
        btx.stroke();
      }
    }

    // XXX sample points, because sampling every point is kinda slow
    // TODO move this off main thread (worker), or use webGL with
    // texture sampling.
    out.clearRect(0, 0, 250, 250);
    for (var i = 0; i < WIDTH; i += 2) {
      for (var j = 0; j < HEIGHT; j += 2) {
        var src = warp(pairedLines, [i, j], pp, aa, bb);
        // draw source pixel to destination pixel
        //
        if (src[0] >= 0 && src[0] < WIDTH
         && src[1] >= 0 && src[1] < HEIGHT) {

          out.drawImage(buf, src[0], src[1], 2, 2, i, j, 2, 2);
        }
      }
    }
  }

  // now draw output, with barycentric points as weight
  otx.clearRect(0, 0, 250, 250);
  otx.globalAlpha = bary[0];
  otx.drawImage(outputs[0], 0, 0, 250, 250);
  otx.globalAlpha = bary[1];
  otx.drawImage(outputs[1], 0, 0, 250, 250);
  otx.globalAlpha = bary[2];
  otx.drawImage(outputs[2], 0, 0, 250, 250);
}

inputs.forEach(function (input, i) {
  function bind() {
    if (input.files.length === 0) return;

    var url = window.URL.createObjectURL(input.files[0]);
    var img = images[i];
    img.src = url;

    d3.select('#si' + i).attr('xlink:href', url);
    d3.select('#pi' + i).attr('xlink:href', url);

    img.onload = function () {
      window.URL.revokeObjectURL(img.src); // don't need it anymore
      debounced();
    };
  }

  input.addEventListener('change', bind);

  // when page is loaded, the input element should
  // retain its selection, so also try to bind right now.
  bind();
});

var drag = d3.behavior.drag()
  .origin(function () {
    return {x: cursor[0], y: cursor[1]};
  })
  .on('drag', function () {
    cursor[0] = d3.event.x;
    cursor[1] = d3.event.y;
    $cursor.attr('cx', cursor[0]).attr('cy', cursor[1]);
    debounced();
  });

$cursor.call(drag);

$cursor.attr('cx', cursor[0]).attr('cy', cursor[1]);

d3.select('#input').on('click', function () {
  var c = d3.mouse(this);
  console.log(c);
  cursor[0] = c[0];
  cursor[1] = c[1];
  $cursor.attr('cx', cursor[0]).attr('cy', cursor[1]);
  debounced();
});

draw();

function dist(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}
