import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Questionnaire, type Question } from '../components/Questionnaire';
import { useLook } from '../lib/state';

const QUESTIONS: Question[] = [
  {
    id: 'families',
    label: 'Which scent families do you love?',
    helper: 'Pick everything that draws you in.',
    type: 'multi',
    options: [
      { value: 'floral', label: 'Floral', helper: 'Rose, jasmine, peony' },
      { value: 'woody', label: 'Woody', helper: 'Sandalwood, cedar, oud' },
      { value: 'citrus', label: 'Citrus', helper: 'Bergamot, neroli, grapefruit' },
      { value: 'gourmand', label: 'Gourmand', helper: 'Vanilla, caramel, praline' },
      { value: 'fresh', label: 'Fresh / clean', helper: 'Linen, sea spray, mint' },
      { value: 'spicy', label: 'Spicy', helper: 'Cinnamon, pepper, cardamom' },
      { value: 'musky', label: 'Musky', helper: 'Skin musk, amber' },
    ],
  },
  {
    id: 'occasion',
    label: 'When will you wear it most?',
    type: 'single',
    options: [
      { value: 'daily', label: 'Every day' },
      { value: 'office', label: 'Work / office' },
      { value: 'date', label: 'Date night' },
      { value: 'events', label: 'Special events' },
      { value: 'all', label: 'A bit of everything' },
    ],
  },
  {
    id: 'seasons',
    label: 'What season are you shopping for?',
    type: 'multi',
    options: [
      { value: 'spring', label: 'Spring' },
      { value: 'summer', label: 'Summer' },
      { value: 'fall', label: 'Autumn' },
      { value: 'winter', label: 'Winter' },
    ],
  },
  {
    id: 'intensity',
    label: 'How loud do you want it?',
    type: 'single',
    options: [
      { value: 'subtle', label: 'Subtle', helper: 'Skin-close, intimate' },
      { value: 'medium', label: 'Balanced', helper: 'Noticeable in your bubble' },
      { value: 'bold', label: 'Bold', helper: 'Walks in before you do' },
    ],
  },
  {
    id: 'mood',
    label: 'What feeling are you after?',
    helper: 'Pick a couple.',
    type: 'multi',
    options: [
      { value: 'romantic', label: 'Romantic' },
      { value: 'confident', label: 'Confident' },
      { value: 'cozy', label: 'Cosy' },
      { value: 'energetic', label: 'Energetic' },
      { value: 'sophisticated', label: 'Sophisticated' },
      { value: 'playful', label: 'Playful' },
    ],
  },
  {
    id: 'budget',
    label: "What's your budget?",
    type: 'single',
    options: [
      { value: '<50', label: 'Under £50' },
      { value: '50-100', label: '£50 – £100' },
      { value: '100-200', label: '£100 – £200' },
      { value: '200+', label: '£200+' },
    ],
  },
];

export default function FragranceQuiz() {
  const { setRoutineAnswers } = useLook();

  return (
    <Screen>
      <Questionnaire
        title="Fragrance quiz"
        questions={QUESTIONS}
        onComplete={(answers) => {
          setRoutineAnswers('fragrance', answers);
          router.push('/fragrance-result');
        }}
      />
    </Screen>
  );
}
