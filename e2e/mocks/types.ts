export type MockApiResponse = {
  status?: number;
  body?: unknown;
  contentType?: string;
  headers?: Record<string, string>;
};

export type MockApiResolver = (url: URL, method: string) => MockApiResponse | null;
