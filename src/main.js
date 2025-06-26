import { db, auth } from './firebase.js'
import { collection, getDocs, doc, getDoc, addDoc, query, where } from 'firebase/firestore'
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
  container.innerHTML = ''

  if (eventsToShow.length === 0) {
    container.innerHTML = '<p>No events found matching your search.</p>'
    return
  }

  eventsToShow.forEach(event => {
    if (event.participants === 0) {
      event.participants = "N/A"
    }

    const card = document.createElement('div')
    card.className = 'event-card'
    
    const hideButtonHtml = isCurrentUserAdmin ? `<button class="hide-btn" onclick="hideEvent('${event.id}')">👁️‍🗨️ Hide</button>` : ''
    
    card.innerHTML = `
      <img src="${event.image}" alt="${event.name}" class="event-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xNzUgNzVIMjI1VjEyNUgxNzVWNzVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0xODcuNSA5Ny41QzE4Ny41IDEwMS42NDIgMTg0LjE0MiAxMDUgMTgwIDEwNUMxNzUuODU4IDEwNSAxNzIuNSAxMDEuNjQyIDE3Mi41IDk3LjVDMTcyLjUgOTMuMzU4IDE3NS44NTggOTAgMTgwIDkwQzE4NC4xNDIgOTAgMTg3LjUgOTMuMzU4IDE4Ny41IDk3LjVaIiBmaWxsPSIjREVFMkU2Ii8+CjxwYXRoIGQ9Ik0yMjUgMTEyLjVMMjE1IDEwMkwyMDUgMTEyLjVIMjI1WiIgZmlsbD0iI0RFRTJFNiIvPgo8dGV4dCB4PSIyMDAiIHk9IjE1NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTFBN0IxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pgo8L3N2Zz4K';">
      <div class="event-content">
        <h2 class="event-title">${event.name}${hideButtonHtml}</h2>
        <div class="event-organization">${event.organization}</div>
        <div class="event-date">📅 ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</div>
        <div class="event-location">📍 ${event.location}</div>
        <div class="event-description">${event.description}</div>
        <div class="event-meta">
          <span class="event-participants">👥 ${event.participants} participants</span>
          <span>Submitted by ${event.user}</span>
        </div>
      </div>
    `
    
    if (event.link_to_event) {
      card.onclick = () => {
        window.location.href = event.link_to_event
      } 
    }
    card.onmouseover = () => {
      card.style.transform = 'scale(1.05)'
    }
    card.onmouseout = () => {
      card.style.transform = 'scale(1)'
    }
    container.appendChild(card)
  })
}

async function searchEvents(searchValue) {
  const filtered = allEvents.filter(event =>
    event.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    event.organization.toLowerCase().includes(searchValue.toLowerCase()) ||
    event.location.toLowerCase().includes(searchValue.toLowerCase())
  )
  await showEvents(filtered)
}

function formatDate(timestamp) {
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}


async function loadEvents() {
  try {
    const querySnapshot = await getDocs(collection(db, "events"))
    allEvents = []
    querySnapshot.forEach((docSnapshot) => {
      allEvents.push({ id: docSnapshot.id, ...docSnapshot.data() })
    })
    
    const hiddenSnapshot = await getDocs(collection(db, "hidden"))
    const hiddenEventIds = []
    hiddenSnapshot.forEach((doc) => {
      hiddenEventIds.push(doc.data().eventId)
    })
    allEvents = allEvents.filter(event => !hiddenEventIds.includes(event.id))
    
    await showEvents(allEvents)
  } catch (error) {
    console.error("Error loading events:", error)
    document.getElementById('eventContainer').innerHTML = '<p>Failed to load events.</p>'
  }
}

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

function logout() {
  signOut(auth).then(() => {
    alert('Logged out!')
  })
}

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

onAuthStateChanged(auth, async (user) => {
  const status = document.getElementById('userStatus')
  const signInLink = document.getElementById('signInLink')
  const logoutBtn = document.getElementById('logoutBtn')
  const addEventLink = document.getElementById('addEventLink')
  const myEventsLink = document.getElementById('myEventsLink')
  const adminLink = document.getElementById('adminLink')
  
  if (user) {
    status.textContent = `Welcome, ${user.email}!`
    signInLink.style.display = 'none'
    logoutBtn.style.display = 'inline-block'
    addEventLink.style.display = 'inline-block'
    myEventsLink.style.display = 'inline-block'
    
    const isAdmin = await checkAdminStatus(user.email)
    isCurrentUserAdmin = isAdmin
    
    if (isAdmin && adminLink) {
      adminLink.style.display = 'inline-block'
    } else if (adminLink) {
      adminLink.style.display = 'none'
    }
  } else {
    isCurrentUserAdmin = false
    status.textContent = 'Not logged in'
    signInLink.style.display = 'inline-block'
    logoutBtn.style.display = 'none'
    addEventLink.style.display = 'none'
    myEventsLink.style.display = 'none'
    if (adminLink) {
      adminLink.style.display = 'none'
    }
  }
  
  await loadEvents()
})

window.logout = logout
window.hideEvent = hideEvent
