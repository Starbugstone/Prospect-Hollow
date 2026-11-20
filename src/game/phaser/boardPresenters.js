import { BoardAnimator } from './BoardAnimator';
import { BoardInput } from './BoardInput';

// What draws and steers a board. The board's own chunk hands these to the game store with
// its renderer (`attachRenderer`), so the store, which loads at startup, never imports the
// board's animation code. `testing/board-chunk.test.js` holds that boundary.
export const BOARD_PRESENTERS = Object.freeze({ Animator: BoardAnimator, Input: BoardInput });
