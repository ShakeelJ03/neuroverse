import { notFound } from 'next/navigation';
import { DISEASES, DISEASE_BY_ID } from '@/data/diseases';
import { DiseaseDetail } from '@/components/disease/DiseaseDetail';

export function generateStaticParams() {
  return DISEASES.map((d) => ({ id: d.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!DISEASE_BY_ID[id]) notFound();
  return <DiseaseDetail id={id} />;
}
