import { z } from 'zod'

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein')

export const sportSchema = z.enum(['swim', 'bike', 'run', 'strength', 'other'])

export const workoutTypeSchema = z.enum([
  'recovery',
  'endurance',
  'tempo',
  'threshold',
  'vo2max',
  'interval',
  'long',
  'brick',
  'race',
  'strength',
  'other'
])

export const zoneSchema = z.number().int().min(1).max(7)
