export const GAME_WIDTH = 148
export const GAME_HEIGHT = 101
export const PADDLE_WIDTH = 30
export const PADDLE_HEIGHT = 4
export const PADDLE_Y = GAME_HEIGHT - PADDLE_HEIGHT
export const BALL_RADIUS = 1.5
export const BRICK_COLUMNS = 12
export const BRICK_ROWS = 2
export const MAX_BRICK_ROWS = 5
export const BRICK_HEIGHT = 4
export const BRICK_GAP_X = 2
export const BRICK_GAP_Y = 4
export const BRICK_LEFT = 3
export const BRICK_TOP = 3
export const BRICK_WIDTH =
  (GAME_WIDTH - BRICK_LEFT * 2 - BRICK_GAP_X * (BRICK_COLUMNS - 1)) / BRICK_COLUMNS
export const STARTING_BALLS = 3
export const BASE_BALL_SPEED = 70
export const MAX_BALL_SPEED = BASE_BALL_SPEED * 1.5

export interface Brick {
  x: number
  y: number
  destroyed: boolean
}

export interface Ball {
  x: number
  y: number
  dx: number
  dy: number
}

export interface BrickGameState {
  paddleX: number
  ball: Ball
  bricks: Brick[]
  score: number
  balls: number
  level: number
  isBallInPlay: boolean
  isGameOver: boolean
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function brickRowsForLevel(level: number): number {
  return Math.min(BRICK_ROWS + Math.max(0, level - 1), MAX_BRICK_ROWS)
}

export function createBricks(level: number): Brick[] {
  const rows = brickRowsForLevel(level)
  const bricks: Brick[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < BRICK_COLUMNS; column += 1) {
      bricks.push({
        x: BRICK_LEFT + column * (BRICK_WIDTH + BRICK_GAP_X),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP_Y),
        destroyed: false,
      })
    }
  }

  return bricks
}

export function ballSpeedForLevel(level: number): number {
  return Math.min(BASE_BALL_SPEED * (1 + Math.max(0, level - 1) * 0.1), MAX_BALL_SPEED)
}

function ballOnPaddle(paddleX: number): Ball {
  return {
    x: paddleX + PADDLE_WIDTH / 2,
    y: PADDLE_Y - BALL_RADIUS,
    dx: 0,
    dy: 0,
  }
}

export function createBrickGame(level = 1): BrickGameState {
  const paddleX = (GAME_WIDTH - PADDLE_WIDTH) / 2
  return {
    paddleX,
    ball: ballOnPaddle(paddleX),
    bricks: createBricks(level),
    score: 0,
    balls: STARTING_BALLS,
    level,
    isBallInPlay: false,
    isGameOver: false,
  }
}

export function movePaddle(state: BrickGameState, direction: number): BrickGameState {
  const paddleX = clamp(
    state.paddleX + direction * (GAME_WIDTH - PADDLE_WIDTH) * 0.12,
    0,
    GAME_WIDTH - PADDLE_WIDTH,
  )
  const next: BrickGameState = { ...state, paddleX }

  if (!state.isBallInPlay) {
    next.ball = {
      ...state.ball,
      x: paddleX + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS,
    }
  }

  return next
}

export function launchBall(state: BrickGameState): BrickGameState {
  if (state.isGameOver) return createBrickGame()
  if (state.isBallInPlay) return state

  const speed = ballSpeedForLevel(state.level)
  const angle = 0.32
  return {
    ...state,
    ball: {
      x: state.paddleX + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 0.5,
      dx: Math.sin(angle) * speed,
      dy: -Math.cos(angle) * speed,
    },
    isBallInPlay: true,
  }
}

function circleTouchesBrick(ball: Ball, brick: Brick): boolean {
  const closestX = clamp(ball.x, brick.x, brick.x + BRICK_WIDTH)
  const closestY = clamp(ball.y, brick.y, brick.y + BRICK_HEIGHT)
  const dx = ball.x - closestX
  const dy = ball.y - closestY
  return dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS
}

function bounceFromPaddle(state: BrickGameState): void {
  const hit = clamp(
    (state.ball.x - (state.paddleX + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2),
    -1,
    1,
  )
  const angle = hit * (Math.PI / 3)
  const speed = ballSpeedForLevel(state.level)

  state.ball.x = clamp(state.ball.x, BALL_RADIUS, GAME_WIDTH - BALL_RADIUS)
  state.ball.y = PADDLE_Y - BALL_RADIUS
  state.ball.dx = Math.sin(angle) * speed
  state.ball.dy = -Math.cos(angle) * speed
}

function resetBallForServe(state: BrickGameState): void {
  state.ball = ballOnPaddle(state.paddleX)
  state.isBallInPlay = false
}

export function tickBrickGame(state: BrickGameState, deltaSeconds: number): BrickGameState {
  if (!state.isBallInPlay || state.isGameOver) return state

  const seconds = clamp(deltaSeconds, 0, 0.05)
  if (seconds === 0) return state

  const next: BrickGameState = {
    ...state,
    ball: { ...state.ball },
    bricks: state.bricks.map((brick) => ({ ...brick })),
  }
  const ball = next.ball

  ball.x += ball.dx * seconds
  ball.y += ball.dy * seconds

  if (ball.x - BALL_RADIUS <= 0 && ball.dx < 0) {
    ball.x = BALL_RADIUS
    ball.dx = Math.abs(ball.dx)
  } else if (ball.x + BALL_RADIUS >= GAME_WIDTH && ball.dx > 0) {
    ball.x = GAME_WIDTH - BALL_RADIUS
    ball.dx = -Math.abs(ball.dx)
  }

  if (ball.y - BALL_RADIUS <= 0 && ball.dy < 0) {
    ball.y = BALL_RADIUS
    ball.dy = Math.abs(ball.dy)
  }

  const paddleHit =
    ball.dy > 0 &&
    ball.y + BALL_RADIUS >= PADDLE_Y &&
    ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
    ball.x + BALL_RADIUS >= next.paddleX &&
    ball.x - BALL_RADIUS <= next.paddleX + PADDLE_WIDTH

  if (paddleHit) bounceFromPaddle(next)

  if (ball.y - BALL_RADIUS > GAME_HEIGHT) {
    next.balls -= 1
    if (next.balls <= 0) {
      next.balls = 0
      next.isBallInPlay = false
      next.isGameOver = true
    } else {
      resetBallForServe(next)
    }
    return next
  }

  const brickIndex = next.bricks.findIndex(
    (brick) => !brick.destroyed && circleTouchesBrick(ball, brick),
  )

  if (brickIndex >= 0) {
    const brick = next.bricks[brickIndex]
    if (!brick) return next

    brick.destroyed = true
    next.score += 1

    if (ball.x >= brick.x && ball.x <= brick.x + BRICK_WIDTH) {
      ball.dy = -ball.dy
    } else {
      ball.dx = -ball.dx
    }

    if (next.bricks.every((entry) => entry.destroyed)) {
      next.level += 1
      next.bricks = createBricks(next.level)
      resetBallForServe(next)
    }
  }

  return next
}
