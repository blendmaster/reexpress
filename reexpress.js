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
  - Control points for all templates

Model is kept in simple javascript global state, and mutated
by the view bindings (d3 and `input` events)
*/

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

