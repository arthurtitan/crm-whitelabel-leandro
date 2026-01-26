import { ServiceConfig, ServiceResponse, SERVICES } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/helpers';
import { ServiceUnavailableError } from '../utils/errors';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * HTTP client for inter-service communication
 */
export class ServiceClient {
  private baseUrl: string;
  private serviceName: string;
  private defaultTimeout: number;

  constructor(service: ServiceConfig, options?: { timeout?: number }) {
    const host = process.env.NODE_ENV === 'production' ? service.host : 'localhost';
    this.baseUrl = `http://${host}:${service.port}`;
    this.serviceName = service.name;
    this.defaultTimeout = options?.timeout || 5000;
  }

  /**
   * Make HTTP request to service
   */
  async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ServiceResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = this.defaultTimeout,
    } = options;

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            return {
              success: false,
              error: {
                code: error.error?.code || 'SERVICE_ERROR',
                message: error.error?.message || `Service error: ${res.status}`,
                details: error.error?.details,
              },
            } as ServiceResponse<T>;
          }

          const data = await res.json();
          return { success: true, data } as ServiceResponse<T>;
        },
        2, // Max retries
        500 // Base delay
      );

      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error({ service: this.serviceName, path }, 'Request timeout');
        throw new ServiceUnavailableError(this.serviceName);
      }

      logger.error({ error, service: this.serviceName, path }, 'Service request failed');
      throw new ServiceUnavailableError(this.serviceName);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>(path, { method: 'GET', headers });
  }

  async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>(path, { method: 'POST', body, headers });
  }

  async put<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>(path, { method: 'PUT', body, headers });
  }

  async patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>(path, { method: 'PATCH', body, headers });
  }

  async delete<T>(path: string, headers?: Record<string, string>): Promise<ServiceResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', headers });
  }
}

// Pre-configured service clients
export const authClient = new ServiceClient(SERVICES.AUTH);
export const userClient = new ServiceClient(SERVICES.USER);
export const contactClient = new ServiceClient(SERVICES.CONTACT);
export const salesClient = new ServiceClient(SERVICES.SALES);
export const kanbanClient = new ServiceClient(SERVICES.KANBAN);
export const analyticsClient = new ServiceClient(SERVICES.ANALYTICS);
export const calendarClient = new ServiceClient(SERVICES.CALENDAR);
export const eventClient = new ServiceClient(SERVICES.EVENT);
