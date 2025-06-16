import LabelingClient from '@/components/LabelingClient';
import { Suspense } from 'react';

interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: `Labeling Session ${params.id}`
  };
}

export default async function LabelingPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LabelingClient id={params.id} />
    </Suspense>
  );
}
