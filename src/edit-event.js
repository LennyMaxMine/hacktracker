import { db, auth } from './firebase.js'
import { collection, doc, getDoc, updateDoc, addDoc, deleteDoc, getDocs, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

let currentUser = null
let eventData = null
let eventId = null
let eventStatus = null
let selectedTags = []
let availableTags = []
let isUserAdmin = false

const urlParams = new URLSearchParams(window.location.search)
eventId = urlParams.get('id')
eventStatus = urlParams.get('status')

if (!eventId || !eventStatus) {
  alert('Invalid event link')
  window.location.href = 'my-content.html'
}

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
  const authCheck = document.getElementById("authCheck")
  const editContainer = document.getElementById("editContainer")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    editContainer.style.display = 'none'
    updateSidebar(user, false)
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    isUserAdmin = await checkAdminStatus(user.email)
    authCheck.style.display = 'none'
    editContainer.style.display = 'block'
    updateSidebar(user, isUserAdmin)
    await loadEventData()
    await loadAvailableTags()
    setupTagHandlers()
    updateHelpText()
  }
})

function updateHelpText() {
  const helpText = document.querySelector('.tags-help')
  const addTagBtn = document.getElementById('addTagBtn')
  const addGlobalTagBtn = document.getElementById('addGlobalTagBtn')
  
  if (isUserAdmin) {
    helpText.textContent = 'Add Tag: custom for this event | Add to Firebase: available for everyone'
    addTagBtn.textContent = 'Add Tag'
    addGlobalTagBtn.style.display = 'inline-block'
  } else {
    helpText.textContent = 'Custom tags will only be used for this event'
    addTagBtn.textContent = 'Add Tag'
    addGlobalTagBtn.style.display = 'none'
  }
}

async function loadAvailableTags() {
  try {
    const snapshot = await getDocs(collection(db, "tags"))
    availableTags = []
    snapshot.forEach(doc => {
      availableTags.push({ id: doc.id, ...doc.data() })
    })
    displayAvailableTags()
  } catch (error) {
    console.error("Error loading tags:", error)
    document.getElementById('availableTags').innerHTML = 'Failed to load tags'
  }
}

function displayAvailableTags() {
  const container = document.getElementById('availableTags')
  if (availableTags.length === 0) {
    container.innerHTML = 'No tags available yet. Add the first one!'
    return
  }
  
  container.innerHTML = ''
  availableTags.forEach(tag => {
    if (!selectedTags.find(selected => selected.name === tag.name)) {
      const tagElement = document.createElement('span')
      tagElement.className = 'available-tag'
      tagElement.textContent = `#${tag.name}`
      tagElement.onclick = () => addExistingTag(tag)
      container.appendChild(tagElement)
    }
  })
}

function addExistingTag(tag) {
  if (!selectedTags.find(selected => selected.name === tag.name)) {
    selectedTags.push(tag)
    displaySelectedTags()
    displayAvailableTags()
  }
}

function displaySelectedTags() {
  const container = document.getElementById('selectedTags')
  container.innerHTML = ''
  
  selectedTags.forEach((tag, index) => {
    const tagElement = document.createElement('div')
    tagElement.className = 'tag'
    tagElement.innerHTML = `
      #${tag.name}
      <span class="remove" onclick="removeTag(${index})">×</span>
    `
    container.appendChild(tagElement)
  })
}

function removeTag(index) {
  selectedTags.splice(index, 1)
  displaySelectedTags()
  displayAvailableTags()
}

async function addCustomTag(tagName) {
  const trimmedName = tagName.trim().toLowerCase().replace(/\s+/g, '-')
  if (!trimmedName) return
  
  // Check if it's an existing available tag
  const existingTag = availableTags.find(tag => tag.name.toLowerCase() === trimmedName)
  if (existingTag) {
    addExistingTag(existingTag)
    return
  }
  
  // Check if already selected
  const alreadySelected = selectedTags.find(selected => selected.name === trimmedName)
  if (alreadySelected) return
  
  // Regular user OR admin using custom tag button: Create custom tag (only for this event, not saved to Firebase)
  const customTag = { 
    id: `custom-${Date.now()}-${trimmedName}`, 
    name: trimmedName,
    isCustom: true
  }
  
  selectedTags.push(customTag)
  displaySelectedTags()
  displayAvailableTags()
  
  document.getElementById('tagInput').value = ''
}

async function addGlobalTag(tagName) {
  const trimmedName = tagName.trim().toLowerCase().replace(/\s+/g, '-')
  if (!trimmedName) return
  
  // Check if it's an existing available tag
  const existingTag = availableTags.find(tag => tag.name.toLowerCase() === trimmedName)
  if (existingTag) {
    addExistingTag(existingTag)
    return
  }
  
  // Check if already selected
  const alreadySelected = selectedTags.find(selected => selected.name === trimmedName)
  if (alreadySelected) return
  
  // Admin only: Create new tag and save to Firebase
  try {
    const newTag = {
      name: trimmedName,
      createdBy: currentUser.email,
      createdAt: new Date().toISOString(),
      usageCount: 1
    }
    
    const docRef = await addDoc(collection(db, "tags"), newTag)
    const tagWithId = { id: docRef.id, ...newTag }
    
    // Add to available tags list and select it
    availableTags.push(tagWithId)
    selectedTags.push(tagWithId)
    
    displaySelectedTags()
    displayAvailableTags()
    
    document.getElementById('tagInput').value = ''
  } catch (error) {
    console.error("Error adding new tag:", error)
    alert("Failed to create new tag.")
  }
}

function setupTagHandlers() {
  const tagInput = document.getElementById('tagInput')
  const addTagBtn = document.getElementById('addTagBtn')
  const addGlobalTagBtn = document.getElementById('addGlobalTagBtn')
  
  addTagBtn.onclick = () => {
    addCustomTag(tagInput.value)
  }
  
  addGlobalTagBtn.onclick = () => {
    addGlobalTag(tagInput.value)
  }
  
  tagInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCustomTag(tagInput.value)
    }
  }
}

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
      window.location.href = 'my-content.html'
      return
    }
    
    eventData = docSnapshot.data()
    
    // Check if this event belongs to the current user
    if (eventData.user !== currentUser.email) {
      alert('You can only edit your own events')
      window.location.href = 'my-content.html'
      return
    }
    
    populateForm()
    showStatusInfo()
    
  } catch (error) {
    console.error("Error loading event:", error)
    alert('Failed to load event data')
    window.location.href = 'my-content.html'
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
  
  // Load existing tags
  if (eventData.tags && eventData.tags.length > 0) {
    selectedTags = [...eventData.tags]
    displaySelectedTags()
    displayAvailableTags()
  }
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
    tags: selectedTags.map(tag => ({ id: tag.id, name: tag.name, isCustom: tag.isCustom || false })),
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

window.removeTag = removeTag 