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
    // Strava — credentials from your own Strava API application.
    strava: {
      clientId: '',
      clientSecret: '',
      webhookVerifyToken: ''
    },
    public: {
      appName: 'TriGoals'
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
