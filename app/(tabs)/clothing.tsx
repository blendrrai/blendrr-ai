import { router } from 'expo-router';
import { Shirt } from 'lucide-react-native';
import { CategoryHome } from '../../components/CategoryHome';
import { useLook } from '../../lib/state';

export default function ClothingTab() {
  const { setCategory, resetTryOn } = useLook();

  return (
    <CategoryHome
      eyebrow="Clothing"
      title={'Fit check,\nbefore you check out.'}
      subtitle="Try on tops, dresses, shoes — anything you're about to buy. See how it looks on you before the cart."
      Icon={Shirt}
      ctaLabel="Start a fit"
      onStart={() => {
        resetTryOn();
        setCategory('clothing');
        router.push('/clothing-zone');
      }}
    />
  );
}
