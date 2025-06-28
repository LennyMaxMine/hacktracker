import { db, auth } from './firebase.js'
import { collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore'
import { signOut, onAuthStateChanged } from 'firebase/auth'

async function checkAdminStatus(email) {
  try {
    const adminDoc = await getDoc(doc(db, "admins", email))
    return adminDoc.exists() && adminDoc.data().isAdmin === true
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}

let allEvents = []
let isCurrentUserAdmin = false

async function showEvents(eventsToShow) {
  const container = document.getElementById('eventContainer')
  const eventCount = document.getElementById('eventCount')
  container.innerHTML = ''
  
  // Update event count
  eventCount.textContent = `${eventsToShow.length} events found`

  if (eventsToShow.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// No events found matching your search criteria</div>'
    return
  }

  eventsToShow.forEach(event => {
    const participantCount = event.participants === 0 ? "N/A" : event.participants

    const card = document.createElement('div')
    card.className = 'event-card'
    
    const hideButtonHtml = isCurrentUserAdmin ? `<button class="hide-btn" onclick="hideEvent('${event.id}')">hide</button>` : ''
    
    const tagsHtml = event.tags && event.tags.length > 0 ? `
      <div class="event-tags">
        ${event.tags.map(tag => `<span class="event-tag">#${tag.name}</span>`).join('')}
      </div>
    ` : ''
    
    // Format dates
    const startDate = formatDate(event.startDate)
    const endDate = formatDate(event.endDate)
    
    card.innerHTML = `
      <img src="${event.image}" alt="${event.name}" class="event-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMjEyNjJkIi8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjMzAzNjNkIi8+CjxwYXRoIGQ9Ik0xODcuNSA5Ny41QzE4Ny41IDEwMS42NDIgMTg0LjE0MiAxMDUgMTgwIDEwNUMxNzUuODU4IDEwNSAxNzIuNSAxMDEuNjQyIDE3Mi41IDk3LjVDMTcyLjUgOTMuMzU4IDE3NS44NTggOTAgMTgwIDkwQzE4NC4xNDIgOTAgMTg3LjUgOTMuMzU4IDE4Ny41IDk3LjVaIiBmaWxsPSIjMzAzNjNkIi8+CjxwYXRoIGQ9Ik0yMjUgMTEyLjVMMjE1IDEwMkwyMDUgMTEyLjVIMjI1WiIgZmlsbD0iIzMwMzYzZCIvPgo8dGV4dCB4PSIyMDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkpldEJyYWlucyBNb25vLCBtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM4Yjk0OWUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo=';">
      
      <div class="event-header">
        <span class="event-type">HACKATHON</span>
        ${hideButtonHtml}
      </div>
      
      <h2 class="event-title">${event.name}</h2>
      <div class="event-organization">@${event.organization}</div>
      
      <div class="event-details">
        <div class="event-property">
          <span class="property-key">start:</span>
          <span class="property-value">"${startDate}"</span>
        </div>
        <div class="event-property">
          <span class="property-key">end:</span>
          <span class="property-value">"${endDate}"</span>
        </div>
        <div class="event-property">
          <span class="property-key">location:</span>
          <span class="property-value">"${event.location}"</span>
        </div>
        <div class="event-property">
          <span class="property-key">url:</span>
          <span class="property-value">"${event.link_to_event || 'null'}"</span>
        </div>
      </div>
      
      ${tagsHtml}
      
      <div class="event-description">${event.description}</div>
      
      <div class="event-footer">
        <span class="event-participants">${participantCount} devs</span>
      </div>
    `
    
    // Add click handler for navigation
    card.style.cursor = 'pointer'
    card.onclick = () => {
      if (event.link_to_event) {
        window.open(event.link_to_event, '_blank')
      }
    }
    
    container.appendChild(card)
  })
}

async function searchEvents(searchValue) {
  const filtered = allEvents.filter(event => {
    const searchLower = searchValue.toLowerCase()
    return event.name.toLowerCase().includes(searchLower) ||
      event.organization.toLowerCase().includes(searchLower) ||
      event.location.toLowerCase().includes(searchLower) ||
      (event.tags && event.tags.some(tag => tag.name.toLowerCase().includes(searchLower)))
  })
  await showEvents(filtered)
}

function formatDate(timestamp) {
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })
}

async function loadEvents() {
  try {
    // Show loading state
    const container = document.getElementById('eventContainer')
    const eventCount = document.getElementById('eventCount')
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// Loading events from database...</div>'
    eventCount.textContent = 'Loading...'
    
    const querySnapshot = await getDocs(collection(db, "events"))
    allEvents = []
    querySnapshot.forEach((docSnapshot) => {
      allEvents.push({ id: docSnapshot.id, ...docSnapshot.data() })
    })
    
    // Filter out hidden events
    const hiddenSnapshot = await getDocs(collection(db, "hidden"))
    const hiddenEventIds = []
    hiddenSnapshot.forEach((doc) => {
      hiddenEventIds.push(doc.data().eventId)
    })
    allEvents = allEvents.filter(event => !hiddenEventIds.includes(event.id))
    
    // Sort events by start date (newest first)
    allEvents.sort((a, b) => {
      const dateA = new Date(a.startDate.seconds * 1000)
      const dateB = new Date(b.startDate.seconds * 1000)
      return dateB - dateA
    })
    
    await showEvents(allEvents)
  } catch (error) {
    console.error("Error loading events:", error)
    document.getElementById('eventContainer').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--accent-red); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// Error: Failed to load events from database</div>'
    document.getElementById('eventCount').textContent = 'Error loading events'
  }
}

// Event handlers
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchEvents(e.target.value)
})

document.getElementById('searchBtn').addEventListener('click', () => {
  const searchValue = document.getElementById('searchInput').value
  searchEvents(searchValue)
})

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = ''
  searchEvents('')
})

async function hideEvent(eventId) {
  if (!auth.currentUser) {
    alert('You must be logged in to hide events')
    return
  }
  
  const isAdmin = await checkAdminStatus(auth.currentUser.email)
  if (!isAdmin) {
    alert('Only admins can hide events')
    return
  }
  
  if (!confirm('Hide this event from all users?')) return
  
  try {
    await addDoc(collection(db, "hidden"), {
      eventId: eventId,
      hiddenBy: auth.currentUser.email,
      hiddenAt: new Date().toISOString()
    })
    
    allEvents = allEvents.filter(event => event.id !== eventId)
    await showEvents(allEvents)
    
    alert('Event hidden successfully!')
  } catch (error) {
    console.error("Error hiding event:", error)
    alert('Failed to hide event.')
  }
}

function updateSidebar(user, isAdmin) {
  const authItems = document.getElementById('authItems')
  if (!authItems) return
  
  let sidebarHTML = ''
  
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
    // User is logged out - show signin
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'signin.html\')">└── signin.html</li>'
  }
  
  authItems.innerHTML = sidebarHTML
}

onAuthStateChanged(auth, async (user) => {
  let isAdmin = false
  
  if (user) {
    isAdmin = await checkAdminStatus(user.email)
    isCurrentUserAdmin = isAdmin
  } else {
    isCurrentUserAdmin = false
  }
  
  updateSidebar(user, isAdmin)
  await loadEvents()
})

window.hideEvent = hideEvent 