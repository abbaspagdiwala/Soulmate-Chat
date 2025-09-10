// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase, ref, onDisconnect, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAkw3y_itKzpiCBlh9Q4KyWT7ZC7CQ9CRw",
  authDomain: "soulmate-503ac.firebaseapp.com",
  projectId: "soulmate-503ac",
  storageBucket: "soulmate-503ac.appspot.com",   // ✅ corrected
    databaseURL: "https://soulmate-503ac-default-rtdb.asia-southeast1.firebasedatabase.app",

  messagingSenderId: "536832012142",
  appId: "1:536832012142:web:f22c054b139413ffc1db7f"
};

const app = initializeApp(firebaseConfig);

// ✅ Exports
export const auth = getAuth(app);
export const db = getFirestore(app);   // for chat messages
export const rtdb = getDatabase(app);  // for online/offline users
export { ref, set, onDisconnect, onValue }; 