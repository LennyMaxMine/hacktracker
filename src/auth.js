import { auth } from './firebase.js'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'

function register() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      alert('Registered!')
    })
    .catch((error) => {
      alert(error.message)
    })
}

function login() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      alert('Logged in!')
    })
    .catch((error) => {
      alert(error.message)
    })
}

function logout() {
  signOut(auth).then(() => {
    alert('Logged out!')
  })
}

onAuthStateChanged(auth, (user) => {
  const status = document.getElementById('userStatus')
  if (user) {
    status.textContent = `Logged in as ${user.email}`
  } else {
    status.textContent = "Not logged in"
  }
})

window.register = register
window.login = login
window.logout = logout 