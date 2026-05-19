import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Zone } from './theme';
import type { Answers } from '../components/Questionnaire';
import {
  saveRoutineAnswers as persistAnswers,
  saveRoutinePhoto as persistPhoto,
  type RoutineCategory,
} from './storage';

type LookState = {
  selfieUri: string | null;
  productUri: string | null;
  productUrl: string | null;
  zone: Zone;
  setSelfie: (uri: string | null) => void;
  setProduct: (uri: string | null, sourceUrl?: string | null) => void;
  setZone: (zone: Zone) => void;
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
  const [productUri, setProductUri] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone>('lips');

  const [routineAnswers, setAllAnswers] = useState<Record<RoutineCategory, Answers>>(emptyAnswers);
  const [routinePhotos, setAllPhotos] = useState<Record<RoutineCategory, string | null>>(emptyPhotos);

  const [ingredientPhoto, setIngredientPhoto] = useState<string | null>(null);
  const [ingredientText, setIngredientText] = useState<string>('');

  const resetIngredients = () => {
    setIngredientPhoto(null);
    setIngredientText('');
  };

  const setProduct = (uri: string | null, sourceUrl?: string | null) => {
    setProductUri(uri);
    setProductUrl(sourceUrl ?? null);
  };

  const resetTryOn = () => {
    setSelfie(null);
    setProductUri(null);
    setProductUrl(null);
    setZone('lips');
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
        productUri,
        productUrl,
        zone,
        setSelfie,
        setProduct,
        setZone,
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
