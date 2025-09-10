// App.jsx
import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, rtdb, ref, set, onDisconnect, onValue } from "./firebase";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ChatRoom from "./components/ChatRoom";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        if (!sessionIdRef.current) sessionIdRef.current = Date.now(); // unique session per tab
        const uid = currentUser.uid;
        const userStatusRef = ref(rtdb, `status/${uid}/${sessionIdRef.current}`);
        const connectedRef = ref(rtdb, ".info/connected");

        onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            set(userStatusRef, { online: true, lastSeen: Date.now() });
            onDisconnect(userStatusRef).set({ online: false, lastSeen: Date.now() });
          }
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return showSignup ? (
      <Signup switchToLogin={() => setShowSignup(false)} />
    ) : (
      <Login switchToSignup={() => setShowSignup(true)} />
    );
  }

  return <ChatRoom user={user} setUser={setUser} sessionId={sessionIdRef.current} />;
}
