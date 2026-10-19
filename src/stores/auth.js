import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import client from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function setSession(nextToken, nextUser) {
    token.value = nextToken
    user.value = nextUser
    if (nextToken) {
      localStorage.setItem('token', nextToken)
    } else {
      localStorage.removeItem('token')
    }
  }

  async function register(payload) {
    const { data } = await client.post('/register', payload)
    setSession(data.token, data.user)
  }

  async function login(payload) {
    const { data } = await client.post('/login', payload)
    setSession(data.token, data.user)
  }

  async function fetchUser() {
    if (!token.value) {
      user.value = null
      return
    }
    loading.value = true
    try {
      const { data } = await client.get('/user')
      user.value = data
    } catch {
      setSession(null, null)
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await client.post('/logout')
    } catch {
      // ignore
    }
    setSession(null, null)
  }

  function setUser(nextUser) {
    user.value = nextUser
  }

  return {
    user,
    token,
    loading,
    isAuthenticated,
    register,
    login,
    fetchUser,
    logout,
    setUser,
  }
})
