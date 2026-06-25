// AuthManager centraliza pre-login, signup, login, reset password y logout.
class AuthManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.app = document.getElementById('app');
    this.mode = 'welcome';
  }

  showWelcomeScreen() {
    this.mode = 'welcome';
    this.app.innerHTML = `
      <main class="login-screen">
        <section class="login-box welcome-box" aria-labelledby="welcome-title">
          <div class="app-mark">💰</div>
          <h1 id="welcome-title">${FinanceUtils.APP_NAME}</h1>
          <p>${FinanceUtils.APP_TAGLINE}</p>
          <div class="auth-actions">
            <button class="button button-primary button-full button-tall" id="go-signup" type="button">Crear Cuenta</button>
            <button class="button button-outline button-full button-tall" id="go-login" type="button">Iniciar Sesión</button>
          </div>
        </section>
      </main>
    `;
    document.getElementById('go-signup').addEventListener('click', () => this.showSignupScreen());
    document.getElementById('go-login').addEventListener('click', () => this.showLoginScreen());
  }

  showSignupScreen() {
    this.mode = 'signup';
    this.app.innerHTML = `
      <main class="login-screen">
        <section class="login-box" aria-labelledby="signup-title">
          <h1 id="signup-title">${FinanceUtils.APP_NAME}</h1>
          <p>Crea tu cuenta para empezar a controlar tu dinero.</p>
          <form id="auth-form" class="form-grid" novalidate>
            <div class="form-group">
              <label for="auth-first-name">Nombre</label>
              <input id="auth-first-name" type="text" autocomplete="given-name" placeholder="Gonzalo" required>
              <span class="field-error" id="first-name-error"></span>
            </div>
            <div class="form-group">
              <label for="auth-last-name">Apellido</label>
              <input id="auth-last-name" type="text" autocomplete="family-name" placeholder="Sánchez" required>
              <span class="field-error" id="last-name-error"></span>
            </div>
            <div class="form-group full">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" placeholder="test@example.com" required>
              <span class="field-error" id="email-error"></span>
            </div>
            <div class="form-group full">
              <label for="auth-password">Contraseña</label>
              <input id="auth-password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required>
              <span class="field-error" id="password-error"></span>
            </div>
            <button class="button button-primary button-full button-tall" type="submit" id="signup-btn">Crear Cuenta</button>
            <button class="button button-link button-full" type="button" id="back-welcome">Ya tengo cuenta</button>
          </form>
        </section>
      </main>
    `;
    document.getElementById('auth-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.signup();
    });
    document.getElementById('back-welcome').addEventListener('click', () => this.showWelcomeScreen());
  }

  showLoginScreen() {
    this.mode = 'login';
    this.app.innerHTML = `
      <main class="login-screen">
        <section class="login-box" aria-labelledby="login-title">
          <h1 id="login-title">${FinanceUtils.APP_NAME}</h1>
          <p>${FinanceUtils.APP_TAGLINE}</p>
          <form id="auth-form" class="form-grid" novalidate>
            <div class="form-group full">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" placeholder="test@example.com" required>
              <span class="field-error" id="email-error"></span>
            </div>
            <div class="form-group full">
              <label for="auth-password">Contraseña</label>
              <input id="auth-password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required>
              <span class="field-error" id="password-error"></span>
            </div>
            <button class="forgot-link" type="button" id="forgot-password">¿Olvidaste tu contraseña?</button>
            <button class="button button-primary button-full button-tall" type="submit" id="login-btn">Iniciar Sesión</button>
            <button class="button button-link button-full" type="button" id="back-welcome">Volver</button>
          </form>
        </section>
      </main>
    `;
    document.getElementById('auth-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.login();
    });
    document.getElementById('forgot-password').addEventListener('click', () => this.showResetScreen());
    document.getElementById('back-welcome').addEventListener('click', () => this.showWelcomeScreen());
  }

  showResetScreen() {
    this.mode = 'reset';
    this.app.innerHTML = `
      <main class="login-screen">
        <section class="login-box" aria-labelledby="reset-title">
          <h1 id="reset-title">Recuperar contraseña</h1>
          <p>Te enviaremos un enlace para cambiarla.</p>
          <form id="reset-form" class="form-grid" novalidate>
            <div class="form-group full">
              <label for="reset-email">Email</label>
              <input id="reset-email" type="email" autocomplete="email" required>
              <span class="field-error" id="reset-email-error"></span>
            </div>
            <button class="button button-primary button-full button-tall" id="reset-btn" type="submit">Enviar enlace</button>
            <button class="button button-link button-full" type="button" id="back-login">Volver a login</button>
          </form>
        </section>
      </main>
    `;
    document.getElementById('reset-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.resetPassword();
    });
    document.getElementById('back-login').addEventListener('click', () => this.showLoginScreen());
  }

  async signup() {
    if (!this.validateSignupForm()) return;
    const values = this.getSignupValues();
    this.setButtonLoading('signup-btn', true, 'Creando...');

    const { data, error } = await this.supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: {
          full_name: `${values.firstName} ${values.lastName}`,
          first_name: values.firstName,
          last_name: values.lastName
        }
      }
    });
    this.setButtonLoading('signup-btn', false, 'Crear Cuenta');

    if (error) {
      showToast(this.friendlyAuthError(error), 'error');
      return;
    }

    if (data.session?.user) {
      await this.createProfileForUser(data.session.user, values.firstName, values.lastName);
      this.showApp(data.session.user);
      return;
    }

    showToast('Cuenta creada. Revisa tu correo si Supabase pide confirmación.', 'success');
    this.showLoginScreen();
  }

  async login() {
    if (!this.validateLoginForm()) return;
    const { email, password } = this.getLoginValues();
    this.setButtonLoading('login-btn', true, 'Entrando...');

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    this.setButtonLoading('login-btn', false, 'Iniciar Sesión');

    if (error) {
      showToast(this.friendlyAuthError(error), 'error');
      return;
    }

    showToast('Sesión iniciada.', 'success');
    this.showApp(data.session.user);
  }

  async resetPassword() {
    const email = document.getElementById('reset-email').value.trim();
    document.getElementById('reset-email-error').textContent = '';
    if (!email || !email.includes('@')) {
      document.getElementById('reset-email-error').textContent = 'Escribe un email válido.';
      return;
    }

    this.setButtonLoading('reset-btn', true, 'Enviando...');
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    this.setButtonLoading('reset-btn', false, 'Enviar enlace');

    if (error) {
      showToast(this.friendlyAuthError(error), 'error');
      return;
    }

    showToast('Enviamos un enlace a tu email.', 'success');
    this.showLoginScreen();
  }

  async createProfileForUser(user, firstName, lastName) {
    const api = new FinanceApi(this.supabase, user);
    try {
      await api.upsertProfile({ first_name: firstName, last_name: lastName });
    } catch (error) {
      console.warn('No se pudo crear user_profile:', error);
    }
  }

  async logout() {
    await this.supabase.auth.signOut();
    showToast('Sesión cerrada.', 'info');
    this.showWelcomeScreen();
  }

  async checkAuthAndShowApp() {
    if (!this.supabase) {
      this.app.innerHTML = '<main class="login-screen"><section class="login-box"><h1>Configura Supabase</h1><p>Revisa config.js y confirma que Supabase cargó correctamente.</p></section></main>';
      return;
    }

    const { data } = await this.supabase.auth.getSession();
    if (data.session?.user) {
      this.showApp(data.session.user);
      return;
    }

    this.showWelcomeScreen();
  }

  showApp(user) {
    window.appManager = new AppManager(this.supabase, user, this);
    window.appManager.init();
  }

  getSignupValues() {
    return {
      firstName: document.getElementById('auth-first-name').value.trim(),
      lastName: document.getElementById('auth-last-name').value.trim(),
      email: document.getElementById('auth-email').value.trim(),
      password: document.getElementById('auth-password').value
    };
  }

  getLoginValues() {
    return {
      email: document.getElementById('auth-email').value.trim(),
      password: document.getElementById('auth-password').value
    };
  }

  validateSignupForm() {
    const values = this.getSignupValues();
    ['first-name', 'last-name', 'email', 'password'].forEach((id) => {
      document.getElementById(`${id}-error`).textContent = '';
    });
    let isValid = true;
    if (!values.firstName) {
      document.getElementById('first-name-error').textContent = 'Escribe tu nombre.';
      isValid = false;
    }
    if (!values.lastName) {
      document.getElementById('last-name-error').textContent = 'Escribe tu apellido.';
      isValid = false;
    }
    if (!values.email || !values.email.includes('@')) {
      document.getElementById('email-error').textContent = 'Escribe un email válido.';
      isValid = false;
    }
    if (!values.password || values.password.length < 6) {
      document.getElementById('password-error').textContent = 'Mínimo 6 caracteres.';
      isValid = false;
    }
    return isValid;
  }

  validateLoginForm() {
    const { email, password } = this.getLoginValues();
    document.getElementById('email-error').textContent = '';
    document.getElementById('password-error').textContent = '';
    let isValid = true;
    if (!email || !email.includes('@')) {
      document.getElementById('email-error').textContent = 'Escribe un email válido.';
      isValid = false;
    }
    if (!password) {
      document.getElementById('password-error').textContent = 'Escribe tu contraseña.';
      isValid = false;
    }
    return isValid;
  }

  setButtonLoading(buttonId, isLoading, label) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = isLoading ? `<span class="loading-spinner"></span>${label}` : label;
  }

  friendlyAuthError(error) {
    const message = error?.message?.toLowerCase() || '';
    console.error('Supabase Auth error:', error);
    if (message.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (message.includes('already registered')) return 'Ese email ya tiene una cuenta.';
    if (message.includes('rate limit') || message.includes('too many')) return 'Supabase limitó los correos por ahora. Espera unos minutos.';
    if (message.includes('sending confirmation') || message.includes('send')) return 'Supabase no pudo mandar el correo. Revisa Auth/SMTP.';
    if (message.includes('invalid email') || message.includes('email address')) return 'Revisa que el email esté bien escrito.';
    if (message.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    return 'No pudimos completar la acción. Intenta de nuevo.';
  }
}
