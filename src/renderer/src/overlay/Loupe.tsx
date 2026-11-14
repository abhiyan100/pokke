import { useEffect, useRef } from 'react'
import { placeLoupe, type Point, type Size } from './selection'

const SIZE = 124
/** How many screen pixels the magnifier shows across its width. */
const SPAN = 17

interface LoupeProps {
  image: HTMLImageElement
  pointer: Point
  bounds: Size
}

/** A magnifier that follows the pointer, for placing the corners of a snip precisely. */
export function Loupe({ image, pointer, bounds }: LoupeProps) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const density = image.naturalWidth / bounds.width
    const span = SPAN * density
    context.imageSmoothingEnabled = false
    context.fillStyle = '#101229'
    context.fillRect(0, 0, SIZE * 2, SIZE * 2)
    context.drawImage(image, pointer.x * density - span / 2, pointer.y * density - span / 2, span, span, 0, 0, SIZE * 2, SIZE * 2)
  }, [image, pointer, bounds.width])

  const position = placeLoupe(pointer, bounds, SIZE)

  return (
    <div className="loupe" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} aria-hidden="true">
      <div className="loupe__glass">
        <canvas ref={canvas} width={SIZE * 2} height={SIZE * 2} />
      </div>
      <span className="loupe__label">
        {Math.round(pointer.x)}, {Math.round(pointer.y)}
      </span>
    </div>
  )
}
