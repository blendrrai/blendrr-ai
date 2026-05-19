import { RoutinePage } from '../../components/RoutinePage';

const LABELS = {
  hairType: 'Hair type',
  concerns: 'Concerns',
  wash: 'Wash frequency',
  treatments: 'Treatments',
  length: 'Length',
};

export default function HaircareRoutine() {
  return (
    <RoutinePage
      category="haircare"
      title="My haircare routine"
      subtitle="Your quiz answers and what you're looking to buy."
      quizRoute="/haircare-quiz"
      labels={LABELS}
      emptyQuizPrompt="Five questions and a hair photo for a routine that fits."
    />
  );
}
