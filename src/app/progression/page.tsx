import { Suspense } from 'react';
import { Progression } from '@/components/disease/Progression';

export default function Page() {
  return (
    <Suspense>
      <Progression />
    </Suspense>
  );
}
