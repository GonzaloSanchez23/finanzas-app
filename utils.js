// Utilidades compartidas para UI, formato, fechas y catalogos base.
const FinanceUtils = {
  COLORS: {
    primary: '#1a365d',
    secondary: '#2d5016',
    neutral: '#f5f7fa',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    gasto: '#dc2626',
    ingreso: '#16a34a',
    inversion: '#2563eb',
    transferencia: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444'
  },

  TYPES: [
    { value: 'Gasto', label: 'Gasto', color: '#dc2626' },
    { value: 'Ingreso', label: 'Ingreso', color: '#16a34a' },
    { value: 'Inversión', label: 'Inversión', color: '#2563eb' },
    { value: 'Transferencia', label: 'Transferencia', color: '#7c3aed' }
  ],

  DEFAULT_CATEGORIES: {
    Gasto: [
      'Super / Comida en casa',
      'Comida fuera',
      'Transporte',
      'Impuestos',
      'Viajes internacionales',
      'Viajes nacionales',
      'Educación',
      'Herramientas Trabajo',
      'Eventos / Networking',
      'Ropa',
      'Salud / bienestar',
      'Regalos / familia',
      'Otra'
    ],
    Ingreso: ['Salario', 'Freelance', 'Bonus', 'Reembolsos', 'Otro Ingreso'],
    'Inversión': ['GBM', 'Otra Inversión', 'Ahorro', 'CETES'],
    Transferencia: ['Renta', 'Crédito', 'Servicio Casa', 'Otro']
  },

  DEFAULT_PAYMENT_METHODS: ['AMEX', 'Santander', 'NU', 'Banamex', 'Efectivo', 'BBVA'],

  normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatMoney(value) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  },

  formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', options);
  },

  toDateInputValue(date = new Date()) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  },

  getMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  },

  parseMonthKey(monthKey) {
    const [year, month] = String(monthKey).split('-').map(Number);
    return { year, month };
  },

  getFriendlyMonth(year, month) {
    const date = new Date(year, month - 1, 1);
    const label = date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
    return label.replace('.', '');
  },

  buildMonthsForYear(year) {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        value: this.getMonthKey(year, month),
        label: this.getFriendlyMonth(year, month)
      };
    });
  },

  getTypeMeta(type) {
    return this.TYPES.find((item) => this.normalize(item.value) === this.normalize(type)) || this.TYPES[0];
  },

  getTypeClass(type) {
    const normalized = this.normalize(type);
    if (normalized === 'gasto') return 'type-gasto';
    if (normalized === 'ingreso') return 'type-ingreso';
    if (normalized === 'inversion') return 'type-inversion';
    return 'type-transferencia';
  },

  getUserDisplayName(user) {
    const metaName = user?.user_metadata?.full_name || user?.user_metadata?.name;
    if (metaName) return metaName;
    const localPart = String(user?.email || 'Usuario').split('@')[0];
    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Usuario';
  },

  getShortName(name) {
    const parts = String(name || 'Usuario').trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  },

  showToast(message, type = 'info') {
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
  },

  showModal({ title, body, confirmText = 'Aceptar', cancelText = 'Cancelar', onConfirm }) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <section class="modal-card">
          <h3 id="modal-title">${this.escapeHtml(title)}</h3>
          <div class="modal-body">${body}</div>
          <div class="modal-actions">
            <button class="button button-secondary" id="modal-cancel" type="button">${this.escapeHtml(cancelText)}</button>
            <button class="button button-primary" id="modal-confirm" type="button">${this.escapeHtml(confirmText)}</button>
          </div>
        </section>
      </div>
    `;
    document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-confirm').addEventListener('click', async () => {
      await onConfirm?.();
      this.closeModal();
    });
    document.querySelector('.modal').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) this.closeModal();
    });
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
  }
};

window.FinanceUtils = FinanceUtils;
window.showToast = (message, type = 'info') => FinanceUtils.showToast(message, type);
