// Capa API: aisla Supabase y mantiene el resto de la app limpio.
class FinanceApi {
  constructor(supabaseClient, user) {
    this.supabase = supabaseClient;
    this.user = user;
  }

  async getProfile() {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) {
      console.warn('Perfil no disponible:', error);
      return null;
    }
    return data;
  }

  async upsertProfile(profile) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .upsert({
        user_id: this.user.id,
        first_name: profile.first_name,
        last_name: profile.last_name
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
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
    const parts = [
      payload.comentarios || '',
      `Metodo: ${payload.metodo_pago || 'Sin metodo'}`,
      `Fijo: ${payload.es_fijo ? 'Si' : 'No'}`
    ].filter(Boolean);
    return parts.join(' | ');
  }
}

window.FinanceApi = FinanceApi;
