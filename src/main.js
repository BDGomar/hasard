import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import { captureReferralCode } from './utils/referral'

// Un lien de parrainage (?ref=CODE) peut arriver sur n'importe quelle page :
// on le retient avant le montage de l'application.
captureReferralCode()

createApp(App).use(createPinia()).use(router).mount('#app')
