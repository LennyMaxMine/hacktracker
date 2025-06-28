import { db, auth } from './firebase.js'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

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
    // User is logged in - show account, add, my-content (current page), and admin (if admin)
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'account.html\')">├── account.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'add.html\')">├── add.html</li>'
    sidebarHTML += '<li class="folder-item file html active" onclick="navigateTo(\'my-content.html\')">├── my-content.html</li>'
    
    if (isAdmin) {
      sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'admin.html\')">└── admin.html</li>'
    } else {
      // Change the last item to have └── if no admin (my-content is already the current page)
      sidebarHTML = sidebarHTML.replace(/├── add.html/, '└── add.html')
    }
  } else {
    // User is logged out - show signin
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'signin.html\')">└── signin.html</li>'
  }
  
  authItems.innerHTML = sidebarHTML
}

const eventContainer = document.getElementById("eventContainer")
const organizationContainer = document.getElementById("organizationContainer")

let currentUser = null
let currentContentType = 'events' // 'events' or 'organizations'

onAuthStateChanged(auth, async (user) => {
  const authCheck = document.getElementById("authCheck")
  const myContentPanel = document.getElementById("myContentPanel")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    myContentPanel.style.display = 'none'
    updateSidebar(user, false)
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    const isAdmin = await checkAdminStatus(user.email)
    authCheck.style.display = 'none'
    myContentPanel.style.display = 'block'
    updateSidebar(user, isAdmin)
    loadUserEvents()
    loadUserOrganizations()
  }
})

async function loadUserEvents() {
  if (!currentUser) return
  
  eventContainer.innerHTML = 'Loading...'
  
  try {
    const approvedQuery = query(collection(db, "events"), where("user", "==", currentUser.email))
    const pendingQuery = query(collection(db, "approve"), where("user", "==", currentUser.email))
    const rejectedQuery = query(collection(db, "rejected"), where("user", "==", currentUser.email))
    
    const [approvedSnapshot, pendingSnapshot, rejectedSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(pendingQuery),
      getDocs(rejectedQuery)
    ])
    
    const events = []
    
    approvedSnapshot.forEach(docSnapshot => {
      events.push({ 
        id: docSnapshot.id, 
        status: 'approved',
        ...docSnapshot.data() 
      })
    })
    
    pendingSnapshot.forEach(docSnapshot => {
      events.push({ 
        id: docSnapshot.id, 
        status: 'pending',
        ...docSnapshot.data() 
      })
    })
    
    rejectedSnapshot.forEach(docSnapshot => {
      events.push({ 
        id: docSnapshot.id, 
        status: 'rejected',
        ...docSnapshot.data() 
      })
    })
    
    displayEvents(events)
    
  } catch (error) {
    console.error("Error loading user events:", error)
    eventContainer.innerHTML = '<p>Failed to load your events.</p>'
  }
}

