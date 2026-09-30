/**
 * Firebase Client Initialization - PIK-R MANSEKU
 * Project: absensi-pik-r
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAn-AWu5VLA9Hxh1RLpjiJIDl82PTH9H9g",
  authDomain: "absensi-pik-r.firebaseapp.com",
  projectId: "absensi-pik-r",
  storageBucket: "absensi-pik-r.firebasestorage.app",
  messagingSenderId: "572782848196",
  appId: "1:572782848196:web:9f00f1396825d2e0a90191",
  measurementId: "G-T6DE0JXTMG"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics if supported in the browser environment
export let analytics = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized for PIK-R MANSEKU.");
  }
}).catch(err => console.warn("Analytics not supported:", err));
