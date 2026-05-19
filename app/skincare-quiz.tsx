import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Questionnaire, type Question } from '../components/Questionnaire';
import { useLook } from '../lib/state';

const QUESTIONS: Question[] = [
  {
    id: 'skinType',
    label: 'How does your skin usually feel?',
    helper: 'Pick whichever fits most mornings.',
    type: 'single',
    options: [
      { value: 'oily', label: 'Oily', helper: 'Shiny by midday, larger pores' },
      { value: 'dry', label: 'Dry', helper: 'Tight, sometimes flaky' },
      { value: 'combo', label: 'Combination', helper: 'Oily T-zone, dry cheeks' },
      { value: 'normal', label: 'Normal', helper: 'Balanced most days' },
      { value: 'sensitive', label: 'Sensitive', helper: 'Reacts easily, redness' },
    ],
  },
  {
    id: 'concerns',
    label: 'What do you want to work on?',
    helper: 'Pick everything that applies.',
    type: 'multi',
    options: [
      { value: 'acne', label: 'Breakouts' },
      { value: 'dark-spots', label: 'Dark spots / pigmentation' },
      { value: 'lines', label: 'Fine lines' },
      { value: 'dullness', label: 'Dullness' },
      { value: 'redness', label: 'Redness' },
      { value: 'texture', label: 'Texture / pores' },
    ],
  },
  {
    id: 'routine',
    label: 'What does your current routine look like?',
    type: 'single',
    options: [
      { value: 'none', label: 'Nothing really' },
      { value: 'minimal', label: 'Cleanser only' },
      { value: 'basic', label: 'Cleanser + moisturizer' },
      { value: 'full', label: 'Five steps or more' },
    ],
  },
  {
    id: 'age',
    label: 'Your age range?',
    type: 'single',
    options: [
      { value: '<20', label: 'Under 20' },
      { value: '20s', label: '20–29' },
      { value: '30s', label: '30–39' },
      { value: '40+', label: '40+' },
    ],
  },
  {
    id: 'climate',
    label: 'Where do you live, weather-wise?',
    type: 'single',
    options: [
      { value: 'humid', label: 'Humid' },
      { value: 'dry', label: 'Dry' },
      { value: 'mild', label: 'Mild / temperate' },
      { value: 'cold', label: 'Cold winters' },
    ],
  },
];

export default function SkincareQuiz() {
  const { setRoutineAnswers } = useLook();

  return (
    <Screen>
      <Questionnaire
        title="Skincare quiz"
        questions={QUESTIONS}
        onComplete={(answers) => {
          setRoutineAnswers('skincare', answers);
          router.push('/skincare-photo');
        }}
      />
    </Screen>
  );
}
