export interface AuthSession {
  authenticated: boolean;
  required: boolean;
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const res = await fetch('/api/auth/session');
  if (!res.ok) {
    throw new Error('Failed to check auth session');
  }
  return res.json() as Promise<AuthSession>;
}

export async function loginWithPassword(password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? 'Login failed');
  }
}

export async function ensureAuthenticated(appRoot: HTMLElement): Promise<boolean> {
  const session = await fetchAuthSession();
  if (!session.required || session.authenticated) {
    return true;
  }

  return new Promise((resolve) => {
    appRoot.innerHTML = `
      <div class="auth-gate">
        <form class="auth-gate-card" id="auth-login-form">
          <div class="auth-gate-brand">RepoMind</div>
          <h1 class="auth-gate-title">Sign in</h1>
          <p class="auth-gate-hint">Enter the UI password to access this workspace.</p>
          <label class="auth-gate-label" for="auth-password">Password</label>
          <input
            id="auth-password"
            class="auth-gate-input"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            autofocus
          />
          <p id="auth-error" class="auth-gate-error hidden" role="alert"></p>
          <button type="submit" class="btn-primary auth-gate-submit">Sign in</button>
        </form>
      </div>
    `;

    const form = appRoot.querySelector<HTMLFormElement>('#auth-login-form')!;
    const passwordInput = appRoot.querySelector<HTMLInputElement>('#auth-password')!;
    const errorEl = appRoot.querySelector<HTMLElement>('#auth-error')!;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      errorEl.classList.add('hidden');
      errorEl.textContent = '';

      void loginWithPassword(passwordInput.value)
        .then(() => {
          window.location.reload();
          resolve(true);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Login failed';
          errorEl.textContent = message;
          errorEl.classList.remove('hidden');
          passwordInput.select();
        });
    });
  });
}
