import DatasetDetailsClient from '@/components/DatasetDetailsClient';
import { Suspense } from 'react';

interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: `Dataset Details ${params.id}`
  };
}

export default async function DatasetDetailsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DatasetDetailsClient id={params.id} />
    </Suspense>
  );
}
