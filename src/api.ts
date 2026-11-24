// A minimal client for the three routes the bot reads: card search, one card,
// and its current quotes. No SDK dependency on purpose: the bot needs a fetch
// and an error type, and a copy you can read in one screen is easier to adapt
// than a package to keep in step.

export const DEFAULT_BASE_URL = 'https://api.alltcgapi.com';
const TIMEOUT_MS = 10_000;

/** A card as the API writes it (GET /v1/cards, GET /v1/cards/{id}). */
export interface Card {
  readonly id: string;
  readonly game: string;
  readonly set: { readonly id: string; readonly code: string; readonly name: string };
  readonly number: string;
  readonly name: string;
  readonly rarity: string | null;
  readonly image_url: string | null;
}

/** A current quote (GET /v1/cards/{id}/prices). Amount and currency always travel together. */
export interface Quote {
  readonly source: string;
  readonly variant: string;
  readonly language: string;
  readonly condition: string | null;
  readonly printing: string | null;
  readonly region: string | null;
  readonly price: { readonly amount: number; readonly currency: string };
  /** A day, `YYYY-MM-DD` in UTC. */
  readonly as_of: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds from Retry-After, on the 429s that reopen by waiting. */
  readonly retryAfter: number | undefined;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(`${code}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class Api {
  readonly baseUrl: string;
  readonly apiKey: string;

  constructor(baseUrl: string | undefined, apiKey: string) {
    this.baseUrl = (baseUrl === undefined || baseUrl === '' ? DEFAULT_BASE_URL : baseUrl).replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      // The API refuses an empty parameter like an unknown one: leave it out.
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const query = search.toString();
    const response = await fetch(`${this.baseUrl}${path}${query === '' ? '' : `?${query}`}`, {
      headers: { accept: 'application/json', 'x-api-key': this.apiKey, 'user-agent': 'alltcgapi-discord-bot' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      let message = response.statusText;
      try {
        const body = (await response.json()) as { error?: { code?: string; message?: string } };
        if (body.error?.code !== undefined) {
          code = body.error.code;
          message = body.error.message ?? message;
        }
      } catch {
        /* not our error envelope: keep the status */
      }
      const retry = Number(response.headers.get('retry-after') ?? '');
      throw new ApiError(response.status, code, message, response.headers.has('retry-after') && Number.isFinite(retry) ? retry : undefined);
    }
    return (await response.json()) as T;
  }

  /** Cards whose name starts with `name`, optionally in one game. One credit up to 50 rows. */
  async searchCards(name: string, game: string | undefined, limit: number): Promise<Card[]> {
    const body = await this.get<{ data: Card[] }>('/v1/cards', { name, game, limit });
    return body.data;
  }

  /** One card. One credit. */
  async card(id: string): Promise<Card> {
    return (await this.get<{ data: Card }>(`/v1/cards/${id}`)).data;
  }

  /** Every current quote of a card. Two credits. */
  async prices(id: string): Promise<Quote[]> {
    return (await this.get<{ data: Quote[] }>(`/v1/cards/${id}/prices`)).data;
  }
}
