import axios from 'axios';
import useStore from '../store/useStore';

// API Base URL
const API_BASE_URL = 'https://sandbox.alfennzo.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = useStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - logout user
      await useStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (loginData) => {
    console.log(loginData,"login data")
    try {
      const response = await api.post('/restaurant/login', loginData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  logout: () => api.post('/restaurant/logout'),
};

export const ordersAPI = {
  getLiveOrders: () => api.get('/orders/live'),
  getOrderHistory: (page = 1) => api.get(`/orders/history?page=${page}`),
  acceptOrder: (orderId) => api.post(`/orders/${orderId}/accept`),
  updateOrderStatus: (orderId, status) => api.patch(`/orders/${orderId}/status`, { status }),
};

export default api;