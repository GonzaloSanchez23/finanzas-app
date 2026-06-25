// Gestiona nombre/apellido del usuario y evita mostrar email en la navbar.
class UserProfileManager {
  constructor(app) {
    this.app = app;
  }

  async ensureProfile() {
    const existing = await this.app.api.getProfile();
    if (existing?.first_name || existing?.last_name) {
      this.app.profile = existing;
      return existing;
    }

    const seeded = this.getSeedProfile();
    if (seeded) {
      try {
        const saved = await this.app.api.upsertProfile(seeded);
        this.app.profile = saved;
        return saved;
      } catch (error) {
        console.warn('No se pudo crear perfil sembrado:', error);
      }
    }

    this.showProfileModal();
    return null;
  }

  getSeedProfile() {
    const email = String(this.app.user.email || '').toLowerCase();
    const seeds = {
      'gonzalitotimeoff@gmail.com': { first_name: 'Gonzalo', last_name: 'Sánchez' },
      'nicoleroizzz@gmail.com': { first_name: 'Nicole', last_name: 'Rodríguez' }
    };
    return seeds[email] || null;
  }

  showProfileModal() {
    FinanceUtils.showModal({
      title: '¿Cuál es tu nombre?',
      lock: true,
      confirmText: 'Guardar',
      body: `
        <form id="profile-form" class="pro-form" novalidate>
          <div class="form-grid">
            <div class="form-group">
              <label class="field-label" for="profile-first-name">Nombre</label>
              <input id="profile-first-name" type="text" autocomplete="given-name" required>
              <span class="field-error" id="profile-first-error"></span>
            </div>
            <div class="form-group">
              <label class="field-label" for="profile-last-name">Apellido</label>
              <input id="profile-last-name" type="text" autocomplete="family-name" required>
              <span class="field-error" id="profile-last-error"></span>
            </div>
          </div>
        </form>
      `,
      onConfirm: async () => this.saveFromModal()
    });
  }

  async saveFromModal() {
    const firstName = document.getElementById('profile-first-name').value.trim();
    const lastName = document.getElementById('profile-last-name').value.trim();
    document.getElementById('profile-first-error').textContent = firstName ? '' : 'Requerido.';
    document.getElementById('profile-last-error').textContent = lastName ? '' : 'Requerido.';
    if (!firstName || !lastName) return;

    try {
      const saved = await this.app.api.upsertProfile({ first_name: firstName, last_name: lastName });
      this.app.profile = saved;
      FinanceUtils.closeModal();
      this.app.renderShell();
      this.app.bindShellEvents();
      this.app.renderActiveTab();
      FinanceUtils.showToast('Perfil guardado.', 'success');
    } catch (error) {
      console.error(error);
      FinanceUtils.showToast('No pudimos guardar tu perfil.', 'error');
    }
  }
}

window.UserProfileManager = UserProfileManager;
