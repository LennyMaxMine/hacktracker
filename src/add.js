import { db, auth } from './firebase.js'
import { collection, addDoc, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const eventForm = document.getElementById("eventForm")
const organizationForm = document.getElementById("organizationForm")
let currentUser = null
let selectedTags = []
let availableTags = []
let isUserAdmin = false
let approvedOrganizations = []
let currentFormType = 'event' // 'event' or 'organization'

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
    // User is logged in - show account, add (current page), my-events and admin (if admin)
    sidebarHTML += '<li class="folder-item file html" onclick="navigateTo(\'account.html\')">├── account.html</li>'
    sidebarHTML += '<li class="folder-item file html active" onclick="navigateTo(\'add.html\')">├── add.html</li>'
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
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    eventForm.style.display = 'none'
    organizationForm.style.display = 'none'
    updateSidebar(user, false)
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    isUserAdmin = await checkAdminStatus(user.email)
    authCheck.style.display = 'none'
    updateSidebar(user, isUserAdmin)
    loadAvailableTags()
    loadApprovedOrganizations()
    setupTagHandlers()
    updateHelpText()
    updateFormDisplay()
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

async function loadApprovedOrganizations() {
  try {
    const snapshot = await getDocs(collection(db, "organizations"))
    approvedOrganizations = []
    snapshot.forEach(doc => {
      approvedOrganizations.push({ id: doc.id, ...doc.data() })
    })
    populateOrganizationDropdown()
  } catch (error) {
    console.error("Error loading organizations:", error)
    populateOrganizationDropdown(true)
  }
}

function populateOrganizationDropdown(hasError = false) {
  const select = document.getElementById('organization')
  select.innerHTML = ''
  
  if (hasError) {
    select.innerHTML = '<option value="">Error loading organizations</option>'
    return
  }
  
  if (approvedOrganizations.length === 0) {
    select.innerHTML = '<option value="">No approved organizations yet</option>'
    return
  }
  
  // Add default option
  select.innerHTML = '<option value="">Select an organization</option>'
  
  // Add approved organizations
  approvedOrganizations.forEach(org => {
    const option = document.createElement('option')
    option.value = JSON.stringify({
      name: org.name,
      website: org.website
    })
    option.textContent = org.name
    select.appendChild(option)
  })
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

async function addNewTag(tagName) {
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
    addNewTag(tagInput.value)
  }
  
  addGlobalTagBtn.onclick = () => {
    addGlobalTag(tagInput.value)
  }
  
  tagInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addNewTag(tagInput.value)
    }
  }
}

// Form switching functions
function switchToEvent() {
  currentFormType = 'event'
  document.getElementById('eventBtn').classList.add('active')
  document.getElementById('organizationBtn').classList.remove('active')
  updateFormDisplay()
  updateInfoText()
}

function switchToOrganization() {
  currentFormType = 'organization'
  document.getElementById('organizationBtn').classList.add('active')
  document.getElementById('eventBtn').classList.remove('active')
  updateFormDisplay()
  updateInfoText()
}

function updateFormDisplay() {
  if (currentFormType === 'event') {
    eventForm.style.display = 'flex'
    organizationForm.style.display = 'none'
  } else {
    eventForm.style.display = 'none'
    organizationForm.style.display = 'flex'
  }
}

function updateInfoText() {
  const infoText = document.getElementById('infoText')
  if (currentFormType === 'event') {
    infoText.textContent = 'Every event you submit will be reviewed by an admin & later be visible to everyone.'
  } else {
    infoText.textContent = 'Your organization submission will be reviewed by an admin. Once approved, it will be available for event creators to select from.'
  }
}

// Event form submission
eventForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (!currentUser) {
    alert("You must be logged in to submit events")
    return
  }

  if (document.getElementById("participants").value === "") {
    document.getElementById("participants").value = 0
  }

  const startDate = new Date(document.getElementById("startDate").value)
  const endDate = new Date(document.getElementById("endDate").value)

  // Get organization data from dropdown
  const organizationSelect = document.getElementById("organization")
  const organizationData = JSON.parse(organizationSelect.value || '{}')
  
  if (!organizationData.name) {
    alert("Please select an organization")
    return
  }

  const newEvent = {
    name: document.getElementById("name").value,
    link_to_event: document.getElementById("link_to_event").value,
    organization: organizationData.name,
    link_to_organization: organizationData.website,
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
    await addDoc(collection(db, "approve"), newEvent)
    alert("Event sent to approval!")
    eventForm.reset()
    selectedTags = []
    displaySelectedTags()
    displayAvailableTags()
  } catch (error) {
    console.error("Error adding event:", error)
    alert("Event could not be saved.")
  }
})

// Organization form submission
organizationForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (!currentUser) {
    alert("You must be logged in to create organizations")
    return
  }

  const newOrganization = {
    name: document.getElementById("org_name").value,
    website: document.getElementById("org_website").value,
    logo: document.getElementById("org_logo").value,
    description: document.getElementById("org_description").value,
    location: document.getElementById("org_location").value,
    size: document.getElementById("org_size").value || null,
    industry: document.getElementById("org_industry").value || null,
    user: currentUser.email,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }

  try {
    await addDoc(collection(db, "organizations-pending"), newOrganization)
    alert("Organization submitted for approval! You'll be notified once it's reviewed.")
    organizationForm.reset()
  } catch (error) {
    console.error("Error adding organization:", error)
    alert("Organization could not be saved.")
  }
})

// Global functions for HTML onclick handlers
window.removeTag = removeTag
window.switchToEvent = switchToEvent
window.switchToOrganization = switchToOrganization
