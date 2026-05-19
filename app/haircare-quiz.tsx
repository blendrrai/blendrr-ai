import { router } from 'expo-router';
import { Screen } from '../components/Screen';
import { Questionnaire, type Question } from '../components/Questionnaire';
import { useLook } from '../lib/state';

const QUESTIONS: Question[] = [
  {
    id: 'hairType',
    label: "What's your hair type?",
    type: 'single',
    options: [
      { value: 'straight', label: 'Straight' },
      { value: 'wavy', label: 'Wavy' },
      { value: 'curly', label: 'Curly' },
      { value: 'coily', label: 'Coily / kinky' },
    ],
  },
  {
    id: 'concerns',
    label: "What's bothering you most?",
    helper: 'Pick all that apply.',
    type: 'multi',
    options: [
      { value: 'frizz', label: 'Frizz' },
      { value: 'breakage', label: 'Breakage / split ends' },
      { value: 'oily', label: 'Oily roots' },
      { value: 'dry', label: 'Dry / brittle ends' },
      { value: 'color-damage', label: 'Colour damage' },
      { value: 'growth', label: 'Slow growth' },
      { value: 'flat', label: 'No volume' },
    ],
  },
  {
    id: 'wash',
    label: 'How often do you wash?',
    type: 'single',
    options: [
      { value: 'daily', label: 'Every day' },
      { value: 'alt', label: 'Every other day' },
      { value: '2x', label: '2× a week' },
      { value: '1x', label: 'Once a week or less' },
    ],
  },
  {
    id: 'treatments',
    label: 'What have you done to your hair?',
    helper: "Pick anything that's been done in the last 12 months.",
    type: 'multi',
    options: [
      { value: 'colour', label: 'Coloured' },
      { value: 'bleach', label: 'Bleached / highlights' },
      { value: 'relax', label: 'Chemically straightened' },
      { value: 'heat', label: 'Regular heat styling' },
      { value: 'natural', label: 'Nothing, all natural' },
    ],
  },
  {
    id: 'length',
    label: 'How long is your hair?',
    type: 'single',
    options: [
      { value: 'short', label: 'Pixie / short' },
      { value: 'mid', label: 'Shoulder length' },
      { value: 'long', label: 'Long' },
      { value: 'extra', label: 'Very long' },
    ],
  },
];

export default function HaircareQuiz() {
  const { setRoutineAnswers } = useLook();

  return (
    <Screen>
      <Questionnaire
        title="Haircare quiz"
        questions={QUESTIONS}
        onComplete={(answers) => {
          setRoutineAnswers('haircare', answers);
          router.push('/haircare-photo');
        }}
      />
    </Screen>
  );
}
