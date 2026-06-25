// AuthManager centraliza login, signup, logout y verificacion de sesion.
class AuthManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.app = document.getElementById('app');
  }

  showLoginScreen() {
    this.app.innerHTML = `
      <main class="login-screen">
        <section class="login-box" aria-labelledby="login-title">
          <h1 id="login-title">Mis Finanzas</h1>
          <p>Controla tus gastos, ingresos y tendencias con una app privada para ustedes.</p>
          <form id="auth-form" class="form-grid" novalidate>
            <div class="form-group full">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" placeholder="test@example.com" required>
              <span class="field-error" id="email-error"></span>
            </div>
            <div class="form-group full">
              <label for="auth-password">Password</label>
              <input id="auth-password" type="password" autocomplete="current-password" placeholder="Minimo 6 caracteres" required>
              <span class="field-error" id="password-error"></span>
            </div>
            <button class="button button-primary button-full" type="submit" id="login-btn">Entrar</button>
            <button class="button button-secondary button-full" type="button" id="signup-btn">Crear cuenta</button>
          </form>
        </section>
      </main>
    `;

    document.getElementById('auth-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.login();
    });
    document.getElementById('signup-btn').addEventListener('click', () => this.signup());
  }

  async signup() {
    if (!this.validateAuthForm()) return;
    const { email, password } = this.getAuthValues();
    this.setAuthLoading(true, 'Creando cuenta...');

    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    this.setAuthLoading(false);

    if (error) {
      showToast(this.friendlyAuthError(error), 'error');
      return;
    }

    showToast('Cuenta creada. Revisa tu correo si Supabase pide confirmacion.', 'success');
    this.checkAuthAndShowApp();
  }

  async login() {
    if (!this.validateAuthForm()) return;
    const { email, password } = this.getAuthValues();
    this.setAuthLoading(true, 'Entrando...');

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    this.setAuthLoading(false);

    if (error) {
      showToast(this.friendlyAuthError(error), 'error');
      return;
    }

    showToast('Sesion iniciada.', 'success');
    this.showApp(data.session.user);
  }

  async logout() {
    await this.supabase.auth.signOut();
    showToast('Sesion cerrada.', 'info');
    this.showLoginScreen();
  }

  async checkAuthAndShowApp() {
    if (!this.supabase) {
      this.app.innerHTML = '<main class="login-screen"><section class="login-box"><h1>Configura Supabase</h1><p>Revisa config.js y confirma que el CDN de Supabase cargo correctamente.</p></section></main>';
      return;
    }

    const { data } = await this.supabase.auth.getSession();
    if (data.session?.user) {
      this.showApp(data.session.user);
      return;
    }

    this.showLoginScreen();
  }

  showApp(user) {
    window.appManager = new AppManager(this.supabase, user, this);
    window.appManager.init();
  }

  getAuthValues() {
    return {
      email: document.getElementById('auth-email').value.trim(),
      password: document.getElementById('auth-password').value
    };
  }

  validateAuthForm() {
    const { email, password } = this.getAuthValues();
    document.getElementById('email-error').textContent = '';
    document.getElementById('password-error').textContent = '';
    let isValid = true;

    if (!email || !email.includes('@')) {
      document.getElementById('email-error').textContent = 'Escribe un email valido.';
      isValid = false;
    }

    if (!password || password.length < 6) {
      document.getElementById('password-error').textContent = 'El password debe tener al menos 6 caracteres.';
      isValid = false;
    }

    return isValid;
  }

  setAuthLoading(isLoading, label = 'Entrar') {
    const loginButton = document.getElementById('login-btn');
    const signupButton = document.getElementById('signup-btn');
    loginButton.disabled = isLoading;
    signupButton.disabled = isLoading;
    loginButton.innerHTML = isLoading ? `<span class="loading-spinner"></span>${label}` : 'Entrar';
  }

  friendlyAuthError(error) {
    const message = error?.message?.toLowerCase() || '';
    console.error('Supabase Auth error:', error);
    if (message.includes('invalid login')) return 'Email o password incorrectos.';
    if (message.includes('already registered')) return 'Ese email ya tiene una cuenta.';
    if (message.includes('rate limit') || message.includes('too many')) return 'Supabase limito los correos por ahora. Espera unos minutos e intenta otra vez.';
    if (message.includes('sending confirmation') || message.includes('send')) return 'Supabase no pudo mandar el correo de confirmacion. Revisa la configuracion de Auth/SMTP.';
    if (message.includes('invalid email') || message.includes('email address')) return 'Revisa que el email este bien escrito.';
    if (message.includes('password')) return 'Revisa que el password tenga al menos 6 caracteres.';
    return 'No pudimos completar la accion. Intenta de nuevo.';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(18px)';
    setTimeout(() => toast.remove(), 180);
  }, 3000);
}
