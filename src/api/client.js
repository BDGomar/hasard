import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(localStorage.getItem('token'))
      localStorage.removeItem('token')
      if (hadToken && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default client

export async function initRecharge(amount) {
  const { data } = await client.post('/recharge/init', { amount })
  return data
}

export async function confirmRecharge(rechargeId) {
  const { data } = await client.get(`/recharge/${rechargeId}/confirm`)
  return data
}
