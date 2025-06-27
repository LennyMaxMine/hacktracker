import { db, auth } from './firebase.js'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const container = document.getElementById("eventContainer")

let currentUser = null

onAuthStateChanged(auth, (user) => {
  const authCheck = document.getElementById("authCheck")
  const myEventsPanel = document.getElementById("myEventsPanel")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    myEventsPanel.style.display = 'none'
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    authCheck.style.display = 'none'
    myEventsPanel.style.display = 'block'
    loadUserEvents()
  }
})

async function loadUserEvents() {
  if (!currentUser) return
  
  container.innerHTML = 'Loading...'
  
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
    container.innerHTML = '<p>Failed to load your events.</p>'
  }
}

function displayEvents(events) {
  container.innerHTML = ''
  
  if (events.length === 0) {
    container.innerHTML = '<p>You haven\'t submitted any events yet. <a href="add.html">Add your first event!</a></p>'
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
    
    card.innerHTML = `
      <img src="${event.image}" alt="${event.name}" class="event-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0xODcuNSA5Ny41QzE4Ny41IDEwMS42NDIgMTg0LjE0MiAxMDUgMTgwIDEwNUMxNzUuODU4IDEwNSAxNzIuNSAxMDEuNjQyIDE7Mi41IDk3LjVDMTcyLjUgOTMuMzU4IDE3NS44NTggOTAgMTgwIDkwQzE4NC4xNDIgOTAgMTg3LjUgOTMuMzU4IDE4Ny41IDk3LjVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0yMjUgMTEyLjVMMjE1IDEwMkwyMDUgMTEyLjVIMjI1WiIgZmlsbD0iI0RFRTJFNiIvPgo8dGV4dCB4PSIyMDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTFBN0IxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pgo8L3N2Zz4K';">
      <div class="event-content">
        <h2 class="event-title">${event.name}${statusBadge}</h2>
        <div class="event-organization">${event.organization}</div>
        <div class="event-date">📅 ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</div>
        <div class="event-location">📍 ${event.location}</div>
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
    
    container.appendChild(card)
  })
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
} 