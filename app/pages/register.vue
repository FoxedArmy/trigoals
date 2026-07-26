<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const { fetch: refreshSession } = useUserSession()

const schema = z.object({
  name: z.string().trim().min(1, 'Bitte Namen eingeben').max(80),
  email: z.string().email('Bitte eine gültige E-Mail eingeben'),
  password: z.string().min(8, 'Mindestens 8 Zeichen')
})
type Schema = z.output<typeof schema>

const state = reactive({ name: '', email: '', password: '' })
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMsg.value = null
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: event.data })
    await refreshSession()
    toast.add({ title: 'Konto erstellt — los geht\'s!', color: 'success' })
    await navigateTo('/profile')
  } catch (e) {
    errorMsg.value = apiErrorMessage(e, 'Registrierung fehlgeschlagen')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="flex justify-center py-16">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold">
          Konto erstellen
        </h1>
        <p class="text-sm text-muted mt-1">
          Starte kostenlos mit deinem Training.
        </p>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Name"
          name="name"
        >
          <UInput
            v-model="state.name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="E-Mail"
          name="email"
        >
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Passwort"
          name="password"
          hint="min. 8 Zeichen"
        >
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          :title="errorMsg"
          icon="i-lucide-triangle-alert"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
          label="Registrieren"
        />
      </UForm>

      <template #footer>
        <p class="text-sm text-muted text-center">
          Bereits registriert?
          <ULink
            to="/login"
            class="text-primary font-medium"
          >Anmelden</ULink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
