import { BOARD_BONUSES, isAdjacent } from '../engine/TileRules';
import { isPlayableCell } from '../engine/BoardTopology';
export class BoardInput {
  constructor({ scene, boardContainer, gameStore }) {
    Object.assign(this, { scene, boardContainer, gameStore });
    this.layout = { boardCols: 0, boardRows: 0, cellSize: 0 };
    this.selectedCell = null;
    this.lastTap = null;
    this.startCell = null;
    this.focusIndex = 0;
    this.activePointer = null;
    scene?.input?.on?.('pointerdown', this.handlePointerDown, this);
    scene?.input?.on?.('pointermove', this.handlePointerMove, this);
    scene?.input?.on?.('pointerup', this.handlePointerUp, this);
    scene?.input?.on?.('pointerupoutside', this.reset, this);
    scene?.input?.on?.('gameout', this.handleOut, this);
  }
  get enabled() {
    return (
      this.gameStore.sessionActive && !this.gameStore.levelCleared && !this.gameStore.inputPaused
    );
  }
  destroy() {
    for (const [name, handler] of [
      ['pointerdown', this.handlePointerDown],
      ['pointermove', this.handlePointerMove],
      ['pointerup', this.handlePointerUp],
      ['pointerupoutside', this.reset],
      ['gameout', this.handleOut],
    ])
      this.scene?.input?.off?.(name, handler, this);
    this.reset();
  }
  setLayout(layout) {
    this.layout = layout;
    this.focusIndex = Math.min(
      this.focusIndex,
      Math.max(0, layout.boardCols * layout.boardRows - 1),
    );
    if (!isPlayableCell(this.gameStore.tiles?.[this.focusIndex]))
      this.focusIndex = Math.max(0, this.gameStore.tiles.findIndex(isPlayableCell));
  }
  reset() {
    this.lastTap = null;
    this.startCell = null;
    this.selectedCell = null;
    this.activePointer = null;
    this.clearHighlights();
    this.gameStore.clearBonusPreview();
  }
  handleOut() {
    this.gameStore.clearBonusPreview();
  }
  handlePointerDown(pointer) {
    if (!this.enabled || this.activePointer !== null) return;
    const index = this.getCellIndexFromPointer(pointer);
    if (index === null) return;
    this.activePointer = pointer.id;
    this.startCell = index;
    this.startX = pointer.x;
    this.startY = pointer.y;
    this.gameStore.notifyPlayerActivity();
    this.highlightCell(index);
  }
  handlePointerMove(pointer) {
    if (!this.enabled) return;
    if (this.gameStore.activeBonusMode) {
      const index = this.getCellIndexFromPointer(pointer);
      if (index !== null) this.gameStore.previewPowerEffect(index);
      else this.gameStore.clearBonusPreview();
      return;
    }
    if (this.startCell === null || pointer.id !== this.activePointer) return;
    const dx = pointer.x - this.startX;
    const dy = pointer.y - this.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.layout.cellSize * 0.22) return;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const col = this.startCell % this.layout.boardCols;
    const row = Math.floor(this.startCell / this.layout.boardCols);
    const nextCol = col + (horizontal ? Math.sign(dx) : 0);
    const nextRow = row + (horizontal ? 0 : Math.sign(dy));
    if (
      nextCol < 0 ||
      nextCol >= this.layout.boardCols ||
      nextRow < 0 ||
      nextRow >= this.layout.boardRows
    )
      return;
    this.lastTap = null;
    const from = this.startCell;
    this.startCell = null; // Commit at the swipe threshold, once per gesture.
    this.selectedCell = null;
    this.clearHighlights();
    this.gameStore.resolveSwap(from, nextRow * this.layout.boardCols + nextCol);
  }
  handlePointerUp(pointer) {
    if (pointer.id !== this.activePointer) return;
    this.activePointer = null;
    const start = this.startCell;
    this.startCell = null;
    if (!this.enabled || start === null) return;
    const index = this.getCellIndexFromPointer(pointer);
    if (index === null || index !== start) {
      this.clearHighlights();
      return;
    }
    this.activateCell(index);
  }
  activateCell(index) {
    if (!this.enabled || !isPlayableCell(this.gameStore.tiles?.[index])) return;
    const now = Date.now();
    const gem = this.gameStore.board?.[index];
    const doubleTap =
      this.lastTap?.index === index &&
      this.lastTap.gemId === gem?.id &&
      this.lastTap.version === this.gameStore.boardVersion &&
      now - this.lastTap.at <= 350;
    this.lastTap = { index, gemId: gem?.id, version: this.gameStore.boardVersion, at: now };
    if (doubleTap && BOARD_BONUSES.includes(gem?.type) && !this.gameStore.activeBonusMode) {
      this.reset();
      this.gameStore.activateBonusGem(index);
      return;
    }
    if (this.gameStore.activeBonusMode) {
      this.lastTap = null;
      this.selectedCell = null;
      this.clearHighlights();
      this.gameStore.resolveBonusClick(index);
      return;
    }
    if (this.selectedCell === index) {
      this.selectedCell = null;
      this.clearHighlights();
      return;
    }
    if (this.selectedCell !== null && isAdjacent(this.selectedCell, index, this.layout.boardCols)) {
      this.lastTap = null;
      const first = this.selectedCell;
      this.selectedCell = null;
      this.clearHighlights();
      this.gameStore.resolveSwap(first, index);
      return;
    }
    this.selectedCell = index;
    this.highlightCell(index);
  }
  handleKey(event) {
    if (!this.enabled) return;
    const { boardCols: cols, boardRows: rows } = this.layout;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) return;
    this.gameStore.notifyPlayerActivity();
    if (event.key in offsets) {
      this.lastTap = null;
      event.preventDefault();
      let previous = this.focusIndex;
      let next = previous + offsets[event.key];
      while (
        !event.shiftKey &&
        next >= 0 &&
        next < cols * rows &&
        isAdjacent(previous, next, cols) &&
        !isPlayableCell(this.gameStore.tiles?.[next])
      ) {
        previous = next;
        next += offsets[event.key];
      }
      if (
        next >= 0 &&
        next < cols * rows &&
        isAdjacent(previous, next, cols) &&
        isPlayableCell(this.gameStore.tiles?.[next])
      ) {
        if (event.shiftKey) this.gameStore.resolveSwap(this.focusIndex, next);
        this.focusIndex = next;
        this.highlightCell(next);
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activateCell(this.focusIndex);
    } else if (event.key === 'Escape') {
      this.reset();
      this.gameStore.setBonusMode(null);
    }
  }
  // The cell under a page point, such as a power dragged from the bar onto the board.
  cellAtClientPoint(clientX, clientY) {
    const rect = this.scene?.game?.canvas?.getBoundingClientRect?.();
    if (!rect?.width || !rect.height) return null;
    const { width = rect.width, height = rect.height } = this.scene.scale ?? {};
    return this.getCellIndexFromPointer({
      x: ((clientX - rect.left) * width) / rect.width,
      y: ((clientY - rect.top) * height) / rect.height,
    });
  }
  getCellIndexFromPointer(pointer) {
    const { boardCols, boardRows, cellSize } = this.layout;
    if (!cellSize) return null;
    const x = (pointer.worldX ?? pointer.x) - this.boardContainer.x;
    const y = (pointer.worldY ?? pointer.y) - this.boardContainer.y;
    if (x < 0 || y < 0 || x >= boardCols * cellSize || y >= boardRows * cellSize) return null;
    const index = Math.floor(y / cellSize) * boardCols + Math.floor(x / cellSize);
    return isPlayableCell(this.gameStore.tiles?.[index]) ? index : null;
  }
  highlightCell(index) {
    this.gameStore.renderer?.animator?.highlightCell(index);
  }
  clearHighlights() {
    this.gameStore.renderer?.animator?.clearCellHighlights();
  }
}
