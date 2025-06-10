"use client"

import { useEffect, useRef } from "react"

interface GaugeChartProps {
  value: number
  maxValue: number
  deficit: number
  size?: number
}

export function GaugeChart({ value, maxValue, deficit, size = 200 }: GaugeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set up dimensions
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) * 0.8

    // Calculate angles
    const startAngle = Math.PI * 0.8
    const endAngle = Math.PI * 2.2
    const totalAngle = endAngle - startAngle

    const percentage = Math.min(value / maxValue, 1)
    const valueAngle = startAngle + totalAngle * percentage

    // Draw background arc
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.lineWidth = 15
    ctx.strokeStyle = "#e5e7eb"
    ctx.stroke()

    // Draw value arc with gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
    gradient.addColorStop(0, "#0a7578")
    gradient.addColorStop(1, "#b17e1e")

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, startAngle, valueAngle)
    ctx.lineWidth = 15
    ctx.strokeStyle = gradient
    ctx.lineCap = "round"
    ctx.stroke()

    // Draw center text
    ctx.fillStyle = "#0a7578"
    ctx.font = "bold 24px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(`${Math.round(percentage * 100)}%`, centerX, centerY - 15)

    // Draw value text
    ctx.fillStyle = "#374151"
    ctx.font = "14px sans-serif"
    ctx.fillText(`${value}/${maxValue}`, centerX, centerY + 15)

    // Draw deficit text if there is one
    if (deficit > 0) {
      ctx.fillStyle = "#b17e1e"
      ctx.font = "12px sans-serif"
      ctx.fillText(`${deficit} needed`, centerX, centerY + 35)
    }
  }, [value, maxValue, deficit, size])

  return <canvas ref={canvasRef} width={size} height={size} className="mx-auto" />
}
