import DatasetDetailsClient from '@/components/DatasetDetailsClient';
import { Suspense } from 'react';

interface PageParams {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageParams) {
  return {
    title: `Dataset Details ${params.id}`
  };
}

export default async function DatasetDetailsPage({ params }: PageParams) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DatasetDetailsClient id={params.id} />
    </Suspense>
  );
}
