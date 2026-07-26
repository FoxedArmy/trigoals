<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const { data: admin, refresh: refreshAdmin } = await useFetch('/api/admin/status')

/**
 * Connection details are admin-only, so this call is made lazily and only once
 * the gate is open — an unprivileged request would 404 by design.
 */
const {
  data: strava,
  refresh: refreshStrava,
  status: stravaStatus
} = await useFetch('/api/strava/status', {
  immediate: admin.value?.isAdmin ?? false
})

watch(
  () => admin.value?.isAdmin,
  (isAdmin) => {
    if (isAdmin) refreshStrava()
  }
)

// --- Admin unlock ---------------------------------------------------------
const password = ref('')
const unlocking = ref(false)
const unlockError = ref<string | null>(null)

async function unlock() {
  if (!password.value) return
  unlocking.value = true
  unlockError.value = null
  try {
    await $fetch('/api/admin/unlock', { method: 'POST', body: { password: password.value } })
    password.value = ''
    await Promise.all([refreshSession(), refreshAdmin()])
    await refreshStrava()
    toast.add({ title: 'Admin-Bereich freigeschaltet', color: 'success', icon: 'i-lucide-unlock' })
  } catch (e) {
    unlockError.value = apiErrorMessage(e, 'Freischaltung fehlgeschlagen')
  } finally {
    unlocking.value = false
  }
}

// --- OAuth result feedback ------------------------------------------------
const CALLBACK_MESSAGES: Record<string, { title: string, color: 'success' | 'error' | 'warning' }> = {
  connected: { title: 'Strava verbunden', color: 'success' },
  denied: { title: 'Zugriff bei Strava abgelehnt', color: 'warning' },
  incomplete: { title: 'Strava hat die Anfrage unvollständig zurückgegeben', color: 'error' },
  state_mismatch: { title: 'Sicherheitsprüfung fehlgeschlagen — bitte erneut versuchen', color: 'error' },
  scope_missing: {
    title: 'Berechtigung „Alle Aktivitäten" wurde nicht erteilt',
    color: 'warning'
  },
  exchange_failed: { title: 'Token-Austausch mit Strava fehlgeschlagen', color: 'error' }
}

onMounted(() => {
  const status = route.query.status as string | undefined
  const msg = status && CALLBACK_MESSAGES[status]
  if (msg) {
    toast.add({ title: msg.title, color: msg.color })
    // Drop the query so a reload doesn't repeat the toast.
    navigateTo({ path: '/settings/strava', replace: true })
  }
})

// --- Sync / disconnect ----------------------------------------------------
const syncing = ref(false)
const disconnecting = ref(false)

async function sync() {
  syncing.value = true
  try {
    const res = await $fetch<{ imported: number, skipped: number }>('/api/strava/sync', {
      method: 'POST',
      body: { days: 30 }
    })
    toast.add({
      title: res.imported
        ? `${res.imported} ${res.imported === 1 ? 'Aktivität' : 'Aktivitäten'} übernommen`
        : 'Keine neuen Aktivitäten',
      description: res.skipped ? `${res.skipped} bereits vorhanden` : undefined,
      color: 'success',
      icon: 'i-lucide-check'
    })
    await refreshStrava()
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Sync fehlgeschlagen'), color: 'error' })
  } finally {
    syncing.value = false
  }
}

