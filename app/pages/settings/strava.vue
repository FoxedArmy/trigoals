<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const config = useRuntimeConfig()
/** Set once the Strava app credentials are configured (after API approval). */
const configured = computed(() => Boolean(config.public.stravaEnabled))
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

    <UCard v-if="!configured">
      <div class="space-y-4">
        <div class="flex items-start gap-3">
          <UIcon
            name="i-simple-icons-strava"
            class="size-6 shrink-0"
            style="color: #fc4c02"
          />
          <div>
            <p class="font-semibold">
              Noch nicht aktiviert
            </p>
            <p class="text-sm text-muted mt-1">
              Die Strava-Anbindung braucht eine freigegebene API-Anwendung. Bis dahin
              funktioniert TriGoals vollständig ohne Strava — über manuelle Erfassung und
              Datei-Import.
            </p>
          </div>
        </div>

        <USeparator />

        <div class="space-y-2 text-sm">
          <p class="font-medium">
            Was bis dahin geht
          </p>
          <ul class="space-y-1.5 text-muted">
            <li class="flex items-start gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-success shrink-0 mt-0.5"
              />
              <span>
                <strong class="text-toned">Datei-Import:</strong> Exportiere .fit, .gpx oder
                .tcx aus Strava, Garmin Connect oder direkt von der Uhr und lade sie unter
                <ULink
                  to="/activities"
                  class="text-primary"
                >Aktivitäten</ULink> hoch.
              </span>
            </li>
            <li class="flex items-start gap-2">
              <UIcon
                name="i-lucide-check"
                class="size-4 text-success shrink-0 mt-0.5"
              />
              <span>
                <strong class="text-toned">Manuell erfassen:</strong> Dauer, Distanz, Puls und
                Watt eintragen — die Trainingslast wird daraus berechnet.
              </span>
            </li>
          </ul>
          <p class="text-xs text-dimmed pt-2">
            Beide Wege landen in derselben Auswertung wie ein späterer Strava-Sync: gleicher
            Abgleich mit dem Plan, gleiche Charts.
          </p>
        </div>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-shield-check"
          title="Deine Daten bleiben deine"
          description="Wenn die Verbindung aktiv ist, werden Strava-Daten ausschließlich dir angezeigt und nicht mit anderen Athleten zusammengeführt."
        />
      </div>
    </UCard>

    <UCard v-else>
      <div class="flex items-center gap-3">
        <UIcon
          name="i-simple-icons-strava"
          class="size-6 shrink-0"
          style="color: #fc4c02"
        />
        <div class="flex-1">
          <p class="font-semibold">
            Mit Strava verbinden
          </p>
          <p class="text-sm text-muted">
            Neue Aktivitäten werden danach automatisch übernommen.
          </p>
        </div>
        <UButton
          to="/api/auth/strava"
          external
          label="Verbinden"
          style="background-color: #fc4c02"
        />
      </div>
    </UCard>
  </UContainer>
</template>
