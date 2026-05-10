'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import JpCamera from '@/components/jp-cam';

export default function CameraClient({ prefCode, prefName }: { prefCode: string; prefName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCityId = searchParams.get('city') ?? undefined;
  return (
    <JpCamera
      prefCode={prefCode}
      prefName={prefName}
      initialCityId={initialCityId}
      onBack={() => router.push('/')}
    />
  );
}