async function disconnect() {
  disconnecting.value = true
  try {
    const res = await $fetch<{ revokedAtStrava: boolean }>('/api/strava/disconnect', {
      method: 'DELETE'
    })
    toast.add({
      title: 'Verbindung getrennt',
      description: res.revokedAtStrava
        ? 'Zugriff auch bei Strava widerrufen.'
        : 'Lokal entfernt — prüfe den Zugriff ggf. in den Strava-Einstellungen.',
      color: 'success'
    })
    await refreshStrava()
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Trennen fehlgeschlagen'), color: 'error' })
  } finally {
    disconnecting.value = false
  }
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'noch nie'
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const STRAVA_ORANGE = '#fc4c02'
</script>

<template>
  <UContainer class="py-8 space-y-6 max-w-2xl">
    <div>
      <h1 class="text-2xl font-bold">
        Strava-Verbindung
      </h1>
      <p class="text-muted">
        Aktivitäten automatisch übernehmen, statt sie manuell einzutragen.
      </p>
    </div>

    <!-- Gate: admin password ------------------------------------------------>
    <UCard v-if="!admin?.isAdmin">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-lock"
            class="size-5 text-muted"
          />
          <h2 class="font-semibold">
            Admin-Bereich
          </h2>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          Die Strava-Anbindung ist ein Betreiber-Feature und mit einem Passwort geschützt.
        </p>

        <UAlert
          v-if="!admin?.unlockConfigured"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Kein Admin-Passwort gesetzt"
          description="Setze NUXT_ADMIN_UNLOCK_PASSWORD (mind. 12 Zeichen) in der Umgebung und starte neu."
        />

        <form
          v-else
          class="space-y-3"
          @submit.prevent="unlock"
        >
          <UFormField
            label="Admin-Passwort"
            name="admin-password"
          >
            <UInput
              v-model="password"
              type="password"
              autocomplete="off"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="unlockError"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="unlockError"
          />

          <UButton
            type="submit"
            icon="i-lucide-unlock"
            label="Freischalten"
            :loading="unlocking"
            :disabled="!password"
          />
        </form>
      </div>
    </UCard>

    <!-- Unlocked ----------------------------------------------------------->
    <template v-else>
      <UAlert
        v-if="!strava?.configured"
        color="warning"
        variant="subtle"
        icon="i-lucide-settings"
        title="Strava-Anwendung fehlt"
        description="Lege unter strava.com/settings/api eine API-Anwendung an und setze NUXT_STRAVA_CLIENT_ID sowie NUXT_STRAVA_CLIENT_SECRET."
      />

      <UAlert
        v-else-if="!strava?.encryptionReady"
        color="warning"
        variant="subtle"
        icon="i-lucide-key"
        title="Verschlüsselungsschlüssel fehlt"
        description="NUXT_TOKEN_ENCRYPTION_KEY (mind. 32 Zeichen) setzen — Tokens werden nur verschlüsselt gespeichert."
      />

      <!-- Connected -->
      <UCard v-else-if="strava?.connection">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-simple-icons-strava"
              class="size-5 shrink-0"
              :style="{ color: STRAVA_ORANGE }"
            />
            <h2 class="font-semibold">
              Verbunden
            </h2>
            <UBadge
              size="sm"
              color="success"
              variant="subtle"
              label="aktiv"
              class="ml-auto"
            />
          </div>
        </template>

        <dl class="text-sm space-y-2">
          <div class="flex justify-between gap-4">
            <dt class="text-muted">
              Athlet
            </dt>
            <dd class="font-medium">
              {{ strava.connection.athleteName || strava.connection.athleteId }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted">
              Verbunden seit
            </dt>
            <dd class="tabular-nums">
              {{ formatDateTime(strava.connection.createdAt) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted">
              Letzter Sync
            </dt>
            <dd class="tabular-nums">
              {{ formatDateTime(strava.connection.lastSyncAt) }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              label="Jetzt synchronisieren"
              :loading="syncing"
              @click="sync"
            />
            <UButton
              icon="i-lucide-unlink"
              color="error"
              variant="ghost"
              label="Verbindung trennen"
              :loading="disconnecting"
              @click="disconnect"
            />
          </div>
        </template>
      </UCard>

      <!-- Not connected yet -->
      <UCard v-else>
        <div class="flex items-start gap-3">
          <UIcon
            name="i-simple-icons-strava"
            class="size-6 shrink-0"
            :style="{ color: STRAVA_ORANGE }"
          />
          <div class="flex-1">
            <p class="font-semibold">
              Mit Strava verbinden
            </p>
            <p class="text-sm text-muted mt-1">
              Danach lassen sich deine Aktivitäten mit einem Klick übernehmen und werden
              automatisch gegen den Plan abgeglichen.
            </p>
          </div>
        </div>

        <template #footer>
          <UButton
            to="/api/strava/connect"
            external
            icon="i-simple-icons-strava"
            label="Mit Strava verbinden"
            :style="{ backgroundColor: STRAVA_ORANGE }"
            :loading="stravaStatus === 'pending'"
          />
        </template>
      </UCard>

      <!-- Strava attribution is required by their brand guidelines -->
      <p class="text-xs text-dimmed text-center">
        Powered by Strava
      </p>
    </template>

    <!-- Always available: the Strava-free path -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-sm">
          Auch ohne Strava
        </h2>
      </template>
      <ul class="space-y-1.5 text-sm text-muted">
        <li class="flex items-start gap-2">
          <UIcon
            name="i-lucide-check"
            class="size-4 text-success shrink-0 mt-0.5"
          />
          <span>
            <strong class="text-toned">Datei-Import:</strong> .fit, .gpx oder .tcx unter
            <ULink
              to="/activities"
              class="text-primary"
            >Aktivitäten</ULink> hochladen.
          </span>
        </li>
        <li class="flex items-start gap-2">
          <UIcon
            name="i-lucide-check"
            class="size-4 text-success shrink-0 mt-0.5"
          />
          <span>
            <strong class="text-toned">Manuell erfassen:</strong> Dauer, Distanz, Puls und Watt
            eintragen.
          </span>
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
