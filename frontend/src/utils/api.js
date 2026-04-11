import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  registerOwner: (data) => api.post('/auth/register/owner', data),
  registerMember: (data) => api.post('/auth/register/member', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me')
};

// Members API
export const membersAPI = {
  getMembers: (ownerId) => api.get(`/members/gym/${ownerId}`),
  getMember: (memberId) => api.get(`/members/${memberId}`),
  updateMember: (memberId, data) => api.put(`/members/${memberId}`, data),
  updateMembership: (memberId, data) => api.post(`/members/${memberId}/membership`, data),
  deleteMember: (memberId) => api.delete(`/members/${memberId}`),
  getExpiringMembers: (ownerId) => api.get(`/members/gym/${ownerId}/expiring`),
  getInactiveMembers: (ownerId) => api.get(`/members/gym/${ownerId}/inactive`),
  changePassword: (memberId, data) => api.put(`/members/${memberId}/password`, data)
};

// Attendance API
export const attendanceAPI = {
  checkIn: (data) => api.post('/attendance/checkin', data),
  checkOut: (data) => api.post('/attendance/checkout', data),
  getMemberAttendance: (memberId, params) => api.get(`/attendance/member/${memberId}`, { params }),
  getGymAttendance: (ownerId, params) => api.get(`/attendance/gym/${ownerId}`, { params }),
  getAttendanceStats: (ownerId, params) => api.get(`/attendance/gym/${ownerId}/stats`, { params })
};

// Payments API
export const paymentsAPI = {
  createPayment: (data) => api.post('/payments', data),
  getUserPayments: (userId) => api.get(`/payments/user/${userId}`),
  getGymPayments: (ownerId) => api.get(`/payments/gym/${ownerId}`),
  processSubscription: (data) => api.post('/payments/subscription', data),
  getPaymentStats: (ownerId, params) => api.get(`/payments/gym/${ownerId}/stats`, { params })
};

// Visitors API
export const visitorsAPI = {
  addVisitor: (data) => api.post('/visitors', data),
  getVisitors: (ownerId, params) => api.get(`/visitors/gym/${ownerId}`, { params }),
  updateVisitor: (visitorId, data) => api.put(`/visitors/${visitorId}`, data),
  deleteVisitor: (visitorId) => api.delete(`/visitors/${visitorId}`)
};

// Notices API
export const noticesAPI = {
  createNotice: (data) => api.post('/notices', data),
  getNotices: (ownerId, params) => api.get(`/notices/gym/${ownerId}`, { params }),
  updateNotice: (noticeId, data) => api.put(`/notices/${noticeId}`, data),
  deleteNotice: (noticeId) => api.delete(`/notices/${noticeId}`)
};

// ── Calorie Tracker API ───────────────────────────────────────────────────
export const calorieAPI = {
  // Subscription
  startTrial:    ()     => api.post('/calorie/subscription/start-trial'),
  getStatus:     ()     => api.get('/calorie/subscription/status'),
  subscribe:     (data) => api.post('/calorie/subscription/subscribe', data),
  cancel:        ()     => api.post('/calorie/subscription/cancel'),
  // Razorpay
  createOrder:   ()     => api.post('/calorie/subscription/create-order'),
  verifyPayment: (data) => api.post('/calorie/subscription/verify-payment', data),

  // Foods
  searchFoods: (q, limit) => api.get('/calorie/foods/search', { params: { q, limit } }),
  popularFoods: ()        => api.get('/calorie/foods/popular'),
  getFood:     (id)       => api.get(`/calorie/foods/${id}`),

  // Meals
  logMeal:        (data)   => api.post('/calorie/meals/log', data),
  getTodayMeals:  ()       => api.get('/calorie/meals/today'),
  getMealsByDate: (date)   => api.get(`/calorie/meals/date/${date}`),
  deleteMeal:     (mealId) => api.delete(`/calorie/meals/${mealId}`),
  getWeeklySummary: ()     => api.get('/calorie/meals/summary/weekly'),

  // Saved Meals
  getSavedMeals:    ()        => api.get('/calorie/saved-meals'),
  createSavedMeal:  (data)    => api.post('/calorie/saved-meals', data),
  quickAddMeal:     (id, data) => api.post(`/calorie/saved-meals/quick-add/${id}`, data),
  deleteSavedMeal:  (id)      => api.delete(`/calorie/saved-meals/${id}`),

  // Water
  logWater:      (amount_ml) => api.post('/calorie/water/log', { amount_ml }),
  getTodayWater: ()          => api.get('/calorie/water/today'),

  // Settings
  getGoals:       ()     => api.get('/calorie/settings/goals'),
  saveGoals:      (data) => api.post('/calorie/settings/goals', data),
  getCheatDay:    ()     => api.get('/calorie/settings/cheat-day'),
  saveCheatDay:   (data) => api.post('/calorie/settings/cheat-day', data),
  isCheatDay:     ()     => api.get('/calorie/settings/is-cheat-day'),

  // Leaderboard
  getLeaderboard: ()  => api.get('/calorie/leaderboard/weekly'),
  calcLeaderboard: () => api.post('/calorie/leaderboard/calculate'),

  // Progress Photos
  getProgress:    ()          => api.get('/calorie/progress'),
  uploadProgress: (formData)  => api.post('/calorie/progress/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export default api;
