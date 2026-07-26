/**
 * Whether the current account has admin rights, and whether the gate is even
 * configured — so the settings page can explain a missing env var instead of
 * silently rejecting every password.
 */
export default defineEventHandler(async (event) => {
  await requireUserId(event)

  return {
    isAdmin: await isAdminUser(event),
    unlockConfigured: adminPasswordConfigured()
  }
})
