/*
 * Gato Printado — sincronização na nuvem (Firebase Auth + Cloud Firestore).
 * Os dados de cada usuário ficam em: users/{uid}/vendas, users/{uid}/insumos, users/{uid}/compras
 * Funciona offline: as alterações ficam guardadas no aparelho e sobem quando a internet volta.
 */
const V = "12.17.0";
const base = `https://www.gstatic.com/firebasejs/${V}`;

const cfg = window.FIREBASE_CONFIG || {};
const configured = !!cfg.apiKey && !String(cfg.apiKey).includes("COLE_AQUI") && !!cfg.projectId;

async function load() {
  if (!configured) return { configured: false };

  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`)
  ]);
  const {
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
    setPersistence, browserLocalPersistence
  } = authMod;
  const {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch
  } = fsMod;

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  auth.languageCode = "pt";
  await setPersistence(auth, browserLocalPersistence).catch(() => {});
  getRedirectResult(auth).catch(() => {});

  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    db = initializeFirestore(app, {});
  }

  const COLS = ["vendas", "insumos", "compras"];
  const strip = d => { const o = Object.assign({}, d); delete o.id; return o; };

  function backendFor(user, { onData, onError, onSync }) {
    const col = c => collection(db, "users", user.uid, c);
    const ref = (c, id) => doc(db, "users", user.uid, c, id);
    const unsubs = [];
    // Escritas: não esperamos o servidor (offline elas ficam na fila). Erros viram aviso.
    const fire = p => { p.catch(e => onError && onError(e)); return Promise.resolve(); };
    return {
      local: false,
      cloud: true,
      user: { uid: user.uid, email: user.email, nome: user.displayName },
      start() {
        let pending = COLS.length;
        COLS.forEach(c => {
          let first = true;
          unsubs.push(onSnapshot(col(c), { includeMetadataChanges: true }, snap => {
            onData(c, snap.docs.map(d => Object.assign({ id: d.id }, d.data())), first);
            if (first) { first = false; if (--pending === 0 && onSync) onSync("loaded"); }
            if (onSync) onSync(snap.metadata.hasPendingWrites ? "pending" : (snap.metadata.fromCache ? "offline" : "synced"));
          }, e => onError && onError(e)));
        });
      },
      stop() { unsubs.splice(0).forEach(u => u()); },
      async add(c, data) { const r = doc(col(c)); await fire(setDoc(r, strip(data))); return r.id; },
      async set(c, id, data) { return fire(setDoc(ref(c, id), strip(data))); },
      async update(c, id, patch) { return fire(updateDoc(ref(c, id), strip(patch))); },
      async del(c, id) { return fire(deleteDoc(ref(c, id))); },
      // Substitui/insere muitos registros de uma vez (importação e migração).
      async bulkPut(data, { replace = false, current = {} } = {}) {
        const ops = [];
        if (replace) COLS.forEach(c => (current[c] || []).forEach(d => ops.push(["del", c, d.id])));
        COLS.forEach(c => (data[c] || []).forEach(d => ops.push(["set", c, d.id || doc(col(c)).id, d])));
        for (let i = 0; i < ops.length; i += 400) {
          const b = writeBatch(db);
          ops.slice(i, i + 400).forEach(([op, c, id, d]) => op === "del" ? b.delete(ref(c, id)) : b.set(ref(c, id), strip(d)));
          await b.commit();
        }
        return ops.length;
      }
    };
  }

  const isStandaloneIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && (navigator.standalone || matchMedia("(display-mode: standalone)").matches);

  return {
    configured: true,
    onAuth: cb => onAuthStateChanged(auth, cb),
    backendFor,
    async google() {
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      if (isStandaloneIOS) return signInWithRedirect(auth, p);
      try { await signInWithPopup(auth, p); }
      catch (e) {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return signInWithRedirect(auth, p);
        throw e;
      }
    },
    emailLogin: (email, senha) => signInWithEmailAndPassword(auth, email, senha),
    emailSignup: (email, senha) => createUserWithEmailAndPassword(auth, email, senha),
    resetPassword: email => sendPasswordResetEmail(auth, email),
    logout: () => signOut(auth)
  };
}

window.gpCloud = load().catch(err => ({ configured: true, loadError: err }));
