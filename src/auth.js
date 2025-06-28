import { auth, db } from './firebase.js'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

async function checkAdminStatus(email) {
  try {
    const adminDoc = await getDoc(doc(db, "admins", email))
    return adminDoc.exists() && adminDoc.data().isAdmin === true
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}

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

function updateSidebar(user, isAdmin) {
  const authItems = document.getElementById('authItems')
  if (!authItems) return
  
  let sidebarHTML = ''
  
  // Check if we're on the signin page to mark it as active
  const isSigninPage = window.location.pathname.includes('signin.html') || window.location.pathname.endsWith('signin.html')
  
  if (user) {
    // User is logged in - show account, add, my-events, and admin (if admin)
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'account.html\')">├── account.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'add.html\')">├── add.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'my-content.html\')">├── my-content.html</li>'
    
    if (isAdmin) {
      sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'admin.html\')">└── admin.html</li>'
    } else {
      // Change the last item to have └── if no admin
      sidebarHTML = sidebarHTML.replace(/├── my-content.html/, '└── my-content.html')
    }
  } else {
    // User is logged out - show signin (signin is already the current page)
    const activeClass = isSigninPage ? ' active' : ''
    sidebarHTML += `<li class="folder-item file html${activeClass}" onclick="navigateTo('signin.html')">└── signin.html</li>`
  }
  
  authItems.innerHTML = sidebarHTML
}

onAuthStateChanged(auth, async (user) => {
  const status = document.getElementById('userStatus')
  let isAdmin = false
  
  if (user) {
    status.textContent = `Logged in as ${user.email}`
    isAdmin = await checkAdminStatus(user.email)
  } else {
    status.textContent = "Not logged in"
  }
  
  updateSidebar(user, isAdmin)
})

window.register = register
window.login = login
window.logout = logout 