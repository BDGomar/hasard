import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
      meta: { guest: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { auth: true },
    },
    {
      path: '/jeu',
      name: 'game',
      component: () => import('../views/Game.vue'),
      meta: { auth: true },
    },
    {
      path: '/portefeuille',
      name: 'wallet',
      component: () => import('../views/Wallet.vue'),
      meta: { auth: true },
    },
    {
      path: '/parametres',
      name: 'settings',
      component: () => import('../views/Settings.vue'),
      meta: { auth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.token && !auth.user) {
    await auth.fetchUser()
  }

  if (to.meta.auth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

export default router
