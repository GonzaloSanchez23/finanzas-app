// Modulo de presupuestos: creacion simple, recurrencia hasta diciembre y CRUD basico.
class PresupuestosModule {
  constructor(app) {
    this.app = app;
    this.editingId = null;
  }

  render() {
    const editing = this.getEditingBudget();
    return `
      <section class="budget-layout fade-panel">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Control mensual</p>
              <h2>Presupuestos</h2>
            </div>
            <button class="button button-secondary" id="new-budget-btn" type="button">+ Crear Presupuesto</button>
          </div>
          ${this.renderBudgetList()}
        </div>

        <aside class="panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">${editing ? 'Editar' : 'Nuevo'}</p>
              <h2>${editing ? 'Editar presupuesto' : 'Crear presupuesto'}</h2>
            </div>
          </div>
          ${this.renderForm(editing)}
        </aside>
      </section>
    `;
  }

  bind() {
    document.getElementById('budget-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSave();
    });
    document.getElementById('new-budget-btn').addEventListener('click', () => {
      this.editingId = null;
      this.app.renderActiveTab();
    });
    document.querySelectorAll('.edit-budget').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingId = button.dataset.id;
        this.app.renderActiveTab();
      });
    });
    document.querySelectorAll('.delete-budget').forEach((button) => {
      button.addEventListener('click', () => this.deleteBudget(button.dataset.id));
    });
    document.getElementById('budget-recurring').addEventListener('change', (event) => {
      document.getElementById('recurring-note').classList.toggle('hidden', !event.target.checked);
    });
  }

  renderBudgetList() {
    if (!this.app.budgets.length) {
      return '<div class="empty-state">Aún no hay presupuestos. Crea el primero para comparar gastos contra límites.</div>';
    }

    return `
      <div class="budget-list">
        ${this.app.budgets.map((budget) => `
          <article class="budget-row">
            <div>
              <strong>${FinanceUtils.escapeHtml(budget.categoria)}</strong>
              <span>${FinanceUtils.getMonthName(this.getBudgetMonthNumber(budget), Number(budget.año))}</span>
            </div>
            <div class="budget-amount">${FinanceUtils.formatMoney(budget.monto_limite)}</div>
            <div class="row-actions">
              <button class="mini-action edit-budget" data-id="${budget.id}" type="button" title="Editar">✎</button>
              <button class="mini-action danger delete-budget" data-id="${budget.id}" type="button" title="Eliminar">×</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  renderForm(editing) {
    const selectedMonth = editing ? this.getBudgetMonthKey(editing) : FinanceUtils.getMonthKey(this.app.currentYear, this.app.currentMonth);
    return `
      <form id="budget-form" class="pro-form" novalidate>
        <div class="form-group">
          <label class="field-label" for="budget-category">Categoría</label>
          <select id="budget-category" required>
            <option value="">Selecciona...</option>
            ${this.getAllCategories().map((category) => `
              <option value="${FinanceUtils.escapeHtml(category)}" ${editing?.categoria === category ? 'selected' : ''}>${FinanceUtils.escapeHtml(category)}</option>
            `).join('')}
          </select>
          <span class="field-error" id="budget-category-error"></span>
        </div>

        <div class="form-group">
          <label class="field-label" for="budget-amount">Monto límite</label>
          <div class="money-input">
            <span>$</span>
            <input id="budget-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" value="${editing?.monto_limite || ''}" required>
          </div>
          <span class="field-error" id="budget-amount-error"></span>
        </div>

        <div class="form-group">
          <label class="field-label" for="budget-month">Mes</label>
          <select id="budget-month" required>
            ${FinanceUtils.buildMonthsForYear(this.app.currentYear).map((month) => `
              <option value="${month.value}" ${selectedMonth === month.value ? 'selected' : ''}>${month.label}</option>
            `).join('')}
          </select>
          <span class="field-error" id="budget-month-error"></span>
        </div>

        <label class="check-tile" for="budget-recurring">
          <input id="budget-recurring" type="checkbox" ${editing ? 'disabled' : ''}>
          <span>Presupuesto Recurrente</span>
          <small>Se repite cada mes restante del año</small>
        </label>
        <p class="form-note hidden" id="recurring-note">Se pedirá confirmación antes de crear presupuestos hasta diciembre.</p>

        <button class="button button-primary button-full button-tall" id="save-budget-btn" type="submit">${editing ? 'Guardar Cambios' : 'Crear Presupuesto'}</button>
      </form>
    `;
  }

  async handleSave() {
    const values = this.getValues();
    const errors = this.validate(values);
    this.renderErrors(errors);
    if (Object.keys(errors).length) {
      FinanceUtils.showToast('Completa los campos requeridos.', 'error');
      return;
    }

    if (this.editingId) {
      await this.saveEdit(values);
      return;
    }

    if (values.recurrente) {
      const body = `
        <p>¿Deseas aplicar este presupuesto de <strong>${FinanceUtils.formatMoney(values.monto_limite)}</strong> para <strong>${FinanceUtils.escapeHtml(values.categoria)}</strong> todos los meses restantes del año?</p>
        <p>Si continúa, se crea un presupuesto para cada mes hasta diciembre ${values.año}.</p>
      `;
      FinanceUtils.showModal({
        title: 'Presupuesto Recurrente',
        body,
        confirmText: 'Aceptar',
        onConfirm: () => this.createBudgets(values, true)
      });
      return;
    }

    await this.createBudgets(values, false);
  }

  async saveEdit(values) {
    this.setLoading(true);
    try {
      await this.app.api.updateBudget(this.editingId, {
        categoria: values.categoria,
        monto_limite: values.monto_limite,
        mes: values.mes,
        año: values.año
      });
      this.editingId = null;
      await this.app.refreshData(false);
      FinanceUtils.showToast('Presupuesto actualizado.', 'success');
      this.app.renderActiveTab();
    } catch (error) {
      console.error(error);
      FinanceUtils.showToast('No se pudo actualizar el presupuesto.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async createBudgets(values, recurrente) {
    this.setLoading(true);
    try {
      const budgets = recurrente ? this.buildRecurringBudgets(values) : [values];
      await this.app.api.createBudgets(budgets);
      await this.app.refreshData(false);
      FinanceUtils.showToast(recurrente ? 'Presupuestos recurrentes creados.' : 'Presupuesto creado.', 'success');
      this.app.renderActiveTab();
    } catch (error) {
      console.error(error);
      FinanceUtils.showToast('No se pudo crear el presupuesto.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async deleteBudget(id) {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    try {
      await this.app.api.deleteBudget(id);
      await this.app.refreshData(false);
      FinanceUtils.showToast('Presupuesto eliminado.', 'success');
      this.app.renderActiveTab();
    } catch (error) {
      console.error(error);
      FinanceUtils.showToast('No se pudo eliminar el presupuesto.', 'error');
    }
  }

  getValues() {
    const monthKey = document.getElementById('budget-month').value;
    const { year, month } = FinanceUtils.parseMonthKey(monthKey);
    return {
      categoria: document.getElementById('budget-category').value,
      monto_limite: Number(document.getElementById('budget-amount').value),
      mes: monthKey,
      año: year,
      monthNumber: month,
      recurrente: document.getElementById('budget-recurring').checked,
      es_recurrente: document.getElementById('budget-recurring').checked
    };
  }

  validate(values) {
    const errors = {};
    if (!values.categoria) errors.category = 'Este campo es requerido.';
    if (!values.monto_limite || Number.isNaN(values.monto_limite) || values.monto_limite <= 0) errors.amount = 'El monto debe ser mayor a cero.';
    if (!values.mes) errors.month = 'Este campo es requerido.';
    return errors;
  }

  renderErrors(errors) {
    document.getElementById('budget-category-error').textContent = errors.category || '';
    document.getElementById('budget-amount-error').textContent = errors.amount || '';
    document.getElementById('budget-month-error').textContent = errors.month || '';
    document.getElementById('budget-category').classList.toggle('is-invalid', Boolean(errors.category));
    document.getElementById('budget-amount').classList.toggle('is-invalid', Boolean(errors.amount));
    document.getElementById('budget-month').classList.toggle('is-invalid', Boolean(errors.month));
  }

  buildRecurringBudgets(values) {
    const budgets = [];
    for (let month = values.monthNumber; month <= 12; month += 1) {
      budgets.push({
        categoria: values.categoria,
        monto_limite: values.monto_limite,
        mes: FinanceUtils.getMonthKey(values.año, month),
        año: values.año,
        es_recurrente: true
      });
    }
    return budgets;
  }

  getAllCategories() {
    const defaults = Object.values(FinanceUtils.DEFAULT_CATEGORIES).flat();
    const custom = this.app.categories.map((item) => item.nombre || item.categoria || item);
    return [...new Set([...defaults, ...custom])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  getEditingBudget() {
    if (!this.editingId) return null;
    return this.app.budgets.find((budget) => String(budget.id) === String(this.editingId));
  }

  getBudgetMonthNumber(budget) {
    if (String(budget.mes).includes('-')) return FinanceUtils.parseMonthKey(budget.mes).month;
    return Number(budget.mes);
  }

  getBudgetMonthKey(budget) {
    if (String(budget.mes).includes('-')) return budget.mes;
    return FinanceUtils.getMonthKey(Number(budget.año), Number(budget.mes));
  }

  setLoading(isLoading) {
    const button = document.getElementById('save-budget-btn');
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = isLoading ? '<span class="loading-spinner"></span>Guardando...' : (this.editingId ? 'Guardar Cambios' : 'Crear Presupuesto');
  }
}

window.PresupuestosModule = PresupuestosModule;
