import Axios, { AxiosError, AxiosRequestConfig } from 'axios';

export interface BfinApiConfig {
  baseUrl?: string;
  token?: string;
  onTokenExpired?: () => void | Promise<void>;
  onUnauthorized?: () => void;
}

let config: BfinApiConfig = {
  baseUrl: 'http://localhost:3000/api/v1',
};

export const configureBfinApi = (newConfig: Partial<BfinApiConfig>) => {
  config = { ...config, ...newConfig };
};

export const getBfinApiConfig = (): BfinApiConfig => config;

export const customInstance = <T>(
  axiosConfig: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const source = Axios.CancelToken.source();

  const instance = Axios.create({
    baseURL: config.baseUrl,
  });

  // Request interceptor for auth token
  instance.interceptors.request.use(
    (requestConfig) => {
      if (config.token && requestConfig.headers) {
        requestConfig.headers.Authorization = `Bearer ${config.token}`;
      }
      return requestConfig;
    },
    (error: AxiosError) => Promise.reject(error)
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired or unauthorized
        if (config.onTokenExpired) {
          await config.onTokenExpired();
        }
        if (config.onUnauthorized) {
          config.onUnauthorized();
        }
      }
      return Promise.reject(error);
    }
  );

  const promise = instance({
    ...axiosConfig,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore - Add cancel method to promise
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

export default customInstance;
