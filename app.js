// AppManager orquesta la app: datos compartidos, navegacion y modulos.
class AppManager {
  constructor(supabaseClient, user, authManager) {
    this.supabase = supabaseClient;
    this.user = user;
    this.authManager = authManager;
    this.app = document.getElementById('app');
    this.api = new FinanceApi(supabaseClient, user);
    this.today = new Date();
    this.currentMonth = this.today.getMonth() + 1;
    this.currentYear = this.today.getFullYear();
    this.activeTab = 'movimientos';
    this.movements = [];
    this.categories = [];
    this.budgets = [];
    this.profile = null;
    this.profileManager = new UserProfileManager(this);
    this.modules = {
      movimientos: new MovimientosModule(this),
      presupuestos: new PresupuestosModule(this),
      dashboard: new DashboardModule(this)
    };
  }

  async init() {
    await this.refreshData();
    this.renderShell();
    this.bindShellEvents();
    this.renderActiveTab();
    const profile = await this.profileManager.ensureProfile();
    if (profile) {
      this.renderShell();
      this.bindShellEvents();
      this.renderActiveTab();
    }
  }

  renderShell() {
    const displayName = FinanceUtils.getUserDisplayName(this.user, this.profile);
    this.app.innerHTML = `
      <div class="app-shell">
        <header class="navbar">
          <div class="brand">
            <strong>${FinanceUtils.APP_NAME}</strong>
            <span>${FinanceUtils.APP_TAGLINE}</span>
          </div>
          <div class="user-block">
            <div>
              <strong>${FinanceUtils.escapeHtml(displayName)}</strong>
              <span>${FinanceUtils.escapeHtml(FinanceUtils.getShortName(displayName))}</span>
            </div>
            <button class="button button-ghost" id="logout-btn" type="button">Salir</button>
          </div>
        </header>

        <div id="offline-banner" class="offline-banner hidden">Sin conexión: algunas acciones pueden tardar en sincronizar.</div>

        <main class="main-container">
          <nav class="primary-nav" aria-label="Pantallas principales">
            <button class="nav-button active" data-tab="movimientos" type="button">Movimientos</button>
            <button class="nav-button" data-tab="presupuestos" type="button">Presupuestos</button>
            <button class="nav-button" data-tab="dashboard" type="button">Dashboard</button>
          </nav>
          <section id="tab-content" class="tab-content"></section>
        </main>

        <div id="modal-root"></div>
      </div>
    `;
    this.updateOfflineBanner();
    this.updateNavState();
  }

  bindShellEvents() {
    document.getElementById('logout-btn').addEventListener('click', () => this.authManager.logout());
    document.querySelectorAll('.nav-button').forEach((button) => {
      button.addEventListener('click', async () => {
        this.activeTab = button.dataset.tab;
        this.updateNavState();
        await this.refreshData(false);
        this.renderActiveTab();
      });
    });
    window.addEventListener('online', async () => {
      this.updateOfflineBanner();
      await this.refreshData(false);
      this.renderActiveTab();
    });
    window.addEventListener('offline', () => this.updateOfflineBanner());
  }

  updateNavState() {
    document.querySelectorAll('.nav-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === this.activeTab);
    });
  }

  async refreshData(showLoading = true) {
    if (showLoading) this.renderLoading();

    try {
      const movements = await this.api.getMovements();
      const categories = await this.api.getCategories();
      let budgets = [];
      try {
        budgets = await this.api.getBudgets();
      } catch (budgetError) {
        console.warn('Presupuestos no disponibles todavia:', budgetError);
      }
      this.movements = movements;
      this.categories = categories;
      this.budgets = budgets;
      localStorage.setItem(`movements_cache_${this.user.id}`, JSON.stringify(movements));
    } catch (error) {
      console.error(error);
      this.movements = JSON.parse(localStorage.getItem(`movements_cache_${this.user.id}`) || '[]');
      FinanceUtils.showToast('No pudimos cargar datos frescos. Mostrando lo disponible.', 'error');
    }
  }

  renderActiveTab() {
    const container = document.getElementById('tab-content');
    const module = this.modules[this.activeTab];
    if (!container || !module) return;
    container.innerHTML = module.render();
    module.bind();
  }

  renderLoading() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = `
      <section class="panel loading-panel">
        <span class="loading-spinner dark"></span>
        <p>Cargando información...</p>
      </section>
    `;
  }

  updateOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.toggle('hidden', navigator.onLine);
  }
}
