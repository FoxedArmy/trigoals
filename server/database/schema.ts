import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

const uuid = () => text().$defaultFn(() => crypto.randomUUID())

/** Sport disciplines used across planned and actual workouts. */
export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'other'

// ---------------------------------------------------------------------------
// Users & authentication
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// ---------------------------------------------------------------------------
// Athlete profile — thresholds per sport. Zones are derived on the fly
// (see app/utils/zones.ts) so we only persist the source values.
// ---------------------------------------------------------------------------
export const athleteProfiles = pgTable('athlete_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Cycling
  ftp: integer('ftp'), // watts
  // Running — threshold pace in seconds per kilometer
  thresholdPaceRun: integer('threshold_pace_run'),
  // Swimming — Critical Swim Speed, seconds per 100 m
  css: integer('css'),
  // Heart rate
  lthr: integer('lthr'), // lactate threshold HR (bpm)
  maxHr: integer('max_hr'),
  restHr: integer('rest_hr'),
  weightKg: real('weight_kg'),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// ---------------------------------------------------------------------------
// Races / season goals
// ---------------------------------------------------------------------------
export const races = pgTable('races', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  date: date('date').notNull(),
  sport: text('sport').notNull().$type<Sport | 'triathlon'>(),
  distanceLabel: text('distance_label'), // e.g. "Olympic", "Marathon", "70.3"
  priority: text('priority').$type<'A' | 'B' | 'C'>().notNull().default('B'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// ---------------------------------------------------------------------------
// Plan templates — reusable weekly / periodised structures
// userId null => system template shared with everyone
// ---------------------------------------------------------------------------
export const planTemplates = pgTable('plan_templates', {
  id: uuid().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  focus: text('focus').$type<Sport | 'triathlon'>(),
  // Array of weeks; each week is an array of workout blueprints.
  weeks: jsonb('weeks').$type<TemplateWeek[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export interface TemplateWorkout {
  dayOfWeek: number // 0 = Monday .. 6 = Sunday
  sport: Sport
  title: string
  type: WorkoutType
  durationSec?: number
  distanceM?: number
  targetZone?: number
  notes?: string
}
export interface TemplateWeek {
  label?: string // e.g. "Base 1", "Recovery"
  workouts: TemplateWorkout[]
}

export type WorkoutType
  = | 'recovery'
    | 'endurance'
    | 'tempo'
    | 'threshold'
    | 'vo2max'
    | 'interval'
    | 'long'
    | 'brick'
    | 'race'
    | 'strength'
    | 'other'

// ---------------------------------------------------------------------------
// Planned workouts (the calendar)
// ---------------------------------------------------------------------------
export const plannedWorkouts = pgTable(
  'planned_workouts',
  {
    id: uuid().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    sport: text('sport').$type<Sport>().notNull(),
    title: text('title').notNull(),
    type: text('type').$type<WorkoutType>().notNull().default('endurance'),
    plannedDurationSec: integer('planned_duration_sec'),
    plannedDistanceM: real('planned_distance_m'),
    targetZone: integer('target_zone'),
    plannedLoad: integer('planned_load'),
    structure: jsonb('structure').$type<unknown>(),
    raceId: text('race_id').references(() => races.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  t => [index('planned_user_date_idx').on(t.userId, t.date)]
)

// ---------------------------------------------------------------------------
// Activities (actual sessions) — manual, file import or Strava
// ---------------------------------------------------------------------------
export const activities = pgTable(
  'activities',
  {
    id: uuid().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').$type<'manual' | 'import' | 'strava'>().notNull().default('manual'),
    stravaActivityId: text('strava_activity_id'),
    sport: text('sport').$type<Sport>().notNull(),
    name: text('name'),
    startTime: timestamp('start_time').notNull(),
    durationSec: integer('duration_sec').notNull(),
    distanceM: real('distance_m'),
    avgPower: integer('avg_power'),
    avgHr: integer('avg_hr'),
    maxHr: integer('max_hr'),
    avgPaceSecPerKm: integer('avg_pace_sec_per_km'),
    elevationM: real('elevation_m'),
    load: integer('load'),
    rawFileName: text('raw_file_name'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  t => [
    index('activity_user_start_idx').on(t.userId, t.startTime),
    uniqueIndex('activity_strava_idx').on(t.userId, t.stravaActivityId)
  ]
)

// ---------------------------------------------------------------------------
// Matches between planned workouts and actual activities
// ---------------------------------------------------------------------------
export const workoutMatches = pgTable(
  'workout_matches',
  {
    id: uuid().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    plannedWorkoutId: text('planned_workout_id').references(() => plannedWorkouts.id, {
      onDelete: 'cascade'
    }),
    activityId: text('activity_id').references(() => activities.id, { onDelete: 'cascade' }),
    status: text('status')
      .$type<'completed' | 'partial' | 'missed' | 'unplanned'>()
      .notNull(),
    complianceScore: integer('compliance_score'),
    autoMatched: boolean('auto_matched').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  t => [
    uniqueIndex('match_planned_idx').on(t.plannedWorkoutId),
    index('match_user_idx').on(t.userId)
  ]
)

// ---------------------------------------------------------------------------
// Strava connections (Phase 6) — tokens stored per user
// ---------------------------------------------------------------------------
export const stravaConnections = pgTable('strava_connections', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  athleteId: text('athlete_id').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  scope: text('scope'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(athleteProfiles, {
    fields: [users.id],
    references: [athleteProfiles.userId]
  }),
  races: many(races),
  plannedWorkouts: many(plannedWorkouts),
  activities: many(activities)
}))

export const plannedWorkoutsRelations = relations(plannedWorkouts, ({ one }) => ({
  user: one(users, { fields: [plannedWorkouts.userId], references: [users.id] }),
  race: one(races, { fields: [plannedWorkouts.raceId], references: [races.id] }),
  match: one(workoutMatches, {
    fields: [plannedWorkouts.id],
    references: [workoutMatches.plannedWorkoutId]
  })
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  match: one(workoutMatches, {
    fields: [activities.id],
    references: [workoutMatches.activityId]
  })
}))

export const workoutMatchesRelations = relations(workoutMatches, ({ one }) => ({
  user: one(users, { fields: [workoutMatches.userId], references: [users.id] }),
  plannedWorkout: one(plannedWorkouts, {
    fields: [workoutMatches.plannedWorkoutId],
    references: [plannedWorkouts.id]
  }),
  activity: one(activities, {
    fields: [workoutMatches.activityId],
    references: [activities.id]
  })
}))

export type User = typeof users.$inferSelect
export type AthleteProfile = typeof athleteProfiles.$inferSelect
export type Race = typeof races.$inferSelect
export type PlannedWorkout = typeof plannedWorkouts.$inferSelect
export type Activity = typeof activities.$inferSelect
export type WorkoutMatch = typeof workoutMatches.$inferSelect
export type PlanTemplate = typeof planTemplates.$inferSelect
