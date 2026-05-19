import { RoutinePage } from '../../components/RoutinePage';

const LABELS = {
  families: 'Scent families',
  occasion: 'Occasion',
  seasons: 'Seasons',
  intensity: 'Intensity',
  mood: 'Mood',
  budget: 'Budget',
};

export default function FragranceRoutine() {
  return (
    <RoutinePage
      category="fragrance"
      title="My scent picks"
      subtitle="Your scent profile and bottles on the wishlist."
      quizRoute="/fragrance-quiz"
      labels={LABELS}
      emptyQuizPrompt="Six taste-based questions to find your signature scent."
    />
  );
}
