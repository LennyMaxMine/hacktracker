import { db, auth } from './firebase.js'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const form = document.getElementById("eventForm")

let currentUser = null

onAuthStateChanged(auth, (user) => {
  const authCheck = document.getElementById("authCheck")
  const form = document.getElementById("eventForm")
  
  if (!user) {
    authCheck.style.display = 'block'
    authCheck.innerHTML = '<p>Redirecting to sign in page...</p>'
    form.style.display = 'none'
    setTimeout(() => {
      window.location.href = 'signin.html'
    }, 1000)
  } else {
    currentUser = user
    authCheck.style.display = 'none'
    form.style.display = 'flex'
  }
})

form.addEventListener("submit", async (e) => {
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

  const newEvent = {
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
    await addDoc(collection(db, "approve"), newEvent)
    alert("Event sent to approval!")
    form.reset()
  } catch (error) {
    console.error("Error adding event:", error)
    alert("Event could not be saved.")
  }
})
