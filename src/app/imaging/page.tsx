import { Suspense } from 'react';
import { ImagingLab } from '@/components/imaging/ImagingLab';

export default function Page() {
  return (
    <Suspense>
      <ImagingLab />
    </Suspense>
  );
}
