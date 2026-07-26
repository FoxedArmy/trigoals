declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name?: string | null
    /**
     * Hint for the UI only. Server-side checks call `requireAdmin`, which
     * re-reads the database so a revoked flag takes effect immediately.
     */
    isAdmin?: boolean
  }

  interface UserSession {
    user?: User
  }
}

export {}
