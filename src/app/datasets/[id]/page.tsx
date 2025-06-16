import DatasetDetailsClient from '@/components/DatasetDetailsClient';
import { Suspense } from 'react';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Dataset Details ${id}`
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DatasetDetailsClient id={id} />
    </Suspense>
  );
}
