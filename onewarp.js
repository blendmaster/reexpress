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

var input = document.getElementById('file');

var image =  new Image;

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
var WIDTH = 500, HEIGHT = 500;
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
  [[[200, 250], [300, 250]]],
  [[[200, 250], [300, 250]]],
];

function correlate(ours, t1) {
  return function () {
    // update other two controls with new control points
    while (t1.length > ours.length) t1.pop();
    ours.forEach(function (path, i) {
      var p1 = t1[i];
      if (p1 != null) {
        while (p1.length > path.length) p1.pop();
        path.forEach(function (p, j) {
          if (p1[j] == null) { p1[j] = [p[0], p[1]]; }
        });
      } else {
        // copy value
        t1[i] = path.map(function (p) { return [p[0], p[1]]});
      }
    });
    debounced();
  }
}

var b1 =
  bindEditor(controls[0], '#p0', correlate(controls[0], controls[1]));
var b2 =
  bindEditor(controls[1], '#input', correlate(controls[1], controls[0]));

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

  var aa = parseFloat(document.getElementById('a').value);
  var bb = parseFloat(document.getElementById('b').value);
  var pp = parseFloat(document.getElementById('p').value);

  var sourceControl = controls[0];
  var pairedLines = toPairedLines(controls[1], sourceControl);
  var out = otx;

  // since the actual image is unscaled, draw the image to
  // be sampled onto a canvas with correct scaling
  btx.drawImage(image, 0, 0, WIDTH, HEIGHT);

  d3.selectAll('.control').style('visibility', showLines.checked ? null : 'hidden');

  // XXX sample points, because sampling every point is kinda slow
  // TODO move this off main thread (worker), or use webGL with
  // texture sampling.
  out.clearRect(0, 0, 500, 500);
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

function bindInput() {
  if (input.files.length === 0) return;

  var url = window.URL.createObjectURL(input.files[0]);
  image.src = url;

  d3.select('#simg').attr('xlink:href', url);

  image.onload = function () {
    window.URL.revokeObjectURL(image.src); // don't need it anymore
    debounced();
  };
}

input.addEventListener('change', bindInput);

// when page is loaded, the input element should
// retain its selection, so also try to bind right now.
bindInput();
draw();

function dist(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}
