import { RoutinePage } from '../../components/RoutinePage';

const LABELS = {
  skinType: 'Skin type',
  concerns: 'Concerns',
  routine: 'Current routine',
  age: 'Age range',
  climate: 'Climate',
};

export default function SkincareRoutine() {
  return (
    <RoutinePage
      category="skincare"
      title="My skincare routine"
      subtitle="Your quiz answers and what you're looking to buy."
      quizRoute="/skincare-quiz"
      labels={LABELS}
      emptyQuizPrompt="Five quick questions and a selfie to map your skin."
    />
  );
}
