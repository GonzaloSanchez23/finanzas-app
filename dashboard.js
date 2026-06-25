// Dashboard avanzado: KPIs dinamicos, presupuestos, analisis y graficas Chart.js.
class DashboardModule {
  constructor(app) {
    this.app = app;
    this.filter = 'Todos';
    this.pieChart = null;
    this.trendChart = null;
  }

  render() {
    const movements = this.getFilteredMovements();
    const monthMovements = this.getMonthMovements(movements, this.app.currentYear, this.app.currentMonth);
    const yearMovements = movements.filter((item) => new Date(`${item.fecha}T00:00:00`).getFullYear() === this.app.currentYear);
    const stats = this.calculateStats(monthMovements, yearMovements);
    setTimeout(() => this.renderCharts(monthMovements), 0);

    return `
      <section class="dashboard fade-panel">
        <div class="panel dashboard-toolbar">
          <div>
            <p class="eyebrow">Resumen ejecutivo</p>
            <h2>Dashboard</h2>
          </div>
          <button class="button button-secondary" id="export-pdf-btn" type="button">Exportar PDF</button>
        </div>

        <div class="filter-bar" aria-label="Filtrar por tipo">
          ${['Todos', 'Gastos', 'Ingresos', 'Inversiones', 'Transferencias'].map((filter) => `
            <button class="filter-btn ${this.filter === filter ? 'active' : ''}" data-filter="${filter}" type="button">${filter}</button>
          `).join('')}
        </div>

        <div class="month-nav panel">
          <button class="button button-secondary" id="prev-month" type="button">&lt; Anterior</button>
          <strong>${FinanceUtils.getMonthName(this.app.currentMonth, this.app.currentYear)}</strong>
          <button class="button button-secondary" id="next-month" type="button" ${this.isCurrentMonth() ? 'disabled' : ''}>Siguiente &gt;</button>
        </div>

        <section class="kpi-container">
          ${this.renderKpi(stats.primaryLabel, stats.monthTotal, stats.typeColor)}
          ${this.renderKpi(stats.yearLabel, stats.yearTotal, stats.typeColor)}
          ${this.renderKpi('Promedio/Mes', stats.monthlyAverage, stats.typeColor)}
          ${this.renderTrendKpi(stats)}
        </section>

        ${this.renderBudgetsSection()}
        ${this.renderQuickAnalysis(monthMovements)}

        <section class="chart-grid">
          <article class="panel">
            <div class="panel-header compact">
              <div>
                <p class="eyebrow">Categorias</p>
                <h3>Distribucion del mes</h3>
              </div>
            </div>
            <div class="chart-box"><canvas id="category-pie"></canvas></div>
            <div id="pie-detail" class="pie-detail empty-detail">Toca una categoria para ver detalle.</div>
          </article>
          <article class="panel">
            <div class="panel-header compact">
              <div>
                <p class="eyebrow">Tendencia</p>
                <h3>Ultimos 6 meses</h3>
              </div>
            </div>
            <div class="chart-box"><canvas id="trend-line"></canvas></div>
          </article>
        </section>

        ${this.renderMovementsTable(monthMovements)}
      </section>
    `;
  }

