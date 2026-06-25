// AppManager contiene la experiencia principal: registro, dashboard, KPIs y analisis.
class AppManager {
  constructor(supabaseClient, user, authManager) {
    this.supabase = supabaseClient;
    this.user = user;
    this.authManager = authManager;
    this.app = document.getElementById('app');
    this.today = new Date();
    this.currentMonth = this.today.getMonth() + 1;
    this.currentYear = this.today.getFullYear();
    this.activeTab = 'register';
    this.movimientos = [];
    this.categories = [];
    this.pendingStorageKey = `pending_movimientos_${this.user.id}`;
  }

  async init() {
    this.renderShell();
    this.bindGlobalEvents();
    await this.syncPendingMovements();
    await this.loadData();
    this.renderActiveTab();
  }

  renderShell() {
    this.app.innerHTML = `
      <div class="app-shell">
        <header class="navbar">
          <div class="brand">
            <strong>💰 Mis Finanzas</strong>
            <span>Finanzas personales, sin friccion</span>
          </div>
          <div class="button-row">
            <span class="user-email">${this.escapeHtml(this.user.email || '')}</span>
            <button class="button button-ghost" id="logout-btn" type="button">Salir</button>
          </div>
        </header>
        <div id="offline-banner" class="offline-banner hidden">Sin conexion: tus movimientos se guardaran temporalmente.</div>
        <main class="main-container">
          <nav class="tabs" aria-label="Pantallas principales">
            <button class="tab-btn active" data-tab="register" type="button">Registrar</button>
            <button class="tab-btn" data-tab="dashboard" type="button">Dashboard</button>
          </nav>
          <section id="tab-content" class="tab-content"></section>
        </main>
        <div id="modal-root"></div>
      </div>
    `;
    this.updateOfflineBanner();
  }

