/**
 * Reads the chart palette out of CSS custom properties so charts follow the
 * same tokens as the rest of the UI — and re-reads them when the colour mode
 * changes, since each mode has its own steps.
 */
export function useVizTheme() {
  const colorMode = useColorMode()

  const read = (name: string, fallback: string): string => {
    if (import.meta.server) return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  const tokens = ref(resolve())

  function resolve() {
    return {
      fitness: read('--viz-fitness', '#2a78d6'),
      fatigue: read('--viz-fatigue', '#eb6834'),
      form: read('--viz-form', '#1baf7a'),
      loadBar: read('--viz-load-bar', '#d8d7d0'),
      grid: read('--viz-grid', '#e1e0d9'),
      axis: read('--viz-axis', '#c3c2b7'),
      ink: read('--viz-ink', '#52514e'),
      inkMuted: read('--viz-ink-muted', '#898781'),
      surface: read('--viz-surface', '#fcfcfb'),
      sport: {
        swim: read('--sport-swim', '#2a78d6'),
        bike: read('--sport-bike', '#eb6834'),
        run: read('--sport-run', '#1baf7a'),
        strength: read('--sport-strength', '#4a3aa7'),
        other: read('--sport-other', '#898781')
      },
      zones: Array.from({ length: 7 }, (_, i) => read(`--viz-zone-${i + 1}`, '#3987e5'))
    }
  }

  onMounted(() => {
    tokens.value = resolve()
  })

  // The class swap and the computed-style update aren't in the same tick.
  watch(
    () => colorMode.value,
    async () => {
      await nextTick()
      requestAnimationFrame(() => {
        tokens.value = resolve()
      })
    }
  )

  return tokens
}