  bind() {
    document.querySelectorAll('.filter-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.filter = button.dataset.filter;
        this.app.renderActiveTab();
      });
    });
    document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('export-pdf-btn').addEventListener('click', () => this.exportPdf());
    document.querySelectorAll('.movement-row').forEach((row) => {
      row.addEventListener('click', () => this.showMovementDetails(row.dataset.id));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') this.showMovementDetails(row.dataset.id);
      });
    });
  }

  renderKpi(label, value, color) {
    return `
      <article class="kpi-card" style="--accent: ${color}">
        <span>${label}</span>
        <strong>${FinanceUtils.formatMoney(value)}</strong>
      </article>
    `;
  }

  renderTrendKpi(stats) {
    const className = stats.difference > 0 ? 'trend-up' : stats.difference < 0 ? 'trend-down' : 'trend-flat';
    const arrow = stats.difference > 0 ? '↑' : stats.difference < 0 ? '↓' : '→';
    const label = stats.monthlyAverage > 0
      ? `${arrow} ${Math.abs(stats.difference).toFixed(0)}% ${stats.difference > 0 ? 'arriba' : stats.difference < 0 ? 'abajo' : 'en linea'}`
      : 'Sin promedio';
    return `
      <article class="kpi-card" style="--accent: ${stats.typeColor}">
        <span>% vs Promedio</span>
        <strong class="${className}">${label}</strong>
      </article>
    `;
  }

  renderBudgetsSection() {
    if (!['Todos', 'Gastos'].includes(this.filter) || !this.app.budgets.length) return '';
    const currentBudgets = this.getCurrentBudgets();
    if (!currentBudgets.length) return '';

    return `
      <section class="panel budget-comparison">
        <div class="panel-header compact">
          <div>
            <p class="eyebrow">Control de limites</p>
            <h3>Gastos vs Presupuestos (${FinanceUtils.getMonthName(this.app.currentMonth, this.app.currentYear)})</h3>
          </div>
        </div>
        <div class="budget-bars">
          ${currentBudgets.map((budget) => this.renderBudgetBar(budget)).join('')}
        </div>
      </section>
    `;
  }

  renderBudgetBar(budget) {
    const spent = this.getSpentForCategory(budget.categoria);
    const limit = Number(budget.monto_limite) || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;
    const capped = Math.min(100, percent);
    const status = percent >= 100 ? { label: 'Excedido', className: 'danger' }
      : percent >= 80 ? { label: 'Limite', className: 'warning' }
      : { label: 'Bien', className: 'success' };

    return `
      <article class="budget-bar ${status.className}">
        <div class="budget-bar-top">
          <strong>${FinanceUtils.escapeHtml(budget.categoria)}</strong>
          <span>${FinanceUtils.formatMoney(spent)} / ${FinanceUtils.formatMoney(limit)} (${percent.toFixed(0)}%)</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width: ${capped}%"></div></div>
        <small>${status.label}</small>
      </article>
    `;
  }

  renderQuickAnalysis(monthMovements) {
    const expenses = monthMovements.filter((item) => item.tipo === 'Gasto');
    const totalExpenses = this.sum(expenses);
    const impulsive = this.sum(expenses.filter((item) => item.es_impulsivo));
    const planned = Math.max(0, totalExpenses - impulsive);
    const top = this.getTopCategory(expenses);
    const impulsivePct = totalExpenses ? (impulsive / totalExpenses) * 100 : 0;
    const plannedPct = totalExpenses ? (planned / totalExpenses) * 100 : 0;

    return `
      <section class="analysis-grid">
        <article class="panel analysis-card">
          <p class="eyebrow">Comportamiento</p>
          <h3>Impulsivos vs Planificados</h3>
          <div class="analysis-lines">
            <div><span>Impulsivos</span><strong class="trend-up">${FinanceUtils.formatMoney(impulsive)} (${impulsivePct.toFixed(0)}%)</strong></div>
            <div><span>Planificados</span><strong class="trend-down">${FinanceUtils.formatMoney(planned)} (${plannedPct.toFixed(0)}%)</strong></div>
            <div><span>Total</span><strong>${FinanceUtils.formatMoney(totalExpenses)}</strong></div>
          </div>
        </article>
        <article class="panel analysis-card">
          <p class="eyebrow">Concentracion</p>
          <h3>Mayor Categoria</h3>
          <strong class="big-stat">${FinanceUtils.escapeHtml(top.category || 'Sin datos')}</strong>
          <span>${top.category ? `${FinanceUtils.formatMoney(top.amount)} (${top.percent.toFixed(0)}% de gastos)` : 'Registra gastos para ver resultados'}</span>
        </article>
      </section>
    `;
  }

  renderMovementsTable(monthMovements) {
    const latest = [...monthMovements]
      .sort((a, b) => new Date(`${b.fecha}T00:00:00`) - new Date(`${a.fecha}T00:00:00`))
      .slice(0, 10);

    if (!latest.length) {
      return '<section class="panel"><h3>Ultimos 10 movimientos</h3><div class="empty-state">No hay movimientos este mes.</div></section>';
    }

    return `
      <section class="panel">
        <div class="panel-header compact">
          <div>
            <p class="eyebrow">Actividad reciente</p>
            <h3>Ultimos 10 movimientos</h3>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Monto</th>
                <th>Fijo?</th>
              </tr>
            </thead>
            <tbody>
              ${latest.map((item) => `
                <tr class="movement-row" data-id="${item.id || ''}" tabindex="0">
                  <td data-label="Fecha">${FinanceUtils.formatDate(item.fecha, { day: '2-digit', month: 'long' })}</td>
                  <td data-label="Tipo"><span class="type-pill ${FinanceUtils.getTypeClass(item.tipo)}">${FinanceUtils.escapeHtml(item.tipo)}</span></td>
                  <td data-label="Categoria">${FinanceUtils.escapeHtml(item.categoria)}</td>
                  <td data-label="Monto">${FinanceUtils.formatMoney(item.monto)}</td>
                  <td data-label="Fijo">${this.isFixed(item) ? 'Si' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  renderCharts(monthMovements) {
    this.destroyCharts();
    this.renderPieChart(monthMovements);
    this.renderTrendChart();
  }

  renderPieChart(monthMovements) {
    const canvas = document.getElementById('category-pie');
    if (!canvas || !window.Chart) return;
    const expenses = monthMovements.filter((item) => item.tipo === 'Gasto');
    const grouped = this.groupByCategory(expenses);
    const labels = Object.keys(grouped);
    const values = Object.values(grouped);
    const total = values.reduce((sum, value) => sum + value, 0);

    if (!labels.length) {
      canvas.closest('.chart-box').innerHTML = '<div class="empty-state">Sin gastos para graficar.</div>';
      return;
    }

    this.pieChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#1a365d', '#2d5016', '#dc2626', '#2563eb', '#7c3aed', '#f59e0b', '#10b981']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          this.updatePieDetail(labels[index], values[index], total, expenses);
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${FinanceUtils.formatMoney(ctx.raw)}` } }
        }
      }
    });
  }

  updatePieDetail(category, amount, total, expenses) {
    const target = document.getElementById('pie-detail');
    if (!target) return;
    const movements = expenses.filter((item) => FinanceUtils.normalize(item.categoria) === FinanceUtils.normalize(category));
    const percent = total ? (amount / total) * 100 : 0;
    target.classList.remove('empty-detail');
    target.innerHTML = `
      <strong>${FinanceUtils.escapeHtml(category)}</strong>
      <div><span>Monto</span><b>${FinanceUtils.formatMoney(amount)}</b></div>
      <div><span>Porcentaje</span><b>${percent.toFixed(0)}% del total</b></div>
      <div><span>Movimientos</span><b>${movements.length}</b></div>
    `;
  }

  renderTrendChart() {
    const canvas = document.getElementById('trend-line');
    if (!canvas || !window.Chart) return;
    const points = this.getTrendPoints();
    const average = points.reduce((sum, point) => sum + point.value, 0) / (points.length || 1);

    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: 'Gastos',
            data: points.map((point) => point.value),
            borderColor: FinanceUtils.COLORS.gasto,
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            fill: true,
            tension: 0.35
          },
          {
            label: 'Promedio',
            data: points.map(() => average),
            borderColor: FinanceUtils.COLORS.muted,
            borderDash: [6, 6],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { ticks: { callback: (value) => FinanceUtils.formatMoney(value) } }
        }
      }
    });
  }

  destroyCharts() {
    if (this.pieChart) this.pieChart.destroy();
    if (this.trendChart) this.trendChart.destroy();
  }

  exportPdf() {
    document.body.classList.add('printing-report');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-report');
    }, 100);
  }

  showMovementDetails(id) {
    const movement = this.app.movements.find((item) => String(item.id) === String(id));
    if (!movement) return;
    FinanceUtils.showModal({
      title: 'Detalle del movimiento',
      body: `
        <div class="detail-list">
          <div><strong>Fecha</strong><span>${FinanceUtils.formatDate(movement.fecha)}</span></div>
          <div><strong>Tipo</strong><span>${FinanceUtils.escapeHtml(movement.tipo)}</span></div>
          <div><strong>Categoria</strong><span>${FinanceUtils.escapeHtml(movement.categoria)}</span></div>
          <div><strong>Metodo</strong><span>${FinanceUtils.escapeHtml(movement.metodo_pago || this.parseMethod(movement) || '-')}</span></div>
          <div><strong>Monto</strong><span>${FinanceUtils.formatMoney(movement.monto)}</span></div>
          <div><strong>Fijo</strong><span>${this.isFixed(movement) ? 'Si' : 'No'}</span></div>
        </div>
      `,
      confirmText: 'Cerrar',
      cancelText: 'Cerrar'
    });
    const cancel = document.getElementById('modal-cancel');
    if (cancel) cancel.classList.add('hidden');
  }

  changeMonth(delta) {
    const next = new Date(this.app.currentYear, this.app.currentMonth - 1 + delta, 1);
    const today = new Date();
    if (next > new Date(today.getFullYear(), today.getMonth(), 1)) return;
    this.app.currentYear = next.getFullYear();
    this.app.currentMonth = next.getMonth() + 1;
    this.app.renderActiveTab();
  }

  calculateStats(monthMovements, yearMovements) {
    const typeLabel = this.filter === 'Todos' ? 'Total' : this.filter;
    const typeColor = this.getFilterColor();
    const monthTotal = this.sum(monthMovements);
    const yearTotal = this.sum(yearMovements);
    const monthlyAverage = yearTotal / 12;
    const difference = monthlyAverage > 0 ? ((monthTotal - monthlyAverage) / monthlyAverage) * 100 : 0;
    return {
      primaryLabel: `${typeLabel} del Mes`,
      yearLabel: `${typeLabel} del Año`,
      monthTotal,
      yearTotal,
      monthlyAverage,
      difference,
      typeColor
    };
  }

  getFilteredMovements() {
    const typeMap = {
      Gastos: 'Gasto',
      Ingresos: 'Ingreso',
      Inversiones: 'Inversión',
      Transferencias: 'Transferencia'
    };
    const type = typeMap[this.filter];
    if (!type) return this.app.movements;
    return this.app.movements.filter((item) => FinanceUtils.normalize(item.tipo) === FinanceUtils.normalize(type));
  }

  getMonthMovements(movements, year, month) {
    return movements.filter((item) => {
      const date = new Date(`${item.fecha}T00:00:00`);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }

  getCurrentBudgets() {
    const monthKey = FinanceUtils.getMonthKey(this.app.currentYear, this.app.currentMonth);
    return this.app.budgets.filter((budget) => {
      if (String(budget.mes).includes('-')) return budget.mes === monthKey;
      return Number(budget.año) === this.app.currentYear && Number(budget.mes) === this.app.currentMonth;
    });
  }

  getSpentForCategory(category) {
    return this.getMonthMovements(this.app.movements, this.app.currentYear, this.app.currentMonth)
      .filter((item) => item.tipo === 'Gasto' && FinanceUtils.normalize(item.categoria) === FinanceUtils.normalize(category))
      .reduce((sum, item) => sum + Number(item.monto || 0), 0);
  }

  getTopCategory(expenses) {
    const grouped = this.groupByCategory(expenses);
    const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
    const [category, amount] = Object.entries(grouped).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    return { category, amount, percent: total ? (amount / total) * 100 : 0 };
  }

  groupByCategory(movements) {
    return movements.reduce((grouped, item) => {
      grouped[item.categoria] = (grouped[item.categoria] || 0) + Number(item.monto || 0);
      return grouped;
    }, {});
  }

  getTrendPoints() {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(this.app.currentYear, this.app.currentMonth - 6 + index, 1);
      const expenses = this.getMonthMovements(this.app.movements, date.getFullYear(), date.getMonth() + 1)
        .filter((item) => item.tipo === 'Gasto');
      return {
        label: FinanceUtils.getMonthName(date.getMonth() + 1, date.getFullYear()).replace(` ${date.getFullYear()}`, ''),
        value: this.sum(expenses)
      };
    });
  }

  sum(movements) {
    return movements.reduce((sum, item) => sum + Number(item.monto || 0), 0);
  }

  getFilterColor() {
    const colors = {
      Todos: FinanceUtils.COLORS.primary,
      Gastos: FinanceUtils.COLORS.gasto,
      Ingresos: FinanceUtils.COLORS.ingreso,
      Inversiones: FinanceUtils.COLORS.inversion,
      Transferencias: FinanceUtils.COLORS.transferencia
    };
    return colors[this.filter] || FinanceUtils.COLORS.primary;
  }

  isCurrentMonth() {
    const today = new Date();
    return this.app.currentYear === today.getFullYear() && this.app.currentMonth === today.getMonth() + 1;
  }

  isFixed(item) {
    if (typeof item.es_fijo === 'boolean') return item.es_fijo;
    return String(item.comentarios || '').toLowerCase().includes('fijo: si');
  }

  parseMethod(item) {
    const match = String(item.comentarios || '').match(/Metodo:\s*([^|]+)/i);
    return match?.[1]?.trim() || '';
  }
}

window.DashboardModule = DashboardModule;
