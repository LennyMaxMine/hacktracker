import { db, auth } from './firebase.js'
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const container = document.getElementById("eventContainer")

async function checkAdminStatus(email) {
  try {
    const adminDoc = await getDoc(doc(db, "admins", email))
    return adminDoc.exists() && adminDoc.data().isAdmin === true
  } catch (error) {
    console.error("Error checking admin status:", error)
    return false
  }
}

let currentUser = null

onAuthStateChanged(auth, async (user) => {
  const authCheck = document.getElementById("authCheck")
  const adminPanel = document.getElementById("adminPanel")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    adminPanel.style.display = 'none'
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Verifying admin privileges...</p>'
    adminPanel.style.display = 'none'
    
    const isAdmin = await checkAdminStatus(user.email)
    
    if (!isAdmin) {
      authCheck.innerHTML = '<p>Access denied. Admin privileges required. Redirecting to main page...</p>'
      setTimeout(() => {
        window.location.href = 'index.html'
      }, 2000)
    } else {
      currentUser = user
      authCheck.style.display = 'none'
      adminPanel.style.display = 'block'
      loadApproveEvents()
    }
  }
})

async function loadApproveEvents() {
  container.innerHTML = 'Loading...'
  const snapshot = await getDocs(collection(db, "approve"))
  container.innerHTML = ''

  const events = []
  snapshot.forEach(docSnapshot => {
    events.push({ id: docSnapshot.id, ...docSnapshot.data() })
  })

  events.forEach(event => {
    const card = document.createElement("div")
    card.className = "event-card"

    const updateBadge = event.isUpdate ? '<span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px;">📝 UPDATE</span>' : ''

    card.innerHTML = `
      <h2>${event.name}${updateBadge}</h2>
      ${event.isUpdate ? `<p style="color: #007bff; font-weight: bold;">🔄 This is an update to an existing approved event</p>` : ''}
      <p><strong>Organization:</strong> ${event.organization}</p>
      <p><strong>Date:</strong> ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</p>
      <p><strong>Location:</strong> ${event.location}</p>
      <p><strong>Description:</strong> ${event.description}</p>
      <p><strong>Participants:</strong> ${event.participants || 'N/A'}</p>
      <img src="${event.image}" alt="${event.name}" style="max-width: 100%;">
      <p><strong>Submitted by:</strong> ${event.user}</p>
      <br/><br/>
      <button onclick="approveEvent('${event.id}')">✅ Approve${event.isUpdate ? ' Update' : ''}</button>
      <button onclick="rejectEvent('${event.id}')">❌ Reject${event.isUpdate ? ' Update' : ''}</button>
    `
    container.appendChild(card)
  })

  if (events.length === 0) {
    container.innerHTML = "<p>No events waiting for approval.</p>"
  }
}

async function approveEvent(id) {
  const docRef = doc(db, "approve", id)
  const docSnapshot = await getDoc(docRef)
  if (!docSnapshot.exists()) return

  const eventData = docSnapshot.data()
  
  if (eventData.isUpdate && eventData.originalEventId) {
    const originalEventRef = doc(db, "events", eventData.originalEventId)
    
    const { isUpdate, originalEventId, ...cleanEventData } = eventData
    
    await updateDoc(originalEventRef, cleanEventData)
    await deleteDoc(docRef)
    alert("Event update approved! The live event has been updated.")
  } else {
    await addDoc(collection(db, "events"), eventData)
    await deleteDoc(docRef)
    alert("Event approved!")
  }
  
  loadApproveEvents()
}

async function rejectEvent(id) {
  if (!confirm("Are you sure you want to reject this event?")) return
  
  const docRef = doc(db, "approve", id)
  const docSnapshot = await getDoc(docRef)
  if (!docSnapshot.exists()) return

  const eventData = docSnapshot.data()
  await addDoc(collection(db, "rejected"), eventData)
  await deleteDoc(docRef)
  alert("Event rejected.")
  loadApproveEvents()
}

function formatDate(timestamp) {
  const date = new Date(timestamp.seconds * 1000)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

window.approveEvent = approveEvent
window.rejectEvent = rejectEvent 