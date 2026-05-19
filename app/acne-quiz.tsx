import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Questionnaire, type Question } from '../components/Questionnaire';
import { useLook } from '../lib/state';

const QUESTIONS: Question[] = [
  {
    id: 'location',
    label: 'Where does your acne mostly show up?',
    helper: 'Pick anywhere it regularly appears.',
    type: 'multi',
    options: [
      { value: 'forehead', label: 'Forehead' },
      { value: 'tzone', label: 'T-zone (nose + forehead)' },
      { value: 'cheeks', label: 'Cheeks' },
      { value: 'jawline', label: 'Jawline / chin' },
      { value: 'back', label: 'Back / chest' },
      { value: 'all-over', label: 'All over my face' },
    ],
  },
  {
    id: 'type',
    label: 'What does it usually look like?',
    helper: 'Pick anything that fits.',
    type: 'multi',
    options: [
      { value: 'whiteheads', label: 'Whiteheads' },
      { value: 'blackheads', label: 'Blackheads / clogged pores' },
      { value: 'red-bumps', label: 'Red, inflamed bumps' },
      { value: 'cysts', label: 'Painful cysts under the skin' },
      { value: 'scars', label: 'Marks or scars left over' },
      { value: 'milia', label: "Tiny white bumps that don't pop" },
    ],
  },
  {
    id: 'duration',
    label: 'How long have you been dealing with it?',
    type: 'single',
    options: [
      { value: 'flare', label: 'A recent flare-up' },
      { value: 'months', label: 'A few months' },
      { value: 'year+', label: 'A year or more' },
      { value: 'always', label: 'Most of my life' },
    ],
  },
  {
    id: 'triggers',
    label: "Any triggers you've noticed?",
    helper: 'Pick all that apply.',
    type: 'multi',
    options: [
      { value: 'cycle', label: 'My menstrual cycle' },
      { value: 'diet', label: 'Diet (dairy, sugar, etc.)' },
      { value: 'stress', label: 'Stress' },
      { value: 'products', label: 'Specific products' },
      { value: 'weather', label: 'Weather / humidity' },
      { value: 'masks', label: 'Masks / sweat' },
      { value: 'none', label: 'Nothing obvious' },
    ],
  },
  {
    id: 'tried',
    label: 'What have you already tried?',
    helper: 'So we can build on it, not repeat it.',
    type: 'multi',
    options: [
      { value: 'nothing', label: 'Nothing really' },
      { value: 'otc', label: 'Drugstore spot treatments' },
      { value: 'salicylic', label: 'Salicylic acid' },
      { value: 'benzoyl', label: 'Benzoyl peroxide' },
      { value: 'retinoid', label: 'Retinol / retinoid' },
      { value: 'prescription', label: 'Prescription from a doctor' },
      { value: 'derm', label: 'Saw a dermatologist' },
    ],
  },
  {
    id: 'sensitivity',
    label: 'How sensitive is your skin?',
    type: 'single',
    options: [
      { value: 'very', label: 'Very — reacts to most things' },
      { value: 'some', label: 'Somewhat — reacts to strong actives' },
      { value: 'normal', label: 'Normal — tolerates most products' },
      { value: 'tough', label: 'Tough — can handle most actives' },
    ],
  },
];

export default function AcneQuiz() {
  const { setRoutineAnswers } = useLook();

  return (
    <Screen>
      <Questionnaire
        title="Acne check-in"
        questions={QUESTIONS}
        onComplete={(answers) => {
          setRoutineAnswers('acne', answers);
          router.push('/acne-photo');
        }}
      />
    </Screen>
  );
}
