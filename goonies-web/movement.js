/* Direct native translation of the original $0B5A-$0E66 movement rules.
 * Coordinates are Atari color pixels (x) and bitmap scanlines (y).
 * This module contains game rules, not an instruction or hardware emulator.
 */
(function (root) {
  'use strict';
  function step(actor, input, rectangles, widths, heights, contacts = Array(8).fill(0)) {
    const hit = Array(8).fill(false), oldVy = actor.vy;
    let width = widths[actor.frame & 127], height = heights[actor.frame & 127];
    let x = (actor.x + actor.vx) & 255, y = (actor.y + actor.vy) & 255;
    const right = (x + width) & 255, bottom = (y + height) & 255;
    for (let i = 0; i < rectangles.length; i++) {
      const r = rectangles[i];
      if (r.type < 8 && right >= r.x1 && r.x2 >= x && bottom >= r.y1 && r.y2 >= y) {
        hit[r.type] = true; contacts[r.type] = i;
      }
    }
    const falling = actor.vy > 0, rising = actor.vy < 0;
    const goingRight = actor.vx > 0, goingLeft = actor.vx < 0;
    const left = !!input.left, rightKey = !!input.right, up = !!input.up, down = !!input.down;
    let leftAllowed = false, rightAllowed = false, jumpAllowed = false, gravity = true, grounded = false;
    const rect = type => rectangles[contacts[type]];
    if (hit[5] && (up || ((!hit[3] || hit[4]) && down))) actor.climb = 255;
    if (hit[4] && down) actor.direction = 255;
    if (hit[0] && goingLeft) { x = rect(0).x1; actor.vx = 0; }
    if (hit[1] && goingRight) { x = (rect(1).x1 - width - 1) & 255; actor.vx = 0; }
    if (!actor.moving) {
      let center = -1;
      if (actor.climb && hit[5]) center = 5;
      if (hit[4] && actor.direction) center = 4;
      if (center !== -1) { x = (rect(center).x1 - (width >> 1)) & 255; actor.vx = 0; }
    }
    if ((hit[2] && rising) || hit[7]) {
      const ceiling = hit[7] ? 7 : 2;
      if (hit[7]) { leftAllowed = rightAllowed = true; if (!down) gravity = false; }
      y = rect(ceiling).y1; actor.vy = 0;
      if (ceiling === 7 && !left && !rightKey) actor.vx = 0;
    }
    let floor = -1;
    if (!actor.direction && hit[3] && falling) floor = 3;
    if (!actor.direction && hit[4] && falling) floor = 4;
    if (floor !== -1) {
      y = (rect(floor).y1 - height) & 255; actor.vy = 0;
      leftAllowed = rightAllowed = jumpAllowed = grounded = true;
      if (!left && !rightKey) actor.vx = 0;
    }
    actor.moving = 0;
    if (!hit[5]) actor.climb = 0;
    if (!hit[4]) actor.direction = 0;
    if (actor.climb) { gravity = false; if (!up && !down) actor.vy = 0; }
    if (leftAllowed && left) { actor.moving = 255; actor.vx = -2; }
    if (rightAllowed && rightKey) { actor.moving = 255; actor.vx = 2; }
    if (jumpAllowed && up && !input.jumpDisabled) actor.vy = -5;
    if (actor.climb && up) actor.vy = -2;
    if (actor.climb && down) actor.vy = 2;
    if (gravity) actor.vy = Math.min(4, actor.vy + 1);
    let bounce = 1 - oldVy;
    if (bounce < 0 && hit[6] && falling) {
      if (jumpAllowed && up) actor.vy = (bounce >> 1) - 7;
      else { if (down) bounce >>= 1; actor.vy = bounce; }
    }
    actor.x = x; actor.y = y;
    let pose;
    if (hit[7]) pose = (x & 2) ? 7 : 5;
    else if (actor.climb) pose = (y & 4) ? 5 : 4;
    else if (actor.vx > 0) pose = (x & 2) ? 2 : 0;
    else if (actor.vx < 0) pose = (x & 2) ? 3 : 1;
    else pose = 6;
    actor.frame = actor.baseFrame + pose;
    return { grounded, rail: hit[7], contacts, hit, leftAllowed, rightAllowed };
  }
  root.GooniesMovement = { step };
})(globalThis);
