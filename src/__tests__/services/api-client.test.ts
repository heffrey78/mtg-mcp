import { ApiClient, TokenBucketRateLimiter, CircuitBreaker } from '../../services/api-client.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TokenBucketRateLimiter', () => {
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    rateLimiter = new TokenBucketRateLimiter(5, 2); // 5 requests per second, 2 concurrent
  });

  it('should allow requests within rate limit', () => {
    expect(rateLimiter.canMakeRequest()).toBe(true);
    expect(rateLimiter.canMakeRequest()).toBe(true);
  });

  it('should prevent requests when rate limit exceeded', () => {
    // Exhaust all tokens
    for (let i = 0; i < 5; i++) {
      if (rateLimiter.canMakeRequest()) {
        rateLimiter.recordRequest();
      }
    }
    
    expect(rateLimiter.canMakeRequest()).toBe(false);
  });

  it('should calculate delay correctly when rate limited', () => {
    // Create a limiter with fewer tokens to ensure exhaustion
    const limitedRateLimiter = new TokenBucketRateLimiter(1, 1); // 1 request per second
    
    // Use up the single token
    limitedRateLimiter.recordRequest();
    
    // Now check delay when no tokens are available
    const delay = limitedRateLimiter.getDelay();
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(1000); // Should be at most 1 second for 1 token
  });

  it('should enforce concurrent request limit', () => {
    expect(rateLimiter.canMakeRequest()).toBe(true);
    rateLimiter.recordRequest();
    
    expect(rateLimiter.canMakeRequest()).toBe(true);
    rateLimiter.recordRequest();
    
    // Third request should be blocked by concurrent limit
    expect(rateLimiter.canMakeRequest()).toBe(false);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000); // 3 failures, 1 second timeout
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should execute successful operations', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(operation);
    
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after failure threshold', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('fail'));
    
    // Trigger failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected failures
      }
    }
    
    expect(circuitBreaker.getState()).toBe('open');
  });

  it('should reject requests when open', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('fail'));
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected failures
      }
    }
    
    // Next request should be rejected immediately
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
  });
});

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock axios.create to return mocked axios instance
    mockedAxios.create.mockReturnValue(mockedAxios);
    
    // Mock interceptors
    mockedAxios.interceptors = {
      response: {
        use: jest.fn(),
      },
    } as any;

    apiClient = new ApiClient({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      retryAttempts: 2,
      retryDelayMs: 100,
      rateLimit: {
        requestsPerSecond: 10,
        maxConcurrent: 5,
      },
      cache: {
        ttl: 300,
        maxKeys: 100,
        persistentCache: {
          enabled: false, // Disable for tests
          cacheDir: './test-cache',
          maxFileAge: 86400000,
          compressionEnabled: false,
        },
      },
    });
  });

  it('should make successful GET request', async () => {
    const mockResponse = {
      data: { test: 'data' },
      headers: {},
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    const result = await apiClient.get('/test');
    
    expect(result.data).toEqual({ test: 'data' });
    expect(result.cached).toBe(false);
    expect(mockedAxios.get).toHaveBeenCalledWith('/test', undefined);
  });

  it('should cache GET responses', async () => {
    const mockResponse = {
      data: { test: 'data' },
      headers: {},
    };
    mockedAxios.get.mockResolvedValue(mockResponse);

    // First request
    const result1 = await apiClient.get('/test');
    expect(result1.cached).toBe(false);

    // Second request should be cached
    const result2 = await apiClient.get('/test');
    expect(result2.cached).toBe(true);
    expect(result2.data).toEqual({ test: 'data' });
    
    // Should only call axios once
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should handle API errors properly', async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
      message: 'Request failed',
    };
    mockedAxios.get.mockRejectedValue(error);

    await expect(apiClient.get('/test')).rejects.toThrow('API Error 404: Not found');
  });

  it('should retry failed requests', async () => {
    // First two calls fail, third succeeds
    mockedAxios.get
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ data: { test: 'data' }, headers: {} });

    const result = await apiClient.get('/test');
    
    expect(result.data).toEqual({ test: 'data' });
    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('should not retry client errors (4xx)', async () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { message: 'Bad request' },
      },
      message: 'Request failed',
    };
    mockedAxios.get.mockRejectedValue(error);

    await expect(apiClient.get('/test')).rejects.toThrow('API Error 400: Bad request');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retry
  });

  it('should provide cache statistics', async () => {
    const stats = await apiClient.getCacheStats();
    expect(stats).toHaveProperty('memory');
    expect(stats.memory).toHaveProperty('keys');
    expect(stats.memory).toHaveProperty('hits');
    expect(stats.memory).toHaveProperty('misses');
  });

  it('should clear cache', async () => {
    await expect(apiClient.clearCache()).resolves.not.toThrow();
  });
});