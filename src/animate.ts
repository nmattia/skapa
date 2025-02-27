import * as THREE from "three";

const ANIM_DURATION = 0.5; // in seconds

type Animation = {
  clock: THREE.Clock; // clock started at the beginning of the animation
  start: number; // dimension at anim start
  target: number; // dimension target
  easingFunction: EasingFunction; // The easing function
};

// Easing functions adapted from Robert Penner's easing equations
// http://robertpenner.com/scripts/easing_equations.txt
// t: current time, b: beginning value, c: change in value, d: duration
//
// NOTE: we always set b = 0 and c = 1 when calling the functions, though we still
// use b & c in the implementation to keep them in line with Penner's definitions.
type EasingFunction = (t: number, b: number, c: number, d: number) => number;

export const easeInOutCubic: EasingFunction = (t, b, c, d) => {
  if ((t /= d / 2) < 1) return (c / 2) * t * t * t + b;
  return (c / 2) * ((t -= 2) * t * t + 2) + b;
};

// cubic easing out - decelerating to zero velocity
export const easeOutCubic: EasingFunction = (t, b, c, d) => {
  return c * ((t = t / d - 1) * t * t + 1) + b;
};

// Immediatly reach the target (no easing)
export const immediate: EasingFunction = (_t, b, c, _d) => {
  return b + c;
};

// Objects that can be tweened
export class Animate {
  // The current value, possibly being interpolated
  public current: number;

  // An animation object, if an animation is underway
  private animation?: Animation;

  public constructor(initial: number) {
    this.current = initial;
  }

  // Starts an animation (or updates an existing animation) to the target.
  // When passing a function, the result used for the new target is computed
  // by applying the function to 'current'.
  public startAnimationTo(
    target: number,
    easingFunction: EasingFunction = easeInOutCubic,
  ) {
    // If we're already at the target, nothing to do
    if (this.current === target) {
      return;
    }

    // If there's already an animation with the same target, nothing to do
    if (this.animation !== undefined && this.animation.target === target) {
      return;
    }

    // Start a new animation (possibly replacing an outdated one)
    const clock = new THREE.Clock();
    clock.start();
    this.animation = {
      clock,
      start: this.current,
      target: target,
      easingFunction,
    };
  }

  // Returns true if the value was updated
  public update(): boolean {
    if (this.animation === undefined) {
      return false;
    }

    // Update values depending on how much time has elapsed
    const elapsed = this.animation.clock.getElapsedTime();
    if (elapsed < ANIM_DURATION) {
      // Animation is still running
      const ratio = this.animation.easingFunction(elapsed, 0, 1, ANIM_DURATION);
      const totalDelta = (this.animation.target - this.animation.start) * ratio;
      this.current = this.animation.start + totalDelta;
    } else {
      // Animation is over
      this.current = this.animation.target;
      this.animation = undefined;
    }

    return true;
  }
}
