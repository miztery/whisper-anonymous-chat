
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, firebaseConfigured, googleProvider } from "./firebase";

const DEFAULT_ROOMS = [
  { id: "general", name: "General", description: "Meet everyone and say hello", icon: "🌐" },
  { id: "random", name: "Random", description: "Anything and everything", icon: "🎲" },
  { id: "interests", name: "Interests", description: "Talk about what you love", icon: "✨" },
];

function cleanUsername(value) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function friendlyError(error) {
  const known = {
    "auth/email-already-in-use": "That email address is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
    "permission-denied": "Firebase denied this action. Check your Firestore rules and the permissions for this operation.",
  };

  return known[error?.code] || error?.message || "Something went wrong. Please try again.";
}

function Avatar({ name = "Anonymous", small = false }) {
  const initials = name.replace(/^@/, "").slice(0, 1).toUpperCase() || "A";

  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`}>
      {initials}
    </span>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "register") {
        const normalized = cleanUsername(username);

        if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
          throw new Error(
            "Username must be 3–20 characters and use only letters, numbers, or underscores."
          );
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, { displayName: normalized });

        await createUserProfile(
          credential.user.uid,
          normalized,
          email.trim()
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setBusy(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profileRef = doc(db, "profiles", result.user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        sessionStorage.setItem("needsUsername", "true");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand brand-auth">
          <span className="brand-mark">w</span>
          <span>whisper</span>
        </div>

        <div className="eyebrow">A LITTLE MORE YOU, A LITTLE LESS IDENTITY</div>

        <h1>{mode === "login" ? "Welcome back." : "Find your voice."}</h1>

        <p className="muted auth-intro">
          Connect with people, share a thought, and keep your real-world identity private.
        </p>

        <button className="google-button" onClick={googleSignIn} disabled={busy}>
          <span className="google-g">G</span> Continue with Google
        </button>

        <div className="or-divider">
          <span>or use your email</span>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Anonymous username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. moonwalker27"
                minLength={3}
                maxLength={20}
                required
              />
              <small>
                3–20 letters, numbers, or underscores. This is your public identity.
              </small>
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-button full-button" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="switch-auth">
          {mode === "login" ? "New to Whisper?" : "Already have an account?"}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>

        <p className="privacy-note">
          Your email is used for account access and is never shown on your public profile.
        </p>
      </section>
    </main>
  );
}

async function createUserProfile(uid, username) {
  const normalized = cleanUsername(username);

  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    throw new Error(
      "Choose a username with 3–20 letters, numbers, or underscores."
    );
  }

  const profileRef = doc(db, "profiles", uid);
  const usernameRef = doc(db, "usernames", normalized);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(usernameRef);

    if (existing.exists()) {
      throw new Error("That username is already taken. Please choose another.");
    }

    transaction.set(usernameRef, {
      uid,
      createdAt: serverTimestamp(),
    });

    transaction.set(profileRef, {
      uid,
      username: normalized,
      displayName: `@${normalized}`,
      avatarSeed: normalized.slice(0, 1).toUpperCase(),
      createdAt: serverTimestamp(),
    });
  });
}

function UsernameSetup({ user, onDone }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await createUserProfile(user.uid, username);
      sessionStorage.removeItem("needsUsername");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand brand-auth">
          <span className="brand-mark">w</span>
          <span>whisper</span>
        </div>

        <div className="eyebrow">ONE LAST THING</div>
        <h1>Choose your alias.</h1>

        <p className="muted auth-intro">
          This is how other people will see you. Your Google name and email stay private.
        </p>

        <form onSubmit={save} className="auth-form">
          <label>
            Anonymous username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. starlight_08"
              minLength={3}
              maxLength={20}
              required
            />
          </label>

          <small>3–20 letters, numbers, or underscores.</small>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-button full-button" disabled={busy}>
            {busy ? "Saving…" : "Continue to Whisper"}
          </button>
        </form>

        <button className="text-button" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [people, setPeople] = useState([]);
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);

  const [active, setActive] = useState({
    type: "room",
    id: "general",
    name: "General",
    icon: "🌐",
  });

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [notice, setNotice] = useState("");

  const [theme, setTheme] = useState(
    () => localStorage.getItem("whisper-theme") || "dark"
  );

  const bottomRef = useRef(null);
  const peopleSearchRef = useRef(null);

  // AUTHENTICATION AND PROFILE
  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }

    let profileUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (current) => {
      if (profileUnsubscribe) profileUnsubscribe();

      profileUnsubscribe = null;
      setUser(current);
      setProfile(null);
      setProfileReady(false);
      setPeople([]);
      setMessages([]);
      setAuthReady(true);

      if (!current) {
        setProfileReady(true);
        return;
      }

      profileUnsubscribe = onSnapshot(
        doc(db, "profiles", current.uid),
        (snap) => {
          setProfile(snap.exists() ? snap.data() : null);
          setProfileReady(true);
        },
        (error) => {
          setNotice(friendlyError(error));
          setProfileReady(true);
        }
      );
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  // PEOPLE DIRECTORY
  useEffect(() => {
    if (!user || !profile) return;

    const q = query(collection(db, "profiles"), limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        setPeople(
          snapshot.docs
            .map((d) => d.data())
            .filter((p) => p.uid !== user.uid)
        );
      },
      (error) => setNotice(friendlyError(error))
    );
  }, [user, profile]);

  // PUBLIC ROOMS
  useEffect(() => {
    if (!user || !profile) return;

    const q = query(collection(db, "rooms"), orderBy("name"));

    return onSnapshot(
      q,
      async (snapshot) => {
        const found = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const missing = DEFAULT_ROOMS.filter(
          (room) => !found.some((item) => item.id === room.id)
        );

        for (const room of missing) {
          try {
            await setDoc(
              doc(db, "rooms", room.id),
              {
                name: room.name,
                description: room.description,
                icon: room.icon,
                createdBy: "system",
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (error) {
            setNotice(friendlyError(error));
          }
        }

        setRooms(found.length ? found : DEFAULT_ROOMS);
      },
      (error) => setNotice(friendlyError(error))
    );
  }, [user, profile]);

  // MESSAGE LISTENER
  useEffect(() => {
    if (!user || !profile || !active) return;

    const messageCollection =
      active.type === "room"
        ? collection(db, "rooms", active.id, "messages")
        : collection(db, "chats", active.id, "messages");

    const q = query(
      messageCollection,
      orderBy("createdAt", "asc"),
      limit(100)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
      },
      (error) => setNotice(friendlyError(error))
    );
  }, [user, profile, active]);

  // SCROLL TO LATEST MESSAGE
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  // FOCUS PEOPLE SEARCH WHEN THE MOBILE DRAWER OPENS
  useEffect(() => {
    if (!mobilePanel) return;

    const timer = window.setTimeout(() => {
      peopleSearchRef.current?.focus();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [mobilePanel]);

  const filteredPeople = useMemo(() => {
    const term = search.trim().toLowerCase();

    return people.filter((person) =>
      (person.username || "").toLowerCase().includes(term)
    );
  }, [people, search]);

  // NEW CONVERSATION
  function startNewConversation() {
    setSearch("");
    setMobilePanel(true);

    // On desktop, the people list is already visible.
    // On mobile, opening the drawer triggers the search-focus effect.
    if (window.matchMedia("(min-width: 761px)").matches) {
      peopleSearchRef.current?.focus();
    }
  }

  // OPEN PRIVATE CHAT
  async function openDirectChat(person) {
    if (!user || !person?.uid || person.uid === user.uid) return;

    const members = [user.uid, person.uid].sort();
    const chatId = members.join("_");

    try {
      await setDoc(
        doc(db, "chats", chatId),
        {
          members,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setActive({
        type: "direct",
        id: chatId,
        name: `@${person.username}`,
        person,
      });

      setMobilePanel(false);
      setDraft("");
      setNotice("");
    } catch (error) {
      setNotice(friendlyError(error));
    }
  }

  // SEND MESSAGE
  async function sendMessage(event) {
    event.preventDefault();

    const body = draft.trim();

    if (!body || body.length > 2000 || !user || !profile) return;

    setDraft("");

    try {
      const parent =
        active.type === "room"
          ? collection(db, "rooms", active.id, "messages")
          : collection(db, "chats", active.id, "messages");

      await addDoc(parent, {
        text: body,
        senderId: user.uid,
        senderName: profile.username,
        createdAt: serverTimestamp(),
      });

      if (active.type === "direct") {
        await setDoc(
          doc(db, "chats", active.id),
          {
            updatedAt: serverTimestamp(),
            lastMessage: body.slice(0, 120),
          },
          { merge: true }
        );
      }
    } catch (error) {
      setDraft(body);
      setNotice(friendlyError(error));
    }
  }

  // CREATE PUBLIC ROOM
  async function createRoom() {
    const name = window.prompt(
      "Name your public room (2–30 characters):"
    );

    if (!name?.trim()) return;

    const clean = name.trim().replace(/\s+/g, " ").slice(0, 30);

    if (clean.length < 2) {
      setNotice("Room name must contain at least 2 characters.");
      return;
    }

    const id =
      clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

    try {
      await setDoc(doc(db, "rooms", id), {
        name: clean,
        description: "A community-created room",
        icon: "💬",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setActive({
        type: "room",
        id,
        name: clean,
        icon: "💬",
      });

      setMobilePanel(false);
    } catch (error) {
      setNotice(friendlyError(error));
    }
  }

  function selectRoom(room) {
    setActive({
      type: "room",
      ...room,
    });

    setMobilePanel(false);
    setDraft("");
    setNotice("");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";

    setTheme(next);
    localStorage.setItem("whisper-theme", next);
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      setMobilePanel(false);
    } catch (error) {
      setNotice(friendlyError(error));
    }
  }

  if (!firebaseConfigured) {
    return (
      <main className="setup-screen">
        <div className="setup-card">
          <div className="brand">
            <span className="brand-mark">w</span>
            <span>whisper</span>
          </div>

          <h1>Connect your Firebase project</h1>

          <p>
            The website source is ready. Add your Firebase Web App settings
            to <code>.env.local</code> to enable registration and chat.
          </p>

          <ol>
            <li>Open Firebase Console and select your project.</li>
            <li>Go to Project settings → General → Your apps → Web app.</li>
            <li>Copy the Firebase config values into <code>.env.local</code>.</li>
            <li>Enable Email/Password and Google under Authentication → Sign-in method.</li>
            <li>Publish your Firestore rules in Firestore → Rules.</li>
          </ol>

          <p>See <code>README.md</code> for the complete setup guide.</p>
        </div>
      </main>
    );
  }

  if (!authReady || (user && !profileReady)) {
    return (
      <main className="loading-screen">
        <div className="brand">
          <span className="brand-mark">w</span>
          <span>whisper</span>
        </div>
        <div className="loader" />
        <p>Getting things ready…</p>
      </main>
    );
  }

  if (!user) return <AuthScreen />;

  if (!profile) {
    return (
      <UsernameSetup
        user={user}
        onDone={() =>
          getDoc(doc(db, "profiles", user.uid)).then((snap) => {
            if (snap.exists()) setProfile(snap.data());
          })
        }
      />
    );
  }

  return (
    <div className={`app-shell theme-${theme}`}>

      {/* MOBILE BACKDROP */}
      {mobilePanel && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobilePanel(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobilePanel ? "sidebar-open" : ""}`}>

        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark">w</span>
            <span>whisper</span>
          </div>

          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobilePanel(false)}
          >
            ×
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={startNewConversation}
        >
          <span>＋</span> New conversation
        </button>

        {/* PUBLIC ROOMS */}
        <div className="side-section">
          <div className="section-heading">
            <span>PUBLIC ROOMS</span>
            <button
              className="tiny-icon"
              title="Create room"
              aria-label="Create room"
              onClick={createRoom}
            >
              ＋
            </button>
          </div>

          {rooms.map((room) => (
            <button
              key={room.id}
              className={`nav-item ${
                active.type === "room" && active.id === room.id
                  ? "selected"
                  : ""
              }`}
              onClick={() => selectRoom(room)}
            >
              <span className="nav-emoji">{room.icon || "💬"}</span>
              <span>{room.name}</span>
            </button>
          ))}
        </div>

        {/* PEOPLE */}
        <div className="side-section people-section">
          <div className="section-heading">
            <span>PEOPLE</span>
            <span className="count-pill">{people.length}</span>
          </div>

          <div className="search-wrap">
            <span>⌕</span>
            <input
              ref={peopleSearchRef}
              id="people-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone…"
              aria-label="Search people"
            />
          </div>

          <div className="people-list">
            {filteredPeople.map((person) => (
              <button
                key={person.uid}
                className={`person-item ${
                  active.type === "direct" &&
                  active.person?.uid === person.uid
                    ? "selected"
                    : ""
                }`}
                onClick={() => openDirectChat(person)}
              >
                <Avatar name={person.username} small />
                <span className="person-name">@{person.username}</span>
              </button>
            ))}

            {filteredPeople.length === 0 && (
              <p className="empty-small">
                {search.trim()
                  ? "No matching people found."
                  : "No people found yet."}
              </p>
            )}
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="sidebar-footer">
          <Avatar name={profile.username} small />

          <div className="account-info">
            <strong>@{profile.username}</strong>
            <span>Anonymous member</span>
          </div>

          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            ↪
          </button>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="chat-main">

        {/* STATIC HEADER */}
        <header className="chat-header">

          <div className="header-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobilePanel(true)}
            >
              ☰
            </button>

            <div className="active-icon">
              {active.type === "room" ? (
                active.icon || "💬"
              ) : (
                <Avatar
                  name={active.person?.username || active.name}
                  small
                />
              )}
            </div>

            <div className="header-title">
              <h2>
                {active.type === "room"
                  ? `# ${active.name}`
                  : active.name}
              </h2>

              <p>
                {active.type === "room"
                  ? "Public room · Everyone is welcome"
                  : "Private conversation"}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="secure-label">
              <span className="secure-dot" />
              Anonymous space
            </span>

            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>

            <button
              className="icon-button desktop-signout"
              title="Sign out"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              ↪
            </button>
          </div>
        </header>

        {/* NOTIFICATIONS */}
        {notice && (
          <div className="notice-bar">
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        )}

        {/* MESSAGES */}
        <section className="message-area">
          <div className="welcome-block">
            <div className="welcome-symbol">
              {active.type === "room" ? active.icon || "💬" : "✉️"}
            </div>

            <h1>
              {active.type === "room"
                ? `Welcome to ${active.name}`
                : `Say hello to ${active.name}`}
            </h1>

            <p>
              {active.type === "room"
                ? active.description || "A place for open conversation."
                : "Only you and this person can see this conversation."}
            </p>

            <span className="welcome-rule" />
          </div>

          {messages.map((message) => {
            const mine = message.senderId === user.uid;

            return (
              <div
                key={message.id}
                className={`message-row ${mine ? "mine" : ""}`}
              >
                <Avatar name={message.senderName} small />

                <div className="message-content">
                  <div className="message-meta">
                    <strong>
                      {mine
                        ? "You"
                        : `@${message.senderName || "anonymous"}`}
                    </strong>

                    <span>
                      {message.createdAt?.toDate
                        ? message.createdAt.toDate().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "sending…"}
                    </span>
                  </div>

                  <div className="message-bubble">
                    {message.text}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </section>

        {/* MESSAGE COMPOSER */}
        <form className="composer" onSubmit={sendMessage}>
          <div className="composer-inner">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${
                active.type === "room" ? "#" + active.name : active.name
              }…`}
              maxLength={2000}
              aria-label="Write a message"
            />

            <span className="char-count">
              {draft.length}/2000
            </span>

            <button
              className="send-button"
              disabled={!draft.trim()}
              aria-label="Send message"
              type="submit"
            >
              ➤
            </button>
          </div>

          <div className="composer-hint">
            <span>↵ Enter to send</span>
            <span>Be kind. Stay anonymous.</span>
          </div>
        </form>
      </main>
    </div>
  );
}

export default App;
