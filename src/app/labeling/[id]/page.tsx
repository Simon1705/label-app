import LabelingClient from '@/components/LabelingClient';
import { Suspense } from 'react';

interface PageParams {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageParams) {
  return {
    title: `Labeling Session ${params.id}`
  };
}

export default async function LabelingPage({ params }: PageParams) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LabelingClient id={params.id} />
    </Suspense>
  );
}
