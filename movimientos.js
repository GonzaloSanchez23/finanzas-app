// Modulo de registro de movimientos: captura rapida y mobile-first.
class MovimientosModule {
  constructor(app) {
    this.app = app;
    this.selectedType = 'Gasto';
    this.selectedCategory = '';
    this.selectedMethod = '';
    this.paymentMethods = this.loadPaymentMethods();
  }

  render() {
    return `
      <section class="panel fade-panel" aria-labelledby="movement-title">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Nuevo registro</p>
            <h2 id="movement-title">Movimientos</h2>
          </div>
        </div>

        <form id="movement-form" class="pro-form" novalidate>
          <div class="form-section">
            <label class="field-label">Tipo de movimiento</label>
            <div class="type-selector" id="type-selector">
              ${FinanceUtils.TYPES.map((type) => `
                <button class="type-button ${type.value === this.selectedType ? 'active' : ''}" style="--type-color: ${type.color}" data-type="${type.value}" type="button">
                  <span>${type.label}</span>
                </button>
              `).join('')}
            </div>
            <span class="field-error" id="tipo-error"></span>
          </div>

          <div class="form-grid compact-form-grid">
            ${this.renderSmartSelect({
              id: 'category',
              label: 'Categoría',
              placeholder: 'Escribe o busca categoría...',
              selected: this.selectedCategory,
              items: this.getCategoryOptions(),
              addLabel: '+ Nueva Categoría'
            })}

            ${this.renderSmartSelect({
              id: 'payment',
              label: 'Método de Pago',
              placeholder: 'Busca método...',
              selected: this.selectedMethod,
              items: this.paymentMethods,
              addLabel: '+ Nuevo Método'
            })}

            <div class="form-group">
              <label class="field-label" for="monto">Monto</label>
              <div class="money-input">
                <span>$</span>
                <input id="monto" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required>
              </div>
              <span class="field-error" id="monto-error"></span>
            </div>
          </div>

          <div class="checkbox-grid">
            <label class="check-tile" for="es-impulsivo">
              <input id="es-impulsivo" type="checkbox">
              <span>Gasto impulsivo</span>
              <small>No planeado</small>
            </label>
            <label class="check-tile" for="es-fijo">
              <input id="es-fijo" type="checkbox">
              <span>Gasto fijo</span>
              <small>Parte de rutina</small>
            </label>
          </div>

          <button class="button button-action button-full button-tall" id="save-movement-btn" type="submit">Guardar</button>
        </form>
      </section>
    `;
  }

