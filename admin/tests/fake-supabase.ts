// Cliente de Supabase falso para probar SupabaseArtistRepository sin base de
// datos. No simula SQL: solo registra cada consulta que se arma (tabla +
// cadena de metodos) y devuelve la respuesta que la prueba prepare.
//
// La respuesta se busca por "<tabla>:<primer metodo>", por ejemplo
// "artists:select", "artist_links:upsert" o "artists:update".

import type { SupabaseClient } from '@supabase/supabase-js';

export type DbResult = { data?: unknown; error?: { code?: string; message: string } | null };
export type Call = { table: string; ops: Array<{ method: string; args: unknown[] }> };

export const fakeSupabase = (responses: Record<string, DbResult | ((call: Call) => DbResult)> = {}) => {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);

      const builder: unknown = new Proxy({}, {
        get(_target, property) {
          // Al hacer `await builder` se resuelve la respuesta preparada.
          if (property === 'then') {
            return (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) => {
              const key = `${table}:${call.ops[0]?.method}`;
              const response = responses[key] ?? { data: null, error: null };
              const result = typeof response === 'function' ? response(call) : response;
              return Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
            };
          }
          return (...args: unknown[]) => {
            call.ops.push({ method: String(property), args });
            return builder;
          };
        }
      });

      return builder;
    }
  };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    // Consultas hechas a una tabla, en orden.
    on: (table: string) => calls.filter(call => call.table === table),
    // Nombres de los metodos de una consulta, en orden: ['select', 'order', ...].
    methods: (call: Call) => call.ops.map(op => op.method)
  };
};
