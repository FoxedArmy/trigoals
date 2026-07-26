<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'default' })

const route = useRoute()
const { fetch: refreshSession, loggedIn } = useUserSession()

// Already logged in? Skip.
watchEffect(() => {
  if (loggedIn.value) navigateTo((route.query.redirect as string) || '/dashboard')
})

const schema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail eingeben'),
  password: z.string().min(1, 'Bitte Passwort eingeben')
})
type Schema = z.output<typeof schema>

const state = reactive({ email: '', password: '' })
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMsg.value = null
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: event.data })
    await refreshSession()
    toast.add({ title: 'Willkommen zurück!', color: 'success' })
    await navigateTo((route.query.redirect as string) || '/dashboard')
  } catch (e) {
    errorMsg.value = apiErrorMessage(e, 'Anmeldung fehlgeschlagen')
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
          Anmelden
        </h1>
        <p class="text-sm text-muted mt-1">
          Willkommen zurück bei TriGoals.
        </p>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
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
        >
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
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
          label="Anmelden"
        />
      </UForm>

      <template #footer>
        <p class="text-sm text-muted text-center">
          Noch kein Konto?
          <ULink
            to="/register"
            class="text-primary font-medium"
          >Registrieren</ULink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
