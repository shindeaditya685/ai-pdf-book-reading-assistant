'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STAR_COUNT = 80

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

const starData = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: randomBetween(1, 3),
  glow: randomBetween(3, 8),
  delay: Math.random() * 8,
  duration: randomBetween(2, 6),
}))

const planets = [
  {
    size: 60,
    x: 75,
    y: 20,
    color: '#d4a373',
    orbitRadius: 8,
    orbitDuration: 30,
    ring: false,
  },
  {
    size: 35,
    x: 15,
    y: 65,
    color: '#7a9e9f',
    orbitRadius: 5,
    orbitDuration: 20,
    ring: true,
  },
  {
    size: 45,
    x: 85,
    y: 75,
    color: '#c77d61',
    orbitRadius: 6,
    orbitDuration: 25,
    ring: false,
  },
]

export function StarsBackground() {
  const [shootingKey, setShootingKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedule = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setShootingKey((k) => k + 1)
      schedule()
    }, randomBetween(1500, 5000))
  }, [])

  useEffect(() => {
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [schedule])

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {starData.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: '#fff',
            boxShadow: `0 0 ${star.glow}px rgba(255,255,255,0.5)`,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            boxShadow: [
              `0 0 ${star.glow}px rgba(255,255,255,0.3)`,
              `0 0 ${star.glow * 2}px rgba(255,255,255,0.7)`,
              `0 0 ${star.glow}px rgba(255,255,255,0.3)`,
            ],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {planets.map((planet) => (
        <motion.div
          key={`planet-${planet.x}-${planet.y}`}
          className="absolute"
          style={{
            left: `${planet.x}%`,
            top: `${planet.y}%`,
          }}
          animate={{
            y: [`${-planet.orbitRadius}px`, `${planet.orbitRadius}px`, `${-planet.orbitRadius}px`],
            x: [`${-planet.orbitRadius}px`, `${planet.orbitRadius}px`, `${-planet.orbitRadius}px`],
          }}
          transition={{
            duration: planet.orbitDuration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <motion.div
            className="relative"
            animate={{ rotate: 360 }}
            transition={{ duration: planet.orbitDuration * 2, repeat: Infinity, ease: 'linear' }}
          >
            {/* Planet body */}
            <div
              className="rounded-full"
              style={{
                width: planet.size,
                height: planet.size,
                background: `radial-gradient(circle at 35% 35%, ${planet.color}aa, ${planet.color} 60%, #00000055)`,
                boxShadow: `inset -4px -4px 20px rgba(0,0,0,0.5), 0 0 30px ${planet.color}44`,
              }}
            />
            {/* Crescent highlight */}
            <div
              className="absolute rounded-full"
              style={{
                width: '40%',
                height: '40%',
                top: '12%',
                left: '15%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent)',
              }}
            />
            {/* Ring */}
            {planet.ring && (
              <div
                className="absolute"
                style={{
                  width: planet.size * 1.8,
                  height: planet.size * 0.35,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-15deg)',
                  borderRadius: '50%',
                  border: `2px solid ${planet.color}66`,
                  boxShadow: `0 0 15px ${planet.color}33`,
                }}
              />
            )}
          </motion.div>
        </motion.div>
      ))}

      <AnimatePresence>
        <ShootingStar key={shootingKey} />
      </AnimatePresence>
    </div>
  )
}

function ShootingStar() {
  const angle = randomBetween(20, 50)
  const rad = (angle * Math.PI) / 180
  const length = randomBetween(120, 200)
  const startX = randomBetween(5, 70)
  const startY = randomBetween(5, 40)
  const headX = Math.cos(rad) * length
  const headY = Math.sin(rad) * length

  return (
    <motion.div
      className="absolute"
      style={{ left: `${startX}%`, top: `${startY}%` }}
      initial={{ x: -headX, y: -headY, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <div
        className="absolute"
        style={{
          width: length,
          height: 6,
          top: -2,
          rotate: `${angle}deg`,
          transformOrigin: '100% 50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(3px)',
        }}
      />
      <div
        className="relative"
        style={{
          width: length,
          height: 2,
          rotate: `${angle}deg`,
          transformOrigin: '100% 50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 20%, rgba(255,255,255,0.1) 80%, transparent 100%)',
          borderRadius: 1,
          boxShadow: '0 0 6px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.15)',
        }}
      />
    </motion.div>
  )
}
