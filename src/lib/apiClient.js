import axios from 'axios';
import { logger } from '../services/loggerService';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach trace ID
apiClient.interceptors.request.use(
  (config) => {
    const traceId = logger.createTraceId();
    config.headers = config.headers || {};
    config.headers['X-Trace-Id'] = traceId;

    config.metadata = config.metadata || {};
    config.metadata.traceId = traceId;
    config.metadata.startTime = Date.now();

    return config;
  },
  (error) => {
    logger.log({
      level: 'error',
      message: `Request setup failure: ${error.message}`,
      stackTrace: error.stack,
      context: { error: error.message }
    });
    return Promise.reject(error);
  }
);

// Response Interceptor: Automatically log failed HTTP responses
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const config = error.config || {};
    const traceId = config.metadata?.traceId || logger.createTraceId();
    const url = config.url || '';
    const method = (config.method || 'GET').toUpperCase();
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const responseData = error.response ? error.response.data : null;

    logger.log({
      level: 'error',
      traceId,
      message: `API Error [${status}] on ${method} ${url}: ${error.message}`,
      stackTrace: error.stack || null,
      path: url,
      context: {
        status,
        method,
        url,
        requestData: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data) : null,
        responseData
      }
    });

    return Promise.reject(error);
  }
);

export default apiClient;
