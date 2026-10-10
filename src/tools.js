import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'

document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
