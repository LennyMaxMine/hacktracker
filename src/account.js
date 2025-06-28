import { db, auth } from './firebase.js'
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, where } from 'firebase/firestore'
import { onAuthStateChanged, signOut as firebaseSignOut, deleteUser } from 'firebase/auth'

let currentUser = null
let userProfile = null

async function checkAdminStatus(email) {
  try {
    const adminDoc = await getDoc(doc(db, "admins", email))
    return adminDoc.exists() && adminDoc.data().isAdmin === true
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}

function updateSidebar(user, isAdmin) {
  const authItems = document.getElementById('authItems')
  if (!authItems) return
  
  let sidebarHTML = ''
  
  if (user) {
    sidebarHTML += '<li class="folder-item file html active" onclick="navigateTo(\'account.html\')">├── account.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'add.html\')">├── add.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'my-content.html\')">├── my-content.html</li>'
    
    if (isAdmin) {
      sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'admin.html\')">└── admin.html</li>'
    } else {
      sidebarHTML = sidebarHTML.replace(/├── my-content.html/, '└── my-content.html')
    }
  } else {
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'signin.html\')">└── signin.html</li>'
  }
  
  authItems.innerHTML = sidebarHTML
}

onAuthStateChanged(auth, async (user) => {
  const authCheck = document.getElementById("authCheck")
  const accountPanel = document.getElementById("accountPanel")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    accountPanel.style.display = 'none'
    updateSidebar(user, false)
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    const isAdmin = await checkAdminStatus(user.email)
    authCheck.style.display = 'none'
    accountPanel.style.display = 'block'
    updateSidebar(user, isAdmin)
    await loadUserProfile()
    await loadUserStats()
  }
})

async function loadUserProfile() {
  try {
    const profileDoc = await getDoc(doc(db, "profiles", currentUser.email))
    
    if (profileDoc.exists()) {
      userProfile = profileDoc.data()
    } else {
      userProfile = {
        email: currentUser.email,
        displayName: '',
        bio: '',
        website: '',
        location: '',
        github: '',
        createdAt: new Date().toISOString()
      }
    }
    
    displayProfile()
  } catch (error) {
    console.error("Error loading profile:", error)
    document.getElementById('profileInfo').innerHTML = '<div class="loading">Error loading profile</div>'
  }
}

function displayProfile() {
  const profileInfo = document.getElementById('profileInfo')
  
  profileInfo.innerHTML = `
    <div class="info-row">
      <span class="info-label">email:</span>
      <span class="info-value">"${userProfile.email}"</span>
    </div>
    <div class="info-row">
      <span class="info-label">displayName:</span>
      <span class="info-value">"${userProfile.displayName || 'Not set'}"</span>
    </div>
    <div class="info-row">
      <span class="info-label">bio:</span>
      <span class="info-value">"${userProfile.bio || 'No bio yet'}"</span>
    </div>
    <div class="info-row">
      <span class="info-label">website:</span>
      <span class="info-value">"${userProfile.website || 'null'}"</span>
    </div>
    <div class="info-row">
      <span class="info-label">location:</span>
      <span class="info-value">"${userProfile.location || 'null'}"</span>
    </div>
    <div class="info-row">
      <span class="info-label">github:</span>
      <span class="info-value">"${userProfile.github || 'null'}"</span>
    </div>
  `
}

async function loadUserStats() {
  try {
    const approvedQuery = query(collection(db, "events"), where("user", "==", currentUser.email))
    const pendingQuery = query(collection(db, "approve"), where("user", "==", currentUser.email))
    const rejectedQuery = query(collection(db, "rejected"), where("user", "==", currentUser.email))
    
    const [approvedSnapshot, pendingSnapshot, rejectedSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(pendingQuery),
      getDocs(rejectedQuery)
    ])
    
    const approvedCount = approvedSnapshot.size
    const pendingCount = pendingSnapshot.size
    const rejectedCount = rejectedSnapshot.size
    const totalCount = approvedCount + pendingCount + rejectedCount
    
    document.getElementById('totalEvents').textContent = totalCount
    document.getElementById('approvedEvents').textContent = approvedCount
    document.getElementById('pendingEvents').textContent = pendingCount
    
    const memberSince = userProfile.createdAt ? 
      new Date(userProfile.createdAt).getFullYear() : 
      new Date().getFullYear()
    document.getElementById('memberSince').textContent = memberSince
    
  } catch (error) {
    console.error("Error loading user stats:", error)
    document.getElementById('totalEvents').textContent = '-'
    document.getElementById('approvedEvents').textContent = '-'
    document.getElementById('pendingEvents').textContent = '-'
  }
}