  bindGlobalEvents() {
    document.getElementById('logout-btn').addEventListener('click', () => this.authManager.logout());
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab));
    });
    window.addEventListener('online', () => {
      this.updateOfflineBanner();
      this.syncPendingMovements();
    });
    window.addEventListener('offline', () => this.updateOfflineBanner());
  }

  async switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    await this.loadData();
    this.renderActiveTab();
  }

  renderActiveTab() {
    if (this.activeTab === 'dashboard') {
      this.renderDashboard();
      return;
    }
    this.renderMovementForm();
  }

  renderMovementForm() {
    const today = this.toDateInputValue(this.today);
    document.getElementById('tab-content').innerHTML = `
      <section class="form-card" aria-labelledby="movement-title">
        <h2 class="section-title" id="movement-title">Registrar movimiento</h2>
        <form id="movement-form" class="form-grid" novalidate>
          <div class="form-group">
            <label for="tipo">Tipo</label>
            <select id="tipo" required>
              <option value="">Selecciona...</option>
              <option value="Gasto">Gasto</option>
              <option value="Ingreso">Ingreso</option>
              <option value="Inversión">Inversión</option>
              <option value="Transferencia">Transferencia</option>
            </select>
            <span class="field-error" id="tipo-error"></span>
          </div>
          <div class="form-group autocomplete-wrap">
            <label for="categoria">Categoria</label>
            <input id="categoria" type="text" maxlength="60" autocomplete="off" placeholder="Supermercado" required>
            <div id="category-suggestions" class="suggestions hidden"></div>
            <span class="field-error" id="categoria-error"></span>
          </div>
          <div class="form-group">
            <label for="monto">Monto</label>
            <input id="monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required>
            <span class="field-error" id="monto-error"></span>
          </div>
          <div class="form-group">
            <label for="fecha">Fecha</label>
            <input id="fecha" type="date" max="${today}" value="${today}" required>
            <span class="field-error" id="fecha-error"></span>
          </div>
          <label class="checkbox-card full" for="es-impulsivo">
            <input id="es-impulsivo" type="checkbox">
            <span>Gasto impulsivo o no planeado</span>
          </label>
          <div class="form-group full">
            <label for="comentarios">Comentarios</label>
            <textarea id="comentarios" maxlength="200" placeholder="Nota opcional, maximo 200 caracteres"></textarea>
            <small id="comment-counter">0/200</small>
          </div>
          <button class="button button-primary button-full" id="save-movement-btn" type="submit">Guardar Movimiento</button>
        </form>
      </section>
    `;

    this.bindMovementFormEvents();
  }

  bindMovementFormEvents() {
    const form = document.getElementById('movement-form');
    const tipo = document.getElementById('tipo');
    const categoria = document.getElementById('categoria');
    const monto = document.getElementById('monto');
    const comentarios = document.getElementById('comentarios');

    tipo.addEventListener('change', () => categoria.focus());
    categoria.addEventListener('input', () => this.renderCategorySuggestions(categoria.value));
    categoria.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        monto.focus();
      }
    });
    comentarios.addEventListener('input', () => {
      document.getElementById('comment-counter').textContent = `${comentarios.value.length}/200`;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveMovement();
    });
  }

  renderCategorySuggestions(query) {
    const suggestionsBox = document.getElementById('category-suggestions');
    const cleanQuery = this.normalizeText(query);
    if (!cleanQuery) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    const matches = this.categories
      .filter((category) => this.normalizeText(category).includes(cleanQuery))
      .slice(0, 5);

    if (!matches.length) {
      suggestionsBox.classList.add('hidden');
      return;
    }

    suggestionsBox.innerHTML = matches.map((category) => `
      <button class="suggestion-item" type="button">${this.escapeHtml(category)}</button>
    `).join('');
    suggestionsBox.classList.remove('hidden');
    suggestionsBox.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        document.getElementById('categoria').value = button.textContent;
        suggestionsBox.classList.add('hidden');
        document.getElementById('monto').focus();
      });
    });
  }

  async saveMovement() {
    const movement = this.getMovementFormValues();
    const errors = this.validateMovement(movement);
    this.showFieldErrors(errors);

    if (Object.keys(errors).length) {
      showToast('Revisa los campos marcados.', 'error');
      return;
    }

    this.setSaveLoading(true);
    const payload = {
      user_id: this.user.id,
      tipo: movement.tipo,
      categoria: movement.categoria,
      monto: movement.monto,
      es_impulsivo: movement.es_impulsivo,
      comentarios: movement.comentarios,
      fecha: movement.fecha
    };

    if (!navigator.onLine) {
      this.queuePendingMovement(payload);
      this.setSaveLoading(false);
      this.afterSuccessfulSave('Sin conexion: guardado temporalmente.');
      return;
    }

    const { error } = await this.supabase.from('movimientos').insert(payload);
    this.setSaveLoading(false);

    if (error) {
      showToast('No pudimos guardar el movimiento. Intenta otra vez.', 'error');
      return;
    }

    await this.upsertCategory(payload.categoria, payload.tipo);
    this.afterSuccessfulSave('Movimiento guardado.');
  }

  afterSuccessfulSave(message) {
    showToast(message, 'success');
    document.getElementById('movement-form').reset();
    document.getElementById('fecha').value = this.toDateInputValue(this.today);
    document.getElementById('comment-counter').textContent = '0/200';
    document.getElementById('tipo').focus();
    this.loadData();
  }

  getMovementFormValues() {
    return {
      tipo: document.getElementById('tipo').value,
      categoria: document.getElementById('categoria').value.trim(),
      monto: Number(document.getElementById('monto').value),
      es_impulsivo: document.getElementById('es-impulsivo').checked,
      comentarios: document.getElementById('comentarios').value.trim(),
      fecha: document.getElementById('fecha').value
    };
  }

  validateMovement(movement) {
    const errors = {};
    if (!movement.tipo) errors.tipo = 'Selecciona un tipo.';
    if (!movement.categoria) errors.categoria = 'Escribe una categoria.';
    if (!movement.monto || Number.isNaN(movement.monto) || movement.monto <= 0) {
      errors.monto = 'El monto debe ser mayor a cero.';
    }
    if (!movement.fecha) errors.fecha = 'Selecciona una fecha.';
    if (movement.fecha && movement.fecha > this.toDateInputValue(this.today)) {
      errors.fecha = 'La fecha no puede estar en el futuro.';
    }
    return errors;
  }

  showFieldErrors(errors) {
    ['tipo', 'categoria', 'monto', 'fecha'].forEach((field) => {
      document.getElementById(`${field}-error`).textContent = errors[field] || '';
    });
  }

  setSaveLoading(isLoading) {
    const button = document.getElementById('save-movement-btn');
    button.disabled = isLoading;
    button.innerHTML = isLoading ? '<span class="loading-spinner"></span>Guardando...' : 'Guardar Movimiento';
  }

  async renderDashboard() {
    const monthMovements = this.getMovementsForMonth(this.currentYear, this.currentMonth);
    const yearlyMovements = this.movimientos.filter((item) => new Date(`${item.fecha}T00:00:00`).getFullYear() === this.currentYear);
    const stats = this.calculateStats(monthMovements, yearlyMovements);

    document.getElementById('tab-content').innerHTML = `
      <section class="dashboard-header">
        <h2 class="section-title">Dashboard</h2>
        <div class="month-controls" aria-label="Selector de mes">
          <button class="button button-secondary" id="prev-month" type="button">&lt; Anterior</button>
          <div class="month-label" id="month-label">${this.getFriendlyMonth(this.currentYear, this.currentMonth)}</div>
          <button class="button button-secondary" id="next-month" type="button">Siguiente &gt;</button>
          <select id="month-select" aria-label="Mes">${this.renderMonthOptions()}</select>
        </div>
      </section>
      <section class="kpi-container" aria-label="KPIs financieros">
        ${this.renderKpi('Gastos del Mes', stats.monthExpenses, 'kpi-danger')}
        ${this.renderKpi('Ingresos del Mes', stats.monthIncome, 'kpi-success')}
        ${this.renderKpi('Gastos del Año', stats.yearExpenses, 'kpi-warning')}
        ${this.renderKpi('Promedio/Mes', stats.monthlyAverage, 'kpi-primary')}
      </section>
      ${this.renderComparison(stats)}
      ${this.renderAnalysis(stats)}
      ${this.renderMovementsTable(monthMovements)}
    `;

    this.bindDashboardEvents();
  }

  renderKpi(title, value, className) {
    return `
      <article class="kpi ${className}">
        <h3>${title}</h3>
        <div class="kpi-value">${this.formatMoney(value)}</div>
      </article>
    `;
  }

  renderComparison(stats) {
    let text = 'Sin promedio suficiente para comparar.';
    let trendClass = 'trend-flat';
    let progress = 0;

    if (stats.monthlyAverage > 0) {
      const difference = ((stats.monthExpenses - stats.monthlyAverage) / stats.monthlyAverage) * 100;
      const rounded = Math.abs(difference).toFixed(0);
      progress = Math.min(100, Math.abs(difference));
      if (difference > 0) {
        text = `↑ ${rounded}% arriba de tu promedio`;
        trendClass = 'trend-up';
      } else if (difference < 0) {
        text = `↓ ${rounded}% abajo de tu promedio`;
        trendClass = 'trend-down';
      } else {
        text = 'Estas exactamente en tu promedio.';
      }
    }

    return `
      <section class="card comparison-card">
        <h3 class="comparison-title">Tu gasto este mes vs tu promedio</h3>
        <p class="trend-text ${trendClass}">${text}</p>
        <div class="progress" aria-hidden="true">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
      </section>
    `;
  }

  renderAnalysis(stats) {
    return `
      <section class="analysis-card comparison-card">
        <h3 class="comparison-title">Analisis rapido</h3>
        <div class="analysis-grid">
          <div class="analysis-item">
            <strong>Impulsivos vs planeados</strong>
            <span>${this.formatMoney(stats.impulsiveExpenses)} / ${this.formatMoney(stats.plannedExpenses)}</span>
          </div>
          <div class="analysis-item">
            <strong>Mayor categoria</strong>
            <span>${this.escapeHtml(stats.topCategory || 'Sin datos')}</span>
          </div>
          <div class="analysis-item">
            <strong>Categoria que mas crecio</strong>
            <span>${this.escapeHtml(stats.fastestGrowingCategory || 'Sin datos')}</span>
          </div>
          <div class="analysis-item">
            <strong>Movimientos del mes</strong>
            <span>${stats.movementCount}</span>
          </div>
        </div>
      </section>
    `;
  }

  renderMovementsTable(monthMovements) {
    if (!monthMovements.length) {
      return `
        <section class="card table-card">
          <h3 class="comparison-title">Movimientos</h3>
          <div class="empty-state">No hay movimientos este mes</div>
        </section>
      `;
    }

    const rows = monthMovements.map((item) => `
      <tr data-id="${item.id || ''}" tabindex="0">
        <td>${this.formatDate(item.fecha)}</td>
        <td><span class="type-pill ${this.getTypeClass(item.tipo)}">${this.escapeHtml(item.tipo)}</span></td>
        <td>${this.escapeHtml(item.categoria)}</td>
        <td>${this.formatMoney(item.monto)}</td>
        <td>${item.es_impulsivo ? 'Si' : 'No'}</td>
      </tr>
    `).join('');

    return `
      <section class="card table-card">
        <h3 class="comparison-title">Movimientos</h3>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Monto</th>
                <th>Impulsivo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  bindDashboardEvents() {
    document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('month-select').addEventListener('change', (event) => {
      const [year, month] = event.target.value.split('-').map(Number);
      this.currentYear = year;
      this.currentMonth = month;
      this.renderDashboard();
    });
    document.querySelectorAll('tbody tr').forEach((row) => {
      row.addEventListener('click', () => this.showMovementDetails(row.dataset.id));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') this.showMovementDetails(row.dataset.id);
      });
    });
  }

  changeMonth(delta) {
    const next = new Date(this.currentYear, this.currentMonth - 1 + delta, 1);
    this.currentYear = next.getFullYear();
    this.currentMonth = next.getMonth() + 1;
    this.renderDashboard();
  }

  showMovementDetails(id) {
    const movement = this.movimientos.find((item) => String(item.id) === String(id));
    if (!movement) return;

    document.getElementById('modal-root').innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <section class="modal-card">
          <h3 id="detail-title">Detalle del movimiento</h3>
          <div class="detail-list">
            <div><strong>Fecha</strong><span>${this.formatDate(movement.fecha)}</span></div>
            <div><strong>Tipo</strong><span>${this.escapeHtml(movement.tipo)}</span></div>
            <div><strong>Categoria</strong><span>${this.escapeHtml(movement.categoria)}</span></div>
            <div><strong>Monto</strong><span>${this.formatMoney(movement.monto)}</span></div>
            <div><strong>Impulsivo</strong><span>${movement.es_impulsivo ? 'Si' : 'No'}</span></div>
            <div><strong>Comentarios</strong><span>${this.escapeHtml(movement.comentarios || 'Sin comentarios')}</span></div>
          </div>
          <button class="button button-primary button-full" id="close-modal" type="button">Cerrar</button>
        </section>
      </div>
    `;
    document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
    document.querySelector('.modal').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) this.closeModal();
    });
  }

  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async loadData() {
    if (!navigator.onLine) {
      this.movimientos = this.getCachedMovements();
      this.categories = this.getCategoriesFromMovements(this.movimientos);
      return;
    }

    const { data, error } = await this.supabase
      .from('movimientos')
      .select('*')
      .eq('user_id', this.user.id)
      .order('fecha', { ascending: false });

    if (error) {
      showToast('No pudimos cargar tus movimientos.', 'error');
      return;
    }

    this.movimientos = data || [];
    localStorage.setItem(`movimientos_cache_${this.user.id}`, JSON.stringify(this.movimientos));
    await this.loadCategories();
  }

  async loadCategories() {
    const fromMovements = this.getCategoriesFromMovements(this.movimientos);
    const { data } = await this.supabase
      .from('categorias')
      .select('nombre')
      .eq('user_id', this.user.id);

    const fromTable = (data || []).map((item) => item.nombre);
    this.categories = [...new Set([...fromTable, ...fromMovements])].sort((a, b) => a.localeCompare(b));
  }

  async upsertCategory(nombre, tipo) {
    const exists = this.categories.some((category) => this.normalizeText(category) === this.normalizeText(nombre));
    if (exists) return;

    await this.supabase.from('categorias').insert({
      user_id: this.user.id,
      nombre,
      tipo,
      color: this.getColorForType(tipo)
    });
    this.categories.push(nombre);
    this.categories.sort((a, b) => a.localeCompare(b));
  }

  queuePendingMovement(payload) {
    const pending = JSON.parse(localStorage.getItem(this.pendingStorageKey) || '[]');
    pending.push({ ...payload, id: `local-${Date.now()}` });
    localStorage.setItem(this.pendingStorageKey, JSON.stringify(pending));
    this.movimientos = [pending[pending.length - 1], ...this.movimientos];
    localStorage.setItem(`movimientos_cache_${this.user.id}`, JSON.stringify(this.movimientos));
  }

  async syncPendingMovements() {
    if (!navigator.onLine) return;
    const pending = JSON.parse(localStorage.getItem(this.pendingStorageKey) || '[]');
    if (!pending.length) return;

    const payload = pending.map(({ id, ...item }) => item);
    const { error } = await this.supabase.from('movimientos').insert(payload);
    if (error) {
      showToast('Hay movimientos offline pendientes por sincronizar.', 'info');
      return;
    }

    localStorage.removeItem(this.pendingStorageKey);
    showToast('Movimientos offline sincronizados.', 'success');
  }

  calculateStats(monthMovements, yearlyMovements) {
    const monthExpenses = this.sumByType(monthMovements, 'Gasto');
    const monthIncome = this.sumByType(monthMovements, 'Ingreso');
    const yearExpenses = this.sumByType(yearlyMovements, 'Gasto');
    const monthlyAverage = yearExpenses / 12;
    const impulsiveExpenses = monthMovements
      .filter((item) => item.tipo === 'Gasto' && item.es_impulsivo)
      .reduce((sum, item) => sum + Number(item.monto), 0);
    const plannedExpenses = Math.max(0, monthExpenses - impulsiveExpenses);

    return {
      monthExpenses,
      monthIncome,
      yearExpenses,
      monthlyAverage,
      impulsiveExpenses,
      plannedExpenses,
      topCategory: this.getTopCategory(monthMovements),
      fastestGrowingCategory: this.getFastestGrowingCategory(),
      movementCount: monthMovements.length
    };
  }

  getFastestGrowingCategory() {
    const previous = new Date(this.currentYear, this.currentMonth - 2, 1);
    const currentExpenses = this.groupExpensesByCategory(this.getMovementsForMonth(this.currentYear, this.currentMonth));
    const previousExpenses = this.groupExpensesByCategory(this.getMovementsForMonth(previous.getFullYear(), previous.getMonth() + 1));
    let winner = '';
    let highestGrowth = 0;

    Object.keys(currentExpenses).forEach((category) => {
      const growth = currentExpenses[category] - (previousExpenses[category] || 0);
      if (growth > highestGrowth) {
        highestGrowth = growth;
        winner = category;
      }
    });

    return winner;
  }

  getTopCategory(movements) {
    const grouped = this.groupExpensesByCategory(movements);
    return Object.entries(grouped).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }

  groupExpensesByCategory(movements) {
    return movements
      .filter((item) => item.tipo === 'Gasto')
      .reduce((grouped, item) => {
        grouped[item.categoria] = (grouped[item.categoria] || 0) + Number(item.monto);
        return grouped;
      }, {});
  }

  getMovementsForMonth(year, month) {
    return this.movimientos.filter((item) => {
      const date = new Date(`${item.fecha}T00:00:00`);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }

  sumByType(movements, type) {
    return movements
      .filter((item) => item.tipo === type)
      .reduce((sum, item) => sum + Number(item.monto), 0);
  }

  renderMonthOptions() {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const value = `${this.currentYear}-${String(month).padStart(2, '0')}`;
      const selected = month === this.currentMonth ? 'selected' : '';
      return `<option value="${value}" ${selected}>${value}</option>`;
    }).join('');
  }

  getCachedMovements() {
    return JSON.parse(localStorage.getItem(`movimientos_cache_${this.user.id}`) || '[]');
  }

  getCategoriesFromMovements(movements) {
    return [...new Set(movements.map((item) => item.categoria).filter(Boolean))];
  }

  updateOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.toggle('hidden', navigator.onLine);
  }

  getFriendlyMonth(year, month) {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }

  formatMoney(value) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  toDateInputValue(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  getTypeClass(type) {
    const normalized = this.normalizeText(type);
    if (normalized === 'gasto') return 'type-gasto';
    if (normalized === 'ingreso') return 'type-ingreso';
    if (normalized === 'inversion') return 'type-inversion';
    return 'type-transferencia';
  }

  getColorForType(type) {
    const colors = {
      Gasto: '#ef4444',
      Ingreso: '#10b981',
      'Inversión': '#3b82f6',
      Transferencia: '#6b7280'
    };
    return colors[type] || '#667eea';
  }

  normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
