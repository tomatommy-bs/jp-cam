'use client';

import { useRouter } from 'next/navigation';

import JpCamera from '@/components/jp-cam';

export default function CameraClient({ prefCode, prefName }: { prefCode: string; prefName: string }) {
  const router = useRouter();
  return <JpCamera prefCode={prefCode} prefName={prefName} onBack={() => router.push('/')} />;
}
