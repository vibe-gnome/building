export interface SqlResult {
  results: Record<string, unknown>[];
  meta?: { changes?: number };
}
export type SqlQuery = (
  sql: string,
  params?: (string | number | null)[],
) => Promise<SqlResult>;

export function d1QueryFromEnv(): SqlQuery {
  const {
    CLOUDFLARE_ACCOUNT_ID: account,
    CLOUDFLARE_D1_DATABASE_ID: database,
    CLOUDFLARE_API_TOKEN: token,
  } = process.env;
  if (
    !account ||
    !/^[a-f0-9]{32}$/.test(account) ||
    !database ||
    !/^[a-f0-9-]{36}$/.test(database) ||
    !token
  ) {
    throw new Error(
      "Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN for catalog publication.",
    );
  }
  return async (sql, params = []) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      },
    );
    if (!response.ok)
      throw new Error(`D1 request failed (${response.status}).`);
    const data = (await response.json()) as {
      success?: boolean;
      result?: {
        success?: boolean;
        results: Record<string, unknown>[];
        meta?: { changes?: number };
      }[];
    };
    const result = data.result?.[0];
    if (!data.success || !result?.success || !Array.isArray(result.results))
      throw new Error("D1 query failed.");
    return result;
  };
}