function displayEvents(events) {
  eventContainer.innerHTML = ''
  
  if (events.length === 0) {
    eventContainer.innerHTML = '<p>You haven\'t submitted any events yet. <a href="add.html">Add your first event!</a></p>'
    return
  }
  
  events.sort((a, b) => {
    const dateA = new Date(a.startDate)
    const dateB = new Date(b.startDate)
    return dateB - dateA
  })
  
  events.forEach(event => {
    if (event.participants === 0) {
      event.participants = "N/A"
    }

    const card = document.createElement("div")
    card.className = "event-card"
    
    let statusBadge = ''
    if (event.status === 'approved') {
      statusBadge = '<span class="status-badge approved">✅ APPROVED</span>'
    } else if (event.status === 'pending') {
      statusBadge = '<span class="status-badge pending">⏳ PENDING APPROVAL</span>'
    } else if (event.status === 'rejected') {
      statusBadge = '<span class="status-badge rejected">❌ REJECTED</span>'
    }
    
    const tagsHtml = event.tags && event.tags.length > 0 ? `
      <div class="event-tags">
        ${event.tags.map(tag => `<span class="event-tag">#${tag.name}</span>`).join('')}
      </div>
    ` : ''
    
    card.innerHTML = `
      <img src="${event.image}" alt="${event.name}" class="event-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0xODcuNSA5Ny41QzE4Ny41IDEwMS42NDIgMTg0LjE0MiAxMDUgMTgwIDEwNUMxNzUuODU4IDEwNSAxNzIuNSAxMDEuNjQyIDE3Mi41IDk3LjVDMTcyLjUgOTMuMzU4IDE3NS44NTggOTAgMTgwIDkwQzE4NC4xNDIgOTAgMTg3LjUgOTMuMzU4IDE4Ny41IDk3LjVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0yMjUgMTEyLjVMMjE1IDEwMkwyMDUgMTEyLjVIMjI1WiIgZmlsbD0iI0RFRTJFNiIvPgo8dGV4dCB4PSIyMDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTFBN0IxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pgo8L3N2Zz4K';">
      <div class="event-content">
        <h2 class="event-title">${event.name}${statusBadge}</h2>
        <div class="event-organization">${event.organization}</div>
        <div class="event-date">📅 ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</div>
        <div class="event-location">📍 ${event.location}</div>
        ${tagsHtml}
        <div class="event-description">${event.description}</div>
        <div class="event-meta">
          <span class="event-participants">👥 ${event.participants} participants</span>
          <span>Status: ${event.status.toUpperCase()}</span>
        </div>
      </div>
    `
    
    card.onclick = () => {
      window.location.href = `edit-event.html?id=${event.id}&status=${event.status}`
    }
    card.style.cursor = 'pointer'
    
    if (event.status === 'approved') {
      card.title = 'Click to edit this approved event (changes will need approval)'
    } else if (event.status === 'pending') {
      card.title = 'Click to edit this pending event'
    } else if (event.status === 'rejected') {
      card.title = 'Click to edit and resubmit this rejected event'
    }
    
    eventContainer.appendChild(card)
  })
}

async function loadUserOrganizations() {
  if (!currentUser) return
  
  organizationContainer.innerHTML = 'Loading...'
  
  try {
    const approvedQuery = query(collection(db, "organizations"), where("user", "==", currentUser.email))
    const pendingQuery = query(collection(db, "organizations-pending"), where("user", "==", currentUser.email))
    const rejectedQuery = query(collection(db, "organizations-rejected"), where("user", "==", currentUser.email))
    
    const [approvedSnapshot, pendingSnapshot, rejectedSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(pendingQuery),
      getDocs(rejectedQuery)
    ])
    
    const organizations = []
    
    approvedSnapshot.forEach(docSnapshot => {
      organizations.push({ 
        id: docSnapshot.id, 
        status: 'approved',
        ...docSnapshot.data() 
      })
    })
    
    pendingSnapshot.forEach(docSnapshot => {
      organizations.push({ 
        id: docSnapshot.id, 
        status: 'pending',
        ...docSnapshot.data() 
      })
    })
    
    rejectedSnapshot.forEach(docSnapshot => {
      organizations.push({ 
        id: docSnapshot.id, 
        status: 'rejected',
        ...docSnapshot.data() 
      })
    })
    
    displayOrganizations(organizations)
    
  } catch (error) {
    console.error("Error loading user organizations:", error)
    organizationContainer.innerHTML = '<p>Failed to load your organizations.</p>'
  }
}

function displayOrganizations(organizations) {
  organizationContainer.innerHTML = ''
  
  if (organizations.length === 0) {
    organizationContainer.innerHTML = '<p>You haven\'t submitted any organizations yet. <a href="add.html">Add your first organization!</a></p>'
    return
  }
  
  organizations.sort((a, b) => {
    const dateA = new Date(a.createdAt)
    const dateB = new Date(b.createdAt)
    return dateB - dateA
  })
  
  organizations.forEach(org => {
    const card = document.createElement("div")
    card.className = "event-card"
    
    let statusBadge = ''
    if (org.status === 'approved') {
      statusBadge = '<span class="status-badge approved">✅ APPROVED</span>'
    } else if (org.status === 'pending') {
      statusBadge = '<span class="status-badge pending">⏳ PENDING APPROVAL</span>'
    } else if (org.status === 'rejected') {
      statusBadge = '<span class="status-badge rejected">❌ REJECTED</span>'
    }
    
    card.innerHTML = `
      <img src="${org.logo}" alt="${org.name}" class="event-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMjEyNjJkIi8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjMzAzNjNkIi8+CjxwYXRoIGQ9Ik0xODcuNSA5Ny41QzE4Ny41IDEwMS42NDIgMTg0LjE0MiAxMDUgMTgwIDEwNUMxNzUuODU4IDEwNSAxNzIuNSAxMDEuNjQyIDE3Mi41IDk3LjVDMTcyLjUgOTMuMzU4IDE3NS44NTggOTAgMTgwIDkwQzE4NC4xNDIgOTAgMTg3LjUgOTMuMzU4IDE4Ny41IDY3LjVaIiBmaWxsPSIjMzAzNjNkIi8+CjxwYXRoIGQ9Ik0yMjUgMTEyLjVMMjE1IDEwMkwyMDUgMTEyLjVIMjI1WiIgZmlsbD0iIzMwMzYzZCIvPgo8dGV4dCB4PSIyMDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkpldEJyYWlucyBNb25vLCBtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM4Yjk0OWUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk9yZ2FuaXphdGlvbiBMb2dvPC90ZXh0Pgo8L3N2Zz4K';">
      <div class="event-content">
        <h2 class="event-title">${org.name}${statusBadge}</h2>
        <div class="event-organization">Organization</div>
        <div class="event-date">🌐 <a href="${org.website}" target="_blank">${org.website}</a></div>
        <div class="event-location">📍 ${org.location}</div>
        <div class="event-description">${org.description}</div>
        ${org.industry ? `<div class="event-date">🏢 Industry: ${org.industry}</div>` : ''}
        ${org.size ? `<div class="event-date">👥 Size: ${org.size}</div>` : ''}
        <div class="event-meta">
          <span>Status: ${org.status.toUpperCase()}</span>
          <span>Submitted: ${new Date(org.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `
    
    card.onclick = () => {
      if (org.website) {
        window.open(org.website, '_blank')
      }
    }
    card.style.cursor = 'pointer'
    
    if (org.status === 'approved') {
      card.title = 'Click to visit organization website'
    } else if (org.status === 'pending') {
      card.title = 'Organization pending approval'
    } else if (org.status === 'rejected') {
      card.title = 'Organization was rejected'
    }
    
    organizationContainer.appendChild(card)
  })
}

function switchToEvents() {
  currentContentType = 'events'
  document.getElementById('eventsBtn').classList.add('active')
  document.getElementById('organizationsBtn').classList.remove('active')
  document.getElementById('eventsSection').style.display = 'block'
  document.getElementById('organizationsSection').style.display = 'none'
}

function switchToOrganizations() {
  currentContentType = 'organizations'
  document.getElementById('organizationsBtn').classList.add('active')
  document.getElementById('eventsBtn').classList.remove('active')
  document.getElementById('organizationsSection').style.display = 'block'
  document.getElementById('eventsSection').style.display = 'none'
}

function formatDate(timestamp) {
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Global functions for HTML onclick handlers
window.switchToEvents = switchToEvents
window.switchToOrganizations = switchToOrganizations 