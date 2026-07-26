<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const { loggedIn, user, clear } = useUserSession()

const nav = computed<NavigationMenuItem[]>(() =>
  loggedIn.value
    ? [
        { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
        { label: 'Kalender', icon: 'i-lucide-calendar', to: '/plan' },
        { label: 'Aktivitäten', icon: 'i-lucide-activity', to: '/activities' },
        { label: 'Wettkämpfe', icon: 'i-lucide-flag', to: '/races' }
      ]
    : []
)

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}

const userMenu = computed<DropdownMenuItem[][]>(() => {
  const account: DropdownMenuItem[] = [
    { label: 'Profil & Zonen', icon: 'i-lucide-user', to: '/profile' }
  ]

  // Operator-only entry. Hidden for everyone else, so the Strava connection
  // isn't even advertised — the page behind it enforces the gate regardless.
  if (user.value?.isAdmin) {
    account.push({ label: 'Strava', icon: 'i-simple-icons-strava', to: '/settings/strava' })
  }

  return [
    [{ label: user.value?.name || user.value?.email || 'Konto', type: 'label' }],
    account,
    [{ label: 'Abmelden', icon: 'i-lucide-log-out', onSelect: logout }]
  ]
})
</script>

<template>
  <div>
    <UHeader>
      <template #left>
        <NuxtLink to="/">
          <AppLogo />
        </NuxtLink>
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <UColorModeButton />

        <template v-if="loggedIn">
          <UDropdownMenu :items="userMenu">
            <UButton
              icon="i-lucide-circle-user-round"
              color="neutral"
              variant="ghost"
              aria-label="Konto"
            />
          </UDropdownMenu>
        </template>
        <template v-else>
          <UButton
            to="/login"
            color="neutral"
            variant="ghost"
            label="Anmelden"
          />
          <UButton
            to="/register"
            color="primary"
            label="Registrieren"
          />
        </template>
      </template>

      <template #body>
        <UNavigationMenu
          :items="nav"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          © {{ new Date().getFullYear() }} TriGoals
        </p>
      </template>
    </UFooter>
  </div>
</template>
