// Capa API: aisla Supabase y permite compatibilidad con columnas que aun no existan.
class FinanceApi {
  constructor(supabaseClient, user) {
    this.supabase = supabaseClient;
    this.user = user;
  }

  async getMovements() {
    const { data, error } = await this.supabase
      .from('movimientos')
      .select('*')
      .eq('user_id', this.user.id)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async insertMovement(payload) {
    const fullPayload = { user_id: this.user.id, ...payload };
    const { error } = await this.supabase.from('movimientos').insert(fullPayload);
    if (!error) return;

    // Si la BD todavia no tiene metodo_pago o es_fijo, reintenta con el esquema inicial.
    if (this.isSchemaColumnError(error)) {
      const fallback = {
        user_id: this.user.id,
        tipo: payload.tipo,
        categoria: payload.categoria,
        monto: payload.monto,
        es_impulsivo: payload.es_impulsivo,
        comentarios: this.buildFallbackComment(payload),
        fecha: payload.fecha
      };
      const retry = await this.supabase.from('movimientos').insert(fallback);
      if (retry.error) throw retry.error;
      return;
    }

    throw error;
  }

  async getCategories() {
    const { data, error } = await this.supabase
      .from('categorias')
      .select('*')
      .eq('user_id', this.user.id);
    if (error) return [];
    return data || [];
  }

  async createCategory(nombre, tipo) {
    const { error } = await this.supabase.from('categorias').insert({
      user_id: this.user.id,
      nombre,
      tipo,
      color: FinanceUtils.getTypeMeta(tipo).color
    });
    if (error && !this.isDuplicateError(error)) throw error;
  }

  async renameCategory(oldName, newName) {
    const { error } = await this.supabase
      .from('categorias')
      .update({ nombre: newName })
      .eq('user_id', this.user.id)
      .eq('nombre', oldName);
    if (error) throw error;
  }

  async deleteCategory(nombre) {
    const { error } = await this.supabase
      .from('categorias')
      .delete()
      .eq('user_id', this.user.id)
      .eq('nombre', nombre);
    if (error) throw error;
  }

  async getBudgets() {
    const { data, error } = await this.supabase
      .from('presupuestos')
      .select('*')
      .eq('user_id', this.user.id)
      .order('año', { ascending: true })
      .order('mes', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createBudgets(budgets) {
    const payload = budgets.map((budget) => ({
      user_id: this.user.id,
      categoria: budget.categoria,
      monto_limite: budget.monto_limite,
      mes: budget.mes,
      año: budget.año,
      es_recurrente: budget.es_recurrente
    }));
    const { error } = await this.supabase.from('presupuestos').insert(payload);
    if (!error) return;

    if (this.isSchemaColumnError(error)) {
      const fallback = payload.map(({ es_recurrente, ...budget }) => budget);
      const retry = await this.supabase.from('presupuestos').insert(fallback);
      if (retry.error) throw retry.error;
      return;
    }

    throw error;
  }

  async updateBudget(id, budget) {
    const { error } = await this.supabase
      .from('presupuestos')
      .update(budget)
      .eq('user_id', this.user.id)
      .eq('id', id);
    if (error) throw error;
  }

  async deleteBudget(id) {
    const { error } = await this.supabase
      .from('presupuestos')
      .delete()
      .eq('user_id', this.user.id)
      .eq('id', id);
    if (error) throw error;
  }

  isSchemaColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('column') || message.includes('schema cache') || message.includes('could not find');
  }

  isDuplicateError(error) {
    return String(error?.code || '') === '23505';
  }

  buildFallbackComment(payload) {
    const note = payload.comentarios ? `${payload.comentarios}\n` : '';
    return `${note}Metodo: ${payload.metodo_pago || 'Sin metodo'} | Fijo: ${payload.es_fijo ? 'Si' : 'No'}`;
  }
}

window.FinanceApi = FinanceApi;
