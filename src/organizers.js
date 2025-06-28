import { db, auth } from './firebase.js'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
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

let allOrganizers = []

async function showOrganizers(organizersToShow) {
  const container = document.getElementById('organizerContainer')
  const organizerCount = document.getElementById('organizerCount')
  container.innerHTML = ''
  
  organizerCount.textContent = `${organizersToShow.length} organizers found`

  if (organizersToShow.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// No organizers found matching your search criteria</div>'
    return
  }

  organizersToShow.forEach(organizer => {
    const card = document.createElement('div')
    card.className = 'organizer-card'
    
    const latestEvents = organizer.events
      .sort((a, b) => new Date(b.startDate.seconds * 1000) - new Date(a.startDate.seconds * 1000))
      .slice(0, 3)
    
    const eventsPreviewHtml = latestEvents.length > 0 ? `
      <div class="events-preview">
        <h4>// Recent events (${organizer.events.length} total)</h4>
        ${latestEvents.map(event => `
          <div class="event-preview" onclick="window.open('${event.link_to_event}', '_blank')" style="cursor: pointer;">
            <div class="event-preview-name">${event.name}</div>
            <div class="event-preview-date">${formatDate(event.startDate)} - ${formatDate(event.endDate)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''
    
    card.innerHTML = `
      <div class="organizer-header">
        <span class="organizer-type">ORGANIZATION</span>
        <span>org.json</span>
      </div>
      
      <h2 class="organizer-name">${organizer.name}</h2>
      
      <div class="organizer-stats">
        <div class="stat-property">
          <span class="stat-key">totalEvents:</span>
          <span class="stat-value">"${organizer.eventCount}"</span>
        </div>
        <div class="stat-property">
          <span class="stat-key">totalParticipants:</span>
          <span class="stat-value">"${organizer.totalParticipants}"</span>
        </div>
        <div class="stat-property">
          <span class="stat-key">avgParticipants:</span>
          <span class="stat-value">"${organizer.avgParticipants}"</span>
        </div>
        <div class="stat-property">
          <span class="stat-key">website:</span>
          <span class="stat-value">"${organizer.link || 'null'}"</span>
        </div>
      </div>
      
      <div class="organizer-events">
        ${eventsPreviewHtml}
      </div>
    `
    
    card.onclick = () => {
      if (organizer.link) {
        window.open(organizer.link, '_blank')
      }
    }
    card.style.cursor = organizer.link ? 'pointer' : 'default'
    
    container.appendChild(card)
  })
}

async function searchOrganizers(searchValue) {
  const filtered = allOrganizers.filter(organizer => {
    const searchLower = searchValue.toLowerCase()
    return organizer.name.toLowerCase().includes(searchLower) ||
      organizer.events.some(event => 
        event.name.toLowerCase().includes(searchLower) ||
        event.location.toLowerCase().includes(searchLower)
      )
  })
  await showOrganizers(filtered)
}

function formatDate(timestamp) {
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })
}

async function loadOrganizers() {
  try {
    const container = document.getElementById('organizerContainer')
    const organizerCount = document.getElementById('organizerCount')
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// Loading organizers from database...</div>'
    organizerCount.textContent = 'Loading...'
    
    const querySnapshot = await getDocs(collection(db, "events"))
    const allEvents = []
    querySnapshot.forEach((docSnapshot) => {
      allEvents.push({ id: docSnapshot.id, ...docSnapshot.data() })
    })
    
    const hiddenSnapshot = await getDocs(collection(db, "hidden"))
    const hiddenEventIds = []
    hiddenSnapshot.forEach((doc) => {
      hiddenEventIds.push(doc.data().eventId)
    })
    const visibleEvents = allEvents.filter(event => !hiddenEventIds.includes(event.id))
    
    const organizersMap = new Map()
    
    visibleEvents.forEach(event => {
      const orgName = event.organization
      if (!organizersMap.has(orgName)) {
        organizersMap.set(orgName, {
          name: orgName,
          link: event.link_to_organization,
          events: [],
          eventCount: 0,
          totalParticipants: 0
        })
      }
      
      const organizer = organizersMap.get(orgName)
      organizer.events.push(event)
      organizer.eventCount++
      organizer.totalParticipants += event.participants || 0
    })
    
    allOrganizers = Array.from(organizersMap.values()).map(organizer => ({
      ...organizer,
      avgParticipants: organizer.eventCount > 0 ? 
        Math.round(organizer.totalParticipants / organizer.eventCount) : 0
    }))
    
    allOrganizers.sort((a, b) => b.eventCount - a.eventCount)
    
    await showOrganizers(allOrganizers)
  } catch (error) {
    console.error("Error loading organizers:", error)
    document.getElementById('organizerContainer').innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--accent-red); font-family: \'JetBrains Mono\', monospace; padding: 2rem;">// Error: Failed to load organizers from database</div>'
    document.getElementById('organizerCount').textContent = 'Error loading organizers'
  }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchOrganizers(e.target.value)
})

document.getElementById('searchBtn').addEventListener('click', () => {
  const searchValue = document.getElementById('searchInput').value
  searchOrganizers(searchValue)
})

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = ''
  searchOrganizers('')
})

function updateSidebar(user, isAdmin) {
  const authItems = document.getElementById('authItems')
  if (!authItems) return
  
  let sidebarHTML = ''
  
  if (user) {
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'account.html\')">├── account.html</li>'
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
  let isAdmin = false
  
  if (user) {
    isAdmin = await checkAdminStatus(user.email)
  }
  
  updateSidebar(user, isAdmin)
  await loadOrganizers()
}) 