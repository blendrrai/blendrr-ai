import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Zone } from './theme';

type LookState = {
  selfieUri: string | null;
  productUri: string | null;
  productUrl: string | null;
  zone: Zone;
  setSelfie: (uri: string | null) => void;
  setProduct: (uri: string | null, sourceUrl?: string | null) => void;
  setZone: (zone: Zone) => void;
  reset: () => void;
};

const LookContext = createContext<LookState | null>(null);

export function LookProvider({ children }: { children: ReactNode }) {
  const [selfieUri, setSelfie] = useState<string | null>(null);
  const [productUri, setProductUri] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone>('lips');

  const setProduct = (uri: string | null, sourceUrl?: string | null) => {
    setProductUri(uri);
    setProductUrl(sourceUrl ?? null);
  };

  const reset = () => {
    setSelfie(null);
    setProductUri(null);
    setProductUrl(null);
    setZone('lips');
  };

  return (
    <LookContext.Provider
      value={{ selfieUri, productUri, productUrl, zone, setSelfie, setProduct, setZone, reset }}
    >
      {children}
    </LookContext.Provider>
  );
}

export function useLook() {
  const ctx = useContext(LookContext);
  if (!ctx) throw new Error('useLook must be used inside LookProvider');
  return ctx;
}
