import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_WIDTH,
  PADDLE_Y,
  ballSpeedForLevel,
  brickRowsForLevel,
  createBrickGame,
  launchBall,
  movePaddle,
  tickBrickGame,
} from './brick'

describe('createBrickGame', () => {
  it('starts with three balls, two brick rows, and the ball on the paddle', () => {
    const game = createBrickGame()
    expect(game.balls).toBe(3)
    expect(game.level).toBe(1)
    expect(game.isBallInPlay).toBe(false)
    expect(game.bricks).toHaveLength(24)
    expect(game.ball.x).toBeCloseTo(game.paddleX + PADDLE_WIDTH / 2)
    expect(game.ball.y).toBeCloseTo(PADDLE_Y - BALL_RADIUS)
  })

  it('adds a brick row per level up to five rows', () => {
    expect(brickRowsForLevel(1)).toBe(2)
    expect(brickRowsForLevel(3)).toBe(4)
    expect(brickRowsForLevel(20)).toBe(5)
    expect(createBrickGame(3).bricks).toHaveLength(48)
  })
})

describe('paddle movement', () => {
  it('moves the paddle and the waiting ball without leaving the screen', () => {
    const game = createBrickGame()
    const right = movePaddle(game, 100)
    expect(right.paddleX).toBe(GAME_WIDTH - PADDLE_WIDTH)
    expect(right.ball.x).toBeCloseTo(GAME_WIDTH - PADDLE_WIDTH / 2)

    const left = movePaddle(game, -100)
    expect(left.paddleX).toBe(0)
    expect(left.ball.x).toBeCloseTo(PADDLE_WIDTH / 2)
  })
})

describe('launchBall', () => {
  it('launches upward when the ball is waiting', () => {
    const launched = launchBall(createBrickGame())
    expect(launched.isBallInPlay).toBe(true)
    expect(launched.ball.dy).toBeLessThan(0)
    expect(launched.ball.dx).toBeGreaterThan(0)
  })

  it('resets a finished game instead of launching', () => {
    const finished = { ...createBrickGame(), isGameOver: true, balls: 0 }
    const reset = launchBall(finished)
    expect(reset.isGameOver).toBe(false)
    expect(reset.balls).toBe(3)
    expect(reset.isBallInPlay).toBe(false)
  })
})

describe('tickBrickGame', () => {
  it('moves a live ball', () => {
    const game = { ...createBrickGame(), isBallInPlay: true }
    game.ball = { x: GAME_WIDTH / 2, y: 50, dx: 10, dy: -10 }
    const next = tickBrickGame(game, 0.05)
    expect(next.ball.x).toBeGreaterThan(game.ball.x)
    expect(next.ball.y).toBeLessThan(game.ball.y)
  })

  it('bounces off the side wall', () => {
    const game = { ...createBrickGame(), isBallInPlay: true }
    game.ball = { x: BALL_RADIUS - 0.5, y: 50, dx: -20, dy: 0 }
    const next = tickBrickGame(game, 0.05)
    expect(next.ball.dx).toBeGreaterThan(0)
    expect(next.ball.x).toBeGreaterThanOrEqual(BALL_RADIUS)
  })

  it('bounces off the paddle', () => {
    const game = { ...createBrickGame(), isBallInPlay: true }
    game.ball = {
      x: game.paddleX + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      dx: 0,
      dy: 20,
    }
    const next = tickBrickGame(game, 0.05)
    expect(next.ball.dy).toBeLessThan(0)
  })

  it('destroys a brick, adds score, and reverses the ball', () => {
    const game = { ...createBrickGame(), isBallInPlay: true }
    const brick = game.bricks[0]
    if (!brick) throw new Error('missing brick')
    game.ball = {
      x: brick.x + BRICK_WIDTH / 2,
      y: brick.y + BRICK_HEIGHT + BALL_RADIUS + 2,
      dx: 0,
      dy: -40,
    }
    const next = tickBrickGame(game, 0.05)
    expect(next.score).toBe(1)
    expect(next.bricks[0]?.destroyed).toBe(true)
    expect(next.ball.dy).toBeGreaterThan(0)
  })

  it('advances to the next level and resets the serve after clearing bricks', () => {
    const game = { ...createBrickGame(), isBallInPlay: true }
    game.bricks = game.bricks.map((brick, index) => ({
      ...brick,
      destroyed: index !== 0,
    }))
    const brick = game.bricks[0]
    if (!brick) throw new Error('missing brick')
    game.ball = {
      x: brick.x + BRICK_WIDTH / 2,
      y: brick.y + BRICK_HEIGHT + BALL_RADIUS + 2,
      dx: 0,
      dy: -40,
    }

    const next = tickBrickGame(game, 0.05)
    expect(next.level).toBe(2)
    expect(next.bricks).toHaveLength(36)
    expect(next.isBallInPlay).toBe(false)
    expect(next.ball.y).toBeCloseTo(PADDLE_Y - BALL_RADIUS)
  })

  it('loses a ball and eventually ends the game', () => {
    const game = { ...createBrickGame(), isBallInPlay: true, balls: 1 }
    game.ball = { x: GAME_WIDTH / 2, y: GAME_HEIGHT + BALL_RADIUS + 2, dx: 0, dy: 0 }
    const next = tickBrickGame(game, 0.01)
    expect(next.balls).toBe(0)
    expect(next.isGameOver).toBe(true)
    expect(next.isBallInPlay).toBe(false)
  })
})

describe('difficulty', () => {
  it('raises speed with levels and caps it', () => {
    expect(ballSpeedForLevel(2)).toBeGreaterThan(ballSpeedForLevel(1))
    expect(ballSpeedForLevel(100)).toBe(ballSpeedForLevel(6))
  })
})
