import { router } from 'expo-router';
import { Droplet } from 'lucide-react-native';
import { CategoryHome } from '../../components/CategoryHome';
import { useLook } from '../../lib/state';

export default function SkincareTab() {
  const { resetRoutine } = useLook();

  return (
    <CategoryHome
      eyebrow="Skincare"
      title={'Your skin,\nfigured out.'}
      subtitle="Answer a few quick questions, snap a selfie, and BLENDRR tells you what your routine is missing."
      Icon={Droplet}
      ctaLabel="Start quiz"
      onStart={() => {
        resetRoutine('skincare');
        router.push('/skincare-quiz');
      }}
      secondaryCta={{
        label: 'Got acne? Try this quiz instead',
        onPress: () => router.push('/acne-quiz'),
      }}
    />
  );
}
