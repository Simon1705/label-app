import LabelingClient from '@/components/LabelingClient';
import { Suspense } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Labeling Session ${id}`
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LabelingClient id={id} />
    </Suspense>
  );
}
