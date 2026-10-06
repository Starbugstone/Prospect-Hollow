// A still board draws identical frames. Once tweens, particles, sprite animations and
// camera shakes have all stopped, the game loop sleeps; input, new motion or any
// redraw wakes it again. Moves still render at the display's full refresh rate.
const IDLE_FRAMES = 20;

export function createBoardLoop(game, { busy, idleFrames = IDLE_FRAMES }) {
  const loop = game.loop;
  let quiet = 0,
    held = false,
    disposed = false;
  const wake = () => {
    quiet = 0;
    if (held || disposed || loop.running) return;
    // The board did not move while asleep; start timing from now.
    loop.resetDelta();
    loop.wake();
  };
  const step = () => {
    if (busy()) quiet = 0;
    else if (++quiet >= idleFrames && !held) loop.sleep();
  };
  game.events.on('poststep', step);
  return {
    wake,
    // The opaque results screen covers the board: keep it asleep until it closes.
    hold(value) {
      held = value;
      if (held) loop.sleep();
      else wake();
    },
    dispose() {
      disposed = true;
      game.events.off('poststep', step);
    },
  };
}
