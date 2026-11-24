import { Suspense } from 'react';
import { Atlas } from '@/components/brain/Atlas';

export default function Page() {
  return (
    <Suspense>
      <Atlas />
    </Suspense>
  );
}
