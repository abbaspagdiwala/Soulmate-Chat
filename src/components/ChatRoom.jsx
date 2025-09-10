import React, { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db, rtdb, ref, onValue, set } from "../firebase";
import "../App.css";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

function VideoCall({ user, activeUser, onLeaveCall }) {
  const roomID = [user.uid, activeUser.uid].sort().join("_");

  useEffect(() => {
    let zp;
    const startCall = async () => {
      const appID = 1748901116; 
      const serverSecret = "7b28adcae2892fa9779078bcc1d8a224"; 
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        user.uid,
        user.email.split('@')[0]
      );
      zp = ZegoUIKitPrebuilt.create(kitToken);
      zp.joinRoom({
        container: document.querySelector(".myCallContainer"),
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        onLeaveRoom: onLeaveCall,
        showScreenSharingButton: false,
      });
    };
    startCall();
    return () => {
      if (zp) {
        zp.destroy();
      }
    };
  }, []); 

  return <div className="myCallContainer" style={{ width: '100%', height: '100%' }}></div>;
}


const ChatRoom = ({ user, setUser, sessionId }) => {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  
  const [callStatus, setCallStatus] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCaller, setIsCaller] = useState(false);

  const getConversationId = (uid1, uid2) => [uid1, uid2].sort().join("_");

  useEffect(() => {
    const callsQuery = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid),
      where("status", "==", "ringing")
    );
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const callData = snapshot.docs[0].data();
        const callerInfo = users.find(u => u.uid === callData.callerId);
        setIncomingCall({ ...callData, id: snapshot.docs[0].id, callerName: callerInfo?.name || "Someone" });
      } else {
        setIncomingCall(null);
      }
    });
    return () => unsubscribe();
  }, [user.uid, users]);

  useEffect(() => {
    if (!activeUser) {
      setCallStatus(null);
      return;
    };
    const convId = getConversationId(user.uid, activeUser.uid);
    const callDocRef = doc(db, "calls", convId);
    const unsubscribe = onSnapshot(callDocRef, (docSnapshot) => {
      const callData = docSnapshot.data();
      setCallStatus(callData ? callData.status : null);
      setIsCaller(callData ? callData.callerId === user.uid : false);
    });
    return () => unsubscribe();
  }, [activeUser, user.uid]);
  
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs.map((doc) => doc.data()).filter((u) => u.uid !== user.uid);
      setUsers(list);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const statusRef = ref(rtdb, "status");
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val() || {};
      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          const sessions = data[u.uid] || {};
          const isOnline = Object.values(sessions).some((s) => s.online);
          return { ...u, online: isOnline };
        })
      );
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeUser) {
        setMessages([]); 
        return;
    };
    const convId = getConversationId(user.uid, activeUser.uid);
    const q = query(collection(db, "chats", convId, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeUser, user.uid]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeUser) return;
    const convId = getConversationId(user.uid, activeUser.uid);
    await addDoc(collection(db, "chats", convId, "messages"), {
      text: input, sender: user.uid, timestamp: serverTimestamp(),
    });
    setInput("");
  };

  const handleLogout = async () => {
    try {
      const userStatusRef = ref(rtdb, `status/${user.uid}/${sessionId}`);
      await set(userStatusRef, { online: false, lastSeen: Date.now() });
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout mein error:", error);
    }
  };

  const handleStartCall = async () => {
    if (!activeUser) return;
    const convId = getConversationId(user.uid, activeUser.uid);
    const callDocRef = doc(db, "calls", convId);
    await setDoc(callDocRef, {
      status: 'ringing',
      callerId: user.uid,
      receiverId: activeUser.uid,
      createdAt: serverTimestamp(),
    });
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    try {
      const callDocRef = doc(db, "calls", incomingCall.id);
      await setDoc(callDocRef, { status: 'active' }, { merge: true });
      const callerInfo = users.find(u => u.uid === incomingCall.callerId);
      if (callerInfo) {
        setActiveUser(callerInfo);
      }
      setIncomingCall(null);
    } catch (error) {
      console.error("Accept call mein error:", error);
    }
  };
  
  const handleDeclineOrEndCall = async () => {
    let callIdToDelete = null;
    if (incomingCall) {
        callIdToDelete = incomingCall.id;
    } else if (activeUser) {
        callIdToDelete = getConversationId(user.uid, activeUser.uid);
    }

    if (callIdToDelete) {
        const callDocRef = doc(db, "calls", callIdToDelete);
        await deleteDoc(callDocRef);
    }
    setIncomingCall(null);
  };

  if (incomingCall) {
    return (
      <div className="incoming-call-container">
        <h3>{incomingCall.callerName || "Someone"} is calling...</h3>
        <button onClick={handleAcceptCall} className="accept-call-btn">Accept</button>
        <button onClick={handleDeclineOrEndCall} className="decline-call-btn">Decline</button>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <div className="main-header"><h2>Soulmate</h2></div>
      <div className="chat-container">
        <div className="sidebar">
            <div className="sidebar-header">
                <span>Users</span><button onClick={handleLogout}>Logout</button>
            </div>
            <div className="sidebar-users">
                <ul>
                {users.map((u) => (
                    <li key={u.uid} onClick={() => setActiveUser(u)} className={activeUser?.uid === u.uid ? 'active' : ''}>
                    <div className="user-info">
                        <div className="user-avatar">{u.name ? u.name.charAt(0).toUpperCase() : "U"}</div>
                        <div>
                        <span>{u.name || "Unknown"}</span>
                        <div className={`user-status ${u.online ? "online" : "offline"}`}>{u.online ? "● Online" : "● Offline"}</div>
                        </div>
                    </div>
                    </li>
                ))}
                </ul>
            </div>
        </div>
        <div className="chat-section">
          {activeUser ? (
            callStatus === 'active' ? (
              <VideoCall user={user} activeUser={activeUser} onLeaveCall={handleDeclineOrEndCall} />
            ) : (
              <>
                <div className="chat-header">
                  <h3>{activeUser.name || "Unknown"}</h3>
                  {callStatus === 'ringing' && isCaller ? (
                    <div className="call-status">Calling... <button onClick={handleDeclineOrEndCall}>Cancel</button></div>
                  ) : (
                    <button className="call-btn" onClick={handleStartCall} disabled={callStatus === 'ringing'}>📞 Video Call</button>
                  )}
                </div>
                <div className="chat-messages">
                    {messages.map((msg) => (<div key={msg.id} className={`message ${msg.sender === user.uid ? "message-right" : "message-left"}`}>{msg.text}</div>))}
                </div>
                <form className="message-form" onSubmit={sendMessage}>
                    <input type="text" placeholder="Type a message..." value={input} onChange={(e) => setInput(e.target.value)} />
                    <button type="submit">Send</button>
                </form>
              </>
            )
          ) : ( <p style={{ padding: "20px" }}>Select a user to start chatting</p> )}
        </div>
      </div>
    </div>
  );
};


export default ChatRoom;
