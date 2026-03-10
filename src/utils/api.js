import axios from 'axios';
import useStore from '../store/useStore';

const API_BASE_URL = 'https://sandbox.alfennzo.com/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = useStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) await useStore.getState().logout();
    return Promise.reject(error);
  }
);

export const authAPI = {
  login:  (loginData) => api.post('/restaurant/login', loginData),
  logout: ()          => api.post('/restaurant/logout'),
  getProfile: (restaurantId) =>
    api.get('/restaurant/zxwyqohytzecats/1bf370ed4805a68bc295ef2143484170:2788bb54abac0ace8e476fb92487add368d5eb895916312b94c900632c8c50e3:bd7a7d687e0765719b7d33c30e10ded8e032875e8888d383ca2ef898135aba17', {
      params: { restaurantId },
    }),
};

// ─── Base fetcher ─────────────────────────────────────────────────────────────
// filter is serialised to JSON and sent as a single query param so the backend
// can parse it consistently — matches how the web dashboard sends date ranges.
const fetchOrders = (Id, params, filter) =>
  api.get('/restaurant/getAllOrder', {
    params: {
      ...params,
      filter: JSON.stringify(filter),
      Id:     Id ? encodeURIComponent(Id) : '',
    },
    paramsSerializer: (p) => new URLSearchParams(p).toString(),
  });

export const ordersAPI = {

  // ── Original mixed fetcher (kept for backward compat) ──────────────────────
  getAllOrders: (params = {}, filter = {}, Id = '') =>
    fetchOrders(Id, params, filter),

  // ── Live: not accepted, not delivered, not cancelled ───────────────────────
  getLiveOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      AcceptOrder: false,
      isDelivered: false,
      isCancelled: false,
      ...extra,
    }),

  // ── Pending: accepted but not yet delivered / cancelled ────────────────────
  getPendingOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      AcceptOrder: true,
      isDelivered: false,
      isCancelled: false,
      ...extra,
    }),

  // ── History: delivered, with optional date range ───────────────────────────
  // extra = { startDate: ISO string, endDate: ISO string }
  // Spread into filter so backend receives it via JSON.parse(filter),
  // same format as the web dashboard's getTodayRange() call.
  getHistoryOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      isDelivered: true,
      ...extra,
    }),

  // ── Accept an order — payload: { OrderId, Id } ────────────────────────────
  acceptOrder: (data) =>
    api.post('/restaurant/AcceptOrder', data),

  // ── Mark order delivered — payload: { OrderId, Id } ──────────────────────
  deliverOrder: (data) =>
    api.post('/restaurant/updateDeliverStatus', data),

};

export default api;