  bind() {
    this.bindTypeSelector();
    this.bindSmartSelect('category');
    this.bindSmartSelect('payment');
    document.getElementById('movement-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveMovement();
    });
  }

  bindTypeSelector() {
    document.querySelectorAll('.type-button').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedType = button.dataset.type;
        this.selectedCategory = '';
        this.selectedMethod = '';
        this.app.renderActiveTab();
      });
    });
  }

  renderSmartSelect({ id, label, placeholder, selected, items, addLabel }) {
    const defaultSet = id === 'category'
      ? this.getDefaultCategorySet()
      : new Set(FinanceUtils.DEFAULT_PAYMENT_METHODS.map((method) => FinanceUtils.normalize(method)));
    return `
      <div class="form-group smart-select" data-smart="${id}">
        <div class="field-row">
          <label class="field-label" for="${id}-search">${label}</label>
          <button class="inline-add" id="${id}-add" type="button">${addLabel}</button>
        </div>
        <input id="${id}-search" type="text" autocomplete="off" placeholder="${placeholder}" value="${FinanceUtils.escapeHtml(selected)}">
        <input id="${id}-value" type="hidden" value="${FinanceUtils.escapeHtml(selected)}">
        <div class="select-list" id="${id}-list">
          ${items.map((item) => this.renderSelectItem(id, item, defaultSet.has(FinanceUtils.normalize(item)))).join('')}
        </div>
        <span class="field-error" id="${id}-error"></span>
      </div>
    `;
  }

  renderSelectItem(id, item, isDefault) {
    return `
      <div class="select-item" data-value="${FinanceUtils.escapeHtml(item)}">
        <button class="select-main" type="button">${FinanceUtils.escapeHtml(item)}</button>
        ${isDefault ? '' : `
          <div class="select-actions" aria-label="Acciones">
            <button class="mini-action edit-${id}" type="button" title="Editar">✎</button>
            <button class="mini-action danger delete-${id}" type="button" title="Eliminar">×</button>
          </div>
        `}
      </div>
    `;
  }

  bindSmartSelect(id) {
    const search = document.getElementById(`${id}-search`);
    const list = document.getElementById(`${id}-list`);
    const addButton = document.getElementById(`${id}-add`);

    search.addEventListener('input', () => this.filterSmartSelect(id));
    search.addEventListener('focus', () => list.classList.add('open'));
    document.addEventListener('click', (event) => {
      if (!event.target.closest(`[data-smart="${id}"]`)) list.classList.remove('open');
    });

    list.querySelectorAll('.select-main').forEach((button) => {
      button.addEventListener('click', () => this.selectValue(id, button.closest('.select-item').dataset.value));
    });
    list.querySelectorAll(`.edit-${id}`).forEach((button) => {
      button.addEventListener('click', () => this.editCustomValue(id, button.closest('.select-item').dataset.value));
    });
    list.querySelectorAll(`.delete-${id}`).forEach((button) => {
      button.addEventListener('click', () => this.deleteCustomValue(id, button.closest('.select-item').dataset.value));
    });
    addButton.addEventListener('click', () => this.addCustomValue(id));
  }

  filterSmartSelect(id) {
    const query = FinanceUtils.normalize(document.getElementById(`${id}-search`).value);
    document.querySelectorAll(`#${id}-list .select-item`).forEach((item) => {
      const visible = FinanceUtils.normalize(item.dataset.value).includes(query);
      item.classList.toggle('hidden', !visible);
    });
    document.getElementById(`${id}-list`).classList.add('open');
  }

  selectValue(id, value) {
    document.getElementById(`${id}-search`).value = value;
    document.getElementById(`${id}-value`).value = value;
    document.getElementById(`${id}-list`).classList.remove('open');
    if (id === 'category') this.selectedCategory = value;
    if (id === 'payment') this.selectedMethod = value;
  }

  async addCustomValue(id) {
    const searchValue = document.getElementById(`${id}-search`).value.trim();
    const value = prompt(id === 'category' ? 'Nueva categoría' : 'Nuevo método', searchValue || '');
    if (!value?.trim()) return;

    if (id === 'category') {
      await this.app.api.createCategory(value.trim(), this.selectedType);
      await this.app.refreshData(false);
      this.selectedCategory = value.trim();
    } else {
      this.paymentMethods = [...new Set([...this.paymentMethods, value.trim()])];
      this.savePaymentMethods();
      this.selectedMethod = value.trim();
    }

    FinanceUtils.showToast('Opción creada.', 'success');
    this.app.renderActiveTab();
  }

  async editCustomValue(id, oldValue) {
    const newValue = prompt('Editar nombre', oldValue);
    if (!newValue?.trim() || newValue.trim() === oldValue) return;

    if (id === 'category') {
      await this.app.api.renameCategory(oldValue, newValue.trim());
      await this.app.refreshData(false);
      if (this.selectedCategory === oldValue) this.selectedCategory = newValue.trim();
    } else {
      this.paymentMethods = this.paymentMethods.map((item) => item === oldValue ? newValue.trim() : item);
      this.savePaymentMethods();
      if (this.selectedMethod === oldValue) this.selectedMethod = newValue.trim();
    }

    FinanceUtils.showToast('Opción actualizada.', 'success');
    this.app.renderActiveTab();
  }

  async deleteCustomValue(id, value) {
    const confirmed = confirm(`¿Eliminar "${value}"?`);
    if (!confirmed) return;

    if (id === 'category') {
      await this.app.api.deleteCategory(value);
      await this.app.refreshData(false);
      if (this.selectedCategory === value) this.selectedCategory = '';
    } else {
      this.paymentMethods = this.paymentMethods.filter((item) => item !== value);
      this.savePaymentMethods();
      if (this.selectedMethod === value) this.selectedMethod = '';
    }

    FinanceUtils.showToast('Opción eliminada.', 'success');
    this.app.renderActiveTab();
  }

  async saveMovement() {
    const values = this.getValues();
    const errors = this.validate(values);
    this.renderErrors(errors);
    if (Object.keys(errors).length) {
      FinanceUtils.showToast('Completa los campos requeridos.', 'error');
      return;
    }

    this.setLoading(true);
    try {
      await this.app.api.insertMovement(values);
      if (!this.getCategoryOptions().some((item) => FinanceUtils.normalize(item) === FinanceUtils.normalize(values.categoria))) {
        await this.app.api.createCategory(values.categoria, values.tipo);
      }
      FinanceUtils.showToast('Movimiento guardado', 'success');
      await this.app.refreshData(false);
      this.resetForm();
    } catch (error) {
      console.error(error);
      FinanceUtils.showToast('No se pudo guardar el movimiento.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  getValues() {
    return {
      tipo: this.selectedType,
      categoria: document.getElementById('category-value').value.trim(),
      metodo_pago: document.getElementById('payment-value').value.trim(),
      monto: Number(document.getElementById('monto').value),
      fecha: FinanceUtils.toDateInputValue(new Date()),
      es_impulsivo: document.getElementById('es-impulsivo').checked,
      es_fijo: document.getElementById('es-fijo').checked,
      comentarios: ''
    };
  }

  validate(values) {
    const errors = {};
    if (!values.tipo) errors.tipo = 'Este campo es requerido.';
    if (!values.categoria) errors.category = 'Este campo es requerido.';
    if (!values.metodo_pago) errors.payment = 'Este campo es requerido.';
    if (!values.monto || Number.isNaN(values.monto) || values.monto <= 0) errors.monto = 'El monto debe ser mayor a cero.';
    return errors;
  }

  renderErrors(errors) {
    ['tipo', 'category', 'payment', 'monto'].forEach((field) => {
      const errorEl = document.getElementById(`${field}-error`);
      if (errorEl) errorEl.textContent = errors[field] || '';
    });
    ['category', 'payment', 'monto'].forEach((field) => {
      const input = document.getElementById(field === 'monto' ? 'monto' : `${field}-search`);
      if (input) input.classList.toggle('is-invalid', Boolean(errors[field]));
    });
  }

  setLoading(isLoading) {
    const button = document.getElementById('save-movement-btn');
    button.disabled = isLoading;
    button.innerHTML = isLoading ? '<span class="loading-spinner"></span>Guardando...' : 'Guardar';
  }

  resetForm() {
    this.selectedCategory = '';
    this.selectedMethod = '';
    this.app.renderActiveTab();
  }

  getCategoryOptions() {
    const defaults = FinanceUtils.DEFAULT_CATEGORIES[this.selectedType] || [];
    const custom = this.app.categories
      .filter((item) => !item.tipo || FinanceUtils.normalize(item.tipo) === FinanceUtils.normalize(this.selectedType))
      .map((item) => item.nombre || item.categoria || item);
    return [...new Set([...defaults, ...custom])].filter(Boolean);
  }

  getDefaultCategorySet() {
    return new Set((FinanceUtils.DEFAULT_CATEGORIES[this.selectedType] || []).map((item) => FinanceUtils.normalize(item)));
  }

  loadPaymentMethods() {
    const key = `payment_methods_${this.app.user.id}`;
    const custom = JSON.parse(localStorage.getItem(key) || '[]');
    return [...new Set([...FinanceUtils.DEFAULT_PAYMENT_METHODS, ...custom])];
  }

  savePaymentMethods() {
    const custom = this.paymentMethods.filter((method) => !FinanceUtils.DEFAULT_PAYMENT_METHODS.includes(method));
    localStorage.setItem(`payment_methods_${this.app.user.id}`, JSON.stringify(custom));
  }
}

window.MovimientosModule = MovimientosModule;
