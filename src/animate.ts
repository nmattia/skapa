import * as THREE from "three";

const ANIM_DURATION = 0.3; // in seconds

type Animation = {
  clock: THREE.Clock; // clock started at the beginning of the animation
  start: number; // dimension at anim start
  target: number; // dimension target
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
  public startAnimationTo(arg: number | ((current: number) => number)) {
    const target = typeof arg === "number" ? arg : arg(this.current);

    // If we're already at the target, nothing to do
    if (this.current === target) {
      return;
    }

    // If there's already an animation with the same target, nothing to do
    if (this.animation !== undefined && this.animation.target === target) {
      return;
    }

    // Start a new animation (possibly replacing an outdated one)
    this.animation = {
      clock: new THREE.Clock(),
      start: this.current,
      target: target,
    };
  }

  // Returns true if the value was updated
  public update(): boolean {
    if (this.animation === undefined) {
      return false;
    }

    const ratio = this.animation.clock.getElapsedTime() / ANIM_DURATION;
    const totalDelta = (this.animation.target - this.animation.start) * ratio;

    let newVal = this.animation.start + totalDelta;

    // Here we can to the target
    if (ratio >= 1) {
      newVal = this.animation.target;
      this.animation = undefined;
    }

    this.current = newVal;
    return true;
  }
}
