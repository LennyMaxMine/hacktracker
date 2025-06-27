import { db, auth } from './firebase.js'
import { collection, doc, getDoc, updateDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

let currentUser = null
let eventData = null
let eventId = null
let eventStatus = null

const urlParams = new URLSearchParams(window.location.search)
eventId = urlParams.get('id')
eventStatus = urlParams.get('status')

if (!eventId || !eventStatus) {
  alert('Invalid event link')
  window.location.href = 'my-events.html'
}

onAuthStateChanged(auth, async (user) => {
  const authCheck = document.getElementById("authCheck")
  const editContainer = document.getElementById("editContainer")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    editContainer.style.display = 'none'
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    authCheck.style.display = 'none'
    editContainer.style.display = 'block'
    await loadEventData()
  }
})

async function loadEventData() {
  try {
    let collectionName = ''
    if (eventStatus === 'pending') {
      collectionName = 'approve'
    } else if (eventStatus === 'rejected') {
      collectionName = 'rejected'
    } else if (eventStatus === 'approved') {
      collectionName = 'events'
    }
    
    const docRef = doc(db, collectionName, eventId)
    const docSnapshot = await getDoc(docRef)
    
    if (!docSnapshot.exists()) {
      alert('Event not found')
      window.location.href = 'my-events.html'
      return
    }
    
    eventData = docSnapshot.data()
    
    // Check if this event belongs to the current user
    if (eventData.user !== currentUser.email) {
      alert('You can only edit your own events')
      window.location.href = 'my-events.html'
      return
    }
    
    populateForm()
    showStatusInfo()
    
  } catch (error) {
    console.error("Error loading event:", error)
    alert('Failed to load event data')
    window.location.href = 'my-events.html'
  }
}

function populateForm() {
  document.getElementById('name').value = eventData.name || ''
  document.getElementById('link_to_event').value = eventData.link_to_event || ''
  document.getElementById('organization').value = eventData.organization || ''
  document.getElementById('link_to_organization').value = eventData.link_to_organization || ''
  
  // Handle dates - convert Firestore timestamp to date string
  if (eventData.startDate) {
    const startDate = eventData.startDate.seconds ? 
      new Date(eventData.startDate.seconds * 1000) : 
      new Date(eventData.startDate)
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0]
  }
  
  if (eventData.endDate) {
    const endDate = eventData.endDate.seconds ? 
      new Date(eventData.endDate.seconds * 1000) : 
      new Date(eventData.endDate)
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0]
  }
  
  document.getElementById('location').value = eventData.location || ''
  document.getElementById('image').value = eventData.image || ''
  document.getElementById('participants').value = eventData.participants || ''
  document.getElementById('description').value = eventData.description || ''
}

function showStatusInfo() {
  const statusInfo = document.getElementById('statusInfo')
  const submitBtn = document.getElementById('submitBtn')
  
  if (eventStatus === 'approved') {
    statusInfo.className = 'status-info status-approved'
    statusInfo.innerHTML = '✅ This event is currently live and approved. Any changes you make will create a new version that needs approval. The original event will stay live until the changes are approved.'
    submitBtn.textContent = 'Submit Changes for Approval'
  } else if (eventStatus === 'pending') {
    statusInfo.className = 'status-info status-pending'
    statusInfo.innerHTML = '⏳ This event is pending approval. You can edit it before it gets reviewed.'
    submitBtn.textContent = 'Update Pending Event'
  } else if (eventStatus === 'rejected') {
    statusInfo.className = 'status-info status-rejected'
    statusInfo.innerHTML = '❌ This event was rejected. Edit and resubmit it for approval.'
    submitBtn.textContent = 'Resubmit for Approval'
  }
}

document.getElementById('editEventForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  
  if (!currentUser) {
    alert("You must be logged in to update events")
    return
  }
  
  // Prepare updated event data
  const startDate = new Date(document.getElementById("startDate").value)
  const endDate = new Date(document.getElementById("endDate").value)
  
  const updatedEvent = {
    name: document.getElementById("name").value,
    link_to_event: document.getElementById("link_to_event").value,
    organization: document.getElementById("organization").value,
    link_to_organization: document.getElementById("link_to_organization").value,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    location: document.getElementById("location").value,
    image: document.getElementById("image").value,
    participants: parseInt(document.getElementById("participants").value) || 0,
    description: document.getElementById("description").value,
    user: currentUser.email,
  }
  
  try {
    if (eventStatus === 'pending') {
      const docRef = doc(db, "approve", eventId)
      await updateDoc(docRef, updatedEvent)
      alert("Event updated successfully!")
    } else if (eventStatus === 'rejected') {
      await deleteDoc(doc(db, "rejected", eventId))
      await addDoc(collection(db, "approve"), updatedEvent)
      alert("Event resubmitted for approval!")
    } else if (eventStatus === 'approved') {
      await addDoc(collection(db, "approve"), {
        ...updatedEvent,
        originalEventId: eventId,
        isUpdate: true
      })
      alert("Changes submitted for approval! The original event will remain live until your changes are approved.")
    }
    
    window.location.href = 'my-events.html'
    
  } catch (error) {
    console.error("Error updating event:", error)
    alert("Failed to update event.")
  }
}) 