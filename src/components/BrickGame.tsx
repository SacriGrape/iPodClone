import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { BrickGameState } from '../lib/brick'
import {
  BALL_RADIUS,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  PADDLE_WIDTH,
  createBrickGame,
  launchBall,
  movePaddle,
  tickBrickGame,
} from '../lib/brick'

export interface BrickGameHandle {
  steer: (direction: number) => void
  launch: () => void
}

interface BrickStats {
  score: number
  balls: number
  level: number
  isBallInPlay: boolean
  isGameOver: boolean
}

function statsOf(game: BrickGameState): BrickStats {
  return {
    score: game.score,
    balls: game.balls,
    level: game.level,
    isBallInPlay: game.isBallInPlay,
    isGameOver: game.isGameOver,
  }
}

function statsKey(stats: BrickStats): string {
  return [
    stats.score,
    stats.balls,
    stats.level,
    stats.isBallInPlay ? 1 : 0,
    stats.isGameOver ? 1 : 0,
  ].join(':')
}

export const BrickGame = forwardRef<BrickGameHandle>(function BrickGame(_props, ref) {
  const [initialGame] = useState(createBrickGame)
  const stateRef = useRef<BrickGameState>(initialGame)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState<BrickStats>(() => statsOf(initialGame))
  const lastStatsKey = useRef(statsKey(statsOf(initialGame)))

  const syncStats = useCallback((game: BrickGameState) => {
    const next = statsOf(game)
    const key = statsKey(next)
    if (key === lastStatsKey.current) return
    lastStatsKey.current = key
    setStats(next)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      steer(direction: number) {
        const next = movePaddle(stateRef.current, direction)
        stateRef.current = next
        syncStats(next)
      },
      launch() {
        const next = launchBall(stateRef.current)
        stateRef.current = next
        syncStats(next)
      },
    }),
    [syncStats],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    let frame = 0
    let previous = performance.now()

    const draw = () => {
      if (!context) return
      const game = stateRef.current
      context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      context.fillStyle = '#484647'

      for (const brick of game.bricks) {
        if (brick.destroyed) continue
        context.fillRect(
          Math.round(brick.x),
          Math.round(brick.y),
          Math.ceil(BRICK_WIDTH),
          BRICK_HEIGHT,
        )
      }

      context.fillRect(
        Math.round(game.paddleX),
        PADDLE_Y,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      )
      context.fillRect(
        Math.round(game.ball.x - BALL_RADIUS),
        Math.round(game.ball.y - BALL_RADIUS),
        Math.ceil(BALL_RADIUS * 2),
        Math.ceil(BALL_RADIUS * 2),
      )
    }

    const loop = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000))
      previous = now
      stateRef.current = tickBrickGame(stateRef.current, delta)
      syncStats(stateRef.current)
      draw()
      frame = window.requestAnimationFrame(loop)
    }

    draw()
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [syncStats])

  const message = stats.isGameOver
    ? 'GAME OVER'
    : stats.isBallInPlay
      ? ''
      : 'Press Center to Launch Ball'

  return (
    <>
      <div className="screen-titlebar brick-titlebar">
        <span className="brick-stat brick-balls" aria-label={`${stats.balls} balls`}>
          {stats.balls}
        </span>
        <span className="brick-stat brick-score" aria-label={`Score ${stats.score}`}>
          {stats.score}
        </span>
        <span className="battery-indicator" aria-hidden="true" />
      </div>
      <div className="brick-game-screen">
        <canvas
          ref={canvasRef}
          className="brick-canvas"
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          aria-hidden="true"
        />
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </>
  )
})
