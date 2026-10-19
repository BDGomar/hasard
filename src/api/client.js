import axios from 'axios'

const client = axios.create({
  // En dev : serveur Laravel local. En production : même origine que le SPA
  // (fonctionne aussi bien sur un domaine que sur une IP, http ou https).
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api'),
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
  const { data } = await client.post('/recharge/init', {
    amount,
    // Origine du SPA : le backend s'en sert pour construire la return_url /
    // cancel_url LigdiCash et renvoyer le client sur *cette* application
    // (Vercel, domaine personnalisé, IP…) après le paiement.
    origin: window.location.origin,
  })
  return data
}

export async function confirmRecharge(rechargeId) {
  const { data } = await client.get(`/recharge/${rechargeId}/confirm`)
  return data
}
