import axios from 'axios';
import useStore from '../store/useStore';
const API_BASE_URL = 'https://sandbox.safeqr.in/api/v1';

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

const SKIP_AUTH_URLS = ['/restaurant/login', '/restaurant/logout', '/restaurant/updateFcmToken'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url ?? '';
    const is401 = error.response?.status === 401;
    const isAuthRoute = SKIP_AUTH_URLS.some((r) => url.includes(r));
    if (is401 && !isAuthRoute) {
      await useStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (loginData) => api.post('/restaurant/login', loginData),
  logout: () => {
    const deviceFingerprint = useStore.getState().deviceFingerprint ?? '';
    return api.post('/restaurant/logout', { deviceFingerprint });
  },
  getProfile: (restaurantId) =>
    api.get('/restaurant/zxwyqohytzecats/1bf370ed4805a68bc295ef2143484170:2788bb54abac0ace8e476fb92487add368d5eb895916312b94c900632c8c50e3:bd7a7d687e0765719b7d33c30e10ded8e032875e8888d383ca2ef898135aba17', {
      params: { restaurantId },
    }),
};

export const getLogedinDevices = async (data) => {
  const response = await api.post('/restaurant/get-device-sessions', data);
  return response.data;
};

export const logoutfromdevice = async (data) => {
  console.log(data,"device finger")
  const response = await api.post('/restaurant/logout-from-specific-device', data);
  return response.data;
};

export const restaurantAPI = {
  updateFcmToken: (data) => api.post('/restaurant/updateFcmToken', data),
};

const fetchOrders = (Id, params, filter) =>
  api.get('/restaurant/getAllOrder', {
    params: {
      ...params,
      filter: JSON.stringify(filter),
      Id: Id ? encodeURIComponent(Id) : '',
    },
    paramsSerializer: (p) => new URLSearchParams(p).toString(),
  });

export const ordersAPI = {
  getAllOrders: (params = {}, filter = {}, Id = '') =>
    fetchOrders(Id, params, filter),

  getLiveOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      AcceptOrder: false,
      isDelivered: false,
      isCancelled: false,
      ...extra,
    }),

  getPendingOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      AcceptOrder: true,
      isDelivered: false,
      isCancelled: false,
      ...extra,
    }),

  getHistoryOrders: (params = {}, Id = '', extra = {}) =>
    fetchOrders(Id, params, {
      isDelivered: true,
      ...extra,
    }),

  acceptOrder:  (data) => api.post('/restaurant/AcceptOrder', data),
  deliverOrder: (data) => api.post('/restaurant/updateDeliverStatus', data),
};

export const appVersionAPI = {
  getVersionList: (appType = 'PARTNER') =>
    api.get('/admin/appSettingList', { params: { app: appType } }),
};

export default api;