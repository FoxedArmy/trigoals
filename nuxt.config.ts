// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Overridden by NUXT_SESSION_PASSWORD in production.
    session: {
      maxAge: 60 * 60 * 24 * 30 // 30 days
    },
    // Strava (Phase 6) — set via NUXT_STRAVA_* env vars.
    strava: {
      clientId: '',
      clientSecret: '',
      webhookVerifyToken: ''
    },
    public: {
      appName: 'TriGoals',
      // Flipped on (NUXT_PUBLIC_STRAVA_ENABLED=true) once the Strava app is approved.
      stravaEnabled: false
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
