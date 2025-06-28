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

function updateSidebar(user, isAdmin) {
  const authItems = document.getElementById('authItems')
  if (!authItems) return
  
  let sidebarHTML = ''
  
  if (user) {
    // User is logged in - show account, add, my-events, admin (current page)
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'account.html\')">├── account.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'add.html\')">├── add.html</li>'
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'my-content.html\')">├── my-content.html</li>'
    sidebarHTML += '<li class="folder-item file html active" onclick="navigateTo(\'admin.html\')">└── admin.html</li>'
  } else {
    // User is logged out - show signin
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'signin.html\')">└── signin.html</li>'
  }
  
  authItems.innerHTML = sidebarHTML
}

let currentUser = null

onAuthStateChanged(auth, async (user) => {
  const authCheck = document.getElementById("authCheck")
  const adminPanel = document.getElementById("adminPanel")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    adminPanel.style.display = 'none'
    updateSidebar(user, false)
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
      updateSidebar(user, false)
      setTimeout(() => {
        window.location.href = 'index.html'
      }, 2000)
    } else {
      currentUser = user
      authCheck.style.display = 'none'
      adminPanel.style.display = 'block'
      updateSidebar(user, isAdmin)
      loadPendingOrganizations()
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
    
    const tagsHtml = event.tags && event.tags.length > 0 ? `
      <p><strong>Tags:</strong> ${event.tags.map(tag => `<span style="background: #007bff; color: white; padding: 2px 6px; border-radius: 8px; font-size: 11px; margin-right: 4px;">#${tag.name}</span>`).join('')}</p>
    ` : ''

    card.innerHTML = `
      <h2>${event.name}${updateBadge}</h2>
      ${event.isUpdate ? `<p style="color: #007bff; font-weight: bold;">🔄 This is an update to an existing approved event</p>` : ''}
      <p><strong>Organization:</strong> ${event.organization}</p>
      <p><strong>Date:</strong> ${formatDate(event.startDate)} to ${formatDate(event.endDate)}</p>
      <p><strong>Location:</strong> ${event.location}</p>
      ${tagsHtml}
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

async function loadPendingOrganizations() {
  const container = document.getElementById("organizationContainer")
  container.innerHTML = 'Loading...'
  
  try {
    const snapshot = await getDocs(collection(db, "organizations-pending"))
    container.innerHTML = ''

    const organizations = []
    snapshot.forEach(docSnapshot => {
      organizations.push({ id: docSnapshot.id, ...docSnapshot.data() })
    })

    organizations.forEach(org => {
      const card = document.createElement("div")
      card.className = "event-card"

      card.innerHTML = `
        <h2>${org.name}</h2>
        <p><strong>Website:</strong> <a href="${org.website}" target="_blank">${org.website}</a></p>
        <p><strong>Location:</strong> ${org.location}</p>
        <p><strong>Industry:</strong> ${org.industry || 'Not specified'}</p>
        <p><strong>Size:</strong> ${org.size || 'Not specified'}</p>
        <p><strong>Description:</strong> ${org.description}</p>
        <img src="${org.logo}" alt="${org.name} logo" style="max-width: 200px; max-height: 100px; object-fit: contain;">
        <p><strong>Submitted by:</strong> ${org.user}</p>
        <p><strong>Submitted on:</strong> ${new Date(org.createdAt).toLocaleDateString()}</p>
        <br/><br/>
        <button onclick="approveOrganization('${org.id}')">✅ Approve Organization</button>
        <button onclick="rejectOrganization('${org.id}')">❌ Reject Organization</button>
      `
      container.appendChild(card)
    })

    if (organizations.length === 0) {
      container.innerHTML = "<p>No organizations waiting for approval.</p>"
    }
  } catch (error) {
    console.error("Error loading organizations:", error)
    container.innerHTML = "<p>Error loading organizations.</p>"
  }
}

async function approveOrganization(id) {
  try {
    const docRef = doc(db, "organizations-pending", id)
    const docSnapshot = await getDoc(docRef)
    if (!docSnapshot.exists()) return

    const orgData = docSnapshot.data()
    
    // Add to approved organizations collection
    await addDoc(collection(db, "organizations"), {
      ...orgData,
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.email,
      status: 'approved'
    })
    
    // Remove from pending
    await deleteDoc(docRef)
    
    alert("Organization approved!")
    loadPendingOrganizations()
  } catch (error) {
    console.error("Error approving organization:", error)
    alert("Failed to approve organization.")
  }
}

async function rejectOrganization(id) {
  if (!confirm("Are you sure you want to reject this organization?")) return
  
  try {
    const docRef = doc(db, "organizations-pending", id)
    const docSnapshot = await getDoc(docRef)
    if (!docSnapshot.exists()) return

    const orgData = docSnapshot.data()
    
    // Add to rejected organizations collection
    await addDoc(collection(db, "organizations-rejected"), {
      ...orgData,
      rejectedAt: new Date().toISOString(),
      rejectedBy: currentUser.email,
      status: 'rejected'
    })
    
    // Remove from pending
    await deleteDoc(docRef)
    
    alert("Organization rejected.")
    loadPendingOrganizations()
  } catch (error) {
    console.error("Error rejecting organization:", error)
    alert("Failed to reject organization.")
  }
}

window.approveEvent = approveEvent
window.rejectEvent = rejectEvent
window.approveOrganization = approveOrganization
window.rejectOrganization = rejectOrganization 