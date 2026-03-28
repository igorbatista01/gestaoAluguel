import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);    // undefined = carregando auth
  const [perfil, setPerfil] = useState(undefined); // undefined = carregando perfil

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);
      if (u) {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        setPerfil(snap.exists() ? snap.data() : null);
      } else {
        setPerfil(null);
      }
    });
  }, []);

  const nivel = perfil?.nivel ?? null;

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = async () => {
    await signOut(auth);
    setPerfil(null);
  };

  /**
   * Cadastro com código de convite.
   * 1. Verifica o código (leitura pública permitida nas regras do Firestore).
   * 2. Cria o usuário no Firebase Auth.
   * 3. Em batch: cria o perfil em /usuarios/{uid} + marca o código como usado.
   */
  async function register(email, password, codigo, perfilData) {
    const codigoRef = doc(db, "codigos", codigo.trim().toUpperCase());
    const codigoSnap = await getDoc(codigoRef);

    if (!codigoSnap.exists()) throw new Error("Código de convite inválido.");
    if (codigoSnap.data().usado) throw new Error("Este código já foi utilizado.");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = cred.user;

    const novoPerfilData = {
      email,
      ...perfilData,
      nivel: "NORMAL",
      criadoEm: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "usuarios", uid), novoPerfilData);
    batch.update(codigoRef, { usado: true, usadoPor: uid, usadoEm: serverTimestamp() });
    await batch.commit();

    setPerfil({ ...novoPerfilData, nivel: "NORMAL" });
  }

  return (
    <AuthContext.Provider value={{ user, perfil, nivel, login, logout, register, setPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
