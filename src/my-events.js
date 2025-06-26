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
      <h2>${event.name}${statusBadge}</h2>
      <p><strong>Organization:</strong> ${event.organization}</p>
      <p><strong>Date:</strong> ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</p>
      <p><strong>Location:</strong> ${event.location}</p>
      <p><strong>Description:</strong> ${event.description}</p>
      <p><strong>Participants:</strong> ${event.participants || 'N/A'}</p>
      <img src="${event.image}" alt="${event.name}" style="max-width: 100%;">
    `
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