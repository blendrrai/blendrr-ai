import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Category, ClothingZone, Mode, Quality, Zone } from './theme';
import type { Answers } from '../components/Questionnaire';
import {
  saveRoutineAnswers as persistAnswers,
  saveRoutinePhoto as persistPhoto,
  type RoutineCategory,
} from './storage';

type LookState = {
  selfieUri: string | null;
  /** All product images for the current try-on. Length 1 for single, up to 5 for multi. */
  productUris: string[];
  /** Parallel array of source URLs (or nulls if uploaded directly). */
  productUrls: (string | null)[];
  zone: Zone;
  mode: Mode;
  quality: Quality;
  /** Which flow the user is in. Drives prompt selection on the server side. */
  category: Category;
  /** Selected clothing region — only meaningful when category === 'clothing'. */
  clothingZone: ClothingZone;
  setCategory: (category: Category) => void;
  setClothingZone: (zone: ClothingZone) => void;
  setSelfie: (uri: string | null) => void;
  /** Add a product to the list. Replaces if single mode. */
  addProduct: (uri: string, sourceUrl?: string | null) => void;
  /** Remove the product at index. */
  removeProduct: (index: number) => void;
  /** Replace a specific product at index. */
  replaceProduct: (index: number, uri: string, sourceUrl?: string | null) => void;
  /** Set the entire products array (used by mode transitions). */
  setProducts: (uris: string[], urls?: (string | null)[]) => void;
  setZone: (zone: Zone) => void;
  setMode: (mode: Mode) => void;
  setQuality: (quality: Quality) => void;
  resetTryOn: () => void;

  routineAnswers: Record<RoutineCategory, Answers>;
  routinePhotos: Record<RoutineCategory, string | null>;
  setRoutineAnswers: (category: RoutineCategory, answers: Answers) => void;
  setRoutinePhoto: (category: RoutineCategory, uri: string | null) => void;
  resetRoutine: (category: RoutineCategory) => void;

  ingredientPhoto: string | null;
  ingredientText: string;
  setIngredientPhoto: (uri: string | null) => void;
  setIngredientText: (text: string) => void;
  resetIngredients: () => void;
};

const LookContext = createContext<LookState | null>(null);

const emptyAnswers: Record<RoutineCategory, Answers> = {
  skincare: {},
  haircare: {},
  fragrance: {},
  acne: {},
};

const emptyPhotos: Record<RoutineCategory, string | null> = {
  skincare: null,
  haircare: null,
  fragrance: null,
  acne: null,
};

export function LookProvider({ children }: { children: ReactNode }) {
  const [selfieUri, setSelfie] = useState<string | null>(null);
  const [productUris, setProductUris] = useState<string[]>([]);
  const [productUrls, setProductUrls] = useState<(string | null)[]>([]);
  const [zone, setZone] = useState<Zone>('lips');
  const [mode, setModeState] = useState<Mode>('single');
  // Always 'ultra' — quality picker screen was removed. setQuality stays
  // exposed for compatibility but isn't invoked from any current flow.
  const [quality, setQuality] = useState<Quality>('ultra');
  const [category, setCategory] = useState<Category>('beauty');
  const [clothingZone, setClothingZone] = useState<ClothingZone>('top');

  const [routineAnswers, setAllAnswers] = useState<Record<RoutineCategory, Answers>>(emptyAnswers);
  const [routinePhotos, setAllPhotos] = useState<Record<RoutineCategory, string | null>>(emptyPhotos);

  const [ingredientPhoto, setIngredientPhoto] = useState<string | null>(null);
  const [ingredientText, setIngredientText] = useState<string>('');

  const resetIngredients = () => {
    setIngredientPhoto(null);
    setIngredientText('');
  };

  const addProduct = (uri: string, sourceUrl?: string | null) => {
    if (mode === 'single') {
      setProductUris([uri]);
      setProductUrls([sourceUrl ?? null]);
      return;
    }
    setProductUris((prev) => [...prev, uri].slice(0, 5));
    setProductUrls((prev) => [...prev, sourceUrl ?? null].slice(0, 5));
  };

  const removeProduct = (index: number) => {
    setProductUris((prev) => prev.filter((_, i) => i !== index));
    setProductUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const replaceProduct = (index: number, uri: string, sourceUrl?: string | null) => {
    setProductUris((prev) => prev.map((p, i) => (i === index ? uri : p)));
    setProductUrls((prev) => prev.map((p, i) => (i === index ? (sourceUrl ?? null) : p)));
  };

  const setProducts = (uris: string[], urls?: (string | null)[]) => {
    setProductUris(uris);
    setProductUrls(urls ?? uris.map(() => null));
  };

  const setMode = (next: Mode) => {
    setModeState(next);
    // Switching to single mode? Trim to 1 product.
    if (next === 'single' && productUris.length > 1) {
      setProductUris((prev) => prev.slice(0, 1));
      setProductUrls((prev) => prev.slice(0, 1));
    }
  };

  const resetTryOn = () => {
    setSelfie(null);
    setProductUris([]);
    setProductUrls([]);
    setZone('lips');
    setModeState('single');
    setQuality('medium');
  };

  const setRoutineAnswers = (category: RoutineCategory, answers: Answers) => {
    setAllAnswers((prev) => ({ ...prev, [category]: answers }));
    void persistAnswers(category, answers);
  };

  const setRoutinePhoto = (category: RoutineCategory, uri: string | null) => {
    setAllPhotos((prev) => ({ ...prev, [category]: uri }));
    void persistPhoto(category, uri);
  };

  const resetRoutine = (category: RoutineCategory) => {
    setAllAnswers((prev) => ({ ...prev, [category]: {} }));
    setAllPhotos((prev) => ({ ...prev, [category]: null }));
  };

  return (
    <LookContext.Provider
      value={{
        selfieUri,
        productUris,
        productUrls,
        zone,
        mode,
        quality,
        category,
        clothingZone,
        setCategory,
        setClothingZone,
        setSelfie,
        addProduct,
        removeProduct,
        replaceProduct,
        setProducts,
        setZone,
        setMode,
        setQuality,
        resetTryOn,
        routineAnswers,
        routinePhotos,
        setRoutineAnswers,
        setRoutinePhoto,
        resetRoutine,
        ingredientPhoto,
        ingredientText,
        setIngredientPhoto,
        setIngredientText,
        resetIngredients,
      }}
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
