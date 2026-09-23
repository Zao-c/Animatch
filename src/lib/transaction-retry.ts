// PostgreSQL can abort a serializable transaction when another voter or tab writes
// concurrently. Retry the entire transaction; never retry arbitrary application errors.
export async function withTransactionRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}
