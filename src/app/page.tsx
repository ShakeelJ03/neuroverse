import { Suspense } from 'react';
import { Explorer } from '@/components/brain/Explorer';

export default function Page() {
  return (
    <Suspense>
      <Explorer />
    </Suspense>
  );
}