function startEdit() {
  const profileInfo = document.getElementById('profileInfo')
  const editForm = document.getElementById('editForm')
  const editBtn = document.getElementById('editBtn')
  
  // Populate form with current values
  document.getElementById('displayName').value = userProfile.displayName || ''
  document.getElementById('bio').value = userProfile.bio || ''
  document.getElementById('website').value = userProfile.website || ''
  document.getElementById('location').value = userProfile.location || ''
  document.getElementById('github').value = userProfile.github || ''
  
  // Show form, hide profile info
  profileInfo.style.display = 'none'
  editForm.classList.add('active')
  editBtn.style.display = 'none'
}

function cancelEdit() {
  const profileInfo = document.getElementById('profileInfo')
  const editForm = document.getElementById('editForm')
  const editBtn = document.getElementById('editBtn')
  
  // Hide form, show profile info
  profileInfo.style.display = 'block'
  editForm.classList.remove('active')
  editBtn.style.display = 'inline-flex'
  
  // Reset form
  document.getElementById('profileForm').reset()
}

async function saveProfile(formData) {
  try {
    const updatedProfile = {
      ...userProfile,
      displayName: formData.displayName,
      bio: formData.bio,
      website: formData.website,
      location: formData.location,
      github: formData.github,
      updatedAt: new Date().toISOString()
    }
    
    await setDoc(doc(db, "profiles", currentUser.email), updatedProfile)
    userProfile = updatedProfile
    
    // Update display
    displayProfile()
    cancelEdit()
    
    alert('Profile updated successfully!')
    
  } catch (error) {
    console.error("Error saving profile:", error)
    alert('Failed to save profile. Please try again.')
  }
}

// Form submission handler
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const formData = {
    displayName: document.getElementById('displayName').value.trim(),
    bio: document.getElementById('bio').value.trim(),
    website: document.getElementById('website').value.trim(),
    location: document.getElementById('location').value.trim(),
    github: document.getElementById('github').value.trim()
  }
  
  await saveProfile(formData)
})

async function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      await firebaseSignOut(auth)
      window.location.href = 'index.html'
    } catch (error) {
      console.error("Error signing out:", error)
      alert('Error signing out. Please try again.')
    }
  }
}

async function deleteAccount() {
  const confirmMessage = `⚠️ WARNING: This action cannot be undone!

Deleting your account will permanently remove:
• Your profile information and bio
• All events you've submitted (approved, pending, and rejected)
• Your account statistics and history
• Your authentication credentials

Are you absolutely sure you want to delete your account?

Type "DELETE" to confirm:`

  const userInput = prompt(confirmMessage)
  
  if (userInput !== 'DELETE') {
    if (userInput !== null) {
      alert('Account deletion cancelled. You must type "DELETE" exactly to confirm.')
    }
    return
  }

  try {
    // Delete user profile from Firestore
    const profileRef = doc(db, "profiles", currentUser.email)
    await deleteDoc(profileRef)
    
    // Delete the user's authentication account
    await deleteUser(currentUser)
    
    alert('Your account has been permanently deleted. You will now be redirected to the main page.')
    window.location.href = 'index.html'
    
  } catch (error) {
    console.error("Error deleting account:", error)
    
    let errorMessage = 'Failed to delete account. '
    
    if (error.code === 'auth/requires-recent-login') {
      errorMessage += 'For security reasons, you need to sign in again before deleting your account. Please sign out, sign back in, and try again.'
    } else {
      errorMessage += 'Please try again or contact support if the problem persists.'
    }
    
    alert(errorMessage)
  }
}

// Global functions for HTML onclick handlers
window.startEdit = startEdit
window.cancelEdit = cancelEdit
window.signOut = signOut
window.deleteAccount = deleteAccount 